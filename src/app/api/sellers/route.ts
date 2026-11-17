import { NextResponse } from "next/server";
import { getSellerFeed } from "@/lib/server/sellerFeed";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getSellerFeed();
  return NextResponse.json(data, { headers: { "cache-control": "public, max-age=60" } });
}
