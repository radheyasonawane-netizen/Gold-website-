import { describe, expect, it } from "vitest";
import { analyseCoin, priceBreakdown, rateForPurity, withGst } from "@/lib/calc";
import { BRANDS, orderRows, type CoinRow } from "@/lib/coins";
import { purityByCode } from "@/lib/units";

// OroPocket gold on 17 Nov 2026 11:25 IST: buy 14030.08, gst 420.90 → 14450.98 incl. GST
const BUY = 14030.08;
const FINAL = 14450.98;

describe("rates", () => {
  it("adds 3% GST", () => {
    expect(withGst(BUY)).toBeCloseTo(14450.98, 1);
  });
  it("scales 24K (999) to other purities by gold content", () => {
    expect(rateForPurity(FINAL, 0.999)).toBeCloseTo(FINAL, 9);
    expect(rateForPurity(FINAL, 0.916)).toBeCloseTo((FINAL * 0.916) / 0.999, 9);
    expect(rateForPurity(FINAL, 0.75) * 10).toBeCloseTo(108491.2, 0);
  });
  it("rejects bad input", () => {
    expect(() => rateForPurity(0, 0.999)).toThrow();
    expect(() => rateForPurity(FINAL, 1.5)).toThrow();
  });
});

describe("calculator breakdown", () => {
  it("10 g 24K, no making: equals 10 × rate incl. GST", () => {
    const b = priceBreakdown({ rate999ExGst: BUY, grams: 10, fineness: 0.999, making: { kind: "percent", value: 0 } });
    expect(b.gold).toBeCloseTo(BUY * 10, 6);
    expect(b.gst).toBeCloseTo(BUY * 10 * 0.03, 6);
    expect(b.total).toBeCloseTo(BUY * 10 * 1.03, 6);
  });
  it("applies GST on gold + making", () => {
    const b = priceBreakdown({ rate999ExGst: BUY, grams: 8, fineness: 0.916, making: { kind: "percent", value: 0.12 } });
    const gold = (BUY * 0.916 * 8) / 0.999;
    expect(b.making).toBeCloseTo(gold * 0.12, 6);
    expect(b.total).toBeCloseTo(gold * 1.12 * 1.03, 6);
    const p = priceBreakdown({ rate999ExGst: BUY, grams: 5, fineness: 0.999, making: { kind: "perGram", value: 400 } });
    expect(p.making).toBe(2000);
  });
});

describe("coin comparison", () => {
  it("measures a 999 coin against 10 g at today's rate", () => {
    const a = analyseCoin(148539, 10, 0.999, FINAL);
    expect(a.referenceValue).toBeCloseTo(FINAL * 10, 6);
    expect(a.premium).toBeCloseTo(148539 - 144509.8, 6);
    expect(a.premiumPct).toBeCloseTo(a.premium / 144509.8, 9);
    expect(a.per10g999).toBeCloseTo(148539, 6);
  });
  it("normalises 995 and 999.9 coins to 999", () => {
    expect(analyseCoin(143407, 10, 0.995, FINAL).per10g999).toBeCloseTo(143407 * (0.999 / 0.995), 6);
    expect(analyseCoin(149380, 10, 0.9999, FINAL).referenceValue).toBeCloseTo((FINAL * 0.9999 * 10) / 0.999, 6);
  });

  const row = (i: number, price: number | null, purity: "999" | "995" = "999"): CoinRow => ({
    brand: BRANDS[i],
    purity,
    entry: price ? { price, purity, enteredAt: "2026-11-17T06:00:00Z" } : null,
    a: price ? analyseCoin(price, 10, purityByCode(purity).fineness, FINAL) : null,
  });
  const rows = [row(0, 150000), row(1, null), row(2, 146000), row(3, 147000, "995"), row(4, null)];

  it("ranks priced coins cheapest first and puts unpriced brands last, A–Z", () => {
    const o = orderRows(rows, "rank", "asc");
    expect(o.map((r) => r.brand.id)).toEqual(["malabar", "joyalukkas", "tanishq", "kalyan", "mmtcpamp"]);
  });
  it("sorts by premium and by brand, both directions", () => {
    expect(orderRows(rows, "premium", "desc")[0].brand.id).toBe("tanishq");
    expect(orderRows(rows, "brand", "asc").slice(0, 3).map((r) => r.brand.name)).toEqual(["Joyalukkas", "Malabar Gold & Diamonds", "Tanishq"]);
  });
  it("has exactly ten brands with https links", () => {
    expect(BRANDS).toHaveLength(10);
    expect(BRANDS.every((b) => b.url.startsWith("https://"))).toBe(true);
  });
});
