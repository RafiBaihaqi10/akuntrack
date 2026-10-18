// Restock assistant and warnings (guide.md › Analytics & strategi restock).
// Pure functions over view rows, shared by Beranda, Stok, Analytics and the
// Tambah stok form.

import { hargaBeliMaks, median, sum, type Rates } from "./calc";
import { addDays, diffDays } from "./dates";
import type { AccountRow, Game, GamePerformance, Settings, WeeklyReport, Withdrawal } from "./db-types";
import type { Quadrant } from "./domain";
import { formatIdrCompact, formatPercent } from "./format";
import { VARIANT_BANDS, variantBand, type VariantBand } from "./isi-akun";

/** Minimum sold accounts before a median price is trusted. */
export const MIN_SAMPLE = 3;

// ---------------------------------------------------------------------------
// Weekly series
// ---------------------------------------------------------------------------

export type WeekPoint = {
  start: string;
  laba: number;
  modal: number;
  report: WeeklyReport | null;
};

/** The last `n` weeks ending with the week of `currentMonday`, oldest first; empty weeks are zero. */
export function weeklySeries(rows: WeeklyReport[], currentMonday: string, n: number): WeekPoint[] {
  const byStart = new Map(rows.map((r) => [r.minggu_mulai, r]));
  return Array.from({ length: n }, (_, i) => {
    const start = addDays(currentMonday, -7 * (n - 1 - i));
    const report = byStart.get(start) ?? null;
    return { start, report, laba: report?.laba ?? 0, modal: report?.modal_keluar ?? 0 };
  });
}

/** Budget restock = average laba of the 4 completed weeks before this one × porsi reinvest. */
export function restockBudget(rows: WeeklyReport[], currentMonday: string, porsiPct: number) {
  const weeks = weeklySeries(rows, addDays(currentMonday, -7), 4);
  const rataLaba = sum(weeks.map((w) => w.laba)) / weeks.length;
  return { rataLaba, budget: Math.max(0, rataLaba * (porsiPct / 100)) };
}

// ---------------------------------------------------------------------------
// Variants and purchase ceiling
// ---------------------------------------------------------------------------

/** Minimal sold-account data needed for medians; also sent to the Tambah stok form. */
export type SoldSample = {
  game_id: string;
  jumlah_varian: number | null;
  harga_jual_usd: number;
};

export function soldSamples(accounts: AccountRow[]): SoldSample[] {
  return accounts
    .filter((a) => a.status === "Sold" && a.harga_jual_usd !== null && a.harga_jual_usd > 0)
    .map((a) => ({ game_id: a.game_id, jumlah_varian: a.jumlah_varian, harga_jual_usd: a.harga_jual_usd! }));
}

export type BatasBeli = {
  /** "3–4 Monarch" for a variant band, or the game name. */
  label: string;
  batas: number;
  medianJual: number;
  sampel: number;
};

/** Purchase ceiling for a new account: by variant band when there is data, else by game. */
export function batasBeli(
  samples: SoldSample[],
  game: Pick<Game, "id" | "nama" | "satuan_varian">,
  jumlahVarian: number | null,
  rates: Rates,
  targetMarginPct: number,
): BatasBeli | null {
  const ofGame = samples.filter((s) => s.game_id === game.id);
  if (jumlahVarian !== null && game.satuan_varian) {
    const band = variantBand(jumlahVarian);
    const prices = ofGame
      .filter((s) => s.jumlah_varian !== null && variantBand(s.jumlah_varian) === band)
      .map((s) => s.harga_jual_usd);
    if (prices.length >= MIN_SAMPLE) {
      const m = median(prices)!;
      return {
        label: `${band} ${game.satuan_varian}`,
        batas: hargaBeliMaks(m, rates, targetMarginPct),
        medianJual: m,
        sampel: prices.length,
      };
    }
  }
  const prices = ofGame.map((s) => s.harga_jual_usd);
  if (prices.length < MIN_SAMPLE) return null;
  const m = median(prices)!;
  return { label: game.nama, batas: hargaBeliMaks(m, rates, targetMarginPct), medianJual: m, sampel: prices.length };
}

export type VariantStat = {
  band: VariantBand;
  total: number;
  terjual: number;
  stokAktif: number;
  lakuPct: number | null;
  labaRata: number | null;
  medianJual: number | null;
};

/** Per-band performance for games that have a satuan varian. */
export function variantStats(accounts: AccountRow[], gameId: string): VariantStat[] {
  const rows = accounts.filter((a) => a.game_id === gameId && a.jumlah_varian !== null && a.status !== "HB");
  return VARIANT_BANDS.map((band) => {
    const inBand = rows.filter((a) => variantBand(a.jumlah_varian!) === band);
    const sold = inBand.filter((a) => a.status === "Sold");
    const aktif = inBand.filter((a) => a.stok_aktif).length;
    const laba = sold.filter((a) => a.laba_idr !== null).map((a) => a.laba_idr!);
    const harga = sold.filter((a) => a.harga_jual_usd !== null).map((a) => a.harga_jual_usd!);
    return {
      band,
      total: inBand.length,
      terjual: sold.length,
      stokAktif: aktif,
      lakuPct: sold.length + aktif > 0 ? sold.length / (sold.length + aktif) : null,
      labaRata: laba.length ? sum(laba) / laba.length : null,
      medianJual: median(harga),
    };
  }).filter((v) => v.total > 0);
}

