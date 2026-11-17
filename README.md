# Kanchan · MCX Gold Ten Price

A one-page site (Next.js 15, React 19, TypeScript, Tailwind CSS v4, shadcn/ui) that shows the **MCX Gold Ten futures price, ₹ per 10 g, exactly as the exchange quotes it**: last traded price, day change, open, high, low, close, volume, open interest and last-trade time. No GST, no margins, no added totals.

Data comes from the **Groww Trade API** live-data quote (`exchange=MCX`, `segment=COMMODITY`). The nearest unexpired `GOLDTEN…FUT` contract is picked from Groww's instrument list and rolls over automatically. The access token stays on the server.

## Run

```bash
npm install
cp .env.example .env.local      # set GROWW_ACCESS_TOKEN
npm run dev                     # http://localhost:3000
```

If Groww refuses the request (for example 403 without an active Trading API subscription), the page says so and shows **no** price: there is no fallback or estimated value.

## Test

```bash
npm test                                   # unit: contract selection, quote parsing, cache
npm run build && npm start &
npm run e2e -- http://localhost:3000       # Playwright + axe
```

For information only, not investment advice. Groww's API terms allow use for yourself and your family only.
