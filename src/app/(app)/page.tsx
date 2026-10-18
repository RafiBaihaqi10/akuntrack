import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app/page-shell";
import {
  getAccounts,
  getGamePerformance,
  getSettings,
  getStoreBalances,
  getWeeklyReport,
  getWithdrawals,
} from "@/lib/data/queries";
import { todayWib } from "@/lib/dates";
import { BerandaView } from "./beranda-view";

export const metadata: Metadata = { title: "Beranda · AkunTrack" };

export default function BerandaPage() {
  return (
    <Suspense fallback={<PageSkeleton title="Minggu ini" />}>
      <Beranda />
    </Suspense>
  );
}

async function Beranda() {
  const [settings, weekly, balances, accounts, perf, withdrawals] = await Promise.all([
    getSettings(),
    getWeeklyReport(),
    getStoreBalances(),
    getAccounts(),
    getGamePerformance(),
    getWithdrawals(),
  ]);
  return (
    <BerandaView
      settings={settings}
      weekly={weekly}
      balances={balances}
      accounts={accounts}
      perf={perf}
      withdrawals={withdrawals}
      today={todayWib()}
      now={new Date().toISOString()}
    />
  );
}
