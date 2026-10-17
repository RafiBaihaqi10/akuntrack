import { describe, expect, it } from "vitest";
import {
  formatDateLong,
  formatDateShort,
  formatIdr,
  formatIdrCompact,
  formatPercent,
  formatUsd,
  parseIdrInput,
  parseUsdInput,
} from "./format";

describe("formatUsd", () => {
  it("uses Indonesian separators", () => {
    expect(formatUsd(1913.35)).toBe("$1.913,35");
    expect(formatUsd(68.05)).toBe("$68,05");
  });
  it("prefixes negatives with a typographic minus", () => {
    expect(formatUsd(-100)).toBe("−$100,00");
  });
});

describe("formatIdr", () => {
  it("rounds and groups thousands", () => {
    expect(formatIdr(2073256.4)).toBe("Rp2.073.256");
    expect(formatIdr(-32000)).toBe("−Rp32.000");
  });
  it("adds + when signed", () => {
    expect(formatIdr(840000, { signed: true })).toBe("+Rp840.000");
    expect(formatIdr(0, { signed: true })).toBe("Rp0");
  });
});

describe("formatIdrCompact", () => {
  it("matches the mockup summaries", () => {
    expect(formatIdrCompact(5_220_000)).toBe("Rp5,22 jt");
    expect(formatIdrCompact(947_000)).toBe("Rp947 rb");
    expect(formatIdrCompact(-401_000)).toBe("−Rp401 rb");
  });
});

describe("dates and percent", () => {
  it("formats calendar dates without timezone drift", () => {
    expect(formatDateShort("2026-10-16")).toBe("16 Okt");
    expect(formatDateLong("2026-08-01")).toBe("1 Agu 2026");
  });
  it("formats ratios", () => {
    expect(formatPercent(0.7333)).toBe("73%");
  });
});

describe("input parsing", () => {
  it("parses dollars with either decimal mark", () => {
    expect(parseUsdInput("42")).toBe(42);
    expect(parseUsdInput("42,5")).toBe(42.5);
    expect(parseUsdInput("288,97")).toBe(288.97);
    expect(parseUsdInput("1.913,35")).toBe(1913.35);
    expect(parseUsdInput("")).toBeNull();
  });
  it("parses rupiah digits only", () => {
    expect(parseIdrInput("80.000")).toBe(80000);
    expect(parseIdrInput("Rp 1.504.000")).toBe(1504000);
    expect(parseIdrInput("")).toBeNull();
  });
});
