import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { AnalyticsView } from "@/app/(app)/analytics/analytics-view";
import { BalanceView } from "@/app/(app)/balance/balance-view";
import { BerandaView } from "@/app/(app)/beranda-view";
import { SettingsView } from "@/app/(app)/pengaturan/settings-view";
import { StockView } from "@/app/(app)/stok/stock-view";
import { AddStockForm } from "@/app/(app)/stok/tambah/add-stock-form";
import { AppFrame } from "@/components/app/app-frame";
import { soldSamples } from "@/lib/analytics";
import { ratesFrom } from "@/lib/calc";
import { todayWib } from "@/lib/dates";
import { formatIdr } from "@/lib/format";
import { PreviewDialogs, PreviewTransfer } from "../preview-dialogs";
import * as fx from "../fixtures";

export const metadata: Metadata = { title: "Pratinjau · AkunTrack" };

const SCREENS = ["beranda", "stok", "tambah", "terjual", "detail", "balance", "pindah", "analytics", "pengaturan"] as const;

export function generateStaticParams() {
  return SCREENS.map((layar) => ({ layar }));
}

/** Development-only: every screen rendered with sample data, for visual checks without logging in. */
export default function PratinjauPage({ params }: PageProps<"/dev/pratinjau/[layar]">) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense>
      <Screen params={params} />
    </Suspense>
  );
}

async function Screen({ params }: Pick<PageProps<"/dev/pratinjau/[layar]">, "params">) {
  const { layar } = await params;
  await connection();
  const today = todayWib();
  const accounts = fx.buildAccounts(today);
  const perf = fx.buildPerf(accounts);
  const weekly = fx.buildWeekly(today, accounts);
  const withdrawals = fx.buildWithdrawals(today);
  const rates = ratesFrom(fx.settings);
  const kurs = (
    <div className="flex flex-col gap-0.75 rounded-lg border border-divider p-3">
      <span className="text-xs text-ink-muted">Kurs Payoneer</span>
      <span className="text-md font-extrabold">{formatIdr(rates.kursPayoneer)} per dolar</span>
      <span className="text-xs text-ink-muted">Pasar Rp17.000 − Rp1.000. Admin 15%, tarik 4% + $2</span>
    </div>
  );

  let content: ReactNode;
  switch (layar) {
    case "beranda":
      content = (
        <BerandaView
          settings={fx.settings}
          weekly={weekly}
          balances={fx.balances}
          accounts={accounts}
          perf={perf}
          withdrawals={withdrawals}
          today={today}
          now={new Date().toISOString()}
        />
      );
      break;
    case "stok":
    case "terjual":
    case "detail":
      content = (
        <>
          <StockView
            accounts={accounts}
            games={fx.games}
            stores={fx.stores}
            rates={rates}
            holdDefaultHari={7}
            stokLamaHari={30}
            today={today}
            initial={{ status: "aktif", cek: null, game: "", q: "" }}
          />
          {layar !== "stok" && (
            <PreviewDialogs
              mode={layar}
              account={accounts[6]}
              stores={fx.stores}
              rates={rates}
              today={today}
            />
          )}
        </>
      );
      break;
    case "tambah":
      content = (
        <AddStockForm
          games={fx.games}
          stores={fx.stores}
          rates={rates}
          targetMarginPct={100}
          holdDefaultHari={7}
          samples={soldSamples(accounts)}
          usernames={accounts.filter((a) => a.username).map((a) => ({ game_id: a.game_id, username: a.username!.toLowerCase(), kode: a.kode }))}
          today={today}
        />
      );
      break;
    case "balance":
    case "pindah":
      content = (
        <>
          <BalanceView
            balances={fx.balances}
            stores={fx.stores}
            withdrawals={withdrawals}
            adjustments={fx.adjustments}
            rates={rates}
            today={today}
          />
          {layar === "pindah" && <PreviewTransfer balances={fx.balances} today={today} />}
        </>
      );
      break;
    case "analytics":
      content = (
        <AnalyticsView
          settings={fx.settings}
          weekly={weekly}
          perf={perf}
          accounts={accounts}
          games={fx.games}
          withdrawals={withdrawals}
          today={today}
        />
      );
      break;
    case "pengaturan":
      content = <SettingsView email="pemilik@contoh.id" settings={fx.settings} games={fx.games} stores={fx.stores} />;
      break;
    default:
      notFound();
  }

  return (
    <AppFrame kurs={kurs} hideBottomNav={layar === "tambah"}>
      {content}
    </AppFrame>
  );
}
