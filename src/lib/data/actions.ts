"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { todayWib } from "@/lib/dates";
import { ACCOUNT_SOURCES, ACCOUNT_STATUSES, type AccountStatus } from "@/lib/domain";
import { jumlahVarianFor, parseIsiAkun } from "@/lib/isi-akun";
import { createClient } from "@/lib/supabase/server";

// Write side of the Data Access Layer. Every action re-checks the session
// (actions are reachable by direct POST) and runs as the user, so RLS and the
// database triggers enforce ownership and business rules.

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

class ActionError extends Error {}

async function authedClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) throw new ActionError("Sesi habis. Masuk lagi untuk melanjutkan.");
  return supabase;
}

/** Messages for constraint names, so database errors read as plain Indonesian. */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  accounts_tanggal_beli_wajib: "Tanggal beli wajib diisi",
  accounts_toko_wajib: "Pilih toko untuk akun ini",
  accounts_grind_modal_nol: "Akun hasil grind harga belinya Rp0",
  accounts_user_kode_key: "Kode akun sudah dipakai",
  sales_lengkap: "Harga jual, tanggal terjual, dan toko wajib diisi",
  withdrawals_tanggal_wajib: "Tanggal uang masuk wajib diisi",
  settings_kurs_manual_wajib: "Isi kurs Payoneer kalau mode kurs diatur sendiri",
  games_user_nama_key: "Nama game itu sudah ada",
  games_user_singkatan_key: "Singkatan itu sudah dipakai game lain",
  games_singkatan_check: "Singkatan hanya huruf besar dan angka, maksimal 6",
  stores_user_nama_key: "Nama toko itu sudah ada",
  balance_adjustments_usd_check: "Jumlah penyesuaian tidak boleh nol",
};

function friendly(error: { message: string; code?: string }) {
  for (const [name, message] of Object.entries(CONSTRAINT_MESSAGES)) {
    if (error.message.includes(name)) return message;
  }
  // Messages raised by our own functions are already Indonesian.
  const ours = ["23514", "23503", "P0001", "P0002"].includes(error.code ?? "") && !error.message.includes("violates");
  return ours ? error.message : "Gagal menyimpan. Coba lagi sebentar lagi.";
}

/** Runs an action body, refreshes the page data on success and turns errors into messages. */
async function run<T>(fn: () => Promise<T>, changed: (data: T) => boolean = () => true): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    if (changed(data)) refresh();
    return { ok: true, data };
  } catch (e) {
    if (e instanceof ActionError) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Data belum lengkap" };
    console.error(e);
    return { ok: false, error: "Gagal menyimpan. Coba lagi sebentar lagi." };
  }
}

function check<T>(result: { data: T; error: { message: string; code?: string } | null }): T {
  if (result.error) throw new ActionError(friendly(result.error));
  return result.data;
}

// ---------------------------------------------------------------------------
// Shared field schemas
// ---------------------------------------------------------------------------

const id = z.uuid("Data tidak valid");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal belum benar");
const notFuture = (label: string) =>
  isoDate.refine((d) => d <= todayWib(), `${label} tidak boleh di masa depan`);
const optionalText = z
  .string()
  .trim()
  .max(500, "Teks terlalu panjang")
  .nullish()
  .transform((v) => v || null);
const rupiah = z.number().int("Rupiah harus bilangan bulat").min(0, "Rupiah tidak boleh minus");
const dollars = z.number().min(0, "Dolar tidak boleh minus").max(100_000, "Angka dolar terlalu besar");

// ---------------------------------------------------------------------------
// Stok
// ---------------------------------------------------------------------------

async function satuanOf(supabase: Awaited<ReturnType<typeof authedClient>>, gameId: string) {
  const game = check(await supabase.from("games").select("satuan_varian").eq("id", gameId).maybeSingle());
  if (!game) throw new ActionError("Game tidak ditemukan");
  return game.satuan_varian as string | null;
}

const NEW_STATUSES = ["Belum Post", "Belum Sold", "Hold"] as const;

const newAccounts = z.object({
  gameId: id,
  storeId: z.uuid("Pilih toko"),
  isiAkun: z.string().trim().min(1, "Isi akun wajib diisi").max(1000, "Isi akun terlalu panjang"),
  sumber: z.enum(ACCOUNT_SOURCES),
  dibeliDari: optionalText,
  hargaBeli: rupiah,
  tanggalBeli: notFuture("Tanggal beli"),
  hargaListing: dollars.nullable(),
  status: z.enum(NEW_STATUSES),
  catatan: optionalText,
  /** One entry per account; null means "username belum diisi". */
  usernames: z
    .array(z.string().trim().max(100).nullable())
    .min(1, "Isi minimal satu username")
    .max(200, "Maksimal 200 akun sekaligus"),
});

