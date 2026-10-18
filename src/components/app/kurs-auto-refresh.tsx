"use client";

import { useEffect } from "react";
import { refreshKursPasar } from "@/lib/data/actions";

const KEY = "akuntrack:kurs-dicek";

/**
 * Keeps kurs pasar fresh in automatic mode: once per browser session it asks
 * the server to refresh the market rate, which only fetches when the stored
 * rate is older than 12 hours.
 */
export function KursAutoRefresh({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    try {
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, "1");
    } catch {
      // Storage unavailable (private mode): still refresh, the server rate-limits it.
    }
    void refreshKursPasar();
  }, [enabled]);
  return null;
}
