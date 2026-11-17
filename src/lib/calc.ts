/**
 * Pure pricing maths on Indian rates. Every derived number on the page comes from here
 * (unit-tested in tests/calc.test.ts).
 *
 * Reference rate = OroPocket's published 24K (99.9%) buy rate, ₹ per gram, excluding GST.
 */

/** GST on gold (goods, HSN 71): 3%. */
export const GST_RATE = 0.03;
export const REF_FINENESS = 0.999;

/** Rate for another purity, scaled by gold content from the 24K (999) rate. Indicative only. */
export function rateForPurity(rate999: number, fineness: number): number {
  assertPositive(rate999, "rate999");
  if (fineness <= 0 || fineness > 1) throw new RangeError("fineness must be in (0, 1]");
  return (rate999 * fineness) / REF_FINENESS;
}

export function withGst(exGst: number, gstRate = GST_RATE): number {
  return exGst * (1 + gstRate);
}

export type MakingCharge = { kind: "percent"; value: number } | { kind: "perGram"; value: number };

export interface Breakdown {
  gold: number;
  making: number;
  taxable: number;
  gst: number;
  total: number;
  perGram: number;
}

/**
 * Price for `grams` of gold at `fineness`, from a 24K ex-GST rate per gram.
 * GST at 3% is charged on gold value + making charge (billed together).
 */
export function priceBreakdown(i: { rate999ExGst: number; grams: number; fineness: number; making: MakingCharge; gstRate?: number }): Breakdown {
  if (!(i.grams >= 0)) throw new RangeError("grams must be ≥ 0");
  const gold = rateForPurity(i.rate999ExGst, i.fineness) * i.grams;
  const making = i.making.kind === "percent" ? gold * i.making.value : i.making.value * i.grams;
  const taxable = gold + making;
  const gst = taxable * (i.gstRate ?? GST_RATE);
  const total = taxable + gst;
  return { gold, making, taxable, gst, total, perGram: i.grams > 0 ? total / i.grams : 0 };
}

export interface CoinAnalysis {
  /** Price scaled to 10 g of 999 gold, incl. GST, so sizes and purities compare fairly. */
  per10g999: number;
  /** Same gold content at the reference rate, incl. GST. */
  referenceValue: number;
  /** price − referenceValue: brand premium, minting/making and margin (incl. GST on them). */
  premium: number;
  premiumPct: number;
}

/** Compare a coin's price (incl. GST) with the reference 24K rate (incl. GST, ₹/g of 999). */
export function analyseCoin(price: number, grams: number, fineness: number, refFinalPerGram999: number): CoinAnalysis {
  assertPositive(price, "price");
  assertPositive(grams, "grams");
  assertPositive(refFinalPerGram999, "reference rate");
  const referenceValue = rateForPurity(refFinalPerGram999, fineness) * grams;
  const premium = price - referenceValue;
  return {
    per10g999: (price / grams) * 10 * (REF_FINENESS / fineness),
    referenceValue,
    premium,
    premiumPct: premium / referenceValue,
  };
}

function assertPositive(n: number, name: string) {
  if (!Number.isFinite(n) || n <= 0) throw new RangeError(`${name} must be a positive number`);
}
