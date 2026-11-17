"use client";
import * as React from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, RefreshCw, Table2, LineChart as LineIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip as UiTooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FreshnessBadge } from "./freshness";
import { SectionHeading } from "./section-heading";
import { useSettings } from "@/components/providers";
import { fmtInr, fmtInrCompact, fmtIstDate, fmtNum, fmtPct, fmtUsd } from "@/lib/format";
import type { HistoryPoint, HistoryRange, HistoryResponse } from "@/lib/types";

const HistoryPlot = dynamic(() => import("./history-plot"), { ssr: false, loading: () => <Skeleton className="h-[300px] w-full sm:h-[360px]" /> });

const ALL_RANGES: HistoryRange[] = ["1M", "3M", "6M", "1Y", "3Y", "5Y", "10Y", "MAX"];
type Metric = "inr" | "usd" | "fx";
const METRIC: Record<Metric, { label: string; get: (p: HistoryPoint) => number | null; fmt: (n: number) => string; axis: (n: number) => string }> = {
  inr: { label: "₹ per 10 g (999, parity)", get: (p) => p.inrPer10g, fmt: (n) => fmtInr(n), axis: fmtInrCompact },
  usd: { label: "US$ per troy oz", get: (p) => p.usdPerOz, fmt: fmtUsd, axis: (n) => `$${Math.round(n).toLocaleString("en-US")}` },
  fx: { label: "USD/INR (ECB)", get: (p) => p.usdInr, fmt: (n) => `₹${fmtNum(n, 2)}`, axis: (n) => `₹${n.toFixed(0)}` },
};

