"use client";
import { ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { FreshnessBadge } from "./freshness";
import { SectionHeading } from "./section-heading";
import { useRate } from "@/components/providers";
import { fmtIstDateTime } from "@/lib/format";

const FORMULAS: [string, string][] = [
  ["24K rate incl. GST, per gram", "buy + gst  (OroPocket’s own fields; gst = 3% of buy)"],
  ["Per 10 g", "per-gram rate × 10"],
  ["22K / 18K", "24K rate × purity ÷ 0.999"],
  ["Coin per 10 g (999)", "price × 10 ÷ grams × 0.999 ÷ purity"],
  ["Coin over today’s rate", "price − 24K rate incl. GST × grams × purity ÷ 0.999"],
  ["Calculator", "(gold value + making) × 1.03"],
];

export function Sources() {
  const { data } = useRate();
  return (
    <section id="sources" aria-labelledby="src-h" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
      <SectionHeading id="src-h" eyebrow="Sources & method" title="Where every number comes from" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-xl">Today’s rate: OroPocket</h3>
              <p className="text-xs text-muted-foreground">Published buy and sell rates for 24K 99.9% digital gold (Augmont-sourced) and 999 silver</p>
            </div>
            <FreshnessBadge status={data?.status} sourceUpdatedAt={data?.quote?.timestamp} fetchedAt={data?.fetchedAt} sourceName="OroPocket published rate" liveWindowMs={35 * 60_000} liveLabel="Current" />
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="inline font-semibold">Updates: </dt>
              <dd className="inline text-muted-foreground">OroPocket refreshes every few minutes; this site re-reads it at most every 2 minutes. If it stops responding, the last rate stays up to 3 hours marked “Stale”, then the page shows “Unavailable”.</dd>
            </div>
            <div>
              <dt className="inline font-semibold">Last rate: </dt>
              <dd className="inline text-muted-foreground">{data?.quote ? fmtIstDateTime(data.quote.timestamp) : "—"}</dd>
            </div>
            <div>
              <dt className="inline font-semibold">Terms: </dt>
              <dd className="inline text-muted-foreground">Keyless public endpoint. OroPocket’s developer docs cover a keyed partner API instead; no explicit licence for the public one was found.</dd>
            </div>
          </dl>
          <a href="https://api.oropocket.com/public/prices" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-gold-deep underline underline-offset-2">
            See the raw rate <ExternalLink className="size-3.5" />
          </a>
          <h3 className="mt-6 font-display text-xl">Coin prices: entered by you</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">No brand offers a price API, and this site doesn’t copy prices from brand websites automatically. Each price you type is stored only in your browser with the time you entered it.</p>
        </Card>
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
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">All prices are Indian rupee rates. Nothing on this page uses international prices or currency conversion. For information only, not investment advice.</p>
        </Card>
      </div>
    </section>
  );
}
