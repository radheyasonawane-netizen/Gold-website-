"use client";
import { Building2, Landmark, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FreshnessBadge } from "./freshness";
import { Sparkline } from "./sparkline";
import { SectionHeading } from "./section-heading";
import { OroPocketCard } from "./oropocket-card";
import { useMarket, useSettings } from "@/components/providers";
import { fmtInr, fmtIstDate, fmtIstDateTime, fmtNum, fmtPct, fmtUsd } from "@/lib/format";

interface Metric {
  key: string;
  label: string;
  value: string | null;
  sub: string;
  source: "gold-api" | "ecb-frankfurter";
  spark?: number[];
  advanced?: boolean;
  emphasis?: boolean;
}

export function MarketOverview() {
  const { data, loading } = useMarket();
  const { mode } = useSettings();
  const d = data?.derived;
  const src = (id: string) => data?.sources.find((s) => s.id === id);
  const usdTicks = data?.ticks.map((t) => t.usdPerOz) ?? [];
  const inrTicks = data?.ticks.filter((t) => t.inrPerOz).map((t) => (t.inrPerOz! / 31.1034768) * 10 * 0.999) ?? [];

  const metrics: Metric[] = [
    { key: "24k", label: "24K · 999 · per 10 g", value: d ? fmtInr(d.per10g24k999) : null, sub: "Spot parity, ex-duty & GST", source: "gold-api", spark: inrTicks, emphasis: true },
    { key: "22k", label: "22K · 916 · per 10 g", value: d ? fmtInr(d.per10g22k916) : null, sub: "Jewellery-grade parity", source: "gold-api" },
    { key: "xau", label: "Gold spot · XAU/USD", value: data?.goldUsd ? fmtUsd(data.goldUsd.pricePerOz) : null, sub: "per troy ounce (31.1035 g)", source: "gold-api", spark: usdTicks },
    { key: "fx", label: "USD / INR · ECB", value: data?.fx ? `₹${fmtNum(data.fx.rate, 2)}` : null, sub: data?.fx ? `Reference rate of ${fmtIstDate(data.fx.date)}` : "ECB reference", source: "ecb-frankfurter" },
    { key: "1g", label: "24K · 999 · per gram", value: d ? fmtInr(d.per1g24k999, true) : null, sub: "Spot parity", source: "gold-api" },
    { key: "ag", label: "Silver · 999 · per kg", value: d?.silverPerKg999 ? fmtInr(d.silverPerKg999) : null, sub: data?.silverUsd ? `XAG ${fmtUsd(data.silverUsd.pricePerOz)}/oz` : "XAG spot parity", source: "gold-api" },
    { key: "inroz", label: "Gold · INR per troy oz", value: data?.goldInr ? fmtInr(data.goldInr.pricePerOz) : null, sub: data?.goldInr ? `gold-api FX ₹${fmtNum(data.goldInr.exchangeRate, 4)}/$` : "", source: "gold-api", advanced: true },
    {
      key: "xcheck",
      label: "FX cross-check",
      value: d?.fxCrossCheckDiff != null ? fmtPct(d.fxCrossCheckDiff, 3) : null,
      sub: "gold-api INR quote vs USD spot × ECB",
      source: "ecb-frankfurter",
      advanced: true,
    },
    { key: "fine", label: "Fine gold · per gram", value: d ? fmtInr(d.finePerGram, true) : null, sub: d?.basis === "gold-api-inr" ? "Basis: gold-api INR quote" : "Basis: USD spot × ECB", source: "gold-api", advanced: true },
  ];
  const visible = metrics.filter((m) => mode === "advanced" || !m.advanced);

  return (
    <section id="overview" aria-labelledby="overview-h" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
      <SectionHeading id="overview-h" eyebrow="Market overview" title="The numbers behind every gram">
        Spot prices refresh every 30 seconds from gold-api.com, and the rupee reference rate is the European Central Bank’s daily fixing. OroPocket’s published rate shows what an Indian buyer actually pays. Exchange and association rates need a licence, as the last card explains.
      </SectionHeading>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((m) => {
          const s = src(m.source);
          return (
            <Card key={m.key} className={`group relative overflow-hidden p-5 transition hover:-translate-y-0.5 hover:border-gold/40 ${m.emphasis ? "bg-gradient-to-br from-white via-white to-pink/50" : ""}`}>
              {m.emphasis ? <div aria-hidden className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-gold-light via-gold to-gold-deep" /> : null}
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">{m.label}</h3>
                <FreshnessBadge
                  status={s?.status}
                  sourceUpdatedAt={s?.sourceUpdatedAt}
                  fetchedAt={s?.fetchedAt}
                  sourceName={m.source === "gold-api" ? "gold-api.com" : "ECB via Frankfurter"}
                  liveWindowMs={m.source === "ecb-frankfurter" ? 4 * 86400_000 : undefined}
                />
              </div>
              <div className="mt-3 font-display text-[32px] leading-none font-semibold tracking-tight num" data-testid={`metric-${m.key}`}>
                {m.value ?? (loading ? <Skeleton className="h-8 w-40" /> : <span className="text-muted-foreground">—</span>)}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{m.sub}</p>
              {m.spark ? <Sparkline values={m.spark} label={m.label} className="mt-4 h-12 w-full" /> : null}
            </Card>
          );
        })}

        <OroPocketCard />

        <Card className="relative overflow-hidden border-dashed border-gold/40 bg-soft-pink/60 p-5 sm:col-span-2 lg:col-span-3">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-gold-deep shadow-sm">
                <Lock className="size-5" />
              </span>
              <div>
                <h3 className="font-display text-xl">MCX futures & IBJA benchmark rates</h3>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  These are the prices Indian traders quote, but their data is licensed. Groww’s terms forbid republishing its MCX pages, and IBJA sells its rates as a paid API. We show a clearly labelled international parity instead of copying them. Add a licensed feed to display them here.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Badge variant="soft">
                <Building2 /> MCX · licence required
              </Badge>
              <Badge variant="soft">
                <Landmark /> IBJA · paid API
              </Badge>
            </div>
          </div>
        </Card>
      </div>
      {data?.ticksSince && mode === "advanced" ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Sparklines show {data.ticks.length} spot quotes recorded by this server since {fmtIstDateTime(data.ticksSince)} — not a complete market record.
        </p>
      ) : null}
    </section>
  );
}
