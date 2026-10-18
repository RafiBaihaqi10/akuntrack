"use client";

import { useId, useState, useTransition } from "react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { ChoiceGroup } from "@/components/ui/choice";
import { Dialog } from "@/components/ui/dialog";
import { Field, GroupLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Receipt, ReceiptDivider, ReceiptRow, ReceiptRows, ReceiptTotal } from "@/components/ui/receipt";
import { rupiahPerNetDollar, saleBreakdown, type Rates } from "@/lib/calc";
import { markSold } from "@/lib/data/actions";
import type { Store } from "@/lib/db-types";
import { formatIdr, formatUsd } from "@/lib/format";
import { AccountSummary, type AccountLite } from "./account-summary";
import { useUndoToast } from "./use-undo-toast";

type SaleDialogProps = {
  account: AccountLite | null;
  stores: Pick<Store, "id" | "nama" | "aktif">[];
  rates: Rates;
  today: string;
  onOpenChange: (open: boolean) => void;
};

/** "Tandai terjual": full screen on phones, right panel on desktop. Open when `account` is set. */
export function SaleDialog({ account, onOpenChange, ...rest }: SaleDialogProps) {
  return (
    <Dialog
      open={account !== null}
      onOpenChange={onOpenChange}
      title="Tandai terjual"
      placement="screen"
      className="lg:bg-surface"
    >
      {account && <SaleForm key={account.id} account={account} onDone={() => onOpenChange(false)} {...rest} />}
    </Dialog>
  );
}

function SaleForm({
  account,
  stores,
  rates,
  today,
  onDone,
}: Omit<SaleDialogProps, "account" | "onOpenChange"> & { account: AccountLite; onDone: () => void }) {
  const ids = useId();
  const undoToast = useUndoToast();
  const pilihan = stores.filter((s) => s.aktif || s.id === account.store_id);
  const [harga, setHarga] = useState<number | null>(null);
  const [storeId, setStoreId] = useState(account.store_id ?? pilihan[0]?.id ?? "");
  const [tanggal, setTanggal] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toko = stores.find((s) => s.id === storeId)?.nama ?? "toko";
  const ada = harga !== null && harga > 0;
  const hitung = saleBreakdown(harga ?? 0, account.harga_beli_idr, rates);

  function simpan() {
    if (!ada) return;
    setError(null);
    startTransition(async () => {
      const res = await markSold({ accountId: account.id, hargaJual: harga, tanggal, storeId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onDone();
      undoToast(
        account.id,
        `${account.kode} terjual`,
        `Balance ${toko} naik ${formatUsd(res.data.netUsd)}, laba ${formatIdr(res.data.labaIdr)}`,
      );
    });
  }

  return (
    <form
      className="flex flex-1 flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        simpan();
      }}
    >
      <AccountSummary account={account} />

      <Field label="Harga jual di Eldorado" htmlFor={`${ids}-jual`}>
        <MoneyInput
          id={`${ids}-jual`}
          currency="usd"
          emphasis
          autoFocus
          placeholder="0"
          value={harga}
          onValueChange={setHarga}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <GroupLabel id={`${ids}-toko`}>Toko</GroupLabel>
          <ChoiceGroup
            aria-labelledby={`${ids}-toko`}
            value={storeId}
            onValueChange={setStoreId}
            options={pilihan.map((s) => ({ value: s.id, label: s.nama }))}
          />
        </div>
        <Field label="Tanggal terjual" htmlFor={`${ids}-tgl`}>
          <Input
            id={`${ids}-tgl`}
            type="date"
            max={today}
            required
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className="font-semibold"
          />
        </Field>
      </div>

      <Receipt title="Hitungan penjualan" titleId={`${ids}-hitung`} background="screen">
        <ReceiptRows>
          <ReceiptRow label="Harga jual" value={<Amount currency="usd" value={hitung.hargaJual} />} />
          <ReceiptRow
            op="−"
            label={`Admin Eldorado ${rates.adminPct}%`}
            value={<Amount currency="usd" value={-hitung.admin} />}
          />
          <ReceiptRow
            op="="
            label={`Masuk balance ${toko}`}
            value={<Amount currency="usd" value={hitung.net} className="font-extrabold" />}
          />
          <ReceiptRow
            op="×"
            label={`${formatIdr(rupiahPerNetDollar(rates))} per dolar`}
            sub={`kurs Payoneer ${formatIdr(rates.kursPayoneer)}, potong tarik ${rates.potonganTarikPct}%`}
            value={formatIdr(hitung.estimasi)}
          />
          <ReceiptRow op="−" label="Modal akun" value={formatIdr(account.harga_beli_idr)} />
        </ReceiptRows>
        <ReceiptDivider />
        <ReceiptTotal
          label="Laba"
          value={ada ? <Amount currency="idr" tone="profit" value={hitung.laba} /> : <span className="text-ink-muted">—</span>}
        />
      </Receipt>

      {pilihan.length === 0 && (
        <p role="alert" className="text-sm font-semibold text-loss">
          Belum ada toko aktif. Tambahkan toko di Pengaturan.
        </p>
      )}

      <div className="sticky bottom-0 -mx-5 mt-auto -mb-5 flex flex-col gap-2 border-t border-divider bg-surface px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {error && (
          <p role="alert" className="text-center text-sm font-semibold text-loss">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" disabled={!ada || pending || !storeId}>
          {pending ? "Menyimpan…" : ada ? "Simpan penjualan" : "Isi harga jual dulu"}
        </Button>
        <p className="text-center text-xs text-ink-muted">
          {ada
            ? `Status jadi Sold dan balance ${toko} naik ${formatUsd(hitung.net)}`
            : "Harga jual dalam dolar, sebelum potongan admin"}
        </p>
      </div>
    </form>
  );
}
