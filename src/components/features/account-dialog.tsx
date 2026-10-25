"use client";

import { useId, useState, useTransition } from "react";
import { Amount } from "@/components/ui/amount";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChoiceGroup, SegmentedControl } from "@/components/ui/choice";
import { Dialog } from "@/components/ui/dialog";
import { Field, GroupLabel } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { useToast } from "@/components/ui/toast";
import { deleteAccount, undoStatus, updateAccount } from "@/lib/data/actions";
import { addDays, diffDays } from "@/lib/dates";
import type { AccountRow, Store } from "@/lib/db-types";
import { ACCOUNT_STATUSES, type AccountSource, type AccountStatus } from "@/lib/domain";
import { formatDateLong, formatIdr } from "@/lib/format";
import { parseIsiAkun } from "@/lib/isi-akun";
import { AccountSummary } from "./account-summary";
import { useUndoToast } from "./use-undo-toast";

type AccountDialogProps = {
  account: AccountRow | null;
  stores: Pick<Store, "id" | "nama" | "aktif">[];
  holdDefaultHari: number;
  today: string;
  onOpenChange: (open: boolean) => void;
  onSell: (account: AccountRow) => void;
};

/** Detail and edit panel for one account: status, Hold deadline, prices, notes. */
export function AccountDialog({ account, onOpenChange, ...rest }: AccountDialogProps) {
  return (
    <Dialog
      open={account !== null}
      onOpenChange={onOpenChange}
      title={account ? `Akun ${account.kode}` : "Akun"}
      description={account ? account.game_nama : undefined}
    >
      {account && (
        <AccountForm key={account.id} account={account} onClose={() => onOpenChange(false)} {...rest} />
      )}
    </Dialog>
  );
}

