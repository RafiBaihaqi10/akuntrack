"use client";

import { ArrowLeft, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState, useTransition, type ReactNode } from "react";
import { PageShell } from "@/components/app/page-shell";
import { Amount } from "@/components/ui/amount";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChoiceGroup, SegmentedControl } from "@/components/ui/choice";
import { Field, GroupLabel } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Receipt, ReceiptDivider, ReceiptRow, ReceiptRows, ReceiptTotal } from "@/components/ui/receipt";
import { useToast } from "@/components/ui/toast";
import { batasBeli, type SoldSample } from "@/lib/analytics";
import { rupiahPerNetDollar, saleBreakdown, type Rates } from "@/lib/calc";
import { createAccounts } from "@/lib/data/actions";
import { addDays } from "@/lib/dates";
import type { Game, Store } from "@/lib/db-types";
import type { AccountSource } from "@/lib/domain";
import { formatDateShort, formatIdr, formatUsd } from "@/lib/format";
import { jumlahVarianFor, parseIsiAkun } from "@/lib/isi-akun";
import { cn } from "@/lib/utils";

export type ExistingUsername = { game_id: string; username: string; kode: string };

type AddStockFormProps = {
  games: Game[];
  stores: Store[];
  rates: Rates;
  targetMarginPct: number;
  holdDefaultHari: number;
  samples: SoldSample[];
  usernames: ExistingUsername[];
  today: string;
};

type Mode = "satu" | "banyak";
type StatusAwal = "Belum Post" | "Belum Sold" | "Hold";

/** Last game and store, remembered per browser so repeated entry is faster. */
const MEMORY_KEY = "akuntrack:tambah-stok";

