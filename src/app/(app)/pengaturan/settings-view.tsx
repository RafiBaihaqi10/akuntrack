"use client";

import { RefreshCw } from "lucide-react";
import { useId, useState, useTransition, type ReactNode } from "react";
import { PageShell } from "@/components/app/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { ChoiceGroup, SegmentedControl } from "@/components/ui/choice";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Dialog } from "@/components/ui/dialog";
import { Field, GroupLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Receipt, ReceiptDivider, ReceiptRow, ReceiptRows, ReceiptTotal } from "@/components/ui/receipt";
import { useToast } from "@/components/ui/toast";
import { signOut } from "@/lib/auth/actions";
import { kursPayoneer } from "@/lib/calc";
import { refreshKursPasar, saveGame, saveSettings, saveStore, type SettingsInput } from "@/lib/data/actions";
import { formatStampWib } from "@/lib/dates";
import type { Game, Settings, Store } from "@/lib/db-types";
import { formatIdr, formatUsd } from "@/lib/format";

type SettingsViewProps = {
  email: string;
  settings: Settings;
  games: Game[];
  stores: Store[];
};

type Draft = { [K in keyof SettingsInput]: SettingsInput[K] | null };

function draftFrom(s: Settings): Draft {
  return {
    mode_kurs: s.mode_kurs,
    selisih_payoneer: s.selisih_payoneer,
    kurs_payoneer_manual: s.kurs_payoneer_manual ?? Math.max(0, s.kurs_pasar - s.selisih_payoneer),
    admin_pct: s.admin_pct,
    potongan_tarik_pct: s.potongan_tarik_pct,
    potongan_tarik_usd: s.potongan_tarik_usd,
    hold_default_hari: s.hold_default_hari,
    stok_lama_hari: s.stok_lama_hari,
    batas_laku_pct: s.batas_laku_pct,
    batas_laba_idr: s.batas_laba_idr,
    batas_modal_tertahan_pct: s.batas_modal_tertahan_pct,
    min_akun_data: s.min_akun_data,
    target_margin_pct: s.target_margin_pct,
    porsi_reinvest_pct: s.porsi_reinvest_pct,
  };
}

