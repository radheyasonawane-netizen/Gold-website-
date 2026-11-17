"use client";
import * as React from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Info, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FreshnessBadge } from "./freshness";
import { useMarket, useSettings } from "@/components/providers";
import { fmtInr, fmtIstDateTime, fmtPct, fmtUsd } from "@/lib/format";
import { PURITIES } from "@/lib/units";

export function Hero() {
  const { data, loading, error, refresh } = useMarket();
  const { dutyRate } = useSettings();
  const d = data?.derived;
  const goldStatus = data?.sources.find((s) => s.id === "gold-api");
  const ticks = data?.ticks ?? [];
  const tickChange = ticks.length > 1 && ticks[0].inrPerOz && ticks.at(-1)!.inrPerOz ? ticks.at(-1)!.inrPerOz! / ticks[0].inrPerOz! - 1 : null;

  return (
    <section id="top" className="hero-wash relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-24 right-[-10%] size-[520px] rounded-full bg-gold/10 blur-3xl" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pt-10 pb-16 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14 lg:px-8 lg:pt-16 lg:pb-24">
        <div className="flex flex-col justify-center">
          <p className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-gold/30 bg-white/70 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-gold-deep uppercase">
            <span className="size-1.5 rounded-full bg-gold" aria-hidden /> India · 24K · 999 reference
          </p>
          <h1 className="font-display text-[40px] leading-[1.02] font-medium tracking-tight text-charcoal sm:text-6xl lg:text-[68px]">
            Know what gold is <em className="text-gold-gradient font-semibold not-italic">really</em> worth before you pay for it.
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            Live international spot converted to rupees, transparent history, a duty-and-GST price breakdown, and a fair way to compare what jewellers charge — with every number traced to its source.
          </p>

          <div className="mt-8 rounded-[28px] border border-border bg-white/85 p-5 shadow-[0_30px_60px_-40px_rgba(53,40,48,.45)] backdrop-blur sm:p-6" aria-live="polite" aria-busy={loading}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">International spot parity · ₹ per 10 g · 999</span>
              <FreshnessBadge status={goldStatus?.status} sourceUpdatedAt={goldStatus?.sourceUpdatedAt} fetchedAt={goldStatus?.fetchedAt} sourceName="gold-api.com spot" />
            </div>
            {d ? (
              <>
                <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-1">
                  <span className="font-display text-5xl leading-none font-semibold tracking-tight text-charcoal num sm:text-6xl" data-testid="hero-price">
                    {fmtInr(d.per10g24k999)}
                  </span>
                  {tickChange !== null ? (
                    <span className={`mb-1 inline-flex items-center gap-0.5 text-sm font-semibold num ${tickChange >= 0 ? "text-up" : "text-down"}`}>
                      {tickChange >= 0 ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                      {fmtPct(tickChange, 2)} <span className="font-normal text-muted-foreground">since {fmtIstDateTime(ticks[0].t).split(",")[1]}</span>
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 flex items-start gap-2 text-[13px] leading-relaxed text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-gold-deep" aria-hidden />
                  <span>
                    Spot {fmtUsd(data!.goldUsd?.pricePerOz ?? NaN)}/oz × ₹{(data!.goldInr?.exchangeRate ?? data!.fx?.rate ?? 0).toFixed(2)}/$. Excludes customs duty (assumed {(dutyRate * 100).toFixed(1)}%), 3% GST and local premium — Indian shop and MCX prices are higher.{" "}
                    <a href="#methodology" className="font-medium text-gold-deep underline underline-offset-2">How we calculate</a>
                  </span>
                </p>
              </>
            ) : loading ? (
              <div className="mt-3 space-y-3">
                <Skeleton className="h-14 w-72" />
                <Skeleton className="h-4 w-full max-w-md" />
              </div>
            ) : (
              <div role="alert" className="mt-3 rounded-2xl border border-down/20 bg-down/5 p-4 text-sm text-down">
                {error ?? "Live prices are unavailable."} We never substitute sample numbers.
                <Button variant="outline" size="sm" className="ml-3" onClick={refresh}>
                  <RefreshCw /> Retry
                </Button>
              </div>
            )}
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button variant="gold" size="lg" asChild>
              <a href="#sellers">
                Compare seller prices <ArrowRight />
              </a>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <a href="#calculator">Price breakdown</a>
            </Button>
          </div>
        </div>

        <ReferenceCard />
      </div>
      <div className="hairline-gold mx-auto h-px max-w-7xl opacity-60" aria-hidden />
    </section>
  );
}

function ReferenceCard() {
  const { data } = useMarket();
  const { dutyRate } = useSettings();
  const d = data?.derived;
  const rows = PURITIES.filter((p) => ["999", "916", "750"].includes(p.code));
  return (
    <Card className="relative self-center overflow-hidden border-gold/25 bg-white/90 p-0 backdrop-blur">
      <div aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-pink via-gold to-pink" />
      <div className="p-6 sm:p-7">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl tracking-tight">Today’s reference</h2>
          <span className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">per gram</span>
        </div>
        <Tabs defaultValue="parity" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="parity">Spot parity</TabsTrigger>
            <TabsTrigger value="landed">+ Duty + GST</TabsTrigger>
          </TabsList>
          {(["parity", "landed"] as const).map((tab) => (
            <TabsContent key={tab} value={tab}>
              <ul className="divide-y divide-border">
                {rows.map((p) => {
                  const v = d ? d.finePerGram * p.fineness * (tab === "landed" ? (1 + dutyRate) * 1.03 : 1) : null;
                  return (
                    <li key={p.code} className="flex items-center justify-between py-3.5">
                      <span>
                        <span className="font-semibold">{p.karat}</span> <span className="text-sm text-muted-foreground">· {p.code}</span>
                      </span>
                      <span className="font-display text-2xl font-semibold num">{v ? fmtInr(v) : <Skeleton className="h-7 w-28" />}</span>
                    </li>
                  );
                })}
                <li className="flex items-center justify-between py-3.5">
                  <span>
                    <span className="font-semibold">Silver</span> <span className="text-sm text-muted-foreground">· 999 · per kg</span>
                  </span>
                  <span className="font-display text-2xl font-semibold num">{d?.silverPerKg999 ? fmtInr(d.silverPerKg999 * (tab === "landed" ? (1 + dutyRate) * 1.03 : 1)) : "—"}</span>
                </li>
              </ul>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {tab === "parity"
                  ? "Pure conversion of the international spot price. No Indian taxes or premium."
                  : `Estimate: parity × (1 + ${(dutyRate * 100).toFixed(1)}% assumed customs duty) × 1.03 GST. Excludes making charges and dealer premium/discount. Silver uses the same duty assumption — verify the current rate.`}
              </p>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </Card>
  );
}
