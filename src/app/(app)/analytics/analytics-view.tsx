import Link from "next/link";
import { PageShell } from "@/components/app/page-shell";
import { Amount } from "@/components/ui/amount";
import { Badge, QuadrantChip } from "@/components/ui/badge";
import { Card, EmptyState, Meter, PageHeader } from "@/components/ui/card";
import { DividedList } from "@/components/ui/list";
import { TBody, Td, TFoot, TfCell, Th, THead, Table, Tr } from "@/components/ui/table";
import {
  buildWarnings,
  gameInsights,
  restockBudget,
  variantStats,
  weeklySeries,
  type GameInsight,
  type Warning,
} from "@/lib/analytics";
import { hargaBeliMaks, ratesFrom, sum, type Rates } from "@/lib/calc";
import { mondayOf } from "@/lib/dates";
import type { AccountRow, Game, GamePerformance, Settings, WeeklyReport, Withdrawal } from "@/lib/db-types";
import { formatIdrCompact, formatPercent, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RestockMap } from "./restock-map";
import { WeeklyChart } from "./weekly-chart";

export type AnalyticsData = {
  settings: Settings;
  weekly: WeeklyReport[];
  perf: GamePerformance[];
  accounts: AccountRow[];
  games: Game[];
  withdrawals: Withdrawal[];
  today: string;
};

export function AnalyticsView({ settings, weekly, perf, accounts, games, withdrawals, today }: AnalyticsData) {
  const monday = mondayOf(today);
  const rates = ratesFrom(settings);
  const budget = restockBudget(weekly, monday, settings.porsi_reinvest_pct);
  const insights = gameInsights({ perf, games, accounts, settings, rates, budget: budget.budget });
  const warnings = buildWarnings({ accounts, perf, withdrawals, settings, today });

  const totalTertahan = sum(perf.map((p) => p.modal_tertahan));
  const totalAktif = sum(perf.map((p) => p.stok_aktif));
  const terbesar = [...insights].sort((a, b) => b.modalShare - a.modalShare)[0];
  const dataKurang = insights.filter((g) => !g.dataCukup).map((g) => g.perf.nama);

  return (
    <PageShell>
      <PageHeader title="Analytics" subtitle="Minggu dihitung Senin sampai Minggu (WIB)" className="lg:[&_h1]:text-5xl" />

      <WeeklyChart
        series={weeklySeries(weekly, monday, 26)}
        budget={{ ...budget, porsiPct: settings.porsi_reinvest_pct }}
        modal={{
          total: totalTertahan,
          akun: totalAktif,
          caption:
            totalAktif > 0 && terbesar
              ? `${totalAktif} akun aktif, ${formatPercent(terbesar.modalShare)} di ${terbesar.perf.nama}`
              : `${totalAktif} akun aktif`,
        }}
      />

      <RestockSection insights={insights} settings={settings} budget={budget.budget} dataKurang={dataKurang} />

      <div className="grid items-start gap-5.5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-7">
        <Card aria-labelledby="peta-judul" className="hidden flex-col gap-3.5 lg:flex lg:px-6 lg:pt-5.5 lg:pb-6">
          <div className="flex flex-col gap-0.5">
            <h2 id="peta-judul" className="text-lg font-bold">
              Peta restock
            </h2>
            <span className="text-sm text-ink-muted">Kanan atas = cepat laku dan untung besar per akun</span>
          </div>
          <RestockMap
            points={insights
              .filter((g) => g.lakuPct !== null && g.labaPerAkun !== null)
              .map((g) => ({
                nama: g.perf.nama,
                lakuPct: g.lakuPct!,
                labaPerAkun: g.labaPerAkun!,
                quadrant: g.quadrant!,
              }))}
            batasLakuPct={settings.batas_laku_pct}
            batasLaba={settings.batas_laba_idr}
          />
          <span className="text-sm text-ink-muted">
            Sumbu datar: % akun laku. Sumbu tegak: laba rata-rata per akun terjual.
          </span>
        </Card>

        <section aria-labelledby="tertahan-judul" className="flex flex-col gap-1.5 lg:hidden">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <h2 id="tertahan-judul" className="text-md font-bold">
              Modal tertahan di stok
            </h2>
            <span className="text-lg font-bold">{formatIdrCompact(totalTertahan)}</span>
          </div>
          <DividedList>
            {[...insights]
              .filter((g) => g.perf.modal_tertahan > 0)
              .sort((a, b) => b.perf.modal_tertahan - a.perf.modal_tertahan)
              .map((g) => (
                <li key={g.perf.game_id} className="flex flex-col gap-2 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-base font-semibold">{g.perf.nama}</span>
                    <span className="text-sm">
                      <span className={cn("font-bold", g.modalShare * 100 > settings.batas_modal_tertahan_pct && "text-loss")}>
                        {formatIdrCompact(g.perf.modal_tertahan)}
                      </span>
                      <span className="text-ink-muted"> {g.perf.stok_aktif} akun</span>
                    </span>
                  </div>
                  <Meter
                    value={g.modalShare}
                    tone={g.modalShare * 100 > settings.batas_modal_tertahan_pct ? "loss" : "neutral"}
                    label={`${g.perf.nama} ${formatPercent(g.modalShare)} dari modal stok`}
                  />
                </li>
              ))}
          </DividedList>
        </section>

        <WarningsCard warnings={warnings} />
      </div>

      <VariantSection games={games} accounts={accounts} rates={rates} settings={settings} />

      <GameTable insights={insights} />
    </PageShell>
  );
}

