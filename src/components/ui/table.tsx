import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Wide data table for desktop. Scrolls horizontally instead of breaking the page. */
export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full border-collapse text-left text-base", className)} {...props} />
    </div>
  );
}

export function THead(props: ComponentProps<"thead">) {
  return <thead {...props} />;
}

export function TBody(props: ComponentProps<"tbody">) {
  return <tbody {...props} />;
}

export function TFoot({ className, ...props }: ComponentProps<"tfoot">) {
  return <tfoot className={cn("font-bold", className)} {...props} />;
}

export function Tr({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("align-top", className)} {...props} />;
}

export function Th({ className, scope = "col", ...props }: ComponentProps<"th">) {
  const isHeader = scope === "col";
  return (
    <th
      scope={scope}
      className={cn(
        "py-3 pr-3 text-left",
        isHeader
          ? "border-b border-line text-xs font-semibold text-ink-muted"
          : "border-b border-divider font-bold",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("border-b border-divider py-3.5 pr-3", className)} {...props} />;
}

/** Footer cell without a rule. */
export function TfCell({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("pt-3.5 pr-3", className)} {...props} />;
}

/** Two-line cell content: primary text plus a muted second line. */
export function CellStack({ primary, secondary }: { primary: ReactNode; secondary?: ReactNode }) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="font-semibold">{primary}</span>
      {secondary && <span className="text-xs text-ink-muted">{secondary}</span>}
    </span>
  );
}
