# DATA_SOURCES.md — Investigation & verified findings

> **Current site (17 Nov 2026, latest):** Kanchan shows **only the MCX Gold Ten futures price**
> (₹ per 10 g, exchange price, no GST) via the **Groww Trade API**. The coin comparison, calculator,
> GST totals and OroPocket rate have been removed at the owner's request.
>
> **Groww test results with the owner's access token (17 Nov 2026):**
> * `GET /v1/user/detail` → `SUCCESS` (token valid). The account's `active_segments` is `["CASH"]` only.
> * `GET /v1/live-data/quote` → **403 "Access forbidden for this request."** for MCX `GOLDTEN30NOV26FUT`
>   (segment `COMMODITY`) **and** for NSE `GOLDBEES` (segment `CASH`), with both plain and SDK headers.
>   So live market data isn't enabled for this account, most likely because no active Trading API
>   subscription exists. Groww's docs also say MCX is "not available at this time".
> * Groww's instrument list (`growwapi-assets.groww.in/instruments/instrument.csv`) **does** list
>   `MCX,GOLDTEN30NOV26FUT,…,FUT,COMMODITY,…,GOLDTEN,…,2026-11-30`, which the site uses to pick the contract.
> * Until Groww returns quotes, the page shows "The MCX price isn't available right now" with Groww's
>   reason, and no substitute price.
>
> **Groww Trade API docs review:** needs a paid Trading API subscription and the
> account holder's key (daily-approved access token or TOTP). Groww's REST docs state *"Commodities
> trading (MCX segment) is not available at this time"*, and the SDK changelog notes an
> "MCX-not-supported" doc update, so MCX gold quotes are not available through it. Its live data
> (`get_quote`, `get_ltp`, `get_ohlc`) and historical candles cover NSE/BSE cash and F&O only, with
> limits of 10 req/s and 300 req/min for live data. Groww's API terms restrict use to *"yourself or
> your family … and not for other users/investors"*, and its general terms prohibit republishing
> platform content. The only gold-linked instruments it could return are exchange-traded products
> (gold ETFs, SGBs), which are not a per-gram gold rate.

Investigation date: **17 Nov 2026** (all timestamps UTC unless stated). Only publicly observable
behaviour was examined: no credentials were extracted, no authentication was bypassed, and no
access restrictions were circumvented.

---

## 1. Reference website — `https://gold.brewclaw.com/`

### 1.1 What the page shows

The page is one HTML file with inline JS and no framework bundle. It has four panels:

| Panel | Content |
|---|---|
| MCX Gold card | "MCX Gold · live exchange price", ₹ per 10 g, day change vs previous close, intraday sparkline, contract name (e.g. `Gold Ten 30 Nov Fut`), "market closed" detection (no trade for more than 10 min) |
| Live scraper log | Timestamped ✓/✗ lines per site fetched (e.g. `PC Chandra · HTTP 429`) |
| 1-year history chart | ₹ per 10 g; solid line = MCX Gold futures daily; dashed line before the current contract = *Nippon India Gold BeES ETF (NSE) scaled by its typical ratio to MCX* (labelled "est.") |
| Seller table | 10 g of 24K from about 23 sellers plus a computed "Dhan Gold Vault" row, sorted by per-10 g (999) price |

### 1.2 Network requests (publicly observable)

| Request | Method | Notes |
|---|---|---|
| `/` | GET | HTML. `cache-control: public, max-age=0, must-revalidate`, served by Cloudflare. |
| **`/api/prices`** | GET | **The only data endpoint.** JSON, about 24 KB, `access-control-allow-origin: *`, `cache-control: public, max-age=15`. Polled by the page **every 30 s** (paused when the tab is hidden). |
| `fonts.googleapis.com` | GET | Inter, JetBrains Mono |

Other paths probed (`/api`, `/api/history`, `/api/sellers`, `/api/mcx`, `/robots.txt`, `/terms`,
`/privacy`, `/about`, `/sitemap.xml`) all returned the same HTML shell, an SPA-style fallback.
**There is no robots.txt, no terms of use, no licence and no API documentation.**

### 1.3 `/api/prices` response structure (observed)

