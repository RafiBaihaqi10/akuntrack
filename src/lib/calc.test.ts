import { describe, expect, it } from "vitest";
import { hargaBeliMaks, kursPayoneer, median, saleBreakdown, withdrawalEstimate, type Rates } from "./calc";
import { addDays, diffDays, formatWeekLong, formatWeekShort, mondayOf, todayWib } from "./dates";
import { jumlahVarianFor, parseIsiAkun, variantBand } from "./isi-akun";

const rates: Rates = { adminPct: 15, potonganTarikPct: 4, potonganTarikUsd: 2, kursPayoneer: 16_000 };

describe("money rules from guide.md", () => {
  it("kurs Payoneer is market minus spread, or the manual rate", () => {
    expect(kursPayoneer({ mode_kurs: "otomatis", kurs_pasar: 17_000, selisih_payoneer: 1_000, kurs_payoneer_manual: null })).toBe(16_000);
    expect(kursPayoneer({ mode_kurs: "manual", kurs_pasar: 17_000, selisih_payoneer: 1_000, kurs_payoneer_manual: 15_500 })).toBe(15_500);
  });

  it("$30 sale bought for Rp100.000 gives net $25,50, estimasi Rp391.680, laba Rp291.680", () => {
    const s = saleBreakdown(30, 100_000, rates);
    expect(s.net).toBeCloseTo(25.5);
    expect(s.estimasi).toBeCloseTo(391_680);
    expect(s.laba).toBeCloseTo(291_680);
  });

  it("withdrawing $100 yields Rp1.504.000", () => {
    expect(withdrawalEstimate(100, rates)).toBeCloseTo(1_504_000);
  });

  it("purchase ceiling for a $30 median at 100% margin is Rp195.840", () => {
    expect(hargaBeliMaks(30, rates, 100)).toBeCloseTo(195_840);
  });

  it("median handles odd, even and empty lists", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("dates", () => {
  it("today is the WIB calendar day", () => {
    // 18:00 UTC on 17 Oct is 01:00 WIB on 18 Oct
    expect(todayWib(new Date("2026-10-17T18:00:00Z"))).toBe("2026-10-18");
  });

  it("weeks start on Monday", () => {
    expect(mondayOf("2026-10-18")).toBe("2026-10-12"); // Sunday
    expect(mondayOf("2026-10-12")).toBe("2026-10-12");
    expect(mondayOf("2026-10-01")).toBe("2026-09-28");
  });

  it("adds and diffs days across months", () => {
    expect(addDays("2026-09-28", 6)).toBe("2026-10-04");
    expect(diffDays("2026-10-12", "2026-10-18")).toBe(6);
  });

  it("formats week ranges", () => {
    expect(formatWeekLong("2026-10-12")).toBe("Senin 12 sampai Minggu 18 Okt 2026");
    expect(formatWeekLong("2026-09-28")).toBe("Senin 28 Sep sampai Minggu 4 Okt 2026");
    expect(formatWeekShort("2026-09-28")).toBe("28 Sep–4 Okt");
    expect(formatWeekShort("2026-10-12")).toBe("12–18 Okt");
  });
});

describe("isi akun", () => {
  it("reads count, unit and tags", () => {
    expect(parseIsiAkun("5 Monarch (Madara + Ichigo + Rukia) + Diavolo")).toEqual({
      jumlah: 5,
      satuan: "Monarch",
      tags: ["Madara", "Ichigo", "Rukia", "Diavolo"],
    });
    expect(parseIsiAkun("Jinko + Kisuki")).toEqual({ jumlah: null, satuan: null, tags: ["Jinko", "Kisuki"] });
  });

  it("only counts variants in the game's unit", () => {
    expect(jumlahVarianFor(parseIsiAkun("11 Monarch + 10k Reroll"), "Monarch")).toBe(11);
    expect(jumlahVarianFor(parseIsiAkun("2 Primordial (Kenpachi + Yuta)"), "Unbound")).toBeNull();
    expect(jumlahVarianFor(parseIsiAkun("4 Ruler"), null)).toBeNull();
  });

  it("groups variant counts into price bands", () => {
    expect([1, 3, 6, 9].map(variantBand)).toEqual(["1–2", "3–4", "5–6", "7+"]);
  });
});