export function SettingsView({ email, settings, games, stores }: SettingsViewProps) {
  const ids = useId();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(settings));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [refreshing, startRefresh] = useTransition();

  const set =
    <K extends keyof Draft>(key: K) =>
    (value: Draft[K]) =>
      setDraft((d) => ({ ...d, [key]: value }));

  const otomatis = draft.mode_kurs === "otomatis";
  const kurs = kursPayoneer({
    mode_kurs: draft.mode_kurs ?? "otomatis",
    kurs_pasar: settings.kurs_pasar,
    selisih_payoneer: draft.selisih_payoneer ?? 0,
    kurs_payoneer_manual: draft.kurs_payoneer_manual,
  });
  const admin = draft.admin_pct ?? 0;
  const tarikPct = draft.potongan_tarik_pct ?? 0;
  const tarikUsd = draft.potongan_tarik_usd ?? 0;
  const potong = (100 * tarikPct) / 100;
  const sisa = Math.max(0, 100 - potong - tarikUsd);

  function simpan() {
    setError(null);
    const missing = Object.entries(draft).find(([k, v]) => v === null && k !== "kurs_payoneer_manual");
    if (missing) {
      setError("Masih ada angka yang kosong");
      return;
    }
    startTransition(async () => {
      const res = await saveSettings({
        ...(draft as SettingsInput),
        kurs_payoneer_manual: otomatis ? (settings.kurs_payoneer_manual ?? null) : draft.kurs_payoneer_manual,
      });
      if (!res.ok) setError(res.error);
      else toast({ title: "Pengaturan disimpan", description: `Kurs Payoneer ${formatIdr(kurs)} per dolar` });
    });
  }

  function perbaruiKurs() {
    startRefresh(async () => {
      const res = await refreshKursPasar(true);
      toast(
        res.ok
          ? { title: "Kurs pasar diperbarui", description: `${formatIdr(res.data.kursPasar)} per dolar` }
          : { title: "Kurs belum diperbarui", description: res.error, tone: "error" },
      );
    });
  }

  return (
    <PageShell>
      <PageHeader title="Pengaturan" subtitle="Kurs, potongan, dan data dasar aplikasi" />

      <form
        className="grid items-start gap-5.5 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-7"
        onSubmit={(e) => {
          e.preventDefault();
          simpan();
        }}
      >
        <div className="flex min-w-0 flex-col gap-5.5 lg:gap-7">
          <Card id="kurs" aria-labelledby={`${ids}-kurs`} className="flex scroll-mt-8 flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex flex-col gap-0.5">
                <h2 id={`${ids}-kurs`} className="text-md font-bold lg:text-lg">
                  Kurs Payoneer
                </h2>
                <p className="text-sm text-ink-muted">Dipakai untuk estimasi rupiah, laba, dan batas beli</p>
              </div>
              <SegmentedControl
                aria-label="Cara menentukan kurs"
                value={draft.mode_kurs ?? "otomatis"}
                onValueChange={set("mode_kurs")}
                options={[
                  { value: "otomatis", label: "Otomatis" },
                  { value: "manual", label: "Atur sendiri" },
                ]}
                className="lg:w-64"
              />
            </div>

            {otomatis ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="flex items-center justify-between gap-3 rounded-lg bg-canvas p-3.5">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-semibold">Kurs pasar</span>
                    <span className="text-xs text-ink-muted">
                      {settings.kurs_pasar_diperbarui
                        ? `exchangerate-api, update ${formatStampWib(settings.kurs_pasar_diperbarui)}`
                        : "belum pernah diperbarui"}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-lg font-extrabold">{formatIdr(settings.kurs_pasar)}</span>
                    <button
                      type="button"
                      aria-label="Perbarui kurs pasar sekarang"
                      onClick={perbaruiKurs}
                      disabled={refreshing}
                      className="inline-flex size-tap items-center justify-center rounded-full text-ink-muted hover:bg-track hover:text-ink disabled:opacity-50"
                    >
                      <RefreshCw aria-hidden className={refreshing ? "size-4.5 animate-spin" : "size-4.5"} strokeWidth={2} />
                    </button>
                  </span>
                </div>
                <Field label="Selisih kurs Payoneer" htmlFor={`${ids}-selisih`} hint="Kurs Payoneer = kurs pasar − selisih">
                  <DecimalInput
                    id={`${ids}-selisih`}
                    prefix="− Rp"
                    integer
                    value={draft.selisih_payoneer}
                    onValueChange={set("selisih_payoneer")}
                  />
                </Field>
              </div>
            ) : (
              <Field
                label="Kurs Payoneer per dolar"
                htmlFor={`${ids}-manual`}
                hint={`Dipakai sampai kamu ganti lagi. Kurs pasar terakhir ${formatIdr(settings.kurs_pasar)}.`}
              >
                <MoneyInput
                  id={`${ids}-manual`}
                  currency="idr"
                  value={draft.kurs_payoneer_manual}
                  onValueChange={set("kurs_payoneer_manual")}
                />
              </Field>
            )}

            <div className="flex items-baseline justify-between gap-3 border-t border-divider pt-3.5">
              <span className="text-sm font-semibold">Kurs Payoneer yang dipakai</span>
              <span className="text-xl font-extrabold">{formatIdr(kurs)}</span>
            </div>
          </Card>

          <Card aria-labelledby={`${ids}-potongan`} className="flex flex-col gap-4">
            <h2 id={`${ids}-potongan`} className="text-md font-bold lg:text-lg">
              Potongan
            </h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
              <Field label="Admin Eldorado" htmlFor={`${ids}-admin`}>
                <DecimalInput id={`${ids}-admin`} suffix="%" value={draft.admin_pct} onValueChange={set("admin_pct")} />
              </Field>
              <Field label="Potong tarik Payoneer" htmlFor={`${ids}-tarik`}>
                <DecimalInput
                  id={`${ids}-tarik`}
                  suffix="%"
                  value={draft.potongan_tarik_pct}
                  onValueChange={set("potongan_tarik_pct")}
                />
              </Field>
              <Field label="Biaya tetap per penarikan" htmlFor={`${ids}-tetap`}>
                <DecimalInput
                  id={`${ids}-tetap`}
                  prefix="$"
                  tone="usd"
                  value={draft.potongan_tarik_usd}
                  onValueChange={set("potongan_tarik_usd")}
                />
              </Field>
            </div>
          </Card>

          <Card aria-labelledby={`${ids}-restock`} className="flex flex-col gap-4">
            <div className="flex flex-col gap-0.5">
              <h2 id={`${ids}-restock`} className="text-md font-bold lg:text-lg">
                Stok dan saran restock
              </h2>
              <p className="text-sm text-ink-muted">Batas peringatan dan kuadran restock di Analytics</p>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:gap-4">
              <Field label="Hold default" htmlFor={`${ids}-hold`} hint="dihitung dari tanggal beli">
                <DecimalInput
                  id={`${ids}-hold`}
                  integer
                  suffix="hari"
                  value={draft.hold_default_hari}
                  onValueChange={set("hold_default_hari")}
                />
              </Field>
              <Field label="Stok dianggap lama" htmlFor={`${ids}-lama`} hint="ditandai merah di Stok">
                <DecimalInput
                  id={`${ids}-lama`}
                  integer
                  suffix="hari"
                  value={draft.stok_lama_hari}
                  onValueChange={set("stok_lama_hari")}
                />
              </Field>
              <Field label="Batas laku" htmlFor={`${ids}-laku`} hint="sumbu datar kuadran">
                <DecimalInput id={`${ids}-laku`} suffix="%" value={draft.batas_laku_pct} onValueChange={set("batas_laku_pct")} />
              </Field>
              <Field label="Batas laba per akun" htmlFor={`${ids}-laba`} hint="sumbu tegak kuadran">
                <DecimalInput
                  id={`${ids}-laba`}
                  integer
                  prefix="Rp"
                  value={draft.batas_laba_idr}
                  onValueChange={set("batas_laba_idr")}
                />
              </Field>
              <Field label="Batas modal tertahan" htmlFor={`${ids}-tertahan`} hint="lewat batas = tahan restock">
                <DecimalInput
                  id={`${ids}-tertahan`}
                  suffix="%"
                  value={draft.batas_modal_tertahan_pct}
                  onValueChange={set("batas_modal_tertahan_pct")}
                />
              </Field>
              <Field label="Data cukup mulai" htmlFor={`${ids}-min`} hint="di bawahnya: data belum cukup">
                <DecimalInput
                  id={`${ids}-min`}
                  integer
                  suffix="akun"
                  value={draft.min_akun_data}
                  onValueChange={set("min_akun_data")}
                />
              </Field>
              <Field label="Target laba" htmlFor={`${ids}-margin`} hint="untuk harga beli maksimal">
                <DecimalInput
                  id={`${ids}-margin`}
                  suffix="%"
                  value={draft.target_margin_pct}
                  onValueChange={set("target_margin_pct")}
                />
              </Field>
              <Field label="Porsi reinvest" htmlFor={`${ids}-reinvest`} hint="dari rata-rata laba 4 minggu">
                <DecimalInput
                  id={`${ids}-reinvest`}
                  suffix="%"
                  value={draft.porsi_reinvest_pct}
                  onValueChange={set("porsi_reinvest_pct")}
                />
              </Field>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-8">
          <Receipt title="Contoh tarik $100" titleId={`${ids}-contoh`}>
            <ReceiptRows>
              <ReceiptRow label="Dolar ditarik" value={<span className="text-teal">{formatUsd(100)}</span>} />
              <ReceiptRow op="−" label={`Potong tarik ${tarikPct}%`} value={<span className="text-teal">{formatUsd(-potong)}</span>} />
              <ReceiptRow op="−" label="Biaya tetap" value={<span className="text-teal">{formatUsd(-tarikUsd)}</span>} />
              <ReceiptRow op="×" label="Kurs Payoneer" value={formatIdr(kurs)} />
            </ReceiptRows>
            <ReceiptDivider />
            <ReceiptTotal label="Rupiah diterima" value={formatIdr(sisa * kurs)} />
            <p className="text-sm text-ink-muted">
              Setiap $1 harga jual jadi {formatIdr((1 - admin / 100) * (1 - tarikPct / 100) * kurs)} setelah admin {admin}%.
            </p>
          </Receipt>
          {error && (
            <p role="alert" className="text-sm font-semibold text-loss">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" size="lg" disabled={pending}>
            {pending ? "Menyimpan…" : "Simpan pengaturan"}
          </Button>
          <p className="text-sm text-ink-muted">
            Penjualan lama tetap memakai kurs saat transaksi, jadi laporan minggu lalu tidak berubah.
          </p>
        </div>
      </form>

      <div className="grid items-start gap-5.5 lg:grid-cols-2 lg:gap-7">
        <GamesCard games={games} />
        <StoresCard stores={stores} />
      </div>

      <Card aria-labelledby={`${ids}-akun`} className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-0.5">
          <h2 id={`${ids}-akun`} className="text-md font-bold lg:text-lg">
            Akun
          </h2>
          <p className="text-sm text-ink-muted">Masuk sebagai {email}</p>
        </div>
        <form action={signOut}>
          <Button type="submit">Keluar</Button>
        </form>
      </Card>
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// Games and stores
// ---------------------------------------------------------------------------

function ListCard({
  id,
  title,
  subtitle,
  onAdd,
  addLabel,
  children,
}: {
  id: string;
  title: string;
  subtitle: string;
  onAdd: () => void;
  addLabel: string;
  children: ReactNode;
}) {
  return (
    <Card id={id} aria-labelledby={`${id}-judul`} className="flex scroll-mt-8 flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id={`${id}-judul`} className="text-md font-bold lg:text-lg">
            {title}
          </h2>
          <p className="text-sm text-ink-muted">{subtitle}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onAdd}>
          {addLabel}
        </Button>
      </div>
      <ul className="flex flex-col">{children}</ul>
    </Card>
  );
}

function GamesCard({ games }: { games: Game[] }) {
  const [editing, setEditing] = useState<Game | "baru" | null>(null);
  const aktif = games.filter((g) => g.aktif).length;
  return (
    <>
      <ListCard
        id="game"
        title="Daftar game"
        subtitle={`${aktif} game aktif. Singkatan dipakai untuk kode akun.`}
        onAdd={() => setEditing("baru")}
        addLabel="Tambah game"
      >
        {games.map((g) => (
          <li key={g.id} className="border-t border-divider first:border-t-0">
            <button
              type="button"
              onClick={() => setEditing(g)}
              className="flex min-h-14 w-full items-center gap-3 py-2 text-left hover:bg-track/40"
            >
              <span className="w-14 shrink-0 text-sm font-extrabold text-ink-tag">{g.singkatan}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-base font-semibold">{g.nama}</span>
                <span className="text-xs text-ink-muted">
                  {g.satuan_varian ? `Varian: ${g.satuan_varian}` : "Tanpa satuan varian"} · kode berikutnya {g.singkatan}-
                  {String(g.next_seq).padStart(4, "0")}
                </span>
              </span>
              {!g.aktif && <Badge tone="gray">Nonaktif</Badge>}
              <span className="text-sm font-semibold text-teal">Ubah</span>
            </button>
          </li>
        ))}
      </ListCard>
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing === "baru" ? "Tambah game" : "Ubah game"}
        placement="responsive"
      >
        {editing !== null && (
          <GameForm key={editing === "baru" ? "baru" : editing.id} game={editing === "baru" ? null : editing} onDone={() => setEditing(null)} />
        )}
      </Dialog>
    </>
  );
}

