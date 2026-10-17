// Number and date formatting in Indonesian style, matching the mockup:
// $1.913,35 · Rp2.073.256 · −Rp32.000 · Rp1,06 jt · Rp947 rb · 16 Okt

/** Typographic minus used for negative amounts (U+2212). */
export const MINUS = "−";

const usdFormat = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const intFormat = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const twoDecimals = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type SignOption = { signed?: boolean };

function sign(n: number, signed: boolean | undefined) {
  if (n < 0) return MINUS;
  return signed && n > 0 ? "+" : "";
}

/** `$170,85`, `−$100,00`; `signed` adds `+` for positive values. */
export function formatUsd(n: number, { signed }: SignOption = {}) {
  return `${sign(n, signed)}$${usdFormat.format(Math.abs(n))}`;
}

/** `Rp2.073.256`, `−Rp32.000`; rounds to whole rupiah. */
export function formatIdr(n: number, { signed }: SignOption = {}) {
  const rounded = Math.round(n);
  return `${sign(rounded, signed)}Rp${intFormat.format(Math.abs(rounded))}`;
}

/** Short form for summaries: `Rp5,22 jt`, `Rp947 rb`, `Rp500`. */
export function formatIdrCompact(n: number, { signed }: SignOption = {}) {
  const abs = Math.abs(n);
  const prefix = `${sign(Math.round(n), signed)}Rp`;
  if (abs >= 1_000_000) return `${prefix}${twoDecimals.format(abs / 1_000_000)} jt`;
  if (abs >= 1_000) return `${prefix}${intFormat.format(Math.round(abs / 1_000))} rb`;
  return `${prefix}${intFormat.format(Math.round(abs))}`;
}

/** `73%` from a 0–1 ratio. */
export function formatPercent(ratio: number) {
  return `${intFormat.format(Math.round(ratio * 100))}%`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** Parses `YYYY-MM-DD` as a calendar date (no timezone shift). */
function parts(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return { y, m, d };
}

/** `16 Okt` */
export function formatDateShort(isoDate: string) {
  const { m, d } = parts(isoDate);
  return `${d} ${MONTHS[m - 1]}`;
}

/** `16 Okt 2026` */
export function formatDateLong(isoDate: string) {
  const { y, m, d } = parts(isoDate);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Parses user-typed dollars, accepting `42`, `42,5` or `42.50`. Returns null when empty or invalid. */
export function parseUsdInput(text: string): number | null {
  const cleaned = text.replace(/[^0-9.,]/g, "");
  if (!cleaned) return null;
  // The last separator is the decimal mark; earlier ones are thousands separators.
  const lastSep = Math.max(cleaned.lastIndexOf(","), cleaned.lastIndexOf("."));
  const normalized =
    lastSep >= 0 && cleaned.length - lastSep - 1 <= 2
      ? cleaned.slice(0, lastSep).replace(/[.,]/g, "") + "." + cleaned.slice(lastSep + 1)
      : cleaned.replace(/[.,]/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Parses user-typed rupiah (`80.000`, `80000`). Returns null when empty. */
export function parseIdrInput(text: string): number | null {
  const digits = text.replace(/\D/g, "");
  return digits ? Number(digits) : null;
}
