"use client";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNow } from "@/components/providers";
import { fmtAgo, fmtIstDateTime } from "@/lib/format";
import type { FetchStatus } from "@/lib/types";

/**
 * Freshness is judged from the *upstream* timestamp, not just from our fetch time:
 * a successful fetch of an old quote (e.g. weekend, market closed) is shown as "Delayed".
 */
export function freshnessOf(status: FetchStatus | undefined, sourceUpdatedAt: string | null | undefined, now: number, liveWindowMs = 5 * 60_000, liveLabel = "Live") {
  if (!status || status === "error") return { label: "Unavailable", variant: "error" as const };
  if (status === "unconfigured") return { label: "Not configured", variant: "soft" as const };
  if (status === "stale") return { label: "Stale · last good", variant: "stale" as const };
  const age = sourceUpdatedAt ? now - Date.parse(sourceUpdatedAt) : Infinity;
  if (age <= liveWindowMs) return { label: liveLabel, variant: "live" as const };
  return { label: "Delayed", variant: "stale" as const };
}

export function FreshnessBadge({
  status,
  sourceUpdatedAt,
  fetchedAt,
  liveWindowMs,
  sourceName,
  liveLabel,
}: {
  status: FetchStatus | undefined;
  sourceUpdatedAt: string | null | undefined;
  fetchedAt?: string | null;
  liveWindowMs?: number;
  sourceName: string;
  /** e.g. "Latest release" for monthly datasets, where "Live" would overstate freshness. */
  liveLabel?: string;
}) {
  const now = useNow(5000);
  const f = freshnessOf(status, sourceUpdatedAt, now, liveWindowMs, liveLabel);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="rounded-full focus-visible:ring-[3px] focus-visible:ring-gold/30 focus-visible:outline-none" aria-label={`${sourceName}: ${f.label}${sourceUpdatedAt ? `, data time ${fmtIstDateTime(sourceUpdatedAt)}` : ""}`}>
          <Badge variant={f.variant}>
            <span className={`size-1.5 rounded-full bg-current ${f.label === "Live" ? "live-dot" : ""}`} aria-hidden />
            {f.label}
            {sourceUpdatedAt && f.variant !== "error" ? <span className="font-normal">· {fmtAgo(sourceUpdatedAt, now)}</span> : null}
          </Badge>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <div className="font-semibold">{sourceName}</div>
        <div>Data time: {sourceUpdatedAt ? fmtIstDateTime(sourceUpdatedAt) : "—"}</div>
        {fetchedAt ? <div>Fetched by server: {fmtIstDateTime(fetchedAt)}</div> : null}
      </TooltipContent>
    </Tooltip>
  );
}
