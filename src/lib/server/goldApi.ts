import "server-only";
import { cached, type CacheResult } from "./cache";
import { fetchJson } from "./http";
import type { SpotQuote } from "@/lib/types";

/**
 * gold-api.com adapter.
 * Docs: https://gold-api.com/llms.txt (verified 2026-11-17)
 *   GET /price/{symbol}             free, keyless, ~30 s updates
 *   GET /price/{symbol}/{currency}  free, keyless
 *   GET /history                    x-api-key required (free tier 10 req/h, shared with /ohlc)
 *   GET /ohlc/{symbol}              x-api-key required
 */
const BASE = process.env.GOLD_API_BASE_URL ?? "https://api.gold-api.com";
const SPOT_TTL = 30_000;
const SPOT_MAX_STALE = 3 * 60 * 60_000; // 3 h last-good fallback

interface RawPrice {
  currency: string;
  exchangeRate: number;
  name: string;
  price: number;
  symbol: string;
  updatedAt: string;
}

export function parseSpot(raw: unknown, symbol: SpotQuote["symbol"], currency: SpotQuote["currency"]): SpotQuote {
  const r = raw as Partial<RawPrice>;
  if (!r || typeof r.price !== "number" || !(r.price > 0)) throw new Error("gold-api: missing/invalid price");
  if (r.symbol !== symbol) throw new Error(`gold-api: expected ${symbol}, got ${r.symbol}`);
  if (r.currency !== currency) throw new Error(`gold-api: expected ${currency}, got ${r.currency}`);
  if (typeof r.updatedAt !== "string" || Number.isNaN(Date.parse(r.updatedAt))) throw new Error("gold-api: missing updatedAt");
  return {
    symbol,
    currency,
    pricePerOz: r.price,
    exchangeRate: typeof r.exchangeRate === "number" ? r.exchangeRate : 1,
    updatedAt: r.updatedAt,
  };
}

export function getSpot(symbol: SpotQuote["symbol"], currency: SpotQuote["currency"] = "USD"): Promise<CacheResult<SpotQuote>> {
  const path = currency === "USD" ? `/price/${symbol}` : `/price/${symbol}/${currency}`;
  return cached(`gold-api:${path}`, { ttlMs: SPOT_TTL, maxStaleMs: SPOT_MAX_STALE }, async () =>
    parseSpot(await fetchJson(`${BASE}${path}`), symbol, currency),
  );
}

export const hasGoldApiKey = () => Boolean(process.env.GOLD_API_KEY);

export interface HistoryRow {
  period: string; // YYYY-MM-DD (day/week) or YYYY-MM (month)
  usdPerOz: number;
}

/** Daily or weekly average spot price history. Requires GOLD_API_KEY (kept server-side). */
export function getGoldHistory(
  startSec: number,
  endSec: number,
  groupBy: "day" | "week" | "month",
): Promise<CacheResult<HistoryRow[]>> {
  const key = process.env.GOLD_API_KEY;
  // Cache key buckets the window to the day so we stay well under 10 requests/hour.
  const bucket = Math.floor(endSec / 86400);
  return cached(
    `gold-api:history:${groupBy}:${Math.floor(startSec / 86400)}:${bucket}`,
    { ttlMs: 6 * 3600_000, maxStaleMs: 7 * 86400_000 },
    async () => {
      if (!key) throw new Error("GOLD_API_KEY not configured");
      const qs = new URLSearchParams({
        symbol: "XAU",
        startTimestamp: String(startSec),
        endTimestamp: String(endSec),
        groupBy,
        aggregation: "avg",
        orderBy: "asc",
      });
      const raw = await fetchJson<unknown>(`${BASE}/history?${qs}`, { headers: { "x-api-key": key } });
      return parseHistory(raw, groupBy);
    },
  );
}

export function parseHistory(raw: unknown, groupBy: "day" | "week" | "month"): HistoryRow[] {
  if (!Array.isArray(raw)) {
    const err = (raw as { error?: string })?.error;
    throw new Error(`gold-api history: ${err ?? "unexpected response"}`);
  }
  return raw
    .map((row: Record<string, unknown>) => {
      const period = String(row[groupBy] ?? row.day ?? row.week ?? row.month ?? "");
      const price = Number(row.avg_price ?? row.max_price ?? row.min_price);
      return { period, usdPerOz: price };
    })
    .filter((r) => r.period && Number.isFinite(r.usdPerOz) && r.usdPerOz > 0)
    .sort((a, b) => a.period.localeCompare(b.period));
}
