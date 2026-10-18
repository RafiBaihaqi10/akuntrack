import { SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { PageShell } from "@/components/app/page-shell";
import { CheckList, stockItem, toItems } from "@/components/features/warning-list";
import { Amount } from "@/components/ui/amount";
import { StatusChip } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card, EmptyState, PageHeader, SectionHeader, StatTile } from "@/components/ui/card";
import { Receipt, ReceiptDivider, ReceiptRow, ReceiptRows, ReceiptTotal } from "@/components/ui/receipt";
import { CellStack, TBody, Td, TFoot, TfCell, Th, THead, Table, Tr } from "@/components/ui/table";
import { buildWarnings } from "@/lib/analytics";
import { ratesFrom, rupiahPerNetDollar, sum, withdrawalEstimate } from "@/lib/calc";
import { addDays, formatStampWib, formatWeekLong, mondayOf } from "@/lib/dates";
import type { AccountRow, GamePerformance, Settings, StoreBalance, WeeklyReport, Withdrawal } from "@/lib/db-types";
import { formatDateShort, formatIdr, formatIdrCompact, formatUsd } from "@/lib/format";

export type BerandaData = {
  settings: Settings;
  weekly: WeeklyReport[];
  balances: StoreBalance[];
  accounts: AccountRow[];
  perf: GamePerformance[];
  withdrawals: Withdrawal[];
  today: string;
  /** Render time, shown on the receipt. */
  now: string;
};

