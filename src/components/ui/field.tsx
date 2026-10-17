import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type FieldProps = {
  label: ReactNode;
  /** id of the control the label points to. */
  htmlFor?: string;
  /** Muted helper text under the control. */
  hint?: ReactNode;
  /** Error message; replaces the hint and is announced to screen readers. */
  error?: ReactNode;
  optional?: boolean;
  className?: string;
  children: ReactNode;
};

/** Label + control + hint/error stack used by every form input. */
export function Field({ label, htmlFor, hint, error, optional, className, children }: FieldProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {optional && <span className="font-medium text-ink-muted"> (opsional)</span>}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs font-semibold text-loss">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-ink-muted">{hint}</p>
      )}
    </div>
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-sm font-semibold text-ink", className)} {...props} />;
}

/** Label for a group of buttons (rendered as a span referenced by aria-labelledby). */
export function GroupLabel({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("text-sm font-semibold text-ink", className)} {...props} />;
}