// ---------------------------------------------------------------------------
// Restock quadrant per game
// ---------------------------------------------------------------------------

export type GameInsight = {
  perf: GamePerformance;
  /** Terjual ÷ (terjual + stok aktif). */
  lakuPct: number | null;
  labaPerAkun: number | null;
  roi: number | null;
  /** Share of all modal tertahan held by this game, 0–1. */
  modalShare: number;
  dataCukup: boolean;
  quadrant: Quadrant | null;
  saran: string;
  budget: number;
};

type InsightInput = {
  perf: GamePerformance[];
  games: Game[];
  accounts: AccountRow[];
  settings: Settings;
  rates: Rates;
  budget: number;
};

export function gameInsights({ perf, games, accounts, settings, rates, budget }: InsightInput): GameInsight[] {
  const totalTertahan = sum(perf.map((p) => p.modal_tertahan));
  const samples = soldSamples(accounts);

  const base = perf
    .filter((p) => p.akun_total > 0)
    .map((p) => {
      const lakuBase = p.akun_terjual + p.stok_aktif;
      const lakuPct = lakuBase > 0 ? p.akun_terjual / lakuBase : null;
      const labaPerAkun = p.akun_terjual > 0 ? p.laba_total / p.akun_terjual : null;
      const roi = p.modal_terjual > 0 ? p.laba_total / p.modal_terjual : null;
      const modalShare = totalTertahan > 0 ? p.modal_tertahan / totalTertahan : 0;
      const dataCukup = p.akun_total >= settings.min_akun_data;

      let quadrant: Quadrant | null = null;
      if (lakuPct !== null) {
        const cepat = lakuPct * 100 >= settings.batas_laku_pct;
        const untung = (labaPerAkun ?? 0) >= settings.batas_laba_idr;
        quadrant = cepat ? (untung ? "agresif" : "kecil") : untung ? "selektif" : "tahan";
        if (modalShare * 100 > settings.batas_modal_tertahan_pct) quadrant = "tahan";
      }
      return { perf: p, lakuPct, labaPerAkun, roi, modalShare, dataCukup, quadrant };
    });

  // Budget goes to quadrant 1 and 2 games, split by their share of laba.
  const penerima = base.filter((g) => (g.quadrant === "agresif" || g.quadrant === "kecil") && g.perf.laba_total > 0);
  const labaPenerima = sum(penerima.map((g) => g.perf.laba_total));

  return base
    .map((g) => {
      const game = games.find((x) => x.id === g.perf.game_id);
      const porsi = penerima.includes(g) && labaPenerima > 0 ? g.perf.laba_total / labaPenerima : 0;
      return {
        ...g,
        budget: budget * porsi,
        saran: saranFor(g, game, accounts, samples, settings, rates),
      };
    })
    .sort((a, b) => QUADRANT_ORDER.indexOf(a.quadrant) - QUADRANT_ORDER.indexOf(b.quadrant) || b.perf.laba_total - a.perf.laba_total);
}

const QUADRANT_ORDER: (Quadrant | null)[] = ["agresif", "kecil", "selektif", "tahan", null];

function saranFor(
  g: Omit<GameInsight, "saran" | "budget">,
  game: Game | undefined,
  accounts: AccountRow[],
  samples: SoldSample[],
  settings: Settings,
  rates: Rates,
) {
  const n = g.perf.akun_total;
  const stok = g.perf.stok_aktif;
  switch (g.quadrant) {
    case null:
      return `Belum ada yang terjual dari ${n} akun`;
    case "agresif": {
      if (!g.dataCukup) return `Beli 1–2 akun dulu, baru ${n} akun tercatat`;
      if (game?.satuan_varian) {
        const best = variantStats(accounts, game.id)
          .filter((v) => v.terjual >= MIN_SAMPLE && v.lakuPct !== null)
          .sort((a, b) => b.lakuPct! - a.lakuPct! || (b.labaRata ?? 0) - (a.labaRata ?? 0))[0];
        if (best?.medianJual) {
          const batas = hargaBeliMaks(best.medianJual, rates, settings.target_margin_pct);
          return `Cari ${best.band} ${game.satuan_varian}, beli maksimal ${formatIdrCompact(batas)}`;
        }
      }
      if (game) {
        const b = batasBeli(samples, game, null, rates, settings.target_margin_pct);
        if (b) return `Tambah stok, beli maksimal ${formatIdrCompact(b.batas)}`;
      }
      return "Tambah stok game ini";
    }
    case "kecil":
      return g.dataCukup ? "Beli yang murah, putar cepat" : `Beli yang murah, baru ${n} akun tercatat`;
    case "selektif":
      return g.dataCukup
        ? `Jual ${stok} stok dulu, beli hanya varian yang laku`
        : `Jual stok dulu, baru ${n} akun tercatat`;
    case "tahan":
      if (g.modalShare * 100 > settings.batas_modal_tertahan_pct) return `Habiskan ${stok} akun dulu sebelum beli lagi`;
      return g.dataCukup ? "Tahan dulu, laku dan laba masih rendah" : `Tunggu data, baru ${n} akun tercatat`;
  }
}

