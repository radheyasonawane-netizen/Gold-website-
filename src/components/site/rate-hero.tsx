"use client";
import { ArrowDownRight, ArrowRight, ArrowUpRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FreshnessBadge } from "./freshness";
import { Sparkline } from "./sparkline";
import { useRate } from "@/components/providers";
import { rateForPurity } from "@/lib/calc";
import { fmtInr, fmtIstDateTime } from "@/lib/format";
import { PURITIES } from "@/lib/units";

function Change({ pct, label }: { pct: number | null; label: string }) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-sm font-semibold num ${up ? "text-up" : "text-down"}`}>
      {up ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
      {up ? "+" : ""}
      {pct.toFixed(2)}% <span className="font-normal text-muted-foreground">{label}</span>
    </span>
  );
}

export function RateHero() {
  const { data, loading, error, refresh } = useRate();
  const q = data?.quote;
  const g = q?.gold;

  return (
    <section id="top" className="hero-wash relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-24 right-[-10%] size-[520px] rounded-full bg-gold/10 blur-3xl" />
      <div id="rate" className="relative mx-auto grid max-w-6xl gap-8 px-4 pt-10 pb-16 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12 lg:px-8 lg:pt-14 lg:pb-20">
        <div className="flex flex-col justify-center">
          <p className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-gold/30 bg-white/70 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-gold-deep uppercase">
            <span className="size-1.5 rounded-full bg-gold" aria-hidden /> India · 24K gold rate today
          </p>
          <h1 className="font-display text-[40px] leading-[1.04] font-medium tracking-tight text-charcoal sm:text-6xl">
            Today’s gold rate, <em className="text-gold-gradient font-semibold not-italic">GST included.</em>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            The price you actually pay for 24K gold in India, and how ten jewellery brands’ 10 g coins compare with it.
          </p>

          <div className="mt-7 rounded-[28px] border border-border bg-white/90 p-5 shadow-[0_30px_60px_-40px_rgba(53,40,48,.45)] backdrop-blur sm:p-6" aria-live="polite" aria-busy={loading}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">24K · 99.9% · per 10 g · incl. 3% GST</span>
              <FreshnessBadge status={data?.status} sourceUpdatedAt={q?.timestamp} fetchedAt={data?.fetchedAt} sourceName="OroPocket published rate" liveWindowMs={35 * 60_000} liveLabel="Current" />
            </div>

            {g ? (
              <>
                <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-1">
                  <span className="font-display text-5xl leading-none font-semibold tracking-tight text-charcoal num sm:text-6xl" data-testid="rate-10g">
                    {fmtInr(g.finalBuy * 10)}
                  </span>
                  <Change pct={g.change24hBuyPct} label="24 h" />
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Per gram", fmtInr(g.finalBuy, true), "rate-1g"],
                    ["Rate excl. GST", fmtInr(g.buy, true), "rate-exgst"],
                    ["GST (3%)", fmtInr(g.gst, true), "rate-gst"],
                    ["Sell-back", fmtInr(g.sell, true), "rate-sell"],
                  ].map(([k, v, id]) => (
                    <div key={k} className="rounded-2xl bg-soft-pink px-3 py-2.5">
                      <dt className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{k}</dt>
                      <dd className="mt-0.5 font-semibold num" data-testid={id}>
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>
                {data!.ticks.length > 1 ? (
                  <div className="mt-4">
                    <Sparkline values={data!.ticks.map((t) => t.finalBuy)} label="24K rate recorded today" className="h-12 w-full" />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {data!.ticks.length} rates recorded by this site since {fmtIstDateTime(data!.ticks[0].t)}
                    </p>
                  </div>
                ) : null}
                <p className="mt-3 text-xs text-muted-foreground">
                  Rate by <b className="font-semibold text-charcoal">OroPocket</b> (24K 99.9% gold) · updated {fmtIstDateTime(q!.timestamp)} · sell-back is what you’d receive per gram when selling.
                </p>
              </>
            ) : loading ? (
              <div className="mt-3 space-y-3">
                <Skeleton className="h-14 w-72" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : (
              <div role="alert" className="mt-3 rounded-2xl border border-down/20 bg-down/5 p-4 text-sm text-down">
                Today’s rate is unavailable{error ? ` (${error})` : ""}. No old or estimated price is shown in its place.
                <Button variant="outline" size="sm" className="ml-3" onClick={refresh}>
                  <RefreshCw /> Retry
                </Button>
              </div>
            )}
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button variant="gold" size="lg" asChild>
              <a href="#coins">
                Compare 10 g coins <ArrowRight />
              </a>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <a href="#calculator">Price any weight</a>
            </Button>
          </div>
        </div>

        <PurityCard />
      </div>
      <div className="hairline-gold mx-auto h-px max-w-6xl opacity-60" aria-hidden />
    </section>
  );
}

function PurityCard() {
  const { data } = useRate();
  const q = data?.quote;
  const rows = PURITIES.filter((p) => ["999", "916", "750"].includes(p.code));
  return (
    <Card className="relative self-center overflow-hidden border-gold/25 bg-white/90 p-0 backdrop-blur">
      <div aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-pink via-gold to-pink" />
      <div className="p-6 sm:p-7">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl tracking-tight">Rate by purity</h2>
          <span className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">incl. GST</span>
        </div>
        <table className="mt-4 w-full text-sm" data-testid="purity-table">
          <thead>
            <tr className="border-b border-border text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
              <th className="py-2 text-left font-semibold">Purity</th>
              <th className="py-2 text-right font-semibold">1 g</th>
              <th className="py-2 text-right font-semibold">10 g</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((p) => {
              const v = q ? rateForPurity(q.gold.finalBuy, p.fineness) : null;
              return (
                <tr key={p.code}>
                  <td className="py-3.5">
                    <span className="font-semibold">{p.karat}</span> <span className="text-muted-foreground">· {p.code}</span>
                  </td>
                  <td className="py-3.5 text-right num">{v ? fmtInr(v) : <Skeleton className="ml-auto h-5 w-20" />}</td>
                  <td className="py-3.5 text-right font-display text-xl font-semibold num">{v ? fmtInr(v * 10) : <Skeleton className="ml-auto h-6 w-28" />}</td>
                </tr>
              );
            })}
            <tr>
              <td className="py-3.5">
                <span className="font-semibold">Silver</span> <span className="text-muted-foreground">· 999</span>
              </td>
              <td className="py-3.5 text-right num">{q?.silver ? fmtInr(q.silver.finalBuy, true) : "—"}</td>
              <td className="py-3.5 text-right num">
                <span className="font-display text-xl font-semibold">{q?.silver ? fmtInr(q.silver.finalBuy * 1000) : "—"}</span>
                <span className="text-xs text-muted-foreground"> /kg</span>
              </td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          24K and silver are OroPocket’s published rates. 22K and 18K are worked out from the 24K rate by gold content, before making charges. A jeweller’s 22K board rate can differ.
        </p>
      </div>
    </Card>
  );
}
