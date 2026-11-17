"use client";
import * as React from "react";
import type { RateResponse } from "@/lib/types";
import { TooltipProvider } from "@/components/ui/tooltip";

interface RateState {
  data: RateResponse | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
}
const RateCtx = React.createContext<RateState | null>(null);
/** OroPocket refreshes about every 5 minutes; polling every 60 s keeps the page current. */
const POLL_MS = 60_000;

export function Providers({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<Omit<RateState, "refresh">>({ data: null, error: null, loading: true });
  const inflight = React.useRef(false);
  const load = React.useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const res = await fetch("/api/rate", { cache: "no-store" });
      const json = (await res.json()) as Partial<RateResponse> & { error?: string };
      if (!json.status) throw new Error(json.error ?? `HTTP ${res.status}`);
      setState({ data: json as RateResponse, error: json.quote ? null : (json.error ?? "Rate unavailable"), loading: false });
    } catch (e) {
      // Keep whatever was on screen; surface the error.
      setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : "Network error" }));
    } finally {
      inflight.current = false;
    }
  }, []);

  React.useEffect(() => {
    load();
    const id = setInterval(() => !document.hidden && load(), POLL_MS);
    const onVis = () => !document.hidden && load();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  const value = React.useMemo<RateState>(() => ({ ...state, refresh: load }), [state, load]);
  return (
    <RateCtx.Provider value={value}>
      <TooltipProvider>{children}</TooltipProvider>
    </RateCtx.Provider>
  );
}

export function useRate() {
  const v = React.useContext(RateCtx);
  if (!v) throw new Error("useRate outside Providers");
  return v;
}

/** Re-renders every `ms` so relative times ("3 min ago") stay current. */
export function useNow(ms = 1000) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