function RestockSection({
  insights,
  settings,
  budget,
  dataKurang,
}: {
  insights: GameInsight[];
  settings: Settings;
  budget: number;
  dataKurang: string[];
}) {
  const batasText = `Batas kuadran: laku ${settings.batas_laku_pct}% dan laba ${formatIdrCompact(settings.batas_laba_idr)} per akun`;
  return (
    <Card aria-labelledby="restock-judul" className="flex flex-col gap-2.5 max-lg:bg-transparent max-lg:p-0 lg:px-6 lg:py-5.5">
      <h2 id="restock-judul" className="text-md font-bold lg:text-lg">
        Saran restock per game
      </h2>
      {insights.length === 0 ? (
        <EmptyState>Belum ada data stok untuk dianalisis.</EmptyState>
      ) : (
        <>
          {/* Phone */}
          <div className="flex items-center justify-between gap-3 rounded-xl bg-surface p-3.5 lg:hidden">
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold">Budget restock</span>
              <span className="text-xs text-ink-muted">
                {settings.porsi_reinvest_pct}% dari rata-rata laba 4 minggu terakhir
              </span>
            </span>
            <span className="text-xl font-extrabold">{formatIdrCompact(budget)}</span>
          </div>
          <DividedList className="lg:hidden">
            {insights.map((g) => (
              <li key={g.perf.game_id} className="flex items-start justify-between gap-3 py-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold">{g.perf.nama}</span>
                    {g.quadrant && <QuadrantChip quadrant={g.quadrant} />}
                  </div>
                  <span className="text-xs text-ink-muted">
                    {g.lakuPct !== null ? `${formatPercent(g.lakuPct)} laku` : "belum ada yang laku"}
                    {g.labaPerAkun !== null && `, laba rata-rata ${formatIdrCompact(g.labaPerAkun)} per akun`}
                    {!g.dataCukup && `, baru ${g.perf.akun_total} akun`}
                  </span>
                  <span className="text-sm font-semibold">{g.saran}</span>
                </div>
                {g.budget > 0 && <span className="shrink-0 text-base font-extrabold">{formatIdrCompact(g.budget)}</span>}
              </li>
            ))}
          </DividedList>
          <p className="text-xs text-ink-muted lg:hidden">
            {batasText}.{dataKurang.length > 0 && ` ${dataKurang.join(", ")} masih di bawah ${settings.min_akun_data} akun.`}
          </p>

          {/* Desktop */}
          <Table className="hidden table-fixed lg:table">
            <THead>
              <Tr>
                <Th className="w-[15%]">Game</Th>
                <Th className="w-[14%]">Kuadran</Th>
                <Th className="w-[7%] text-right">% laku</Th>
                <Th className="w-[10%] text-right">Laba per akun</Th>
                <Th className="w-[7%] text-right">Stok aktif</Th>
                <Th className="w-[10%] text-right">Modal tertahan</Th>
                <Th className="pl-3">Saran</Th>
                <Th className="w-[9%] pr-0 text-right">Budget</Th>
              </Tr>
            </THead>
            <TBody>
              {insights.map((g) => (
                <Tr key={g.perf.game_id} className="align-middle">
                  <Th scope="row">
                    {g.perf.nama}
                    {!g.dataCukup && <span className="block text-xs font-medium text-ink-muted">baru {g.perf.akun_total} akun</span>}
                  </Th>
                  <Td>{g.quadrant ? <QuadrantChip quadrant={g.quadrant} /> : <span className="text-ink-muted">—</span>}</Td>
                  <Td className="text-right">{g.lakuPct !== null ? formatPercent(g.lakuPct) : "—"}</Td>
                  <Td className="text-right font-bold">{g.labaPerAkun !== null ? formatIdrCompact(g.labaPerAkun) : "—"}</Td>
                  <Td className="text-right">{g.perf.stok_aktif}</Td>
                  <Td
                    className={cn(
                      "text-right",
                      g.modalShare * 100 > settings.batas_modal_tertahan_pct && "font-bold text-loss",
                    )}
                  >
                    {formatIdrCompact(g.perf.modal_tertahan)}
                  </Td>
                  <Td className="pl-3 font-semibold">{g.saran}</Td>
                  <Td className={cn("pr-0 text-right", g.budget > 0 ? "font-extrabold" : "text-ink-muted")}>
                    {g.budget > 0 ? formatIdrCompact(g.budget) : "—"}
                  </Td>
                </Tr>
              ))}
            </TBody>
            <TFoot>
              <Tr>
                <Th scope="row" colSpan={4} className="border-0 pt-3.5">
                  Total
                </Th>
                <TfCell className="text-right">{sum(insights.map((g) => g.perf.stok_aktif))}</TfCell>
                <TfCell className="text-right">{formatIdrCompact(sum(insights.map((g) => g.perf.modal_tertahan)))}</TfCell>
                <TfCell className="pl-3 text-sm font-normal text-ink-muted">{batasText}</TfCell>
                <TfCell className="pr-0 text-right font-extrabold">{formatIdrCompact(budget)}</TfCell>
              </Tr>
            </TFoot>
          </Table>
        </>
      )}
    </Card>
  );
}

