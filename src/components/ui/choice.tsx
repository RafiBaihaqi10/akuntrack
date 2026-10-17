"use client";

import { ToggleGroup } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ChoiceOption<T extends string> = {
  value: T;
  label: ReactNode;
  /** Second line, e.g. "saldo $68,05". */
  description?: ReactNode;
  /** Count badge for filter chips. */
  count?: number;
  disabled?: boolean;
};

type BaseProps<T extends string> = {
  value: T;
  onValueChange: (value: T) => void;
  options: ChoiceOption<T>[];
  className?: string;
} & ({ "aria-label": string } | { "aria-labelledby": string });

/** Single-select ToggleGroup that never allows deselecting the active item. */
function useSingle<T extends string>(onValueChange: (v: T) => void) {
  return (v: string) => {
    if (v) onValueChange(v as T);
  };
}

/** Pill track with a raised active item: "Satu akun / Banyak sekaligus", "Otomatis / Atur sendiri". */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  className,
  ...aria
}: BaseProps<T>) {
  const onChange = useSingle(onValueChange);
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={onChange}
      className={cn("grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-track p-1", className)}
      {...aria}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className="min-h-tap rounded-md px-3 text-sm font-semibold text-ink-muted transition-colors data-[state=on]:bg-surface data-[state=on]:font-bold data-[state=on]:text-ink"
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

/** Side-by-side bordered buttons, active one filled dark: Beli / Grind, Zeron / Realm. */
export function ChoiceGroup<T extends string>({
  value,
  onValueChange,
  options,
  className,
  ...aria
}: BaseProps<T>) {
  const onChange = useSingle(onValueChange);
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={onChange}
      className={cn("grid auto-cols-fr grid-flow-col gap-2", className)}
      {...aria}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className={cn(
            "flex min-h-control flex-col items-center justify-center rounded-lg border border-line bg-field px-3 text-base font-semibold text-ink transition-colors",
            "data-[state=on]:border-ink data-[state=on]:bg-ink data-[state=on]:font-bold data-[state=on]:text-surface",
            "disabled:opacity-50",
          )}
        >
          <span>{o.label}</span>
          {o.description && <span className="text-xs font-medium opacity-80">{o.description}</span>}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

/** Horizontally scrollable status filter chips with counts. */
export function FilterChips<T extends string>({
  value,
  onValueChange,
  options,
  className,
  ...aria
}: BaseProps<T>) {
  const onChange = useSingle(onValueChange);
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={onChange}
      className={cn("-mx-gutter flex gap-2 overflow-x-auto px-gutter pb-1 lg:mx-0 lg:px-0", className)}
      {...aria}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className={cn(
            // 36px visual height; the ::after extends the hit area to 44px.
            "group relative flex h-9 shrink-0 items-center after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] gap-1.5 rounded-full border border-line bg-surface px-3.5 text-sm font-semibold whitespace-nowrap text-ink transition-colors",
            "data-[state=on]:border-ink data-[state=on]:bg-ink data-[state=on]:text-surface",
          )}
        >
          <span>{o.label}</span>
          {o.count !== undefined && (
            <span className="text-xs font-bold text-ink-muted group-data-[state=on]:text-surface">
              {o.count}
            </span>
          )}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
