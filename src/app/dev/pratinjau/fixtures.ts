// Sample data for the development-only screen previews (no Supabase, no login).
// Numbers follow the Excel analysis in guide.md so the screens look realistic.

import { saleBreakdown } from "@/lib/calc";
import { addDays, diffDays, mondayOf } from "@/lib/dates";
import type {
  AccountRow,
  BalanceAdjustment,
  Game,
  GamePerformance,
  Settings,
  Store,
  StoreBalance,
  WeeklyReport,
  Withdrawal,
} from "@/lib/db-types";
import type { AccountStatus } from "@/lib/domain";
import { jumlahVarianFor, parseIsiAkun } from "@/lib/isi-akun";

const ts = "2026-10-01T00:00:00Z";

export const settings: Settings = {
  user_id: "u",
  admin_pct: 15,
  potongan_tarik_pct: 4,
  potongan_tarik_usd: 2,
  mode_kurs: "otomatis",
  kurs_pasar: 17000,
  kurs_pasar_diperbarui: "2026-10-17T01:00:00Z",
  selisih_payoneer: 1000,
  kurs_payoneer_manual: null,
  batas_laku_pct: 60,
  batas_laba_idr: 200000,
  batas_modal_tertahan_pct: 30,
  min_akun_data: 10,
  target_margin_pct: 100,
  porsi_reinvest_pct: 50,
  hold_default_hari: 7,
  stok_lama_hari: 30,
  zona_waktu: "Asia/Jakarta",
  updated_at: ts,
};

const g = (id: string, nama: string, singkatan: string, satuan: string | null, next: number): Game => ({
  id,
  nama,
  singkatan,
  satuan_varian: satuan,
  aktif: true,
  next_seq: next,
  created_at: ts,
});

export const games: Game[] = [
  g("g-av", "Anime Vanguard", "AV", "Monarch", 74),
  g("g-vbl", "VBL", "VBL", null, 163),
  g("g-utdx", "UTDX", "UTDX", "Ruler", 60),
  g("g-asq", "Anime Squadron", "ASQ", null, 12),
  g("g-aex", "Anime Expedition", "AEX", "Unbound", 81),
  g("g-ao", "AO", "AO", null, 6),
  g("g-sp", "Sailor Piece", "SP", null, 5),
];

export const stores: Store[] = [
  { id: "s-zeron", nama: "Zeron", platform: "Eldorado", saldo_awal_usd: 0, aktif: true, created_at: ts },
  { id: "s-realm", nama: "Realm", platform: "Eldorado", saldo_awal_usd: 0, aktif: true, created_at: ts },
];

type Seed = {
  game: string;
  isi: string;
  user: string | null;
  status: AccountStatus;
  beli: number;
  /** Days before today; null = legacy row without a date. */
  beliHari: number | null;
  store?: string;
  jual?: number;
  jualHari?: number;
  hold?: number;
  grind?: boolean;
  dari?: string;
};

