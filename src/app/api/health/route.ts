import { NextResponse } from "next/server";
import { getMarket } from "@/lib/server/market";
import { getHistory, availableRanges } from "@/lib/server/history";
import { getSellerFeed } from "@/lib/server/sellerFeed";
import { hasGoldApiKey } from "@/lib/server/goldApi";
import { SOURCES } from "@/lib/server/sources";

export const dynamic = "force-dynamic";

/** Connectivity report for every upstream, used by the Sources panel and by tests. */
export async function GET() {
  const t0 = Date.now();
  const [market, history, sellers] = await Promise.all([getMarket(), getHistory(availableRanges().includes("1Y") ? "1Y" : availableRanges()[0]), getSellerFeed()]);
  const statuses = [
    ...market.sources,
    {
      id: history.source,
      status: history.status,
      fetchedAt: history.fetchedAt,
      sourceUpdatedAt: history.sourceUpdatedAt,
      ...(history.error ? { error: history.error } : {}),
    },
    ...(hasGoldApiKey() ? [] : [{ id: "gold-api-history" as const, status: "unconfigured" as const, fetchedAt: null, sourceUpdatedAt: null }]),
    sellers.status,
  ];
  return NextResponse.json(
    {
      ok: statuses.every((s) => s.status === "live" || s.status === "unconfigured"),
      checkedAt: new Date().toISOString(),
      tookMs: Date.now() - t0,
      sources: statuses.map((s) => ({ ...SOURCES[s.id], ...s })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
