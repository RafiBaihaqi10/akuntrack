"""
AkunTrack · one-time import of the old Excel ("Penjualan Eldorado.xlsx").

Reads sheets Rafi, Akun and Progress Grind AV with the standard library only
and writes a SQL script to run once in the Supabase SQL Editor. Nothing is
sent anywhere; the generated SQL contains usernames, so it goes to the
gitignored import/ folder.

    python scripts/import_excel.py "C:/path/Penjualan Eldorado.xlsx"

Rules (guide.md › Migrasi dari Excel, plus decisions confirmed by the owner):
- Every row is "data lama": no purchase date, counts in totals and stock but
  not in weekly reports. "Hold (23/07)" means held from that day, so it
  becomes the purchase date (2026) and Hold runs 1 week from it.
- Status spellings are mapped to the 6 fixed statuses; "VBL " becomes VBL.
- Kode akun is generated per game in Excel order; the old "No" is kept in
  no_lama (it has duplicates, e.g. No 77 five times).
- Price Rp0 + username listed in sheet Akun = Grind. Akun rows that are not in
  sheet Rafi are imported as Grind stock without a store.
- Sales keep the Excel rates: admin 15%, withdrawal cut 4%, kurs Rp17.000.
- The 14 withdrawals (Zeron) are imported without date and rupiah, ready for
  "Isi rupiah" on the Balance page.
- Passwords and codes above the table are never read.
"""

from __future__ import annotations

import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path

NS = {
    "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}

# Must match the games created by private.bootstrap_user
GAMES = {
    "anime vanguard": ("Anime Vanguard", "Monarch"),
    "vbl": ("VBL", None),
    "utdx": ("UTDX", "Ruler"),
    "anime squadron": ("Anime Squadron", None),
    "anime expedition": ("Anime Expedition", "Unbound"),
    "ao": ("AO", None),
    "sailor piece": ("Sailor Piece", None),
}
STORES = {"zeron": "Zeron", "realm": "Realm"}
STATUS = {
    "sold": "Sold",
    "belum sold": "Belum Sold",
    "belum post": "Belum Post",
    "hold": "Hold",
    "update": "Update",
    "hb": "HB",
    # sheet Akun
    "jual": "Belum Sold",
}
KURS_LAMA = 17000
YEAR = 2026


# ---------------------------------------------------------------------------
# xlsx reading (cached values only; formulas are ignored)
# ---------------------------------------------------------------------------

def read_sheets(path: Path) -> dict[str, dict[int, dict[str, object]]]:
    z = zipfile.ZipFile(path)
    shared: list[str] = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS):
            shared.append("".join(t.text or "" for t in si.iter(f"{{{NS['m']}}}t")))
    workbook = ET.fromstring(z.read("xl/workbook.xml"))
    rels = {r.get("Id"): r.get("Target") for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
    sheets = {}
    for s in workbook.find("m:sheets", NS):
        target = rels[s.get(f"{{{NS['r']}}}id")].lstrip("/")
        target = target if target.startswith("xl/") else f"xl/{target}"
        rows: dict[int, dict[str, object]] = {}
        for c in ET.fromstring(z.read(target)).iter(f"{{{NS['m']}}}c"):
            v = c.find("m:v", NS)
            kind = c.get("t")
            if kind == "s" and v is not None:
                value: object = shared[int(v.text)]
            elif kind == "inlineStr":
                value = "".join(t.text or "" for t in c.iter(f"{{{NS['m']}}}t"))
            elif v is not None:
                try:
                    num = float(v.text)
                    value = int(num) if num.is_integer() else num
                except ValueError:
                    value = v.text
            else:
                continue
            col, row = re.match(r"([A-Z]+)(\d+)", c.get("r")).groups()
            rows.setdefault(int(row), {})[col] = value
        sheets[s.get("name")] = rows
    return sheets


# ---------------------------------------------------------------------------
# Cleaning
# ---------------------------------------------------------------------------

def text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value)).strip() if value is not None else ""


def number(value: object) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return float(value)
    cleaned = re.sub(r"[^0-9.,-]", "", str(value)).replace(",", ".")
    return float(cleaned) if cleaned else None


