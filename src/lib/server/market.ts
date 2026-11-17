import "server-only";
import { getSpot } from "./goldApi";
import { getUsdInr } from "./fx";
import { getTicks, recordTick } from "./ticks";
import type { CacheResult } from "./cache";
import type { MarketResponse, SourceId, SourceStatus } from "@/lib/types";
import { inrPerFineGram, inrPerFineGramFromInrOz } from "@/lib/calc";
import { TROY_OUNCES_PER_KG } from "@/lib/units";

export function toStatus<T>(id: SourceId, r: CacheResult<T>, sourceUpdatedAt: string | null): SourceStatus {
  return {
    id,
    status: r.value ? (r.stale ? "stale" : "live") : "error",
    fetchedAt: r.fetchedAt ? new Date(r.fetchedAt).toISOString() : null,
    sourceUpdatedAt,
    ...(r.error ? { error: r.error } : {}),
  };
}

export async function getMarket(): Promise<MarketResponse> {
  const [goldUsd, goldInr, silverUsd, fx] = await Promise.all([getSpot("XAU", "USD"), getSpot("XAU", "INR"), getSpot("XAG", "USD"), getUsdInr()]);

  const gU = goldUsd.value,
    gI = goldInr.value,
    sU = silverUsd.value,
    f = fx.value;

  if (gU && !goldUsd.stale) recordTick({ t: Date.parse(gU.updatedAt), usdPerOz: gU.pricePerOz, inrPerOz: gI?.pricePerOz ?? null });

  let derived: MarketResponse["derived"] = null;
  // Prefer gold-api's live INR quote; fall back to USD spot × ECB USD/INR.
  const finePerGram = gI ? inrPerFineGramFromInrOz(gI.pricePerOz) : gU && f ? inrPerFineGram(gU.pricePerOz, f.rate) : null;
  if (finePerGram) {
    const usdInrForSilver = gI?.exchangeRate ?? f?.rate ?? null;
    derived = {
      basis: gI ? "gold-api-inr" : "usd-x-ecb",
      finePerGram,
      per10g24k999: finePerGram * 10 * 0.999,
      per10g22k916: finePerGram * 10 * 0.916,
      per1g24k999: finePerGram * 0.999,
      silverPerKg999: sU && usdInrForSilver ? sU.pricePerOz * usdInrForSilver * TROY_OUNCES_PER_KG * 0.999 : null,
      fxCrossCheckDiff: gI && gU && f ? gI.pricePerOz / (gU.pricePerOz * f.rate) - 1 : null,
    };
  }

  const { ticks, since } = getTicks();
  const newestSpot = [gU?.updatedAt, gI?.updatedAt, sU?.updatedAt].filter(Boolean).sort().at(-1) ?? null;

  return {
    serverTime: new Date().toISOString(),
    goldUsd: gU,
    goldInr: gI,
    silverUsd: sU,
    fx: f,
    derived,
    ticks,
    ticksSince: since ? new Date(since).toISOString() : null,
    sources: [
      mergeStatus("gold-api", [toStatus("gold-api", goldUsd, gU?.updatedAt ?? null), toStatus("gold-api", goldInr, gI?.updatedAt ?? null), toStatus("gold-api", silverUsd, sU?.updatedAt ?? null)], newestSpot),
      toStatus("ecb-frankfurter", fx, f ? `${f.date}T14:15:00Z` : null),
      { id: "server-ticks", status: ticks.length ? "live" : "error", fetchedAt: ticks.length ? new Date(ticks.at(-1)!.t).toISOString() : null, sourceUpdatedAt: ticks.length ? new Date(ticks.at(-1)!.t).toISOString() : null },
    ],
  };
}

/** Worst-of merge for several calls to the same provider. */
function mergeStatus(id: SourceId, parts: SourceStatus[], sourceUpdatedAt: string | null): SourceStatus {
  const rank = { live: 0, stale: 1, unconfigured: 2, error: 3 } as const;
  const worst = parts.reduce((a, b) => (rank[b.status] > rank[a.status] ? b : a));
  const fetched = parts.map((p) => p.fetchedAt).filter(Boolean).sort();
  const errors = parts.map((p) => p.error).filter(Boolean);
  return {
    id,
    status: worst.status,
    fetchedAt: fetched[0] ?? null,
    sourceUpdatedAt,
    ...(errors.length ? { error: [...new Set(errors)].join("; ") } : {}),
  };
}
