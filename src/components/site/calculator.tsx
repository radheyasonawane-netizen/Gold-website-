"use client";
import * as React from "react";
import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SectionHeading } from "./section-heading";
import { useMarket, useSettings } from "@/components/providers";
import { DEFAULT_GST_RATE, priceBreakdown, type MakingCharge } from "@/lib/calc";
import { fmtInr, fmtNum } from "@/lib/format";
import { PURITIES, purityByCode, type PurityCode } from "@/lib/units";

/** Segment colours validated with the dataviz palette checker (labels + 2px gaps provide CVD relief). */
const SEG = { metal: "#a87b2a", duty: "#6250d6", making: "#e87ba4", gst: "#1baf7a" } as const;
const WEIGHTS = [1, 5, 8, 10, 20, 50, 100];

function NumberField({ id, label, value, onChange, suffix, step = "any", min = 0, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; suffix?: string; step?: string; min?: number; hint?: React.ReactNode }) {
  const invalid = value !== "" && (!Number.isFinite(Number(value)) || Number(value) < min);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id}>{label}</Label>
        {hint ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label={`About ${label}`} className="text-muted-foreground hover:text-gold-deep">
                <Info className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{hint}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <div className="relative">
        <Input id={id} inputMode="decimal" type="number" step={step} min={min} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid || undefined} className={suffix ? "pr-14" : ""} />
        {suffix ? <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-xs text-muted-foreground">{suffix}</span> : null}
      </div>
      {invalid ? <p className="text-xs text-down">Enter a number ≥ {min}.</p> : null}
    </div>
  );
}