```jsonc
{
  "mcx": { "ltp": 135581, "close": 135260, "contract": "Gold Ten 30 Nov Fut",
           "at": 1794891302874,        // ms, when their scraper read it
           "tradedAt": 1794891301000 }, // ms, last trade time
  "mcxTicks": [ { "t": 1794845161000, "p": 135307 }, ... ],   // 240 ticks, ~30 s apart (≈2 h window)
  "sellers": {
    "Augmont": { "name": "Augmont", "product": "10g digital gold (buy + GST)", "grams": 10,
                 "purity": 0.999, "price": 143035.585, "digital": true, "sell": 13419.03,
                 "url": "https://www.augmont.com/", "at": 1794891212000 },
    "Tanishq": { "name": "Tanishq", "product": "10g 24K Gold Coin", "grams": 10, "purity": 0.999,
                 "price": 148539, "url": "https://www.tanishq.co.in/product/…", "at": … },
    // … 23 sellers in total
  },
  "history": { "points": [ { "t": 1763351100000, "p": 125243, "est": true }, ... ],  // 78 points, 1–11 day gaps
               "mcxStart": 1778729400000 },
  "total": 23,
  "log": [ { "t": …, "site": "flipkart.com", "ok": true, "msg": "Joyalukkas · 10g … ₹1,45,131" }, ... ] // 80 lines
}
```

### 1.4 Update frequency (observed)

* MCX price: re-read about every **60 s**. Log entries show MCX reads one minute apart (`04:49:03`,
  `04:50:03`, …); `mcxTicks` are spaced 26–40 s apart.
* Sellers: each re-read roughly every **5–10 min**, staggered. Some were 1–3 h old. The page states that
  a failed read keeps the last good price for up to 3 h, then drops the seller.
* History: one point every 1–11 days (78 points per year).
* Client poll: 30 s. API edge cache: 15 s.

### 1.5 Values provided directly vs. calculated

| Value | Provided by `/api/prices` | Calculated in the browser |
|---|---|---|
| MCX LTP, previous close, contract, timestamps | ✅ | |
| Day change ₹ / % | | `ltp − close`, `/ close` |
| Seller final price, grams, purity, URL, timestamp | ✅ (scraped) | |
| Gold value at MCX | | `ltp / 10 × grams × (purity / 0.999)` |
| GST | | `price − price / 1.03` |
| Markup | | `price / 1.03 − goldValue` |
| Per 10 g (999) | | `price / grams × 10 × (0.999 / purity)` |
| "vs lowest" / rank | | sort by per-10 g |
| Dhan Gold Vault row (entirely computed) | | `ltp × 1.03 + fees`, where fees = `(ltp × (0.000021 + 0.000001 + 0.001) + 20 + 125) × 1.18 + ltp × 0.00002 + 300` |
| History "est." points before `mcxStart` | ✅ (pre-scaled server-side from the ETF) | |

### 1.6 Where the reference site's data comes from (its own disclosure)

