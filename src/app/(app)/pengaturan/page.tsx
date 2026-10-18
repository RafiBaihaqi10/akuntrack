import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app/page-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { getGames, getSettings, getStores } from "@/lib/data/queries";
import { SettingsView } from "./settings-view";

export const metadata: Metadata = { title: "Pengaturan · AkunTrack" };

export default function PengaturanPage() {
  return (
    <Suspense fallback={<PageSkeleton title="Pengaturan" />}>
      <PengaturanContent />
    </Suspense>
  );
}

async function PengaturanContent() {
  const [user, settings, games, stores] = await Promise.all([getCurrentUser(), getSettings(), getGames(), getStores()]);
  return <SettingsView email={user.email} settings={settings} games={games} stores={stores} />;
}
