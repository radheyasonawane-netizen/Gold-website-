/** Shared API contracts between the route handlers and the client UI. */

export type FetchStatus = "live" | "stale" | "error";

/** One metal from OroPocket's published rates, ₹ per gram. */
export interface OroMetalQuote {
  /** Buy rate excluding GST. */
  buy: number;
  /** Sell-back rate (no GST on sells). */
  sell: number;
  /** GST amount per gram on a buy (3%). */
  gst: number;
  /** buy + gst: what a customer pays per gram. */
  finalBuy: number;
  change24hBuyPct: number | null;
  change24hSellPct: number | null;
}

export interface OroPocketQuote {
  gold: OroMetalQuote;
  silver: OroMetalQuote | null;
  /** When OroPocket last refreshed its rates (ISO). */
  timestamp: string;
  /** OroPocket states its gold is 24K 99.9%. */
  goldFineness: number;
}

export interface RateTick {
  t: number; // OroPocket timestamp, epoch ms
  finalBuy: number; // ₹/g incl. GST
}

export interface RateResponse {
  serverTime: string;
  quote: OroPocketQuote | null;
  status: FetchStatus;
  /** When our server last fetched OroPocket successfully (ISO). */
  fetchedAt: string | null;
  error?: string;
  /** Distinct OroPocket rates this server has seen (resets on restart). */
  ticks: RateTick[];
}
