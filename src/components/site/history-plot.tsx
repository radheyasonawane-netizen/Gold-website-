"use client";
import { Area, AreaChart, Brush, CartesianGrid, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtIstDate } from "@/lib/format";

export interface PlotProps {
  series: { t: number; v: number }[];
  live: { t: number; v: number } | null;
  monthly: boolean;
  loading: boolean;
  showBrush: boolean;
  fmt: (n: number) => string;
  axis: (n: number) => string;
}

/** Recharts lives in its own chunk (loaded lazily) so the rest of the page is interactive sooner. */
export default function HistoryPlot({ series, live, monthly, loading, showBrush, fmt, axis }: PlotProps) {
  const fmtTick = (t: number) => new Date(t).toLocaleDateString("en-IN", monthly ? { month: "short", year: "2-digit" } : { day: "numeric", month: "short" });
  const m = { fmt, axis };
  const mode = showBrush ? "advanced" : "simple";
  return (
    <div className={`h-[300px] sm:h-[360px] transition-opacity ${loading ? "opacity-50" : ""}`} data-testid="history-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 24, right: 16, left: 4, bottom: 4 }}>
          <defs>
            <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-fill)" stopOpacity={0.32} />
              <stop offset="100%" stopColor="var(--chart-fill)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", live ? live.t : "dataMax"]}
            tickFormatter={fmtTick}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            minTickGap={36}
          />
          <YAxis domain={["auto", "auto"]} tickFormatter={m.axis} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={64} />
          <Tooltip
            cursor={{ stroke: "var(--charcoal)", strokeDasharray: "3 3", strokeOpacity: 0.4 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as { t: number; v: number };
              return (
                <div className="rounded-xl border border-border bg-white px-3 py-2 text-xs shadow-lg">
                  <div className="text-muted-foreground">{monthly ? new Date(p.t).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) + " avg" : fmtIstDate(p.t)}</div>
                  <div className="mt-0.5 text-sm font-semibold num">{m.fmt(p.v)}</div>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="v"
            stroke="var(--chart-line)"
            strokeWidth={2}
            fill="url(#goldFill)"
            activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2, fill: "var(--chart-line)" }}
            isAnimationActive={false}
          />
          {live ? (
            <ReferenceDot
              x={live.t}
              y={live.v}
              r={5}
              fill="var(--charcoal)"
              stroke="#fff"
              strokeWidth={2}
              label={{ value: `Live ${m.axis(live.v)}`, position: "left", offset: 10, fontSize: 11, fontWeight: 600, fill: "var(--charcoal)" }}
            />
          ) : null}
          {mode === "advanced" && series.length > 24 ? (
            <Brush dataKey="t" height={26} stroke="var(--chart-line)" tickFormatter={fmtTick} travellerWidth={10} fill="var(--soft-pink)" />
          ) : null}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
