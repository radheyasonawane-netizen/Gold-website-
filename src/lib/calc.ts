/**
 * Pure, side-effect-free pricing maths. Every derived number shown in the UI comes from here so
 * it can be unit-tested (see tests/calc.test.ts).
 */
import { GRAMS_PER_TROY_OUNCE } from "./units";

/** GST on gold (goods), HSN 7108 / 7113, under the CGST/IGST rate notifications: 3%. */
export const DEFAULT_GST_RATE = 0.03;

/**
 * Converts an international spot price (USD per troy ounce of fine gold) and a USD→INR rate into
 * INR per gram of *fine* gold. No duty, no GST, no local premium.
 */
export function inrPerFineGram(usdPerOz: number, usdInr: number): number {
  assertPositive(usdPerOz, "usdPerOz");
  assertPositive(usdInr, "usdInr");
  return (usdPerOz * usdInr) / GRAMS_PER_TROY_OUNCE;
}

/** Same as above but taking a price that is already in INR per troy ounce. */
export function inrPerFineGramFromInrOz(inrPerOz: number): number {
  assertPositive(inrPerOz, "inrPerOz");
  return inrPerOz / GRAMS_PER_TROY_OUNCE;
}

/** Value of `grams` of metal at `fineness` (0–1) given a fine-gram rate. */
export function metalValue(finePerGram: number, grams: number, fineness: number): number {
  return finePerGram * grams * fineness;
}

export type MakingCharge =
  | { kind: "percent"; value: number } // fraction of metal value, e.g. 0.08
  | { kind: "perGram"; value: number } // ₹ per gram of product
  | { kind: "flat"; value: number }; // ₹ total

export interface BreakdownInput {
  /** INR per gram of fine (pure) gold *before* duty. */
  finePerGram: number;
  grams: number;
  fineness: number;
  /** Customs duty (BCD + AIDC etc.) as a fraction, applied to metal value. 0 if the base rate is already domestic. */
  importDutyRate: number;
  making: MakingCharge;
  /** GST as a fraction, applied to (metal + duty + making). */
  gstRate: number;
}

export interface Breakdown {
  metal: number;
  duty: number;
  making: number;
  taxable: number;
  gst: number;
  total: number;
  /** Effective price per gram of the product (incl. everything). */
  perGram: number;
}

/**
 * Indian consumer price build-up. GST at 3% is charged on the full transaction value of gold
 * goods, which includes making charges when they are billed together with the article.
 */
export function priceBreakdown(i: BreakdownInput): Breakdown {
  if (i.grams < 0) throw new RangeError("grams must be ≥ 0");
  if (i.fineness <= 0 || i.fineness > 1) throw new RangeError("fineness must be in (0, 1]");
  const metal = metalValue(i.finePerGram, i.grams, i.fineness);
  const duty = metal * i.importDutyRate;
  const making =
    i.making.kind === "percent"
      ? (metal + duty) * i.making.value
      : i.making.kind === "perGram"
        ? i.making.value * i.grams
        : i.making.value;
  const taxable = metal + duty + making;
  const gst = taxable * i.gstRate;
  const total = taxable + gst;
  return { metal, duty, making, taxable, gst, total, perGram: i.grams > 0 ? total / i.grams : 0 };
}

export interface SellerQuoteInput {
  /** Final listed price including GST (₹). */
  price: number;
  grams: number;
  fineness: number;
  /** Whether `price` already includes GST. Indian B2C listings almost always do. */
  includesGst: boolean;
  gstRate: number;
}

export interface SellerAnalysis {
  final: number;
  preGst: number;
  gst: number;
  /** Value of the same fine gold at the reference fine-gram rate. */
  referenceValue: number;
  /** Everything above reference value except GST: duty, local premium, making, margin. */
  markup: number;
  markupPct: number;
  /** Final price scaled to 10 g at 999 fineness so different sizes/purities compare fairly. */
  per10g999: number;
}

export function analyseSellerQuote(q: SellerQuoteInput, referenceFinePerGram: number): SellerAnalysis {
  assertPositive(q.price, "price");
  assertPositive(q.grams, "grams");
  const final = q.includesGst ? q.price : q.price * (1 + q.gstRate);
  const preGst = final / (1 + q.gstRate);
  const gst = final - preGst;
  const referenceValue = metalValue(referenceFinePerGram, q.grams, q.fineness);
  const markup = preGst - referenceValue;
  return {
    final,
    preGst,
    gst,
    referenceValue,
    markup,
    markupPct: referenceValue > 0 ? markup / referenceValue : 0,
    per10g999: (final / q.grams) * 10 * (0.999 / q.fineness),
  };
}

export function pctChange(from: number, to: number): number {
  if (!from) return 0;
  return (to - from) / from;
}

function assertPositive(n: number, name: string) {
  if (!Number.isFinite(n) || n <= 0) throw new RangeError(`${name} must be a positive number`);
}
