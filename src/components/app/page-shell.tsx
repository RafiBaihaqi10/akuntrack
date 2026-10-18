import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Main content column: phone gutter and room for the fixed bottom nav,
 * wider desktop padding next to the sidebar.
 */
export function PageShell({
  children,
  className,
  /** Screens with their own bottom action bar (Tambah stok) skip the nav space. */
  bare,
}: {
  children: ReactNode;
  className?: string;
  bare?: boolean;
}) {
  return (
    <main
      className={cn(
        "flex w-full min-w-0 flex-1 flex-col gap-5.5 px-gutter pt-5 lg:gap-7 lg:px-10 lg:pt-8 lg:pb-12",
        bare ? "pb-6" : "pb-28",
        className,
      )}
    >
      {children}
    </main>
  );
}

/** Placeholder blocks shown while a page's data streams in. */
export function PageSkeleton({ title }: { title: string }) {
  return (
    <PageShell>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight lg:text-4xl">{title}</h1>
        <span className="h-4.5 w-48 animate-pulse rounded-xs bg-track" />
      </div>
      <div aria-hidden className="flex flex-col gap-4">
        <span className="h-48 animate-pulse rounded-2xl bg-surface" />
        <span className="h-24 animate-pulse rounded-2xl bg-surface" />
        <span className="h-24 animate-pulse rounded-2xl bg-surface" />
      </div>
      <p className="sr-only" role="status">
        Memuat {title.toLowerCase()}…
      </p>
    </PageShell>
  );
}
