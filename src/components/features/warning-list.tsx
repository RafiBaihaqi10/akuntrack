import { ChartPie, ChevronRight, CircleAlert, Clock, Package, TriangleAlert, Wallet } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { DividedList, IconCircle } from "@/components/ui/list";
import type { Warning } from "@/lib/analytics";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  title: string;
  detail: string;
  href: string;
  icon: ReactNode;
  tone: "gold" | "red" | "teal" | "gray";
  action: string;
};

function iconFor(w: Warning): Pick<Item, "icon" | "tone" | "action"> {
  if (w.id === "hold-lewat" || w.id === "stok-lama") return { icon: <Clock />, tone: "gold", action: "Buka stok" };
  if (w.id.startsWith("modal-")) return { icon: <ChartPie />, tone: "red", action: "Lihat saran" };
  if (w.id.startsWith("hb-")) return { icon: <TriangleAlert />, tone: "red", action: "Buka stok" };
  if (w.id === "tanpa-rupiah") return { icon: <Wallet />, tone: "gray", action: "Buka balance" };
  return { icon: <CircleAlert />, tone: w.tone === "muted" ? "gray" : "gold", action: "Buka stok" };
}

export function toItems(warnings: Warning[]): Item[] {
  return warnings.map((w) => ({ id: w.id, title: w.title, detail: w.detail, href: w.href, ...iconFor(w) }));
}

export function stockItem(count: number, modal: string): Item {
  return {
    id: "stok",
    title: `${count} akun di stok`,
    detail: `Modal tertahan ${modal}`,
    href: "/stok",
    icon: <Package />,
    tone: "teal",
    action: "Buka stok",
  };
}

/** "Perlu dicek" rows: chevron on phones, a text action on desktop. */
export function CheckList({ items, className }: { items: Item[]; className?: string }) {
  return (
    <DividedList className={className}>
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={item.href}
            className="flex min-h-15 items-center gap-3 py-2.5 text-ink no-underline hover:text-ink lg:gap-3.5"
          >
            <IconCircle tone={item.tone}>{item.icon}</IconCircle>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-base font-semibold">{item.title}</span>
              <span className="text-xs text-ink-muted lg:text-sm">{item.detail}</span>
            </span>
            <ChevronRight aria-hidden className="size-4.5 shrink-0 text-ink-muted lg:hidden" strokeWidth={1.9} />
            <span className={cn("hidden shrink-0 text-sm font-semibold text-teal lg:inline")}>{item.action}</span>
          </Link>
        </li>
      ))}
    </DividedList>
  );
}
