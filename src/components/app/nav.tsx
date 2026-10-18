"use client";

import { ChartColumn, House, Package, Plus, SlidersHorizontal, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon };

const MAIN: NavItem[] = [
  { href: "/", label: "Beranda", icon: House },
  { href: "/stok", label: "Stok", icon: Package },
  { href: "/analytics", label: "Analytics", icon: ChartColumn },
  { href: "/balance", label: "Balance", icon: Wallet },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  // "Tambah stok" has its own entry point, so it does not light up "Stok".
  if (href === "/stok") return pathname === "/stok";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop sidebar menu. */
export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigasi utama">
      <ul className="flex flex-col gap-0.5">
        {MAIN.map((item) => (
          <li key={item.href}>
            <SidebarLink item={item} active={isActive(pathname, item.href)} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SidebarSettingsLink() {
  const pathname = usePathname();
  return (
    <SidebarLink
      item={{ href: "/pengaturan", label: "Pengaturan", icon: SlidersHorizontal }}
      active={isActive(pathname, "/pengaturan")}
    />
  );
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-tap items-center gap-3 rounded-md px-3 text-base no-underline transition-colors",
        active ? "bg-track font-bold text-ink hover:text-ink" : "font-medium text-ink-muted hover:bg-track/60 hover:text-ink",
      )}
    >
      <Icon aria-hidden className="size-5" strokeWidth={1.9} />
      <span>{item.label}</span>
    </Link>
  );
}

/** Screens that bring their own bottom action bar instead of the nav. */
const NO_BOTTOM_NAV = ["/stok/tambah"];

/** Phone bottom navigation with the gold "Tambah stok" button in the middle. */
export function BottomNav() {
  const pathname = usePathname();
  if (NO_BOTTOM_NAV.includes(pathname)) return null;
  const [beranda, stok, analytics, balance] = MAIN;
  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-30 flex items-end justify-around border-t border-divider bg-surface px-2 pt-1.5 pb-[max(1.125rem,env(safe-area-inset-bottom))] lg:hidden"
    >
      <BottomLink item={beranda} active={isActive(pathname, beranda.href)} />
      <BottomLink item={stok} active={isActive(pathname, stok.href)} />
      <Link
        href="/stok/tambah"
        aria-label="Tambah stok"
        className="mb-1.5 flex size-14.5 items-center justify-center rounded-full bg-gold text-ink no-underline shadow-fab hover:text-ink hover:brightness-95"
      >
        <Plus aria-hidden className="size-6.5" strokeWidth={2.2} />
      </Link>
      <BottomLink item={analytics} active={isActive(pathname, analytics.href)} />
      <BottomLink item={balance} active={isActive(pathname, balance.href)} />
    </nav>
  );
}

function BottomLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-12 min-w-15 flex-col items-center justify-center gap-0.75 text-2xs no-underline",
        active ? "font-bold text-ink hover:text-ink" : "font-medium text-ink-muted hover:text-ink",
      )}
    >
      <Icon aria-hidden className="size-5.5" strokeWidth={1.9} />
      <span>{item.label}</span>
    </Link>
  );
}
