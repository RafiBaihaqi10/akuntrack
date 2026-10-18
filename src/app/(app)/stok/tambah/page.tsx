import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app/page-shell";
import { soldSamples } from "@/lib/analytics";
import { ratesFrom } from "@/lib/calc";
import { getAccounts, getGames, getSettings, getStores } from "@/lib/data/queries";
import { todayWib } from "@/lib/dates";
import { AddStockForm, type ExistingUsername } from "./add-stock-form";

export const metadata: Metadata = { title: "Tambah stok · AkunTrack" };

export default function TambahStokPage() {
  return (
    <Suspense fallback={<PageSkeleton title="Tambah stok" />}>
      <TambahStokContent />
    </Suspense>
  );
}

async function TambahStokContent() {
  const [accounts, games, stores, settings] = await Promise.all([
    getAccounts(),
    getGames(),
    getStores(),
    getSettings(),
  ]);
  const usernames: ExistingUsername[] = accounts
    .filter((a) => a.username)
    .map((a) => ({ game_id: a.game_id, username: a.username!.toLowerCase(), kode: a.kode }));
  return (
    <AddStockForm
      games={games.filter((g) => g.aktif)}
      stores={stores.filter((s) => s.aktif)}
      rates={ratesFrom(settings)}
      targetMarginPct={settings.target_margin_pct}
      holdDefaultHari={settings.hold_default_hari}
      samples={soldSamples(accounts)}
      usernames={usernames}
      today={todayWib()}
    />
  );
}
