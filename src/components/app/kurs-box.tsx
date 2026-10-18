import Link from "next/link";
import { kursPayoneer } from "@/lib/calc";
import { getSettings } from "@/lib/data/queries";
import { formatIdr } from "@/lib/format";
import { KursAutoRefresh } from "./kurs-auto-refresh";

/** Sidebar card with the kurs Payoneer in use and a shortcut to change it. */
export async function KursBox() {
  const s = await getSettings();
  const kurs = kursPayoneer(s);
  const asal =
    s.mode_kurs === "otomatis"
      ? `Pasar ${formatIdr(s.kurs_pasar)} − ${formatIdr(s.selisih_payoneer)}.`
      : "Diatur sendiri.";
  return (
    <div className="flex flex-col gap-0.75 rounded-lg border border-divider p-3">
      <span className="text-xs text-ink-muted">Kurs Payoneer</span>
      <span className="text-md font-extrabold">{formatIdr(kurs)} per dolar</span>
      <span className="text-xs text-ink-muted">
        {asal} Admin {s.admin_pct}%, tarik {s.potongan_tarik_pct}% + ${s.potongan_tarik_usd}
      </span>
      <Link href="/pengaturan#kurs" className="mt-0.5 flex min-h-8 items-center text-sm font-bold no-underline">
        Ubah kurs
      </Link>
      <KursAutoRefresh enabled={s.mode_kurs === "otomatis"} />
    </div>
  );
}

export function KursBoxSkeleton() {
  return <div aria-hidden className="h-32 animate-pulse rounded-lg border border-divider" />;
}
