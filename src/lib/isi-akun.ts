// Reads the free-text "isi akun" into a variant count and tags:
// "5 Monarch (Madara + Ichigo) + Diavolo" → 5 Monarch, tags [Madara, Ichigo, Diavolo].

export type ParsedIsi = {
  /** Leading count, e.g. 5 in "5 Monarch". Null when the text does not start with one. */
  jumlah: number | null;
  /** Word after the count, e.g. "Monarch". */
  satuan: string | null;
  tags: string[];
};

const HEAD = /^\s*(\d+)\s+([A-Za-z][\w-]*)/;

export function parseIsiAkun(text: string): ParsedIsi {
  const head = text.match(HEAD);
  const rest = head ? text.slice(head[0].length) : text;
  const tags = rest
    .replace(/[()]/g, "+")
    .split("+")
    .map((t) => t.trim().replace(/\s+/g, " "))
    .filter((t) => t.length > 0);
  return {
    jumlah: head ? Number(head[1]) : null,
    satuan: head ? head[2] : null,
    tags: Array.from(new Set(tags)),
  };
}

/**
 * Variant count stored on the account: only when the unit matches the game's
 * satuan varian ("5 Monarch" for Anime Vanguard), so "2 Primordial" is not
 * mistaken for a Unbound count.
 */
export function jumlahVarianFor(parsed: ParsedIsi, satuanVarian: string | null) {
  if (parsed.jumlah === null || !parsed.satuan || !satuanVarian) return null;
  return parsed.satuan.toLowerCase().startsWith(satuanVarian.toLowerCase()) ? parsed.jumlah : null;
}

export const VARIANT_BANDS = ["1–2", "3–4", "5–6", "7+"] as const;
export type VariantBand = (typeof VARIANT_BANDS)[number];

/** Price bands used for variant analysis and the purchase ceiling. */
export function variantBand(jumlah: number): VariantBand {
  if (jumlah <= 2) return "1–2";
  if (jumlah <= 4) return "3–4";
  if (jumlah <= 6) return "5–6";
  return "7+";
}
