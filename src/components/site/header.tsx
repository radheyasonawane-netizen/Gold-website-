"use client";
import * as React from "react";
import { Logo } from "./logo";
import { useMcx, useNow } from "@/components/providers";
import { fmtInr } from "@/lib/format";

function IstClock() {
  const now = useNow(1000);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return (
    <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
      {mounted ? new Date(now).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--"} IST
    </span>
  );
}

export function SiteHeader() {
  const { data } = useMcx();
  const q = data?.quote;
  return (
    <header className="glass sticky top-0 z-40 border-b border-border/80">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a href="#price" aria-label="Kanchan home" className="rounded-xl focus-visible:ring-[3px] focus-visible:ring-gold/30 focus-visible:outline-none">
          <Logo />
        </a>
        <nav aria-label="Primary" className="flex items-center gap-1">
          <a href="#price" className="hidden rounded-full px-3.5 py-2 text-sm font-medium text-charcoal/75 hover:bg-soft-pink sm:inline-block">
            MCX price
          </a>
          <a href="#sources" className="rounded-full px-3.5 py-2 text-sm font-medium text-charcoal/75 hover:bg-soft-pink focus-visible:ring-[3px] focus-visible:ring-gold/30 focus-visible:outline-none">
            Source
          </a>
          <div className="ml-2 hidden flex-col items-end leading-tight md:flex">
            <IstClock />
            {q ? <span className="text-xs font-semibold num">Gold Ten {fmtInr(q.lastPrice)}</span> : null}
          </div>
        </nav>
      </div>
    </header>
  );
}
