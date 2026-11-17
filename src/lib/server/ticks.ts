import "server-only";
import type { Tick } from "@/lib/types";

/**
 * Ring buffer of spot quotes this server has actually observed (deduped by upstream timestamp).
 * Lives in memory: it resets on restart and is per-instance on serverless hosts. The UI labels it
 * "recorded by this server since …" so it is never mistaken for a complete market history.
 */
const MAX = 2880; // ~24 h at 30 s
const g = globalThis as unknown as { __goldTicks?: { since: number | null; ticks: Tick[] } };
const state = (g.__goldTicks ??= { since: null, ticks: [] });

export function recordTick(t: Tick) {
  const last = state.ticks.at(-1);
  if (last && last.t >= t.t) return; // same or older upstream quote
  state.ticks.push(t);
  state.since ??= t.t;
  if (state.ticks.length > MAX) {
    state.ticks.splice(0, state.ticks.length - MAX);
    state.since = state.ticks[0].t;
  }
}

export function getTicks(windowMs = 24 * 3600_000): { ticks: Tick[]; since: number | null } {
  const cutoff = Date.now() - windowMs;
  return { ticks: state.ticks.filter((x) => x.t >= cutoff), since: state.since };
}
