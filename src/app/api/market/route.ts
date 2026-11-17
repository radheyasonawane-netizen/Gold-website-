import { NextResponse } from "next/server";
import { getMarket } from "@/lib/server/market";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getMarket();
    const ok = Boolean(data.derived);
    return NextResponse.json(data, {
      status: ok ? 200 : 502,
      headers: { "cache-control": "public, max-age=15, stale-while-revalidate=30" },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unexpected error" }, { status: 500 });
  }
}
