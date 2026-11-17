import { describe, expect, it } from "vitest";
import { filterRows, sortRows, type Row } from "@/lib/sellerTable";
import { analyseSellerQuote } from "@/lib/calc";

const mk = (id: string, seller: string, product: string, type: Row["type"], price: number, grams = 10, fineness = 0.999): Row => ({
  id, seller, product, type, grams, purity: "999", fineness, price, includesGst: true, at: "2026-11-17T00:00:00Z", origin: "user",
  a: analyseSellerQuote({ price, grams, fineness, includesGst: true, gstRate: 0.03 }, 11700),
});
const rows = [mk("1", "Zeta", "10 g coin", "coin", 150000), mk("2", "Alpha", "10 g bar", "bar", 140000), mk("3", "Beta", "8 g coin", "coin", 118000, 8), { ...mk("4", "Nil", "no ref", "coin", 1), a: null }];

describe("seller table", () => {
  it("sorts by per-10g (999) ascending with unknowns last", () => {
    expect(sortRows(rows, "per10g999", "asc").map((r) => r.id)).toEqual(["2", "3", "1", "4"]);
  });
  it("sorts by seller name and reverses", () => {
    expect(sortRows(rows, "seller", "asc").map((r) => r.seller)).toEqual(["Alpha", "Beta", "Nil", "Zeta"]);
    expect(sortRows(rows, "seller", "desc")[0].seller).toBe("Zeta");
  });
  it("filters by type and search text", () => {
    expect(filterRows(rows, "", "bar").map((r) => r.id)).toEqual(["2"]);
    expect(filterRows(rows, "8 g", "all").map((r) => r.id)).toEqual(["3"]);
    expect(filterRows(rows, "zeta", "coin").map((r) => r.id)).toEqual(["1"]);
  });
});
