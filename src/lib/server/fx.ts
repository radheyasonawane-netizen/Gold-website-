import "server-only";
import { cached, type CacheResult } from "./cache";
import { fetchJson } from "./http";
import type { FxQuote } from "@/lib/types";

/**
 * USD/INR from ECB euro reference rates via Frankfurter (keyless).
 * Docs: https://frankfurter.dev/ — v2 API, provider-scoped path /v2/providers/ecb/rates
 */
const BASE = process.env.FRANKFURTER_BASE_URL ?? "https://api.frankfurter.dev";

interface Row {
  date: string;
  base: string;
  quote: string;
  rate: number;
}

export function parseFxRows(raw: unknown): Row[] {
  if (!Array.isArray(raw)) throw new Error("frankfurter: unexpected response");
  return raw.filter(
    (r): r is Row => r && r.base === "USD" && r.quote === "INR" && typeof r.rate === "number" && r.rate > 0 && /^\d{4}-\d{2}-\d{2}$/.test(r.date),
  );
}

export function getUsdInr(): Promise<CacheResult<FxQuote>> {
  return cached("fx:usdinr:latest", { ttlMs: 3600_000, maxStaleMs: 5 * 86400_000 }, async () => {
    // Look back 10 days so weekends/holidays still return the latest fixing.
    const from = new Date(Date.now() - 10 * 86400_000).toISOString().slice(0, 10);
    const rows = parseFxRows(await fetchJson(`${BASE}/v2/providers/ecb/rates?base=USD&quotes=INR&from=${from}`));
    const last = rows.at(-1);
    if (!last) throw new Error("frankfurter: no USD/INR rows");
    return { pair: "USD/INR", rate: last.rate, date: last.date, provider: "ECB" };
  });
}

/** Map of YYYY-MM-DD (or YYYY-MM-01 when grouped by month) → rate. */
export function getUsdInrSeries(from: string, group?: "week" | "month"): Promise<CacheResult<Map<string, number>>> {
  return cached(`fx:usdinr:${from}:${group ?? "day"}`, { ttlMs: 12 * 3600_000, maxStaleMs: 14 * 86400_000 }, async () => {
    const qs = new URLSearchParams({ base: "USD", quotes: "INR", from });
    if (group) qs.set("group", group);
    const rows = parseFxRows(await fetchJson(`${BASE}/v2/providers/ecb/rates?${qs}`, { timeoutMs: 15000 }));
    return new Map(rows.map((r) => [r.date, r.rate]));
  });
}

/** Returns the rate on `date` or the most recent earlier fixing (FX isn't published on weekends). */
export function rateOnOrBefore(series: Map<string, number>, date: string, sortedKeys?: string[]): number | null {
  const direct = series.get(date);
  if (direct) return direct;
  const keys = sortedKeys ?? [...series.keys()].sort();
  let lo = 0,
    hi = keys.length - 1,
    ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (keys[mid] <= date) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans >= 0 ? series.get(keys[ans])! : null;
}
