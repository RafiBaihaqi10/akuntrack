import { Package, Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { BottomNav, SidebarNav, SidebarSettingsLink } from "@/components/app/nav";
import { ToastProvider } from "@/components/ui/toast";

/** Signed-in frame: sidebar from the lg breakpoint, bottom nav on phones. */
export function AppFrame({
  kurs,
  children,
  hideBottomNav,
}: {
  kurs: ReactNode;
  children: ReactNode;
  /** Only for previews; real routes decide this from the pathname. */
  hideBottomNav?: boolean;
}) {
  return (
    <ToastProvider>
      <div className="flex min-h-dvh flex-1 flex-col lg:grid lg:grid-cols-[var(--spacing-sidebar)_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-dvh flex-col gap-5.5 overflow-y-auto border-r border-divider bg-surface px-4 py-6 lg:flex">
          <div className="flex items-center gap-2.5 px-2">
            <span aria-hidden className="flex size-8.5 shrink-0 items-center justify-center rounded-md bg-ink text-gold">
              <Package className="size-4.5" strokeWidth={1.9} />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-md font-extrabold">AkunTrack</span>
              <span className="text-xs text-ink-muted">Toko Zeron dan Realm</span>
            </span>
          </div>
          <Link
            href="/stok/tambah"
            className="flex h-tap items-center justify-center gap-2 rounded-lg bg-gold text-base font-extrabold text-ink no-underline hover:text-ink hover:brightness-95"
          >
            <Plus aria-hidden className="size-4.5" strokeWidth={2.2} />
            Tambah stok
          </Link>
          <SidebarNav />
          <div className="mt-auto flex flex-col gap-2.5">
            {kurs}
            <SidebarSettingsLink />
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
      {!hideBottomNav && <BottomNav />}
    </ToastProvider>
  );
}