export function BerandaView({ settings, weekly, balances, accounts, perf, withdrawals, today, now }: BerandaData) {
  const monday = mondayOf(today);
  const sunday = addDays(monday, 6);
  const rates = ratesFrom(settings);
  const week = weekly.find((w) => w.minggu_mulai === monday);

  const net = week?.penjualan_net_usd ?? 0;
  const terjual = week?.akun_terjual ?? 0;
  const perDolar = net > 0 ? (week?.penjualan_idr ?? 0) / net : rupiahPerNetDollar(rates);
  const koreksi = week?.koreksi_penarikan ?? 0;
  const penarikan = week?.jumlah_penarikan ?? 0;
  const rugiHb = week?.rugi_hb ?? 0;

  const totalSaldo = sum(balances.map((b) => b.saldo_usd));
  const kiraRupiah = sum(balances.map((b) => (b.saldo_usd > 0 ? withdrawalEstimate(b.saldo_usd, rates) : 0)));

  const aktif = accounts.filter((a) => a.stok_aktif);
  const warnings = buildWarnings({ accounts, perf, withdrawals, settings, today });
  const cekItems = [
    ...toItems(warnings).slice(0, 3),
    stockItem(aktif.length, formatIdrCompact(sum(aktif.map((a) => a.harga_beli_idr)))),
  ];

  const inWeek = (d: string | null) => d !== null && d >= monday && d <= sunday;
  const soldThisWeek = accounts.filter((a) => a.status === "Sold" && inWeek(a.tanggal_terjual));
  const boughtThisWeek = accounts.filter((a) => inWeek(a.tanggal_beli));

  return (
    <PageShell>
      <div className="flex items-center justify-between gap-3 lg:items-end lg:gap-6">
        <PageHeader title="Minggu ini" subtitle={formatWeekLong(monday)} className="lg:[&_h1]:text-5xl" />
        <IconButton asChild bordered aria-label="Pengaturan" className="lg:hidden">
          <Link href="/pengaturan">
            <SlidersHorizontal aria-hidden className="size-5" strokeWidth={1.8} />
          </Link>
        </IconButton>
        <div className="hidden gap-2.5 lg:flex">
          <Button asChild variant="secondary" className="h-tap rounded-lg">
            <Link href="/stok">Tandai terjual</Link>
          </Button>
          <Button asChild variant="secondary" className="h-tap rounded-lg">
            <Link href="/balance">Catat penarikan</Link>
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-5.5 lg:grid-cols-[440px_minmax(0,1fr)] lg:gap-7">
        <section aria-labelledby="struk-judul" className="flex flex-col">
          <Receipt title="Struk laba" titleId="struk-judul" meta={`per ${formatStampWib(now)}`}>
            <ReceiptRows>
              <ReceiptRow
                label="Penjualan bersih"
                sub={`${terjual} akun terjual, sudah dipotong admin ${settings.admin_pct}%`}
                value={<Amount currency="usd" value={net} />}
              />
              <ReceiptRow
                op="×"
                label={`${formatIdr(perDolar)} per dolar`}
                sub={
                  <>
                    <Link href="/pengaturan#kurs" className="font-semibold">
                      kurs Payoneer {formatIdr(rates.kursPayoneer)}
                    </Link>
                    , potong tarik {settings.potongan_tarik_pct}%
                  </>
                }
                value={formatIdr(week?.penjualan_idr ?? 0)}
              />
              <ReceiptRow
                op="−"
                label="Modal akun yang terjual"
                sub={`harga beli ${terjual} akun tadi`}
                value={formatIdr(week?.modal_terjual ?? 0)}
              />
              {penarikan > 0 && (
                <ReceiptRow
                  op={koreksi < 0 ? "−" : "+"}
                  label="Biaya dan selisih penarikan"
                  sub={`$${settings.potongan_tarik_usd} × ${penarikan} penarikan minggu ini, termasuk selisih kurs`}
                  value={formatIdr(Math.abs(koreksi))}
                />
              )}
              {rugiHb > 0 && (
                <ReceiptRow
                  op="−"
                  label="Rugi hackback"
                  sub={`${week?.akun_hb ?? 0} akun kena HB minggu ini`}
                  value={formatIdr(rugiHb)}
                />
              )}
            </ReceiptRows>
            <ReceiptDivider />
            <ReceiptTotal
              size="hero"
              label="Laba"
              value={<Amount currency="idr" tone="profit" value={week?.laba ?? 0} className="lg:text-[36px] lg:leading-[42px]" />}
            />
          </Receipt>
          <div className="grid grid-cols-2 gap-4 px-0.5 pt-3.5 lg:px-1 lg:pt-4">
            <StatTile
              label="Modal keluar"
              value={formatIdr(week?.modal_keluar ?? 0)}
              sub={`beli ${week?.akun_dibeli ?? 0} akun baru`}
              className="lg:[&>span:nth-child(2)]:text-2xl"
            />
            <StatTile
              label="Cash flow"
              value={<Amount currency="idr" tone="profit" signed value={week?.cash_flow ?? 0} />}
              sub={
                penarikan > 0
                  ? `tarik ${formatUsd(week?.usd_ditarik ?? 0)} jadi ${formatIdr(week?.idr_diterima ?? 0)}`
                  : "belum ada penarikan"
              }
              className="lg:[&>span:nth-child(2)]:text-2xl"
            />
          </div>
        </section>

        <div className="flex min-w-0 flex-col gap-5.5 lg:gap-7">
          <section aria-labelledby="balance-judul" className="flex flex-col gap-1.5 lg:gap-2">
            <SectionHeader
              id="balance-judul"
              title="Balance toko"
              action={
                <Link href="/balance" className="flex min-h-tap items-center text-sm font-semibold no-underline">
                  Buka balance
                </Link>
              }
            />
            <div className="grid grid-cols-2 border-y border-divider *:py-3 *:pr-3 *:not-first:pl-4 lg:grid-cols-3 lg:*:py-4">
              {balances.map((b) => (
                <div key={b.store_id} className="flex flex-col gap-0.5 border-r border-divider max-lg:nth-last-[2]:border-r-0">
                  <span className="text-sm text-ink-muted">{b.nama}</span>
                  <Amount currency="usd" value={b.saldo_usd} className="text-2xl font-bold lg:text-[26px] lg:leading-8 lg:font-extrabold" />
                  <span className="hidden text-xs text-ink-muted lg:block">{b.akun_terjual} akun terjual</span>
                </div>
              ))}
              <div className="hidden flex-col gap-0.5 lg:flex">
                <span className="text-sm text-ink-muted">Total</span>
                <Amount currency="usd" value={totalSaldo} className="text-[26px] leading-8 font-extrabold" />
                <span className="text-xs text-ink-muted">kira-kira {formatIdr(kiraRupiah)} kalau ditarik</span>
              </div>
            </div>
            <p className="mt-1 text-xs text-ink-muted lg:hidden">
              Total {formatUsd(totalSaldo)}, kira-kira {formatIdr(kiraRupiah)} kalau ditarik sekarang, sudah dipotong{" "}
              {settings.potongan_tarik_pct}% + ${settings.potongan_tarik_usd} per toko
            </p>
          </section>

          <section aria-labelledby="cek-judul" className="flex flex-col gap-1.5">
            <h2 id="cek-judul" className="mb-1 text-md font-bold">
              Perlu dicek
            </h2>
            <CheckList items={cekItems} />
          </section>
        </div>
      </div>

      <div className="hidden items-start gap-7 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Card aria-labelledby="jual-judul" className="flex flex-col gap-2.5 lg:px-5.5 lg:py-5">
          <h2 id="jual-judul" className="text-lg font-bold">
            Penjualan minggu ini
          </h2>
          {soldThisWeek.length === 0 ? (
            <EmptyState>Belum ada akun terjual minggu ini.</EmptyState>
          ) : (
            <Table className="table-fixed">
              <THead>
                <Tr>
                  <Th className="w-18">Tanggal</Th>
                  <Th>Akun</Th>
                  <Th className="w-24 text-right">Harga jual</Th>
                  <Th className="w-22 text-right">Net</Th>
                  <Th className="w-28 pr-0 text-right">Laba</Th>
                </Tr>
              </THead>
              <TBody>
                {soldThisWeek.map((a) => (
                  <Tr key={a.id}>
                    <Td className="text-ink-muted">{formatDateShort(a.tanggal_terjual!)}</Td>
                    <Td>
                      <CellStack primary={<span className="block truncate">{a.isi_akun}</span>} secondary={`${a.kode} ${a.username ?? ""}`} />
                    </Td>
                    <Td className="text-right">
                      <Amount currency="usd" value={a.harga_jual_usd} />
                    </Td>
                    <Td className="text-right">
                      <Amount currency="usd" value={a.net_usd} />
                    </Td>
                    <Td className="pr-0 text-right font-bold">
                      <Amount currency="idr" tone="profit" value={a.laba_idr} />
                    </Td>
                  </Tr>
                ))}
              </TBody>
              <TFoot>
                <Tr>
                  <Th scope="row" colSpan={2} className="border-0 pt-3">
                    Total {soldThisWeek.length} akun
                  </Th>
                  <TfCell className="text-right">
                    <Amount currency="usd" value={sum(soldThisWeek.map((a) => a.harga_jual_usd ?? 0))} />
                  </TfCell>
                  <TfCell className="text-right">
                    <Amount currency="usd" value={sum(soldThisWeek.map((a) => a.net_usd ?? 0))} />
                  </TfCell>
                  <TfCell className="pr-0 text-right font-extrabold">
                    <Amount currency="idr" tone="profit" value={sum(soldThisWeek.map((a) => a.laba_idr ?? 0))} />
                  </TfCell>
                </Tr>
              </TFoot>
            </Table>
          )}
        </Card>

        <Card aria-labelledby="baru-judul" className="flex flex-col gap-2.5 lg:px-5.5 lg:py-5">
          <h2 id="baru-judul" className="text-lg font-bold">
            Stok baru minggu ini
          </h2>
          {boughtThisWeek.length === 0 ? (
            <EmptyState>Belum ada stok baru minggu ini.</EmptyState>
          ) : (
            <Table className="table-fixed">
              <THead>
                <Tr>
                  <Th className="w-18">Tanggal</Th>
                  <Th>Akun</Th>
                  <Th className="w-26">Status</Th>
                  <Th className="w-26 pr-0 text-right">Harga beli</Th>
                </Tr>
              </THead>
              <TBody>
                {boughtThisWeek.map((a) => (
                  <Tr key={a.id}>
                    <Td className="text-ink-muted">{formatDateShort(a.tanggal_beli!)}</Td>
                    <Td>
                      <CellStack primary={<span className="block truncate">{a.isi_akun}</span>} secondary={`${a.kode} ${a.username ?? ""}`} />
                    </Td>
                    <Td>
                      <StatusChip status={a.status} />
                    </Td>
                    <Td className="pr-0 text-right font-bold">{formatIdr(a.harga_beli_idr)}</Td>
                  </Tr>
                ))}
              </TBody>
              <TFoot>
                <Tr>
                  <Th scope="row" colSpan={3} className="border-0 pt-3">
                    Total modal keluar
                  </Th>
                  <TfCell className="pr-0 text-right font-extrabold">
                    {formatIdr(sum(boughtThisWeek.map((a) => a.harga_beli_idr)))}
                  </TfCell>
                </Tr>
              </TFoot>
            </Table>
          )}
        </Card>
      </div>
    </PageShell>
  );
}
