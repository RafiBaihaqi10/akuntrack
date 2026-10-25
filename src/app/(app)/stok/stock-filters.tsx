"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { ChoiceGroup } from "@/components/ui/choice";
import { Dialog } from "@/components/ui/dialog";
import { Field, GroupLabel } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import type { AccountRow, Store } from "@/lib/db-types";
import type { AccountSource } from "@/lib/domain";
import { formatDateShort, formatIdrCompact } from "@/lib/format";

/** Filters from the "Filter" panel, on top of status, game and search. */
export type ExtraFilters = {
  toko: string;
  sumber: "" | AccountSource;
  beliDari: string;
  beliSampai: string;
  hargaMin: number | null;
  hargaMax: number | null;
};

export const NO_FILTERS: ExtraFilters = {
  toko: "",
  sumber: "",
  beliDari: "",
  beliSampai: "",
  hargaMin: null,
  hargaMax: null,
};

export function matchFilters(a: AccountRow, f: ExtraFilters) {
  if (f.toko && a.store_id !== f.toko) return false;
  if (f.sumber && a.sumber !== f.sumber) return false;
  if (f.beliDari && (!a.tanggal_beli || a.tanggal_beli < f.beliDari)) return false;
  if (f.beliSampai && (!a.tanggal_beli || a.tanggal_beli > f.beliSampai)) return false;
  if (f.hargaMin !== null && a.harga_beli_idr < f.hargaMin) return false;
  if (f.hargaMax !== null && a.harga_beli_idr > f.hargaMax) return false;
  return true;
}

/** One removable chip per active filter, in panel order. */
export function activeFilters(f: ExtraFilters, stores: Pick<Store, "id" | "nama">[]) {
  const chips: { label: string; clear: Partial<ExtraFilters> }[] = [];
  if (f.toko) chips.push({ label: stores.find((s) => s.id === f.toko)?.nama ?? "Toko", clear: { toko: "" } });
  if (f.sumber) chips.push({ label: f.sumber === "Grind" ? "Grind sendiri" : "Beli", clear: { sumber: "" } });
  if (f.beliDari || f.beliSampai) {
    const label =
      f.beliDari && f.beliSampai
        ? `Beli ${formatDateShort(f.beliDari)} – ${formatDateShort(f.beliSampai)}`
        : f.beliDari
          ? `Beli sejak ${formatDateShort(f.beliDari)}`
          : `Beli sampai ${formatDateShort(f.beliSampai)}`;
    chips.push({ label, clear: { beliDari: "", beliSampai: "" } });
  }
  if (f.hargaMin !== null || f.hargaMax !== null) {
    const label =
      f.hargaMin !== null && f.hargaMax !== null
        ? `Modal ${formatIdrCompact(f.hargaMin)} – ${formatIdrCompact(f.hargaMax)}`
        : f.hargaMin !== null
          ? `Modal ≥ ${formatIdrCompact(f.hargaMin)}`
          : `Modal ≤ ${formatIdrCompact(f.hargaMax ?? 0)}`;
    chips.push({ label, clear: { hargaMin: null, hargaMax: null } });
  }
  return chips;
}

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

/** Missing values always go last, whichever direction. */
function by<T extends string | number>(get: (a: AccountRow) => T | null, dir: 1 | -1) {
  return (x: AccountRow, y: AccountRow) => {
    const a = get(x);
    const b = get(y);
    if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
    if (typeof a === "string") return a.localeCompare(b as string, "id", { numeric: true }) * dir;
    return ((a as number) - (b as number)) * dir;
  };
}

