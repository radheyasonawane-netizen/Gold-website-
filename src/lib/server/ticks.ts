import "server-only";
import type { RateTick } from "@/lib/types";

/**
 * Distinct OroPocket rates this server has observed (deduped by OroPocket's timestamp).
 * In memory only: resets on restart. The UI labels it "recorded since …".
 */
const MAX = 600; // ~2 days at 5-minute updates
const g = globalThis as unknown as { __rateTicks?: RateTick[] };
const ticks = (g.__rateTicks ??= []);

export function recordTick(t: RateTick) {
  const last = ticks.at(-1);
  if (last && last.t >= t.t) return;
  ticks.push(t);
  if (ticks.length > MAX) ticks.splice(0, ticks.length - MAX);
}

export function getTicks(windowMs = 24 * 3600_000): RateTick[] {
  const cutoff = Date.now() - windowMs;
  return ticks.filter((x) => x.t >= cutoff);
}
