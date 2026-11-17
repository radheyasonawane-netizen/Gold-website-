import "server-only";
import { getOroPocket } from "./oroPocket";
import { getTicks, recordTick } from "./ticks";
import type { RateResponse } from "@/lib/types";

export async function getRate(): Promise<RateResponse> {
  const r = await getOroPocket();
  const q = r.value;
  if (q && !r.stale) recordTick({ t: Date.parse(q.timestamp), finalBuy: q.gold.finalBuy });
  return {
    serverTime: new Date().toISOString(),
    quote: q,
    status: q ? (r.stale ? "stale" : "live") : "error",
    fetchedAt: r.fetchedAt ? new Date(r.fetchedAt).toISOString() : null,
    ...(r.error ? { error: r.error } : {}),
    ticks: getTicks(),
  };
}
