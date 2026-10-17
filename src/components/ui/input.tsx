import { ChevronDown } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Shared look for text-like controls. `invalid` turns the border red. */
export const controlClass =
  "w-full min-w-0 rounded-lg border border-line bg-field px-3 text-base text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-ink disabled:bg-disabled disabled:text-ink-muted aria-[invalid=true]:border-loss";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlClass, "h-control", className)} {...props} />;
}

export function Textarea({ className, rows = 2, ...props }: ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cn(controlClass, "resize-y py-3", className)} {...props} />;
}

/** Native select: best picker on phones, and keeps values to a fixed list. */
export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <select className={cn(controlClass, "h-control appearance-none pr-9 font-semibold")} {...props}>
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-muted"
        strokeWidth={2}
      />
    </div>
  );
}

type AffixInputProps = ComponentProps<"input"> & {
  prefix?: ReactNode;
  suffix?: ReactNode;
  /** Teal text for dollar amounts. */
  tone?: "default" | "usd";
  /** Larger, emphasized field for the key number on a screen (harga jual). */
  emphasis?: boolean;
};

/** Input with a fixed prefix/suffix such as `$`, `Rp` or `%`. */
export function AffixInput({
  prefix,
  suffix,
  tone = "default",
  emphasis,
  className,
  disabled,
  "aria-invalid": invalid,
  ...props
}: AffixInputProps) {
  const affixClass = cn("shrink-0 font-bold", tone === "usd" ? "text-teal" : "text-ink-muted");
  return (
    <div
      data-invalid={invalid ? "" : undefined}
      className={cn(
        "flex w-full min-w-0 items-center gap-2 rounded-lg border border-line bg-field px-3 transition-colors focus-within:border-ink data-invalid:border-loss",
        emphasis ? "h-16 rounded-xl border-[1.5px] border-ink text-3xl" : "h-control text-base",
        disabled && "bg-disabled",
        className,
      )}
    >
      {prefix && <span className={affixClass}>{prefix}</span>}
      <input
        disabled={disabled}
        aria-invalid={invalid}
        className={cn(
          "h-full w-full min-w-0 bg-transparent font-bold outline-none placeholder:font-medium placeholder:text-ink-faint disabled:text-ink-muted",
          tone === "usd" ? "text-teal" : "text-ink",
          emphasis && "font-extrabold tracking-tight",
        )}
        {...props}
      />
      {suffix && <span className={affixClass}>{suffix}</span>}
    </div>
  );
}
