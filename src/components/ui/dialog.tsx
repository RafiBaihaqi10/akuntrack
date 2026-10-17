"use client";

import { X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Placement =
  /** Centered modal. */
  | "center"
  /** Slides up from the bottom (mobile forms such as Catat penarikan). */
  | "sheet"
  /** Right-hand panel over the page (desktop Tandai terjual). */
  | "side"
  /** Bottom sheet on phones, right panel from the lg breakpoint. */
  | "responsive";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  placement?: Placement;
  /** Sticky bottom area for the primary action. */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
};

const CONTENT: Record<Placement, string> = {
  center:
    "top-1/2 left-1/2 w-[calc(100%-2*var(--spacing-gutter))] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl max-h-[calc(100dvh-4rem)]",
  sheet: "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl",
  side: "inset-y-0 right-0 w-full max-w-[480px]",
  responsive:
    "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl lg:inset-x-auto lg:inset-y-0 lg:right-0 lg:max-h-none lg:w-full lg:max-w-[480px] lg:rounded-none",
};

/** Accessible modal surface (focus trap, Esc, scroll lock) in three placements. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  placement = "responsive",
  footer,
  children,
  className,
}: DialogProps) {
  const hasHandle = placement === "sheet" || placement === "responsive";
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-overlay" />
        <D.Content
          className={cn(
            "fixed z-50 flex flex-col bg-surface text-ink shadow-panel outline-none",
            CONTENT[placement],
            className,
          )}
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          {hasHandle && (
            <span
              aria-hidden
              className={cn(
                "mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-xs bg-line",
                placement === "responsive" && "lg:hidden",
              )}
            />
          )}
          <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-3 pb-2 lg:border-b lg:border-divider lg:py-4">
            <div className="flex min-w-0 flex-col gap-0.5">
              <D.Title className="text-xl font-extrabold tracking-tight">{title}</D.Title>
              {description && <D.Description className="text-sm text-ink-muted">{description}</D.Description>}
            </div>
            <D.Close
              aria-label="Tutup"
              className="inline-flex size-tap shrink-0 items-center justify-center rounded-full text-ink hover:bg-track"
            >
              <X className="size-5" strokeWidth={1.9} />
            </D.Close>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pt-2 pb-5">{children}</div>
          {footer && (
            <div className="shrink-0 border-t border-divider bg-surface px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          )}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
