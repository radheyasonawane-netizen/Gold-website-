export function Sparkline({ values, className = "", label }: { values: number[]; className?: string; label: string }) {
  if (values.length < 2) {
    return (
      <div className={`grid place-items-center text-[11px] text-muted-foreground ${className}`} role="img" aria-label={`${label}: collecting data`}>
        collecting intraday ticks…
      </div>
    );
  }
  const lo = Math.min(...values),
    hi = Math.max(...values),
    r = hi - lo || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * 100).toFixed(2)},${(36 - ((v - lo) / r) * 32).toFixed(2)}`);
  const up = values.at(-1)! >= values[0];
  const id = `sg-${label.replace(/\W/g, "")}`;
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className={className} role="img" aria-label={`${label}: ${up ? "up" : "down"} over the recorded window`}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--chart-fill)" stopOpacity=".28" />
          <stop offset="1" stopColor="var(--chart-fill)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,40 ${pts.join(" ")} 100,40`} fill={`url(#${id})`} />
      <polyline points={pts.join(" ")} fill="none" stroke="var(--chart-line)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}
