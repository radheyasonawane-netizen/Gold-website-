import { NextResponse } from "next/server";
import { getMcx } from "@/lib/server/mcx";

export const dynamic = "force-dynamic";

/** MCX Gold Ten futures quote via the Groww Trade API (exchange price, no GST). */
export async function GET() {
  try {
    const data = await getMcx();
    return NextResponse.json(data, { status: data.quote ? 200 : 502, headers: { "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unexpected error" }, { status: 500 });
  }
}
