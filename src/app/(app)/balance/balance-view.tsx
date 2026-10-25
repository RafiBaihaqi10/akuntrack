"use client";

import { useId, useRef, useState, useTransition, type CSSProperties } from "react";
import { PageShell } from "@/components/app/page-shell";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { SegmentedControl } from "@/components/ui/choice";
import { useToast } from "@/components/ui/toast";
import { sum, withdrawalEstimate, type Rates } from "@/lib/calc";
import { addAdjustment, transferBalance } from "@/lib/data/actions";
import type { BalanceAdjustment, Store, StoreBalance, Withdrawal } from "@/lib/db-types";
import { formatDateLong, formatDateShort, formatIdr, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { WithdrawalForm, type WithdrawalMode } from "./withdrawal-form";

type BalanceViewProps = {
  balances: StoreBalance[];
  stores: Store[];
  withdrawals: Withdrawal[];
  adjustments: BalanceAdjustment[];
  rates: Rates;
  today: string;
};

/** Rows shown before "Tampilkan semua". */
const HISTORY_PREVIEW = 8;

function storeLine(b: StoreBalance) {
  const masuk = `Masuk ${formatUsd(b.masuk_usd + b.saldo_awal_usd)}`;
  const tarik =
    b.jumlah_penarikan > 0
      ? `sudah ditarik ${formatUsd(b.ditarik_usd)} dalam ${b.jumlah_penarikan} kali`
      : "belum pernah ditarik";
  const sesuai = b.penyesuaian_usd !== 0 ? `, penyesuaian ${formatUsd(b.penyesuaian_usd, { signed: true })}` : "";
  return `${masuk}, ${tarik}${sesuai}`;
}

const isDesktop = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

export function BalanceView({ balances, stores, withdrawals, adjustments, rates, today }: BalanceViewProps) {
  const [mode, setMode] = useState<WithdrawalMode>({ kind: "baru" });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const formRef = useRef<HTMLElement>(null);

  const total = sum(balances.map((b) => b.saldo_usd));
  const kiraRupiah = sum(balances.map((b) => (b.saldo_usd > 0 ? withdrawalEstimate(b.saldo_usd, rates) : 0)));
  const storeName = (id: string) => stores.find((s) => s.id === id)?.nama ?? "—";
  const history = showAll ? withdrawals : withdrawals.slice(0, HISTORY_PREVIEW);
  const hidden = withdrawals.length - history.length;
  const hiddenLama = withdrawals.slice(history.length).filter((w) => w.idr_diterima === null).length;

  function openForm(next: WithdrawalMode) {
    setMode(next);
    if (isDesktop()) formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    else setSheetOpen(true);
  }

  const formTitle = mode.kind === "baru" ? "Catat penarikan" : "Lengkapi penarikan lama";
  const formSub =
    mode.kind === "baru"
      ? "Isi rupiah dari mutasi bank supaya kurs efektif terlihat"
      : `${mode.storeName}, ${formatUsd(mode.withdrawal.usd_ditarik)}. Isi rupiah yang diterima`;
  const form = (
    <WithdrawalForm
      key={mode.kind === "lama" ? mode.withdrawal.id : "baru"}
      mode={mode}
      balances={balances}
      rates={rates}
      today={today}
      onDone={() => {
        setMode({ kind: "baru" });
        setSheetOpen(false);
      }}
      onCancel={() => {
        setMode({ kind: "baru" });
        setSheetOpen(false);
      }}
    />
  );

  return (
    <PageShell>
      <PageHeader title="Balance" subtitle="Saldo toko di Eldorado, dalam dolar" />

      {/* Summary: stacked on phones, one card on desktop */}
      <section
        aria-label="Ringkasan balance"
        className="flex flex-col gap-5.5 lg:grid lg:grid-cols-[minmax(0,1.2fr)_repeat(var(--toko),minmax(0,1fr))] lg:gap-0 lg:rounded-2xl lg:bg-surface lg:py-6"
        style={{ "--toko": balances.length } as CSSProperties}
      >
        <div className="flex flex-col gap-1 lg:border-r lg:border-divider lg:px-7">
          <h2 className="text-sm font-semibold text-ink-muted">Total balance</h2>
          <Amount currency="usd" value={total} className="text-[40px] leading-[46px] font-extrabold tracking-tight lg:text-[44px] lg:leading-[50px]" />
          <p className="text-sm text-ink-muted">
            Kira-kira {formatIdr(kiraRupiah)} kalau ditarik sekarang: dipotong {rates.potonganTarikPct}% + $
            {rates.potonganTarikUsd} per toko, kurs Payoneer {formatIdr(rates.kursPayoneer)}
          </p>
        </div>

        <div className="flex flex-col gap-1.5 lg:contents">
          <h2 className="mb-1 text-md font-bold lg:hidden">Per toko</h2>
          <ul className="flex flex-col border-b border-divider lg:contents">
            {balances.map((b, i) => (
              <li
                key={b.store_id}
                className={cn(
                  "flex flex-col gap-1.5 border-t border-divider py-3.5 lg:gap-1 lg:border-t-0 lg:px-7 lg:py-0",
                  i < balances.length - 1 && "lg:border-r",
                )}
              >
                <div className="flex items-baseline justify-between gap-3 lg:flex-col lg:items-start lg:gap-1">
                  <span className="flex flex-col gap-0.5">
                    <span className="text-lg font-bold lg:text-md">{b.nama}</span>
                    <span className="text-xs text-ink-muted lg:hidden">{b.akun_terjual} akun terjual</span>
                  </span>
                  <Amount currency="usd" value={b.saldo_usd} className="text-[22px] leading-7 font-extrabold lg:text-5xl" />
                </div>
                <span className="text-xs text-ink-muted lg:text-sm">
                  <span className="hidden lg:inline">{b.akun_terjual} akun terjual. </span>
                  {storeLine(b)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="flex flex-col gap-2.5 lg:flex-row">
        <Button variant="primary" size="lg" className="lg:hidden" onClick={() => openForm({ kind: "baru" })}>
          Catat penarikan
        </Button>
        {balances.length > 1 && (
          <Button variant="outline" size="lg" className="lg:w-auto" onClick={() => setTransferOpen(true)}>
            Pindah saldo antar toko
          </Button>
        )}
      </div>

      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section aria-labelledby="riwayat-judul" className="flex flex-col gap-1.5 lg:rounded-2xl lg:bg-surface lg:px-5.5 lg:pt-5 lg:pb-4">
          <h2 id="riwayat-judul" className="mb-1 text-md font-bold lg:mb-2 lg:text-lg">
            Riwayat penarikan
          </h2>
          {withdrawals.length === 0 ? (
            <EmptyState>Belum ada penarikan.</EmptyState>
          ) : (
            <>
              <div className="hidden grid-cols-[minmax(0,1fr)_100px_120px_96px_100px] items-center gap-x-4 border-b border-line py-2.5 text-xs font-semibold text-ink-muted lg:grid">
                <span>Tanggal dan toko</span>
                <span className="text-right">Dolar ditarik</span>
                <span className="text-right">Rupiah diterima</span>
                <span className="text-right">Kurs efektif</span>
                <span />
              </div>
              <ul className="flex flex-col">
                {history.map((w) => (
                  <HistoryRow
                    key={w.id}
                    w={w}
                    toko={storeName(w.store_id)}
                    onIsi={() => openForm({ kind: "lama", withdrawal: w, storeName: storeName(w.store_id) })}
                  />
                ))}
              </ul>
              {hidden > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-divider pt-2.5 lg:border-t-0">
                  <span className="text-xs text-ink-muted lg:text-sm">
                    {hidden} penarikan lainnya{hiddenLama > 0 ? `, ${hiddenLama} belum punya rupiah` : ""}
                  </span>
                  <Button variant="link" onClick={() => setShowAll(true)}>
                    Tampilkan semua
                  </Button>
                </div>
              )}
            </>
          )}
        </section>

        <section
          ref={formRef}
          aria-labelledby="form-judul"
          className="hidden scroll-mt-8 flex-col gap-4 rounded-2xl bg-surface p-5.5 lg:flex"
        >
          <div className="flex flex-col gap-0.5">
            <h2 id="form-judul" className="text-xl font-extrabold">
              {formTitle}
            </h2>
            <span className="text-sm text-ink-muted">{formSub}</span>
          </div>
          {form}
        </section>
      </div>

      {adjustments.length > 0 && (
        <section aria-labelledby="sesuai-judul" className="flex flex-col gap-1.5 lg:rounded-2xl lg:bg-surface lg:px-5.5 lg:py-5">
          <h2 id="sesuai-judul" className="mb-1 text-md font-bold lg:text-lg">
            Penyesuaian dan pindah saldo
          </h2>
          <ul className="flex flex-col border-b border-divider lg:border-b-0">
            {adjustments.map((a) => (
              <li key={a.id} className="flex items-center gap-3 border-t border-divider py-2.5 first:border-t-0 lg:first:border-t">
                <span className="w-16 shrink-0 text-sm text-ink-muted">{formatDateShort(a.tanggal)}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-base font-semibold">{storeName(a.store_id)}</span>
                  <span className="truncate text-xs text-ink-muted">{a.alasan}</span>
                </span>
                <Amount currency="usd" value={a.usd} signed className="font-bold" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-sm text-ink-muted">
        Saldo beda dengan dashboard Eldorado?{" "}
        <button type="button" onClick={() => setAdjustOpen(true)} className="min-h-tap font-bold text-teal hover:text-teal-hover">
          Catat penyesuaian
        </button>
      </p>

      <Dialog open={sheetOpen} onOpenChange={setSheetOpen} title={formTitle} description={formSub} placement="sheet">
        {sheetOpen && form}
      </Dialog>

      <Dialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        title="Catat penyesuaian"
        description="Koreksi saldo supaya sama dengan Eldorado, misalnya refund atau selisih."
        placement="responsive"
      >
        {adjustOpen && <AdjustmentForm stores={stores} today={today} onDone={() => setAdjustOpen(false)} />}
      </Dialog>

      <Dialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        title="Pindah saldo antar toko"
        description="Tanpa potongan: saldo toko asal berkurang, toko tujuan bertambah dengan jumlah yang sama."
        placement="responsive"
      >
        {transferOpen && <TransferForm balances={balances} today={today} onDone={() => setTransferOpen(false)} />}
      </Dialog>
    </PageShell>
  );
}

function HistoryRow({ w, toko, onIsi }: { w: Withdrawal; toko: string; onIsi: () => void }) {
  const lama = w.idr_diterima === null;
  const tanggal = w.tanggal ? formatDateLong(w.tanggal) : "data lama";
  const isiButton = lama && (
    <Button variant="outline" size="sm" className="lg:h-10" onClick={onIsi}>
      Isi rupiah
    </Button>
  );
  return (
    <li className="border-t border-divider first:border-t-0 lg:border-t-0 lg:border-b">
      {/* Phone */}
      <div className="flex min-h-16 items-center gap-3 py-2.5 lg:hidden">
        <span className="flex w-11 shrink-0 flex-col items-center">
          <span className="text-lg font-extrabold">{w.tanggal ? Number(w.tanggal.slice(8)) : "—"}</span>
          <span className="text-2xs text-ink-muted">{w.tanggal ? formatDateShort(w.tanggal).split(" ")[1] : "lama"}</span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-base font-semibold">{toko}</span>
          <span className={cn("text-xs", lama ? "text-warn-ink" : "text-ink-muted")}>
            {lama ? "rupiah belum dicatat" : `kurs efektif ${formatIdr(w.kurs_efektif ?? 0)}`}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <Amount currency="usd" value={-w.usd_ditarik} className="text-base font-bold" />
          {lama ? isiButton : <span className="text-sm font-semibold">{formatIdr(w.idr_diterima!)}</span>}
        </span>
      </div>

      {/* Desktop */}
      <div className="hidden min-h-14.5 grid-cols-[minmax(0,1fr)_100px_120px_96px_100px] items-center gap-x-4 py-1.5 lg:grid">
        <span className="flex min-w-0 flex-col">
          <span className={cn("text-sm", w.tanggal ? "font-semibold" : "text-ink-muted")}>{tanggal}</span>
          <span className="truncate text-xs text-ink-muted">{toko}</span>
        </span>
        <Amount currency="usd" value={w.usd_ditarik} className="text-right text-base font-bold" />
        <span className={cn("text-right text-base whitespace-nowrap", lama ? "text-sm text-warn-ink" : "font-bold")}>
          {lama ? "belum dicatat" : formatIdr(w.idr_diterima!)}
        </span>
        <span className="text-right text-sm text-ink-muted">{w.kurs_efektif ? formatIdr(w.kurs_efektif) : "—"}</span>
        <span className="flex justify-end">{isiButton}</span>
      </div>
    </li>
  );
}

function AdjustmentForm({ stores, today, onDone }: { stores: Store[]; today: string; onDone: () => void }) {
  const ids = useId();
  const toast = useToast();
  const [storeId, setStoreId] = useState(stores.find((s) => s.aktif)?.id ?? stores[0]?.id ?? "");
  const [arah, setArah] = useState<"tambah" | "kurang">("tambah");
  const [usd, setUsd] = useState<number | null>(null);
  const [tanggal, setTanggal] = useState(today);
  const [alasan, setAlasan] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const nilai = (usd ?? 0) * (arah === "tambah" ? 1 : -1);
  const siap = !!storeId && (usd ?? 0) > 0 && alasan.trim().length > 0;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!siap) return;
        setError(null);
        startTransition(async () => {
          const res = await addAdjustment({ storeId, tanggal, usd: nilai, alasan });
          if (!res.ok) {
            setError(res.error);
            return;
          }
          toast({ title: `Penyesuaian ${formatUsd(nilai, { signed: true })} dicatat` });
          onDone();
        });
      }}
    >
      <Field label="Toko" htmlFor={`${ids}-toko`}>
        <Select id={`${ids}-toko`} value={storeId} onChange={(e) => setStoreId(e.target.value)}>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nama}
            </option>
          ))}
        </Select>
      </Field>
      <SegmentedControl
        aria-label="Arah penyesuaian"
        value={arah}
        onValueChange={setArah}
        options={[
          { value: "tambah", label: "Saldo kurang di aplikasi (+)" },
          { value: "kurang", label: "Saldo lebih di aplikasi (−)" },
        ]}
        className="[&>button]:text-xs"
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Jumlah" htmlFor={`${ids}-usd`}>
          <MoneyInput id={`${ids}-usd`} currency="usd" placeholder="0" value={usd} onValueChange={setUsd} />
        </Field>
        <Field label="Tanggal" htmlFor={`${ids}-tgl`}>
          <Input
            id={`${ids}-tgl`}
            type="date"
            max={today}
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className="font-semibold"
          />
        </Field>
      </div>
      <Field label="Alasan" htmlFor={`${ids}-alasan`}>
        <Input
          id={`${ids}-alasan`}
          placeholder="mis. refund pembeli, selisih saldo Eldorado"
          value={alasan}
          onChange={(e) => setAlasan(e.target.value)}
        />
      </Field>
      {error && (
        <p role="alert" className="text-sm font-semibold text-loss">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" size="lg" disabled={!siap || pending}>
        {pending ? "Menyimpan…" : `Simpan penyesuaian ${usd ? formatUsd(nilai, { signed: true }) : ""}`}
      </Button>
    </form>
  );
}

export function TransferForm({ balances, today, onDone }: { balances: StoreBalance[]; today: string; onDone: () => void }) {
  const ids = useId();
  const toast = useToast();
  // Default: from the store holding the most, to the next one
  const urut = [...balances].sort((a, b) => b.saldo_usd - a.saldo_usd);
  const [dariId, setDariId] = useState(urut[0]?.store_id ?? "");
  const [keId, setKeId] = useState(urut[1]?.store_id ?? "");
  const [usd, setUsd] = useState<number | null>(null);
  const [tanggal, setTanggal] = useState(today);
  const [catatan, setCatatan] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dari = balances.find((b) => b.store_id === dariId);
  const saldoDari = dari?.saldo_usd ?? 0;
  const lebih = (usd ?? 0) > saldoDari + 0.005;
  const siap = !!dariId && !!keId && dariId !== keId && (usd ?? 0) > 0 && !lebih;

  function gantiDari(id: string) {
    setDariId(id);
    if (id === keId) setKeId(balances.find((b) => b.store_id !== id)?.store_id ?? "");
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!siap || usd === null) return;
        setError(null);
        startTransition(async () => {
          const res = await transferBalance({ dariId, keId, tanggal, usd, catatan });
          if (!res.ok) {
            setError(res.error);
            return;
          }
          toast({ title: `${formatUsd(usd)} dipindah dari ${res.data.dari} ke ${res.data.ke}` });
          onDone();
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Dari toko" htmlFor={`${ids}-dari`}>
          <Select id={`${ids}-dari`} value={dariId} onChange={(e) => gantiDari(e.target.value)}>
            {balances.map((b) => (
              <option key={b.store_id} value={b.store_id}>
                {b.nama}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ke toko" htmlFor={`${ids}-ke`}>
          <Select id={`${ids}-ke`} value={keId} onChange={(e) => setKeId(e.target.value)}>
            {balances
              .filter((b) => b.store_id !== dariId)
              .map((b) => (
                <option key={b.store_id} value={b.store_id}>
                  {b.nama}
                </option>
              ))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Jumlah" htmlFor={`${ids}-usd`}>
          <MoneyInput id={`${ids}-usd`} currency="usd" placeholder="0" value={usd} onValueChange={setUsd} />
        </Field>
        <Field label="Tanggal" htmlFor={`${ids}-tgl`}>
          <Input
            id={`${ids}-tgl`}
            type="date"
            max={today}
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className="font-semibold"
          />
        </Field>
      </div>
      <p className={cn("-mt-2 text-sm", lebih ? "font-semibold text-loss" : "text-ink-muted")}>
        {lebih ? "Melebihi saldo" : "Saldo"} {dari?.nama}: {formatUsd(saldoDari)}.{" "}
        {saldoDari > 0 && (
          <button
            type="button"
            onClick={() => setUsd(Math.round(saldoDari * 100) / 100)}
            className="min-h-tap font-bold text-teal hover:text-teal-hover"
          >
            Pindah semua
          </button>
        )}
      </p>
      <Field label="Catatan (opsional)" htmlFor={`${ids}-catatan`}>
        <Input
          id={`${ids}-catatan`}
          placeholder="mis. gabung saldo sebelum ditarik"
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
        />
      </Field>
      {error && (
        <p role="alert" className="text-sm font-semibold text-loss">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" size="lg" disabled={!siap || pending}>
        {pending ? "Menyimpan…" : `Pindahkan ${usd ? formatUsd(usd) : ""}`}
      </Button>
    </form>
  );
}
