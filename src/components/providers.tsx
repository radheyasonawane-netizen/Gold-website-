"use client";
import * as React from "react";
import type { McxResponse } from "@/lib/types";
import { TooltipProvider } from "@/components/ui/tooltip";

interface McxState {
  data: McxResponse | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
}
const McxCtx = React.createContext<McxState | null>(null);
/** MCX trades continuously in session; the server caches Groww quotes for 15 s. */
const POLL_MS = 15_000;

export function Providers({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<Omit<McxState, "refresh">>({ data: null, error: null, loading: true });
  const inflight = React.useRef(false);
  const load = React.useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const res = await fetch("/api/mcx", { cache: "no-store" });
      const json = (await res.json()) as Partial<McxResponse> & { error?: string };
      if (!json.status) throw new Error(json.error ?? `HTTP ${res.status}`);
      setState({ data: json as McxResponse, error: json.quote ? null : (json.error ?? "Price unavailable"), loading: false });
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

  const value = React.useMemo<McxState>(() => ({ ...state, refresh: load }), [state, load]);
  return (
    <McxCtx.Provider value={value}>
      <TooltipProvider>{children}</TooltipProvider>
    </McxCtx.Provider>
  );
}

export function useMcx() {
  const v = React.useContext(McxCtx);
  if (!v) throw new Error("useMcx outside Providers");
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
