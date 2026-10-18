// Calendar helpers. Business dates are WIB calendar days stored as `YYYY-MM-DD`;
// weeks run Monday–Sunday, matching `date_trunc('week', ...)` in the views.

const TIME_ZONE = "Asia/Jakarta";

const ymd = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** Today's date in WIB as `YYYY-MM-DD`. */
export function todayWib(now: Date = new Date()) {
  return ymd.format(now);
}

function toUtc(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number) {
  return fromUtc(toUtc(iso) + days * 86_400_000);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffDays(from: string, to: string) {
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

/** Monday of the week containing `iso`. */
export function mondayOf(iso: string) {
  const weekday = new Date(toUtc(iso)).getUTCDay(); // 0 = Sunday
  return addDays(iso, -((weekday + 6) % 7));
}

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

/** `Senin 12 sampai Minggu 18 Okt 2026`; the first month is shown only when it differs. */
export function formatWeekLong(monday: string) {
  const a = parts(monday);
  const b = parts(addDays(monday, 6));
  const first = a.m === b.m ? `${a.d}` : `${a.d} ${MONTHS[a.m - 1]}${a.y === b.y ? "" : ` ${a.y}`}`;
  return `Senin ${first} sampai Minggu ${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
}

/** `12–18 Okt`, `28 Sep–4 Okt`. */
export function formatWeekShort(monday: string) {
  const a = parts(monday);
  const b = parts(addDays(monday, 6));
  return a.m === b.m
    ? `${a.d}–${b.d} ${MONTHS[b.m - 1]}`
    : `${a.d} ${MONTHS[a.m - 1]}–${b.d} ${MONTHS[b.m - 1]}`;
}

const stamp = new Intl.DateTimeFormat("id-ID", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** `17 Okt, 08.00` for a timestamp, shown in WIB. */
export function formatStampWib(timestamp: string) {
  const p = Object.fromEntries(stamp.formatToParts(new Date(timestamp)).map((x) => [x.type, x.value]));
  const month = MONTHS[Number(ymd.format(new Date(timestamp)).slice(5, 7)) - 1];
  return `${p.day} ${month}, ${p.hour}.${p.minute}`;
}