export function AddStockForm({
  games,
  stores,
  rates,
  targetMarginPct,
  holdDefaultHari,
  samples,
  usernames,
  today,
}: AddStockFormProps) {
  const ids = useId();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [mode, setMode] = useState<Mode>("satu");
  const [gameId, setGameId] = useState(games[0]?.id ?? "");
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [sumber, setSumber] = useState<AccountSource>("Beli");
  const [dibeliDari, setDibeliDari] = useState("");
  const [isi, setIsi] = useState("");
  const [hargaBeli, setHargaBeli] = useState<number | null>(null);
  const [listing, setListing] = useState<number | null>(null);
  const [tanggal, setTanggal] = useState(today);
  const [statusAwal, setStatusAwal] = useState<StatusAwal>("Belum Post");
  const [username, setUsername] = useState("");
  const [daftar, setDaftar] = useState("");
  const [catatan, setCatatan] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(MEMORY_KEY) ?? "{}") as { gameId?: string; storeId?: string };
      // Restoring a per-browser preference after hydration; the server cannot know it.
      /* eslint-disable react-hooks/set-state-in-effect */
      if (saved.gameId && games.some((g) => g.id === saved.gameId)) setGameId(saved.gameId);
      if (saved.storeId && stores.some((s) => s.id === saved.storeId)) setStoreId(saved.storeId);
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {
      // No storage: keep the defaults.
    }
  }, [games, stores]);

  const game = games.find((g) => g.id === gameId);
  const grind = sumber === "Grind";
  const beli = grind ? 0 : (hargaBeli ?? 0);
  const parsed = parseIsiAkun(isi);
  const jumlah = jumlahVarianFor(parsed, game?.satuan_varian ?? null);
  const hitung = saleBreakdown(listing ?? 0, beli, rates);

  const lines = daftar
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const akunBaru = mode === "satu" ? [username.trim() || null] : lines;

  const existing = new Map(
    usernames.filter((u) => u.game_id === gameId).map((u) => [u.username, u.kode] as const),
  );
  const dobel = akunBaru
    .filter((u): u is string => !!u)
    .map((u) => ({ u, kode: existing.get(u.toLowerCase()) }))
    .filter((d) => d.kode);
  const dobelDiDaftar = lines.filter((l, i) => lines.findIndex((x) => x.toLowerCase() === l.toLowerCase()) !== i);

  const batas = game ? batasBeli(samples, game, jumlah, rates, targetMarginPct) : null;
  const batasInfo = batas
    ? {
        text: `Batas beli ${batas.label} ${formatIdr(batas.batas)} (median laku ${formatUsd(batas.medianJual)}, target laba ${targetMarginPct}%). ${
          grind
            ? "Hasil grind, modal Rp0."
            : hargaBeli === null
              ? ""
              : beli <= batas.batas
                ? "Harga beli ini aman."
                : "Harga beli ini di atas batas."
        }`,
        tone: hargaBeli === null && !grind ? "text-ink-muted" : grind || beli <= batas.batas ? "text-profit" : "text-loss",
      }
    : {
        text: "Belum cukup data penjualan untuk game ini, jadi batas beli belum bisa dihitung.",
        tone: "text-ink-muted",
      };

  const siap = !!gameId && !!storeId && isi.trim().length > 0 && !!tanggal && (mode === "satu" || lines.length > 0);
  const simpanLabel = pending
    ? "Menyimpan…"
    : mode === "satu"
      ? "Simpan stok"
      : lines.length > 0
        ? `Simpan ${lines.length} akun`
        : "Simpan akun";

  function simpan() {
    setError(null);
    startTransition(async () => {
      const res = await createAccounts({
        gameId,
        storeId,
        isiAkun: isi,
        sumber,
        dibeliDari,
        hargaBeli: beli,
        tanggalBeli: tanggal,
        hargaListing: listing,
        status: statusAwal,
        catatan,
        usernames: akunBaru,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const kode = res.data.map((r) => r.kode);
      toast({
        title: kode.length === 1 ? `${kode[0]} ditambahkan` : `${kode.length} akun ditambahkan`,
        description: kode.length > 1 ? `${kode[0]} sampai ${kode[kode.length - 1]}` : undefined,
      });
      try {
        localStorage.setItem(MEMORY_KEY, JSON.stringify({ gameId, storeId }));
      } catch {
        // Ignore: remembering the last choice is only a convenience.
      }
      // Keep game, store, source, seller and date for the next entry.
      setIsi("");
      setHargaBeli(null);
      setListing(null);
      setUsername("");
      setDaftar("");
      setCatatan("");
    });
  }

  if (games.length === 0 || stores.length === 0) {
    return (
      <PageShell>
        <h1 className="text-3xl font-extrabold tracking-tight lg:text-4xl">Tambah stok</h1>
        <p className="text-base text-ink-muted">
          Tambahkan minimal satu game dan satu toko aktif dulu di <Link href="/pengaturan">Pengaturan</Link>.
        </p>
      </PageShell>
    );
  }

  const modeControl = (
    <SegmentedControl
      aria-label="Jumlah akun"
      value={mode}
      onValueChange={setMode}
      options={[
        { value: "satu", label: "Satu akun" },
        { value: "banyak", label: "Banyak sekaligus" },
      ]}
      className="lg:w-85"
    />
  );

  const errorText = error && (
    <p role="alert" className="text-sm font-semibold text-loss">
      {error}
    </p>
  );

  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        if (siap) simpan();
      }}
    >
      <PageShell bare className="gap-4.5 pt-3.5 lg:gap-5.5 lg:pt-7">
        <header className="flex items-center gap-2 lg:items-end lg:justify-between lg:gap-6">
          <Link
            href="/stok"
            aria-label="Tutup"
            className="-ml-2 flex size-tap items-center justify-center rounded-full text-ink hover:bg-track hover:text-ink lg:hidden"
          >
            <X aria-hidden className="size-5.5" strokeWidth={1.9} />
          </Link>
          <div className="flex flex-col gap-1.5">
            <Link href="/stok" className="hidden min-h-7 items-center gap-1.5 text-sm font-semibold no-underline lg:flex">
              <ArrowLeft aria-hidden className="size-4" strokeWidth={2} />
              Kembali ke stok
            </Link>
            <h1 className="text-2xl font-extrabold tracking-tight lg:text-5xl">Tambah stok</h1>
          </div>
          <div className="hidden lg:block">{modeControl}</div>
        </header>

        <div className="lg:hidden">{modeControl}</div>

        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_400px]">
          <section aria-label="Data akun" className="flex flex-col gap-4.5 lg:gap-5 lg:rounded-2xl lg:bg-surface lg:p-7">
            <div className="grid gap-4.5 lg:grid-cols-2 lg:gap-4">
              <Field label="Game" htmlFor={`${ids}-game`}>
                <Select id={`${ids}-game`} value={gameId} onChange={(e) => setGameId(e.target.value)}>
                  {games.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nama}
                    </option>
                  ))}
                </Select>
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
            </div>

            {!grind && (
              <Field
                label="Dibeli dari"
                htmlFor={`${ids}-penjual`}
                optional
                hint="Untuk melacak penjual yang akunnya sering kena hackback"
              >
                <Input
                  id={`${ids}-penjual`}
                  autoComplete="off"
                  placeholder="nama penjual atau grup"
                  value={dibeliDari}
                  onChange={(e) => setDibeliDari(e.target.value)}
                />
              </Field>
            )}

            <Field label="Isi akun" htmlFor={`${ids}-isi`}>
              <Textarea
                id={`${ids}-isi`}
                rows={2}
                required
                placeholder={game?.satuan_varian ? `mis. 5 ${game.satuan_varian} (Madara + Ichigo)` : "mis. Jinko + Kisuki"}
                value={isi}
                onChange={(e) => setIsi(e.target.value)}
              />
              {(parsed.jumlah !== null || parsed.tags.length > 0) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-ink-muted">Terbaca:</span>
                  {parsed.jumlah !== null && (
                    <Badge tone={jumlah !== null ? "teal" : "tag"}>{`${parsed.jumlah} ${parsed.satuan}`}</Badge>
                  )}
                  {parsed.tags.map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                </div>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3 lg:gap-4">
              <Field label={mode === "satu" ? "Harga beli" : "Harga beli per akun"} htmlFor={`${ids}-beli`}>
                <MoneyInput
                  id={`${ids}-beli`}
                  currency="idr"
                  placeholder="0"
                  value={grind ? 0 : hargaBeli}
                  onValueChange={setHargaBeli}
                  disabled={grind}
                />
              </Field>
              <Field label="Harga listing" htmlFor={`${ids}-listing`} optional>
                <MoneyInput id={`${ids}-listing`} currency="usd" placeholder="0" value={listing} onValueChange={setListing} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:gap-4">
              <div className="flex flex-col gap-1.5">
                <GroupLabel id={`${ids}-toko`}>Toko</GroupLabel>
                {stores.length <= 3 ? (
                  <ChoiceGroup
                    aria-labelledby={`${ids}-toko`}
                    value={storeId}
                    onValueChange={setStoreId}
                    options={stores.map((s) => ({ value: s.id, label: s.nama }))}
                    className="gap-1.5 lg:gap-2"
                  />
                ) : (
                  <Select aria-labelledby={`${ids}-toko`} value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nama}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
              <Field label="Tanggal beli" htmlFor={`${ids}-tgl`}>
                <Input
                  id={`${ids}-tgl`}
                  type="date"
                  required
                  max={today}
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="font-semibold"
                />
              </Field>
            </div>

            <div className="flex flex-col gap-1.5">
              <GroupLabel id={`${ids}-status`}>Status awal</GroupLabel>
              <ChoiceGroup
                aria-labelledby={`${ids}-status`}
                value={statusAwal}
                onValueChange={setStatusAwal}
                options={[
                  { value: "Belum Post", label: "Belum Post" },
                  { value: "Belum Sold", label: "Sudah listing" },
                  {
                    value: "Hold",
                    label: "Hold",
                    description: `sampai ${formatDateShort(addDays(tanggal || today, holdDefaultHari))}`,
                  },
                ]}
              />
            </div>

            {mode === "satu" ? (
              <Field
                label="Username"
                htmlFor={`${ids}-user`}
                optional
                hint={dobel[0] ? undefined : "Kosongkan kalau belum tahu"}
              >
                <Input
                  id={`${ids}-user`}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="mis. avkeren2026"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                {dobel[0] && (
                  <p className="text-xs font-semibold text-warn-ink">
                    Username ini sudah tercatat di {dobel[0].kode}. Tetap bisa disimpan kalau memang akun lain.
                  </p>
                )}
              </Field>
            ) : (
              <Field
                label="Username, satu per baris"
                htmlFor={`${ids}-daftar`}
                hint="Isi, harga, dan toko sama untuk semua akun."
              >
                <Textarea
                  id={`${ids}-daftar`}
                  rows={5}
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder={"kekghini\nnebushkarma\nsoouzhon"}
                  value={daftar}
                  onChange={(e) => setDaftar(e.target.value)}
                />
                {(dobel.length > 0 || dobelDiDaftar.length > 0) && (
                  <p className="text-xs font-semibold text-warn-ink">
                    {dobel.length > 0 &&
                      `Sudah tercatat: ${dobel
                        .slice(0, 3)
                        .map((d) => `${d.u} (${d.kode})`)
                        .join(", ")}${dobel.length > 3 ? ` dan ${dobel.length - 3} lainnya` : ""}. `}
                    {dobelDiDaftar.length > 0 && `Ditulis dua kali: ${Array.from(new Set(dobelDiDaftar)).join(", ")}. `}
                    Tetap bisa disimpan.
                  </p>
                )}
              </Field>
            )}

            <Field label="Catatan" htmlFor={`${ids}-catatan`} optional>
              <Textarea
                id={`${ids}-catatan`}
                placeholder="mis. masih di-grind, target 8 Monarch"
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
              />
            </Field>
          </section>

          {/* Desktop: receipt, ceiling and actions on the right */}
          <aside className="sticky top-7 hidden flex-col gap-4 lg:flex">
            <Receipt title={listing ? `Kalau laku ${formatUsd(listing)}` : "Kalau laku"} titleId={`${ids}-preview`}>
              <ReceiptRows>
                <ReceiptRow label="Harga listing" value={<Amount currency="usd" value={hitung.hargaJual} />} />
                <ReceiptRow
                  op="−"
                  label={`Admin Eldorado ${rates.adminPct}%`}
                  value={<Amount currency="usd" value={-hitung.admin} />}
                />
                <ReceiptRow
                  op="="
                  label="Net ke balance"
                  value={<Amount currency="usd" value={hitung.net} className="font-extrabold" />}
                />
                <ReceiptRow
                  op="×"
                  label={`${formatIdr(rupiahPerNetDollar(rates))} per dolar`}
                  value={formatIdr(hitung.estimasi)}
                />
                <ReceiptRow op="−" label={mode === "satu" ? "Harga beli" : "Harga beli per akun"} value={formatIdr(beli)} />
              </ReceiptRows>
              <ReceiptDivider />
              <ReceiptTotal
                label="Laba"
                value={listing ? <Amount currency="idr" tone="profit" value={hitung.laba} /> : <span className="text-ink-muted">—</span>}
              />
            </Receipt>
            <p className={cn("px-1 text-sm font-semibold", batasInfo.tone)}>{batasInfo.text}</p>
            {errorText}
            <Button type="submit" variant="primary" size="lg" disabled={!siap || pending}>
              {simpanLabel}
            </Button>
            <Button asChild variant="ghost" className="h-tap">
              <Link href="/stok">Selesai, lihat stok</Link>
            </Button>
          </aside>
        </div>
      </PageShell>

      {/* Phone: live calculation and the save button pinned to the bottom */}
      <footer className="sticky bottom-0 z-20 flex flex-col gap-3 border-t border-divider bg-surface px-gutter pt-3.5 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:hidden">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">{listing ? `Kalau laku ${formatUsd(listing)}` : "Isi harga listing untuk lihat laba"}</span>
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Net ke balance" value={<Amount currency="usd" value={hitung.net} />} />
            <MiniStat label="Jadi rupiah" value={formatIdr(hitung.estimasi)} />
            <MiniStat
              label="Laba"
              value={
                listing ? (
                  <Amount currency="idr" tone="profit" value={hitung.laba} className="font-extrabold" />
                ) : (
                  <span className="text-ink-muted">—</span>
                )
              }
            />
          </div>
          <p className={cn("text-xs", batasInfo.tone)}>{batasInfo.text}</p>
        </div>
        {errorText}
        <Button type="submit" variant="primary" size="lg" disabled={!siap || pending}>
          {simpanLabel}
        </Button>
      </footer>
    </form>
  );
}

function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-px">
      <span className="truncate text-2xs text-ink-muted">{label}</span>
      <span className="truncate text-md font-bold">{value}</span>
    </div>
  );
}
