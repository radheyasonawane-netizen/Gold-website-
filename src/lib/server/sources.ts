import "server-only";
import type { SourceInfo } from "@/lib/types";

/**
 * Registry of every upstream this app reads, with licence/attribution as verified on
 * 2026-11-17 (see DATA_SOURCES.md for quotes and evidence).
 */
export const SOURCES: Record<SourceInfo["id"], SourceInfo> = {
  "gold-api": {
    id: "gold-api",
    name: "Gold API — real-time spot",
    provider: "gold-api.com",
    url: "https://gold-api.com/",
    represents: "International spot price of gold (XAU) and silver (XAG) per troy ounce, in USD and INR.",
    licence: "Free endpoint, no key; ToS §9: “Commercial use of the API is always permitted.”",
    updateFrequency: "Every ~30 s (we cache 30 s server-side, per provider guidance).",
    attribution: "Spot prices: gold-api.com",
  },
  "gold-api-history": {
    id: "gold-api-history",
    name: "Gold API — /history & /ohlc",
    provider: "gold-api.com",
    url: "https://gold-api.com/docs",
    represents: "Daily/weekly aggregated spot price history (avg).",
    licence: "Requires an API key (free tier: 10 req/hour shared with /ohlc). Server-side only.",
    updateFrequency: "Daily aggregates; we cache 6 h.",
    attribution: "Price history: gold-api.com",
  },
  "ecb-frankfurter": {
    id: "ecb-frankfurter",
    name: "ECB euro reference rates via Frankfurter",
    provider: "European Central Bank (served by api.frankfurter.dev)",
    url: "https://frankfurter.dev/",
    represents: "USD/INR cross rate derived from ECB daily euro foreign-exchange reference rates.",
    licence: "Open, keyless public API; ECB reference rates are published for information purposes.",
    updateFrequency: "Once per TARGET working day (~16:00 CET). Cached 1 h.",
    attribution: "FX: European Central Bank via Frankfurter",
  },
  "world-bank": {
    id: "world-bank",
    name: "World Bank Commodity Price Data (Pink Sheet)",
    provider: "World Bank Group",
    url: "https://www.worldbank.org/en/research/commodity-markets",
    represents: "Monthly average gold price, USD per troy ounce (spot average of daily rates since Jun 2025; LBMA PM fix before).",
    licence: "World Bank open data; attribution required. Verify terms before commercial redistribution.",
    updateFrequency: "Monthly (first week of the month). Cached 24 h.",
    attribution: "Source: World Bank Commodity Price Data (The Pink Sheet)",
  },
  "server-ticks": {
    id: "server-ticks",
    name: "Intraday ticks recorded by this server",
    provider: "This site (derived from gold-api.com)",
    url: "/#methodology",
    represents: "Spot quotes this server has observed since it started; not a complete market record.",
    licence: "Derived from gold-api.com spot data.",
    updateFrequency: "Whenever a visitor’s request triggers a fresh spot fetch (≤ every 30 s).",
    attribution: "Intraday: recorded from gold-api.com",
  },
  oropocket: {
    id: "oropocket",
    name: "OroPocket published rates",
    provider: "OroPocket (api.oropocket.com/public/prices)",
    url: "https://oropocket.com/",
    represents: "OroPocket’s own buy (excl. GST) and sell rates per gram for 24K 99.9% digital gold (Augmont-sourced) and 999 silver. A real Indian retail price, not a market feed.",
    licence: "Keyless public endpoint (CORS open, 10 requests/min). Not covered by OroPocket’s developer docs; no explicit reuse licence found. Documented alternative: /partner/prices with a sandbox key.",
    updateFrequency: "Observed every ~5 min (docs say up to 30 min); we cache 2 min.",
    attribution: "Retail rates: OroPocket",
  },
  "seller-feed": {
    id: "seller-feed",
    name: "Licensed seller price feed",
    provider: "Configured via SELLER_FEED_URL",
    url: "/#sellers",
    represents: "Retail listed prices supplied by a feed you are licensed to use.",
    licence: "Not configured. No public, licensed multi-seller feed was found (see DATA_SOURCES.md).",
    updateFrequency: "Per feed; cached 5 min.",
    attribution: "Seller feed",
  },
};
