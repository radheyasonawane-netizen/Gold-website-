import { describe, expect, it, beforeEach } from "vitest";
import { cached, __clearCache } from "@/lib/server/cache";

import { parseOroPocket } from "@/lib/server/oroPocket";

describe("OroPocket public prices", () => {
  const sample = {
    statusCode: 200,
    message: "Asset prices retrieved successfully",
    data: {
      gold: { buy: 14032.27, sell: 13559.46, gst: 420.97, currency: "INR", unit: "gram", change24h: { buy: 0.13, sell: -0.16 } },
      silver: { buy: 178.52, sell: 168.77, gst: 5.36, currency: "INR", unit: "gram", change24h: { buy: 0.88, sell: 0.56 } },
      timestamp: "2026-11-17T05:50:00.166Z",
    },
  };
  it("parses the observed response and derives the you-pay price", () => {
    const q = parseOroPocket(sample);
    expect(q.gold.finalBuy).toBeCloseTo(14453.24, 6);
    expect(q.gold.gst / q.gold.buy).toBeCloseTo(0.03, 4);
    expect(q.gold.change24hSellPct).toBe(-0.16);
    expect(q.silver?.finalBuy).toBeCloseTo(183.88, 6);
    expect(q.goldFineness).toBe(0.999);
  });
  it("rejects error envelopes and unit changes", () => {
    expect(() => parseOroPocket({ statusCode: 429, message: "Too many requests" })).toThrow();
    expect(() => parseOroPocket({ ...sample, data: { ...sample.data, gold: { ...sample.data.gold, unit: "10 gram" } } })).toThrow(/unit/);
  });
});

describe("cache: last-good fallback", () => {
  beforeEach(() => __clearCache());
  it("serves fresh within TTL, stale after an upstream failure, then errors past maxStale", async () => {
    let t = 0;
    const now = () => t;
    const opts = { ttlMs: 30, maxStaleMs: 100 };
    expect((await cached("k", opts, async () => 1, now)).value).toBe(1);
    t = 10;
    expect((await cached("k", opts, async () => 2, now)).value).toBe(1); // within TTL
    t = 50;
    const s = await cached("k", opts, async () => { throw new Error("down"); }, now);
    expect(s).toMatchObject({ value: 1, stale: true, error: "down" });
    t = 200;
    const e = await cached("k", opts, async () => { throw new Error("down"); }, now);
    expect(e.value).toBeNull();
    expect(e.error).toBe("down");
  });
});
