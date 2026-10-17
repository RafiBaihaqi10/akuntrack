// Core domain vocabulary shared by UI, calculations and the database layer.

export const ACCOUNT_STATUSES = ["Belum Post", "Belum Sold", "Hold", "Update", "Sold", "HB"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/** Statuses that count as active stock (modal tertahan, umur stok). */
export const ACTIVE_STATUSES: readonly AccountStatus[] = ["Belum Post", "Belum Sold", "Hold", "Update"];

export const ACCOUNT_SOURCES = ["Beli", "Grind"] as const;
export type AccountSource = (typeof ACCOUNT_SOURCES)[number];

export const QUADRANTS = ["agresif", "kecil", "selektif", "tahan"] as const;
export type Quadrant = (typeof QUADRANTS)[number];

export const QUADRANT_LABEL: Record<Quadrant, string> = {
  agresif: "Restock agresif",
  kecil: "Restock kecil, sering",
  selektif: "Selektif",
  tahan: "Tahan restock",
};