function GameForm({ game, onDone }: { game: Game | null; onDone: () => void }) {
  const ids = useId();
  const toast = useToast();
  const [nama, setNama] = useState(game?.nama ?? "");
  const [singkatan, setSingkatan] = useState(game?.singkatan ?? "");
  const [satuan, setSatuan] = useState(game?.satuan_varian ?? "");
  const [aktif, setAktif] = useState(game?.aktif ?? true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const res = await saveGame({ id: game?.id, nama, singkatan, satuanVarian: satuan, aktif });
          if (!res.ok) {
            setError(res.error);
            return;
          }
          toast({ title: game ? `${nama} disimpan` : `${nama} ditambahkan` });
          onDone();
        });
      }}
    >
      <Field label="Nama game" htmlFor={`${ids}-nama`}>
        <Input id={`${ids}-nama`} required value={nama} onChange={(e) => setNama(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Singkatan"
          htmlFor={`${ids}-singkat`}
          hint={game ? "Kode lama tidak ikut berubah" : "Untuk kode akun, mis. AV"}
        >
          <Input
            id={`${ids}-singkat`}
            required
            maxLength={6}
            autoCapitalize="characters"
            value={singkatan}
            onChange={(e) => setSingkatan(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          />
        </Field>
        <Field label="Satuan varian" htmlFor={`${ids}-satuan`} optional hint="mis. Monarch, Ruler">
          <Input id={`${ids}-satuan`} value={satuan} onChange={(e) => setSatuan(e.target.value)} />
        </Field>
      </div>
      <div className="flex flex-col gap-1.5">
        <GroupLabel id={`${ids}-aktif`}>Status</GroupLabel>
        <ChoiceGroup
          aria-labelledby={`${ids}-aktif`}
          value={aktif ? "aktif" : "nonaktif"}
          onValueChange={(v) => setAktif(v === "aktif")}
          options={[
            { value: "aktif", label: "Aktif" },
            { value: "nonaktif", label: "Nonaktif", description: "hilang dari form tambah stok" },
          ]}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-loss">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? "Menyimpan…" : "Simpan game"}
      </Button>
    </form>
  );
}

function StoresCard({ stores }: { stores: Store[] }) {
  const [editing, setEditing] = useState<Store | "baru" | null>(null);
  return (
    <>
      <ListCard
        id="toko"
        title="Toko"
        subtitle="Setiap toko punya balance sendiri"
        onAdd={() => setEditing("baru")}
        addLabel="Tambah toko"
      >
        {stores.map((s) => (
          <li key={s.id} className="border-t border-divider first:border-t-0">
            <button
              type="button"
              onClick={() => setEditing(s)}
              className="flex min-h-14 w-full items-center gap-3 py-2 text-left hover:bg-track/40"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-base font-semibold">{s.nama}</span>
                <span className="text-xs text-ink-muted">
                  {s.platform}, saldo awal {formatUsd(s.saldo_awal_usd)}
                </span>
              </span>
              {!s.aktif && <Badge tone="gray">Nonaktif</Badge>}
              <span className="text-sm font-semibold text-teal">Ubah</span>
            </button>
          </li>
        ))}
      </ListCard>
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing === "baru" ? "Tambah toko" : "Ubah toko"}
        placement="responsive"
      >
        {editing !== null && (
          <StoreForm key={editing === "baru" ? "baru" : editing.id} store={editing === "baru" ? null : editing} onDone={() => setEditing(null)} />
        )}
      </Dialog>
    </>
  );
}

function StoreForm({ store, onDone }: { store: Store | null; onDone: () => void }) {
  const ids = useId();
  const toast = useToast();
  const [nama, setNama] = useState(store?.nama ?? "");
  const [saldoAwal, setSaldoAwal] = useState<number | null>(store?.saldo_awal_usd ?? 0);
  const [aktif, setAktif] = useState(store?.aktif ?? true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const res = await saveStore({ id: store?.id, nama, saldoAwal: saldoAwal ?? 0, aktif });
          if (!res.ok) {
            setError(res.error);
            return;
          }
          toast({ title: store ? `${nama} disimpan` : `${nama} ditambahkan` });
          onDone();
        });
      }}
    >
      <Field label="Nama toko" htmlFor={`${ids}-nama`}>
        <Input id={`${ids}-nama`} required value={nama} onChange={(e) => setNama(e.target.value)} />
      </Field>
      <Field
        label="Saldo awal"
        htmlFor={`${ids}-saldo`}
        hint="Saldo sebelum mulai dicatat di aplikasi. Untuk koreksi sesudahnya, pakai penyesuaian di Balance."
      >
        <MoneyInput id={`${ids}-saldo`} currency="usd" value={saldoAwal} onValueChange={setSaldoAwal} />
      </Field>
      <div className="flex flex-col gap-1.5">
        <GroupLabel id={`${ids}-aktif`}>Status</GroupLabel>
        <ChoiceGroup
          aria-labelledby={`${ids}-aktif`}
          value={aktif ? "aktif" : "nonaktif"}
          onValueChange={(v) => setAktif(v === "aktif")}
          options={[
            { value: "aktif", label: "Aktif" },
            { value: "nonaktif", label: "Nonaktif" },
          ]}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-loss">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? "Menyimpan…" : "Simpan toko"}
      </Button>
    </form>
  );
}
