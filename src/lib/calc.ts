// Money rules from guide.md, mirrored from the generated columns in the database
// so forms can preview a result before it is saved.

import type { Settings } from "./db-types";

export type Rates = {
  /** Eldorado admin, percent (15). */
  adminPct: number;
  /** Payoneer withdrawal cut, percent (4). */
  potonganTarikPct: number;
  /** Flat Payoneer fee per withdrawal, USD (2). */
  potonganTarikUsd: number;
  /** Rupiah per dollar used for estimates. */
  kursPayoneer: number;
};

/** Kurs Payoneer = kurs pasar − selisih, or the manual rate. Same as `kurs_payoneer_aktif()`. */
export function kursPayoneer(s: Pick<Settings, "mode_kurs" | "kurs_pasar" | "selisih_payoneer" | "kurs_payoneer_manual">) {
  if (s.mode_kurs === "manual" && s.kurs_payoneer_manual) return s.kurs_payoneer_manual;
  return Math.max(0, s.kurs_pasar - s.selisih_payoneer);
}

export function ratesFrom(s: Settings): Rates {
  return {
    adminPct: s.admin_pct,
    potonganTarikPct: s.potongan_tarik_pct,
    potonganTarikUsd: s.potongan_tarik_usd,
    kursPayoneer: kursPayoneer(s),
  };
}

/** Rupiah per dollar of net balance after the withdrawal cut (Rp16.000 × 96% = Rp15.360). */
export function rupiahPerNetDollar(r: Rates) {
  return r.kursPayoneer * (1 - r.potonganTarikPct / 100);
}

export type SaleBreakdown = {
  hargaJual: number;
  admin: number;
  /** Net USD that lands in the store balance. */
  net: number;
  /** Estimasi Rp = net × kurs Payoneer × (1 − potongan tarik). */
  estimasi: number;
  laba: number;
};

export function saleBreakdown(hargaJualUsd: number, modalIdr: number, r: Rates): SaleBreakdown {
  const admin = hargaJualUsd * (r.adminPct / 100);
  const net = hargaJualUsd - admin;
  const estimasi = net * rupiahPerNetDollar(r);
  return { hargaJual: hargaJualUsd, admin, net, estimasi, laba: estimasi - modalIdr };
}

/** Rupiah expected from a withdrawal: (USD × (1 − potongan) − biaya tetap) × kurs Payoneer. */
export function withdrawalEstimate(usd: number, r: Rates) {
  return Math.max(0, usd * (1 - r.potonganTarikPct / 100) - r.potonganTarikUsd) * r.kursPayoneer;
}

/**
 * Harga beli maks = median harga jual × (1 − admin) × (1 − potongan) × kurs ÷ (1 + target margin).
 */
export function hargaBeliMaks(medianJualUsd: number, r: Rates, targetMarginPct: number) {
  return (medianJualUsd * (1 - r.adminPct / 100) * rupiahPerNetDollar(r)) / (1 + targetMarginPct / 100);
}

export function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function sum(values: number[]) {
  return values.reduce((t, v) => t + v, 0);
}