export function PriceCalculator() {
  const { data } = useMarket();
  const { mode, dutyRate, setDutyRate } = useSettings();
  const [base, setBase] = React.useState<"parity" | "custom">("parity");
  const [customRate, setCustomRate] = React.useState("");
  const [grams, setGrams] = React.useState("10");
  const [purity, setPurity] = React.useState<PurityCode>("999");
  const [makingKind, setMakingKind] = React.useState<"percent" | "perGram">("percent");
  const [making, setMaking] = React.useState("0");
  const [gst, setGst] = React.useState(String(DEFAULT_GST_RATE * 100));
  const [duty, setDuty] = React.useState(String(dutyRate * 100));
  React.useEffect(() => setDuty(String(+(dutyRate * 100).toFixed(2))), [dutyRate]);

  React.useEffect(() => {
    if (mode === "simple") {
      setMakingKind("percent");
      setGst(String(DEFAULT_GST_RATE * 100));
    }
  }, [mode]);

  const parityFine = data?.derived?.finePerGram ?? null;
  const custom = Number(customRate);
  // A custom rate is "₹ per 10 g of 24K 999" and is assumed to already include duty (domestic).
  const finePerGram = base === "parity" ? parityFine : custom > 0 ? custom / 10 / 0.999 : null;
  const g = Number(grams),
    mk = Number(making),
    gs = Number(gst) / 100,
    du = base === "parity" ? Number(duty) / 100 : 0;
  const valid = finePerGram && g > 0 && mk >= 0 && gs >= 0 && du >= 0;
  const mc: MakingCharge = makingKind === "percent" ? { kind: "percent", value: mk / 100 } : { kind: "perGram", value: mk };
  const b = valid ? priceBreakdown({ finePerGram: finePerGram!, grams: g, fineness: purityByCode(purity).fineness, importDutyRate: du, making: mc, gstRate: gs }) : null;

  const segs = b
    ? ([
        { k: "metal", label: base === "parity" ? "Gold value at spot parity" : "Gold value at your rate", v: b.metal },
        { k: "duty", label: `Customs duty (${fmtNum(du * 100, 1)}%)`, v: b.duty },
        { k: "making", label: makingKind === "percent" ? `Making & margin (${fmtNum(mk, 1)}%)` : `Making (₹${fmtNum(mk, 0)}/g)`, v: b.making },
        { k: "gst", label: `GST (${fmtNum(gs * 100, 1)}%)`, v: b.gst },
      ] as const)
    : [];

  return (
    <section id="calculator" aria-labelledby="calc-h" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
      <SectionHeading id="calc-h" eyebrow="Price breakdown" title="What you’re actually paying for">
        Build a price from the metal up: gold value, customs duty, making charge, then 3% GST on the whole. Use the live parity, or type in a rate you were quoted.
      </SectionHeading>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <Card className="p-5 sm:p-6">
          <form className="space-y-6" onSubmit={(e) => e.preventDefault()} aria-label="Price breakdown inputs">
            <div className="space-y-2">
              <Label id="base-l">Base gold rate</Label>
              <ToggleGroup type="single" value={base} onValueChange={(v) => v && setBase(v as "parity" | "custom")} aria-labelledby="base-l" className="w-full">
                <ToggleGroupItem value="parity" className="flex-1">
                  Live spot parity
                </ToggleGroupItem>
                <ToggleGroupItem value="custom" className="flex-1">
                  Rate I was quoted
                </ToggleGroupItem>
              </ToggleGroup>
              {base === "parity" ? (
                <p className="text-xs text-muted-foreground num">{parityFine ? `${fmtInr(parityFine * 10 * 0.999)} per 10 g (999), ex-duty, from live spot.` : "Waiting for live spot…"}</p>
              ) : (
                <NumberField id="custom-rate" label="₹ per 10 g · 24K 999 (excl. GST)" value={customRate} onChange={setCustomRate} hint="e.g. the 24K rate on a jeweller’s board or a published benchmark. Assumed to already include customs duty, so duty is not added again." />
              )}
            </div>

            <div className="space-y-2">
              <NumberField id="grams" label="Weight" value={grams} onChange={setGrams} suffix="grams" />
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick weights">
                {WEIGHTS.map((w) => (
                  <button key={w} type="button" onClick={() => setGrams(String(w))} aria-pressed={Number(grams) === w} className={`rounded-full border px-3 py-1 text-xs font-semibold transition focus-visible:ring-[3px] focus-visible:ring-gold/30 focus-visible:outline-none ${Number(grams) === w ? "border-charcoal bg-charcoal text-white" : "border-border bg-white hover:border-gold/50"}`}>
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                {mode === "advanced" ? (
                  <ToggleGroup type="single" value={makingKind} onValueChange={(v) => v && setMakingKind(v as "percent" | "perGram")} aria-label="Making charge type" className="mb-1">
                    <ToggleGroupItem value="percent">%</ToggleGroupItem>
                    <ToggleGroupItem value="perGram">₹/g</ToggleGroupItem>
                  </ToggleGroup>
                ) : null}
                <NumberField
                  id="making"
                  label="Making charge"
                  value={making}
                  onChange={setMaking}
                  suffix={makingKind === "percent" ? "%" : "₹/g"}
                  hint="Coins and bars are often 0–8% above metal; jewellery commonly 8–25%. Use the figure on your quote."
                />
              </div>
              {base === "parity" ? (
                <NumberField
                  id="duty"
                  label="Customs duty"
                  value={duty}
                  onChange={(v) => {
                    setDuty(v);
                    const n = Number(v);
                    if (Number.isFinite(n) && n >= 0) setDutyRate(n / 100);
                  }}
                  suffix="%"
                  hint="Assumption, not live data: 6% = 5% Basic Customs Duty + 1% AIDC per Union Budget, July 2024. Check the current CBIC notification."
                />
              ) : null}
              {mode === "advanced" ? <NumberField id="gst" label="GST" value={gst} onChange={setGst} suffix="%" hint="3% on gold goods (HSN 71). Applied to metal + duty + making." /> : null}
            </div>
          </form>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-white to-soft-pink p-5 sm:p-7" aria-live="polite">
          <div aria-hidden className="absolute -right-16 -top-16 size-56 rounded-full bg-pink/60 blur-2xl" />
          <div className="relative">
            <div className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">Estimated price you pay</div>
            <div className="mt-2 font-display text-5xl font-semibold tracking-tight num sm:text-6xl" data-testid="calc-total">
              {b ? fmtInr(b.total) : "—"}
            </div>
            <div className="mt-1 text-sm text-muted-foreground num">{b ? `${fmtInr(b.perGram)} per gram · ${fmtNum(g, 2)} g of ${purity}` : "Enter a valid rate and weight."}</div>

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
                        <span className="size-2.5 rounded-full" style={{ background: SEG[s.k] }} aria-hidden />
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
                    <dd className="num" data-testid="calc-total-row">
                      {fmtInr(b.total)}
                    </dd>
                  </div>
                </dl>
                {mode === "advanced" ? (
                  <p className="mt-2 rounded-2xl bg-white/70 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                    metal = {fmtNum(finePerGram!, 2)} ₹/g fine × {g} g × {purityByCode(purity).fineness}
                    <br />
                    duty = metal × {fmtNum(du * 100, 2)}% · making = {makingKind === "percent" ? `(metal + duty) × ${mk}%` : `${mk} ₹/g × ${g} g`}
                    <br />
                    GST = (metal + duty + making) × {fmtNum(gs * 100, 2)}%
                  </p>
                ) : null}
              </>
            ) : null}
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">An estimate for comparison, not a quote. Real prices also include the dealer’s premium or discount to parity, which varies daily.</p>
          </div>
        </Card>
      </div>
    </section>
  );
}
