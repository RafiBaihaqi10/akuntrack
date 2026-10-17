// Validates supabase/migrations on PGlite (in-memory Postgres, WASM) with
// Supabase-like stubs for auth.users, auth.uid() and the anon/authenticated
// roles. It never connects to the real Supabase project.
// Run: npm run test:db
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIG = process.argv[2] ?? join(import.meta.dirname, "..", "migrations");
process.on("unhandledRejection", (e) => {
  console.log("UNCAUGHT:", e.message, e.where ?? "");
  process.exit(1);
});
const db = new PGlite();
let pass = 0,
  fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  → " + extra : ""}`);
};

const U1 = "11111111-1111-1111-1111-111111111111";
const U2 = "22222222-2222-2222-2222-222222222222";

// --- Supabase stubs -------------------------------------------------------
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  -- The owner exists before the migration runs (made in the dashboard)
  insert into auth.users values ('${U1}', 'owner@example.com');
`);

for (const f of readdirSync(MIG)
  .filter((f) => f.endsWith(".sql"))
  .sort()) {
  try {
    await db.exec(readFileSync(join(MIG, f), "utf8"));
    console.log(`applied ${f}`);
  } catch (e) {
    console.log(`MIGRATION ERROR in ${f}: ${e.message}`);
    process.exit(1);
  }
}

// New user after migration → trigger bootstrap
await db.exec(`insert into auth.users values ('${U2}', 'other@example.com');`);

async function as(uid, sql, params) {
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub', '${uid}', false); set role authenticated;`,
  );
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role;");
  }
}
async function asTx(uid, sql) {
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub', '${uid}', false); set role authenticated;`,
  );
  try {
    await db.exec(`begin; ${sql}; commit;`);
    return null;
  } catch (e) {
    await db.exec("rollback; reset role;").catch(() => {});
    return e.message;
  } finally {
    await db.exec("reset role;");
  }
}
const one = async (uid, sql, p) => (await as(uid, sql, p)).rows[0];

// --- Bootstrap ------------------------------------------------------------
for (const [u, label] of [
  [U1, "existing user"],
  [U2, "new user"],
]) {
  const r = await one(
    u,
    `select (select count(*) from games)::int g, (select count(*) from stores)::int s, (select count(*) from settings)::int c`,
  );
  ok(
    `bootstrap ${label}: 7 games, 2 stores, settings`,
    r.g === 7 && r.s === 2 && r.c === 1,
    JSON.stringify(r),
  );
}
const gid = async (u, singkatan) => (await one(u, `select id from games where singkatan=$1`, [singkatan])).id;
const sid = async (u, nama) => (await one(u, `select id from stores where nama=$1`, [nama])).id;
const AV = await gid(U1, "AV"),
  VBL = await gid(U1, "VBL"),
  ZERON = await sid(U1, "Zeron"),
  REALM = await sid(U1, "Realm");

// --- Kode akun per game -----------------------------------------------------
const ins = (u, cols) =>
  one(
    u,
    `insert into accounts (${Object.keys(cols)}) values (${Object.keys(cols).map((_, i) => "$" + (i + 1))}) returning *`,
    Object.values(cols),
  );
const a1 = await ins(U1, {
  game_id: AV,
  store_id: ZERON,
  isi_akun: "5 Monarch",
  harga_beli_idr: 100000,
  tanggal_beli: "2026-10-12",
  status: "Belum Sold",
});
const a2 = await ins(U1, { game_id: AV, store_id: ZERON, harga_beli_idr: 80000, tanggal_beli: "2026-10-13" });
const v1 = await ins(U1, {
  game_id: VBL,
  store_id: REALM,
  harga_beli_idr: 37000,
  tanggal_beli: "2026-10-14",
});
ok(
  "kode per game AV-0001, AV-0002, VBL-0001",
  a1.kode === "AV-0001" && a2.kode === "AV-0002" && v1.kode === "VBL-0001",
  `${a1.kode} ${a2.kode} ${v1.kode}`,
);
const u2acc = await ins(U2, {
  game_id: await gid(U2, "AV"),
  store_id: await sid(U2, "Zeron"),
  tanggal_beli: "2026-10-14",
});
ok("sequence is per user too", u2acc.kode === "AV-0001", u2acc.kode);

