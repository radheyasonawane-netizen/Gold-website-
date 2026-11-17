import "server-only";
import { getGoldTenContract, getGoldTenQuote, GrowwError } from "./groww";
import { getTicks, recordTick } from "./ticks";
import type { McxResponse } from "@/lib/types";

export async function getMcx(): Promise<McxResponse> {
  const serverTime = new Date().toISOString();
  const c = await getGoldTenContract();
  if (!c.value) return { serverTime, contract: null, quote: null, status: "error", fetchedAt: null, error: c.error ?? "Contract lookup failed", ticks: [] };
  const q = await getGoldTenQuote(c.value);
  if (q.value && !q.stale && q.value.lastTradeTime) recordTick({ t: q.value.lastTradeTime, p: q.value.lastPrice });
  const unconfigured = !q.value && /GROWW_ACCESS_TOKEN is not set/.test(q.error ?? "");
  return {
    serverTime,
    contract: c.value,
    quote: q.value,
    status: q.value ? (q.stale ? "stale" : "live") : unconfigured ? "unconfigured" : "error",
    fetchedAt: q.fetchedAt ? new Date(q.fetchedAt).toISOString() : null,
    ...(q.error ? { error: q.error } : {}),
    ticks: getTicks(),
  };
}

export { GrowwError };
