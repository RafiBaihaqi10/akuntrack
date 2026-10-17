"use client";

import { Clock, Package, ChartPie, SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Amount } from "@/components/ui/amount";
import { Badge, GameMark, QuadrantChip, StatusChip } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card, EmptyState, Meter, PageHeader, SectionHeader, StatTile } from "@/components/ui/card";
import { ChoiceGroup, FilterChips, SegmentedControl } from "@/components/ui/choice";
import { Dialog } from "@/components/ui/dialog";
import { Field, GroupLabel } from "@/components/ui/field";
import { AffixInput, Input, Select, Textarea } from "@/components/ui/input";
import { DividedList, IconCircle, LinkRow } from "@/components/ui/list";
import { MoneyInput } from "@/components/ui/money-input";
import { Receipt, ReceiptDivider, ReceiptRow, ReceiptRows, ReceiptTotal } from "@/components/ui/receipt";
import { CellStack, Table, TBody, Td, TFoot, TfCell, Th, THead, Tr } from "@/components/ui/table";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { ACCOUNT_STATUSES, QUADRANTS } from "@/lib/domain";

const SWATCHES: { name: string; className: string }[] = [
  { name: "canvas", className: "bg-canvas" },
  { name: "surface", className: "bg-surface" },
  { name: "field", className: "bg-field" },
  { name: "track", className: "bg-track" },
  { name: "disabled", className: "bg-disabled" },
  { name: "ink", className: "bg-ink" },
  { name: "ink-muted", className: "bg-ink-muted" },
  { name: "line", className: "bg-line" },
  { name: "divider", className: "bg-divider" },
  { name: "gold", className: "bg-gold" },
  { name: "teal", className: "bg-teal" },
  { name: "profit", className: "bg-profit" },
  { name: "loss", className: "bg-loss" },
  { name: "warn", className: "bg-warn" },
];

export function Showcase() {
  return (
    <ToastProvider>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-gutter py-8 lg:px-10">
        <PageHeader
          title="Komponen"
          subtitle="Design tokens dan komponen dasar AkunTrack (hanya di mode dev)"
        />
        <Tokens />
        <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-2">
          <Buttons />
          <Forms />
          <Choices />
          <Chips />
          <ReceiptDemo />
          <Lists />
        </div>
        <TableDemo />
        <Overlays />
      </main>
    </ToastProvider>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-md font-bold">{title}</h2>
      {children}
    </Card>
  );
}

