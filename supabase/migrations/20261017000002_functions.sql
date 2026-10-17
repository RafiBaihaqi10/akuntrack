-- AkunTrack · 2/3 · Triggers and RPC functions
--
-- RPCs run as SECURITY INVOKER, so RLS still applies to every statement.
-- The only SECURITY DEFINER function (new-user bootstrap) lives in the
-- `private` schema, which is not exposed through the Data API.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function private.set_updated_at();

create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function private.set_updated_at();

-- Kurs Payoneer in use: market rate minus the spread, or the manual rate
create function public.kurs_payoneer_aktif()
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when s.mode_kurs = 'manual' then s.kurs_payoneer_manual
    else s.kurs_pasar - s.selisih_payoneer
  end
  from public.settings s
  where s.user_id = (select auth.uid())
$$;

-- ---------------------------------------------------------------------------
-- accounts: kode, Grind, Hold and HB rules (before write)
-- ---------------------------------------------------------------------------

create function private.accounts_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_singkatan text;
  v_seq integer;
  v_hold_hari integer;
begin
  -- Kode akun: per-game running number, e.g. AV-0050. The game row is
  -- locked by the UPDATE, so concurrent inserts never get the same number.
  if tg_op = 'INSERT' and coalesce(new.kode, '') = '' then
    update public.games
       set next_seq = next_seq + 1
     where id = new.game_id and user_id = new.user_id
    returning singkatan, next_seq - 1 into v_singkatan, v_seq;

    if v_singkatan is null then
      raise exception 'Game tidak ditemukan' using errcode = 'foreign_key_violation';
    end if;
    new.kode := v_singkatan || '-' || lpad(v_seq::text, 4, '0');
  end if;

  -- Grind accounts cost nothing
  if new.sumber = 'Grind' then
    new.harga_beli_idr := 0;
  end if;

  -- Hold: default deadline is purchase date + hold_default_hari (1 week);
  -- leaving Hold clears it
  if new.status = 'Hold' then
    if new.hold_sampai is null then
      select s.hold_default_hari into v_hold_hari
        from public.settings s
       where s.user_id = new.user_id;
      new.hold_sampai := coalesce(new.tanggal_beli, public.today_wib()) + coalesce(v_hold_hari, 7);
    end if;
  else
    new.hold_sampai := null;
  end if;

  -- HB: remember the day it happened so the loss lands in that week.
  -- Imported legacy rows keep whatever date they came with (usually none).
  if new.status = 'HB' then
    if (tg_op = 'INSERT' or old.status <> 'HB') and new.tanggal_hb is null and not new.is_legacy then
      new.tanggal_hb := public.today_wib();
    end if;
  else
    new.tanggal_hb := null;
  end if;

  return new;
end;
$$;

create trigger accounts_before_write
  before insert or update on public.accounts
  for each row execute function private.accounts_before_write();

-- ---------------------------------------------------------------------------
-- accounts: status history and sale modal sync (after write)
-- ---------------------------------------------------------------------------

create function private.accounts_after_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.status_history (user_id, account_id, status_lama, status_baru)
    values (new.user_id, new.id, null, new.status);
  elsif new.status is distinct from old.status then
    insert into public.status_history (user_id, account_id, status_lama, status_baru)
    values (new.user_id, new.id, old.status, new.status);
  end if;

  -- Corrected purchase price must flow into the sale's profit
  if tg_op = 'UPDATE' and new.harga_beli_idr is distinct from old.harga_beli_idr then
    update public.sales set modal_idr = new.harga_beli_idr where account_id = new.id;
  end if;

  return null;
end;
$$;

create trigger accounts_after_write
  after insert or update on public.accounts
  for each row execute function private.accounts_after_write();

-- ---------------------------------------------------------------------------
-- Sold ⇔ sale consistency, checked at commit time
-- ---------------------------------------------------------------------------

create function private.check_sold_has_sale()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_account_id uuid;
  v_status public.account_status;
  v_has_sale boolean;