const seeds: Seed[] = [
  { game: "g-av", isi: "11 Monarch + 10k Reroll", user: null, status: "Hold", beli: 360000, beliHari: 3, hold: 4 },
  { game: "g-vbl", isi: "Jinko + Kisuki", user: "nextseso", status: "Hold", beli: 37000, beliHari: 4, hold: 3, dari: "Grup Jual Akun VBL" },
  { game: "g-vbl", isi: "Jinko + MP", user: "Jastipense", status: "Belum Sold", beli: 37000, beliHari: 4 },
  { game: "g-vbl", isi: "OG Akari + Twins + TSK + Sanju", user: "Username_112221", status: "Belum Sold", beli: 230000, beliHari: 6 },
  { game: "g-vbl", isi: "Og Encho M2 + Taichou + Riku + TSH", user: "saipulgg505", status: "Hold", beli: 95000, beliHari: 90, hold: -87 },
  { game: "g-vbl", isi: "Yogan M1 + Taichou + Roketto + Kisuki", user: "7acc_vb", status: "Hold", beli: 0, beliHari: 50, hold: -43 },
  { game: "g-av", isi: "11 Monarch (Sukuna vs Gojo + Shiny Hakari + Shiny Makoto + Madara + Escanor) + Diavolo", user: "asepjemping108", status: "Belum Sold", beli: 110000, beliHari: null },
  { game: "g-vbl", isi: "TSK + Sanju + Kisuki", user: "Gamoraiii", status: "Belum Sold", beli: 50000, beliHari: 41, store: "s-realm" },
  { game: "g-aex", isi: "Unbound Gowther + 2 Primordial (Kenpachi + Yuta) + Draconic Frieren", user: "KABUTOOO2006", status: "Belum Sold", beli: 302000, beliHari: null },
  { game: "g-utdx", isi: "4 Ruler + Serialized Roger", user: "whennyhshiny", status: "Belum Sold", beli: 160000, beliHari: null },
  { game: "g-vbl", isi: "Kazana + Hidari + Mikage + Kisuki", user: "onefasydt", status: "Belum Post", beli: 60000, beliHari: null },
  { game: "g-vbl", isi: "Yogan M1 + Roketto + Sanju + Kisuki", user: "hyannss", status: "Update", beli: 160000, beliHari: null },
  // Sold this week
  { game: "g-av", isi: "9 Monarch (Gojo vs Sukuna + Escanor + Shiny Sung jin woo + Hakari + Makoto) + Diavolo + Rogita", user: "telumari", status: "Sold", beli: 0, beliHari: 20, jual: 80, jualHari: 0, grind: true },
  { game: "g-av", isi: "3 Monarch (Shiny Gojo vs Sukuna + Escanor + Shiny Sung jin woo)", user: "jemaroke", status: "Sold", beli: 150000, beliHari: 12, jual: 55, jualHari: 1 },
  { game: "g-vbl", isi: "Ronin + Kisuki + Sanju", user: "WALDEX999", status: "Sold", beli: 125000, beliHari: 10, jual: 25, jualHari: 2, store: "s-realm" },
  { game: "g-utdx", isi: "4 Ruler", user: "doppathims", status: "Sold", beli: 65000, beliHari: 25, jual: 25, jualHari: 3 },
  { game: "g-vbl", isi: "TSH + Sanju", user: "Trabumbum", status: "Sold", beli: 75000, beliHari: 30, jual: 16, jualHari: 4 },
  // HB
  { game: "g-vbl", isi: "Taichou + Riku", user: "hbkorban1", status: "HB", beli: 120000, beliHari: 20, dari: "Toko Murah" },
  { game: "g-vbl", isi: "Kisuki + Sanju", user: "hbkorban2", status: "HB", beli: 90000, beliHari: 15, dari: "Toko Murah" },
];

// Older sales so medians, quadrants and variant tables have data
const history: [string, string, number, number][] = [
  ["g-av", "3 Monarch (Madara + Rukia + Ichigo)", 60000, 30],
  ["g-av", "4 Monarch (Madara + Rukia + Ichigo + Escanor)", 70000, 32],
  ["g-av", "3 Monarch", 50000, 28],
  ["g-av", "4 Monarch", 65000, 30],
  ["g-av", "7 Monarch", 120000, 57],
  ["g-av", "8 Monarch", 140000, 60],
  ["g-av", "5 Monarch", 90000, 40],
  ["g-av", "6 Monarch", 95000, 42],
  ["g-av", "2 Monarch", 30000, 20],
  ["g-av", "1 Monarch", 25000, 18],
  ["g-vbl", "Jinko + Kisuki", 37000, 12],
  ["g-vbl", "Sanju + TSK", 40000, 14],
  ["g-vbl", "Ronin + MP", 45000, 13],
  ["g-asq", "Akun ASQ 1", 70000, 34],
  ["g-asq", "Akun ASQ 2", 60000, 34],
  ["g-aex", "Unbound Gowther", 150000, 30],
  ["g-ao", "AO starter", 20000, 4],
  ["g-ao", "AO starter 2", 15000, 4],
  ["g-sp", "SP biasa", 30000, 12],
];

const activeExtra: [string, string, number][] = [
  ...Array.from({ length: 14 }, (_, i) => ["g-vbl", `Akun VBL stok ${i + 1}`, 60000 + i * 2000] as [string, string, number]),
  ["g-av", "5 Monarch (Madara + Ichigo)", 80000],
  ["g-av", "3 Monarch", 55000],
  ["g-asq", "Akun ASQ 3", 55000],
  ["g-asq", "Akun ASQ 4", 55000],
  ["g-aex", "Unbound Escanor", 200000],
  ["g-ao", "AO starter 3", 30000],
  ["g-sp", "SP biasa 2", 45000],
];

const kurs = 16000;