function Tokens() {
  return (
    <Block title="Warna dan tipografi">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-7">
        {SWATCHES.map((s) => (
          <div key={s.name} className="flex flex-col gap-1">
            <span className={`h-12 rounded-lg border border-divider ${s.className}`} />
            <span className="text-xs text-ink-muted">{s.name}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-5xl font-extrabold tracking-tight text-profit">Rp2.073.256</span>
        <span className="text-3xl font-extrabold tracking-tight">Minggu ini</span>
        <span className="text-md font-bold">Struk laba (judul seksi)</span>
        <span className="text-base font-semibold">Penjualan bersih (body)</span>
        <span className="text-xs text-ink-muted">5 akun terjual, sudah dipotong admin 15% (caption)</span>
      </div>
    </Block>
  );
}

function Buttons() {
  return (
    <Block title="Button">
      <Button variant="primary" size="lg">
        Simpan penjualan
      </Button>
      <Button variant="primary" size="lg" disabled>
        Isi harga jual dulu
      </Button>
      <div className="flex flex-wrap items-center gap-2">
        <Button>Tandai terjual</Button>
        <Button variant="outline" size="sm">
          Terjual
        </Button>
        <Button variant="ghost">Batal</Button>
        <Button variant="link">Buka balance</Button>
        <IconButton aria-label="Pengaturan" bordered>
          <SlidersHorizontal className="size-5" strokeWidth={1.8} />
        </IconButton>
      </div>
    </Block>
  );
}

function Forms() {
  const [jual, setJual] = useState<number | null>(70);
  const [beli, setBeli] = useState<number | null>(80000);
  return (
    <Block title="Input">
      <Field label="Harga jual di Eldorado" htmlFor="demo-jual">
        <MoneyInput id="demo-jual" currency="usd" emphasis value={jual} onValueChange={setJual} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Harga beli" htmlFor="demo-beli">
          <MoneyInput id="demo-beli" currency="idr" value={beli} onValueChange={setBeli} />
        </Field>
        <Field label="Admin Eldorado" htmlFor="demo-admin">
          <AffixInput id="demo-admin" suffix="%" defaultValue="15" inputMode="decimal" />
        </Field>
      </div>
      <p className="text-xs text-ink-muted">
        Nilai terbaca: <Amount value={jual} currency="usd" /> dan <Amount value={beli} currency="idr" />
      </p>
      <Field label="Game" htmlFor="demo-game">
        <Select id="demo-game" defaultValue="Anime Vanguard">
          <option>Anime Vanguard</option>
          <option>VBL</option>
          <option>UTDX</option>
        </Select>
      </Field>
      <Field label="Username" htmlFor="demo-user" error="Username ini sudah pernah dicatat di VBL">
        <Input id="demo-user" defaultValue="saipulgg505" aria-invalid />
      </Field>
      <Field label="Catatan" htmlFor="demo-catatan" optional>
        <Textarea id="demo-catatan" placeholder="mis. masih di-grind, target 8 Monarch" />
      </Field>
      <Field label="Tanggal beli" htmlFor="demo-tgl">
        <Input id="demo-tgl" type="date" defaultValue="2026-10-16" />
      </Field>
    </Block>
  );
}

function Choices() {
  const [mode, setMode] = useState<"satu" | "banyak">("satu");
  const [src, setSrc] = useState<"Beli" | "Grind">("Beli");
  const [toko, setToko] = useState<"Zeron" | "Realm">("Zeron");
  const [filter, setFilter] = useState("Semua");
  return (
    <Block title="Pilihan">
      <SegmentedControl
        aria-label="Mode input"
        value={mode}
        onValueChange={setMode}
        options={[
          { value: "satu", label: "Satu akun" },
          { value: "banyak", label: "Banyak sekaligus" },
        ]}
      />
      <div className="flex flex-col gap-1.5">
        <GroupLabel id="demo-sumber">Sumber</GroupLabel>
        <ChoiceGroup
          aria-labelledby="demo-sumber"
          value={src}
          onValueChange={setSrc}
          options={[
            { value: "Beli", label: "Beli" },
            { value: "Grind", label: "Grind sendiri" },
          ]}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <GroupLabel id="demo-toko">Dari toko</GroupLabel>
        <ChoiceGroup
          aria-labelledby="demo-toko"
          value={toko}
          onValueChange={setToko}
          options={[
            { value: "Zeron", label: "Zeron", description: "saldo $68,05" },
            { value: "Realm", label: "Realm", description: "saldo $35,70" },
          ]}
        />
      </div>
      <FilterChips
        aria-label="Filter status"
        value={filter}
        onValueChange={setFilter}
        options={[
          { value: "Semua", label: "Semua", count: 67 },
          { value: "Belum Sold", label: "Belum Sold", count: 29 },
          { value: "Hold", label: "Hold", count: 32 },
          { value: "Belum Post", label: "Belum Post", count: 3 },
          { value: "Update", label: "Update", count: 3 },
        ]}
      />
    </Block>
  );
}

function Chips() {
  return (
    <Block title="Chip dan angka">
      <div className="flex flex-wrap gap-2">
        {ACCOUNT_STATUSES.map((s) => (
          <StatusChip key={s} status={s} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {QUADRANTS.map((q) => (
          <QuadrantChip key={q} quadrant={q} />
        ))}
        <Badge>5 Monarch</Badge>
        <Badge>Madara</Badge>
      </div>
      <div className="flex items-center gap-3">
        <GameMark abbr="AV" />
        <GameMark abbr="VBL" />
        <GameMark abbr="UTDX" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <StatTile
          label="Modal keluar"
          value={<Amount value={664000} currency="idr" />}
          sub="beli 4 akun baru"
        />
        <StatTile
          label="Cash flow"
          value={<Amount value={840000} currency="idr" tone="profit" signed />}
          sub="tarik $100 jadi Rp1.504.000"
        />
        <StatTile label="Zeron" value={<Amount value={68.05} currency="usd" />} />
        <StatTile label="Rugi HB" value={<Amount value={-401000} currency="idr" tone="profit" compact />} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">VBL Rp2,39 jt</span>
        <Meter value={0.46} tone="loss" label="VBL 46% dari modal stok" />
        <span className="text-sm font-semibold">Anime Vanguard Rp1,06 jt</span>
        <Meter value={0.2} label="Anime Vanguard 20% dari modal stok" />
      </div>
    </Block>
  );
}

function ReceiptDemo() {
  return (
    <div className="flex flex-col gap-4">
      <Receipt title="Struk laba" titleId="demo-struk" meta="update 16 Okt, 21.40">
        <ReceiptRows>
          <ReceiptRow
            label="Penjualan bersih"
            sub="5 akun terjual, sudah dipotong admin 15%"
            value={<Amount value={170.85} currency="usd" />}
          />
          <ReceiptRow
            op="×"
            label="Rp15.360 per dolar"
            sub="kurs Payoneer Rp16.000, potong tarik 4%"
            value="Rp2.624.256"
          />
          <ReceiptRow op="−" label="Modal akun yang terjual" sub="harga beli 5 akun tadi" value="Rp519.000" />
          <ReceiptRow
            op="−"
            label="Koreksi penarikan"
            sub="$2 dan selisih kurs, 1 penarikan"
            value="Rp32.000"
          />
        </ReceiptRows>
        <ReceiptDivider />
        <ReceiptTotal
          label="Laba"
          size="hero"
          value={<Amount value={2073256} currency="idr" tone="profit" />}
        />
      </Receipt>
      <EmptyState>Tidak ada akun dengan status ini. Pilih status lain atau tambah stok baru.</EmptyState>
    </div>
  );
}

function Lists() {
  return (
    <Block title="Daftar">
      <SectionHeader title="Perlu dicek" action={<Button variant="link">Buka stok</Button>} />
      <DividedList>
        <li>
          <LinkRow
            href="#"
            icon={
              <IconCircle tone="gold">
                <Clock strokeWidth={1.9} />
              </IconCircle>
            }
            title="2 akun Hold lewat 1 minggu"
            description="saipulgg505 dan 7acc_vb di VBL"
          />
        </li>
        <li>
          <LinkRow
            href="#"
            icon={
              <IconCircle tone="red">
                <ChartPie strokeWidth={1.9} />
              </IconCircle>
            }
            title="VBL menahan 46% modal stok"
            description="36 akun, Rp2,39 jt. Saran: tahan restock dulu"
          />
        </li>
        <li>
          <LinkRow
            href="#"
            icon={
              <IconCircle tone="teal">
                <Package strokeWidth={1.9} />
              </IconCircle>
            }
            title="67 akun di stok"
            description="Modal tertahan Rp5,22 jt"
            trailing="Buka stok"
          />
        </li>
      </DividedList>
    </Block>
  );
}

function TableDemo() {
  const rows = [
    {
      tgl: "16 Okt",
      isi: "9 Monarch (Gojo vs Sukuna + Escanor)",
      kode: "AV-0072 telumari",
      jual: 80,
      net: 68,
      laba: 942480,
    },
    {
      tgl: "14 Okt",
      isi: "Ronin + Kisuki + Sanju",
      kode: "VBL-0107 WALDEX999",
      jual: 25,
      net: 21.25,
      laba: 201400,
    },
    { tgl: "12 Okt", isi: "TSH + Sanju", kode: "VBL-0102 Trabumbum", jual: 16, net: 13.6, laba: -12000 },
  ];
  return (
    <Card>
      <h2 className="mb-2 text-md font-bold">Table</h2>
      <Table>
        <THead>
          <Tr>
            <Th>Tanggal</Th>
            <Th>Akun</Th>
            <Th className="text-right">Harga jual</Th>
            <Th className="text-right">Net</Th>
            <Th className="text-right">Laba</Th>
          </Tr>
        </THead>
        <TBody>
          {rows.map((r) => (
            <Tr key={r.kode}>
              <Td className="text-ink-muted">{r.tgl}</Td>
              <Td>
                <CellStack primary={r.isi} secondary={r.kode} />
              </Td>
              <Td className="text-right">
                <Amount value={r.jual} currency="usd" />
              </Td>
              <Td className="text-right">
                <Amount value={r.net} currency="usd" />
              </Td>
              <Td className="text-right font-bold">
                <Amount value={r.laba} currency="idr" tone="profit" />
              </Td>
            </Tr>
          ))}
        </TBody>
        <TFoot>
          <Tr>
            <Th scope="row" colSpan={2} className="border-0">
              Total 3 akun
            </Th>
            <TfCell className="text-right">
              <Amount value={121} currency="usd" />
            </TfCell>
            <TfCell className="text-right">
              <Amount value={102.85} currency="usd" />
            </TfCell>
            <TfCell className="text-right">
              <Amount value={1131880} currency="idr" tone="profit" />
            </TfCell>
          </Tr>
        </TFoot>
      </Table>
    </Card>
  );
}

function Overlays() {
  const [open, setOpen] = useState<null | "center" | "sheet" | "side" | "responsive">(null);
  const toast = useToast();
  return (
    <Block title="Modal, sheet, panel, toast">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setOpen("center")}>Modal tengah</Button>
        <Button onClick={() => setOpen("sheet")}>Bottom sheet</Button>
        <Button onClick={() => setOpen("side")}>Panel kanan</Button>
        <Button onClick={() => setOpen("responsive")}>Responsif</Button>
        <Button
          onClick={() =>
            toast({
              title: "VBL-0083 jadi Belum Sold",
              action: { label: "Urungkan", onClick: () => toast({ title: "Status dikembalikan ke Hold" }) },
            })
          }
        >
          Toast + undo
        </Button>
      </div>
      <Dialog
        open={open !== null}
        onOpenChange={(o) => !o && setOpen(null)}
        placement={open ?? "responsive"}
        title="Catat penarikan"
        description="Contoh isi dialog"
        footer={
          <Button variant="primary" size="lg" onClick={() => setOpen(null)}>
            Simpan penarikan
          </Button>
        }
      >
        <Field label="Dolar ditarik" htmlFor="demo-usd">
          <AffixInput id="demo-usd" prefix="$" tone="usd" defaultValue="60" />
        </Field>
        <Field label="Rupiah diterima" htmlFor="demo-idr">
          <AffixInput id="demo-idr" prefix="Rp" placeholder="cek mutasi bank" />
        </Field>
      </Dialog>
    </Block>
  );
}
