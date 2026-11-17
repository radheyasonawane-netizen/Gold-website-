"use client";
import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink, FlaskConical, Plus, Search, Trash2, Store, Rss } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionHeading } from "./section-heading";
import { useMarket, useNow, useSettings } from "@/components/providers";
import { analyseSellerQuote, DEFAULT_GST_RATE } from "@/lib/calc";
import { fmtAgo, fmtInr, fmtPct } from "@/lib/format";
import { PURITIES, purityByCode, type PurityCode } from "@/lib/units";
import type { SellersResponse } from "@/lib/types";
import { filterRows, sortRows, type ProductType, type QuoteRow, type Row, type SortKey } from "@/lib/sellerTable";

/** Public seller pages people commonly check. Names and links only — we never store or scrape their prices. */
export const SELLER_DIRECTORY = [
  { name: "Tanishq", url: "https://www.tanishq.co.in/" },
  { name: "CaratLane", url: "https://www.caratlane.com/" },
  { name: "Augmont", url: "https://www.augmont.com/" },
  { name: "BlueStone", url: "https://www.bluestone.com/" },
  { name: "PN Gadgil", url: "https://www.pngjewellers.com/" },
  { name: "Senco Gold", url: "https://sencogoldanddiamonds.com/" },
  { name: "Candere (Kalyan)", url: "https://www.candere.com/" },
  { name: "Melorra", url: "https://www.melorra.com/" },
  { name: "Khazana", url: "https://www.khazanajewellery.com/" },
  { name: "Bangalore Refinery", url: "https://www.bangalorerefinery.com/" },
  { name: "CoinBazaar", url: "https://www.coinbazaar.in/" },
  { name: "Thangamayil", url: "https://www.thangamayil.com/" },
];

const LS_KEY = "kanchan.quotes.v1";
const TYPES: { v: ProductType | "all"; label: string }[] = [
  { v: "all", label: "All" },
  { v: "coin", label: "Coins" },
  { v: "bar", label: "Bars" },
  { v: "digital", label: "Digital" },
  { v: "jewellery", label: "Jewellery" },
];

function loadQuotes(): QuoteRow[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as QuoteRow[]) : [];
  } catch {
    return [];
  }
}
function saveQuotes(q: QuoteRow[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(q.filter((x) => x.origin !== "feed" && x.origin !== "api")));
  } catch {
    /* storage unavailable */
  }
}

