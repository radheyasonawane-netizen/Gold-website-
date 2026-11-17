import type { PurityCode } from "./units";
import type { CoinAnalysis } from "./calc";

/**
 * The ten brands compared on the page. Names and official websites only: no brand publishes a
 * price API, so prices are entered by the user and stored in their browser with the date.
 * Purity defaults are what each brand commonly sells as a 10 g 24K coin; change them to match
 * the exact product you check.
 */
export interface Brand {
  id: string;
  name: string;
  url: string;
  defaultPurity: PurityCode;
}

export const BRANDS: Brand[] = [
  { id: "tanishq", name: "Tanishq", url: "https://www.tanishq.co.in/", defaultPurity: "999" },
  { id: "kalyan", name: "Kalyan Jewellers", url: "https://www.kalyanjewellers.net/", defaultPurity: "999" },
  { id: "malabar", name: "Malabar Gold & Diamonds", url: "https://www.malabargoldanddiamonds.com/", defaultPurity: "999" },
  { id: "joyalukkas", name: "Joyalukkas", url: "https://www.joyalukkas.in/", defaultPurity: "999" },
  { id: "mmtcpamp", name: "MMTC-PAMP", url: "https://www.mmtcpamp.com/", defaultPurity: "999.9" },
  { id: "caratlane", name: "CaratLane", url: "https://www.caratlane.com/", defaultPurity: "999" },
  { id: "senco", name: "Senco Gold & Diamonds", url: "https://sencogoldanddiamonds.com/", defaultPurity: "999" },
  { id: "pngadgil", name: "PN Gadgil Jewellers", url: "https://www.pngjewellers.com/", defaultPurity: "995" },
  { id: "bluestone", name: "BlueStone", url: "https://www.bluestone.com/", defaultPurity: "995" },
  { id: "augmont", name: "Augmont", url: "https://www.augmont.com/", defaultPurity: "999" },
];

export interface CoinEntry {
  price: number; // ₹ incl. GST, for 10 g
  purity: PurityCode;
  enteredAt: string; // ISO
}

export type SortKey = "rank" | "brand" | "premium";

export interface CoinRow {
  brand: Brand;
  entry: CoinEntry | null;
  purity: PurityCode;
  a: CoinAnalysis | null;
}

/** Priced rows first, sorted ("rank" = per 10 g of 999); brands still waiting for a price follow, A–Z. */
export function orderRows(rows: CoinRow[], key: SortKey, dir: "asc" | "desc"): CoinRow[] {
  const priced = rows.filter((r) => r.a);
  const empty = rows.filter((r) => !r.a).sort((x, y) => x.brand.name.localeCompare(y.brand.name));
  const val = (r: CoinRow) => (key === "brand" ? r.brand.name.toLowerCase() : key === "premium" ? r.a!.premiumPct : r.a!.per10g999);
  priced.sort((x, y) => {
    const a = val(x),
      b = val(y);
    const c = typeof a === "string" ? a.localeCompare(b as string) : (a as number) - (b as number);
    return dir === "asc" ? c : -c;
  });
  return [...priced, ...empty];
}
