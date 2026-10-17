-- AkunTrack · 3/3 · Report views
--
-- All views use security_invoker, so they run with the caller's rights and
-- RLS on the underlying tables still applies: each user sees only their rows.
-- Weekly numbers are derived from dates, never typed in. Rows without a date
-- (old Excel data) count toward totals and stock but not toward any week.

-- ---------------------------------------------------------------------------
-- Balance per store = saldo awal + net USD sold − USD withdrawn ± adjustments
-- ---------------------------------------------------------------------------

create view public.v_store_balance
with (security_invoker = true) as
select
  st.id as store_id,
  st.user_id,
  st.nama,
  st.saldo_awal_usd,
  coalesce(s.masuk_usd, 0) as masuk_usd,
  coalesce(s.akun_terjual, 0) as akun_terjual,
  coalesce(w.ditarik_usd, 0) as ditarik_usd,
  coalesce(w.jumlah_penarikan, 0) as jumlah_penarikan,
  coalesce(w.penarikan_tanpa_rupiah, 0) as penarikan_tanpa_rupiah,
  coalesce(b.penyesuaian_usd, 0) as penyesuaian_usd,
  st.saldo_awal_usd + coalesce(s.masuk_usd, 0) - coalesce(w.ditarik_usd, 0) + coalesce(b.penyesuaian_usd, 0)
    as saldo_usd
from public.stores st
left join (
  select store_id, sum(net_usd) as masuk_usd, count(*) as akun_terjual
  from public.sales
  where store_id is not null
  group by store_id
) s on s.store_id = st.id
left join (
  select
    store_id,
    sum(usd_ditarik) as ditarik_usd,
    count(*) as jumlah_penarikan,
    count(*) filter (where idr_diterima is null) as penarikan_tanpa_rupiah
  from public.withdrawals
  group by store_id
) w on w.store_id = st.id
left join (
  select store_id, sum(usd) as penyesuaian_usd
  from public.balance_adjustments
  group by store_id
) b on b.store_id = st.id;

-- ---------------------------------------------------------------------------
-- Stock list: accounts with game/store names, stock age and warning flags
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Weekly report (Monday–Sunday, WIB dates)
--   modal keluar   ← tanggal_beli
--   penjualan/laba ← tanggal_terjual
--   koreksi + rupiah diterima ← tanggal penarikan
--   rugi HB        ← tanggal_hb
--   laba = laba penjualan + koreksi penarikan − rugi HB
--   cash flow = rupiah diterima − modal keluar
-- ---------------------------------------------------------------------------

create view public.v_weekly_report
with (security_invoker = true) as
with events as (
  select
    user_id, tanggal_beli as tanggal,
    harga_beli_idr::numeric as modal_keluar, 1 as akun_dibeli,
    0::numeric as net_usd, 0::numeric as penjualan_idr, 0::numeric as modal_terjual, 0 as akun_terjual,
    0::numeric as laba_penjualan, 0::numeric as koreksi_penarikan, 0::numeric as rugi_hb, 0 as akun_hb,
    0::numeric as idr_diterima, 0::numeric as usd_ditarik, 0 as jumlah_penarikan
  from public.accounts
  where tanggal_beli is not null

  union all
  select
    user_id, tanggal_terjual,
    0, 0,
    net_usd, estimasi_idr, modal_idr, 1,
    laba_idr, 0, 0, 0,
    0, 0, 0
  from public.sales
  where tanggal_terjual is not null and harga_jual_usd is not null

  union all
  select
    user_id, tanggal,
    0, 0,
    0, 0, 0, 0,
    0, coalesce(koreksi_laba_idr, 0), 0, 0,
    coalesce(idr_diterima, 0), usd_ditarik, 1
  from public.withdrawals
  where tanggal is not null

  union all
  select
    user_id, tanggal_hb,
    0, 0,
    0, 0, 0, 0,
    0, 0, harga_beli_idr, 1,
    0, 0, 0
  from public.accounts
  where status = 'HB' and tanggal_hb is not null
)
select
  user_id,
  date_trunc('week', tanggal)::date as minggu_mulai,
  date_trunc('week', tanggal)::date + 6 as minggu_selesai,
  sum(modal_keluar) as modal_keluar,
  sum(akun_dibeli)::integer as akun_dibeli,
  sum(net_usd) as penjualan_net_usd,
  sum(penjualan_idr) as penjualan_idr,
  sum(modal_terjual) as modal_terjual,
  sum(akun_terjual)::integer as akun_terjual,
  sum(laba_penjualan) as laba_penjualan,
  sum(koreksi_penarikan) as koreksi_penarikan,
  sum(rugi_hb) as rugi_hb,
  sum(akun_hb)::integer as akun_hb,
  sum(laba_penjualan) + sum(koreksi_penarikan) - sum(rugi_hb) as laba,
  sum(idr_diterima) as idr_diterima,
  sum(usd_ditarik) as usd_ditarik,
  sum(jumlah_penarikan)::integer as jumlah_penarikan,
  sum(idr_diterima) - sum(modal_keluar) as cash_flow
from events
group by user_id, date_trunc('week', tanggal);

-- ---------------------------------------------------------------------------
-- Per-game performance (all time). 30-day speed, variants and the restock
-- quadrant are computed in the app from v_accounts.
-- ---------------------------------------------------------------------------

create view public.v_game_performance
with (security_invoker = true) as
select
  g.id as game_id,
  g.user_id,
  g.nama,
  g.singkatan,
  g.aktif,
  count(a.id)::integer as akun_total,
  (count(*) filter (where a.status = 'Sold'))::integer as akun_terjual,
  (count(*) filter (where a.status in ('Belum Post', 'Belum Sold', 'Hold', 'Update')))::integer as stok_aktif,
  (count(*) filter (where a.status = 'HB'))::integer as akun_hb,
  coalesce(sum(a.harga_beli_idr) filter (where a.status = 'HB'), 0) as rugi_hb,
  coalesce(sum(a.harga_beli_idr) filter (where a.status in ('Belum Post', 'Belum Sold', 'Hold', 'Update')), 0)
    as modal_tertahan,
  coalesce(sum(s.laba_idr), 0) as laba_total,
  coalesce(sum(s.modal_idr) filter (where s.harga_jual_usd is not null), 0) as modal_terjual,
  avg(s.harga_jual_usd) as rata_jual_usd,
  percentile_cont(0.5) within group (order by (s.tanggal_terjual - a.tanggal_beli))
    filter (where s.tanggal_terjual is not null and a.tanggal_beli is not null) as median_hari_laku
from public.games g
left join public.accounts a on a.game_id = g.id
left join public.sales s on s.account_id = a.id
group by g.id;

revoke all on public.v_store_balance, public.v_accounts, public.v_weekly_report, public.v_game_performance from anon;
grant select on public.v_store_balance, public.v_accounts, public.v_weekly_report, public.v_game_performance to authenticated;
