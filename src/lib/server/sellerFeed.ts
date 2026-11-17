import "server-only";
import { cached } from "./cache";
import { fetchJson } from "./http";
import type { SellerFeedQuote, SellersResponse } from "@/lib/types";

/**
 * Optional, licence-gated seller price feed.
 *
 * No public, licensed multi-seller price API for Indian gold retailers was found during the
 * investigation (see DATA_SOURCES.md). Scraping retailer sites or re-serving another site's
 * scraped data is not something this project does. If you obtain a feed you are permitted to
 * display (e.g. a partner/B2B agreement), point SELLER_FEED_URL at an endpoint that returns:
 *
 *   { "name": "Feed name", "quotes": [ SellerFeedQuote, ... ] }
 *
 * with SellerFeedQuote = { seller, product, url, grams, fineness (0–1), price (₹),
 * includesGst (bool), updatedAt (ISO) }. Optional bearer token: SELLER_FEED_TOKEN.
 */
export function parseSellerFeed(raw: unknown): { name: string; quotes: SellerFeedQuote[] } {
  const r = raw as { name?: unknown; quotes?: unknown };
  if (!r || !Array.isArray(r.quotes)) throw new Error("seller feed: 'quotes' array missing");
  const quotes = r.quotes.filter((q: Partial<SellerFeedQuote>): q is SellerFeedQuote =>
    Boolean(
      q &&
        typeof q.seller === "string" &&
        typeof q.product === "string" &&
        typeof q.url === "string" &&
        typeof q.grams === "number" && q.grams > 0 &&
        typeof q.fineness === "number" && q.fineness > 0 && q.fineness <= 1 &&
        typeof q.price === "number" && q.price > 0 &&
        typeof q.includesGst === "boolean" &&
        typeof q.updatedAt === "string" && !Number.isNaN(Date.parse(q.updatedAt)),
    ),
  );
  return { name: typeof r.name === "string" ? r.name : "Seller feed", quotes };
}

export async function getSellerFeed(): Promise<SellersResponse> {
  const url = process.env.SELLER_FEED_URL;
  if (!url) {
    return {
      configured: false,
      feedName: null,
      quotes: [],
      status: { id: "seller-feed", status: "unconfigured", fetchedAt: null, sourceUpdatedAt: null },
    };
  }
  const token = process.env.SELLER_FEED_TOKEN;
  const res = await cached("seller-feed", { ttlMs: 5 * 60_000, maxStaleMs: 3 * 3600_000 }, async () =>
    parseSellerFeed(await fetchJson(url, { headers: token ? { authorization: `Bearer ${token}` } : {} })),
  );
  const newest = res.value?.quotes.map((q) => q.updatedAt).sort().at(-1) ?? null;
  return {
    configured: true,
    feedName: res.value?.name ?? null,
    quotes: res.value?.quotes ?? [],
    status: {
      id: "seller-feed",
      status: res.value ? (res.stale ? "stale" : "live") : "error",
      fetchedAt: res.fetchedAt ? new Date(res.fetchedAt).toISOString() : null,
      sourceUpdatedAt: newest,
      error: res.error,
    },
  };
}
