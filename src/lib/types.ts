/** Shared API contracts between the route handlers and the client UI. */

export type SourceId = "gold-api" | "gold-api-history" | "ecb-frankfurter" | "world-bank" | "server-ticks" | "seller-feed";

export interface SourceInfo {
  id: SourceId;
  name: string;
  provider: string;
  url: string;
  /** What the number represents, in plain words. */
  represents: string;
  licence: string;
  updateFrequency: string;
  attribution: string;
}

/**
 * Freshness of a value as served by *our* server:
 * - live: fetched successfully within the source's TTL
 * - stale: upstream failed; serving last good value (age shown)
 * - error: upstream failed and nothing cached
 * - unconfigured: source needs a credential/licence we don't have
 */
export type FetchStatus = "live" | "stale" | "error" | "unconfigured";

export interface SourceStatus {
  id: SourceId;
  status: FetchStatus;
  /** When our server last successfully fetched this source (ISO). */
  fetchedAt: string | null;
  /** Timestamp reported by the upstream for the data itself (ISO), if any. */
  sourceUpdatedAt: string | null;
  error?: string;
}

export interface SpotQuote {
  symbol: "XAU" | "XAG";
  currency: "USD" | "INR";
  /** Price per troy ounce of fine metal in `currency`. */
  pricePerOz: number;
  /** gold-api.com's own conversion rate for non-USD quotes. */
  exchangeRate: number;
  updatedAt: string;
}

export interface FxQuote {
  pair: "USD/INR";
  rate: number;
  /** Reference date of the ECB fixing (YYYY-MM-DD). */
  date: string;
  provider: "ECB";
}

export interface Tick {
  t: number; // epoch ms (source updatedAt)
  usdPerOz: number;
  inrPerOz: number | null;
}

export interface MarketResponse {
  serverTime: string;
  goldUsd: SpotQuote | null;
  goldInr: SpotQuote | null;
  silverUsd: SpotQuote | null;
  fx: FxQuote | null;
  /** Derived values (computed server-side, documented in METHODOLOGY). Null if inputs missing. */
  derived: {
    /** Which USD/INR was used: gold-api's own INR quote or ECB cross. */
    basis: "gold-api-inr" | "usd-x-ecb";
    finePerGram: number;
    per10g24k999: number;
    per10g22k916: number;
    per1g24k999: number;
    silverPerKg999: number | null;
    /** Cross-check: gold-api INR quote vs USD×ECB. Fraction. */
    fxCrossCheckDiff: number | null;
  } | null;
  ticks: Tick[];
  ticksSince: string | null;
  sources: SourceStatus[];
}

export type HistoryRange = "1M" | "3M" | "6M" | "1Y" | "3Y" | "5Y" | "10Y" | "MAX";

export interface HistoryPoint {
  /** Period start, epoch ms UTC. */
  t: number;
  usdPerOz: number;
  usdInr: number | null;
  /** INR per 10 g of 999 gold at international parity (ex-duty, ex-GST). */
  inrPer10g: number | null;
}

export interface HistoryResponse {
  range: HistoryRange;
  granularity: "day" | "week" | "month";
  source: SourceId;
  /** Ranges this server can honestly serve with the configured sources. */
  availableRanges: HistoryRange[];
  points: HistoryPoint[];
  /** Latest live spot appended for context (not part of the historical series). */
  live: HistoryPoint | null;
  sourceUpdatedAt: string | null;
  fetchedAt: string;
  status: FetchStatus;
  note: string;
  error?: string;
}

export interface SellerFeedQuote {
  seller: string;
  product: string;
  url: string;
  grams: number;
  fineness: number;
  price: number;
  includesGst: boolean;
  updatedAt: string;
}

export interface SellersResponse {
  configured: boolean;
  feedName: string | null;
  quotes: SellerFeedQuote[];
  status: SourceStatus;
}
