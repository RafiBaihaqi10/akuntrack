import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app/page-shell";
import { ratesFrom } from "@/lib/calc";
import { getAccounts, getGames, getSettings, getStores } from "@/lib/data/queries";
import { todayWib } from "@/lib/dates";
import { StockView, type StockFilters } from "./stock-view";

export const metadata: Metadata = { title: "Stok · AkunTrack" };

export default function StokPage({ searchParams }: PageProps<"/stok">) {
  return (
    <Suspense fallback={<PageSkeleton title="Stok" />}>
      <StokContent searchParams={searchParams} />
    </Suspense>
  );
}

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

async function StokContent({ searchParams }: Pick<PageProps<"/stok">, "searchParams">) {
  const [params, accounts, games, stores, settings] = await Promise.all([
    searchParams,
    getAccounts(),
    getGames(),
    getStores(),
    getSettings(),
  ]);
  const initial: StockFilters = {
    status: one(params.status) ?? "aktif",
    cek: one(params.cek) ?? null,
    game: one(params.game) ?? "",
    q: one(params.q) ?? "",
  };
  return (
    <StockView
      // A new link from "Perlu dicek" resets the filters; refreshes after edits keep them.
      key={JSON.stringify(initial)}
      accounts={accounts}
      games={games}
      stores={stores}
      rates={ratesFrom(settings)}
      holdDefaultHari={settings.hold_default_hari}
      stokLamaHari={settings.stok_lama_hari}
      today={todayWib()}
      initial={initial}
    />
  );
}
