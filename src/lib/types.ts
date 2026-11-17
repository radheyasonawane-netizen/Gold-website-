/** Shared API contracts between the route handler and the client UI. */

export type FetchStatus = "live" | "stale" | "error" | "unconfigured";

/** The MCX Gold Ten futures contract being shown. */
export interface GoldTenContract {
  /** Groww trading symbol, e.g. GOLDTEN30NOV26FUT. */
  tradingSymbol: string;
  /** Contract expiry, YYYY-MM-DD. */
  expiry: string;
}

/** Fields exactly as returned by Groww's live-data quote API (₹ per 10 g, exchange price, no GST). */
export interface GoldTenQuote {
  lastPrice: number;
  dayChange: number | null;
  dayChangePct: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  /** Epoch ms of the last trade, from MCX via Groww. */
  lastTradeTime: number | null;
  volume: number | null;
  openInterest: number | null;
}

export interface PriceTick {
  t: number; // last trade time, epoch ms
  p: number; // last price
}

export interface McxResponse {
  serverTime: string;
  contract: GoldTenContract | null;
  quote: GoldTenQuote | null;
  status: FetchStatus;
  /** When our server last fetched the quote successfully (ISO). */
  fetchedAt: string | null;
  error?: string;
  /** Distinct trades this server has seen (resets on restart). */
  ticks: PriceTick[];
}
