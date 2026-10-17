-- AkunTrack · 1/3 · Tables, constraints and Row Level Security
--
-- Every table carries user_id (default auth.uid()) and is locked to its owner
-- with RLS. Cross-table foreign keys include user_id, so a row can never point
-- at another user's game, store or account.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.account_status as enum ('Belum Post', 'Belum Sold', 'Hold', 'Update', 'Sold', 'HB');
create type public.account_source as enum ('Beli', 'Grind');
create type public.kurs_mode as enum ('otomatis', 'manual');

-- Calendar date in WIB; all business dates (beli, terjual, tarik) are WIB dates.
create function public.today_wib()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Jakarta')::date
$$;

-- ---------------------------------------------------------------------------
-- games: fixed list so "VBL" and "VBL " can never become two games
-- ---------------------------------------------------------------------------

create table public.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nama text not null check (nama = btrim(nama) and nama <> ''),
  singkatan text not null check (singkatan ~ '^[A-Z0-9]{1,6}$'),
  -- Unit used to read "isi akun", e.g. Monarch (AV), Ruler (UTDX)
  satuan_varian text,
  aktif boolean not null default true,
  -- Next number for kode akun (AV-0001, AV-0002, ...), per game
  next_seq integer not null default 1 check (next_seq > 0),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create unique index games_user_nama_key on public.games (user_id, lower(nama));
create unique index games_user_singkatan_key on public.games (user_id, singkatan);

-- ---------------------------------------------------------------------------
-- stores: each Eldorado store has its own dollar balance
-- ---------------------------------------------------------------------------

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nama text not null check (nama = btrim(nama) and nama <> ''),
  platform text not null default 'Eldorado',
  saldo_awal_usd numeric(12, 2) not null default 0,
  aktif boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create unique index stores_user_nama_key on public.stores (user_id, lower(nama));

-- ---------------------------------------------------------------------------
-- accounts: one row per game account (the stock)
-- ---------------------------------------------------------------------------

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Filled by trigger from the game's singkatan + per-game sequence
  kode text not null,
  -- Original "No" from the Excel sheet, kept only as an import trail
  no_lama integer,
  game_id uuid not null,
  store_id uuid,
  isi_akun text not null default '',
  -- "5 Monarch (Madara + ...)" is stored as jumlah_varian 5 and tags {Madara, ...}
  jumlah_varian integer check (jumlah_varian >= 0),
  tags text[] not null default '{}',
  username text check (username is null or (username = btrim(username) and username <> '')),
  sumber public.account_source not null default 'Beli',
  dibeli_dari text,
  harga_beli_idr integer not null default 0 check (harga_beli_idr >= 0),
  tanggal_beli date,
  harga_listing_usd numeric(10, 2) check (harga_listing_usd >= 0),
  status public.account_status not null default 'Belum Post',
  -- Hold deadline; defaults to tanggal_beli + settings.hold_default_hari (1 week)
  hold_sampai date,
  -- Date the account was hackbacked; the loss lands in this week's report
  tanggal_hb date,
  catatan text,
  -- Imported from the old Excel without dates ("data lama")
  is_legacy boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, kode),
  foreign key (game_id, user_id) references public.games (id, user_id),
  foreign key (store_id, user_id) references public.stores (id, user_id),
  constraint accounts_tanggal_beli_wajib check (tanggal_beli is not null or is_legacy),
  constraint accounts_toko_wajib check (store_id is not null or is_legacy),
  constraint accounts_grind_modal_nol check (sumber <> 'Grind' or harga_beli_idr = 0)
);

create index accounts_user_status_idx on public.accounts (user_id, status);
create index accounts_user_game_idx on public.accounts (user_id, game_id);
create index accounts_user_tanggal_beli_idx on public.accounts (user_id, tanggal_beli);
-- Username is unique per game only as a soft rule (UI warning), so this is not a unique index
create index accounts_username_idx on public.accounts (user_id, game_id, lower(username));

