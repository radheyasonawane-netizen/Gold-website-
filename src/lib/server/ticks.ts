import "server-only";
import type { PriceTick } from "@/lib/types";

/**
 * Distinct trades this server has observed (deduped by last-trade time). In memory: resets on
 * restart. The UI labels it "recorded by this site since …".
 */
const MAX = 3000;
const g = globalThis as unknown as { __mcxTicks?: PriceTick[] };
const ticks = (g.__mcxTicks ??= []);

export function recordTick(t: PriceTick) {
  const last = ticks.at(-1);
  if (last && last.t >= t.t) return;
  ticks.push(t);
  if (ticks.length > MAX) ticks.splice(0, ticks.length - MAX);
}

export function getTicks(windowMs = 24 * 3600_000): PriceTick[] {
  const cutoff = Date.now() - windowMs;
  return ticks.filter((x) => x.t >= cutoff);
}