def parse_isi(isi: str, satuan: str | None) -> tuple[int | None, list[str]]:
    """Same rules as src/lib/isi-akun.ts (parseIsiAkun + jumlahVarianFor)."""
    head = re.match(r"^\s*(\d+)\s+([A-Za-z][\w-]*)", isi)
    rest = isi[head.end():] if head else isi
    tags = []
    for t in re.sub(r"[()]", "+", rest).split("+"):
        t = re.sub(r"\s+", " ", t).strip()
        if t and t not in tags:
            tags.append(t)
    jumlah = None
    if head and satuan and head.group(2).lower().startswith(satuan.lower()):
        jumlah = int(head.group(1))
    return jumlah, tags


def map_status(raw: str) -> tuple[str, date | None]:
    """Returns the fixed status and, for "Hold (23/07)", the date it was held from."""
    m = re.match(r"^\s*hold\s*\(\s*(\d{1,2})\s*/\s*(\d{1,2})\s*\)\s*$", raw, re.I)
    if m:
        return "Hold", date(YEAR, int(m.group(2)), int(m.group(1)))
    key = raw.strip().lower()
    if key not in STATUS:
        raise SystemExit(f"Status tidak dikenal: {raw!r}")
    return STATUS[key], None


def sql(value: object) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return repr(value)
    if isinstance(value, date):
        return f"'{value.isoformat()}'"
    if isinstance(value, list):
        return "array[" + ", ".join(sql(v) for v in value) + "]::text[]" if value else "'{}'::text[]"
    return "'" + str(value).replace("'", "''") + "'"


# ---------------------------------------------------------------------------
# Build rows
# ---------------------------------------------------------------------------

def build(sheets):
    rafi, akun, progress = sheets["Rafi"], sheets["Akun"], sheets["Progress Grind AV"]

    progress_note = {
        text(r.get("C")).lower(): text(r.get("D"))
        for k, r in progress.items()
        if k >= 3 and text(r.get("C"))
    }
    akun_rows = [r for k, r in sorted(akun.items()) if k >= 5 and text(r.get("D"))]
    grind_users = {text(r.get("D")).lower() for r in akun_rows}

    accounts = []
    seen_users = set()
    issues = []
    for k, r in sorted(rafi.items()):
        if k < 5 or not text(r.get("D")) or text(r.get("C")).lower() == "total":
            continue
        game_key = text(r.get("D")).lower()
        if game_key not in GAMES:
            raise SystemExit(f"Baris {k}: game tidak dikenal {r.get('D')!r}")
        game, satuan = GAMES[game_key]
        isi = text(r.get("E"))
        username = text(r.get("F")) or None
        status, held_from = map_status(text(r.get("G")))
        harga = number(r.get("H"))
        jual = number(r.get("I"))
        store = STORES.get(text(r.get("J")).lower())
        grind = (harga or 0) == 0 and username is not None and username.lower() in grind_users
        jumlah, tags = parse_isi(isi, satuan)
        note = progress_note.get((username or "").lower())
        if harga is None:
            issues.append(f"No {r.get('C')} ({username}): harga beli kosong, diisi Rp0")
        if status == "Sold" and jual is None:
            issues.append(f"No {r.get('C')} ({username}): Sold tanpa harga jual")
        if store is None:
            issues.append(f"No {r.get('C')} ({username}): tanpa toko")
        accounts.append({
            "no_lama": int(number(r.get("C")) or 0) or None,
            "game": game,
            "isi": isi,
            "jumlah": jumlah,
            "tags": tags,
            "username": username,
            "sumber": "Grind" if grind else "Beli",
            "harga": 0 if grind else int(harga or 0),
            "tanggal_beli": held_from,
            "status": status,
            "store": store,
            "catatan": f"Progress grind: {note}" if note else None,
            "jual": jual if status == "Sold" else None,
        })
        if username:
            seen_users.add(username.lower())

    for r in akun_rows:
        username = text(r.get("D"))
        if username.lower() in seen_users:
            continue
        game, satuan = GAMES[text(r.get("E")).lower()]
        raw_status = text(r.get("G"))
        status = map_status(raw_status)[0] if raw_status else "Belum Post"
        isi = text(r.get("F"))
        jumlah, tags = parse_isi(isi, satuan)
        note = progress_note.get(username.lower())
        if status == "Sold":
            issues.append(f"Akun {username}: Sold di sheet Akun, tanpa harga jual dan toko")
        accounts.append({
            "no_lama": None,
            "game": game,
            "isi": isi,
            "jumlah": jumlah,
            "tags": tags,
            "username": username,
            "sumber": "Grind",
            "harga": 0,
            "tanggal_beli": None,
            "status": status,
            "store": None,
            "catatan": "; ".join(x for x in ["Dari sheet Akun (grinding)", f"Progress grind: {note}" if note else None] if x),
            "jual": None,
        })

    withdrawals = [
        -number(r["F"])
        for k, r in sorted(rafi.items())
        if k > 178 and number(r.get("F")) is not None and number(r.get("F")) < 0
    ]
    return accounts, withdrawals, issues


