import "server-only";

export class UpstreamError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

const UA = "GoldLumiere/1.0 (+server-side price fetcher)";

/** fetch with timeout, one retry on network/5xx, and a clear error message. Never logs secrets. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number; retries?: number } = {},
): Promise<Response> {
  const { timeoutMs = 8000, retries = 1, headers, ...rest } = init;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...rest,
        headers: { "user-agent": UA, accept: "application/json", ...headers },
        signal: ctrl.signal,
        cache: "no-store",
      });
      if (res.status >= 500 && attempt < retries) {
        lastErr = new UpstreamError(`HTTP ${res.status}`, res.status);
        await sleep(400 * (attempt + 1));
        continue;
      }
      if (!res.ok) {
        throw new UpstreamError(`HTTP ${res.status} from ${new URL(url).host}`, res.status);
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (e instanceof UpstreamError && e.status && e.status < 500) throw e;
      if (attempt < retries) await sleep(400 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  const msg = lastErr instanceof Error ? (lastErr.name === "AbortError" ? `Timed out after ${timeoutMs} ms` : lastErr.message) : "Network error";
  throw new UpstreamError(`${msg} (${new URL(url).host})`);
}

export async function fetchJson<T>(url: string, init?: Parameters<typeof fetchWithTimeout>[1]): Promise<T> {
  const res = await fetchWithTimeout(url, init);
  return (await res.json()) as T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
