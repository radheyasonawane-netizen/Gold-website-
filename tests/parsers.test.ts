import { describe, expect, it, beforeEach } from "vitest";
import { cached, __clearCache } from "@/lib/server/cache";
import { parseQuote, pickGoldTen } from "@/lib/server/groww";

// Header and rows copied from Groww's instrument.csv (17 Nov 2026), plus one expired row.
const CSV = [
  "exchange,exchange_token,trading_symbol,groww_symbol,name,instrument_type,segment,series,isin,underlying_symbol,underlying_exchange_token,expiry_date,strike_price,lot_size,tick_size,freeze_quantity,is_reserved,buy_allowed,sell_allowed,internal_trading_symbol,is_intraday",
  "MCX,578629,GOLDTEN31DEC26FUT,MCX-GOLDTEN-31Dec26-FUT,,FUT,COMMODITY,,MCX_GOLDTEN31DEC26FUT,GOLDTEN,,2026-12-31,0,1,100.0,1000,,1,1,GOLDTEN31DEC26FUT,0",
  "MCX,574842,GOLDTEN30NOV26FUT,MCX-GOLDTEN-30Nov26-FUT,,FUT,COMMODITY,,MCX_GOLDTEN30NOV26FUT,GOLDTEN,,2026-11-30,0,1,100.0,1000,,1,1,GOLDTEN30NOV26FUT,0",
  "MCX,570001,GOLDTEN31OCT26FUT,MCX-GOLDTEN-31Oct26-FUT,,FUT,COMMODITY,,MCX_GOLDTEN31OCT26FUT,GOLDTEN,,2026-10-31,0,1,100.0,1000,,1,1,GOLDTEN31OCT26FUT,0",
  "MCX,575011,GOLDM04DEC26FUT,MCX-GOLDM-04Dec26-FUT,,FUT,COMMODITY,,MCX_GOLDM04DEC26FUT,GOLDM,,2026-12-04,0,10,100.0,1000,,1,1,GOLDM04DEC26FUT,0",
  "NSE,1,GOLDBEES,NSE-GOLDBEES,GOLDBEES,EQ,CASH,EQ,INF204KB17I5,,,,0,1,0.01,0,,1,1,GOLDBEES,1",
].join("\n");

describe("Gold Ten contract selection", () => {
  it("picks the nearest unexpired GOLDTEN future", () => {
    expect(pickGoldTen(CSV, "2026-11-17")).toEqual({ tradingSymbol: "GOLDTEN30NOV26FUT", expiry: "2026-11-30" });
  });
  it("still uses the contract on its expiry day, then rolls", () => {
    expect(pickGoldTen(CSV, "2026-11-30").tradingSymbol).toBe("GOLDTEN30NOV26FUT");
    expect(pickGoldTen(CSV, "2026-12-01").tradingSymbol).toBe("GOLDTEN31DEC26FUT");
  });
  it("ignores other gold contracts and fails when none is live", () => {
    expect(() => pickGoldTen(CSV, "2027-01-01")).toThrow(/No live MCX Gold Ten/);
  });
});

describe("Groww quote parsing", () => {
  // Shape from Groww's live-data/quote docs; numbers are test inputs, not market data.
  const ok = { status: "SUCCESS", payload: { last_price: 135335, day_change: 75, day_change_perc: 0.06, ohlc: { open: 135200, high: 135600, low: 135100, close: 135260 }, last_trade_time: 1794895504000, volume: 1234, open_interest: 5678 } };
  it("passes Groww's values through unchanged", () => {
    expect(parseQuote(ok)).toEqual({ lastPrice: 135335, dayChange: 75, dayChangePct: 0.06, open: 135200, high: 135600, low: 135100, close: 135260, lastTradeTime: 1794895504000, volume: 1234, openInterest: 5678 });
  });
  it("rejects failures and missing prices", () => {
    expect(() => parseQuote({ status: "FAILURE", error: { code: "403", message: "Access forbidden for this request." } })).toThrow(/Access forbidden/);
    expect(() => parseQuote({ status: "SUCCESS", payload: { day_change: 1 } })).toThrow(/no last price/);
  });
  it("tolerates missing optional fields", () => {
    const q = parseQuote({ status: "SUCCESS", payload: { last_price: 135000 } });
    expect(q.lastPrice).toBe(135000);
    expect(q.open).toBeNull();
    expect(q.dayChange).toBeNull();
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
