"use client";

import { useState } from "react";
import { TransferForm } from "@/app/(app)/balance/balance-view";
import { AccountDialog } from "@/components/features/account-dialog";
import { SaleDialog } from "@/components/features/sale-dialog";
import { Dialog } from "@/components/ui/dialog";
import type { Rates } from "@/lib/calc";
import type { AccountRow, Store, StoreBalance } from "@/lib/db-types";

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

/** Opens the "Pindah saldo" dialog on load. */
export function PreviewTransfer({ balances, today }: { balances: StoreBalance[]; today: string }) {
  const [open, setOpen] = useState(true);
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title="Pindah saldo antar toko"
      description="Tanpa potongan: saldo toko asal berkurang, toko tujuan bertambah dengan jumlah yang sama."
      placement="responsive"
    >
      {open && <TransferForm balances={balances} today={today} onDone={() => setOpen(false)} />}
    </Dialog>
  );
}
