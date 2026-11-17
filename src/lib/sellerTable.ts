import type { SellerAnalysis } from "./calc";
import type { PurityCode } from "./units";

export type ProductType = "coin" | "bar" | "digital" | "jewellery";
export interface QuoteRow {
  id: string;
  seller: string;
  product: string;
  type: ProductType;
  grams: number;
  purity: PurityCode;
  fineness: number;
  price: number;
  includesGst: boolean;
  url?: string;
  at: string; // ISO time the quote was entered / feed updated
  origin: "user" | "feed" | "example" | "api";
}

export type SortKey = "seller" | "final" | "markupPct" | "per10g999";
export type Row = QuoteRow & { a: SellerAnalysis | null };

export function sortRows(rows: Row[], key: SortKey, dir: "asc" | "desc"): Row[] {
  const val = (r: Row): number | string => (key === "seller" ? r.seller.toLowerCase() : key === "final" ? (r.a?.final ?? Infinity) : key === "markupPct" ? (r.a?.markupPct ?? Infinity) : (r.a?.per10g999 ?? Infinity));
  return [...rows].sort((x, y) => {
    const a = val(x),
      b = val(y);
    const c = typeof a === "string" ? a.localeCompare(b as string) : a === b ? 0 : (a as number) - (b as number);
    return dir === "asc" ? c : -c;
  });
}

export function filterRows(rows: Row[], q: string, type: ProductType | "all"): Row[] {
  const s = q.trim().toLowerCase();
  return rows.filter((r) => (type === "all" || r.type === type) && (!s || r.seller.toLowerCase().includes(s) || r.product.toLowerCase().includes(s)));
}