def expected_balances(accounts, withdrawals):
    zeron = sum(a["jual"] for a in accounts if a["store"] == "Zeron" and a["jual"]) * 0.85 - sum(withdrawals)
    realm = sum(a["jual"] for a in accounts if a["store"] == "Realm" and a["jual"]) * 0.85
    return round(zeron, 2), round(realm, 2)


# ---------------------------------------------------------------------------
# SQL
# ---------------------------------------------------------------------------

def render(accounts, withdrawals, issues, source: str) -> str:
    zeron, realm = expected_balances(accounts, withdrawals)
    values = ",\n".join(
        "  (" + ", ".join(sql(v) for v in [
            i + 1, a["no_lama"], a["game"], a["isi"], a["jumlah"], a["tags"], a["username"], a["sumber"],
            a["harga"], a["tanggal_beli"], a["status"], a["store"], a["catatan"], a["jual"],
        ]) + ")"
        for i, a in enumerate(accounts)
    )
    tarik = ",\n".join(f"  ({i + 1}, {w})" for i, w in enumerate(withdrawals))
    sold = sum(1 for a in accounts if a["status"] == "Sold")
    issue_lines = "\n".join(f"--   - {x}" for x in issues) or "--   (tidak ada)"
    return f"""-- AkunTrack · impor Excel lama
-- Sumber: {source}
-- Dibuat oleh scripts/import_excel.py. Jalankan SEKALI di Supabase SQL Editor.
--
-- Isi: {len(accounts)} akun ({sold} Sold), {len(withdrawals)} penarikan Zeron.
-- Semua ditandai "data lama": tidak masuk laporan mingguan, tetap masuk total dan stok.
-- Saldo yang diharapkan setelah impor (kalau belum ada data lain):
--   Zeron ${zeron:.2f}, Realm ${realm:.2f}
--
-- Catatan dari data Excel (bisa dirapikan nanti di aplikasi):
{issue_lines}
--
-- Aman dijalankan ulang? Tidak: skrip menolak jalan kalau data lama sudah pernah diimpor.

begin;

-- Satu-satunya user aplikasi
create temp table imp_user on commit drop as select id from auth.users;

do $$
begin
  if (select count(*) from imp_user) <> 1 then
    raise exception 'Harus ada tepat 1 user di auth.users, ditemukan %', (select count(*) from imp_user);
  end if;
  if exists (select 1 from public.accounts a join imp_user u on a.user_id = u.id where a.is_legacy) then
    raise exception 'Data lama sudah pernah diimpor. Batalkan supaya tidak dobel.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- OPSIONAL: hapus data uji coba sebelum impor.
-- Hapus tanda "--" di 7 baris di bawah ini kalau semua data yang ada sekarang
-- hanya percobaan. Ini juga mengembalikan nomor kode akun ke 0001.
-- ---------------------------------------------------------------------------
-- delete from public.sales where user_id = (select id from imp_user);
-- delete from public.status_history where user_id = (select id from imp_user);
-- delete from public.accounts where user_id = (select id from imp_user);
-- delete from public.withdrawals where user_id = (select id from imp_user);
-- delete from public.balance_adjustments where user_id = (select id from imp_user);
-- update public.games set next_seq = 1 where user_id = (select id from imp_user);
-- update public.stores set saldo_awal_usd = 0 where user_id = (select id from imp_user);

create temp table imp_akun (
  urut int, no_lama int, game text, isi text, jumlah int, tags text[], username text, sumber text,
  harga int, tanggal_beli date, status text, toko text, catatan text, harga_jual numeric
) on commit drop;

insert into imp_akun values
{values};

create temp table imp_tarik (urut int, usd numeric) on commit drop;

insert into imp_tarik values
{tarik};

-- Akun dan penjualan, berurutan supaya kode akun mengikuti urutan Excel
do $$
declare
  v_user uuid := (select id from imp_user);
  r record;
  v_game uuid;
  v_store uuid;
  v_account uuid;
begin
  for r in select * from imp_akun order by urut loop
    select id into v_game from public.games where user_id = v_user and nama = r.game;
    if v_game is null then
      raise exception 'Game "%" tidak ada. Tambahkan dulu di Pengaturan.', r.game;
    end if;
    v_store := null;
    if r.toko is not null then
      select id into v_store from public.stores where user_id = v_user and nama = r.toko;
      if v_store is null then
        raise exception 'Toko "%" tidak ada. Tambahkan dulu di Pengaturan.', r.toko;
      end if;
    end if;

    insert into public.accounts (
      user_id, no_lama, game_id, store_id, isi_akun, jumlah_varian, tags, username, sumber,
      harga_beli_idr, tanggal_beli, status, catatan, is_legacy
    ) values (
      v_user, r.no_lama, v_game, v_store, r.isi, r.jumlah, r.tags, r.username, r.sumber::public.account_source,
      r.harga, r.tanggal_beli, r.status::public.account_status, r.catatan, true
    )
    returning id into v_account;

    if r.status = 'Sold' then
      insert into public.sales (
        user_id, account_id, store_id, tanggal_terjual, harga_jual_usd,
        admin_pct, potongan_tarik_pct, kurs_payoneer, modal_idr, is_legacy
      ) values (
        v_user, v_account, v_store, null, r.harga_jual, 15, 4, {KURS_LAMA}, r.harga, true
      );
    end if;
  end loop;
end;
$$;

-- Penarikan lama dari Zeron: tanpa tanggal dan rupiah, bisa dilengkapi di Balance
insert into public.withdrawals (
  user_id, store_id, tanggal, usd_ditarik, biaya_tarik_pct, biaya_tetap_usd, kurs_payoneer, idr_diterima, catatan, is_legacy
)
select u.id, s.id, null, t.usd, 4, 2, {KURS_LAMA}, null, 'Penarikan ke-' || t.urut || ' dari Excel', true
from imp_tarik t
cross join imp_user u
join public.stores s on s.user_id = u.id and s.nama = 'Zeron'
order by t.urut;

commit;

-- Cek hasil: bandingkan dengan Zeron ${zeron:.2f} dan Realm ${realm:.2f}
select nama, akun_terjual, round(masuk_usd, 2) as masuk_usd, ditarik_usd, jumlah_penarikan, round(saldo_usd, 2) as saldo_usd
from public.v_store_balance
order by nama;
"""


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    source = Path(sys.argv[1])
    accounts, withdrawals, issues = build(read_sheets(source))
    out_dir = Path(__file__).resolve().parent.parent / "import"
    out_dir.mkdir(exist_ok=True)
    out = out_dir / "import-excel-lama.sql"
    out.write_text(render(accounts, withdrawals, issues, source.name), encoding="utf-8")
    zeron, realm = expected_balances(accounts, withdrawals)
    print(f"{len(accounts)} akun, {len(withdrawals)} penarikan -> {out}")
    print(f"Saldo diharapkan: Zeron ${zeron:.2f}, Realm ${realm:.2f}")
    for line in issues:
        print(f"  - {line}")


if __name__ == "__main__":
    main()
