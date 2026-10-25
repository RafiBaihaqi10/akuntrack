-- AkunTrack · Urungkan penjualan data lama
--
-- Accounts imported from the old Excel were inserted already Sold, so their
-- only status_history entry has no status_lama and "Urungkan penjualan"
-- refused them. A Sold account with no earlier status now goes back to
-- Belum Sold, so an incomplete old sale can be sold again with its price.

create or replace function public.undo_last_status_change(p_account_id uuid)
returns public.account_status
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_last public.status_history;
  v_current public.account_status;
  v_tujuan public.account_status;
begin
  select status into v_current from public.accounts where id = p_account_id for update;
  if not found then
    raise exception 'Akun tidak ditemukan' using errcode = 'no_data_found';
  end if;

  select * into v_last
    from public.status_history
   where account_id = p_account_id
   order by waktu desc, id desc
   limit 1;

  if found and v_last.status_lama is not null then
    if v_last.status_baru <> v_current then
      raise exception 'Status sudah berubah lagi, tidak bisa diurungkan' using errcode = 'check_violation';
    end if;
    v_tujuan := v_last.status_lama;
  elsif v_current = 'Sold' then
    -- Entered as Sold (Excel import): no earlier status to return to
    v_tujuan := 'Belum Sold';
  else
    raise exception 'Tidak ada perubahan status untuk diurungkan' using errcode = 'no_data_found';
  end if;

  if v_current = 'Sold' then
    delete from public.sales where account_id = p_account_id;
  end if;

  update public.accounts set status = v_tujuan where id = p_account_id;

  if v_last.status_lama is not null then
    -- Drop the undone entry and the one the update above just wrote
    delete from public.status_history where account_id = p_account_id and id >= v_last.id;
  else
    -- Keep the insert entry; drop only the Sold → Belum Sold just written,
    -- so this cannot be "undone" back to a Sold without a sale
    delete from public.status_history
     where account_id = p_account_id and (v_last.id is null or id > v_last.id);
  end if;

  return v_tujuan;
end;
$$;
