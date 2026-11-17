import "server-only";
import { unzipSync, strFromU8 } from "fflate";
import { cached, type CacheResult } from "./cache";
import { fetchWithTimeout } from "./http";

/**
 * World Bank Commodity Price Data ("Pink Sheet"), monthly, nominal USD.
 * The workbook URL changes with each monthly release, so we discover it from the official
 * commodity-markets page (or use WORLD_BANK_MONTHLY_XLSX_URL to pin one).
 */
const INDEX_PAGE = "https://www.worldbank.org/en/research/commodity-markets";
const LINK_RE = /https:\/\/thedocs\.worldbank\.org\/[^"'\s]+CMO-Historical-Data-Monthly\.xlsx/;

export interface MonthlyRow {
  month: string; // YYYY-MM
  usdPerOz: number;
}

export interface WorldBankMonthly {
  rows: MonthlyRow[];
  updatedLabel: string | null; // e.g. "Updated on November 03, 2026"
  sourceUrl: string;
}

async function discoverUrl(): Promise<string> {
  if (process.env.WORLD_BANK_MONTHLY_XLSX_URL) return process.env.WORLD_BANK_MONTHLY_XLSX_URL;
  const html = await (await fetchWithTimeout(INDEX_PAGE, { headers: { accept: "text/html" }, timeoutMs: 15000 })).text();
  const m = html.match(LINK_RE);
  if (!m) throw new Error("World Bank: monthly workbook link not found on commodity-markets page");
  return m[0];
}

export function getWorldBankGoldMonthly(): Promise<CacheResult<WorldBankMonthly>> {
  return cached("worldbank:gold:monthly", { ttlMs: 24 * 3600_000, maxStaleMs: 45 * 86400_000 }, async () => {
    const url = await discoverUrl();
    const res = await fetchWithTimeout(url, { headers: { accept: "*/*" }, timeoutMs: 30000 });
    const buf = new Uint8Array(await res.arrayBuffer());
    return { ...parsePinkSheet(buf, "Gold"), sourceUrl: url };
  });
}

/** Parses the "Monthly Prices" sheet of CMO-Historical-Data-Monthly.xlsx for one commodity column. */
export function parsePinkSheet(xlsx: Uint8Array, commodity: string): { rows: MonthlyRow[]; updatedLabel: string | null } {
  const files = unzipSync(xlsx, {
    filter: (f) => f.name === "xl/workbook.xml" || f.name === "xl/_rels/workbook.xml.rels" || f.name === "xl/sharedStrings.xml" || f.name.startsWith("xl/worksheets/sheet"),
  });
  const text = (n: string) => (files[n] ? strFromU8(files[n]) : "");
  const strings = parseSharedStrings(text("xl/sharedStrings.xml"));

  // Resolve "Monthly Prices" → r:id → worksheet path
  const wb = text("xl/workbook.xml");
  const sheetTag = [...wb.matchAll(/<sheet\b[^>]*>/g)].map((m) => m[0]).find((t) => /name="Monthly Prices"/.test(t));
  const rid = sheetTag?.match(/r:id="([^"]+)"/)?.[1];
  const rels = text("xl/_rels/workbook.xml.rels");
  const target = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]).find((t) => t.includes(`Id="${rid}"`))?.match(/Target="([^"]+)"/)?.[1];
  if (!target) throw new Error("World Bank: 'Monthly Prices' sheet not found");
  const sheet = text(`xl/${target.replace(/^\/?xl\//, "")}`);
  if (!sheet) throw new Error("World Bank: worksheet XML missing");

  let goldCol: string | null = null;
  let updatedLabel: string | null = null;
  const rows: MonthlyRow[] = [];
  for (const rm of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = parseCells(rm[1], strings);
    const a = cells.get("A");
    if (a && /^Updated/i.test(a)) updatedLabel = a.trim();
    if (!goldCol) {
      for (const [col, v] of cells) if (v.trim() === commodity) goldCol = col;
      continue;
    }
    const m = a?.match(/^(\d{4})M(\d{2})$/);
    if (!m) continue;
    const v = Number(cells.get(goldCol));
    if (Number.isFinite(v) && v > 0) rows.push({ month: `${m[1]}-${m[2]}`, usdPerOz: v });
  }
  if (!goldCol) throw new Error(`World Bank: column '${commodity}' not found`);
  if (rows.length < 12) throw new Error("World Bank: too few rows parsed");
  return { rows, updatedLabel };
}

function parseSharedStrings(xml: string): string[] {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => decode([...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((t) => t[1]).join("")));
}

function parseCells(rowXml: string, strings: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of rowXml.matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const [, col, attrs, inner] = m;
    if (!inner) continue;
    if (/t="inlineStr"/.test(attrs)) {
      out.set(col, decode(inner.replace(/<[^>]+>/g, "")));
      continue;
    }
    const v = inner.match(/<v>([^<]*)<\/v>/)?.[1];
    if (v === undefined) continue;
    out.set(col, /t="s"/.test(attrs) ? (strings[Number(v)] ?? "") : decode(v));
  }
  return out;
}

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
