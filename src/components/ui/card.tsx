import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Surface panel with 16px radius. `inset` is the darker variant used inside another surface. */
export function Card({
  className,
  inset,
  padded = true,
  ...props
}: ComponentProps<"section"> & { inset?: boolean; padded?: boolean }) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-2xl",
        inset ? "bg-canvas" : "bg-surface",
        padded && "p-4.5 lg:p-6",
        className,
      )}
      {...props}
    />
  );
}

type SectionHeaderProps = {
  title: ReactNode;
  id?: string;
  /** Right-aligned action, typically a teal link. */
  action?: ReactNode;
  className?: string;
};

/** `h2` row used above every section ("Balance toko", "Perlu dicek"). */
export function SectionHeader({ title, id, action, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex min-h-tap items-center justify-between gap-3", className)}>
      <h2 id={id} className="text-md font-bold">
        {title}
      </h2>
      {action}
    </div>
  );
}

type PageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Element before the title (back/close button). */
  leading?: ReactNode;
  /** Elements after the title (settings icon, secondary actions). */
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, leading, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex items-center justify-between gap-3", className)}>
      <div className="flex min-w-0 items-center gap-2">
        {leading}
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="text-3xl font-extrabold tracking-tight lg:text-4xl">{title}</h1>
          {subtitle && <p className="text-sm text-ink-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

type StatTileProps = {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  className?: string;
};

/** Label / big value / caption stack ("Modal keluar", "Cash flow", balance per toko). */
export function StatTile({ label, value, sub, className }: StatTileProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", className)}>
      <span className="text-xs text-ink-muted lg:text-sm">{label}</span>
      <span className="text-xl font-bold">{value}</span>
      {sub && <span className="text-xs text-ink-muted">{sub}</span>}
    </div>
  );
}

export function EmptyState({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("px-2 py-8 text-center text-sm text-ink-muted", className)}>{children}</p>;
}

/** Horizontal meter (modal tertahan per game). `value` is 0–1. */
export function Meter({
  value,
  tone = "neutral",
  label,
}: {
  value: number;
  tone?: "neutral" | "loss";
  label: string;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <span
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className="block h-2 w-full overflow-hidden rounded-xs bg-track"
    >
      <span
        className={cn("block h-full rounded-xs", tone === "loss" ? "bg-loss" : "bg-ink-subtle")}
        style={{ width: `${pct}%` }}
      />
    </span>
  );
}