// --- Input rules ----------------------------------------------------------------
const g = await ins(U1, {
  game_id: AV,
  store_id: ZERON,
  sumber: "Grind",
  harga_beli_idr: 50000,
  tanggal_beli: "2026-10-14",
});
ok("Grind forces harga beli Rp0", g.harga_beli_idr === 0);
const h = await ins(U1, {
  game_id: VBL,
  store_id: ZERON,
  harga_beli_idr: 95000,
  tanggal_beli: "2026-10-10",
  status: "Hold",
});
ok(
  "Hold defaults to tanggal beli + 7 hari",
  h.hold_sampai.toISOString().slice(0, 10) === "2026-10-17",
  String(h.hold_sampai.toISOString().slice(0, 10)),
);
let err = await asTx(U1, `insert into accounts (game_id, store_id) values ('${AV}', '${ZERON}')`);
ok("tanggal beli wajib for new stock", err?.includes("accounts_tanggal_beli_wajib"), err);
err = await asTx(U1, `insert into accounts (game_id, is_legacy, kode) values ('${AV}', true, 'AV-0063')`);
ok("legacy row without date/store allowed", err === null, err);
err = await asTx(
  U1,
  `insert into accounts (game_id, store_id, tanggal_beli, status) values ('${AV}', '${ZERON}', '2026-10-14', 'Sold')`,
);
ok("Sold without a sale is rejected at commit", err?.includes("Status Sold butuh data penjualan"), err);

// --- mark_sold = guide example: beli Rp100.000, jual $30, kurs pasar 17.000 → Payoneer 16.000
const sale = await one(U1, `select * from mark_sold($1, 30, '2026-10-16', $2)`, [a1.id, ZERON]);
ok("net USD $25,50", Number(sale.net_usd) === 25.5, sale.net_usd);
ok("estimasi Rp391.680", Number(sale.estimasi_idr) === 391680, sale.estimasi_idr);
ok("laba Rp291.680", Number(sale.laba_idr) === 291680, sale.laba_idr);
ok(
  "account became Sold",
  (await one(U1, `select status from accounts where id=$1`, [a1.id])).status === "Sold",
);
err = await asTx(U1, `select mark_sold('${a1.id}', 30, '2026-10-16', '${ZERON}')`);
ok("cannot sell twice", err?.includes("sudah berstatus Sold"), err);
await as(U1, `update accounts set harga_beli_idr = 110000 where id=$1`, [a1.id]);
ok(
  "harga beli correction updates laba",
  Number((await one(U1, `select laba_idr from sales where account_id=$1`, [a1.id])).laba_idr) === 281680,
);
await as(U1, `update accounts set harga_beli_idr = 100000 where id=$1`, [a1.id]);

// --- Undo ---------------------------------------------------------------------
await one(U1, `select * from mark_sold($1, 20, '2026-10-16', $2)`, [a2.id, REALM]);
const back = await one(U1, `select undo_last_status_change($1) s`, [a2.id]);
const a2now = await one(
  U1,
  `select status, (select count(*)::int from sales where account_id=$1) n, (select count(*)::int from status_history where account_id=$1) hist from accounts where id=$1`,
  [a2.id],
);
ok(
  "undo Sold → Belum Post removes sale and history entry",
  back.s === "Belum Post" && a2now.status === "Belum Post" && a2now.n === 0 && a2now.hist === 1,
  JSON.stringify(a2now),
);

// --- Withdrawals: $100 → Rp1.504.000 at Payoneer 16.000 → koreksi −Rp32.000
await as(U1, `insert into balance_adjustments (store_id, usd, alasan) values ($1, 100, 'saldo awal uji')`, [
  ZERON,
]);
const w = await one(U1, `select * from record_withdrawal($1, '2026-10-15', 100, 1504000)`, [ZERON]);
ok("koreksi laba −Rp32.000", Number(w.koreksi_laba_idr) === -32000, w.koreksi_laba_idr);
ok("kurs efektif Rp15.040", Number(w.kurs_efektif) === 15040, w.kurs_efektif);
err = await asTx(U1, `select record_withdrawal('${REALM}', '2026-10-15', 999, 1)`);
ok("cannot withdraw more than balance", err?.includes("Melebihi saldo"), err);
const bal = await one(U1, `select saldo_usd from v_store_balance where store_id=$1`, [ZERON]);
ok("Zeron saldo = 25,50 + 100 − 100", Number(bal.saldo_usd) === 25.5, bal.saldo_usd);

