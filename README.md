# Kanchan · Gold Intelligence for India

A premium, honest gold-price reference for Indian buyers, built with Next.js 15, React 19, TypeScript,
Tailwind CSS v4, shadcn/ui (Radix) and Recharts.

* **Live spot parity**: gold-api.com XAU/XAG spot converted to ₹ per gram, per 10 g and per kg, refreshed every 30 s
* **Market overview cards** with freshness badges (Live / Delayed / Stale / Unavailable) and IST timestamps
* **Historical chart**: World Bank monthly gold × ECB USD/INR (keyless); daily ranges when `GOLD_API_KEY` is set
* **Price-breakdown calculator**: metal → customs duty → making charge → 3 % GST
* **Seller comparison**: sortable, filterable table (cards on mobile) for quotes you enter or a licensed feed
* **Simple / Advanced modes**, mobile sheet navigation and a floating section dock
* **Sources & methodology** panel with live connectivity status for every upstream

See **[DATA_SOURCES.md](./DATA_SOURCES.md)** for the reference-site investigation, licence findings and
why MCX, IBJA and scraped retailer prices are deliberately *not* shown.

## Run

```bash
npm install
npm run dev            # http://localhost:3000
# behind an HTTPS proxy (e.g. sandboxed CI): NODE_USE_ENV_PROXY=1 npm run dev
```

Optional server-side configuration lives in `.env.local` (see `.env.example`):

| Variable | Purpose |
|---|---|
| `GOLD_API_KEY` | gold-api.com key → daily/weekly history and 1M/3M/6M ranges (free tier: 10 req/h; cached 6 h) |
| `SELLER_FEED_URL`, `SELLER_FEED_TOKEN` | A seller price feed you are licensed to display (schema in `src/lib/server/sellerFeed.ts`) |
| `WORLD_BANK_MONTHLY_XLSX_URL` | Pin a specific Pink Sheet workbook instead of auto-discovering it |

## Architecture

```
src/lib/calc.ts, units.ts          pure pricing maths (unit-tested)
src/lib/server/                    server-only adapters
  http.ts       fetch with timeout + retry
  cache.ts      TTL cache, shared in-flight requests, last-good fallback ("stale")
  goldApi.ts    /price (keyless), /history (x-api-key)
  fx.ts         ECB USD/INR via Frankfurter v2
  worldBank.ts  Pink Sheet workbook discovery + xlsx parsing (fflate)
  sellerFeed.ts optional licensed feed (schema-validated)
  market.ts, history.ts, sources.ts   aggregation + source registry
src/app/api/{market,history,sellers,health}/route.ts
src/components/site/*              UI sections; src/components/ui/* shadcn/ui primitives
```

## Test

```bash
npm test                         # vitest: calculations, parsers, cache fallback, sort/filter
npm run build && npm start &     # then:
npm run e2e -- http://localhost:3000   # Playwright: APIs, chart, calculator, sellers, modes,
                                       # mobile layout, error/loading states, axe-core a11y
```

Prices are international spot converted to rupees. Indian retail, MCX and IBJA prices differ.
For information only, not investment advice.
