const inr0 = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtInr = (n: number, decimals = false) => (Number.isFinite(n) ? (decimals ? inr2 : inr0).format(n) : "—");
export const fmtUsd = (n: number) => (Number.isFinite(n) ? usd2.format(n) : "—");
export const fmtNum = (n: number, d = 2) =>
  Number.isFinite(n) ? n.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";
export const fmtPct = (f: number, d = 2, signed = true) =>
  Number.isFinite(f) ? `${signed && f > 0 ? "+" : ""}${(f * 100).toFixed(d)}%` : "—";

/** Compact Indian notation: ₹1.36L, ₹2.4Cr. */
export function fmtInrCompact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (a >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  if (a >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

export const IST = "Asia/Kolkata";

export function fmtIstDateTime(iso: string | number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { timeZone: IST, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }) + " IST";
}

export function fmtIstDate(iso: string | number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { timeZone: IST, day: "numeric", month: "short", year: "numeric" });
}

export function fmtAgo(iso: string | number, now = Date.now()): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}
