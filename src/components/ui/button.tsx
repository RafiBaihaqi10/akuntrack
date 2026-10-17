import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 font-bold whitespace-nowrap no-underline transition-colors select-none disabled:cursor-not-allowed [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /** The single gold action per screen. */
        primary:
          "bg-gold text-ink hover:text-ink hover:brightness-95 disabled:bg-disabled disabled:text-ink-muted disabled:hover:brightness-100",
        /** Bordered secondary action on canvas or surface. */
        secondary:
          "border border-line bg-surface text-ink hover:bg-field hover:text-ink disabled:text-ink-faint",
        /** Bordered action on a surface, such as the row-level "Terjual" pill. */
        outline:
          "border border-line bg-field text-ink hover:bg-canvas hover:text-ink disabled:text-ink-faint",
        /** Text-only action. */
        ghost: "text-ink-muted hover:bg-track hover:text-ink",
        /** Teal text link styled as a button with a full tap area. */
        link: "px-0 font-semibold text-teal hover:text-teal-hover",
      },
      size: {
        /** Primary action bar: 52px, full width. */
        lg: "h-action w-full rounded-xl px-5 text-md",
        /** Default control height. */
        md: "h-control rounded-lg px-4 text-base",
        /** Compact pill for table rows; keeps a 44px tap target. */
        sm: "h-tap rounded-full px-4 text-sm",
      },
    },
    compoundVariants: [{ variant: "link", className: "h-tap px-0" }],
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Render the child element (e.g. a Next <Link>) with button styles. */
    asChild?: boolean;
  };

export function Button({ className, variant, size, asChild, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

type IconButtonProps = ComponentProps<"button"> & {
  /** Required: icon-only buttons need an accessible name. */
  "aria-label": string;
  bordered?: boolean;
  asChild?: boolean;
};

/** 44px round icon button (settings, close, back). */
export function IconButton({ className, bordered, asChild, type, ...props }: IconButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      type={asChild ? undefined : (type ?? "button")}
      className={cn(
        "inline-flex size-tap shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-track hover:text-ink",
        bordered && "border border-line",
        className,
      )}
      {...props}
    />
  );
}

export { buttonVariants };
