# Kanchan · Today’s Gold Rate in India

A one-page site, built with Next.js 15, React 19, TypeScript, Tailwind CSS v4 and shadcn/ui (Radix), that shows:

* **Today’s 24K gold rate including 3% GST** (per gram and per 10 g), the rate excluding GST, the GST amount and the sell-back rate, refreshed from OroPocket every few minutes with a freshness badge and IST timestamps
* **Rate by purity** (24K / 22K / 18K, plus silver per kg), all including GST
* **10 g gold coin comparison** across ten Indian brands: Tanishq, Kalyan, Malabar, Joyalukkas, MMTC-PAMP, CaratLane, Senco, PN Gadgil, BlueStone and Augmont. You enter each brand’s price; the page normalises purity, ranks the coins and shows each one’s premium over today’s rate. Sortable table on desktop, cards on mobile.
* **Calculator** for any weight and purity, with making charge and 3% GST
* **Sources & formulas**

Only Indian rupee rates are used, and no international prices or currency conversion. See [DATA_SOURCES.md](./DATA_SOURCES.md).

## Run

```bash
npm install
npm run dev                         # http://localhost:3000
# behind an HTTPS proxy: NODE_USE_ENV_PROXY=1 npm run dev
```

## Structure

```
src/lib/server/oroPocket.ts   OroPocket adapter (validated, 2-min cache, last-good fallback ≤ 3 h)
src/lib/server/market.ts      /api/rate payload + rates recorded by this server
src/app/api/rate/route.ts     the only API route
src/lib/calc.ts               GST, purity scaling, calculator, coin comparison maths
src/lib/coins.ts              the ten brands, ordering
src/components/site/*         rate hero, coin comparison, calculator, sources
```

## Test

```bash
npm test                                             # unit tests
npm run build && npm start &
NODE_USE_ENV_PROXY=1 npm run e2e -- http://localhost:3000   # Playwright + axe
```

For information only, not investment advice.