function AccountForm({
  account,
  stores,
  holdDefaultHari,
  today,
  onClose,
  onSell,
}: Omit<AccountDialogProps, "account" | "onOpenChange"> & { account: AccountRow; onClose: () => void }) {
  const ids = useId();
  const toast = useToast();
  const undoToast = useUndoToast();
  const sold = account.status === "Sold";

  const [status, setStatus] = useState<AccountStatus>(account.status);
  const [holdSampai, setHoldSampai] = useState(account.hold_sampai ?? "");
  const [holdTanpaBatas, setHoldTanpaBatas] = useState(account.hold_tanpa_batas);
  const [storeId, setStoreId] = useState(account.store_id ?? "");
  const [isi, setIsi] = useState(account.isi_akun);
  const [username, setUsername] = useState(account.username ?? "");
  const [sumber, setSumber] = useState<AccountSource>(account.sumber);
  const [dibeliDari, setDibeliDari] = useState(account.dibeli_dari ?? "");
  const [hargaBeli, setHargaBeli] = useState<number | null>(account.harga_beli_idr);
  const [tanggalBeli, setTanggalBeli] = useState(account.tanggal_beli ?? "");
  const [listing, setListing] = useState<number | null>(account.harga_listing_usd);
  const [catatan, setCatatan] = useState(account.catatan ?? "");
  const [hargaJual, setHargaJual] = useState<number | null>(null);
  const [tanggalJual, setTanggalJual] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const holdSeminggu = addDays(tanggalBeli || today, holdDefaultHari);
  const tags = parseIsiAkun(isi);
  const pilihanToko = stores.filter((s) => s.aktif || s.id === account.store_id);
  // HB accounts cannot be sold; everything else can be marked Sold right here
  const statusOptions = ACCOUNT_STATUSES.filter((s) => s !== "Sold" || account.status !== "HB");
  const jualSekarang = !sold && status === "Sold";
  const jualSebelumBeli = jualSekarang && !!tanggalBeli && tanggalJual < tanggalBeli;
  const jualSiap =
    !jualSekarang || (!!hargaJual && hargaJual > 0 && !!tanggalJual && !!storeId && !jualSebelumBeli);

  function simpan() {
    setError(null);
    startTransition(async () => {
      const res = await updateAccount(account.id, {
        storeId: storeId || null,
        isiAkun: isi,
        username,
        sumber,
        dibeliDari,
        hargaBeli: hargaBeli ?? 0,
        tanggalBeli: tanggalBeli || null,
        hargaListing: listing,
        status: sold || jualSekarang ? undefined : (status as Exclude<AccountStatus, "Sold">),
        holdSampai: status === "Hold" && !holdTanpaBatas ? holdSampai || null : null,
        holdTanpaBatas: status === "Hold" && holdTanpaBatas,
        catatan,
        penjualan: jualSekarang && hargaJual ? { hargaJual, tanggal: tanggalJual } : null,
      }).catch(() => ({ ok: false as const, error: "Gagal menyimpan. Periksa koneksi lalu coba lagi." }));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
      if (res.data.statusChanged) {
        undoToast(account.id, `${res.data.kode} jadi ${res.data.status}`);
      } else {
        toast({ title: `${res.data.kode} disimpan` });
      }
    });
  }

  function batalkanPenjualan() {
    setError(null);
    startTransition(async () => {
      const res = await undoStatus(account.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
      toast({
        title: `Penjualan ${account.kode} dibatalkan`,
        description: `Status kembali ke ${res.data.status}`,
      });
    });
  }

  function hapus() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    startTransition(async () => {
      const res = await deleteAccount(account.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
      toast({ title: `${res.data.kode} dihapus` });
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

      {sold ? (
        <section
          aria-label="Penjualan"
          className="flex flex-col gap-2 rounded-xl border border-divider p-3.5"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold">
              Terjual{" "}
              {account.tanggal_terjual ? formatDateLong(account.tanggal_terjual) : "(tanggal belum diisi)"}
            </span>
            <Amount currency="usd" value={account.harga_jual_usd} className="font-bold" />
          </div>
          <div className="flex items-baseline justify-between gap-3 text-sm text-ink-muted">
            <span>
              Net <Amount currency="usd" value={account.net_usd} />
            </span>
            <span>
              Laba <Amount currency="idr" tone="profit" value={account.laba_idr} className="font-bold" />
            </span>
          </div>
          {account.harga_jual_usd === null && (
            <p className="text-sm text-ink-muted">
              Harga jual belum diisi, jadi belum masuk ke balance. Urungkan penjualan, lalu jual lagi dengan
              harganya.
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={batalkanPenjualan}
            disabled={pending}
          >
            Urungkan penjualan
          </Button>
        </section>
      ) : (
        <div className="flex flex-col gap-3">
          <Field label="Status" htmlFor={`${ids}-status`}>
            <Select
              id={`${ids}-status`}
              value={status}
              onChange={(e) => setStatus(e.target.value as AccountStatus)}
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          {jualSekarang && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Harga jual" htmlFor={`${ids}-jual`}>
                <MoneyInput
                  id={`${ids}-jual`}
                  currency="usd"
                  placeholder="0"
                  value={hargaJual}
                  onValueChange={setHargaJual}
                />
              </Field>
              <Field
                label="Tanggal terjual"
                htmlFor={`${ids}-tgl-jual`}
                hint={jualSebelumBeli ? "Tidak boleh sebelum tanggal beli" : undefined}
              >
                <Input
                  id={`${ids}-tgl-jual`}
                  type="date"
                  required
                  min={tanggalBeli || undefined}
                  max={today}
                  value={tanggalJual}
                  onChange={(e) => setTanggalJual(e.target.value)}
                  className="font-semibold"
                />
              </Field>
            </div>
          )}
          {status === "Hold" && (
            <SegmentedControl
              aria-label="Lama hold"
              value={holdTanpaBatas ? "tanpa-batas" : "tanggal"}
              onValueChange={(v) => setHoldTanpaBatas(v === "tanpa-batas")}
              options={[
                { value: "tanggal", label: "Sampai tanggal" },
                { value: "tanpa-batas", label: "Tanpa batas" },
              ]}
            />
          )}
          {status === "Hold" && !holdTanpaBatas && (
            <Field
              label="Ditahan sampai"
              htmlFor={`${ids}-hold`}
              hint={
                holdSampai && holdSampai < today
                  ? `Sudah lewat ${diffDays(holdSampai, today)} hari`
                  : "Kosongkan untuk 1 minggu dari tanggal beli"
              }
            >
              <div className="flex gap-2">
                <Input
                  id={`${ids}-hold`}
                  type="date"
                  value={holdSampai}
                  onChange={(e) => setHoldSampai(e.target.value)}
                  className="font-semibold"
                />
                <Button variant="outline" onClick={() => setHoldSampai(holdSeminggu)}>
                  1 minggu
                </Button>
              </div>
            </Field>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Toko" htmlFor={`${ids}-toko`}>
          <Select id={`${ids}-toko`} value={storeId} onChange={(e) => setStoreId(e.target.value)}>
            {!storeId && <option value="">Pilih toko</option>}
            {pilihanToko.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nama}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Harga listing" htmlFor={`${ids}-listing`} optional>
          <MoneyInput id={`${ids}-listing`} currency="usd" value={listing} onValueChange={setListing} />
        </Field>
      </div>

      <Field label="Isi akun" htmlFor={`${ids}-isi`}>
        <Textarea
          id={`${ids}-isi`}
          rows={3}
          placeholder="Belum ada isi"
          value={isi}
          onChange={(e) => setIsi(e.target.value)}
        />
        {(tags.jumlah !== null || tags.tags.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-ink-muted">Terbaca:</span>
            {tags.jumlah !== null && <Badge>{`${tags.jumlah} ${tags.satuan}`}</Badge>}
            {tags.tags.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </div>
        )}
      </Field>

      <Field label="Username" htmlFor={`${ids}-user`} optional>
        <Input
          id={`${ids}-user`}
          autoComplete="off"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </Field>

      <div className="flex flex-col gap-1.5">
        <GroupLabel id={`${ids}-sumber`}>Sumber</GroupLabel>
        <ChoiceGroup
          aria-labelledby={`${ids}-sumber`}
          value={sumber}
          onValueChange={setSumber}
          options={[
            { value: "Beli", label: "Beli" },
            { value: "Grind", label: "Grind sendiri" },
          ]}
        />
      </div>

      {sumber === "Beli" && (
        <Field label="Dibeli dari" htmlFor={`${ids}-penjual`} optional>
          <Input
            id={`${ids}-penjual`}
            autoComplete="off"
            value={dibeliDari}
            onChange={(e) => setDibeliDari(e.target.value)}
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Harga beli" htmlFor={`${ids}-beli`}>
          <MoneyInput
            id={`${ids}-beli`}
            currency="idr"
            value={sumber === "Grind" ? 0 : hargaBeli}
            onValueChange={setHargaBeli}
            disabled={sumber === "Grind"}
          />
        </Field>
        <Field
          label="Tanggal beli"
          htmlFor={`${ids}-tgl`}
          hint={account.is_legacy && !tanggalBeli ? "Data lama, boleh dikosongkan" : undefined}
        >
          <Input
            id={`${ids}-tgl`}
            type="date"
            max={today}
            required={!account.is_legacy}
            value={tanggalBeli}
            onChange={(e) => setTanggalBeli(e.target.value)}
            className="font-semibold"
          />
        </Field>
      </div>

      <Field label="Catatan" htmlFor={`${ids}-catatan`} optional hint="Progress grinding atau info listing">
        <Textarea id={`${ids}-catatan`} value={catatan} onChange={(e) => setCatatan(e.target.value)} />
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          className={confirmDelete ? "text-loss hover:text-loss" : undefined}
          onClick={hapus}
          disabled={pending}
        >
          {confirmDelete ? "Ketuk lagi untuk menghapus" : "Hapus akun"}
        </Button>
        {account.harga_beli_idr > 0 && sumber === "Beli" && (
          <span className="text-xs text-ink-muted">Modal sekarang {formatIdr(account.harga_beli_idr)}</span>
        )}
      </div>

      <div className="sticky bottom-0 -mx-5 mt-auto -mb-5 flex flex-col gap-2 border-t border-divider bg-surface px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {error && (
          <p role="alert" className="text-center text-sm font-semibold text-loss">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          {!sold && status !== "HB" && status !== "Sold" && account.status !== "HB" && (
            <Button
              variant="secondary"
              className="h-action flex-1 rounded-xl"
              onClick={() => onSell(account)}
              disabled={pending}
            >
              Tandai terjual
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="flex-1"
            disabled={pending || !jualSiap}
          >
            {pending ? "Menyimpan…" : jualSekarang ? "Simpan sebagai Sold" : "Simpan perubahan"}
          </Button>
        </div>
      </div>
    </form>
  );
}
