import type { Quadrant } from "@/lib/domain";
import { formatIdrCompact, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

type Point = { nama: string; lakuPct: number; labaPerAkun: number; quadrant: Quadrant };

const DOT: Record<Quadrant, string> = {
  agresif: "bg-profit",
  kecil: "bg-teal",
  selektif: "bg-warn",
  tahan: "bg-loss",
};

/** Round an axis maximum up to a tidy step (Rp100 rb, Rp250 rb, Rp500 rb …). */
function niceMax(value: number) {
  const steps = [100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000];
  const step = steps.find((s) => value <= s * 5) ?? 10_000_000;
  return Math.max(step, Math.ceil(value / step) * step);
}

/**
 * Scatter of games: % laku (x) against laba per account (y), with the
 * quadrant thresholds from Pengaturan. Drawn with CSS, labels stay text.
 */
export function RestockMap({
  points,
  batasLakuPct,
  batasLaba,
}: {
  points: Point[];
  batasLakuPct: number;
  batasLaba: number;
}) {
  if (points.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-muted">Peta muncul setelah ada akun yang terjual.</p>;
  }
  const yMax = niceMax(Math.max(batasLaba * 2, ...points.map((p) => p.labaPerAkun)));
  const yMin = Math.min(0, ...points.map((p) => p.labaPerAkun));
  const yRange = yMax - yMin;
  const y = (v: number) => ((v - yMin) / yRange) * 100;
  const step = yMax / 5;
  const yTicks = Array.from({ length: 6 }, (_, i) => i * step).filter((v) => v >= yMin);
  const xTicks = [0, 0.25, 0.5, 0.75, 1];
  const xLine = batasLakuPct;
  const yLine = y(batasLaba);

  return (
    <div className="grid grid-cols-[60px_minmax(0,1fr)] grid-rows-[300px_26px] gap-x-2">
      <div aria-hidden className="relative">
        {yTicks.map((v) => (
          <span
            key={v}
            className="absolute right-0 translate-y-1/2 text-xs whitespace-nowrap text-ink-muted"
            style={{ bottom: `${y(v)}%` }}
          >
            {v === 0 ? "Rp0" : formatIdrCompact(v)}
          </span>
        ))}
      </div>
      <div className="relative border-b border-l border-axis">
        <div aria-hidden className="absolute top-0 right-0 bg-tint" style={{ left: `${xLine}%`, bottom: `${yLine}%` }} />
        <div aria-hidden className="absolute inset-y-0 border-l-[1.5px] border-dashed border-guide" style={{ left: `${xLine}%` }} />
        <div aria-hidden className="absolute inset-x-0 border-t-[1.5px] border-dashed border-guide" style={{ bottom: `${yLine}%` }} />
        <span className="absolute top-2 right-2.5 text-sm font-bold text-chip-green-ink">Restock agresif</span>
        <span className="absolute top-2 left-2.5 text-sm font-bold text-ink-muted">Selektif: habiskan stok dulu</span>
        <span className="absolute bottom-2 left-2.5 text-sm font-bold text-ink-muted">Tahan restock</span>
        <span className="absolute right-2.5 bottom-2 text-sm font-bold text-ink-muted">Restock kecil, sering</span>
        <ul>
          {points.map((p) => {
            const left = Math.min(100, Math.max(0, p.lakuPct * 100));
            const kiri = left > 70;
            return (
              <li key={p.nama} className="absolute size-0" style={{ left: `${left}%`, bottom: `${y(p.labaPerAkun)}%` }}>
                <span aria-hidden className={cn("absolute -top-2 -left-2 size-4 rounded-full ring-2 ring-surface", DOT[p.quadrant])} />
                <span
                  className={cn(
                    "absolute -top-2 text-xs whitespace-nowrap text-ink",
                    kiri ? "right-3.5" : "left-3.5",
                    p.quadrant === "agresif" ? "font-bold" : "font-medium",
                  )}
                >
                  {p.nama}
                  <span className="sr-only">
                    : {formatPercent(p.lakuPct)} laku, laba {formatIdrCompact(p.labaPerAkun)} per akun
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <span />
      <div aria-hidden className="relative">
        {xTicks.map((t) => (
          <span key={t} className="absolute top-1.5 -translate-x-1/2 text-xs text-ink-muted" style={{ left: `${t * 100}%` }}>
            {formatPercent(t)}
          </span>
        ))}
      </div>
    </div>
  );
}
