"use client";

import { useState } from "react";
import { AccountDialog } from "@/components/features/account-dialog";
import { SaleDialog } from "@/components/features/sale-dialog";
import type { Rates } from "@/lib/calc";
import type { AccountRow, Store } from "@/lib/db-types";

/** Opens the sell or detail dialog on load so previews can capture them. */
export function PreviewDialogs({
  mode,
  account,
  stores,
  rates,
  today,
}: {
  mode: "terjual" | "detail";
  account: AccountRow;
  stores: Store[];
  rates: Rates;
  today: string;
}) {
  const [open, setOpen] = useState(true);
  return mode === "terjual" ? (
    <SaleDialog account={open ? account : null} stores={stores} rates={rates} today={today} onOpenChange={setOpen} />
  ) : (
    <AccountDialog
      account={open ? account : null}
      stores={stores}
      holdDefaultHari={7}
      today={today}
      onOpenChange={setOpen}
      onSell={() => setOpen(false)}
    />
  );
}