export type NewAccountsInput = z.input<typeof newAccounts>;

export async function createAccounts(input: NewAccountsInput) {
  return run(async () => {
    const v = newAccounts.parse(input);
    const supabase = await authedClient();
    const parsed = parseIsiAkun(v.isiAkun);
    const jumlah = jumlahVarianFor(parsed, await satuanOf(supabase, v.gameId));
    const rows = v.usernames.map((username) => ({
      game_id: v.gameId,
      store_id: v.storeId,
      isi_akun: v.isiAkun,
      jumlah_varian: jumlah,
      tags: parsed.tags,
      username: username || null,
      sumber: v.sumber,
      dibeli_dari: v.sumber === "Beli" ? v.dibeliDari : null,
      harga_beli_idr: v.sumber === "Grind" ? 0 : v.hargaBeli,
      tanggal_beli: v.tanggalBeli,
      harga_listing_usd: v.hargaListing,
      status: v.status,
      catatan: v.catatan,
    }));
    const created = check(await supabase.from("accounts").insert(rows).select("id, kode"));
    return created as { id: string; kode: string }[];
  });
}

const EDITABLE_STATUSES = ACCOUNT_STATUSES.filter((s) => s !== "Sold") as Exclude<AccountStatus, "Sold">[];

const accountEdit = z.object({
  storeId: z.uuid("Pilih toko").nullable(),
  isiAkun: z.string().trim().min(1, "Isi akun wajib diisi").max(1000, "Isi akun terlalu panjang"),
  username: optionalText,
  sumber: z.enum(ACCOUNT_SOURCES),
  dibeliDari: optionalText,
  hargaBeli: rupiah,
  tanggalBeli: notFuture("Tanggal beli").nullable(),
  hargaListing: dollars.nullable(),
  /** Omitted for Sold accounts: a sale is changed through undo, not by editing. */
  status: z.enum(EDITABLE_STATUSES as [string, ...string[]]).optional(),
  holdSampai: isoDate.nullable(),
  catatan: optionalText,
});

export type AccountEditInput = z.input<typeof accountEdit>;

export async function updateAccount(accountId: string, input: AccountEditInput) {
  return run(async () => {
    const v = accountEdit.parse(input);
    const supabase = await authedClient();
    const current = check(
      await supabase.from("accounts").select("status, game_id, kode").eq("id", id.parse(accountId)).maybeSingle(),
    );
    if (!current) throw new ActionError("Akun tidak ditemukan");
    if (current.status === "Sold" && v.status && v.status !== "Sold") {
      throw new ActionError("Akun sudah terjual. Urungkan penjualannya dulu untuk mengubah status.");
    }

    const parsed = parseIsiAkun(v.isiAkun);
    const status = (current.status === "Sold" ? "Sold" : (v.status ?? current.status)) as AccountStatus;
    check(
      await supabase
        .from("accounts")
        .update({
          store_id: v.storeId,
          isi_akun: v.isiAkun,
          jumlah_varian: jumlahVarianFor(parsed, await satuanOf(supabase, current.game_id)),
          tags: parsed.tags,
          username: v.username,
          sumber: v.sumber,
          dibeli_dari: v.sumber === "Beli" ? v.dibeliDari : null,
          harga_beli_idr: v.sumber === "Grind" ? 0 : v.hargaBeli,
          tanggal_beli: v.tanggalBeli,
          harga_listing_usd: v.hargaListing,
          status,
          hold_sampai: status === "Hold" ? v.holdSampai : null,
          catatan: v.catatan,
        })
        .eq("id", accountId),
    );
    return { kode: current.kode as string, status, statusChanged: status !== current.status };
  });
}

export async function changeStatus(accountId: string, status: Exclude<AccountStatus, "Sold">) {
  return run(async () => {
    const supabase = await authedClient();
    const s = z.enum(EDITABLE_STATUSES as [string, ...string[]]).parse(status);
    const row = check(
      await supabase.from("accounts").update({ status: s }).eq("id", id.parse(accountId)).select("kode").maybeSingle(),
    );
    if (!row) throw new ActionError("Akun tidak ditemukan");
    return { kode: row.kode as string };
  });
}

