"use client";
import { ArrowDownRight, ArrowUpRight, ExternalLink, Store } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FreshnessBadge } from "./freshness";
import { useMarket, useSettings } from "@/components/providers";
import { fmtInr, fmtIstDateTime, fmtPct } from "@/lib/format";

function Change({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-muted-foreground">—</span>;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold ${up ? "text-up" : "text-down"}`}>
      {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
      {up ? "+" : ""}
      {pct.toFixed(2)}%
    </span>
  );
}

/** A real Indian retail price: OroPocket's published 24K digital-gold rate. */
export function OroPocketCard() {
  const { data, loading } = useMarket();
  const { mode } = useSettings();
  const o = data?.oroPocket;
  const s = data?.sources.find((x) => x.id === "oropocket");
  const prem = data?.derived?.oroPremiumOverParity ?? null;

  return (
    <Card className="relative overflow-hidden border-gold/30 p-5 sm:col-span-2 lg:col-span-3" data-testid="oropocket-card">
      <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-pink via-gold to-pink" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-pink/70 text-gold-deep">
            <Store className="size-5" />
          </span>
          <div>
            <h3 className="font-display text-xl">Indian retail rate · OroPocket</h3>
            <p className="text-xs text-muted-foreground">24K 99.9% digital gold (Augmont-sourced) · ₹ per gram · published by the seller</p>
          </div>
        </div>
        <FreshnessBadge status={s?.status} sourceUpdatedAt={s?.sourceUpdatedAt} fetchedAt={s?.fetchedAt} sourceName="OroPocket public prices" liveWindowMs={35 * 60_000} liveLabel="Current" />
      </div>

      {o ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">You pay (incl. 3% GST)</div>
            <div className="mt-1 font-display text-[32px] leading-none font-semibold num" data-testid="oro-final">
              {fmtInr(o.gold.finalBuy, true)}
            </div>
            <div className="mt-1.5 text-xs text-muted-foreground num">{fmtInr(o.gold.finalBuy * 10)} per 10 g</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">Buy rate (excl. GST)</div>
            <div className="mt-1 font-display text-2xl font-semibold num">{fmtInr(o.gold.buy, true)}</div>
            <div className="mt-1.5 text-xs num">
              <Change pct={o.gold.change24hBuyPct} /> <span className="text-muted-foreground">24 h</span>
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">Sell-back rate</div>
            <div className="mt-1 font-display text-2xl font-semibold num">{fmtInr(o.gold.sell, true)}</div>
            <div className="mt-1.5 text-xs num">
              <Change pct={o.gold.change24hSellPct} /> <span className="text-muted-foreground">24 h · spread {fmtPct(1 - o.gold.sell / o.gold.buy, 2, false)}</span>
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">Premium over spot parity</div>
            <div className="mt-1 font-display text-2xl font-semibold num" data-testid="oro-premium">
              {prem !== null ? fmtPct(prem, 1) : "—"}
            </div>
            <div className="mt-1.5 text-xs text-muted-foreground">Buy rate vs the same 999 gold at international spot. Covers duty, local premium and margin.</div>
          </div>
        </div>
      ) : loading ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : (
        <p role="alert" className="mt-4 text-sm text-down">
          OroPocket’s price API didn’t respond{s?.error ? ` (${s.error})` : ""}. No price is shown rather than an old or estimated one.
        </p>
      )}

      {o && mode === "advanced" && o.silver ? (
        <p className="mt-4 text-xs text-muted-foreground num">
          Silver: buy {fmtInr(o.silver.buy, true)}/g excl. GST · you pay {fmtInr(o.silver.finalBuy, true)}/g ({fmtInr(o.silver.finalBuy * 1000)}/kg) · sell {fmtInr(o.silver.sell, true)}/g
        </p>
      ) : null}
      <p className="mt-4 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        {o ? <span>Rate time {fmtIstDateTime(o.timestamp)} · updates every few minutes.</span> : null}
        <a href="https://api.oropocket.com/public/prices" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-gold-deep underline underline-offset-2">
          Raw API <ExternalLink className="size-3" />
        </a>
      </p>
    </Card>
  );
}