export function HistoryChart() {
  const { mode } = useSettings();
  const [range, setRange] = React.useState<HistoryRange>("5Y");
  const [metric, setMetric] = React.useState<Metric>("inr");
  const [view, setView] = React.useState<"chart" | "table">("chart");
  const [state, setState] = React.useState<{ data: HistoryResponse | null; loading: boolean; error: string | null }>({ data: null, loading: true, error: null });
  const cacheRef = React.useRef(new Map<HistoryRange, HistoryResponse>());

  const load = React.useCallback(async (r: HistoryRange, force = false) => {
    const hit = cacheRef.current.get(r);
    if (hit && !force) {
      setState({ data: hit, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(`/api/history?range=${r}`);
      const json = (await res.json()) as HistoryResponse & { error?: string };
      if (!res.ok || !json.points?.length) throw new Error(json.error ?? json.note ?? `HTTP ${res.status}`);
      cacheRef.current.set(r, json);
      setState({ data: json, loading: false, error: null });
      // If the server can't serve this range, snap to one it can.
      if (!json.availableRanges.includes(r)) setRange(json.availableRanges.at(-2) ?? json.availableRanges[0]);
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : "Failed to load history" }));
    }
  }, []);

  React.useEffect(() => {
    load(range);
  }, [range, load]);

  React.useEffect(() => {
    if (mode === "simple" && metric === "fx") setMetric("inr");
  }, [mode, metric]);

  const data = state.data;
  const m = METRIC[metric];
  const series = React.useMemo(() => (data?.points ?? []).map((p) => ({ t: p.t, v: m.get(p) })).filter((p): p is { t: number; v: number } => p.v != null), [data, m]);
  const live = data?.live && m.get(data.live) != null ? { t: data.live.t, v: m.get(data.live)! } : null;
  const stats = React.useMemo(() => {
    if (series.length < 2) return null;
    const first = series[0],
      last = series.at(-1)!;
    const hi = series.reduce((a, b) => (b.v > a.v ? b : a)),
      lo = series.reduce((a, b) => (b.v < a.v ? b : a));
    return { first, last, hi, lo, chg: last.v / first.v - 1 };
  }, [series]);
  const available = data?.availableRanges ?? ["1Y", "3Y", "5Y", "10Y", "MAX"];
  const monthly = data?.granularity === "month";
  const fmtPointDate = (t: number) => (monthly ? new Date(t).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }) : fmtIstDate(t));

  return (
    <section id="chart" aria-labelledby="chart-h" className="bg-soft-pink/60 py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading id="chart-h" eyebrow="Historical prices" title="How gold has moved in rupees">
          International gold price converted at each period’s USD/INR. It tracks the direction of Indian prices; domestic levels sit higher by duty, GST and dealer premium.
        </SectionHeading>

        <Card className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <ToggleGroup type="single" value={range} onValueChange={(v) => v && setRange(v as HistoryRange)} aria-label="Time range" className="flex-wrap">
                {ALL_RANGES.map((r) => {
                  const ok = available.includes(r);
                  const item = (
                    <ToggleGroupItem key={r} value={r} disabled={!ok} aria-label={ok ? `Range ${r}` : `Range ${r} (needs daily history API key)`}>
                      {r}
                    </ToggleGroupItem>
                  );
                  return ok ? (
                    item
                  ) : (
                    <UiTooltip key={r}>
                      <TooltipTrigger asChild>
                        <span tabIndex={0} className="rounded-full focus-visible:ring-[3px] focus-visible:ring-gold/30 focus-visible:outline-none">{item}</span>
                      </TooltipTrigger>
                      <TooltipContent>Daily ranges need a gold-api.com key (GOLD_API_KEY). Monthly data is shown without one.</TooltipContent>
                    </UiTooltip>
                  );
                })}
              </ToggleGroup>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ToggleGroup type="single" value={metric} onValueChange={(v) => v && setMetric(v as Metric)} aria-label="Measure">
                <ToggleGroupItem value="inr">₹/10g</ToggleGroupItem>
                <ToggleGroupItem value="usd">$/oz</ToggleGroupItem>
                {mode === "advanced" ? <ToggleGroupItem value="fx">USD/INR</ToggleGroupItem> : null}
              </ToggleGroup>
              <Button variant="outline" size="sm" onClick={() => setView(view === "chart" ? "table" : "chart")} aria-pressed={view === "table"}>
                {view === "chart" ? <Table2 /> : <LineIcon />} {view === "chart" ? "Table" : "Chart"}
              </Button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">{m.label}</div>
              {stats ? (
                <div className="mt-1 flex flex-wrap items-baseline gap-x-5 gap-y-1 num" data-testid="history-stats">
                  <span className={`text-lg font-semibold ${stats.chg >= 0 ? "text-up" : "text-down"}`}>{fmtPct(stats.chg, 1)}</span>
                  <span className="text-sm text-muted-foreground">
                    High <b className="text-charcoal">{m.fmt(stats.hi.v)}</b> · {fmtPointDate(stats.hi.t)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Low <b className="text-charcoal">{m.fmt(stats.lo.v)}</b> · {fmtPointDate(stats.lo.t)}
                  </span>
                </div>
              ) : null}
            </div>
            {data ? (
              <FreshnessBadge
                status={data.status}
                sourceUpdatedAt={data.sourceUpdatedAt}
                fetchedAt={data.fetchedAt}
                liveWindowMs={monthly ? 62 * 86400_000 : 4 * 86400_000}
                sourceName={data.source === "world-bank" ? "World Bank Pink Sheet (monthly)" : "gold-api.com history"}
                liveLabel={monthly ? "Latest release" : "Up to date"}
              />
            ) : null}
          </div>

          <div className="relative mt-4" aria-busy={state.loading}>
            {state.error && !data ? (
              <div role="alert" className="grid h-[340px] place-items-center rounded-2xl border border-down/20 bg-down/5 text-center text-sm text-down">
                <div>
                  <AlertTriangle className="mx-auto mb-2 size-6" />
                  History is unavailable: {state.error}
                  <div className="mt-3">
                    <Button variant="outline" size="sm" onClick={() => load(range, true)}>
                      <RefreshCw /> Retry
                    </Button>
                  </div>
                </div>
              </div>
            ) : !data ? (
              <Skeleton className="h-[340px] w-full" />
            ) : view === "chart" ? (
              <HistoryPlot series={series} live={live} monthly={monthly} loading={state.loading} showBrush={mode === "advanced"} fmt={m.fmt} axis={m.axis} />
            ) : (
              <div className="max-h-[360px] overflow-auto rounded-2xl border border-border">
                <Table>
                  <TableHeader className="sticky top-0 bg-white">
                    <TableRow>
                      <TableHead>{monthly ? "Month" : "Date"}</TableHead>
                      <TableHead className="text-right">US$/oz</TableHead>
                      <TableHead className="text-right">USD/INR</TableHead>
                      <TableHead className="text-right">₹/10 g parity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...(data.points ?? [])].reverse().map((p) => (
                      <TableRow key={p.t}>
                        <TableCell>{monthly ? new Date(p.t).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : fmtIstDate(p.t)}</TableCell>
                        <TableCell className="text-right">{fmtUsd(p.usdPerOz)}</TableCell>
                        <TableCell className="text-right">{p.usdInr ? fmtNum(p.usdInr, 2) : "—"}</TableCell>
                        <TableCell className="text-right font-medium">{p.inrPer10g ? fmtInr(p.inrPer10g) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            {data?.note} {live ? "The dark dot is the live spot parity (not part of the series). " : ""}
            {data?.source === "world-bank" ? (
              <>
                Source: World Bank Commodity Price Data (The Pink Sheet); FX: European Central Bank via Frankfurter.
              </>
            ) : null}
          </p>
        </Card>
      </div>
    </section>
  );
}
