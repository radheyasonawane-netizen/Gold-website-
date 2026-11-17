/**
 * Unit constants and purity tables used across the app.
 *
 * International bullion prices (gold-api.com, World Bank) are quoted per *troy ounce of fine
 * (pure) metal*. Indian retail prices are quoted per gram or per 10 grams of a given purity.
 */

/** Grams in one troy ounce (exact definition: 31.1034768 g). */
export const GRAMS_PER_TROY_OUNCE = 31.1034768;

export type PurityCode = "999.9" | "999" | "995" | "916" | "750" | "585";

export interface PurityOption {
  code: PurityCode;
  /** Fraction of fine gold, e.g. 0.916 for 22K. */
  fineness: number;
  label: string;
  karat: string;
}

/** Common hallmark finenesses sold in India (BIS IS 1417 grades + 999.9 investment bars). */
export const PURITIES: PurityOption[] = [
  { code: "999.9", fineness: 0.9999, label: "999.9 · 24K investment bar", karat: "24K" },
  { code: "999", fineness: 0.999, label: "999 · 24K", karat: "24K" },
  { code: "995", fineness: 0.995, label: "995 · 24K", karat: "24K" },
  { code: "916", fineness: 0.916, label: "916 · 22K jewellery", karat: "22K" },
  { code: "750", fineness: 0.75, label: "750 · 18K", karat: "18K" },
  { code: "585", fineness: 0.585, label: "585 · 14K", karat: "14K" },
];

export function purityByCode(code: PurityCode): PurityOption {
  const p = PURITIES.find((x) => x.code === code);
  if (!p) throw new Error(`Unknown purity ${code}`);
  return p;
}

export const TROY_OUNCES_PER_KG = 1000 / GRAMS_PER_TROY_OUNCE;
