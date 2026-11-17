import "server-only";
import { cached, type CacheResult } from "./cache";
import { fetchJson } from "./http";
import type { OroMetalQuote, OroPocketQuote } from "@/lib/types";

/**
 * OroPocket published retail rates (24K 99.9% digital gold sourced from Augmont; 999 silver).
 *
 * Endpoint (keyless, CORS *, observed 2026-11-17):  GET https://api.oropocket.com/public/prices
 *   { statusCode, message, data: { gold: {buy, sell, gst, currency:"INR", unit:"gram",
 *     change24h:{buy, sell}}, silver: {...}, timestamp } }
 * Observed limits: `ratelimit-policy: 10;w=60` (10 requests / 60 s per client).
 * Observed timestamps advance every 5 minutes (05:50:00 → 05:55:00 UTC); partner docs say "roughly every
 * 30 minutes". We cache 2 minutes: fresh enough, and far under the 10/min limit.
 * `buy` excludes GST; `gst` = 3% of `buy`; `sell` has no GST; `change24h` values are percentages.
 */
const URL_PUBLIC = process.env.OROPOCKET_PUBLIC_URL ?? "https://api.oropocket.com/public/prices";

function metal(raw: unknown, name: string): OroMetalQuote {
  const m = raw as Record<string, unknown> | undefined;
  const buy = Number(m?.buy),
    sell = Number(m?.sell),
    gst = Number(m?.gst);
  if (!(buy > 0) || !(sell > 0)) throw new Error(`OroPocket: invalid ${name} buy/sell`);
  if (m?.currency !== "INR" || m?.unit !== "gram") throw new Error(`OroPocket: unexpected ${name} unit ${String(m?.currency)}/${String(m?.unit)}`);
  const ch = (m?.change24h ?? {}) as Record<string, unknown>;
  const gstAmt = Number.isFinite(gst) && gst >= 0 ? gst : buy * 0.03;
  return {
    buy,
    sell,
    gst: gstAmt,
    finalBuy: buy + gstAmt,
    change24hBuyPct: Number.isFinite(Number(ch.buy)) ? Number(ch.buy) : null,
    change24hSellPct: Number.isFinite(Number(ch.sell)) ? Number(ch.sell) : null,
  };
}

export function parseOroPocket(raw: unknown): OroPocketQuote {
  const r = raw as { statusCode?: number; data?: Record<string, unknown> };
  if (!r || r.statusCode !== 200 || !r.data) throw new Error("OroPocket: unexpected response");
  const ts = String(r.data.timestamp ?? "");
  if (Number.isNaN(Date.parse(ts))) throw new Error("OroPocket: missing timestamp");
  return {
    gold: metal(r.data.gold, "gold"),
    silver: r.data.silver ? metal(r.data.silver, "silver") : null,
    timestamp: ts,
    goldFineness: 0.999,
  };
}

export function getOroPocket(): Promise<CacheResult<OroPocketQuote>> {
  return cached("oropocket:public", { ttlMs: 2 * 60_000, maxStaleMs: 3 * 3600_000 }, async () => parseOroPocket(await fetchJson(URL_PUBLIC)));
}
