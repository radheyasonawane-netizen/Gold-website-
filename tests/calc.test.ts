import { describe, expect, it } from "vitest";
import { analyseSellerQuote, inrPerFineGram, inrPerFineGramFromInrOz, priceBreakdown, metalValue } from "@/lib/calc";
import { GRAMS_PER_TROY_OUNCE, TROY_OUNCES_PER_KG } from "@/lib/units";

describe("unit conversions", () => {
  it("uses the exact troy-ounce definition", () => {
    expect(GRAMS_PER_TROY_OUNCE).toBe(31.1034768);
    expect(TROY_OUNCES_PER_KG).toBeCloseTo(32.1507466, 6);
  });
  it("converts USD/oz × USD/INR to INR per fine gram", () => {
    // 3110.34768 $/oz at ₹100/$ = ₹10,000 per gram exactly
    expect(inrPerFineGram(3110.34768, 100)).toBeCloseTo(10000, 9);
  });
  it("matches gold-api's INR quote path", () => {
    expect(inrPerFineGramFromInrOz(311034.768)).toBeCloseTo(10000, 9);
  });
  it("rejects bad inputs", () => {
    expect(() => inrPerFineGram(0, 90)).toThrow();
    expect(() => inrPerFineGram(3000, NaN)).toThrow();
  });
});

describe("priceBreakdown", () => {
  const fine = 10000; // ₹/g fine
  it("computes metal, duty, making %, GST in the right order", () => {
    const b = priceBreakdown({ finePerGram: fine, grams: 10, fineness: 0.999, importDutyRate: 0.06, making: { kind: "percent", value: 0.1 }, gstRate: 0.03 });
    expect(b.metal).toBeCloseTo(99900, 6);
    expect(b.duty).toBeCloseTo(5994, 6);
    expect(b.making).toBeCloseTo((99900 + 5994) * 0.1, 6);
    expect(b.gst).toBeCloseTo((99900 + 5994 + 10589.4) * 0.03, 6);
    expect(b.total).toBeCloseTo(b.metal + b.duty + b.making + b.gst, 9);
    expect(b.perGram).toBeCloseTo(b.total / 10, 9);
  });
  it("supports per-gram and flat making charges", () => {
    expect(priceBreakdown({ finePerGram: fine, grams: 8, fineness: 0.916, importDutyRate: 0, making: { kind: "perGram", value: 500 }, gstRate: 0.03 }).making).toBe(4000);
    expect(priceBreakdown({ finePerGram: fine, grams: 8, fineness: 0.916, importDutyRate: 0, making: { kind: "flat", value: 1234 }, gstRate: 0 }).total).toBeCloseTo(fine * 8 * 0.916 + 1234, 6);
  });
  it("validates fineness", () => {
    expect(() => priceBreakdown({ finePerGram: fine, grams: 1, fineness: 1.2, importDutyRate: 0, making: { kind: "flat", value: 0 }, gstRate: 0 })).toThrow();
  });
});

describe("analyseSellerQuote", () => {
  it("strips GST, computes markup vs parity and normalises to 10 g of 999", () => {
    const fine = 12000;
    const a = analyseSellerQuote({ price: 148539, grams: 10, fineness: 0.999, includesGst: true, gstRate: 0.03 }, fine);
    expect(a.preGst).toBeCloseTo(148539 / 1.03, 6);
    expect(a.gst).toBeCloseTo(148539 - 148539 / 1.03, 6);
    expect(a.referenceValue).toBeCloseTo(metalValue(fine, 10, 0.999), 9);
    expect(a.markup).toBeCloseTo(a.preGst - 119880, 6);
    expect(a.per10g999).toBeCloseTo(148539, 6);
  });
  it("scales an 8 g 995 coin fairly", () => {
    const a = analyseSellerQuote({ price: 119000, grams: 8, fineness: 0.995, includesGst: true, gstRate: 0.03 }, 12000);
    expect(a.per10g999).toBeCloseTo((119000 / 8) * 10 * (0.999 / 0.995), 6);
  });
  it("adds GST when the price excludes it", () => {
    const a = analyseSellerQuote({ price: 100000, grams: 10, fineness: 0.999, includesGst: false, gstRate: 0.03 }, 9000);
    expect(a.final).toBeCloseTo(103000, 6);
    expect(a.preGst).toBeCloseTo(100000, 6);
  });
});