export function buildAccounts(today: string): AccountRow[] {
  const rates = { adminPct: 15, potonganTarikPct: 4, potonganTarikUsd: 2, kursPayoneer: kurs };
  const counters = new Map<string, number>();
  const kode = (gameId: string) => {
    const game = games.find((x) => x.id === gameId)!;
    const n = (counters.get(gameId) ?? game.next_seq - 40) + 1;
    counters.set(gameId, n);
    return `${game.singkatan}-${String(n).padStart(4, "0")}`;
  };

  const all: Seed[] = [
    ...seeds,
    ...history.map(([game, isi, beli, jual], i) => ({
      game,
      isi,
      user: `lama${i + 1}`,
      status: "Sold" as const,
      beli,
      beliHari: 60 + i * 3,
      jual,
      jualHari: 20 + i * 2,
    })),
    ...activeExtra.map(([game, isi, beli], i) => ({
      game,
      isi,
      user: `stok${i + 1}`,
      status: (i % 3 === 0 ? "Belum Post" : "Belum Sold") as AccountStatus,
      beli,
      beliHari: i < 6 ? 35 + i : 8 + i,
    })),
  ];

  return all.map((s, i): AccountRow => {
    const game = games.find((x) => x.id === s.game)!;
    const store = stores.find((x) => x.id === (s.store ?? "s-zeron"))!;
    const parsed = parseIsiAkun(s.isi);
    const tanggalBeli = s.beliHari === null ? null : addDays(today, -s.beliHari);
    const aktif = ["Belum Post", "Belum Sold", "Hold", "Update"].includes(s.status);
    const holdSampai = s.status === "Hold" && tanggalBeli ? addDays(today, s.hold ?? 7) : null;
    const sale = s.status === "Sold" && s.jual ? saleBreakdown(s.jual, s.beli, rates) : null;
    const umur = tanggalBeli ? diffDays(tanggalBeli, today) : null;
    return {
      id: `a-${i}`,
      kode: kode(s.game),
      no_lama: null,
      game_id: s.game,
      store_id: store.id,
      isi_akun: s.isi,
      jumlah_varian: jumlahVarianFor(parsed, game.satuan_varian),
      tags: parsed.tags,
      username: s.user,
      sumber: s.grind ? "Grind" : "Beli",
      dibeli_dari: s.dari ?? null,
      harga_beli_idr: s.beli,
      tanggal_beli: tanggalBeli,
      harga_listing_usd: null,
      status: s.status,
      hold_sampai: holdSampai,
      tanggal_hb: s.status === "HB" ? addDays(today, -3) : null,
      catatan: null,
      is_legacy: s.beliHari === null,
      created_at: ts,
      updated_at: ts,
      game_nama: game.nama,
      game_singkatan: game.singkatan,
      store_nama: store.nama,
      stok_aktif: aktif,
      umur_hari: umur,
      hold_lewat: s.status === "Hold" && !!holdSampai && holdSampai < today,
      stok_lama: aktif && umur !== null && umur > 30,
      harga_jual_usd: s.jual ?? null,
      tanggal_terjual: s.jualHari !== undefined ? addDays(today, -s.jualHari) : null,
      net_usd: sale?.net ?? null,
      laba_idr: sale?.laba ?? null,
      sale_store_id: sale ? store.id : null,
    };
  });
}

export function buildPerf(accounts: AccountRow[]): GamePerformance[] {
  return games.map((game) => {
    const rows = accounts.filter((a) => a.game_id === game.id);
    const sold = rows.filter((a) => a.status === "Sold");
    const aktif = rows.filter((a) => a.stok_aktif);
    const hb = rows.filter((a) => a.status === "HB");
    const jual = sold.filter((a) => a.harga_jual_usd !== null).map((a) => a.harga_jual_usd!);
    return {
      game_id: game.id,
      nama: game.nama,
      singkatan: game.singkatan,
      aktif: true,
      akun_total: rows.length,
      akun_terjual: sold.length,
      stok_aktif: aktif.length,
      akun_hb: hb.length,
      rugi_hb: hb.reduce((t, a) => t + a.harga_beli_idr, 0),
      modal_tertahan: aktif.reduce((t, a) => t + a.harga_beli_idr, 0),
      laba_total: sold.reduce((t, a) => t + (a.laba_idr ?? 0), 0),
      modal_terjual: sold.reduce((t, a) => t + a.harga_beli_idr, 0),
      rata_jual_usd: jual.length ? jual.reduce((t, v) => t + v, 0) / jual.length : null,
      median_hari_laku: sold.length ? 14 : null,
    };
  });
}