-- ---------------------------------------------------------------------------
-- sales: at most one per account; rates are snapshotted so history never changes
-- ---------------------------------------------------------------------------

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null unique,
  -- Store whose balance receives the money
  store_id uuid,
  tanggal_terjual date,
  harga_jual_usd numeric(10, 2) check (harga_jual_usd >= 0),
  admin_pct numeric(5, 2) not null check (admin_pct between 0 and 100),
  potongan_tarik_pct numeric(5, 2) not null check (potongan_tarik_pct between 0 and 100),
  kurs_payoneer numeric(12, 2) not null check (kurs_payoneer > 0),
  -- Copy of accounts.harga_beli_idr, kept in sync by trigger
  modal_idr integer not null default 0 check (modal_idr >= 0),
  -- Net USD = harga jual × (1 − admin)
  net_usd numeric(14, 4) generated always as (harga_jual_usd * (1 - admin_pct / 100)) stored,
  -- Estimasi Rp = net USD × kurs Payoneer × (1 − potongan tarik)
  estimasi_idr numeric(16, 2) generated always as (
    harga_jual_usd * (1 - admin_pct / 100) * (1 - potongan_tarik_pct / 100) * kurs_payoneer
  ) stored,
  -- Laba = estimasi Rp − harga beli
  laba_idr numeric(16, 2) generated always as (
    harga_jual_usd * (1 - admin_pct / 100) * (1 - potongan_tarik_pct / 100) * kurs_payoneer - modal_idr
  ) stored,
  is_legacy boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete cascade,
  foreign key (store_id, user_id) references public.stores (id, user_id),
  -- New sales need price, date and store; old Excel rows may be incomplete
  constraint sales_lengkap check (
    is_legacy or (harga_jual_usd is not null and tanggal_terjual is not null and store_id is not null)
  )
);

create index sales_user_tanggal_idx on public.sales (user_id, tanggal_terjual);
create index sales_store_idx on public.sales (store_id);

-- ---------------------------------------------------------------------------
-- withdrawals: dollars taken out of a store and the rupiah actually received
-- ---------------------------------------------------------------------------

create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  store_id uuid not null,
  tanggal date,
  usd_ditarik numeric(12, 2) not null check (usd_ditarik > 0),
  biaya_tarik_pct numeric(5, 2) not null default 4 check (biaya_tarik_pct between 0 and 100),
  biaya_tetap_usd numeric(8, 2) not null default 2 check (biaya_tetap_usd >= 0),
  -- Kurs Payoneer at the time (old Excel rows use Rp17.000)
  kurs_payoneer numeric(12, 2) not null check (kurs_payoneer > 0),
  -- Filled from the bank mutation; old rows can be completed later ("Isi rupiah")
  idr_diterima integer check (idr_diterima >= 0),
  -- Kurs efektif = rupiah diterima ÷ USD ditarik, all fees included
  kurs_efektif numeric(12, 2) generated always as (
    case when idr_diterima is null then null else round(idr_diterima / usd_ditarik, 2) end
  ) stored,
  -- Koreksi laba = rupiah diterima − (USD ditarik × (1 − potongan) × kurs Payoneer);
  -- covers the flat $2 fee and any exchange-rate difference
  koreksi_laba_idr numeric(16, 2) generated always as (
    case
      when idr_diterima is null then null
      else idr_diterima - usd_ditarik * (1 - biaya_tarik_pct / 100) * kurs_payoneer
    end
  ) stored,
  catatan text,
  is_legacy boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (store_id, user_id) references public.stores (id, user_id),
  constraint withdrawals_tanggal_wajib check (tanggal is not null or is_legacy)
);

create index withdrawals_user_tanggal_idx on public.withdrawals (user_id, tanggal);
create index withdrawals_store_idx on public.withdrawals (store_id);

-- ---------------------------------------------------------------------------
-- balance_adjustments: corrections so the balance matches Eldorado
-- ---------------------------------------------------------------------------

