import { describe, expect, it, beforeEach } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { parseHistory, parseSpot } from "@/lib/server/goldApi";
import { parseFxRows, rateOnOrBefore } from "@/lib/server/fx";
import { parsePinkSheet } from "@/lib/server/worldBank";
import { parseSellerFeed } from "@/lib/server/sellerFeed";
import { cached, __clearCache } from "@/lib/server/cache";

describe("gold-api parsers", () => {
  it("parses a documented /price response", () => {
    const q = parseSpot({ currency: "INR", currencySymbol: "₹", exchangeRate: 93.9616, name: "Gold", price: 363993.15, symbol: "XAU", updatedAt: "2026-11-17T04:55:28Z", updatedAtReadable: "a few seconds ago" }, "XAU", "INR");
    expect(q).toEqual({ symbol: "XAU", currency: "INR", pricePerOz: 363993.15, exchangeRate: 93.9616, updatedAt: "2026-11-17T04:55:28Z" });
  });
  it("rejects wrong symbol / missing price / bad timestamp", () => {
    expect(() => parseSpot({ symbol: "XAG", currency: "USD", price: 1, updatedAt: "2026-01-01T00:00:00Z" }, "XAU", "USD")).toThrow();
    expect(() => parseSpot({ symbol: "XAU", currency: "USD", updatedAt: "2026-01-01T00:00:00Z" }, "XAU", "USD")).toThrow();
    expect(() => parseSpot({ symbol: "XAU", currency: "USD", price: 1, updatedAt: "nope" }, "XAU", "USD")).toThrow();
  });
  it("parses /history rows and surfaces API errors", () => {
    expect(parseHistory([{ day: "2026-07-01", avg_price: 4200.5 }, { day: "2026-06-30", avg_price: 4185 }], "day")).toEqual([
      { period: "2026-06-30", usdPerOz: 4185 },
      { period: "2026-07-01", usdPerOz: 4200.5 },
    ]);
    expect(() => parseHistory({ error: "No x-api-key header." }, "day")).toThrow(/x-api-key/);
  });
});

describe("Frankfurter FX", () => {
  it("keeps only USD→INR rows", () => {
    const rows = parseFxRows([{ date: "2026-11-13", base: "USD", quote: "INR", rate: 94.24 }, { date: "2026-11-13", base: "USD", quote: "EUR", rate: 0.9 }, { date: "bad", base: "USD", quote: "INR", rate: 1 }]);
    expect(rows).toHaveLength(1);
  });
  it("falls back to the previous fixing on weekends", () => {
    const m = new Map([["2026-11-13", 94.24], ["2026-11-16", 93.93]]);
    expect(rateOnOrBefore(m, "2026-11-15")).toBe(94.24);
    expect(rateOnOrBefore(m, "2026-11-16")).toBe(93.93);
    expect(rateOnOrBefore(m, "2026-11-01")).toBeNull();
  });
});

function makeXlsx(rows: string[][]): Uint8Array {
  const strings: string[] = [];
  const si = (s: string) => (strings.includes(s) ? strings.indexOf(s) : strings.push(s) - 1);
  const col = (i: number) => String.fromCharCode(65 + i);
  const sheetRows = rows
    .map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => (v === "" ? "" : /^[\d.]+$/.test(v) ? `<c r="${col(ci)}${ri + 1}"><v>${v}</v></c>` : `<c r="${col(ci)}${ri + 1}" t="s"><v>${si(v)}</v></c>`)).join("")}</row>`)
    .join("");
  return zipSync({
    "xl/workbook.xml": strToU8(`<workbook><sheets><sheet name="Other" sheetId="1" r:id="rId1"/><sheet name="Monthly Prices" sheetId="2" r:id="rId2"/></sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>`),
    "xl/worksheets/sheet1.xml": strToU8(`<worksheet><sheetData/></worksheet>`),
    "xl/worksheets/sheet2.xml": strToU8(`<worksheet><sheetData>${sheetRows}</sheetData></worksheet>`),
    "xl/sharedStrings.xml": strToU8(`<sst>${strings.map((s) => `<si><t>${s.replace(/&/g, "&amp;")}</t></si>`).join("")}</sst>`),
  });
}

describe("World Bank Pink Sheet parser", () => {
  it("finds the Gold column by header and parses YYYYMmm rows", () => {
    const months = Array.from({ length: 14 }, (_, i) => [`2025M${String((i % 12) + 1).padStart(2, "0")}`.replace("2025", i >= 12 ? "2026" : "2025"), "70.1", String(3000 + i * 10)]);
    const x = makeXlsx([["World Bank Commodity Price Data (The Pink Sheet)"], ["Updated on November 03, 2026"], ["", "Crude oil", "Gold"], ["", "($/bbl)", "($/troy oz)"], ...months]);
    const r = parsePinkSheet(x, "Gold");
    expect(r.updatedLabel).toBe("Updated on November 03, 2026");
    expect(r.rows[0]).toEqual({ month: "2025-01", usdPerOz: 3000 });
    expect(r.rows.at(-1)).toEqual({ month: "2026-02", usdPerOz: 3130 });
  });
  it("fails loudly if the column is missing", () => {
    const x = makeXlsx([["", "Silver"], ...Array.from({ length: 13 }, () => ["2025M01", "30"])]);
    expect(() => parsePinkSheet(x, "Gold")).toThrow(/Gold/);
  });
});

describe("seller feed schema", () => {
  it("drops malformed quotes", () => {
    const r = parseSellerFeed({ name: "Licensed", quotes: [{ seller: "A", product: "10 g coin", url: "https://a", grams: 10, fineness: 0.999, price: 140000, includesGst: true, updatedAt: "2026-11-17T05:00:00Z" }, { seller: "B", grams: -1 }] });
    expect(r.quotes).toHaveLength(1);
    expect(() => parseSellerFeed({})).toThrow();
  });
});

describe("cache: last-good fallback", () => {
  beforeEach(() => __clearCache());
  it("serves fresh within TTL, stale after an upstream failure, then errors past maxStale", async () => {
    let t = 0;
    const now = () => t;
    const opts = { ttlMs: 30, maxStaleMs: 100 };
    expect((await cached("k", opts, async () => 1, now)).value).toBe(1);
    t = 10;
    expect((await cached("k", opts, async () => 2, now)).value).toBe(1); // within TTL
    t = 50;
    const s = await cached("k", opts, async () => { throw new Error("down"); }, now);
    expect(s).toMatchObject({ value: 1, stale: true, error: "down" });
    t = 200;
    const e = await cached("k", opts, async () => { throw new Error("down"); }, now);
    expect(e.value).toBeNull();
    expect(e.error).toBe("down");
  });
});