export function buildWeekly(today: string, accounts: AccountRow[]): WeeklyReport[] {
  const monday = mondayOf(today);
  const past = [1420000, 1950000, 1100000, 2600000, 1800000];
  const modal = [850000, 1200000, 400000, 1750000, 950000];
  const rows: WeeklyReport[] = past.map((laba, i) => ({
    ...emptyWeek(addDays(monday, -7 * (past.length - i))),
    laba,
    laba_penjualan: laba,
    modal_keluar: modal[i],
    cash_flow: 600000 - modal[i],
  }));

  const inWeek = (d: string | null) => d !== null && d >= monday && d <= addDays(monday, 6);
  const sold = accounts.filter((a) => a.status === "Sold" && inWeek(a.tanggal_terjual));
  const bought = accounts.filter((a) => inWeek(a.tanggal_beli));
  const net = sold.reduce((t, a) => t + (a.net_usd ?? 0), 0);
  const penjualan = net * kurs * 0.96;
  const modalTerjual = sold.reduce((t, a) => t + a.harga_beli_idr, 0);
  const koreksi = -32000;
  const current = {
    ...emptyWeek(monday),
    modal_keluar: bought.reduce((t, a) => t + a.harga_beli_idr, 0),
    akun_dibeli: bought.length,
    penjualan_net_usd: net,
    penjualan_idr: penjualan,
    modal_terjual: modalTerjual,
    akun_terjual: sold.length,
    laba_penjualan: penjualan - modalTerjual,
    koreksi_penarikan: koreksi,
    idr_diterima: 1504000,
    usd_ditarik: 100,
    jumlah_penarikan: 1,
  };
  current.laba = current.laba_penjualan + koreksi;
  current.cash_flow = current.idr_diterima - current.modal_keluar;
  return [...rows, current];
}

function emptyWeek(start: string): WeeklyReport {
  return {
    minggu_mulai: start,
    minggu_selesai: addDays(start, 6),
    modal_keluar: 0,
    akun_dibeli: 0,
    penjualan_net_usd: 0,
    penjualan_idr: 0,
    modal_terjual: 0,
    akun_terjual: 0,
    laba_penjualan: 0,
    koreksi_penarikan: 0,
    rugi_hb: 0,
    akun_hb: 0,
    laba: 0,
    idr_diterima: 0,
    usd_ditarik: 0,
    jumlah_penarikan: 0,
    cash_flow: 0,
  };
}

export const balances: StoreBalance[] = [
  {
    store_id: "s-zeron",
    nama: "Zeron",
    saldo_awal_usd: 0,
    masuk_usd: 1913.35,
    akun_terjual: 83,
    ditarik_usd: 1845.3,
    jumlah_penarikan: 14,
    penarikan_tanpa_rupiah: 13,
    penyesuaian_usd: 0,
    saldo_usd: 68.05,
  },
  {
    store_id: "s-realm",
    nama: "Realm",
    saldo_awal_usd: 0,
    masuk_usd: 35.7,
    akun_terjual: 14,
    ditarik_usd: 0,
    jumlah_penarikan: 0,
    penarikan_tanpa_rupiah: 0,
    penyesuaian_usd: 0,
    saldo_usd: 35.7,
  },
];

export function buildWithdrawals(today: string): Withdrawal[] {
  const w = (i: number, usd: number, tanggal: string | null, idr: number | null): Withdrawal => ({
    id: `w-${i}`,
    store_id: "s-zeron",
    tanggal,
    usd_ditarik: usd,
    biaya_tarik_pct: 4,
    biaya_tetap_usd: 2,
    kurs_payoneer: tanggal ? 16000 : 17000,
    idr_diterima: idr,
    kurs_efektif: idr ? Math.round((idr / usd) * 100) / 100 : null,
    koreksi_laba_idr: idr ? idr - usd * 0.96 * (tanggal ? 16000 : 17000) : null,
    catatan: null,
    is_legacy: !tanggal,
    created_at: ts,
  });
  return [
    w(0, 100, addDays(today, -3), 1504000),
    ...[200, 288.97, 200, 150, 100, 120, 80, 95, 200, 111.33, 100, 50, 50].map((usd, i) => w(i + 1, usd, null, null)),
  ];
}

export const adjustments: BalanceAdjustment[] = [];