const DOT: Record<Warning["tone"], string> = {
  warn: "bg-warn",
  loss: "bg-loss",
  muted: "bg-ink-subtle",
};

function WarningsCard({ warnings }: { warnings: Warning[] }) {
  return (
    <Card aria-labelledby="peringatan-judul" className="flex flex-col gap-1.5 max-lg:bg-transparent max-lg:p-0 lg:px-6 lg:py-5.5">
      <h2 id="peringatan-judul" className="mb-1.5 text-md font-bold lg:text-lg">
        Peringatan
      </h2>
      {warnings.length === 0 ? (
        <p className="py-2 text-sm text-ink-muted">Tidak ada yang perlu dicek. Stok dan penarikan rapi.</p>
      ) : (
        <ul className="flex flex-col">
          {warnings.map((w) => (
            <li key={w.id} className="border-t border-divider">
              <Link href={w.href} className="flex items-start gap-3 py-3 text-ink no-underline hover:text-ink">
                <span aria-hidden className={cn("mt-1.25 size-2.5 shrink-0 rounded-full", DOT[w.tone])} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-base font-semibold">{w.title}</span>
                  <span className="text-sm text-ink-muted">{w.detail}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href="/stok" className="flex min-h-tap items-center text-base font-bold no-underline">
        Buka stok untuk merapikan
      </Link>
    </Card>
  );
}

function VariantSection({
  games,
  accounts,
  rates,
  settings,
}: {
  games: Game[];
  accounts: AccountRow[];
  rates: Rates;
  settings: Settings;
}) {
  const perGame = games
    .filter((g) => g.satuan_varian)
    .map((g) => ({ game: g, stats: variantStats(accounts, g.id) }))
    .filter((x) => x.stats.length > 0);
  if (perGame.length === 0) return null;

  return (
    <Card aria-labelledby="varian-judul" className="flex flex-col gap-3 max-lg:bg-transparent max-lg:p-0 lg:px-6 lg:py-5.5">
      <div className="flex flex-col gap-0.5">
        <h2 id="varian-judul" className="text-md font-bold lg:text-lg">
          Kinerja per varian
        </h2>
        <span className="text-sm text-ink-muted">
          Batas beli = median harga jual × {100 - rates.adminPct}% × {100 - rates.potonganTarikPct}% × kurs, dibagi (1 + target
          laba {settings.target_margin_pct}%)
        </span>
      </div>
      {perGame.map(({ game, stats }) => (
        <div key={game.id} className="flex flex-col gap-1">
          <h3 className="text-base font-bold">{game.nama}</h3>
          <Table>
            <THead>
              <Tr>
                <Th>Varian</Th>
                <Th className="text-right">Laku</Th>
                <Th className="text-right">Laba rata-rata</Th>
                <Th className="text-right">Median jual</Th>
                <Th className="pr-0 text-right">Batas beli</Th>
              </Tr>
            </THead>
            <TBody>
              {stats.map((v) => (
                <Tr key={v.band}>
                  <Th scope="row" className="whitespace-nowrap">
                    {v.band} {game.satuan_varian}
                  </Th>
                  <Td className="text-right whitespace-nowrap">
                    {v.terjual} dari {v.terjual + v.stokAktif}
                    {v.lakuPct !== null && <span className="text-ink-muted"> ({formatPercent(v.lakuPct)})</span>}
                  </Td>
                  <Td className="text-right">
                    {v.labaRata !== null ? <Amount currency="idr" tone="profit" compact value={v.labaRata} /> : "—"}
                  </Td>
                  <Td className="text-right">{v.medianJual !== null ? <Amount currency="usd" value={v.medianJual} /> : "—"}</Td>
                  <Td className="pr-0 text-right font-bold">
                    {v.medianJual !== null && v.terjual >= 3
                      ? formatIdrCompact(hargaBeliMaks(v.medianJual, rates, settings.target_margin_pct))
                      : <Badge tone="gray">data kurang</Badge>}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
      ))}
    </Card>
  );
}

function GameTable({ insights }: { insights: GameInsight[] }) {
  if (insights.length === 0) return null;
  const rows = [...insights].sort((a, b) => b.perf.laba_total - a.perf.laba_total);
  return (
    <Card aria-labelledby="kinerja-judul" className="flex flex-col gap-2.5 max-lg:bg-transparent max-lg:p-0 lg:px-6 lg:py-5.5">
      <h2 id="kinerja-judul" className="text-md font-bold lg:text-lg">
        Kinerja per game
      </h2>
      <Table>
        <THead>
          <Tr>
            <Th>Game</Th>
            <Th className="text-right">Akun</Th>
            <Th className="text-right">Terjual</Th>
            <Th className="text-right">Rata-rata jual</Th>
            <Th className="text-right">Laba</Th>
            <Th className="text-right">ROI</Th>
            <Th className="text-right">Hari sampai laku</Th>
            <Th className="pr-0 text-right">HB</Th>
          </Tr>
        </THead>
        <TBody>
          {rows.map((g) => (
            <Tr key={g.perf.game_id}>
              <Th scope="row" className="whitespace-nowrap">
                {g.perf.nama}
              </Th>
              <Td className="text-right">{g.perf.akun_total}</Td>
              <Td className="text-right">{g.perf.akun_terjual}</Td>
              <Td className="text-right">{g.perf.rata_jual_usd !== null ? formatUsd(g.perf.rata_jual_usd) : "—"}</Td>
              <Td className="text-right font-bold">
                <Amount currency="idr" tone="profit" compact value={g.perf.laba_total} />
              </Td>
              <Td className="text-right">{g.roi !== null ? formatPercent(g.roi) : "—"}</Td>
              <Td className="text-right">
                {g.perf.median_hari_laku !== null ? `${Math.round(g.perf.median_hari_laku)} hari` : "—"}
              </Td>
              <Td className={cn("pr-0 text-right whitespace-nowrap", g.perf.akun_hb > 0 && "text-loss")}>
                {g.perf.akun_hb > 0 ? `${g.perf.akun_hb} (${formatIdrCompact(g.perf.rugi_hb)})` : "0"}
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
      <p className="text-xs text-ink-muted">
        ROI = laba ÷ modal akun terjual; akun hasil grind (modal Rp0) ikut menaikkan ROI. Hari sampai laku butuh tanggal beli
        dan tanggal terjual.
      </p>
    </Card>
  );
}
