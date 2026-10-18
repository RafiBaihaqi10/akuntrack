"use client";

import { useState } from "react";
import { SegmentedControl } from "@/components/ui/choice";
import type { WeekPoint } from "@/lib/analytics";
import { sum } from "@/lib/calc";
import { formatWeekShort } from "@/lib/dates";
import { formatDateShort, formatIdrCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

const PERIODS = ["6", "12", "26"] as const;
type Period = (typeof PERIODS)[number];

type WeeklyChartProps = {
  /** Up to 26 weeks, oldest first, ending with this week. */
  series: WeekPoint[];
  budget: { rataLaba: number; budget: number; porsiPct: number };
  modal: { total: number; akun: number; caption: string };
};

const BAR_HEIGHT = 180;

/** Laba vs modal keluar per week, with a selectable week and period. */
export function WeeklyChart({ series, budget, modal }: WeeklyChartProps) {
  const [period, setPeriod] = useState<Period>("6");
  const weeks = series.slice(-Number(period));
  const [selected, setSelected] = useState(weeks.length - 1);
  const index = Math.min(selected, weeks.length - 1);
  const pick = weeks[index];
  const isThisWeek = index === weeks.length - 1;
  const max = Math.max(1, ...weeks.map((w) => Math.max(Math.abs(w.laba), w.modal)));
  const totalLaba = sum(weeks.map((w) => w.laba));
  const totalModal = sum(weeks.map((w) => w.modal));
  const dense = weeks.length > 12;

  return (
    <div className="grid items-stretch gap-5.5 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-7">
      <section aria-labelledby="mingguan-judul" className="flex min-w-0 flex-col gap-3.5 lg:rounded-2xl lg:bg-surface lg:px-6 lg:py-5.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
          <div className="flex flex-col gap-1">
            <h2 id="mingguan-judul" className="text-md font-bold lg:text-lg">
              Laba dan modal keluar per minggu
            </h2>
            <span className="text-sm text-ink-muted">
              {isThisWeek ? `Minggu ini, ${formatWeekShort(pick.start)}` : `Minggu ${formatWeekShort(pick.start)}`}
            </span>
          </div>
          <div className="flex gap-7">
            <div className="flex flex-col gap-0.5 lg:items-end">
              <span className="text-xs text-ink-muted">Laba</span>
              <span className={cn("text-2xl font-extrabold lg:text-3xl", pick.laba < 0 ? "text-loss" : "text-profit")}>
                {formatIdrCompact(pick.laba)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 lg:items-end">
              <span className="text-xs text-ink-muted">Modal keluar</span>
              <span className="text-2xl font-extrabold lg:text-3xl">{formatIdrCompact(pick.modal)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4.5 gap-y-2">
          <Legend className="bg-profit">Laba</Legend>
          <Legend className="bg-axis">Modal keluar</Legend>
          <SegmentedControl
            aria-label="Periode"
            value={period}
            onValueChange={(v) => {
              setPeriod(v);
              setSelected(Number(v) - 1);
            }}
            options={PERIODS.map((p) => ({ value: p, label: `${p} mgg` }))}
            className="ml-auto [&>button]:min-h-9 [&>button]:px-2.5 [&>button]:text-xs"
          />
        </div>

        <div className={cn("flex border-b border-axis", dense ? "gap-0.5" : "gap-1.5 lg:gap-2.5")}>
          {weeks.map((w, i) => {
            const on = i === index;
            const labaH = Math.max(2, Math.round((Math.max(0, w.laba) / max) * BAR_HEIGHT));
            const modalH = Math.max(2, Math.round((w.modal / max) * BAR_HEIGHT));
            const label = i === weeks.length - 1 ? "Minggu ini" : formatDateShort(w.start);
            return (
              <button
                key={w.start}
                type="button"
                aria-pressed={on}
                aria-label={`Minggu ${formatWeekShort(w.start)}: laba ${formatIdrCompact(w.laba)}, modal keluar ${formatIdrCompact(w.modal)}`}
                onClick={() => setSelected(i)}
                className={cn(
                  "flex h-58 min-w-0 flex-1 flex-col items-center justify-end gap-2 rounded-t-lg pt-2.5 pb-2 transition-colors",
                  on ? "bg-tint" : "hover:bg-tint/50",
                )}
              >
                <span aria-hidden className={cn("flex h-45 items-end", dense ? "gap-px" : "gap-1 lg:gap-1.5")}>
                  <span
                    className={cn("rounded-t-[5px]", dense ? "w-1.5 lg:w-2.5" : "w-4 lg:w-7", w.laba < 0 ? "bg-loss" : "bg-profit")}
                    style={{ height: w.laba < 0 ? 2 : labaH }}
                  />
                  <span className={cn("rounded-t-[5px] bg-axis", dense ? "w-1.5 lg:w-2.5" : "w-4 lg:w-7")} style={{ height: modalH }} />
                </span>
                <span
                  className={cn(
                    "max-w-full truncate text-2xs lg:text-xs",
                    on ? "font-bold text-ink" : "font-medium text-ink-muted",
                    dense && !on && i % 4 !== weeks.length % 4 && "invisible",
                  )}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-sm text-ink-muted">
          Total {weeks.length} minggu: laba {formatIdrCompact(totalLaba)}, modal keluar {formatIdrCompact(totalModal)}
        </p>
      </section>

      <div className="flex flex-col rounded-2xl bg-surface">
        <SideStat label="Rata-rata laba per minggu" value={formatIdrCompact(totalLaba / weeks.length)} tone="profit" />
        <SideStat
          label="Budget restock minggu depan"
          value={formatIdrCompact(budget.budget)}
          sub={`${budget.porsiPct}% dari rata-rata laba 4 minggu terakhir (${formatIdrCompact(budget.rataLaba)})`}
        />
        <SideStat label="Modal tertahan di stok" value={formatIdrCompact(modal.total)} sub={modal.caption} last />
      </div>
    </div>
  );
}

function Legend({ className, children }: { className: string; children: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-ink-muted">
      <span aria-hidden className={cn("size-2.5 rounded-[3px]", className)} />
      {children}
    </span>
  );
}

function SideStat({
  label,
  value,
  sub,
  tone,
  last,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "profit";
  last?: boolean;
}) {
  return (
    <div className={cn("flex flex-1 flex-col justify-center gap-1 px-5.5 py-4.5 lg:py-5", !last && "border-b border-divider")}>
      <span className="text-sm text-ink-muted">{label}</span>
      <span className={cn("text-3xl font-extrabold lg:text-[28px] lg:leading-[34px]", tone === "profit" && "text-profit")}>{value}</span>
      {sub && <span className="text-xs text-ink-muted lg:text-sm">{sub}</span>}
    </div>
  );
}
