"use client";

import { useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import { undoStatus } from "@/lib/data/actions";

/** Toast after a status change with an "Urungkan" action that restores the previous status. */
export function useUndoToast() {
  const toast = useToast();
  return useCallback(
    (accountId: string, title: string, description?: string) => {
      toast({
        title,
        description,
        action: {
          label: "Urungkan",
          onClick: async () => {
            const res = await undoStatus(accountId);
            toast(
              res.ok
                ? { title: `Dikembalikan ke ${res.data.status}` }
                : { title: "Gagal mengurungkan", description: res.error, tone: "error" },
            );
          },
        },
      });
    },
    [toast],
  );
}
