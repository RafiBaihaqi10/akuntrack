// Row shapes returned by Supabase (tables and views in supabase/migrations).
// PostgREST serialises numeric columns as JSON numbers and dates as `YYYY-MM-DD`.

import type { AccountSource, AccountStatus } from "./domain";

export type KursMode = "otomatis" | "manual";

export type Settings = {
  user_id: string;
  admin_pct: number;
  potongan_tarik_pct: number;
  potongan_tarik_usd: number;
  mode_kurs: KursMode;
  kurs_pasar: number;
  kurs_pasar_diperbarui: string | null;
  selisih_payoneer: number;
  kurs_payoneer_manual: number | null;
  batas_laku_pct: number;
  batas_laba_idr: number;
  batas_modal_tertahan_pct: number;
  min_akun_data: number;
  target_margin_pct: number;
  porsi_reinvest_pct: number;
  hold_default_hari: number;
  stok_lama_hari: number;
  zona_waktu: string;
  updated_at: string;
};

export type Game = {
  id: string;
  nama: string;
  singkatan: string;
  satuan_varian: string | null;
  aktif: boolean;
  next_seq: number;
  created_at: string;
};

export type Store = {
  id: string;
  nama: string;
  platform: string;
  saldo_awal_usd: number;
  aktif: boolean;
  created_at: string;
};

/** Row of `v_accounts`: an account plus game/store names, stock age, flags and its sale. */
export type AccountRow = {
  id: string;
  kode: string;
  no_lama: number | null;
  game_id: string;
  store_id: string | null;
  isi_akun: string;
  jumlah_varian: number | null;
  tags: string[];
  username: string | null;
  sumber: AccountSource;
  dibeli_dari: string | null;
  harga_beli_idr: number;
  tanggal_beli: string | null;
  harga_listing_usd: number | null;
  status: AccountStatus;
  hold_sampai: string | null;
  /** Held with no end date: hold_sampai stays empty. */
  hold_tanpa_batas: boolean;
  tanggal_hb: string | null;
  catatan: string | null;
  is_legacy: boolean;
  created_at: string;
  updated_at: string;
  game_nama: string;
  game_singkatan: string;
  store_nama: string | null;
  stok_aktif: boolean;
  umur_hari: number | null;
  hold_lewat: boolean;
  stok_lama: boolean;
  harga_jual_usd: number | null;
  tanggal_terjual: string | null;
  net_usd: number | null;
  laba_idr: number | null;
  sale_store_id: string | null;
};

export type StoreBalance = {
  store_id: string;
  nama: string;
  saldo_awal_usd: number;
  masuk_usd: number;
  akun_terjual: number;
  ditarik_usd: number;
  jumlah_penarikan: number;
  penarikan_tanpa_rupiah: number;
  penyesuaian_usd: number;
  saldo_usd: number;
};

export type Withdrawal = {
  id: string;
  store_id: string;
  tanggal: string | null;
  usd_ditarik: number;
  biaya_tarik_pct: number;
  biaya_tetap_usd: number;
  kurs_payoneer: number;
  idr_diterima: number | null;
  kurs_efektif: number | null;
  koreksi_laba_idr: number | null;
  catatan: string | null;
  is_legacy: boolean;
  created_at: string;
};

export type BalanceAdjustment = {
  id: string;
  store_id: string;
  tanggal: string;
  usd: number;
  alasan: string;
  created_at: string;
};

export type WeeklyReport = {
  minggu_mulai: string;
  minggu_selesai: string;
  modal_keluar: number;
  akun_dibeli: number;
  penjualan_net_usd: number;
  penjualan_idr: number;
  modal_terjual: number;
  akun_terjual: number;
  laba_penjualan: number;
  koreksi_penarikan: number;
  rugi_hb: number;
  akun_hb: number;
  laba: number;
  idr_diterima: number;
  usd_ditarik: number;
  jumlah_penarikan: number;
  cash_flow: number;
};

export type GamePerformance = {
  game_id: string;
  nama: string;
  singkatan: string;
  aktif: boolean;
  akun_total: number;
  akun_terjual: number;
  stok_aktif: number;
  akun_hb: number;
  rugi_hb: number;
  modal_tertahan: number;
  laba_total: number;
  modal_terjual: number;
  rata_jual_usd: number | null;
  median_hari_laku: number | null;
};
