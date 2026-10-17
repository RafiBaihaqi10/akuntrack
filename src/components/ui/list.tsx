import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Plain list with hairline separators between and around items. */
export function DividedList({ className, ...props }: ComponentProps<"ul">) {
  return (
    <ul
      className={cn("flex flex-col border-b border-divider [&>li]:border-t [&>li]:border-divider", className)}
      {...props}
    />
  );
}

type IconTone = "gold" | "red" | "teal" | "green" | "gray";

const ICON_TONE: Record<IconTone, string> = {
  gold: "bg-chip-gold text-chip-gold-ink",
  red: "bg-chip-red text-chip-red-ink",
  teal: "bg-chip-teal text-chip-teal-ink",
  green: "bg-chip-green text-chip-green-ink",
  gray: "bg-chip-gray text-chip-gray-ink",
};

/** 36px tinted circle holding an icon. */
export function IconCircle({ tone, children }: { tone: IconTone; children: ReactNode }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full [&_svg]:size-4.5",
        ICON_TONE[tone],
      )}
    >
      {children}
    </span>
  );
}

type LinkRowProps = {
  href: string;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  /** Trailing text (desktop "Buka stok") instead of the chevron. */
  trailing?: ReactNode;
};

/** Tappable row: icon, title, description, chevron ("Perlu dicek", Pengaturan › Lainnya). */
export function LinkRow({ href, title, description, icon, trailing }: LinkRowProps) {
  return (
    <Link
      href={href}
      className="flex min-h-15 items-center gap-3 py-2.5 text-ink no-underline hover:text-ink"
    >
      {icon}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-base font-semibold">{title}</span>
        {description && <span className="text-xs text-ink-muted">{description}</span>}
      </span>
      {trailing ? (
        <span className="text-sm font-semibold text-teal">{trailing}</span>
      ) : (
        <ChevronRight aria-hidden className="size-4.5 shrink-0 text-ink-muted" strokeWidth={1.9} />
      )}
    </Link>
  );
}