create table public.balance_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  store_id uuid not null,
  tanggal date not null default public.today_wib(),
  usd numeric(12, 2) not null check (usd <> 0),
  alasan text not null check (btrim(alasan) <> ''),
  created_at timestamptz not null default now(),
  foreign key (store_id, user_id) references public.stores (id, user_id)
);

create index balance_adjustments_store_idx on public.balance_adjustments (store_id);

-- ---------------------------------------------------------------------------
-- status_history: written by trigger; source for stock age, Hold duration and undo
-- ---------------------------------------------------------------------------

create table public.status_history (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null,
  status_lama public.account_status,
  status_baru public.account_status not null,
  waktu timestamptz not null default now(),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete cascade
);

create index status_history_account_idx on public.status_history (account_id, waktu desc, id desc);

-- ---------------------------------------------------------------------------
-- settings: one row per user, defaults taken from the Excel formulas
-- ---------------------------------------------------------------------------

create table public.settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  admin_pct numeric(5, 2) not null default 15 check (admin_pct between 0 and 100),
  potongan_tarik_pct numeric(5, 2) not null default 4 check (potongan_tarik_pct between 0 and 100),
  potongan_tarik_usd numeric(8, 2) not null default 2 check (potongan_tarik_usd >= 0),
  mode_kurs public.kurs_mode not null default 'otomatis',
  -- Market rate, refreshed from exchangerate-api; Rp17.000 until the first refresh
  kurs_pasar numeric(12, 2) not null default 17000 check (kurs_pasar > 0),
  kurs_pasar_diperbarui timestamptz,
  selisih_payoneer numeric(12, 2) not null default 1000 check (selisih_payoneer >= 0),
  kurs_payoneer_manual numeric(12, 2) check (kurs_payoneer_manual > 0),
  -- Restock quadrant thresholds
  batas_laku_pct numeric(5, 2) not null default 60 check (batas_laku_pct between 0 and 100),
  batas_laba_idr integer not null default 200000 check (batas_laba_idr >= 0),
  batas_modal_tertahan_pct numeric(5, 2) not null default 30 check (batas_modal_tertahan_pct between 0 and 100),
  min_akun_data integer not null default 10 check (min_akun_data > 0),
  target_margin_pct numeric(6, 2) not null default 100 check (target_margin_pct >= 0),
  porsi_reinvest_pct numeric(5, 2) not null default 50 check (porsi_reinvest_pct between 0 and 100),
  -- Stock and Hold warnings
  hold_default_hari integer not null default 7 check (hold_default_hari > 0),
  stok_lama_hari integer not null default 30 check (stok_lama_hari > 0),
  -- Fixed for now: weeks run Monday–Sunday in WIB
  zona_waktu text not null default 'Asia/Jakarta',
  updated_at timestamptz not null default now(),
  constraint settings_kurs_manual_wajib check (mode_kurs = 'otomatis' or kurs_payoneer_manual is not null)
);

-- ---------------------------------------------------------------------------
-- Row Level Security: every row belongs to exactly one user
-- ---------------------------------------------------------------------------

alter table public.games enable row level security;
alter table public.stores enable row level security;
alter table public.accounts enable row level security;
alter table public.sales enable row level security;
alter table public.withdrawals enable row level security;
alter table public.balance_adjustments enable row level security;
alter table public.status_history enable row level security;
alter table public.settings enable row level security;

create policy "Pemilik mengelola games miliknya" on public.games
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Pemilik mengelola stores miliknya" on public.stores
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Pemilik mengelola accounts miliknya" on public.accounts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Pemilik mengelola sales miliknya" on public.sales
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Pemilik mengelola withdrawals miliknya" on public.withdrawals
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Pemilik mengelola balance_adjustments miliknya" on public.balance_adjustments
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Pemilik mengelola status_history miliknya" on public.status_history
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Pemilik mengelola settings miliknya" on public.settings
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Defense in depth: the anonymous role gets no table access at all
revoke all on
  public.games, public.stores, public.accounts, public.sales, public.withdrawals,
  public.balance_adjustments, public.status_history, public.settings
from anon;
