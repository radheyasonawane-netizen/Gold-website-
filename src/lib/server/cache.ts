import "server-only";

/**
 * Tiny in-process cache with "last good value" fallback.
 *
 * - Within `ttlMs` the cached value is returned without calling upstream (protects free APIs).
 * - After that, upstream is called; on failure the last good value is returned as `stale`
 *   for up to `maxStaleMs`, after which the caller gets the error.
 * - Concurrent callers share one in-flight request.
 *
 * Stored on globalThis so Next.js dev hot-reloads don't wipe it.
 */
export interface CacheResult<T> {
  value: T | null;
  fetchedAt: number | null;
  stale: boolean;
  error?: string;
}

interface Entry<T> {
  value: T;
  fetchedAt: number;
}

const g = globalThis as unknown as {
  __goldCache?: Map<string, Entry<unknown>>;
  __goldInflight?: Map<string, Promise<unknown>>;
};
const store = (g.__goldCache ??= new Map());
const inflight = (g.__goldInflight ??= new Map());

export async function cached<T>(
  key: string,
  opts: { ttlMs: number; maxStaleMs: number },
  fetcher: () => Promise<T>,
  now: () => number = Date.now,
): Promise<CacheResult<T>> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && now() - hit.fetchedAt < opts.ttlMs) {
    return { value: hit.value, fetchedAt: hit.fetchedAt, stale: false };
  }
  try {
    let p = inflight.get(key) as Promise<T> | undefined;
    if (!p) {
      p = fetcher().finally(() => inflight.delete(key));
      inflight.set(key, p);
    }
    const value = await p;
    const fetchedAt = now();
    store.set(key, { value, fetchedAt });
    return { value, fetchedAt, stale: false };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    if (hit && now() - hit.fetchedAt < opts.maxStaleMs) {
      return { value: hit.value, fetchedAt: hit.fetchedAt, stale: true, error };
    }
    return { value: null, fetchedAt: hit?.fetchedAt ?? null, stale: false, error };
  }
}

/** Test helper. */
export function __clearCache() {
  store.clear();
  inflight.clear();
}
