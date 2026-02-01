# Realtime Invalidation – Recommendations

## Problem

- **Multiple events, same table**: e.g. regenerate daily motivation → backend `DELETE` + `INSERT` → two realtime events. Each triggers invalidate + refetch → duplicate API calls (e.g. many `GET /daily-motivations/today`).
- **Different tables, same queries**: check-in → invalidates goals, dashboard, analytics, partners; goals event → same keys invalidated again. Cascading invalidations and refetches.
- **Same invalidations in multiple handlers**: e.g. `goalsQueryKeys.all`, `homeDashboardQueryKeys.dashboard()`, `analyticsQueryKeys.all` appear in goals, check-ins, daily summaries, etc. Multiple events ⇒ same keys invalidated multiple times ⇒ redundant refetches.

**Backup**: `realtimeService.backup.ts` created. All changes will go through a **new module** that realtimeService imports; the main service file stays the single entry point.

---

## Recommendation A: **Debounced coalesced invalidation (and refetch)**

**Idea**: Realtime handlers no longer call `queryClient.invalidateQueries` / `refetchQueries` directly. They call a small helper that **schedules** invalidations and refetches. A debounced job (e.g. 100–150 ms) runs, **deduplicates by query key**, then performs one invalidate and one refetch per key.

**Flow**:

1. New module: `realtimeCoalescedInvalidation.ts`.
   - `scheduleInvalidate(queryKey)`, `scheduleRefetch(queryKey, type?: 'active'|'all')`.
   - Internally: add to `Set`/`Map` keyed by `JSON.stringify(queryKey)` (and type for refetch).
   - Start a debounce timer (e.g. 150 ms). On flush: `invalidateQueries` for each deduped key, then `refetchQueries` for each deduped key+type. Clear queue and timer.

2. `realtimeService` imports this module and replaces every `invalidateQueries` / `refetchQueries` with `scheduleInvalidate` / `scheduleRefetch`. Keeps `cancelQueries`, `setQueryData`, and other sync work as-is.

3. **Result**: Rapid events (DELETE + INSERT, or check-in + goals + partners) coalesce into a single invalidation and refetch per key. Same key from different tables or events → one API call.

**Pros**: Fixes duplicate calls, minimal API change, no change to React Query usage elsewhere.  
**Cons**: Small delay (debounce window) before refetch. Need to ensure `QueryClient` is set on the coalescer (e.g. during realtime init).

---

## Recommendation B: **Event batching first, then invalidate once**

**Idea**: Buffer incoming realtime events for a short window (e.g. 50–100 ms). After the window, process the **batch**: determine all affected query keys from all events, **dedupe**, then invalidate (and optionally refetch) once per key.

**Flow**:

1. New module: `realtimeEventBuffer.ts`.
   - Incoming events go into a buffer. A debounced “process” runs after no new events for X ms.
   - Process: run existing handler logic per event **in-memory only** (e.g. compute `setQueryData` updates, collect “affected keys”), but **do not** call `invalidateQueries` / `refetchQueries` per event.
   - Aggregate all affected keys, dedupe, then **single** invalidate + refetch pass.

2. `realtimeService`’s `handleChange` pushes payloads into the buffer instead of calling handlers directly. The buffer’s process step uses the same handler code paths to compute what to invalidate/refetch, but execution of invalidation/refetch is batched.

**Pros**: Can handle “same table multiple events” and “different tables, same affected queries” in one go.  
**Cons**: Bigger refactor (handlers must be split into “compute side effects” vs “execute them”). Risk of subtle bugs if some handlers have ordering or side-effect dependencies.

---

## Recommendation C: **Per–query-key debounce (no shared flush)**

**Idea**: Each **query key** has its own debounce timer. When an event says “invalidate X”, we reset the timer for X. When the timer fires, we invalidate (and refetch) X once. Different keys have independent timers.

**Flow**:

1. New module: `realtimePerKeyDebounce.ts`.
   - `scheduleInvalidate(queryKey)`: `Map<serializedKey, timerId>`. Cancel existing timer for that key, set new one (e.g. 100 ms). On fire: invalidate that key, delete from map.

2. Same as A for wiring: realtimeService uses `scheduleInvalidate` / `scheduleRefetch` instead of direct `queryClient` calls.

**Pros**: Simple mental model. No shared flush; keys don’t interact.  
**Cons**: Many keys → many timers. Bursts of events across keys can still cause many refetches (each key once), but that’s expected. Main win is deduping **same** key across events.

---

## Recommendation D: **Hybrid: coalesce invalidations only, refetch on timer**

**Idea**: **Invalidations** are coalesced (like A): collect keys, debounce, then `invalidateQueries` once per key. **Refetches** are not scheduled per event; instead, a single **global** timer (e.g. 200 ms) runs after any invalidation. When it fires, we `refetchQueries` for all **active** queries that are stale (or for a fixed set of “realtime-affected” keys).

**Flow**:

1. `scheduleInvalidate(queryKey)` → add to set, debounce flush.
2. On flush: run `invalidateQueries` for each key. **Don’t** call `refetchQueries` per key.
3. Start a **single** “refetch” timer (or use React Query’s built-in refetch-on-stale behavior for active queries). When it fires, refetch active queries we care about (or rely on `invalidateQueries` to have already marked them stale so they refetch when used).

**Pros**: Fewer moving parts; refetch strategy is centralized.  
**Cons**: Refetch timing is less “immediate” and more heuristic. Need to be clear which queries we refetch.

---

## Summary

| Option                                   | Complexity | Fixes same-key duplicates | Fixes cross-table same queries | Extra delay     |
| ---------------------------------------- | ---------- | ------------------------- | ------------------------------ | --------------- |
| **A** Coalesced invalidation + refetch   | Low        | ✅                        | ✅                             | ~100–150 ms     |
| **B** Event batching                     | High       | ✅                        | ✅                             | ~50–100 ms      |
| **C** Per-key debounce                   | Low        | ✅                        | ❌ (per key only)              | ~100 ms per key |
| **D** Coalesce invalidate, timer refetch | Medium     | ✅                        | ✅                             | ~200 ms         |

**Suggested default: A.** It matches the “one invalidation + one refetch per key per burst” behavior, stays localized to a new module and simple scheduler, and avoids touching handler semantics.

---

## Implementation plan (for chosen option)

1. **Keep** `realtimeService.backup.ts` as backup.
2. **Add** `realtimeCoalescedInvalidation.ts` (or the module matching the chosen strategy).
3. **Extend** `realtimeService.initialize(queryClient)` so it also initializes the coalescer with `queryClient`.
4. **Replace** all `queryClient.invalidateQueries` / `refetchQueries` in realtimeService with the new scheduler (e.g. `scheduleInvalidate` / `scheduleRefetch`). Leave `cancelQueries`, `setQueryData`, and non-query logic unchanged.
5. **Test** with:
   - Daily motivation regenerate (DELETE + INSERT → expect 1× `GET /today`).
   - Check-in (plus any triggers) → expect fewer duplicate calls for goals, dashboard, analytics, partners.

**Implemented:** Option A. See `realtimeCoalescedInvalidation.ts` and its usage in `realtimeService.ts`.
