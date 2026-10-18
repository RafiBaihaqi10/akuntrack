import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app/page-shell";
import { ratesFrom } from "@/lib/calc";
import { getAdjustments, getSettings, getStoreBalances, getStores, getWithdrawals } from "@/lib/data/queries";
import { todayWib } from "@/lib/dates";
import { BalanceView } from "./balance-view";

export const metadata: Metadata = { title: "Balance · AkunTrack" };

export default function BalancePage() {
  return (
    <Suspense fallback={<PageSkeleton title="Balance" />}>
      <BalanceContent />
    </Suspense>
  );
}

async function BalanceContent() {
  const [balances, stores, withdrawals, adjustments, settings] = await Promise.all([
    getStoreBalances(),
    getStores(),
    getWithdrawals(),
    getAdjustments(),
    getSettings(),
  ]);
  const order = new Map(stores.map((s, i) => [s.id, i]));
  return (
    <BalanceView
      balances={[...balances].sort((a, b) => (order.get(a.store_id) ?? 0) - (order.get(b.store_id) ?? 0))}
      stores={stores}
      withdrawals={withdrawals}
      adjustments={adjustments}
      rates={ratesFrom(settings)}
      today={todayWib()}
    />
  );
}