> "MCX prices from Groww's public MCX quote pages … Seller prices are read live from each seller's own
> product page (or its Flipkart/Candere listing where the seller's own site blocks automated reads)."

### 1.7 Is it authorised for reuse? **No.**

| Layer | Finding | Verdict |
|---|---|---|
| `gold.brewclaw.com/api/prices` | No terms, licence or API docs. `CORS: *` is a technical setting, not a grant of rights. | ❌ Not authorised. Would need the operator's written permission. |
| Groww (MCX source) | Groww T&C: users shall not *"copy, reproduce, sell, redistribute, publish … enter into a database, display … any information, content, materials … available from or through the Platform"* without authorisation. | ❌ Prohibited |
| MCX | `www.mcxindia.com` returned **403 Access Denied** (Akamai) to automated requests, so its terms could not be read. MCX market data is distributed commercially through licensed data vendors. | ❌ Licence required (not verified first-hand) |
| Seller sites / Flipkart / Candere | Individual sites' terms not reviewed. The reference site's log shows **HTTP 429** rate-limit responses and notes that some sellers "block automated reads". | ❌ Treated as not authorised |

**Decision:** this project does **not** call `gold.brewclaw.com`, Groww, MCX or any retailer site for
data. It only links to retailer homepages.

---

## 2. Alternative providers evaluated

| Provider | Endpoint(s) verified | Auth | Licence / terms (quoted) | Used? |
|---|---|---|---|---|
| **gold-api.com** | `GET https://api.gold-api.com/price/XAU`, `/price/XAU/INR`, `/price/XAG`, `/symbols` | None | ToS §9: *"Commercial use of the API is always permitted, including use in web applications…"*. Docs: *"No Rate Limiting for real time prices"*, *"Cache `/price` responses for 30 seconds"*, *"Never put an API key in frontend code; call `/history` and `/ohlc` from a server."* | ✅ **Live spot** |
| gold-api.com `/history`, `/ohlc` | `GET /history?symbol=XAU&startTimestamp=&endTimestamp=&groupBy=day\|week\|month&aggregation=avg&orderBy=asc` with header `x-api-key`. Unauthenticated call returns `{"error":"No x-api-key header."}` | API key | Free tier: *"10 API requests/hour to the price history API OR the OHLC Endpoint"*; Premium $10/mo | ⚙️ Implemented server-side, **enabled only if `GOLD_API_KEY` is set** (no key was provided) |
| **Frankfurter** (ECB reference rates) | `GET https://api.frankfurter.dev/v2/providers/ecb/rates?base=USD&quotes=INR&from=YYYY-MM-DD[&group=month]` returns `[{date, base, quote, rate}]` | None | Open, keyless; v1 deprecated but available. ECB euro reference rates, published once per TARGET working day. | ✅ **USD/INR** |
| **World Bank Pink Sheet** | Workbook link discovered on `https://www.worldbank.org/en/research/commodity-markets` → `CMO-Historical-Data-Monthly.xlsx` (sheet "Monthly Prices", column "Gold", rows `YYYYMmm`, "Updated on November 03, 2026") | None | World Bank open data, attribution required. The site's general T&C page (redirect target of "Terms of use for Datasets") says content is *"for informational and non-commercial purposes only, unless otherwise stated"*; the Data Catalog licence for this dataset could not be fetched from this environment. **Confirm the licence before commercial redistribution.** | ✅ **Monthly history** (keyless) |
| ExchangeRate-API open endpoint | `GET https://open.er-api.com/v6/latest/USD` | None | *"requires attribution … You are, however, not allowed to re-distribute it."* Updates once per day. | ❌ Not used (ECB is better documented) |
| **IBJA** (ibjarates.com) | Publishes daily AM/PM rates for 999/995/916/750/585 (₹ per 10 g, *"without 3% GST and Making Charges"*) | n/a | Disclaimer: *"If You wish to use copyrighted material … beyond fair use, You must obtain permission"*. Official API at **indiagoldratesapi.com**: *"Is IBJA rates API free? No, It is a paid subscription."* | ❌ Licence needed. Recommended paid upgrade. |
| Yahoo Finance | — | — | Unofficial and not licensed for redistribution | ❌ Not used |
| **OroPocket** (added at the user's request) | `GET https://api.oropocket.com/public/prices` (also `/public/prices/gold`) | None | Keyless, `access-control-allow-origin: *`, `ratelimit-policy: 10;w=60`. **Not listed in OroPocket's developer docs, and no explicit reuse licence was found.** ToS (summary page) prohibits "Reverse engineering" and says nothing about price data. The documented route is `GET /partner/prices` and `/partner/prices/history` with a free sandbox key (`Authorization: Bearer oro_test_…`; "Sandbox returns real prices"; sandbox capped at 1000 requests/day). | ✅ **Live retail rate**, attributed. Switch to `/partner/prices` (key) for a documented contract. |

### 2.1 Observed response structures (used by the adapters)

```jsonc
// GET https://api.gold-api.com/price/XAU/INR   (cache-control: public, max-age≈6–7)
{ "currency":"INR","currencySymbol":"₹","exchangeRate":93.9616,"name":"Gold",
  "price":363993.1533682368,"symbol":"XAU","updatedAt":"2026-11-17T04:55:28Z","updatedAtReadable":"a few seconds ago" }

// GET https://api.frankfurter.dev/v2/providers/ecb/rates?base=USD&quotes=INR&from=2026-11-10
[{"date":"2026-11-10","base":"USD","quote":"INR","rate":93.93}, … {"date":"2026-11-16","base":"USD","quote":"INR","rate":93.93}]
```

```jsonc
// GET https://api.oropocket.com/public/prices   (observed 2026-11-17)
{ "statusCode": 200, "message": "Asset prices retrieved successfully",
  "data": { "gold":   { "buy": 14032.27, "sell": 13559.46, "gst": 420.97, "currency": "INR", "unit": "gram",
                        "change24h": { "buy": 0.13, "sell": -0.16 } },
            "silver": { "buy": 178.52, "sell": 168.77, "gst": 5.36, "currency": "INR", "unit": "gram",
                        "change24h": { "buy": 0.88, "sell": 0.56 } },
            "timestamp": "2026-11-17T05:50:00.166Z" } }
```

OroPocket fields, verified against its partner docs and the numbers above:
* `buy` is the **GST-exclusive** buy rate per gram. `gst` = 3.000 % of `buy` (420.97 / 14032.27). What a customer pays = `buy + gst` = ₹14,453.24/g.
* `sell` is the sell-back rate (no GST on sells). The spread was 3.37 %.
* `change24h` values are percentages (a 0.13 ₹ move on ₹14,032 would be implausible).
* Product: 24K 99.9 % digital gold sourced from Augmont, vaulted with Sequel (OroPocket FAQ).
* `timestamp` moved 05:50:00 → 05:55:00 UTC between polls, so it updates about every 5 min. The partner docs say "roughly every 30 minutes" and that the timestamp is the fetch time, not the moment the price moved.
* Unit is always per gram, never per 10 g.

### 2.2 Data quality cross-check (17 Nov 2026, ~05:10 UTC)

* gold-api INR quote vs. (USD spot × ECB USD/INR): **0.034 % difference**.
* OroPocket's buy rate (ex-GST) was **19.7 % above spot parity** for the same 999 gold, consistent with MCX and IBJA sitting well above parity.
* Spot parity: **₹1,17,0xx per 10 g (999)**. Reference site's MCX at the same time: ₹1,35,581. IBJA 999 on 16/11: ₹1,34,380.
  The domestic market traded about **15 % above** international parity. Customs duty at the
  assumed 6 % explains only part of this. **The rest (local premium/discount, or a duty
  change after July 2024) cannot be confirmed from licensed data, so the UI never presents
  parity × duty as "the Indian price".**

---

## 3. What this project serves

| UI element | Source | Freshness / caching | Calculated? |
|---|---|---|---|
| Spot XAU/USD, XAU/INR, XAG/USD | gold-api.com `/price` | Server cache 30 s; last good value kept 3 h (marked **Stale**) | No |
| USD/INR | ECB via Frankfurter | Cache 1 h; daily fixing | No |
| 24K/22K ₹ per 10 g & per g, silver ₹/kg | Derived | Same as spot | ✅ `INR/oz ÷ 31.1034768 × grams × fineness` |
| FX cross-check | Derived | — | ✅ |
| Intraday sparkline | Spot quotes recorded by this server | In-memory, resets on restart; labelled as such | No |
| Historical chart (1Y–MAX) | World Bank monthly × ECB monthly USD/INR; or gold-api `/history` (daily/weekly) when `GOLD_API_KEY` is set | 24 h / 6 h cache | ✅ `₹/10 g = USD/oz × USD/INR ÷ 31.1034768 × 9.99` |
| 1M/3M/6M ranges | Only with `GOLD_API_KEY`; otherwise disabled with an explanation | — | — |
| Calculator | Live parity or a user-entered rate | — | ✅ duty → making → 3 % GST |
| Customs duty 6 % | **Assumption** (5 % BCD + 1 % AIDC, Union Budget July 2024). Editable. | — | — |
| OroPocket card, hero "retail check", seller row, calculator base rate | OroPocket `/public/prices` | Cache 2 min; last good value kept 3 h | ✅ you-pay = buy + gst; premium = buy ÷ (parity fine × 0.999) − 1 |
| Seller comparison | User-entered quotes (browser localStorage), or a **licensed** feed via `SELLER_FEED_URL` | Feed cache 5 min | ✅ GST, markup, per-10 g (999) |
| "Try examples" rows | Generated from today's parity with made-up premiums | — | Always badged **Illustrative**, generic names |

Credentials (`GOLD_API_KEY`, `SELLER_FEED_TOKEN`) are read only in server code (`src/lib/server/*`, all
`import "server-only"`) and are never sent to the browser.

## 4. Recommended upgrades (require agreements or keys)

1. **gold-api.com key** (free) → daily history and 1M/3M/6M ranges. Set `GOLD_API_KEY`.
2. **IBJA Rates API** (paid) → official Indian benchmark 999/995/916 AM/PM rates.
3. **MCX data** through a licensed vendor → live MCX futures.
4. **Seller feeds** through partner/B2B agreements (e.g. bullion platforms) → expose as `SELLER_FEED_URL` in the documented schema.
