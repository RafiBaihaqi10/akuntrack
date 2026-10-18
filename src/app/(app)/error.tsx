"use client";

import { useEffect } from "react";
import { PageShell } from "@/components/app/page-shell";
import { Button } from "@/components/ui/button";

/** Shown when a page's data fails to load (e.g. Supabase unreachable). */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageShell>
      <div className="flex max-w-md flex-col gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight">Data belum bisa dimuat</h1>
        <p className="text-base text-ink-muted">
          Periksa koneksi internet, lalu coba lagi. Kalau masih gagal, mungkin Supabase sedang bermasalah.
        </p>
        <Button variant="primary" className="self-start" onClick={() => retry()}>
          Coba lagi
        </Button>
      </div>
    </PageShell>
  );
}
