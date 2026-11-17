"use client";
import { Card } from "@/components/ui/card";
import { FreshnessBadge } from "./freshness";
import { SectionHeading } from "./section-heading";
import { useMcx } from "@/components/providers";
import { fmtIstDateTime } from "@/lib/format";

export function McxSource() {
  const { data } = useMcx();
  const q = data?.quote;
  return (
    <section id="sources" aria-labelledby="src-h" className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <SectionHeading id="src-h" eyebrow="Source" title="Where the price comes from" />
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-display text-xl">MCX Gold Ten futures, via the Groww Trade API</h3>
            <p className="text-xs text-muted-foreground">Groww live-data quote · exchange MCX · segment COMMODITY · nearest unexpired contract from Groww’s instrument list</p>
          </div>
          <FreshnessBadge status={data?.status} sourceUpdatedAt={q?.lastTradeTime ? new Date(q.lastTradeTime).toISOString() : null} fetchedAt={data?.fetchedAt} sourceName="Groww Trade API (MCX)" liveWindowMs={10 * 60_000} liveLabel="Live" />
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold">What the number is</dt>
            <dd className="text-muted-foreground">The exchange’s last traded price for the Gold Ten futures contract, ₹ per 10 g. It excludes GST and any seller’s margin, so shop prices are higher.</dd>
          </div>
          <div>
            <dt className="font-semibold">Updates</dt>
            <dd className="text-muted-foreground">Every 15 seconds while the page is open, during MCX trading hours (weekdays, from 9:00 AM IST into the late evening). Outside those hours the last trade stays on screen with its time.</dd>
          </div>
          <div>
            <dt className="font-semibold">Contract</dt>
            <dd className="text-muted-foreground">{data?.contract ? `${data.contract.tradingSymbol}${data.contract.expiry ? `, expires ${data.contract.expiry}` : ""}. It rolls to the next month automatically after expiry.` : "—"}</dd>
          </div>
          <div>
            <dt className="font-semibold">Last fetched</dt>
            <dd className="text-muted-foreground">{data?.fetchedAt ? fmtIstDateTime(data.fetchedAt) : "—"}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          Uses your own Groww API access, which Groww’s terms allow for you and your family only. If Groww fails, the last good price stays up to 30 minutes, marked “Stale”, then the page shows “Unavailable”. For information only, not investment advice.
        </p>
      </Card>
    </section>
  );
}