// ---------------------------------------------------------------------------
// Warnings ("Perlu dicek" on Beranda, "Peringatan" on Analytics)
// ---------------------------------------------------------------------------

export type Warning = {
  id: string;
  tone: "warn" | "loss" | "muted";
  title: string;
  detail: string;
  href: string;
};

function names(rows: AccountRow[]) {
  const shown = rows.slice(0, 2).map((a) => a.username ?? a.kode);
  const more = rows.length - shown.length;
  const games = Array.from(new Set(rows.map((a) => a.game_nama)));
  const list = more > 0 ? `${shown.join(", ")} dan ${more} lainnya` : shown.join(" dan ");
  return games.length === 1 ? `${list} di ${games[0]}` : list;
}

type WarningInput = {
  accounts: AccountRow[];
  perf: GamePerformance[];
  withdrawals: Withdrawal[];
  settings: Settings;
  today: string;
};

export function buildWarnings({ accounts, perf, withdrawals, settings, today }: WarningInput): Warning[] {
  const out: Warning[] = [];

  const holdLewat = accounts.filter((a) => a.hold_lewat);
  if (holdLewat.length) {
    out.push({
      id: "hold-lewat",
      tone: "warn",
      title: `${holdLewat.length} akun Hold lewat tanggal`,
      detail: names(holdLewat),
      href: "/stok?cek=hold-lewat",
    });
  }

  const totalTertahan = sum(perf.map((p) => p.modal_tertahan));
  for (const p of perf) {
    const share = totalTertahan > 0 ? p.modal_tertahan / totalTertahan : 0;
    if (share * 100 > settings.batas_modal_tertahan_pct && p.stok_aktif > 0) {
      out.push({
        id: `modal-${p.game_id}`,
        tone: "loss",
        title: `${p.nama} menahan ${formatPercent(share)} modal stok`,
        detail: `${p.stok_aktif} akun, ${formatIdrCompact(p.modal_tertahan)}. Saran: tahan restock dulu`,
        href: "/analytics",
      });
    }
  }

  const hb30 = accounts.filter((a) => a.status === "HB" && a.tanggal_hb && diffDays(a.tanggal_hb, today) <= 30);
  const hbByGame = new Map<string, AccountRow[]>();
  for (const a of hb30) hbByGame.set(a.game_id, [...(hbByGame.get(a.game_id) ?? []), a]);
  for (const rows of hbByGame.values()) {
    if (rows.length < 2) continue;
    const penjual = Array.from(new Set(rows.map((a) => a.dibeli_dari).filter(Boolean)));
    out.push({
      id: `hb-${rows[0].game_id}`,
      tone: "loss",
      title: `${rows.length} akun ${rows[0].game_nama} kena HB dalam 30 hari`,
      detail: `Rugi ${formatIdrCompact(sum(rows.map((a) => a.harga_beli_idr)))}${penjual.length ? `, dibeli dari ${penjual.slice(0, 2).join(" dan ")}` : ""}`,
      href: "/stok?status=HB",
    });
  }

  const stokLama = accounts.filter((a) => a.stok_lama);
  if (stokLama.length) {
    out.push({
      id: "stok-lama",
      tone: "warn",
      title: `${stokLama.length} akun di stok lebih dari ${settings.stok_lama_hari} hari`,
      detail: `Modal ${formatIdrCompact(sum(stokLama.map((a) => a.harga_beli_idr)))} mengendap`,
      href: "/stok?cek=stok-lama",
    });
  }

  const tanpaHarga = accounts.filter((a) => a.status === "Sold" && a.harga_jual_usd === null);
  if (tanpaHarga.length) {
    out.push({
      id: "tanpa-harga",
      tone: "warn",
      title: `${tanpaHarga.length} akun Sold tanpa harga jual`,
      detail: `${names(tanpaHarga)}, labanya belum terhitung`,
      href: "/stok?status=Sold&cek=tanpa-harga",
    });
  }

  const tanpaTanggal = accounts.filter((a) => a.stok_aktif && a.tanggal_beli === null);
  if (tanpaTanggal.length) {
    out.push({
      id: "tanpa-tanggal",
      tone: "muted",
      title: `${tanpaTanggal.length} akun stok lama belum punya tanggal beli`,
      detail: "Isi tanggalnya supaya umur stok bisa dihitung",
      href: "/stok?cek=tanpa-tanggal",
    });
  }

  const tanpaRupiah = withdrawals.filter((w) => w.idr_diterima === null);
  if (tanpaRupiah.length) {
    out.push({
      id: "tanpa-rupiah",
      tone: "muted",
      title: `${tanpaRupiah.length} penarikan belum dicatat rupiahnya`,
      detail: "Isi dari mutasi bank supaya kurs efektif terlihat",
      href: "/balance",
    });
  }

  return out;
}
