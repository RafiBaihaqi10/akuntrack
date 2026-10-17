import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import type { AccountStatus, Quadrant } from "@/lib/domain";
import { QUADRANT_LABEL } from "@/lib/domain";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex max-w-full items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-bold whitespace-nowrap",
  {
    variants: {
      tone: {
        teal: "bg-chip-teal text-chip-teal-ink",
        gold: "bg-chip-gold text-chip-gold-ink",
        gray: "bg-chip-gray text-chip-gray-ink",
        purple: "bg-chip-purple text-chip-purple-ink",
        green: "bg-chip-green text-chip-green-ink",
        red: "bg-chip-red text-chip-red-ink",
        /** Parsed tags from "isi akun", game abbreviations. */
        tag: "bg-track font-semibold text-ink-tag",
      },
    },
    defaultVariants: { tone: "tag" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function Badge({
  className,
  tone,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

const STATUS_TONE: Record<AccountStatus, BadgeTone> = {
  "Belum Sold": "teal",
  Hold: "gold",
  "Belum Post": "gray",
  Update: "purple",
  Sold: "green",
  HB: "red",
};

/** Colored chip that always carries the status text, so meaning never depends on color alone. */
export function StatusChip({ status, className }: { status: AccountStatus; className?: string }) {
  return (
    <Badge tone={STATUS_TONE[status]} className={className}>
      {status}
    </Badge>
  );
}

const QUADRANT_TONE: Record<Quadrant, BadgeTone> = {
  agresif: "green",
  kecil: "teal",
  selektif: "gold",
  tahan: "red",
};

export function QuadrantChip({ quadrant, className }: { quadrant: Quadrant; className?: string }) {
  return (
    <Badge tone={QUADRANT_TONE[quadrant]} className={className}>
      {QUADRANT_LABEL[quadrant]}
    </Badge>
  );
}

/** Rounded-square game abbreviation (AV, VBL) shown at the start of stock rows. */
export function GameMark({ abbr, className }: { abbr: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-md bg-track text-2xs font-extrabold text-ink-tag",
        className,
      )}
    >
      {abbr}
    </span>
  );
}
