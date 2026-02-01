/**
 * Realtime Coalesced Invalidation
 *
 * Debounces and deduplicates invalidate/refetch from realtime events to avoid
 * redundant API calls (e.g. DELETE + INSERT → one refetch per key).
 * Standard practice at scale (Instagram/Facebook-style): optimistic UI +
 * batched background sync.
 *
 * Usage: init once with QueryClient. Handlers call scheduleInvalidate /
 * scheduleRefetch instead of queryClient.invalidateQueries / refetchQueries.
 */

import type { QueryClient, QueryKey } from "@tanstack/react-query";

const DEBOUNCE_MS = 150;
export type RefetchType = "active" | "all";

/** Keys that were invalidated/refetched in this flush (serialized QueryKeys). */
export type FlushContext = { invalidated: string[]; refetched: string[] };

let client: QueryClient | null = null;
const invalidateSet = new Set<string>();
const refetchMap = new Map<string, RefetchType>();
let timer: ReturnType<typeof setTimeout> | null = null;
let onFlush: ((ctx: FlushContext) => void | Promise<void>) | null = null;

function ser(key: QueryKey): string {
  return JSON.stringify(key);
}

function flush(): void {
  if (!client) return;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }

  const toInvalidate = [...invalidateSet];
  const toRefetch = [...refetchMap.entries()];
  invalidateSet.clear();
  refetchMap.clear();

  for (const s of toInvalidate) {
    try {
      const key = JSON.parse(s) as QueryKey;
      client.invalidateQueries({ queryKey: key });
    } catch {
      /* ignore */
    }
  }
  for (const [s, type] of toRefetch) {
    try {
      const key = JSON.parse(s) as QueryKey;
      client.refetchQueries({ queryKey: key, type });
    } catch {
      /* ignore */
    }
  }

  const fn = onFlush;
  if (fn) {
    const ctx: FlushContext = {
      invalidated: toInvalidate,
      refetched: toRefetch.map(([s]) => s)
    };
    Promise.resolve(fn(ctx)).catch((e) => console.warn("[RealtimeCoalescer] postFlush error:", e));
  }
}

function schedule(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, DEBOUNCE_MS);
}

/**
 * Initialize coalescer with QueryClient. Call once when realtime starts.
 * Optional postFlush runs once after each flush and receives which keys were
 * invalidated/refetched (e.g. to conditionally prefetch analytics only when
 * goals/checkIns changed).
 */
export function initRealtimeCoalescer(
  queryClient: QueryClient,
  postFlush?: (ctx: FlushContext) => void | Promise<void>
): void {
  client = queryClient;
  onFlush = postFlush ?? null;
}

/**
 * Teardown: clear timer and queues. Call on logout / realtime stop if needed.
 */
export function teardownRealtimeCoalescer(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  invalidateSet.clear();
  refetchMap.clear();
  client = null;
  onFlush = null;
}

/** Schedule invalidation. Deduped by key, flushed after DEBOUNCE_MS. */
export function scheduleInvalidate(queryKey: QueryKey): void {
  if (!client) return;
  invalidateSet.add(ser(queryKey));
  schedule();
}

/** Schedule refetch. Deduped by key+type, flushed after DEBOUNCE_MS. */
export function scheduleRefetch(queryKey: QueryKey, type: RefetchType = "active"): void {
  if (!client) return;
  refetchMap.set(ser(queryKey), type);
  schedule();
}

/** Run flush immediately and clear timer. Use for full-reset flows (reconnect, etc.). */
export function flushRealtimeCoalescer(): void {
  flush();
}
