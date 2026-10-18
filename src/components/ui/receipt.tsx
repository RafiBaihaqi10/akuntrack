import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ReceiptProps = {
  title?: ReactNode;
  titleId?: string;
  /** Right side of the title row, e.g. "update 16 Okt, 21.40". */
  meta?: ReactNode;
  /**
   * `canvas` when the receipt sits on a surface panel; `screen` for dialogs that
   * are full screen on canvas (phone) and a surface side panel (desktop).
   */
  background?: "surface" | "canvas" | "screen";
  className?: string;
  children: ReactNode;
};

/**
 * The "struk": a calculation shown as a paper receipt with operator rows,
 * a dashed rule, a total, and a zigzag bottom edge.
 */
export function Receipt({ title, titleId, meta, background = "surface", className, children }: ReceiptProps) {
  const bg = { surface: "bg-surface", canvas: "bg-canvas", screen: "bg-surface lg:bg-canvas" }[background];
  const fill = { surface: "fill-surface", canvas: "fill-canvas", screen: "fill-surface lg:fill-canvas" }[background];
  return (
    <section aria-labelledby={titleId} className={cn("flex flex-col", className)}>
      <div className={cn("flex flex-col gap-3.5 rounded-t-2xl px-4.5 pt-4.5 pb-4", bg)}>
        {(title || meta) && (
          <div className="flex items-baseline justify-between gap-3">
            {title && (
              <h2 id={titleId} className="text-md font-bold">
                {title}
              </h2>
            )}
            {meta && <span className="text-xs text-ink-muted">{meta}</span>}
          </div>
        )}
        {children}
      </div>
      <ZigzagEdge className={fill} />
    </section>
  );
}

/** Grid that aligns operator / label / value columns across rows. */
export function ReceiptRows({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-baseline gap-x-2.5 gap-y-3.5">
      {children}
    </div>
  );
}

type ReceiptRowProps = {
  /** Operator before the row: ×, −, +, = (leave empty for the first row). */
  op?: "×" | "−" | "+" | "=";
  label: ReactNode;
  sub?: ReactNode;
  value: ReactNode;
};

export function ReceiptRow({ op, label, sub, value }: ReceiptRowProps) {
  return (
    <>
      <span aria-hidden className="text-md font-semibold text-ink-muted">
        {op}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-base font-semibold">{label}</span>
        {sub && <span className="text-xs text-ink-muted">{sub}</span>}
      </div>
      <span className="text-right text-lg font-bold">{value}</span>
    </>
  );
}

export function ReceiptDivider() {
  return <div aria-hidden className="border-t-[1.5px] border-dashed border-dash" />;
}

type ReceiptTotalProps = {
  label: ReactNode;
  value: ReactNode;
  /** Large hero number (Beranda) vs. regular total (forms). */
  size?: "hero" | "regular";
};

export function ReceiptTotal({ label, value, size = "regular" }: ReceiptTotalProps) {
  return (
    <div className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-baseline gap-x-2.5">
      <span aria-hidden className="text-md font-semibold text-ink-muted">
        =
      </span>
      <span className="text-md font-bold">{label}</span>
      <span
        className={cn("text-right font-extrabold tracking-tight", size === "hero" ? "text-5xl" : "text-3xl")}
      >
        {value}
      </span>
    </div>
  );
}

function ZigzagEdge({ className }: { className?: string }) {
  // 70 teeth of 10px across a 700px viewBox, stretched to the receipt width.
  const teeth = Array.from({ length: 70 }, (_, i) => `L${700 - i * 10 - 5} 8L${700 - (i + 1) * 10} 0`).join(
    "",
  );
  return (
    <svg
      aria-hidden
      viewBox="0 0 700 8"
      preserveAspectRatio="none"
      className={cn("block h-2 w-full", className)}
    >
      <path d={`M0 0H700${teeth}Z`} />
    </svg>
  );
}
