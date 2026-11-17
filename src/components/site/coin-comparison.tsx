"use client";
import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink, Eraser, History } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionHeading } from "./section-heading";
import { useNow, useRate } from "@/components/providers";
import { analyseCoin } from "@/lib/calc";
import { BRANDS, orderRows, type Brand, type CoinEntry, type CoinRow, type SortKey } from "@/lib/coins";
import { fmtAgo, fmtInr, fmtIstDateTime, fmtPct } from "@/lib/format";
import { PURITIES, purityByCode, type PurityCode } from "@/lib/units";

const LS_KEY = "kanchan.coins.v1";
const STALE_MS = 24 * 3600_000; // gold moves daily; older entries get a "recheck" badge

type Entries = Record<string, CoinEntry>;
type Row = CoinRow;

function load(): Entries {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}") as Entries;
  } catch {
    return {};
  }
}
function save(e: Entries) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(e));
  } catch {
    /* storage unavailable: entries last for this visit only */
  }
}

function PriceInput({ brand, entry, onCommit }: { brand: Brand; entry: CoinEntry | null; onCommit: (price: number | null) => void }) {
  const [v, setV] = React.useState(entry ? String(entry.price) : "");
  const [err, setErr] = React.useState(false);
  React.useEffect(() => setV(entry ? String(entry.price) : ""), [entry]);
  const commit = () => {
    const t = v.replace(/[,\s₹]/g, "");
    if (t === "") {
      setErr(false);
      if (entry) onCommit(null);
      return;
    }
    const n = Number(t);
    if (!Number.isFinite(n) || n < 10000 || n > 10_000_000) {
      setErr(true);
      return;
    }
    setErr(false);
    if (!entry || n !== entry.price) onCommit(n);
  };
  return (
    <div>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-sm text-muted-foreground">₹</span>
        <input
          id={`price-${brand.id}`}
          inputMode="decimal"
          aria-label={`${brand.name} 10 g coin price including GST`}
          aria-invalid={err || undefined}
          placeholder="Enter price"
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
          className="h-9 w-36 rounded-xl border border-input bg-card pr-3 pl-7 text-sm tabular-nums outline-none placeholder:text-muted-foreground focus-visible:border-gold focus-visible:ring-[3px] focus-visible:ring-gold/25 aria-invalid:border-down"
        />
      </div>
      {err ? <p className="mt-1 text-[11px] text-down">Enter the 10 g price in ₹, e.g. 145000.</p> : null}
    </div>
  );
}