begin
  -- IF instead of CASE: plpgsql resolves every record field in a CASE,
  -- and accounts rows have no account_id column.
  if tg_table_name = 'accounts' then
    v_account_id := new.id;
  elsif tg_op = 'DELETE' then
    v_account_id := old.account_id;
  else
    v_account_id := new.account_id;
  end if;

  select a.status into v_status from public.accounts a where a.id = v_account_id;
  if not found then
    return null; -- account deleted; its sale cascades
  end if;

  select exists (select 1 from public.sales s where s.account_id = v_account_id) into v_has_sale;

  if v_status = 'Sold' and not v_has_sale then
    raise exception 'Status Sold butuh data penjualan (harga jual dan tanggal terjual)'
      using errcode = 'check_violation';
  end if;
  if v_status <> 'Sold' and v_has_sale then
    raise exception 'Akun yang punya penjualan harus berstatus Sold'
      using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

create constraint trigger accounts_sold_consistency
  after insert or update of status on public.accounts
  deferrable initially deferred
  for each row execute function private.check_sold_has_sale();

create constraint trigger sales_sold_consistency
  after insert or delete on public.sales
  deferrable initially deferred
  for each row execute function private.check_sold_has_sale();

-- ---------------------------------------------------------------------------
-- RPC: mark_sold — "Tandai terjual" in one atomic step
-- ---------------------------------------------------------------------------

create function public.mark_sold(
  p_account_id uuid,
  p_harga_jual_usd numeric,
  p_tanggal_terjual date,
  p_store_id uuid
)
returns public.sales
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_account public.accounts;
  v_settings public.settings;
  v_sale public.sales;
begin
  if p_harga_jual_usd is null or p_harga_jual_usd <= 0 then
    raise exception 'Harga jual wajib diisi' using errcode = 'check_violation';
  end if;
  if p_tanggal_terjual is null then
    raise exception 'Tanggal terjual wajib diisi' using errcode = 'check_violation';
  end if;
  if p_tanggal_terjual > public.today_wib() then
    raise exception 'Tanggal terjual tidak boleh di masa depan' using errcode = 'check_violation';
  end if;
  if p_store_id is null then
    raise exception 'Pilih toko tempat akun terjual' using errcode = 'check_violation';
  end if;

  -- RLS limits this to the caller's own account
  select * into v_account from public.accounts where id = p_account_id for update;
  if not found then
    raise exception 'Akun tidak ditemukan' using errcode = 'no_data_found';
  end if;
  if v_account.status in ('Sold', 'HB') then
    raise exception 'Akun % sudah berstatus %', v_account.kode, v_account.status
      using errcode = 'check_violation';
  end if;

  select * into v_settings from public.settings where user_id = v_account.user_id;
  if not found then
    raise exception 'Pengaturan belum ada' using errcode = 'no_data_found';
  end if;

  insert into public.sales (
    user_id, account_id, store_id, tanggal_terjual, harga_jual_usd,
    admin_pct, potongan_tarik_pct, kurs_payoneer, modal_idr
  ) values (
    v_account.user_id, v_account.id, p_store_id, p_tanggal_terjual, p_harga_jual_usd,
    v_settings.admin_pct, v_settings.potongan_tarik_pct, public.kurs_payoneer_aktif(), v_account.harga_beli_idr
  )
  returning * into v_sale;

  update public.accounts set status = 'Sold' where id = v_account.id;

  return v_sale;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: undo_last_status_change — the "Urungkan" button after a status change
-- ---------------------------------------------------------------------------

create function public.undo_last_status_change(p_account_id uuid)
returns public.account_status
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_last public.status_history;
  v_current public.account_status;
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

  if not found or v_last.status_lama is null then
    raise exception 'Tidak ada perubahan status untuk diurungkan' using errcode = 'no_data_found';
  end if;
  if v_last.status_baru <> v_current then
    raise exception 'Status sudah berubah lagi, tidak bisa diurungkan' using errcode = 'check_violation';
  end if;

  if v_current = 'Sold' then
    delete from public.sales where account_id = p_account_id;
  end if;

  update public.accounts set status = v_last.status_lama where id = p_account_id;

  -- Drop the undone entry and the one the update above just wrote
  delete from public.status_history where account_id = p_account_id and id >= v_last.id;

  return v_last.status_lama;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: record_withdrawal — "Catat penarikan" with a balance check
