"use client";

import { ArrowUpDown, Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/app/page-shell";
import { AccountDialog } from "@/components/features/account-dialog";
import { CopyUsername } from "@/components/features/copy-username";
import { SaleDialog } from "@/components/features/sale-dialog";
import { GameMark, StatusChip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { FilterChips } from "@/components/ui/choice";
import { Select } from "@/components/ui/input";
import { sum, type Rates } from "@/lib/calc";
import type { AccountRow, Game, Store } from "@/lib/db-types";
import type { AccountStatus } from "@/lib/domain";
import { formatDateShort, formatIdr, formatIdrCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  activeFilters,
  FilterDialog,
  isSortKey,
  matchFilters,
  NO_FILTERS,
  sortRows,
  SORTS,
  type ExtraFilters,
  type SortKey,
} from "./stock-filters";

export type StockFilters = {
  /** "aktif" (all active stock), "semua", or one status. */
  status: string;
  /** Extra check from "Perlu dicek": hold-lewat, stok-lama, tanpa-tanggal, tanpa-harga. */
  cek: string | null;
  game: string;
  q: string;
};

const CEK: Record<string, { label: string; match: (a: AccountRow) => boolean }> = {
  "hold-lewat": { label: "Hold lewat tanggal", match: (a) => a.hold_lewat },
  "stok-lama": { label: "Stok lama", match: (a) => a.stok_lama },
  "tanpa-tanggal": { label: "Tanpa tanggal beli", match: (a) => a.stok_aktif && a.tanggal_beli === null },
  "tanpa-harga": {
    label: "Sold tanpa harga jual",
    match: (a) => a.status === "Sold" && a.harga_jual_usd === null,
  },
};

const PAGE_SIZE = 30;

/** Chosen sort, remembered per browser. */
const SORT_KEY = "akuntrack:stok-urut";

/** Chip order follows the mockup: most common working statuses first. */
const CHIP_ORDER: AccountStatus[] = ["Belum Sold", "Hold", "Belum Post", "Update", "Sold", "HB"];

type StockViewProps = {
  accounts: AccountRow[];
  games: Game[];
  stores: Store[];
  rates: Rates;
  holdDefaultHari: number;
  stokLamaHari: number;
  today: string;
  initial: StockFilters;
};

export function StockView({
  accounts,
  games,
  stores,
  rates,
  holdDefaultHari,
  stokLamaHari,
  today,
  initial,
}: StockViewProps) {
  const [status, setStatus] = useState(initial.status);
  const [cek, setCek] = useState(initial.cek && CEK[initial.cek] ? initial.cek : null);
  const [game, setGame] = useState(initial.game);
  const [q, setQ] = useState(initial.q);
  const [filters, setFilters] = useState<ExtraFilters>(NO_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>("terbaru");
  const [page, setPage] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [sellId, setSellId] = useState<string | null>(null);
  const query = useDeferredValue(q.trim().toLowerCase());

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SORT_KEY);
      // Restoring a per-browser preference after hydration; the server cannot know it.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (isSortKey(saved)) setSort(saved);
    } catch {
      // No storage: keep the default order.
    }
  }, []);

  function pickSort(v: string) {
    if (!isSortKey(v)) return;
    setSort(v);
    setPage(0);
    try {
      localStorage.setItem(SORT_KEY, v);
    } catch {
      // Ignore: remembering the sort is only a convenience.
    }
  }

  const aktif = accounts.filter((a) => a.stok_aktif);
  const modalTertahan = sum(aktif.map((a) => a.harga_beli_idr));

  // Counts follow the game and search filters so the chips stay truthful.
  const base = useMemo(
    () =>
      accounts.filter((a) => {
        if (game && a.game_id !== game) return false;
        if (cek && !CEK[cek].match(a)) return false;
        if (!matchFilters(a, filters)) return false;
        if (!query) return true;
        return [a.username, a.isi_akun, a.kode, a.dibeli_dari, a.catatan].some((t) =>
          t?.toLowerCase().includes(query),
        );
      }),
    [accounts, game, cek, filters, query],
  );

  const rows = sortRows(
    base.filter((a) => (status === "aktif" ? a.stok_aktif : status === "semua" ? true : a.status === status)),
    sort,
  );
  const chips = activeFilters(filters, stores);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  const chipOptions = [
    { value: "aktif", label: "Semua", count: base.filter((a) => a.stok_aktif).length },
    ...CHIP_ORDER.map((s) => ({ value: s, label: s, count: base.filter((a) => a.status === s).length })),
  ].filter((o) => o.value === "aktif" || o.count > 0 || o.value === status);

  const detail = accounts.find((a) => a.id === detailId) ?? null;
  const selling = accounts.find((a) => a.id === sellId) ?? null;

  function pick<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(0);
    };
  }

  return (
    <PageShell className="lg:gap-5">
      <div className="flex flex-col gap-3.5 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
        <PageHeader
          title="Stok"
          subtitle={`${aktif.length} akun aktif, modal tertahan ${formatIdrCompact(modalTertahan)}`}
        />
        <div className="flex flex-col gap-2 lg:flex-row lg:gap-2.5">
          <label className="flex h-tap min-w-0 items-center gap-2 rounded-lg border border-line bg-surface px-3 focus-within:border-ink lg:w-64">
            <Search aria-hidden className="size-4.5 shrink-0 text-ink-muted" strokeWidth={1.9} />
            <span className="sr-only">Cari stok</span>
            <input
              type="search"
              value={q}
              onChange={(e) => pick(setQ)(e.target.value)}
              placeholder="Username atau isi akun"
              className="h-full w-full min-w-0 bg-transparent text-base outline-none placeholder:text-ink-faint"
            />
          </label>
          <div className="flex gap-2 lg:gap-2.5">
            <label className="min-w-0 flex-1 lg:w-44 lg:flex-none">
              <span className="sr-only">Pilih game</span>
              <Select
                value={game}
                onChange={(e) => pick(setGame)(e.target.value)}
                className="[&_select]:h-tap [&_select]:bg-surface [&_select]:text-sm lg:[&_select]:text-base"
              >
                <option value="">Semua game</option>
                {games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nama}
                  </option>
                ))}
              </Select>
            </label>
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              className={cn(
                "flex h-tap shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold",
                chips.length > 0
                  ? "border-ink bg-ink text-surface"
                  : "border-line bg-surface text-ink hover:border-ink",
              )}
            >
              <SlidersHorizontal aria-hidden className="size-4.5" strokeWidth={1.9} />
              Filter
              {chips.length > 0 && <span className="text-xs font-bold">{chips.length}</span>}
            </button>
            {/* A native select laid over the button: the phone gets its own picker sheet */}
            <label
              className={cn(
                "relative flex h-tap shrink-0 items-center gap-2 rounded-lg border bg-surface px-3 text-sm font-semibold focus-within:border-ink hover:border-ink",
                sort === "terbaru" ? "border-line" : "border-ink",
              )}
            >
              <ArrowUpDown aria-hidden className="size-4.5 text-ink-muted" strokeWidth={1.9} />
              <span aria-hidden className="hidden lg:inline">
                {SORTS[sort].label}
              </span>
              {sort !== "terbaru" && <span aria-hidden className="size-1.5 rounded-full bg-ink lg:hidden" />}
              <select
                aria-label="Urutkan"
                value={sort}
                onChange={(e) => pickSort(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
              >
                {Object.entries(SORTS).map(([key, o]) => (
                  <option key={key} value={key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <FilterChips
          aria-label="Filter status"
          value={status}
          onValueChange={pick(setStatus)}
          options={chipOptions}
          className="lg:flex-wrap"
        />
        {(cek || chips.length > 0 || sort !== "terbaru") && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {(cek || chips.length > 0) && <span className="text-ink-muted">Hanya:</span>}
            {cek && (
              <ActiveChip tone="gold" onClear={() => pick(setCek)(null)}>
                {CEK[cek].label}
              </ActiveChip>
            )}
            {chips.map((c) => (
              <ActiveChip key={c.label} onClear={() => pick(setFilters)({ ...filters, ...c.clear })}>
                {c.label}
              </ActiveChip>
            ))}
            {chips.length > 1 && (
              <button
                type="button"
                onClick={() => pick(setFilters)(NO_FILTERS)}
                className="min-h-8 px-1 font-semibold text-ink-muted underline hover:text-ink"
              >
                Hapus semua
              </button>
            )}
            {sort !== "terbaru" && (
              <span className="text-ink-muted lg:hidden">Urut: {SORTS[sort].label}</span>
            )}
          </div>
        )}
      </div>

      <section
        aria-label="Daftar stok"
        className="flex flex-col lg:rounded-2xl lg:bg-surface lg:px-5.5 lg:pt-2 lg:pb-4"
      >
        <div className="hidden grid-cols-[110px_minmax(0,1fr)_72px_112px_104px_156px_92px] items-center gap-x-4 border-b border-line py-3 text-xs font-semibold text-ink-muted lg:grid">
          <span>Kode</span>
          <span>Isi akun</span>
          <span>Toko</span>
          <span>Status</span>
          <span className="text-right">Harga beli</span>
          <span>Umur stok</span>
          <span />
        </div>

        {shown.length === 0 ? (
          <EmptyState>
            {accounts.length === 0 ? (
              <>
                Belum ada stok. <Link href="/stok/tambah">Tambah stok pertama</Link>.
              </>
            ) : (
              "Tidak ada akun dengan filter ini. Pilih status lain atau ubah pencarian."
            )}
          </EmptyState>
        ) : (
          <ul className="flex flex-col">
            {shown.map((a) => (
              <StockRow
                key={a.id}
                account={a}
                stokLamaHari={stokLamaHari}
                onOpen={() => setDetailId(a.id)}
                onSell={() => setSellId(a.id)}
              />
            ))}
          </ul>
        )}

        {rows.length > 0 && (
          <div className="flex items-center justify-between gap-4 border-t border-divider pt-3.5 lg:border-t-0">
            <span className="text-sm text-ink-muted">
              {rows.length > PAGE_SIZE
                ? `${current * PAGE_SIZE + 1}–${current * PAGE_SIZE + shown.length} dari ${rows.length} akun`
                : `${rows.length} akun`}
            </span>
            {pages > 1 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-md"
                  disabled={current === 0}
                  onClick={() => setPage(current - 1)}
                >
                  Sebelumnya
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-md"
                  disabled={current >= pages - 1}
                  onClick={() => setPage(current + 1)}
                >
                  Berikutnya
                </Button>
              </div>
            )}
          </div>
        )}
      </section>

      <AccountDialog
        account={detail}
        stores={stores}
        holdDefaultHari={holdDefaultHari}
        today={today}
        onOpenChange={(open) => !open && setDetailId(null)}
        onSell={(a) => {
          setDetailId(null);
          setSellId(a.id);
        }}
      />
      <FilterDialog
        open={filterOpen}
        onOpenChange={setFilterOpen}
        value={filters}
        onChange={pick(setFilters)}
        stores={stores}
        resultCount={rows.length}
        today={today}
      />
      <SaleDialog
        account={selling}
        stores={stores}
        rates={rates}
        today={today}
        onOpenChange={(open) => !open && setSellId(null)}
      />
    </PageShell>
  );
}

function ActiveChip({
  tone = "tag",
  onClear,
  children,
}: {
  tone?: "tag" | "gold";
  onClear: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      aria-label={`Hapus filter ${children}`}
      className={cn(
        "inline-flex min-h-8 items-center gap-1 rounded-full px-3 font-semibold",
        tone === "gold" ? "bg-chip-gold text-chip-gold-ink" : "bg-track text-ink",
      )}
    >
      {children}
      <X aria-hidden className="size-3.5" strokeWidth={2.2} />
    </button>
  );
}

function ageText(a: AccountRow, stokLamaHari: number): { text: string; tone: "muted" | "loss" } {
  if (a.status === "Sold") {
    return {
      text: a.tanggal_terjual ? `terjual ${formatDateShort(a.tanggal_terjual)}` : "terjual, tanpa tanggal",
      tone: "muted",
    };
  }
  if (a.status === "HB") {
    return { text: a.tanggal_hb ? `HB ${formatDateShort(a.tanggal_hb)}` : "HB, data lama", tone: "loss" };
  }
  if (a.status === "Hold" && a.hold_tanpa_batas) return { text: "Hold tanpa batas", tone: "muted" };
  if (a.status === "Hold" && a.hold_sampai) {
    return a.hold_lewat
      ? { text: `Hold lewat ${formatDateShort(a.hold_sampai)}`, tone: "loss" }
      : { text: `Hold sampai ${formatDateShort(a.hold_sampai)}`, tone: "muted" };
  }
  if (!a.tanggal_beli) return { text: "data lama, tanpa tanggal", tone: "muted" };
  const umur = a.umur_hari ?? 0;
  if (a.stok_lama) return { text: `${umur} hari, lewat ${stokLamaHari} hari`, tone: "loss" };
  return {
    text:
      umur > 0
        ? `dibeli ${formatDateShort(a.tanggal_beli)}, ${umur} hari`
        : `dibeli ${formatDateShort(a.tanggal_beli)}`,
    tone: "muted",
  };
}

function priceCell(a: AccountRow) {
  if (a.sumber === "Grind") return { text: "Grind", className: "text-ink-muted font-semibold" };
  if (a.harga_beli_idr === 0) return { text: "belum diisi", className: "text-warn-ink" };
  return { text: formatIdr(a.harga_beli_idr), className: "" };
}

function StockRow({
  account: a,
  stokLamaHari,
  onOpen,
  onSell,
}: {
  account: AccountRow;
  stokLamaHari: number;
  onOpen: () => void;
  onSell: () => void;
}) {
  const age = ageText(a, stokLamaHari);
  const price = priceCell(a);
  const sellable = a.stok_aktif;
  const user = a.username ?? "username belum diisi";

  const sellButton = sellable ? (
    <Button
      variant="outline"
      size="sm"
      className="relative z-10 lg:h-10 lg:w-full"
      onClick={onSell}
      aria-label={`Tandai terjual ${a.kode}`}
    >
      Terjual
    </Button>
  ) : null;

  return (
    <li className="relative border-t border-divider first:border-t-0 lg:border-t-0 lg:border-b lg:first:border-t-0">
      {/* The whole row opens the detail; the Terjual button sits above this overlay. */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Detail ${a.kode}, ${a.isi_akun || "belum ada isi"}`}
        className="absolute inset-0 z-0 rounded-md hover:bg-track/40"
      />

      {/* Phone */}
      <div className="pointer-events-none relative flex gap-3 py-3.5 lg:hidden">
        <GameMark abbr={a.game_singkatan} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="line-clamp-2 text-base font-semibold">{a.isi_akun || "Belum ada isi"}</span>
          <span className="flex min-w-0 items-center text-xs text-ink-muted">
            <span className="truncate">
              {a.kode} {user}
            </span>
            {a.username && (
              <CopyUsername username={a.username} className="pointer-events-auto relative z-10 -my-3 -ml-1" />
            )}
          </span>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <StatusChip status={a.status as AccountStatus} />
            <span className={cn("text-xs font-medium", age.tone === "loss" ? "text-loss" : "text-ink-muted")}>
              {age.text}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end justify-between gap-2">
          <span className={cn("text-base font-bold", price.className)}>{price.text}</span>
          <span className="pointer-events-auto">{sellButton}</span>
        </div>
      </div>

      {/* Desktop */}
      <div className="pointer-events-none relative hidden min-h-16 grid-cols-[110px_minmax(0,1fr)_72px_112px_104px_156px_92px] items-center gap-x-4 py-2 lg:grid">
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-bold">{a.kode}</span>
          <span className="truncate text-xs text-ink-muted">{a.game_nama}</span>
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-base font-semibold">{a.isi_akun || "Belum ada isi"}</span>
          <span className="flex min-w-0 items-center text-xs text-ink-muted">
            <span className="truncate">{user}</span>
            {a.username && (
              <CopyUsername
                username={a.username}
                className="pointer-events-auto relative z-10 -my-3 -ml-1 size-8"
              />
            )}
          </span>
        </span>
        <span className="truncate text-sm">{a.store_nama ?? "—"}</span>
        <span>
          <StatusChip status={a.status as AccountStatus} />
        </span>
        <span className={cn("text-right text-base font-bold", price.className)}>{price.text}</span>
        <span
          className={cn(
            "text-xs font-medium lg:text-sm",
            age.tone === "loss" ? "text-loss" : "text-ink-muted",
          )}
        >
          {age.text}
        </span>
        <span className="pointer-events-auto">{sellButton}</span>
      </div>
    </li>
  );
}
