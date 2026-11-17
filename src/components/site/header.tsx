"use client";
import * as React from "react";
import { BarChart3, Calculator, LayoutGrid, Menu, ScrollText, Store } from "lucide-react";
import { Logo } from "./logo";
import { ModeToggle } from "./mode-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useMarket, useNow } from "@/components/providers";
import { fmtInr } from "@/lib/format";

export const NAV = [
  { href: "#overview", label: "Overview", icon: LayoutGrid },
  { href: "#chart", label: "History", icon: BarChart3 },
  { href: "#calculator", label: "Calculator", icon: Calculator },
  { href: "#sellers", label: "Sellers", icon: Store },
  { href: "#methodology", label: "Sources", icon: ScrollText },
];

function IstClock() {
  const now = useNow(1000);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return (
    <span className="font-mono text-[11px] text-muted-foreground tabular-nums" suppressHydrationWarning>
      {mounted ? new Date(now).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--"} IST
    </span>
  );
}

/** Close the sheet first, then scroll — anchor jumps during Radix's scroll-lock land in the wrong place. */
function goTo(href: string) {
  window.setTimeout(() => {
    const el = document.querySelector(href);
    if (!el) return;
    el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", href);
    (el as HTMLElement).focus?.({ preventScroll: true });
  }, 320);
}

export function SiteHeader() {
  const { data } = useMarket();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header className={`sticky top-0 z-40 transition-all ${scrolled ? "glass border-b border-border/80 shadow-[0_8px_30px_-20px_rgba(53,40,48,.35)]" : "bg-transparent"}`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a href="#top" aria-label="Kanchan home" className="rounded-xl focus-visible:ring-[3px] focus-visible:ring-gold/30 focus-visible:outline-none">
          <Logo />
        </a>
        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="rounded-full px-3.5 py-2 text-sm font-medium text-charcoal/75 transition hover:bg-soft-pink hover:text-charcoal focus-visible:ring-[3px] focus-visible:ring-gold/30 focus-visible:outline-none">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <div className="hidden flex-col items-end leading-tight md:flex">
            <IstClock />
            {data?.derived ? <span className="text-xs font-semibold text-charcoal num">24K {fmtInr(data.derived.per10g24k999)}<span className="font-normal text-muted-foreground">/10g parity</span></span> : null}
          </div>
          <ModeToggle className="hidden sm:inline-flex" />
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="p-0" onCloseAutoFocus={(e) => e.preventDefault()}>
              <SheetHeader className="border-b border-border bg-soft-pink/60 pt-6 pb-5">
                <SheetTitle asChild>
                  <div>
                    <Logo />
                  </div>
                </SheetTitle>
                <SheetDescription>India gold reference prices, history, calculator and seller comparison.</SheetDescription>
              </SheetHeader>
              <nav aria-label="Mobile" className="flex flex-col gap-1 px-3">
                {NAV.map((n) => (
                  <SheetClose asChild key={n.href}>
                    <a
                      href={n.href}
                      onClick={(e) => {
                        e.preventDefault();
                        setMenuOpen(false);
                        goTo(n.href);
                      }}
                      className="flex items-center gap-3 rounded-2xl px-3 py-3 text-[15px] font-medium text-charcoal transition hover:bg-soft-pink focus-visible:bg-soft-pink focus-visible:outline-none">
                      <span className="grid size-9 place-items-center rounded-xl bg-pink/70 text-gold-deep">
                        <n.icon className="size-4" />
                      </span>
                      {n.label}
                    </a>
                  </SheetClose>
                ))}
              </nav>
              <div className="mt-auto space-y-3 border-t border-border p-5">
                <div className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">Display mode</div>
                <ModeToggle />
                <div className="flex items-center justify-between pt-2">
                  <IstClock />
                  {data?.derived ? <span className="text-sm font-semibold num">{fmtInr(data.derived.per10g24k999)}/10g</span> : null}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

/** Floating bottom navigation for phones. */
export function MobileDock() {
  const [active, setActive] = React.useState("#overview");
  React.useEffect(() => {
    const ids = NAV.map((n) => n.href.slice(1));
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (vis) setActive(`#${vis.target.id}`);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.25, 0.5] },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);
  return (
    <nav aria-label="Quick sections" className="glass fixed inset-x-3 bottom-3 z-40 rounded-[22px] border border-border/80 p-1.5 shadow-[0_18px_40px_-18px_rgba(53,40,48,.45)] lg:hidden" style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}>
      <ul className="grid grid-cols-5">
        {NAV.map((n) => {
          const on = active === n.href;
          return (
            <li key={n.href}>
              <a href={n.href} aria-current={on ? "true" : undefined} className={`flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[10.5px] font-semibold transition focus-visible:ring-[3px] focus-visible:ring-gold/30 focus-visible:outline-none ${on ? "bg-charcoal text-white" : "text-charcoal/70"}`}>
                <n.icon className={`size-[18px] ${on ? "text-gold-light" : ""}`} aria-hidden />
                {n.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
