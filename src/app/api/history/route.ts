import { NextResponse, type NextRequest } from "next/server";
import { availableRanges, getHistory, isRange } from "@/lib/server/history";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("range");
  const range = isRange(q) ? q : availableRanges().includes("1Y") ? "1Y" : availableRanges()[0];
  try {
    const data = await getHistory(range);
    return NextResponse.json(data, {
      status: data.status === "error" ? 502 : 200,
      headers: { "cache-control": "public, max-age=300, stale-while-revalidate=3600" },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unexpected error" }, { status: 500 });
  }
}
