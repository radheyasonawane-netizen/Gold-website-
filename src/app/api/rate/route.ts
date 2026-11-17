import { NextResponse } from "next/server";
import { getRate } from "@/lib/server/market";

export const dynamic = "force-dynamic";

/** Today's Indian gold & silver rate from OroPocket, with freshness metadata. */
export async function GET() {
  try {
    const data = await getRate();
    return NextResponse.json(data, {
      status: data.quote ? 200 : 502,
      headers: { "cache-control": "public, max-age=30, stale-while-revalidate=60" },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unexpected error" }, { status: 500 });
  }
}
