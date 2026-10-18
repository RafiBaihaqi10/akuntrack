"use client";

import { useId, useState, useTransition } from "react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { ChoiceGroup } from "@/components/ui/choice";
import { Field, GroupLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { useToast } from "@/components/ui/toast";
import { withdrawalEstimate, type Rates } from "@/lib/calc";
import { completeWithdrawal, recordWithdrawal } from "@/lib/data/actions";
import type { StoreBalance, Withdrawal } from "@/lib/db-types";
import { formatIdr, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

export type WithdrawalMode = { kind: "baru" } | { kind: "lama"; withdrawal: Withdrawal; storeName: string };

type WithdrawalFormProps = {
  mode: WithdrawalMode;
  balances: StoreBalance[];
  rates: Rates;
  today: string;
  onDone?: () => void;
  onCancel?: () => void;
};

/** "Catat penarikan", or "Isi rupiah" for an old withdrawal (dollars fixed, rupiah and date to fill). */
export function WithdrawalForm({ mode, balances, rates, today, onDone, onCancel }: WithdrawalFormProps) {
  const ids = useId();
  const toast = useToast();
  const lama = mode.kind === "lama" ? mode.withdrawal : null;
  const [storeId, setStoreId] = useState(lama?.store_id ?? balances[0]?.store_id ?? "");
  const [usd, setUsd] = useState<number | null>(lama ? lama.usd_ditarik : null);
  const [idr, setIdr] = useState<number | null>(null);
  const [tanggal, setTanggal] = useState(lama?.tanggal ?? today);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Old rows keep the rates they were recorded with (Rp17.000 for the Excel import).
  const r: Rates = lama
    ? { ...rates, potonganTarikPct: lama.biaya_tarik_pct, potonganTarikUsd: lama.biaya_tetap_usd, kursPayoneer: lama.kurs_payoneer }
    : rates;
  const saldo = balances.find((b) => b.store_id === storeId);
  const toko = mode.kind === "lama" ? mode.storeName : (saldo?.nama ?? "toko");
  const dolar = usd ?? 0;
  const ada = dolar > 0 && (idr ?? 0) > 0;
  const perkiraan = withdrawalEstimate(dolar, r);
  const selisih = (idr ?? 0) - perkiraan;
  const sisa = (saldo?.saldo_usd ?? 0) - dolar;
  const lebih = !lama && dolar > (saldo?.saldo_usd ?? 0) + 0.005;
  const siap = lama ? (idr ?? 0) > 0 : dolar > 0 && !lebih && !!storeId && !!tanggal;

  function simpan() {
    setError(null);
    startTransition(async () => {
      const res = lama
        ? await completeWithdrawal({ id: lama.id, idr: idr ?? 0, tanggal: tanggal || null })
        : await recordWithdrawal({ storeId, tanggal, usd: dolar, idr, catatan: null });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast({
        title: lama ? "Rupiah penarikan dicatat" : `Penarikan ${formatUsd(dolar)} dari ${toko} dicatat`,
        description: idr ? `Diterima ${formatIdr(idr)}` : "Rupiah bisa diisi nanti dari mutasi bank",
      });
      setUsd(null);
      setIdr(null);
      onDone?.();
    });
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (siap) simpan();
      }}
    >
      {!lama && (
        <div className="flex flex-col gap-1.5">
          <GroupLabel id={`${ids}-toko`}>Dari toko</GroupLabel>
          <ChoiceGroup
            aria-labelledby={`${ids}-toko`}
            value={storeId}
            onValueChange={setStoreId}
            options={balances.map((b) => ({
              value: b.store_id,
              label: b.nama,
              description: `saldo ${formatUsd(b.saldo_usd)}`,
            }))}
            className="grid-flow-row grid-cols-2 [&>button]:min-h-13 [&>button]:items-start"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Dolar ditarik" htmlFor={`${ids}-usd`}>
          <MoneyInput
            id={`${ids}-usd`}
            currency="usd"
            placeholder="0"
            value={usd}
            onValueChange={setUsd}
            disabled={!!lama}
            aria-invalid={lebih || undefined}
          />
        </Field>
        <Field label="Rupiah diterima" htmlFor={`${ids}-idr`} optional={!lama}>
          <MoneyInput
            id={`${ids}-idr`}
            currency="idr"
            placeholder="cek mutasi bank"
            value={idr}
            onValueChange={setIdr}
            autoFocus={!!lama}
          />
        </Field>
      </div>

      <Field label="Tanggal uang masuk" htmlFor={`${ids}-tgl`} hint={lama && !lama.tanggal ? "Kosongkan kalau tidak ingat" : undefined}>
        <Input
          id={`${ids}-tgl`}
          type="date"
          max={today}
          required={!lama}
          value={tanggal}
          onChange={(e) => setTanggal(e.target.value)}
          className="font-semibold"
        />
      </Field>

      <dl className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-2 rounded-lg bg-canvas p-3.5 text-sm">
        <dt className="text-ink-muted">Kurs efektif</dt>
        <dd className="text-md font-extrabold">{ada ? `${formatIdr((idr ?? 0) / dolar)} per dolar` : "isi rupiah dulu"}</dd>
        <dt className="text-ink-muted">
          Perkiraan ({100 - r.potonganTarikPct}% − ${r.potonganTarikUsd}) × {formatIdr(r.kursPayoneer)}
        </dt>
        <dd className="text-base font-semibold">{formatIdr(perkiraan)}</dd>
        <dt className="text-ink-muted">Selisih dari perkiraan</dt>
        <dd className={cn("text-base font-bold", !ada ? "text-ink-muted" : selisih < 0 ? "text-loss" : "text-profit")}>
          {ada ? formatIdr(selisih, { signed: true }) : "—"}
        </dd>
        {!lama && (
          <>
            <dt className="text-ink-muted">Sisa saldo {toko}</dt>
            <dd className="text-base font-bold">
              <Amount currency="usd" value={sisa} className={sisa < 0 ? "text-loss" : undefined} />
            </dd>
          </>
        )}
      </dl>

      {lebih && (
        <p role="alert" className="-mt-1.5 text-sm font-semibold text-loss">
          Melebihi saldo {toko}. Kurangi jumlah dolar atau pilih toko lain.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-loss">
          {error}
        </p>
      )}

      <Button type="submit" variant="primary" size="lg" disabled={!siap || pending}>
        {pending ? "Menyimpan…" : "Simpan penarikan"}
      </Button>
      {lama && onCancel && (
        <Button variant="ghost" className="h-tap" onClick={onCancel}>
          Batal, catat penarikan baru
        </Button>
      )}
    </form>
  );
}