export const SORTS = {
  // Server order: tanggal beli, then input time, newest first
  terbaru: { label: "Tanggal beli terbaru", compare: null },
  terlama: { label: "Tanggal beli terlama", compare: by((a) => a.tanggal_beli, 1) },
  "beli-tinggi": { label: "Harga beli tertinggi", compare: by((a) => a.harga_beli_idr, -1) },
  "beli-rendah": { label: "Harga beli terendah", compare: by((a) => a.harga_beli_idr, 1) },
  "listing-tinggi": { label: "Harga listing tertinggi", compare: by((a) => a.harga_listing_usd, -1) },
  "terjual-terbaru": { label: "Tanggal terjual terbaru", compare: by((a) => a.tanggal_terjual, -1) },
  "laba-tinggi": { label: "Laba tertinggi", compare: by((a) => a.laba_idr, -1) },
  kode: { label: "Kode A–Z", compare: by((a) => a.kode, 1) },
} satisfies Record<string, { label: string; compare: ((x: AccountRow, y: AccountRow) => number) | null }>;

export type SortKey = keyof typeof SORTS;

export function isSortKey(v: unknown): v is SortKey {
  return typeof v === "string" && v in SORTS;
}

export function sortRows(rows: AccountRow[], key: SortKey) {
  const compare = SORTS[key].compare;
  return compare ? rows.toSorted(compare) : rows;
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

type FilterDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: ExtraFilters;
  onChange: (value: ExtraFilters) => void;
  stores: Pick<Store, "id" | "nama">[];
  /** Live result count for the "Tampilkan" button. */
  resultCount: number;
  today: string;
};

export function FilterDialog({
  open,
  onOpenChange,
  value,
  onChange,
  stores,
  resultCount,
  today,
}: FilterDialogProps) {
  const ids = useId();
  const set = (patch: Partial<ExtraFilters>) => onChange({ ...value, ...patch });
  const ada = activeFilters(value, stores).length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Filter stok"
      footer={
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            disabled={!ada}
            onClick={() => onChange(NO_FILTERS)}
          >
            Reset
          </Button>
          <Button variant="primary" size="lg" className="flex-2" onClick={() => onOpenChange(false)}>
            {resultCount > 0 ? `Tampilkan ${resultCount} akun` : "Tidak ada akun"}
          </Button>
        </div>
      }
    >
      <Field label="Toko" htmlFor={`${ids}-toko`}>
        <Select id={`${ids}-toko`} value={value.toko} onChange={(e) => set({ toko: e.target.value })}>
          <option value="">Semua toko</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nama}
            </option>
          ))}
        </Select>
      </Field>

      <div className="flex flex-col gap-1.5">
        <GroupLabel id={`${ids}-sumber`}>Sumber</GroupLabel>
        <ChoiceGroup
          aria-labelledby={`${ids}-sumber`}
          value={value.sumber || "semua"}
          onValueChange={(v) => set({ sumber: v === "semua" ? "" : (v as AccountSource) })}
          options={[
            { value: "semua", label: "Semua" },
            { value: "Beli", label: "Beli" },
            { value: "Grind", label: "Grind" },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Dibeli dari tanggal" htmlFor={`${ids}-dari`}>
          <Input
            id={`${ids}-dari`}
            type="date"
            max={value.beliSampai || today}
            value={value.beliDari}
            onChange={(e) => set({ beliDari: e.target.value })}
            className="font-semibold"
          />
        </Field>
        <Field label="Sampai tanggal" htmlFor={`${ids}-sampai`}>
          <Input
            id={`${ids}-sampai`}
            type="date"
            min={value.beliDari || undefined}
            max={today}
            value={value.beliSampai}
            onChange={(e) => set({ beliSampai: e.target.value })}
            className="font-semibold"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Harga beli minimal" htmlFor={`${ids}-min`}>
          <MoneyInput
            id={`${ids}-min`}
            currency="idr"
            placeholder="0"
            value={value.hargaMin}
            onValueChange={(v) => set({ hargaMin: v })}
          />
        </Field>
        <Field label="Harga beli maksimal" htmlFor={`${ids}-max`}>
          <MoneyInput
            id={`${ids}-max`}
            currency="idr"
            placeholder="tanpa batas"
            value={value.hargaMax}
            onValueChange={(v) => set({ hargaMax: v })}
          />
        </Field>
      </div>
    </Dialog>
  );
}
