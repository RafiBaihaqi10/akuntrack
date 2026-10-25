-- AkunTrack · Hold tanpa batas waktu
--
-- An account can now be held with no end date. hold_tanpa_batas = true keeps
-- hold_sampai empty instead of filling in the 1-week default, and such an
-- account is never flagged as "Hold lewat tanggal".

alter table public.accounts
  add column hold_tanpa_batas boolean not null default false;

-- ---------------------------------------------------------------------------
-- accounts: kode, Grind, Hold and HB rules (before write)
-- ---------------------------------------------------------------------------

create or replace function private.accounts_before_write()
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

  -- Hold: default deadline is purchase date + hold_default_hari (1 week),
  -- unless it is held with no end date; leaving Hold clears both
  if new.status = 'Hold' then
    if new.hold_tanpa_batas then
      new.hold_sampai := null;
    elsif new.hold_sampai is null then
      select s.hold_default_hari into v_hold_hari
        from public.settings s
       where s.user_id = new.user_id;
      new.hold_sampai := coalesce(new.tanggal_beli, public.today_wib()) + coalesce(v_hold_hari, 7);
    end if;
  else
    new.hold_sampai := null;
    new.hold_tanpa_batas := false;
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

-- ---------------------------------------------------------------------------
-- Stock list: recreated so a.* picks up the new column
-- ---------------------------------------------------------------------------

drop view public.v_accounts;

create view public.v_accounts
with (security_invoker = true) as
select
  a.*,
  g.nama as game_nama,
  g.singkatan as game_singkatan,
  st.nama as store_nama,
  a.status in ('Belum Post', 'Belum Sold', 'Hold', 'Update') as stok_aktif,
  case when a.tanggal_beli is null then null else public.today_wib() - a.tanggal_beli end as umur_hari,
  (a.status = 'Hold' and a.hold_sampai is not null and a.hold_sampai < public.today_wib()) as hold_lewat,
  (
    a.status in ('Belum Post', 'Belum Sold', 'Hold', 'Update')
    and a.tanggal_beli is not null
    and public.today_wib() - a.tanggal_beli > coalesce(cfg.stok_lama_hari, 30)
  ) as stok_lama,
  sa.harga_jual_usd,
  sa.tanggal_terjual,
  sa.net_usd,
  sa.laba_idr,
  sa.store_id as sale_store_id
from public.accounts a
join public.games g on g.id = a.game_id
left join public.stores st on st.id = a.store_id
left join public.settings cfg on cfg.user_id = a.user_id
left join public.sales sa on sa.account_id = a.id;

revoke all on public.v_accounts from anon;
grant select on public.v_accounts to authenticated;
