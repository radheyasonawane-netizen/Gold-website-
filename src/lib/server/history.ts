import "server-only";
import { getGoldHistory, getSpot, hasGoldApiKey } from "./goldApi";
import { getUsdInrSeries, rateOnOrBefore } from "./fx";
import { getWorldBankGoldMonthly } from "./worldBank";
import type { HistoryPoint, HistoryRange, HistoryResponse } from "@/lib/types";
import { inrPerFineGram } from "@/lib/calc";

const DAY = 86400_000;
const RANGE_DAYS: Record<HistoryRange, number> = { "1M": 31, "3M": 92, "6M": 183, "1Y": 366, "3Y": 3 * 366, "5Y": 5 * 366, "10Y": 10 * 366, MAX: 0 };
/** ECB USD/INR coverage in Frankfurter begins in 1999; we start MAX at 2000 so every point has INR. */
const MAX_START = "2000-01-01";

export const KEYED_RANGES: HistoryRange[] = ["1M", "3M", "6M", "1Y", "3Y", "5Y", "10Y"];
export const MONTHLY_RANGES: HistoryRange[] = ["1Y", "3Y", "5Y", "10Y", "MAX"];

export function availableRanges(): HistoryRange[] {
  return hasGoldApiKey() ? [...KEYED_RANGES, "MAX"] : MONTHLY_RANGES;
}

export function isRange(x: string | null): x is HistoryRange {
  return !!x && x in RANGE_DAYS;
}

function per10g(usdPerOz: number, usdInr: number | null) {
  return usdInr ? inrPerFineGram(usdPerOz, usdInr) * 10 * 0.999 : null;
}

export async function getHistory(range: HistoryRange): Promise<HistoryResponse> {
  const now = Date.now();
  const startDate = range === "MAX" ? MAX_START : new Date(now - RANGE_DAYS[range] * DAY).toISOString().slice(0, 10);
  const live = await liveParityPoint();
  const ranges = availableRanges();

  // 1) Daily/weekly from gold-api.com when a key is configured (and the range isn't MAX).
  if (hasGoldApiKey() && range !== "MAX") {
    const groupBy = RANGE_DAYS[range] <= 366 ? "day" : RANGE_DAYS[range] <= 5 * 366 ? "week" : "month";
    const [hist, fx] = await Promise.all([
      getGoldHistory(Math.floor(Date.parse(startDate) / 1000), Math.floor(now / 1000), groupBy),
      getUsdInrSeries(startDate),
    ]);
    if (hist.value && hist.value.length > 1) {
      const fxMap = fx.value ?? new Map<string, number>();
      const keys = [...fxMap.keys()].sort();
      const points: HistoryPoint[] = hist.value.map((r) => {
        const date = r.period.length === 7 ? `${r.period}-01` : r.period;
        const usdInr = rateOnOrBefore(fxMap, date, keys);
        return { t: Date.parse(`${date}T00:00:00Z`), usdPerOz: r.usdPerOz, usdInr, inrPer10g: per10g(r.usdPerOz, usdInr) };
      });
      return {
        range,
        granularity: groupBy,
        source: "gold-api-history",
        availableRanges: ranges,
        points,
        live,
        sourceUpdatedAt: new Date(points.at(-1)!.t).toISOString(),
        fetchedAt: new Date(hist.fetchedAt ?? now).toISOString(),
        status: hist.stale || fx.stale ? "stale" : "live",
        note: `${groupBy === "day" ? "Daily" : groupBy === "week" ? "Weekly" : "Monthly"} average spot (gold-api.com) × ECB USD/INR on the same date.`,
        ...(hist.error || fx.error ? { error: hist.error ?? fx.error } : {}),
      };
    }
    // fall through to World Bank on failure, but only for ranges it can serve honestly
    if (!MONTHLY_RANGES.includes(range)) {
      return empty(range, ranges, live, hist.error ?? "History unavailable");
    }
  }

  if (!MONTHLY_RANGES.includes(range)) {
    return {
      ...empty(range, ranges, live, undefined),
      status: "unconfigured",
      note: "Daily history needs GOLD_API_KEY (gold-api.com /history). Monthly ranges are available without a key.",
    };
  }

  // 2) Monthly averages from the World Bank Pink Sheet (keyless).
  const [wb, fx] = await Promise.all([getWorldBankGoldMonthly(), getUsdInrSeries(MAX_START, "month")]);
  if (!wb.value) return empty(range, ranges, live, wb.error ?? "World Bank data unavailable");
  const fxMap = fx.value ?? new Map<string, number>();
  const startMonth = startDate.slice(0, 7);
  const points: HistoryPoint[] = wb.value.rows
    .filter((r) => r.month >= startMonth)
    .map((r) => {
      const usdInr = fxMap.get(`${r.month}-01`) ?? null;
      return { t: Date.parse(`${r.month}-01T00:00:00Z`), usdPerOz: r.usdPerOz, usdInr, inrPer10g: per10g(r.usdPerOz, usdInr) };
    });
  return {
    range,
    granularity: "month",
    source: "world-bank",
    availableRanges: ranges,
    points,
    live,
    sourceUpdatedAt: points.length ? new Date(points.at(-1)!.t).toISOString() : null,
    fetchedAt: new Date(wb.fetchedAt ?? now).toISOString(),
    status: wb.stale || fx.stale ? "stale" : fx.value ? "live" : "stale",
    note: `Monthly average gold price (World Bank Pink Sheet${wb.value.updatedLabel ? `, ${wb.value.updatedLabel.replace(/^Updated/i, "updated")}` : ""}) × ECB monthly USD/INR.`,
    ...(wb.error || fx.error ? { error: wb.error ?? fx.error } : {}),
  };
}

async function liveParityPoint(): Promise<HistoryPoint | null> {
  const [usd, inr] = await Promise.all([getSpot("XAU", "USD"), getSpot("XAU", "INR")]);
  if (!usd.value) return null;
  const usdInr = inr.value?.exchangeRate ?? null;
  return { t: Date.parse(usd.value.updatedAt), usdPerOz: usd.value.pricePerOz, usdInr, inrPer10g: per10g(usd.value.pricePerOz, usdInr) };
}

function empty(range: HistoryRange, ranges: HistoryRange[], live: HistoryPoint | null, error: string | undefined): HistoryResponse {
  return {
    range,
    granularity: "day",
    source: hasGoldApiKey() ? "gold-api-history" : "world-bank",
    availableRanges: ranges,
    points: [],
    live,
    sourceUpdatedAt: null,
    fetchedAt: new Date().toISOString(),
    status: "error",
    note: "",
    ...(error ? { error } : {}),
  };
}
