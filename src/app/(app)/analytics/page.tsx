import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app/page-shell";
import {
  getAccounts,
  getGamePerformance,
  getGames,
  getSettings,
  getWeeklyReport,
  getWithdrawals,
} from "@/lib/data/queries";
import { todayWib } from "@/lib/dates";
import { AnalyticsView } from "./analytics-view";

export const metadata: Metadata = { title: "Analytics · AkunTrack" };

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<PageSkeleton title="Analytics" />}>
      <Analytics />
    </Suspense>
  );
}

async function Analytics() {
  const [settings, weekly, perf, accounts, games, withdrawals] = await Promise.all([
    getSettings(),
    getWeeklyReport(),
    getGamePerformance(),
    getAccounts(),
    getGames(),
    getWithdrawals(),
  ]);
  return (
    <AnalyticsView
      settings={settings}
      weekly={weekly}
      perf={perf}
      accounts={accounts}
      games={games}
      withdrawals={withdrawals}
      today={todayWib()}
    />
  );
}