-- ---------------------------------------------------------------------------

create function public.record_withdrawal(
  p_store_id uuid,
  p_tanggal date,
  p_usd_ditarik numeric,
  p_idr_diterima integer,
  p_catatan text default null
)
returns public.withdrawals
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_settings public.settings;
  v_saldo numeric;
  v_row public.withdrawals;
begin
  if p_usd_ditarik is null or p_usd_ditarik <= 0 then
    raise exception 'Isi jumlah dolar yang ditarik' using errcode = 'check_violation';
  end if;
  if p_tanggal is null then
    raise exception 'Tanggal uang masuk wajib diisi' using errcode = 'check_violation';
  end if;

  select * into v_settings from public.settings where user_id = (select auth.uid());
  if not found then
    raise exception 'Pengaturan belum ada' using errcode = 'no_data_found';
  end if;

  select b.saldo_usd into v_saldo from public.v_store_balance b where b.store_id = p_store_id;
  if not found then
    raise exception 'Toko tidak ditemukan' using errcode = 'no_data_found';
  end if;
  if p_usd_ditarik > v_saldo + 0.005 then
    raise exception 'Melebihi saldo toko ($%)', replace(round(v_saldo, 2)::text, '.', ',') using errcode = 'check_violation';
  end if;

  insert into public.withdrawals (
    store_id, tanggal, usd_ditarik, biaya_tarik_pct, biaya_tetap_usd, kurs_payoneer, idr_diterima, catatan
  ) values (
    p_store_id, p_tanggal, p_usd_ditarik, v_settings.potongan_tarik_pct, v_settings.potongan_tarik_usd,
    public.kurs_payoneer_aktif(), p_idr_diterima, p_catatan
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- New users: default settings, the 7 games and 2 stores from the Excel
-- ---------------------------------------------------------------------------

create function private.bootstrap_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.settings (user_id) values (p_user_id)
  on conflict (user_id) do nothing;

  insert into public.games (user_id, nama, singkatan, satuan_varian)
  values
    (p_user_id, 'Anime Vanguard', 'AV', 'Monarch'),
    (p_user_id, 'VBL', 'VBL', null),
    (p_user_id, 'UTDX', 'UTDX', 'Ruler'),
    (p_user_id, 'Anime Squadron', 'ASQ', null),
    (p_user_id, 'Anime Expedition', 'AEX', 'Unbound'),
    (p_user_id, 'AO', 'AO', null),
    (p_user_id, 'Sailor Piece', 'SP', null)
  on conflict do nothing;

  insert into public.stores (user_id, nama, platform)
  values
    (p_user_id, 'Zeron', 'Eldorado'),
    (p_user_id, 'Realm', 'Eldorado')
  on conflict do nothing;
end;
$$;

revoke all on function private.bootstrap_user(uuid) from public, anon, authenticated;

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.bootstrap_user(new.id);
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Users created before this migration (e.g. the owner account made in the dashboard)
do $$
declare
  v_user record;
begin
  for v_user in select id from auth.users loop
    perform private.bootstrap_user(v_user.id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC permissions: signed-in users only
-- ---------------------------------------------------------------------------

revoke execute on function public.kurs_payoneer_aktif() from public, anon;
revoke execute on function public.mark_sold(uuid, numeric, date, uuid) from public, anon;
revoke execute on function public.undo_last_status_change(uuid) from public, anon;
revoke execute on function public.record_withdrawal(uuid, date, numeric, integer, text) from public, anon;

grant execute on function public.kurs_payoneer_aktif() to authenticated;
grant execute on function public.mark_sold(uuid, numeric, date, uuid) to authenticated;
grant execute on function public.undo_last_status_change(uuid) to authenticated;
grant execute on function public.record_withdrawal(uuid, date, numeric, integer, text) to authenticated;