export async function deleteAccount(accountId: string) {
  return run(async () => {
    const supabase = await authedClient();
    const row = check(
      await supabase.from("accounts").delete().eq("id", id.parse(accountId)).select("kode").maybeSingle(),
    );
    if (!row) throw new ActionError("Akun tidak ditemukan");
    return { kode: row.kode as string };
  });
}

const sale = z.object({
  accountId: id,
  hargaJual: z.number().positive("Harga jual wajib diisi").max(100_000, "Angka dolar terlalu besar"),
  tanggal: notFuture("Tanggal terjual"),
  storeId: z.uuid("Pilih toko tempat akun terjual"),
});

export async function markSold(input: z.input<typeof sale>) {
  return run(async () => {
    const v = sale.parse(input);
    const supabase = await authedClient();
    const row = check(
      await supabase.rpc("mark_sold", {
        p_account_id: v.accountId,
        p_harga_jual_usd: v.hargaJual,
        p_tanggal_terjual: v.tanggal,
        p_store_id: v.storeId,
      }),
    );
    return { netUsd: Number(row.net_usd), labaIdr: Number(row.laba_idr) };
  });
}

/** "Urungkan": restores the previous status (and removes the sale when undoing Sold). */
export async function undoStatus(accountId: string) {
  return run(async () => {
    const supabase = await authedClient();
    const restored = check(await supabase.rpc("undo_last_status_change", { p_account_id: id.parse(accountId) }));
    return { status: restored as AccountStatus };
  });
}

// ---------------------------------------------------------------------------
// Balance
// ---------------------------------------------------------------------------

const withdrawal = z.object({
  storeId: z.uuid("Pilih toko"),
  tanggal: notFuture("Tanggal uang masuk"),
  usd: z.number().positive("Isi jumlah dolar yang ditarik").max(1_000_000, "Angka dolar terlalu besar"),
  idr: rupiah.nullable(),
  catatan: optionalText,
});

export async function recordWithdrawal(input: z.input<typeof withdrawal>) {
  return run(async () => {
    const v = withdrawal.parse(input);
    const supabase = await authedClient();
    check(
      await supabase.rpc("record_withdrawal", {
        p_store_id: v.storeId,
        p_tanggal: v.tanggal,
        p_usd_ditarik: v.usd,
        p_idr_diterima: v.idr,
        p_catatan: v.catatan,
      }),
    );
    return null;
  });
}

const completion = z.object({
  id,
  idr: rupiah.positive("Isi rupiah yang diterima"),
  tanggal: notFuture("Tanggal uang masuk").nullable(),
});

/** "Isi rupiah" for an old withdrawal that was imported without rupiah or date. */
export async function completeWithdrawal(input: z.input<typeof completion>) {
  return run(async () => {
    const v = completion.parse(input);
    const supabase = await authedClient();
    const patch: Record<string, unknown> = { idr_diterima: v.idr };
    if (v.tanggal) patch.tanggal = v.tanggal;
    const row = check(await supabase.from("withdrawals").update(patch).eq("id", v.id).select("id").maybeSingle());
    if (!row) throw new ActionError("Penarikan tidak ditemukan");
    return null;
  });
}

const adjustment = z.object({
  storeId: z.uuid("Pilih toko"),
  tanggal: notFuture("Tanggal"),
  usd: z
    .number()
    .refine((n) => n !== 0, "Jumlah penyesuaian tidak boleh nol")
    .refine((n) => Math.abs(n) <= 100_000, "Angka dolar terlalu besar"),
  alasan: z.string().trim().min(1, "Tulis alasan penyesuaian").max(300, "Alasan terlalu panjang"),
});

export async function addAdjustment(input: z.input<typeof adjustment>) {
  return run(async () => {
    const v = adjustment.parse(input);
    const supabase = await authedClient();
    check(
      await supabase
        .from("balance_adjustments")
        .insert({ store_id: v.storeId, tanggal: v.tanggal, usd: v.usd, alasan: v.alasan }),
    );
    return null;
  });
}

// ---------------------------------------------------------------------------
// Pengaturan
// ---------------------------------------------------------------------------

const pct = (label: string) => z.number().min(0, `${label} tidak boleh minus`).max(100, `${label} maksimal 100%`);