export function CoinComparison() {
  const { data } = useRate();
  const now = useNow(30_000);
  const [entries, setEntries] = React.useState<Entries>({});
  const [purities, setPurities] = React.useState<Record<string, PurityCode>>({});
  const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "rank", dir: "asc" });
  React.useEffect(() => setEntries(load()), []);

  const update = (next: Entries) => {
    setEntries(next);
    save(next);
  };
  const ref = data?.quote?.gold.finalBuy ?? null; // ₹/g of 999, incl. GST
  const rows: Row[] = BRANDS.map((brand) => {
    const entry = entries[brand.id] ?? null;
    const purity = entry?.purity ?? purities[brand.id] ?? brand.defaultPurity;
    const fin = purityByCode(purity).fineness;
    return { brand, entry, purity, a: entry && ref ? analyseCoin(entry.price, 10, fin, ref) : null };
  });
  const ordered = orderRows(rows, sort.key, sort.dir);
  const priced = rows.filter((r) => r.a);
  const lowest = priced.length ? Math.min(...priced.map((r) => r.a!.per10g999)) : null;
  const highest = priced.length ? Math.max(...priced.map((r) => r.a!.per10g999)) : null;
  const ref10 = ref ? ref * 10 : null;
  const barMax = Math.max(highest ?? 0, ref10 ?? 0);
  const barMin = Math.min(lowest ?? Infinity, ref10 ?? Infinity) * 0.97;

  const setPrice = (b: Brand, price: number | null, purity: PurityCode) => {
    const next = { ...entries };
    if (price === null) delete next[b.id];
    else next[b.id] = { price, purity, enteredAt: new Date().toISOString() };
    update(next);
  };
  const setPurity = (b: Brand, p: PurityCode) => {
    setPurities((x) => ({ ...x, [b.id]: p }));
    const e = entries[b.id];
    if (e) update({ ...entries, [b.id]: { ...e, purity: p } });
  };
  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const SortHead = ({ k, children, className = "" }: { k: SortKey; children: React.ReactNode; className?: string }) => {
    const active = sort.key === k;
    return (
      <TableHead className={className} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
        <button type="button" onClick={() => toggleSort(k)} className={`inline-flex items-center gap-1 rounded-md uppercase hover:text-charcoal focus-visible:ring-[3px] focus-visible:ring-gold/30 focus-visible:outline-none ${active ? "text-charcoal" : ""}`}>
          {children}
          {active ? sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-50" />}
        </button>
      </TableHead>
    );
  };

  const entered = (r: Row) =>
    r.entry ? (
      <span className={`inline-flex items-center gap-1 text-[11px] ${now - Date.parse(r.entry.enteredAt) > STALE_MS ? "text-warn" : "text-muted-foreground"}`} title={fmtIstDateTime(r.entry.enteredAt)}>
        <History className="size-3" />
        {now - Date.parse(r.entry.enteredAt) > STALE_MS ? "Recheck · " : "Entered "}
        {fmtAgo(r.entry.enteredAt, now)}
      </span>
    ) : null;

  const PuritySelect = ({ r }: { r: Row }) => (
    <select
      aria-label={`${r.brand.name} coin purity`}
      value={r.purity}
      onChange={(e) => setPurity(r.brand, e.target.value as PurityCode)}
      className="h-9 rounded-xl border border-input bg-card px-2 text-sm outline-none focus-visible:border-gold focus-visible:ring-[3px] focus-visible:ring-gold/25"
    >
      {PURITIES.filter((p) => p.karat === "24K").map((p) => (
        <option key={p.code} value={p.code}>
          {p.code}
        </option>
      ))}
    </select>
  );

  const Bar = ({ v }: { v: number }) =>
    barMax > barMin ? (
      <div className="relative h-1.5 w-28 rounded-full bg-soft-pink" aria-hidden>
        <div className="absolute inset-y-0 left-0 rounded-full bg-[var(--chart-line)]" style={{ width: `${((v - barMin) / (barMax - barMin)) * 100}%` }} />
        {ref10 ? <div className="absolute -top-1 h-3.5 w-0.5 rounded bg-charcoal" style={{ left: `${((ref10 - barMin) / (barMax - barMin)) * 100}%` }} /> : null}
      </div>
    ) : null;

  return (
    <section id="coins" aria-labelledby="coins-h" className="bg-gradient-to-b from-soft-pink/70 to-white py-16 lg:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading id="coins-h" eyebrow="10 g gold coin comparison" title="What ten brands charge for a 10 g coin">
          Brands don’t publish prices through an API, so open each brand’s site, find its 10 g 24K coin, and type the final price (GST included). Kanchan compares every coin with today’s 24K rate and ranks them. Prices stay in this browser, dated, so you know when to recheck.
        </SectionHeading>

        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <div className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">Today’s 24K rate · 10 g</div>
            <div className="mt-1 font-display text-2xl font-semibold num">{ref10 ? fmtInr(ref10) : "—"}</div>
            <div className="text-xs text-muted-foreground">OroPocket, incl. GST · the dark marker on each bar</div>
          </Card>
          <Card className="p-4">
            <div className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">Lowest coin entered</div>
            <div className="mt-1 font-display text-2xl font-semibold num" data-testid="coins-lowest">
              {lowest ? fmtInr(lowest) : "—"}
            </div>
            <div className="text-xs text-muted-foreground">{lowest && ref10 ? `${fmtPct(lowest / ref10 - 1, 1)} vs today’s rate` : `${priced.length} of ${BRANDS.length} brands entered`}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">Gap, cheapest to dearest</div>
            <div className="mt-1 font-display text-2xl font-semibold num">{lowest && highest && priced.length > 1 ? fmtInr(highest - lowest) : "—"}</div>
            <div className="text-xs text-muted-foreground">
              {priced.length} of {BRANDS.length} brands entered
            </div>
          </Card>
        </div>

        <Card className="p-3 sm:p-5">
          {/* Desktop table */}
          <div className="hidden md:block" data-testid="coin-table">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-8">#</TableHead>
                  <SortHead k="brand">Brand</SortHead>
                  <TableHead>Purity</TableHead>
                  <TableHead>10 g price incl. GST</TableHead>
                  <SortHead k="rank" className="text-right">
                    Per 10 g (999)
                  </SortHead>
                  <SortHead k="premium" className="text-right">
                    Over today’s rate
                  </SortHead>
                  <TableHead>
                    <span className="sr-only">Comparison bar</span>
                  </TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordered.map((r, i) => (
                  <TableRow key={r.brand.id} data-testid="coin-row" data-brand={r.brand.id}>
                    <TableCell className="text-muted-foreground">{r.a ? i + 1 : "–"}</TableCell>
                    <TableCell className="whitespace-normal">
                      <a href={r.brand.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold hover:text-gold-deep">
                        {r.brand.name} <ExternalLink className="size-3 opacity-60" />
                      </a>
                      <div className="mt-0.5">{entered(r)}</div>
                    </TableCell>
                    <TableCell>
                      <PuritySelect r={r} />
                    </TableCell>
                    <TableCell>
                      <PriceInput brand={r.brand} entry={r.entry} onCommit={(p) => setPrice(r.brand, p, r.purity)} />
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {r.a ? (
                        <>
                          {fmtInr(r.a.per10g999)}
                          {lowest !== null && r.a.per10g999 === lowest ? (
                            <Badge variant="gold" className="ml-2">
                              Lowest
                            </Badge>
                          ) : lowest !== null ? (
                            <div className="text-xs font-normal text-muted-foreground">+{fmtInr(r.a.per10g999 - lowest)}</div>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.a ? (
                        <>
                          {fmtInr(r.a.premium)}
                          <div className="text-xs text-muted-foreground">{fmtPct(r.a.premiumPct, 1)}</div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{r.a ? <Bar v={r.a.per10g999} /> : null}</TableCell>
                    <TableCell>
                      {r.entry ? (
                        <Button variant="ghost" size="icon" className="size-8" aria-label={`Clear ${r.brand.name} price`} onClick={() => setPrice(r.brand, null, r.purity)}>
                          <Eraser className="size-4" />
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <ol className="space-y-3 md:hidden" data-testid="coin-cards">
            {ordered.map((r, i) => (
              <li key={r.brand.id} className="rounded-2xl border border-border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="grid size-6 place-items-center rounded-full bg-soft-pink text-[11px] font-bold text-gold-deep">{r.a ? i + 1 : "–"}</span>
                    <a href={r.brand.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold">
                      {r.brand.name} <ExternalLink className="size-3 opacity-60" />
                    </a>
                  </div>
                  {r.a && lowest !== null && r.a.per10g999 === lowest ? <Badge variant="gold">Lowest</Badge> : null}
                </div>
                <div className="mt-3 flex flex-wrap items-start gap-2">
                  <PuritySelect r={r} />
                  <PriceInput brand={r.brand} entry={r.entry} onCommit={(p) => setPrice(r.brand, p, r.purity)} />
                </div>
                {r.a ? (
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm num">
                    <div>
                      <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Per 10 g (999)</div>
                      <div className="font-display text-xl font-semibold">{fmtInr(r.a.per10g999)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Over today’s rate</div>
                      <div className="font-display text-xl font-semibold">{fmtPct(r.a.premiumPct, 1)}</div>
                      <div className="text-xs text-muted-foreground">{fmtInr(r.a.premium)}</div>
                    </div>
                  </div>
                ) : null}
                <div className="mt-2 flex items-center justify-between">
                  {entered(r) ?? <span className="text-[11px] text-muted-foreground">Open the brand’s site and enter its 10 g coin price.</span>}
                  {r.entry ? (
                    <Button variant="ghost" size="sm" aria-label={`Clear ${r.brand.name} price`} onClick={() => setPrice(r.brand, null, r.purity)}>
                      <Eraser /> Clear
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-4 flex flex-col gap-3 px-1 text-xs leading-relaxed text-muted-foreground sm:flex-row sm:items-start sm:justify-between">
            <p className="max-w-3xl">
              <b>Per 10 g (999)</b> = price × (0.999 ÷ purity), so a 995 coin and a 999.9 coin compare fairly. <b>Over today’s rate</b> = price − the same gold at today’s 24K rate with GST; it is the brand’s premium and minting charge. Purity defaults are typical for each brand: set the exact purity printed on the coin you check.
            </p>
            {priced.length ? (
              <Button variant="outline" size="sm" className="shrink-0" onClick={() => update({})}>
                <Eraser /> Clear all prices
              </Button>
            ) : null}
          </div>
        </Card>
      </div>
    </section>
  );
}
