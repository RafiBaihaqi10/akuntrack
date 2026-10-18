import "server-only";
import { cache } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import type {
  AccountRow,
  BalanceAdjustment,
  Game,
  GamePerformance,
  Settings,
  Store,
  StoreBalance,
  WeeklyReport,
  Withdrawal,
} from "@/lib/db-types";
import { createClient } from "@/lib/supabase/server";

// Read side of the Data Access Layer. Every query runs as the signed-in user,
// so Row Level Security limits results to their own rows. All of these read
// cookies: render them inside a <Suspense> boundary.

/** Verified user + Supabase client, shared by every query in one request. */
const db = cache(async () => {
  await getCurrentUser();
  return createClient();
});

class QueryError extends Error {
  constructor(what: string, cause: { message: string }) {
    super(`Gagal memuat ${what}: ${cause.message}`);
  }
}

/** PostgREST returns at most 1000 rows per request, so read big lists in pages. */
async function selectAll<T>(what: string, run: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>) {
  const size = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await run(from, from + size - 1);
    if (error) throw new QueryError(what, error);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < size) return rows;
  }
}

export const getSettings = cache(async (): Promise<Settings> => {
  const supabase = await db();
  const { data, error } = await supabase.from("settings").select("*").maybeSingle();
  if (error) throw new QueryError("pengaturan", error);
  if (!data) throw new Error("Pengaturan belum ada untuk akun ini. Jalankan ulang bootstrap user di Supabase.");
  return data as Settings;
});

export const getGames = cache(async (): Promise<Game[]> => {
  const supabase = await db();
  const { data, error } = await supabase.from("games").select("*").order("created_at").order("nama");
  if (error) throw new QueryError("daftar game", error);
  return data as Game[];
});

export const getStores = cache(async (): Promise<Store[]> => {
  const supabase = await db();
  const { data, error } = await supabase.from("stores").select("*").order("created_at").order("nama");
  if (error) throw new QueryError("daftar toko", error);
  return data as Store[];
});

export const getAccounts = cache(async (): Promise<AccountRow[]> => {
  const supabase = await db();
  return selectAll<AccountRow>("stok", (from, to) =>
    supabase
      .from("v_accounts")
      .select("*")
      .order("tanggal_beli", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .order("kode", { ascending: false })
      .range(from, to),
  );
});

export const getStoreBalances = cache(async (): Promise<StoreBalance[]> => {
  const supabase = await db();
  const { data, error } = await supabase.from("v_store_balance").select("*");
  if (error) throw new QueryError("balance toko", error);
  return data as StoreBalance[];
});

export const getWithdrawals = cache(async (): Promise<Withdrawal[]> => {
  const supabase = await db();
  return selectAll<Withdrawal>("riwayat penarikan", (from, to) =>
    supabase
      .from("withdrawals")
      .select("*")
      .order("tanggal", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(from, to),
  );
});

export const getAdjustments = cache(async (): Promise<BalanceAdjustment[]> => {
  const supabase = await db();
  const { data, error } = await supabase
    .from("balance_adjustments")
    .select("*")
    .order("tanggal", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new QueryError("penyesuaian saldo", error);
  return data as BalanceAdjustment[];
});

export const getWeeklyReport = cache(async (): Promise<WeeklyReport[]> => {
  const supabase = await db();
  const { data, error } = await supabase.from("v_weekly_report").select("*").order("minggu_mulai");
  if (error) throw new QueryError("laporan mingguan", error);
  return data as WeeklyReport[];
});

export const getGamePerformance = cache(async (): Promise<GamePerformance[]> => {
  const supabase = await db();
  const { data, error } = await supabase.from("v_game_performance").select("*").order("nama");
  if (error) throw new QueryError("kinerja game", error);
  return data as GamePerformance[];
});
