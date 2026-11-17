"use client";
import * as React from "react";
import { CheckCircle2, ExternalLink, RefreshCw, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FreshnessBadge } from "./freshness";
import { SectionHeading } from "./section-heading";
import { fmtIstDateTime } from "@/lib/format";
import type { SourceInfo, SourceStatus } from "@/lib/types";

type HealthSource = SourceInfo & SourceStatus;
interface Health {
  ok: boolean;
  checkedAt: string;
  tookMs: number;
  sources: HealthSource[];
}

const FORMULAS = [
  ["Fine-gold rate (₹/g)", "INR spot per troy oz ÷ 31.1034768"],
  ["24K parity per 10 g", "fine rate × 10 × 0.999"],
  ["22K parity per 10 g", "fine rate × 10 × 0.916"],
  ["Silver per kg (999)", "XAG US$/oz × USD/INR × 32.1507 × 0.999"],
  ["Indian landed estimate", "parity × (1 + customs duty) × 1.03 GST"],
  ["Seller markup", "final ÷ 1.03 − fine rate × grams × purity"],
  ["Per 10 g (999)", "final ÷ grams × 10 × 0.999 ÷ purity"],
  ["OroPocket you-pay per g", "buy + gst  (gst = 3% × buy, as returned)"],
  ["OroPocket premium", "buy ÷ (fine rate × 0.999) − 1"],
  ["Historical ₹/10 g", "period avg US$/oz × same-period ECB USD/INR ÷ 31.1034768 × 9.99"],
];

const NOT_SHOWN = [
  ["MCX Gold futures", "Exchange data is licensed for redistribution. The reference site reads it from Groww’s pages, and Groww’s terms prohibit republishing their content."],
  ["IBJA benchmark rates", "Published by IBJA, which sells them as a paid API (indiagoldratesapi.com). Its terms require permission for use beyond fair use."],
  ["Scraped retailer prices", "We don’t scrape jewellers’ sites or re-serve another site’s scraped data. Add your own quotes, or plug in a licensed feed."],
];

export function Methodology() {
  const [h, setH] = React.useState<Health | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const check = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/health", { cache: "no-store" });
      setH(await r.json());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Health check failed");
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => {
    check();
  }, [check]);

  return (
    <section id="methodology" aria-labelledby="method-h" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
      <SectionHeading id="method-h" eyebrow="Sources & methodology" title="Every number, traced">
        We only show data we’re allowed to show, mark derived numbers as derived, and never fill gaps with made-up prices. When a source fails, its last good value stays on screen (labelled stale) for up to 3 hours, then disappears.
      </SectionHeading>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <Card className="p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-xl">Data sources</h3>
            <div className="flex items-center gap-3">
              {h ? (
                <span className="text-xs text-muted-foreground">
                  Checked {fmtIstDateTime(h.checkedAt)} · {h.tookMs} ms
                </span>
              ) : null}
              <Button variant="outline" size="sm" onClick={check} disabled={loading}>
                <RefreshCw className={loading ? "animate-spin" : ""} /> Re-check
              </Button>
            </div>
          </div>
          {err ? (
            <p role="alert" className="text-sm text-down">
              {err}
            </p>
          ) : !h ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-border" data-testid="source-list">
              {h.sources.map((s, i) => (
                <li key={`${s.id}-${i}`} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.provider}</div>
                    </div>
                    <FreshnessBadge status={s.status} sourceUpdatedAt={s.sourceUpdatedAt} fetchedAt={s.fetchedAt} sourceName={s.name} liveLabel={s.id === "world-bank" ? "Latest release" : s.id === "server-ticks" ? "Recording" : "Live"} liveWindowMs={s.id === "world-bank" ? 62 * 86400_000 : s.id === "ecb-frankfurter" ? 4 * 86400_000 : undefined} />
                  </div>
                  <p className="mt-2 text-sm leading-relaxed">{s.represents}</p>
                  <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                    <div>
                      <dt className="inline font-semibold text-charcoal">Licence: </dt>
                      <dd className="inline">{s.licence}</dd>
                    </div>
                    <div>
                      <dt className="inline font-semibold text-charcoal">Updates: </dt>
                      <dd className="inline">{s.updateFrequency}</dd>
                    </div>
                  </dl>
                  {s.error ? <p className="mt-1 text-xs text-down">Last error: {s.error}</p> : null}
                  {s.url.startsWith("http") ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-gold-deep hover:underline">
                      {new URL(s.url).host} <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <h3 className="font-display text-xl">Formulas</h3>
            <dl className="mt-3 space-y-2.5">
              {FORMULAS.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-sm font-semibold">{k}</dt>
                  <dd className="font-mono text-[12px] text-muted-foreground">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Customs duty defaults to 6% (5% BCD + 1% AIDC, Union Budget July 2024). It’s an editable assumption, not fetched data. GST on gold is 3%.
            </p>
          </Card>
          <Card className="bg-soft-pink/60 p-5 sm:p-6">
            <h3 className="flex items-center gap-2 font-display text-xl">
              <ShieldAlert className="size-5 text-gold-deep" /> What we deliberately don’t show
            </h3>
            <ul className="mt-3 space-y-3">
              {NOT_SHOWN.map(([k, v]) => (
                <li key={k} className="text-sm">
                  <span className="font-semibold">{k}.</span> <span className="text-muted-foreground">{v}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5 text-sm sm:p-6">
            <h3 className="flex items-center gap-2 font-display text-xl">
              <CheckCircle2 className="size-5 text-up" /> Attribution
            </h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              Spot prices: <a className="text-gold-deep underline underline-offset-2" href="https://gold-api.com/" target="_blank" rel="noopener noreferrer">gold-api.com</a>. Foreign exchange: European Central Bank reference rates via <a className="text-gold-deep underline underline-offset-2" href="https://frankfurter.dev/" target="_blank" rel="noopener noreferrer">Frankfurter</a>. Monthly history: World Bank Commodity Price Data (The Pink Sheet). Retail rates: <a className="text-gold-deep underline underline-offset-2" href="https://oropocket.com/" target="_blank" rel="noopener noreferrer">OroPocket</a>. Not investment advice.
            </p>
          </Card>
        </div>
      </div>
    </section>
  );
}
