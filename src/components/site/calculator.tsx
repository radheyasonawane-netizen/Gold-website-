"use client";
import * as React from "react";
import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SectionHeading } from "./section-heading";
import { useRate } from "@/components/providers";
import { GST_RATE, priceBreakdown } from "@/lib/calc";
import { fmtInr, fmtNum } from "@/lib/format";
import { PURITIES, purityByCode, type PurityCode } from "@/lib/units";

/** Segment colours validated with the dataviz palette checker; every segment is also labelled. */
const SEG = { gold: "#a87b2a", making: "#e87ba4", gst: "#1baf7a" } as const;
const WEIGHTS = [1, 2, 5, 8, 10, 20, 50, 100];

export function PriceCalculator() {
  const { data } = useRate();
  const [grams, setGrams] = React.useState("10");
  const [purity, setPurity] = React.useState<PurityCode>("999");
  const [kind, setKind] = React.useState<"percent" | "perGram">("percent");
  const [making, setMaking] = React.useState("0");

  const rate = data?.quote?.gold.buy ?? null; // ₹/g of 999, excl. GST
  const g = Number(grams),
    mk = Number(making);
  const valid = rate && g > 0 && mk >= 0;
  const b = valid ? priceBreakdown({ rate999ExGst: rate!, grams: g, fineness: purityByCode(purity).fineness, making: kind === "percent" ? { kind, value: mk / 100 } : { kind, value: mk } }) : null;
  const segs = b
    ? ([
        { k: "gold", label: `Gold value (${purity})`, v: b.gold },
        { k: "making", label: kind === "percent" ? `Making charge (${fmtNum(mk, 1)}%)` : `Making charge (₹${fmtNum(mk, 0)}/g)`, v: b.making },
        { k: "gst", label: `GST (${GST_RATE * 100}%)`, v: b.gst },
      ] as const)
    : [];

  return (
    <section id="calculator" aria-labelledby="calc-h" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
      <SectionHeading id="calc-h" eyebrow="Calculator" title="Price any weight or purity">
        Uses today’s 24K rate. Add a making charge for jewellery or branded coins, and 3% GST is applied to the whole bill, as Indian jewellers charge it.
      </SectionHeading>
      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <Card className="p-5 sm:p-6">
          <form className="space-y-6" onSubmit={(e) => e.preventDefault()} aria-label="Calculator inputs">
            <div className="space-y-2">
              <Label htmlFor="grams">Weight</Label>
              <div className="relative">
                <Input id="grams" type="number" inputMode="decimal" min="0" step="any" value={grams} onChange={(e) => setGrams(e.target.value)} aria-invalid={grams !== "" && !(g > 0) ? true : undefined} className="pr-16" />
                <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-xs text-muted-foreground">grams</span>
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick weights">
                {WEIGHTS.map((w) => (
                  <button key={w} type="button" onClick={() => setGrams(String(w))} aria-pressed={g === w} className={`rounded-full border px-3 py-1 text-xs font-semibold transition focus-visible:ring-[3px] focus-visible:ring-gold/30 focus-visible:outline-none ${g === w ? "border-charcoal bg-charcoal text-white" : "border-border bg-white hover:border-gold/50"}`}>
                    {w}g
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="purity">Purity</Label>
              <select id="purity" value={purity} onChange={(e) => setPurity(e.target.value as PurityCode)} className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-gold focus-visible:ring-[3px] focus-visible:ring-gold/25">
                {PURITIES.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="making">Making charge</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" aria-label="About making charge" className="text-muted-foreground hover:text-gold-deep">
                      <Info className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Branded coins usually carry 3–10% over the gold value; jewellery commonly 8–25%. Use the figure on your bill.</TooltipContent>
                </Tooltip>
              </div>
              <div className="flex gap-2">
                <ToggleGroup type="single" value={kind} onValueChange={(v) => v && setKind(v as "percent" | "perGram")} aria-label="Making charge type">
                  <ToggleGroupItem value="percent">%</ToggleGroupItem>
                  <ToggleGroupItem value="perGram">₹/g</ToggleGroupItem>
                </ToggleGroup>
                <Input id="making" type="number" inputMode="decimal" min="0" step="any" value={making} onChange={(e) => setMaking(e.target.value)} aria-invalid={making !== "" && !(mk >= 0) ? true : undefined} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground num">{rate ? `Today’s 24K rate: ${fmtInr(rate, true)}/g excl. GST (OroPocket).` : "Waiting for today’s rate…"}</p>
          </form>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-white to-soft-pink p-5 sm:p-7" aria-live="polite">
          <div aria-hidden className="absolute -top-16 -right-16 size-56 rounded-full bg-pink/60 blur-2xl" />
          <div className="relative">
            <div className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">Estimated price</div>
            <div className="mt-2 font-display text-5xl font-semibold tracking-tight num sm:text-6xl" data-testid="calc-total">
              {b ? fmtInr(b.total) : "—"}
            </div>
            <div className="mt-1 text-sm text-muted-foreground num">{b ? `${fmtInr(b.perGram)} per gram · ${fmtNum(g, 2)} g of ${purity}` : "Enter a weight above."}</div>
            {b ? (
              <>
                <div className="mt-6 flex h-4 w-full gap-[2px] overflow-hidden rounded-full bg-white" role="img" aria-label={segs.map((s) => `${s.label} ${fmtInr(s.v)}`).join(", ")}>
                  {segs
                    .filter((s) => s.v > 0)
                    .map((s) => (
                      <div key={s.k} style={{ width: `${(s.v / b.total) * 100}%`, background: SEG[s.k] }} className="h-full first:rounded-l-full last:rounded-r-full" />
                    ))}
                </div>
                <dl className="mt-5 divide-y divide-border/80">
                  {segs.map((s) => (
                    <div key={s.k} className="flex items-center justify-between gap-3 py-3">
                      <dt className="flex min-w-0 items-center gap-2.5 text-sm">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: SEG[s.k] }} aria-hidden />
                        {s.label}
                      </dt>
                      <dd className="shrink-0 text-right whitespace-nowrap num">
                        <span className="font-semibold">{fmtInr(s.v)}</span>
                        <span className="ml-2 inline-block w-12 text-xs text-muted-foreground">{((s.v / b.total) * 100).toFixed(1)}%</span>
                      </dd>
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-3 font-semibold">
                    <dt>Total</dt>
                    <dd className="num">{fmtInr(b.total)}</dd>
                  </div>
                </dl>
              </>
            ) : null}
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">An estimate from today’s 24K rate. A jeweller’s own rate, wastage charges and hallmarking fees can change the final bill.</p>
          </div>
        </Card>
      </div>
    </section>
  );
}
