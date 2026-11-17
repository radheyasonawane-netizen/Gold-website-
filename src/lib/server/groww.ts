import "server-only";
import { cached, type CacheResult } from "./cache";
import type { GoldTenContract, GoldTenQuote } from "@/lib/types";

/**
 * Groww Trade API adapter for MCX Gold Ten futures.
 *
 * Verified against Groww's docs and the official `growwapi` 1.5.0 package (17 Nov 2026):
 *  - Quote:       GET https://api.groww.in/v1/live-data/quote?exchange=MCX&segment=COMMODITY&trading_symbol=…
 *  - Headers:     Authorization: Bearer <access token>, x-api-version: 1.0 (plus SDK client headers)
 *  - Instruments: https://growwapi-assets.groww.in/instruments/instrument.csv
 *                 (lists MCX,…,GOLDTEN30NOV26FUT,…,FUT,COMMODITY,…,GOLDTEN,,2026-11-30,…)
 *  - Rate limit:  Live data 10 req/s, 300 req/min.
 * The access token is read from GROWW_ACCESS_TOKEN on the server only (Groww tokens expire daily at 6:00 AM).
 */
const API = process.env.GROWW_API_BASE ?? "https://api.groww.in/v1";
const INSTRUMENTS = process.env.GROWW_INSTRUMENTS_URL ?? "https://growwapi-assets.groww.in/instruments/instrument.csv";

export class GrowwError extends Error {
  constructor(
    message: string,
    public readonly kind: "unconfigured" | "forbidden" | "unauthorized" | "upstream",
  ) {
    super(message);
  }
}

export const hasGrowwToken = () => Boolean(process.env.GROWW_ACCESS_TOKEN);

function headers(): Record<string, string> {
  return {
    accept: "application/json",
    authorization: `Bearer ${process.env.GROWW_ACCESS_TOKEN}`,
    "x-api-version": "1.0",
    "x-client-id": "growwapi",
    "x-request-id": crypto.randomUUID(),
  };
}

/** Picks the nearest Gold Ten futures contract that hasn't expired (by IST date). */
export function pickGoldTen(csv: string, todayIst: string): GoldTenContract {
  const lines = csv.split("\n");
  const head = lines[0].split(",");
  const col = (n: string) => head.indexOf(n);
  const [cEx, cSym, cType, cSeg, cUnd, cExp] = ["exchange", "trading_symbol", "instrument_type", "segment", "underlying_symbol", "expiry_date"].map(col);
  if ([cEx, cSym, cType, cSeg, cUnd, cExp].some((i) => i < 0)) throw new GrowwError("Groww instruments: unexpected columns", "upstream");
  const contracts: GoldTenContract[] = [];
  for (const line of lines) {
    if (!line.startsWith("MCX,") || !line.includes("GOLDTEN")) continue;
    const f = line.split(",");
    if (f[cUnd] === "GOLDTEN" && f[cType] === "FUT" && f[cSeg] === "COMMODITY" && f[cExp] >= todayIst) contracts.push({ tradingSymbol: f[cSym], expiry: f[cExp] });
  }
  contracts.sort((a, b) => a.expiry.localeCompare(b.expiry));
  if (!contracts[0]) throw new GrowwError("No live MCX Gold Ten contract in Groww's instrument list", "upstream");
  return contracts[0];
}

const istDate = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

export function getGoldTenContract(): Promise<CacheResult<GoldTenContract>> {
  const today = istDate();
  return cached(`groww:goldten:contract:${today}`, { ttlMs: 12 * 3600_000, maxStaleMs: 24 * 3600_000 }, async () => {
    if (process.env.GROWW_GOLDTEN_SYMBOL) return { tradingSymbol: process.env.GROWW_GOLDTEN_SYMBOL, expiry: process.env.GROWW_GOLDTEN_EXPIRY ?? "" };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    try {
      const res = await fetch(INSTRUMENTS, { signal: ctrl.signal, cache: "no-store" });
      if (!res.ok) throw new GrowwError(`Groww instruments: HTTP ${res.status}`, "upstream");
      return pickGoldTen(await res.text(), today);
    } finally {
      clearTimeout(timer);
    }
  });
}

/** Maps Groww's quote payload. Values are passed through unchanged: no GST, no conversion. */
export function parseQuote(raw: unknown): GoldTenQuote {
  const r = raw as { status?: string; payload?: Record<string, unknown>; error?: { code?: string; message?: string } };
  if (r?.status !== "SUCCESS" || !r.payload) throw new GrowwError(`Groww: ${r?.error?.message ?? "unexpected response"}`, "upstream");
  const p = r.payload;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const lastPrice = n(p.last_price);
  if (!lastPrice || lastPrice <= 0) throw new GrowwError("Groww: quote has no last price", "upstream");
  const ohlc = (p.ohlc ?? {}) as Record<string, unknown>;
  return {
    lastPrice,
    dayChange: n(p.day_change),
    dayChangePct: n(p.day_change_perc),
    open: n(ohlc.open),
    high: n(ohlc.high),
    low: n(ohlc.low),
    close: n(ohlc.close),
    lastTradeTime: n(p.last_trade_time),
    volume: n(p.volume),
    openInterest: n(p.open_interest),
  };
}

export function getGoldTenQuote(contract: GoldTenContract): Promise<CacheResult<GoldTenQuote>> {
  // 15 s cache keeps us far below Groww's 300 req/min live-data limit however many visitors poll.
  return cached(`groww:goldten:quote:${contract.tradingSymbol}`, { ttlMs: 15_000, maxStaleMs: 30 * 60_000 }, async () => {
    if (!hasGrowwToken()) throw new GrowwError("GROWW_ACCESS_TOKEN is not set on the server", "unconfigured");
    const qs = new URLSearchParams({ exchange: "MCX", segment: "COMMODITY", trading_symbol: contract.tradingSymbol });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    let res: Response;
    try {
      res = await fetch(`${API}/live-data/quote?${qs}`, { headers: headers(), signal: ctrl.signal, cache: "no-store" });
    } catch (e) {
      throw new GrowwError(`Groww unreachable: ${e instanceof Error ? (e.name === "AbortError" ? "timed out" : e.message) : "network error"}`, "upstream");
    } finally {
      clearTimeout(timer);
    }
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    if (res.status === 401) throw new GrowwError("Groww rejected the access token (401). Tokens expire daily at 6:00 AM; generate a new one.", "unauthorized");
    if (res.status === 403)
      throw new GrowwError("Groww refused market data for this account (403: “Access forbidden for this request”). An active Groww Trading API subscription is required, and Groww’s docs say MCX is not yet available.", "forbidden");
    if (!res.ok) throw new GrowwError(`Groww: HTTP ${res.status}${body?.error?.message ? ` – ${body.error.message}` : ""}`, "upstream");
    return parseQuote(body);
  });
}
