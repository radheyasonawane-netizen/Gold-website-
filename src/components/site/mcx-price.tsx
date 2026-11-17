"use client";
import { ArrowDownRight, ArrowUpRight, PlugZap, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FreshnessBadge } from "./freshness";
import { Sparkline } from "./sparkline";
import { useMcx, useNow } from "@/components/providers";
import { fmtIstDate, fmtIstDateTime } from "@/lib/format";

/** Prices exactly as Groww returns them: ₹ per 10 g, two decimals dropped only when zero. */
const rupees = (n: number | null) => (n === null ? "—" : "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 }));

/** No trade for 10+ minutes: show the last trade time instead of claiming the market is live. */
const QUIET_MS = 10 * 60_000;

export function McxPrice() {
  const { data, loading, error, refresh } = useMcx();
  const now = useNow(5000);
  const q = data?.quote;
  const c = data?.contract;
  const quiet = q?.lastTradeTime ? now - q.lastTradeTime > QUIET_MS : false;
  const up = (q?.dayChange ?? 0) >= 0;

  return (
    <section id="top" className="hero-wash relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-24 right-[-10%] size-[520px] rounded-full bg-gold/10 blur-3xl" />
      <div id="price" className="relative mx-auto max-w-5xl px-4 pt-12 pb-16 sm:px-6 lg:px-8 lg:pt-16 lg:pb-20">
        <p className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-gold/30 bg-white/70 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-gold-deep uppercase">
          <span className="size-1.5 rounded-full bg-gold" aria-hidden /> MCX · Gold Ten futures
        </p>
        <h1 className="font-display text-[40px] leading-[1.04] font-medium tracking-tight text-charcoal sm:text-6xl">
          Gold, at the <em className="text-gold-gradient font-semibold not-italic">exchange price.</em>
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground sm:text-base">
          The MCX Gold Ten futures price per 10 g, exactly as the exchange quotes it. No GST, no making charges, no added totals.
        </p>

        <div className="mt-8 rounded-[28px] border border-border bg-white/90 p-5 shadow-[0_30px_60px_-40px_rgba(53,40,48,.45)] backdrop-blur sm:p-7" aria-live="polite" aria-busy={loading}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">
              ₹ per 10 g · {c ? `${c.tradingSymbol}${c.expiry ? ` · expires ${fmtIstDate(c.expiry)}` : ""}` : "nearest contract"}
            </span>
            <FreshnessBadge status={data?.status} sourceUpdatedAt={q?.lastTradeTime ? new Date(q.lastTradeTime).toISOString() : null} fetchedAt={data?.fetchedAt} sourceName="Groww Trade API (MCX)" liveWindowMs={QUIET_MS} liveLabel="Live" />
          </div>

          {q ? (
            <>
              <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-1">
                <span className="font-display text-6xl leading-none font-semibold tracking-tight text-charcoal num sm:text-7xl" data-testid="mcx-ltp">
                  {rupees(q.lastPrice)}
                </span>
                {q.dayChange !== null ? (
                  <span className={`mb-1 inline-flex items-center gap-0.5 text-base font-semibold num ${up ? "text-up" : "text-down"}`} data-testid="mcx-change">
                    {up ? <ArrowUpRight className="size-5" /> : <ArrowDownRight className="size-5" />}
                    {up ? "+" : "−"}
                    {rupees(Math.abs(q.dayChange))}
                    {q.dayChangePct !== null ? ` (${up ? "+" : "−"}${Math.abs(q.dayChangePct).toFixed(2)}%)` : ""} <span className="font-normal text-muted-foreground">today</span>
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {q.lastTradeTime ? (quiet ? `No trades in the last 10 minutes · last trade ${fmtIstDateTime(q.lastTradeTime)}` : `Last trade ${fmtIstDateTime(q.lastTradeTime)}`) : "Last trade time not provided"}
              </p>
              <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" data-testid="mcx-details">
                {[
                  ["Open", rupees(q.open)],
                  ["High", rupees(q.high)],
                  ["Low", rupees(q.low)],
                  ["Close", rupees(q.close)],
                  ["Volume", q.volume === null ? "—" : q.volume.toLocaleString("en-IN")],
                  ["Open interest", q.openInterest === null ? "—" : q.openInterest.toLocaleString("en-IN")],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-2xl bg-soft-pink px-3 py-2.5">
                    <dt className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{k}</dt>
                    <dd className="mt-0.5 font-semibold num">{v}</dd>
                  </div>
                ))}
              </dl>
              {data!.ticks.length > 1 ? (
                <div className="mt-5">
                  <Sparkline values={data!.ticks.map((t) => t.p)} label="Gold Ten trades recorded today" className="h-14 w-full" />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {data!.ticks.length} trades recorded by this site since {fmtIstDateTime(data!.ticks[0].t)}
                  </p>
                </div>
              ) : null}
            </>
          ) : loading ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-16 w-80" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <div role="alert" className={`mt-4 rounded-2xl border p-4 text-sm ${data?.status === "unconfigured" ? "border-border bg-soft-pink text-charcoal" : "border-down/20 bg-down/5 text-down"}`} data-testid="mcx-unavailable">
              <div className="flex items-start gap-3">
                <PlugZap className="mt-0.5 size-5 shrink-0" />
                <div>
                  <p className="font-semibold">The MCX price isn’t available right now.</p>
                  <p className="mt-1">{data?.error ?? error ?? "Groww did not return a quote."}</p>
                  <p className="mt-1 text-muted-foreground">No estimated, old or substitute price is shown in its place.</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="mt-3" onClick={refresh}>
                <RefreshCw /> Try again
              </Button>
            </div>
          )}
        </div>
      </div>
      <div className="hairline-gold mx-auto h-px max-w-5xl opacity-60" aria-hidden />
    </section>
  );
}