export function SellerComparison() {
  const { data } = useMarket();
  const { mode, dutyRate } = useSettings();
  const now = useNow(15000);
  const [quotes, setQuotes] = React.useState<QuoteRow[]>([]);
  const [feed, setFeed] = React.useState<SellersResponse | null>(null);
  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState<ProductType | "all">("all");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "per10g999", dir: "asc" });
  const [formOpen, setFormOpen] = React.useState(false);

  React.useEffect(() => setQuotes(loadQuotes()), []);
  React.useEffect(() => {
    fetch("/api/sellers")
      .then((r) => r.json())
      .then(setFeed)
      .catch(() => setFeed(null));
  }, []);
  const update = (next: QuoteRow[]) => {
    setQuotes(next);
    saveQuotes(next);
  };

  const ref = data?.derived?.finePerGram ?? null;
  const feedRows: QuoteRow[] = (feed?.quotes ?? []).map((f, i) => {
    const pc = PURITIES.reduce((best, p) => (Math.abs(p.fineness - f.fineness) < Math.abs(best.fineness - f.fineness) ? p : best)).code;
    return { id: `feed-${i}`, seller: f.seller, product: f.product, type: /bar/i.test(f.product) ? "bar" : /digital/i.test(f.product) ? "digital" : "coin", grams: f.grams, purity: pc, fineness: f.fineness, price: f.price, includesGst: f.includesGst, url: f.url, at: f.updatedAt, origin: "feed" };
  });
  const oro = data?.oroPocket;
  const apiRows: QuoteRow[] = oro
    ? [{ id: "api-oropocket", seller: "OroPocket", product: "Digital gold, 10 g (24K 99.9)", type: "digital", grams: 10, purity: "999", fineness: oro.goldFineness, price: oro.gold.finalBuy * 10, includesGst: true, url: "https://oropocket.com/", at: oro.timestamp, origin: "api" }]
    : [];
  const all: Row[] = [...apiRows, ...feedRows, ...quotes].map((r) => ({ ...r, a: ref ? analyseSellerQuote({ price: r.price, grams: r.grams, fineness: r.fineness, includesGst: r.includesGst, gstRate: DEFAULT_GST_RATE }, ref) : null }));
  const rows = sortRows(filterRows(all, q, type), sort.key, sort.dir);
  const lowest = rows.reduce<number | null>((m, r) => (r.a && (m === null || r.a.per10g999 < m) ? r.a.per10g999 : m), null);
  const hasExamples = quotes.some((x) => x.origin === "example");

  const addExamples = () => {
    if (!ref) return;
    const mk = (id: string, product: string, type: ProductType, grams: number, purity: PurityCode, premium: number): QuoteRow => {
      const fin = purityByCode(purity).fineness;
      return { id, seller: `Example ${id.slice(-1).toUpperCase()}`, product, type, grams, purity, fineness: fin, price: Math.round(ref * grams * fin * (1 + dutyRate) * (1 + premium) * (1 + DEFAULT_GST_RATE)), includesGst: true, at: new Date().toISOString(), origin: "example" };
    };
    update([
      ...quotes.filter((x) => x.origin !== "example"),
      mk("ex-a", "10 g 24K coin", "coin", 10, "999", 0.035),
      mk("ex-b", "10 g 24K bar", "bar", 10, "999.9", 0.055),
      mk("ex-c", "8 g 24K coin", "coin", 8, "995", 0.07),
      mk("ex-d", "Digital gold, 10 g", "digital", 10, "999", 0.025),
      mk("ex-e", "10 g 22K chain", "jewellery", 10, "916", 0.16),
    ]);
  };

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "seller" ? "asc" : "asc" }));
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

  const originBadge = (r: Row) =>
    r.origin === "example" ? (
      <Badge variant="stale">
        <FlaskConical /> Illustrative
      </Badge>
    ) : r.origin === "api" ? (
      <Badge variant="live">
        <Rss /> Live API · {fmtAgo(r.at, now)}
      </Badge>
    ) : r.origin === "feed" ? (
      <Badge variant="live">
        <Rss /> Feed · {fmtAgo(r.at, now)}
      </Badge>
    ) : (
      <Badge variant="soft">Your quote · {fmtAgo(r.at, now)}</Badge>
    );

  return (
    <section id="sellers" aria-labelledby="sellers-h" className="bg-gradient-to-b from-soft-pink/60 to-white py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading id="sellers-h" eyebrow="Seller comparison" title="Compare quotes on equal terms">
          Enter the final price a jeweller or app shows you. We strip out GST, compare it with the same gold at spot parity, and scale every product to 10 g of 999 so a 995 coin and a 999.9 bar compare fairly. Ranked cheapest first.
        </SectionHeading>

        <Card className="mb-5 flex flex-col gap-3 border-gold/25 bg-white/80 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 text-sm">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-pink/70 text-gold-deep">
              <Store className="size-4" />
            </span>
            <p className="leading-relaxed text-muted-foreground">
              {feed?.configured ? (
                <>
                  Showing <b className="text-charcoal">{feed.feedName}</b> ({feed.quotes.length} licensed quotes) plus your own.
                </>
              ) : (
                <>
                  {oro ? (
                    <>
                      <b className="text-charcoal">OroPocket’s rate is live</b> from its public price API. Other sellers publish no feed we can use, and we don’t scrape their sites, so add the quotes you see or connect a licensed feed via <code className="rounded bg-soft-pink px-1">SELLER_FEED_URL</code>.
                    </>
                  ) : (
                    <>
                      <b className="text-charcoal">No live seller prices right now.</b> OroPocket’s API didn’t respond. Add the quotes you see, or connect a licensed feed via <code className="rounded bg-soft-pink px-1">SELLER_FEED_URL</code>.
                    </>
                  )}
                </>
              )}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="gold" onClick={() => setFormOpen((o) => !o)} aria-expanded={formOpen} aria-controls="quote-form">
              <Plus /> Add a quote
            </Button>
            {!hasExamples ? (
              <Button variant="outline" onClick={addExamples} disabled={!ref} title="Adds clearly-labelled made-up rows to try the table">
                <FlaskConical /> Try examples
              </Button>
            ) : (
              <Button variant="outline" onClick={() => update(quotes.filter((x) => x.origin !== "example"))}>
                Clear examples
              </Button>
            )}
          </div>
        </Card>

        {formOpen ? <QuoteForm onAdd={(r) => (update([...quotes, r]), setFormOpen(false))} onCancel={() => setFormOpen(false)} /> : null}

        <Card className="p-3 sm:p-5">
          <div className="flex flex-col gap-3 px-1 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input placeholder="Search seller or product" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" aria-label="Search seller or product" />
            </div>
            <div className="-mx-1 overflow-x-auto px-1">
              <ToggleGroup type="single" value={type} onValueChange={(v) => v && setType(v as ProductType | "all")} aria-label="Filter by product type">
                {TYPES.map((t) => (
                  <ToggleGroupItem key={t.v} value={t.v}>
                    {t.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-soft-pink/40 px-6 py-12 text-center">
              <p className="font-display text-xl">{all.length ? "No quotes match your filters." : "Your comparison is empty."}</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{all.length ? "Try a different search or product type." : "Check a few sellers below, then add the final price each one shows you. Quotes stay in this browser only."}</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block" data-testid="seller-table">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-8">#</TableHead>
                      <SortHead k="seller">Seller</SortHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Purity</TableHead>
                      <SortHead k="final" className="text-right">
                        Final price
                      </SortHead>
                      <TableHead className="text-right">Gold at parity</TableHead>
                      <SortHead k="markupPct" className="text-right">
                        Markup
                      </SortHead>
                      {mode === "advanced" ? <TableHead className="text-right">of which duty*</TableHead> : null}
                      <TableHead className="text-right">GST</TableHead>
                      <SortHead k="per10g999" className="text-right">
                        Per 10 g (999)
                      </SortHead>
                      <TableHead className="text-right">vs lowest</TableHead>
                      <TableHead className="w-10">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={r.id} data-testid="seller-row">
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-semibold">
                          {r.url ? (
                            <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-gold-deep">
                              {r.seller} <ExternalLink className="size-3" />
                            </a>
                          ) : (
                            r.seller
                          )}
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <div className="max-w-56">{r.product}</div>
                          <div className="mt-1">{originBadge(r)}</div>
                        </TableCell>
                        <TableCell className="text-right">{r.purity}</TableCell>
                        <TableCell className="text-right font-semibold">{r.a ? fmtInr(r.a.final) : "—"}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{r.a ? fmtInr(r.a.referenceValue) : "—"}</TableCell>
                        <TableCell className="text-right">
                          {r.a ? (
                            <>
                              {fmtInr(r.a.markup)}
                              <div className="text-xs text-muted-foreground">{fmtPct(r.a.markupPct, 1)}</div>
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        {mode === "advanced" ? <TableCell className="text-right text-muted-foreground">{r.a ? fmtInr(r.a.referenceValue * dutyRate) : "—"}</TableCell> : null}
                        <TableCell className="text-right text-muted-foreground">{r.a ? fmtInr(r.a.gst) : "—"}</TableCell>
                        <TableCell className="text-right font-semibold">{r.a ? fmtInr(r.a.per10g999) : "—"}</TableCell>
                        <TableCell className="text-right">{r.a && lowest !== null ? r.a.per10g999 === lowest ? <Badge variant="gold">Lowest</Badge> : <span className="text-muted-foreground">+{fmtInr(r.a.per10g999 - lowest)}</span> : "—"}</TableCell>
                        <TableCell>
                          {r.origin !== "feed" && r.origin !== "api" ? (
                            <Button variant="ghost" size="icon" className="size-8" aria-label={`Remove ${r.seller} ${r.product}`} onClick={() => update(quotes.filter((x) => x.id !== r.id))}>
                              <Trash2 className="size-4" />
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <ol className="space-y-3 md:hidden" data-testid="seller-cards">
                {rows.map((r, i) => (
                  <li key={r.id} className="rounded-2xl border border-border bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="grid size-6 place-items-center rounded-full bg-soft-pink text-[11px] font-bold text-gold-deep">{i + 1}</span>
                          <span className="font-semibold">{r.seller}</span>
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {r.product} · {r.purity}
                        </div>
                      </div>
                      {r.a && lowest !== null && r.a.per10g999 === lowest ? <Badge variant="gold">Lowest</Badge> : null}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm num">
                      <div>
                        <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Final</div>
                        <div className="font-display text-xl font-semibold">{r.a ? fmtInr(r.a.final) : "—"}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Per 10 g (999)</div>
                        <div className="font-display text-xl font-semibold">{r.a ? fmtInr(r.a.per10g999) : "—"}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-muted-foreground">Markup over parity</div>
                        <div>{r.a ? `${fmtInr(r.a.markup)} · ${fmtPct(r.a.markupPct, 1)}` : "—"}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] text-muted-foreground">GST incl.</div>
                        <div>{r.a ? fmtInr(r.a.gst) : "—"}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      {originBadge(r)}
                      {r.origin !== "feed" && r.origin !== "api" ? (
                        <Button variant="ghost" size="sm" aria-label={`Remove ${r.seller} ${r.product}`} onClick={() => update(quotes.filter((x) => x.id !== r.id))}>
                          <Trash2 /> Remove
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}

          <div className="mt-4 space-y-1.5 px-1 text-xs leading-relaxed text-muted-foreground">
            <p>
              <b>Markup</b> = price before GST − value of the same fine gold at live spot parity. It bundles customs duty, the dealer’s premium, making charge and margin. <b>Per 10 g (999)</b> = final ÷ grams × 10 × (0.999 ÷ purity).
            </p>
            {mode === "advanced" ? <p>* Duty share uses your {fmtPct(dutyRate, 1, false)} customs-duty assumption, not seller data.</p> : null}
            {hasExamples ? <p className="text-warn">Illustrative rows are generated from today’s parity with made-up premiums. They are not real seller prices.</p> : null}
          </div>
        </Card>

        <div className="mt-6">
          <h3 className="mb-3 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Where to check prices</h3>
          <ul className="flex flex-wrap gap-2">
            {SELLER_DIRECTORY.map((s) => (
              <li key={s.name}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3.5 py-1.5 text-sm transition hover:border-gold/50 hover:text-gold-deep focus-visible:ring-[3px] focus-visible:ring-gold/30 focus-visible:outline-none">
                  {s.name} <ExternalLink className="size-3 opacity-60" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function QuoteForm({ onAdd, onCancel }: { onAdd: (r: QuoteRow) => void; onCancel: () => void }) {
  const [f, setF] = React.useState({ seller: "", product: "", type: "coin" as ProductType, grams: "10", purity: "999" as PurityCode, price: "", includesGst: true, url: "" });
  const [err, setErr] = React.useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const grams = Number(f.grams),
      price = Number(f.price);
    if (!f.seller.trim()) return setErr("Enter the seller’s name.");
    if (!(grams > 0)) return setErr("Weight must be more than 0 g.");
    if (!(price > 0)) return setErr("Enter the price shown by the seller.");
    let url: string | undefined;
    if (f.url.trim()) {
      try {
        const u = new URL(f.url.trim());
        if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
        url = u.toString();
      } catch {
        return setErr("Link must be a full http(s) URL.");
      }
    }
    onAdd({
      id: `q-${Date.now().toString(36)}`,
      seller: f.seller.trim(),
      product: f.product.trim() || `${grams} g ${f.type}`,
      type: f.type,
      grams,
      purity: f.purity,
      fineness: purityByCode(f.purity).fineness,
      price,
      includesGst: f.includesGst,
      url,
      at: new Date().toISOString(),
      origin: "user",
    });
  };
  const sel = "h-10 w-full rounded-xl border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-gold focus-visible:ring-[3px] focus-visible:ring-gold/25";
  return (
    <Card id="quote-form" className="mb-5 p-5 sm:p-6">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Add a seller quote">
        <div className="space-y-2">
          <Label htmlFor="qf-seller">Seller</Label>
          <Input id="qf-seller" list="seller-list" value={f.seller} onChange={(e) => set("seller", e.target.value)} placeholder="e.g. Tanishq" autoComplete="off" />
          <datalist id="seller-list">
            {SELLER_DIRECTORY.map((s) => (
              <option key={s.name} value={s.name} />
            ))}
          </datalist>
        </div>
        <div className="space-y-2">
          <Label htmlFor="qf-product">Product</Label>
          <Input id="qf-product" value={f.product} onChange={(e) => set("product", e.target.value)} placeholder="10 g Lakshmi coin" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="qf-type">Type</Label>
          <select id="qf-type" value={f.type} onChange={(e) => set("type", e.target.value as ProductType)} className={sel}>
            <option value="coin">Coin</option>
            <option value="bar">Bar</option>
            <option value="digital">Digital gold</option>
            <option value="jewellery">Jewellery</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="qf-purity">Purity</Label>
          <select id="qf-purity" value={f.purity} onChange={(e) => set("purity", e.target.value as PurityCode)} className={sel}>
            {PURITIES.map((p) => (
              <option key={p.code} value={p.code}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="qf-grams">Weight (g)</Label>
          <Input id="qf-grams" type="number" inputMode="decimal" step="any" min="0" value={f.grams} onChange={(e) => set("grams", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="qf-price">Final price (₹)</Label>
          <Input id="qf-price" type="number" inputMode="decimal" step="any" min="0" value={f.price} onChange={(e) => set("price", e.target.value)} placeholder="as shown at checkout" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="qf-url">Link (optional)</Label>
          <Input id="qf-url" type="url" value={f.url} onChange={(e) => set("url", e.target.value)} placeholder="https://…" />
        </div>
        <div className="flex items-end gap-3 pb-2">
          <Switch id="qf-gst" checked={f.includesGst} onCheckedChange={(v) => set("includesGst", v)} />
          <Label htmlFor="qf-gst" className="normal-case tracking-normal text-sm font-medium text-charcoal">
            Price includes 3% GST
          </Label>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
          <Button type="submit" variant="default">
            <Plus /> Add to comparison
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          {err ? (
            <p role="alert" className="text-sm text-down">
              {err}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Saved only in this browser. Nothing is sent to our server.</p>
          )}
        </div>
      </form>
    </Card>
  );
}