// --- HB --------------------------------------------------------------------------
await as(U1, `update accounts set status='HB' where id=$1`, [v1.id]);
const hb = await one(U1, `select tanggal_hb, today_wib() t from accounts where id=$1`, [v1.id]);
ok("HB stamps tanggal_hb = today (WIB)", hb.tanggal_hb?.getTime() === hb.t.getTime());

// --- Weekly report: week of Mon 12 Oct 2026 ---------------------------------------
const wk = await one(U1, `select * from v_weekly_report where minggu_mulai = '2026-10-12'`);
ok(
  "weekly modal keluar = 100.000+80.000+37.000+0 (Hold bought Sat 10 Oct is last week)",
  Number(wk.modal_keluar) === 217000,
  wk.modal_keluar,
);
const prev = await one(U1, `select modal_keluar from v_weekly_report where minggu_mulai = '2026-10-05'`);
ok("previous week holds the Sat 10 Oct purchase", Number(prev.modal_keluar) === 95000, prev.modal_keluar);
ok(
  "weekly laba penjualan 291.680, koreksi −32.000",
  Number(wk.laba_penjualan) === 291680 && Number(wk.koreksi_penarikan) === -32000,
  `${wk.laba_penjualan} ${wk.koreksi_penarikan}`,
);
ok("weekly cash flow = 1.504.000 − 217.000", Number(wk.cash_flow) === 1287000, wk.cash_flow);

// --- RLS isolation -----------------------------------------------------------------
const seen = await one(
  U2,
  `select (select count(*) from accounts)::int a, (select count(*) from sales)::int s, (select count(*) from v_accounts)::int v, (select count(*) from v_weekly_report)::int w`,
);
ok(
  "user 2 sees only their own rows (tables and views)",
  seen.a === 1 && seen.s === 0 && seen.v === 1,
  JSON.stringify(seen),
);
err = await asTx(
  U2,
  `insert into accounts (game_id, store_id, tanggal_beli) values ('${AV}', '${ZERON}', '2026-10-14')`,
);
ok("user 2 cannot attach stock to user 1's game", err !== null, err);
err = await asTx(
  U2,
  `insert into accounts (user_id, game_id, store_id, tanggal_beli) values ('${U1}', '${AV}', '${ZERON}', '2026-10-14')`,
);
ok("user 2 cannot write accounts as user 1", err !== null, err);
err = await asTx(
  U2,
  `insert into balance_adjustments (user_id, store_id, usd, alasan) values ('${U1}', '${ZERON}', 5, 'x')`,
);
ok("RLS with-check blocks writing as user 1", err?.includes("row-level security"), err);
const upd = await as(U2, `update accounts set catatan='x' where id=$1`, [a1.id]);
ok("user 2 cannot update user 1's account", upd.affectedRows === 0);
err = await asTx(U2, `select mark_sold('${a2.id}', 10, '2026-10-16', '${ZERON}')`);
ok("user 2 cannot mark user 1's account sold", err?.includes("Akun tidak ditemukan"), err);

// --- anon --------------------------------------------------------------------------
await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); set role anon;`);
let anonErr = null;
try {
  await db.query(`select count(*) from accounts`);
} catch (e) {
  anonErr = e.message;
}
await db.exec("reset role;");
ok("anon has no table access", anonErr?.includes("permission denied"), anonErr);
await db.exec(`set role authenticated;`);
let privErr = null;
try {
  await db.query(`select private.bootstrap_user('${U2}')`);
} catch (e) {
  privErr = e.message;
}
await db.exec("reset role;");
ok("private.bootstrap_user is not callable by users", privErr?.includes("permission denied"), privErr);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