const settingsInput = z.object({
  mode_kurs: z.enum(["otomatis", "manual"]),
  selisih_payoneer: rupiah,
  kurs_payoneer_manual: z.number().positive("Kurs Payoneer harus lebih dari nol").nullable(),
  admin_pct: pct("Admin"),
  potongan_tarik_pct: pct("Potongan tarik"),
  potongan_tarik_usd: z.number().min(0, "Biaya tetap tidak boleh minus").max(1000),
  hold_default_hari: z.number().int().min(1, "Lama hold minimal 1 hari").max(365),
  stok_lama_hari: z.number().int().min(1, "Batas stok lama minimal 1 hari").max(365),
  batas_laku_pct: pct("Batas laku"),
  batas_laba_idr: rupiah,
  batas_modal_tertahan_pct: pct("Batas modal tertahan"),
  min_akun_data: z.number().int().min(1, "Minimal 1 akun").max(1000),
  target_margin_pct: z.number().min(0, "Target margin tidak boleh minus").max(1000),
  porsi_reinvest_pct: pct("Porsi reinvest"),
});

export type SettingsInput = z.input<typeof settingsInput>;

export async function saveSettings(input: SettingsInput) {
  return run(async () => {
    const v = settingsInput.parse(input);
    if (v.mode_kurs === "manual" && !v.kurs_payoneer_manual) {
      throw new ActionError("Isi kurs Payoneer kalau mode kurs diatur sendiri");
    }
    const supabase = await authedClient();
    const { data: claims } = await supabase.auth.getClaims();
    check(await supabase.from("settings").update(v).eq("user_id", claims!.claims.sub));
    return null;
  });
}

/** Market rate older than this is refreshed automatically when the app opens. */
const KURS_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/** Updates kurs pasar from exchangerate-api (open endpoint, no key needed). */
export async function refreshKursPasar(force = false) {
  return run(async () => {
    const supabase = await authedClient();
    const current = check(
      await supabase.from("settings").select("user_id, kurs_pasar, kurs_pasar_diperbarui").maybeSingle(),
    );
    if (!current) throw new ActionError("Pengaturan belum ada");
    const last = current.kurs_pasar_diperbarui ? Date.parse(current.kurs_pasar_diperbarui) : 0;
    if (!force && Date.now() - last < KURS_MAX_AGE_MS) {
      return { kursPasar: Number(current.kurs_pasar), updated: false };
    }

    let idr: number | undefined;
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(8000) });
      const body = (await res.json()) as { result?: string; rates?: Record<string, number> };
      idr = body.result === "success" ? body.rates?.IDR : undefined;
    } catch {
      idr = undefined;
    }
    if (!idr || !Number.isFinite(idr) || idr < 1000) {
      throw new ActionError("Kurs pasar gagal diambil. Coba lagi nanti atau atur kurs sendiri.");
    }

    const kursPasar = Math.round(idr);
    check(
      await supabase
        .from("settings")
        .update({ kurs_pasar: kursPasar, kurs_pasar_diperbarui: new Date().toISOString() })
        .eq("user_id", current.user_id),
    );
    return { kursPasar, updated: true };
  }, (r) => r.updated);
}

const gameInput = z.object({
  id: id.optional(),
  nama: z.string().trim().min(1, "Nama game wajib diisi").max(60, "Nama game terlalu panjang"),
  singkatan: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,6}$/, "Singkatan hanya huruf besar dan angka, maksimal 6"),
  satuanVarian: optionalText,
  aktif: z.boolean(),
});

export async function saveGame(input: z.input<typeof gameInput>) {
  return run(async () => {
    const v = gameInput.parse(input);
    const supabase = await authedClient();
    const row = { nama: v.nama, singkatan: v.singkatan, satuan_varian: v.satuanVarian, aktif: v.aktif };
    if (v.id) check(await supabase.from("games").update(row).eq("id", v.id));
    else check(await supabase.from("games").insert(row));
    return null;
  });
}

const storeInput = z.object({
  id: id.optional(),
  nama: z.string().trim().min(1, "Nama toko wajib diisi").max(60, "Nama toko terlalu panjang"),
  saldoAwal: z.number().min(-1_000_000).max(1_000_000),
  aktif: z.boolean(),
});

export async function saveStore(input: z.input<typeof storeInput>) {
  return run(async () => {
    const v = storeInput.parse(input);
    const supabase = await authedClient();
    const row = { nama: v.nama, saldo_awal_usd: v.saldoAwal, aktif: v.aktif };
    if (v.id) check(await supabase.from("stores").update(row).eq("id", v.id));
    else check(await supabase.from("stores").insert(row));
    return null;
  });
}
