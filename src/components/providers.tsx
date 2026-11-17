"use client";
import * as React from "react";
import type { MarketResponse } from "@/lib/types";
import { TooltipProvider } from "@/components/ui/tooltip";

/* ---------------- Settings: Simple/Advanced mode + shared assumptions ---------------- */

export type Mode = "simple" | "advanced";
/**
 * Customs duty assumption: 5% Basic Customs Duty + 1% AIDC = 6% as announced in the Union
 * Budget of July 2024. This is a user-editable assumption, NOT fetched data — verify against the
 * current CBIC notification before relying on it.
 */
export const DEFAULT_DUTY_RATE = 0.06;

interface Settings {
  mode: Mode;
  setMode: (m: Mode) => void;
  dutyRate: number;
  setDutyRate: (r: number) => void;
}
const SettingsCtx = React.createContext<Settings | null>(null);

function readLS<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function writeLS(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* private mode / blocked storage: settings just won't persist */
  }
}

/* ---------------- Market data: one shared poller for the whole page ---------------- */

interface MarketState {
  data: MarketResponse | null;
  error: string | null;
  loading: boolean;
  /** Client time of last successful refresh. */
  lastOkAt: number | null;
  refresh: () => void;
}
const MarketCtx = React.createContext<MarketState | null>(null);
const POLL_MS = 30_000;

export function Providers({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = React.useState<Mode>("simple");
  const [dutyRate, setDutyState] = React.useState(DEFAULT_DUTY_RATE);
  React.useEffect(() => {
    setModeState(readLS<Mode>("kanchan.mode", "simple"));
    setDutyState(readLS<number>("kanchan.duty", DEFAULT_DUTY_RATE));
  }, []);
  const settings = React.useMemo<Settings>(
    () => ({
      mode,
      setMode: (m) => {
        setModeState(m);
        writeLS("kanchan.mode", m);
      },
      dutyRate,
      setDutyRate: (r) => {
        setDutyState(r);
        writeLS("kanchan.duty", r);
      },
    }),
    [mode, dutyRate],
  );

  const [market, setMarket] = React.useState<Omit<MarketState, "refresh">>({ data: null, error: null, loading: true, lastOkAt: null });
  const inflight = React.useRef(false);
  const load = React.useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const res = await fetch("/api/market", { cache: "no-store" });
      const json = (await res.json()) as MarketResponse & { error?: string };
      if (!res.ok && !json.sources) throw new Error(json.error ?? `HTTP ${res.status}`);
      setMarket({
        data: json,
        error: json.derived ? null : "Live prices are unavailable right now.",
        loading: false,
        lastOkAt: json.derived ? Date.now() : null,
      });
    } catch (e) {
      // keep previous data on screen; surface the error
      setMarket((m) => ({ ...m, loading: false, error: e instanceof Error ? e.message : "Network error" }));
    } finally {
      inflight.current = false;
    }
  }, []);

  React.useEffect(() => {
    load();
    const id = setInterval(() => {
      if (!document.hidden) load();
    }, POLL_MS);
    const onVis = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  const marketValue = React.useMemo<MarketState>(() => ({ ...market, refresh: load }), [market, load]);

  return (
    <SettingsCtx.Provider value={settings}>
      <MarketCtx.Provider value={marketValue}>
        <TooltipProvider>{children}</TooltipProvider>
      </MarketCtx.Provider>
    </SettingsCtx.Provider>
  );
}

export function useSettings() {
  const v = React.useContext(SettingsCtx);
  if (!v) throw new Error("useSettings outside Providers");
  return v;
}
export function useMarket() {
  const v = React.useContext(MarketCtx);
  if (!v) throw new Error("useMarket outside Providers");
  return v;
}

/** Re-renders every `ms` so relative times ("12s ago") stay current. */
export function useNow(ms = 1000) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
