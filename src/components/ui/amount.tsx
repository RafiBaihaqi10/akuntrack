import { formatIdr, formatIdrCompact, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

type AmountProps = {
  value: number | null | undefined;
  currency: "usd" | "idr";
  /**
   * `auto`: dollars teal, rupiah ink.
   * `profit`: green when ≥ 0, red with minus when negative.
   * `plain`: inherit color.
   */
  tone?: "auto" | "profit" | "plain";
  /** Show `+` for positive values. */
  signed?: boolean;
  /** `Rp1,06 jt` style. */
  compact?: boolean;
  className?: string;
};

/**
 * Money with the app's color rules: "$" amounts are always teal,
 * laba is green and rugi is red with a minus. Null renders an em dash.
 */
export function Amount({ value, currency, tone = "auto", signed, compact, className }: AmountProps) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return <span className={cn("text-ink-muted", className)}>—</span>;
  }
  const text =
    currency === "usd"
      ? formatUsd(value, { signed })
      : compact
        ? formatIdrCompact(value, { signed })
        : formatIdr(value, { signed });

  const color =
    tone === "profit"
      ? value < 0
        ? "text-loss"
        : "text-profit"
      : tone === "auto" && currency === "usd"
        ? "text-teal"
        : undefined;

  return <span className={cn("whitespace-nowrap", color, className)}>{text}</span>;
}
