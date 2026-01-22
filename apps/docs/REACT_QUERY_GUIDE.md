# React Query Guide for FitNudge

This document explains how React Query (TanStack Query) is used in the FitNudge mobile app, how we structure query keys, and how we keep UI fast and consistent using optimistic updates, invalidation, foreground refetching, and (when needed) Supabase Realtime.

## Table of Contents

1. [Why React Query?](#why-react-query)
2. [Core Concepts](#core-concepts)
3. [Query Keys Structure](#query-keys-structure)
4. [Data Freshness & External DB Changes](#data-freshness--external-db-changes)
5. [Queries (Reading Data)](#queries-reading-data)
6. [Mutations (Writing Data)](#mutations-writing-data)
7. [Optimistic Updates](#optimistic-updates)
8. [Supabase Realtime (Live Updates)](#supabase-realtime-live-updates)
9. [Mobile: Refetch on Foreground](#mobile-refetch-on-foreground)
10. [Best Practices](#best-practices)
11. [Common Patterns](#common-patterns)
12. [Checklist for New Hooks](#checklist-for-new-hooks)
13. [File Locations](#file-locations)
14. [Debugging Tips](#debugging-tips)
15. [Summary](#summary)

---

## Why React Query?

React Query solves several pain points in data fetching:

| Problem               | React Query Solution                         |
| --------------------- | -------------------------------------------- |
| Manual loading states | Automatic `isLoading`, `isFetching`          |
| Caching complexity    | Built-in cache with configurable stale times |
| Race conditions       | Automatic request deduplication              |
| Background refetching | Smart refetch on focus, reconnect            |
| Optimistic UI         | Built-in rollback on error                   |
| Server state sync     | Invalidation and refetching                  |

---

## Core Concepts

### Query Client

The `QueryClient` is the central cache that stores all query data. It's provided at the app root:

```tsx
// In _layout.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes
      retry: 2,
      // NOTE: "refetchOnWindowFocus" is web-oriented.
      // On mobile, we implement foreground refetch manually (see section below).
    },
  },
});

<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
```

### Accessing the Query Client

```tsx
import { useQueryClient } from "@tanstack/react-query";

const queryClient = useQueryClient();

// Read from cache
const data = queryClient.getQueryData(["goals", "list"]);

// Write to cache
queryClient.setQueryData(["goals", "list"], newData);

// Invalidate (trigger refetch)
queryClient.invalidateQueries({ queryKey: ["goals"] });
```

## Query Keys Structure

Query keys are arrays that uniquely identify cached data. We use a factory pattern for consistency:

```tsx
// ✅ Good: Query key factory
export const goalsQueryKeys = {
  all: ["goals"] as const,
  list: () => [...goalsQueryKeys.all, "list"] as const,
  detail: (id: string) => [...goalsQueryKeys.all, "detail", id] as const,
  active: () => [...goalsQueryKeys.all, "active"] as const,
  stats: (id?: string) => [...goalsQueryKeys.all, "stats", id] as const,
} as const;

// Usage
goalsQueryKeys.list(); // ["goals", "list"]
goalsQueryKeys.detail("abc"); // ["goals", "detail", "abc"]
```

### Key Hierarchy

Keys are hierarchical. Invalidating a parent invalidates all children:

```tsx
// Invalidates ALL goal queries (list, detail, active, stats)
queryClient.invalidateQueries({ queryKey: ["goals"] });

// Invalidates only the specific goal detail
queryClient.invalidateQueries({ queryKey: ["goals", "detail", "abc"] });
```

## Data Freshness & External DB Changes

### The Most Important Rule

React Query does not automatically know when your database changes outside the app.

If you change data in the Supabase dashboard/SQL editor, or data changes from another device, your app will keep showing cached data until you do one of the following:

1. Invalidate/refetch queries

2. Refetch when the app comes back to the foreground

3. Poll (refetch on an interval)

4. Subscribe to Supabase Realtime (push updates)

Real apps feel “instant” because they combine optimistic UI (for local actions) and refetch/realtime (for external changes).

### When to Use Which Strategy

Situation | Best Strategy
User action inside the app | Optimistic update + invalidate on settle
Data changes from another device/user | Supabase Realtime (subscribe) or polling
Data can change while app is backgrounded | Foreground refetch (AppState)
“Live-ish” screens (dashboards, feeds) | Polling sparingly or Realtime
Server computes derived fields (stats/streak) | Always invalidate/refetch after mutation settles

## Queries (Reading Data)

Queries are for reading data from the server.

### Basic Query

```tsx
export const useGoals = () => {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: goalsQueryKeys.list(),
    queryFn: () => goalsService.getGoals(),
    enabled: isAuthenticated, // Only fetch when condition is true
    staleTime: 2 * 60 * 1000, // Data is fresh for 2 minutes
  });
};
```

### Query Options

| Option                 | Description                          | Recommended         |
| ---------------------- | ------------------------------------ | ------------------- |
| `queryKey`             | Unique identifier for cache          | Required            |
| `queryFn`              | Async function to fetch data         | Required            |
| `enabled`              | Conditional fetching                 | Use for auth checks |
| `staleTime`            | Time before data is considered stale | 1-5 min for most    |
| `refetchInterval`      | Auto-refetch interval                | Use sparingly       |
| `refetchOnWindowFocus` | Refetch when tab gains focus         | Web only            |

### Query Return Values

```tsx
const {
  data, // The cached data
  isLoading, // First load (no data yet)
  isFetching, // Any fetch in progress
  isError, // Query failed
  error, // Error object
  refetch, // Manual refetch function
} = useGoals();
```

## Mutations (Writing Data)

Mutations are for creating, updating, or deleting data.

### Basic Mutation (Without Optimistic Update)

```tsx
// ❌ Bad: No optimistic update - UI feels slow
export const useCreateGoal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (goal: CreateGoalRequest) => goalsService.createGoal(goal),
    onSuccess: () => {
      // User waits for this before seeing update
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.all });
    },
  });
};
```

Problem: User clicks "Create" → waits 500-2000ms → sees update. Feels laggy.

## Optimistic Updates

Optimistic updates show changes immediately before the server responds.

### The Pattern

1. User action (click button)
2. Immediately update UI (optimistic)
3. Send request to server
4. On success: Replace optimistic data with real data (optional)
5. On error: Rollback to previous state
6. On settled: Invalidate/refetch to sync with server truth

### Complete Example (Safer Temp Replacement)

Important: Don’t remove all temp- items on success. If multiple creates happen, you might delete other optimistic items. Instead, track the tempId created in onMutate.

```tsx
export const useCreateGoal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (goal: CreateGoalRequest) => goalsService.createGoal(goal),

    // 1️⃣ BEFORE the mutation runs
    onMutate: async (newGoal) => {
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.list() });

      const previousGoals = queryClient.getQueryData(goalsQueryKeys.list());

      const tempId = `temp-${Date.now()}`;
      const optimisticGoal = {
        id: tempId,
        ...newGoal,
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData(goalsQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: [...old.data, optimisticGoal] };
      });

      return { previousGoals, tempId };
    },

    // 2️⃣ If mutation FAILS
    onError: (_err, _newGoal, context) => {
      if (context?.previousGoals) {
        queryClient.setQueryData(goalsQueryKeys.list(), context.previousGoals);
      }
    },

    // 3️⃣ If mutation SUCCEEDS (optional immediate correction)
    onSuccess: (response, _newGoal, context) => {
      const realGoal = response?.data;
      if (!realGoal || !context?.tempId) return;

      queryClient.setQueryData(goalsQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((g: any) =>
            g.id === context.tempId ? realGoal : g
          ),
        };
      });
    },

    // 4️⃣ ALWAYS sync with server truth after
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.all });
    },
  });
};
```

### Why Optimistic Updates Matter

| Without Optimistic                 | With Optimistic                 |
| ---------------------------------- | ------------------------------- |
| Click → Wait 500ms-2s → See change | Click → See change instantly    |
| Feels slow and unresponsive        | Feels fast and native           |
| User may double-click              | Clear immediate feedback        |
| Poor perceived performance         | Excellent perceived performance |

## Supabase Realtime (Live Updates)

If you want changes to appear instantly when they happen outside this device (another user, Supabase dashboard, background job), use Supabase Realtime.

### Recommended Strategy: Subscribe → Invalidate

This is the simplest and safest approach:

- Subscribe to changes for a table (or filtered subset)

- When you get an event, invalidate the relevant queries

- React Query refetches and updates UI

### Advanced Strategy: Subscribe → Patch Cache

More complex, but can be faster:

- On event, update cached lists/details directly

- Still consider invalidating occasionally to ensure correctness

### Realtime Best Practices

- Subscribe only to what the current screen needs

- Prefer filtered subscriptions when possible

- Always consider RLS/policies (events should align with what user can read)

- Still invalidate on mutation settle (server truth)

## Mobile: Refetch on Foreground

Mobile apps often show stale data if the app was backgrounded. Many “real apps” refetch when the app becomes active again.

### Strategy

- Detect background -> active

- Invalidate key groups used across the app

- Optionally refetch only currently visible screen queries

This is especially useful if you’re testing by editing data in Supabase dashboard and then reopening the app.

## Best Practices

1. Always Use Query Key Factories

```tsx
// ✅ Good
export const checkInsQueryKeys = {
  all: ["checkIns"] as const,
  today: () => [...checkInsQueryKeys.all, "today"] as const,
  list: (goalId?: string) =>
    [...checkInsQueryKeys.all, "list", goalId] as const,
};

// ❌ Bad: Inline strings
queryClient.invalidateQueries({ queryKey: ["checkIns", "today"] });
```

2. Cancel Queries Before Optimistic Update

```tsx
onMutate: async () => {
  await queryClient.cancelQueries({ queryKey: goalsQueryKeys.list() });
  await queryClient.cancelQueries({ queryKey: goalsQueryKeys.active() });
};
```

3. Snapshot Previous Data for Rollback

```tsx
onMutate: async () => {
  const previousGoals = queryClient.getQueryData(goalsQueryKeys.list());
  const previousStats = queryClient.getQueryData(userQueryKeys.userStats());
  return { previousGoals, previousStats };
};
```

4. Use Temp IDs for Created Items (Replace Precisely)

```tsx
const tempId = `temp-${Date.now()}`;
const optimisticItem = { id: tempId, ...newData };

// On success: replace ONLY that tempId
old.data.map((item) => (item.id === tempId ? realItem : item));
```

5. Update All Related Caches

When creating a goal, update:

- Goals list

- Active goals

- User stats (counts)

```tsx
queryClient.setQueryData(goalsQueryKeys.list(), ...);
queryClient.setQueryData(goalsQueryKeys.active(), ...);
queryClient.setQueryData(userQueryKeys.userStats(), ...);
```

6. Invalidate After Settled for Server-Calculated Data

Some data needs server-side calculation (streaks, completion rates). Prefer onSettled:

```tsx
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: userQueryKeys.userStats() });
  queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.stats() });
};
```

7. Lists Must Be Deterministically Ordered

A common cause of “I created it but don’t see it” is missing ordering or pagination behavior.

- Always add explicit ordering for lists (e.g., by created_at).

- For paginated lists:

- prepend optimistic item to page 1, or

- invalidate/refetch the first page on settled.

8. Polling (Use Intentionally)

Polling is useful when realtime is overkill, but it costs battery/network.

- Use refetchInterval sparingly

- Avoid polling many queries at once

## Common Patterns

Pattern 1: Optimistic Create (With Precise Temp Replacement + Sync)

```tsx
onMutate: async (newItem) => {
  await queryClient.cancelQueries({ queryKey: itemsQueryKeys.list() });
  const previous = queryClient.getQueryData(itemsQueryKeys.list());

  const tempId = `temp-${Date.now()}`;
  queryClient.setQueryData(itemsQueryKeys.list(), (old: any) => ({
    ...old,
    data: [...(old?.data || []), { id: tempId, ...newItem }],
  }));

  return { previous, tempId };
},
onError: (_err, _newItem, context) => {
  queryClient.setQueryData(itemsQueryKeys.list(), context?.previous);
},
onSuccess: (response, _newItem, context) => {
  const realItem = response?.data;
  if (!realItem || !context?.tempId) return;

  queryClient.setQueryData(itemsQueryKeys.list(), (old: any) => ({
    ...old,
    data: old.data.map((i: any) => (i.id === context.tempId ? realItem : i)),
  }));
},
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: itemsQueryKeys.all });
}
```

Pattern 2: Optimistic Update

```tsx
onMutate: async ({ id, updates }) => {
  await queryClient.cancelQueries({ queryKey: itemsQueryKeys.list() });
  const previous = queryClient.getQueryData(itemsQueryKeys.list());

  queryClient.setQueryData(itemsQueryKeys.list(), (old: any) => ({
    ...old,
    data: old.data.map((item: any) => (item.id === id ? { ...item, ...updates } : item)),
  }));

  return { previous };
},
onError: (_err, _vars, context) => {
  queryClient.setQueryData(itemsQueryKeys.list(), context?.previous);
},
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: itemsQueryKeys.all });
}
```

Pattern 3: Optimistic Delete

```tsx
onMutate: async (id) => {
  await queryClient.cancelQueries({ queryKey: itemsQueryKeys.list() });
  const previous = queryClient.getQueryData(itemsQueryKeys.list());

  queryClient.setQueryData(itemsQueryKeys.list(), (old: any) => ({
    ...old,
    data: old.data.filter((item: any) => item.id !== id),
  }));

  return { previous };
},
onError: (_err, _id, context) => {
  queryClient.setQueryData(itemsQueryKeys.list(), context?.previous);
},
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: itemsQueryKeys.all });
}
```

Pattern 4: Optimistic Toggle (Like/Unlike, Follow/Unfollow)

```tsx
onMutate: async (postId) => {
  await queryClient.cancelQueries({ queryKey: socialQueryKeys.feed });
  const previous = queryClient.getQueryData(socialQueryKeys.feed);

  queryClient.setQueryData(socialQueryKeys.feed, (old: any) => ({
    ...old,
    data: old.data.map((post: any) =>
      post.id === postId
        ? {
            ...post,
            is_liked: !post.is_liked,
            likes_count: post.is_liked
              ? Math.max(0, post.likes_count - 1)
              : post.likes_count + 1,
          }
        : post
    ),
  }));

  return { previous };
},
onError: (_err, _postId, context) => {
  queryClient.setQueryData(socialQueryKeys.feed, context?.previous);
},
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: socialQueryKeys.all });
}
```

Pattern 5: Optimistic Button State in Infinite Queries (Request/Cancel/Accept)

When a user action changes a button state (e.g., "Request" → "Requested" → "Partner"), update the item's status immediately in infinite query pages:

```tsx
// Helper to update a user's status across all infinite query pages
const updateUserInInfiniteQuery = (
  queryClient: QueryClient,
  queryKey: readonly string[],
  userId: string,
  updates: { request_status: string; partnership_id?: string | null }
) => {
  queryClient.setQueryData(queryKey, (old: any) => {
    if (!old?.pages) return old;
    return {
      ...old,
      pages: old.pages.map((page: any) => ({
        ...page,
        users: page.users.map((user: any) =>
          user.id === userId ? { ...user, ...updates } : user
        ),
      })),
    };
  });
};

// Usage in mutation
export const useSendPartnerRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => partnersService.sendRequest(data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: partnersQueryKeys.all });

      const searchQueryState = queryClient.getQueriesData({
        queryKey: partnersQueryKeys.searchInfinite(""),
        exact: false,
      });
      const suggestedQueryState = queryClient.getQueriesData({
        queryKey: partnersQueryKeys.suggestedInfinite(),
      });

      const tempPartnershipId = `temp-${Date.now()}`;

      searchQueryState.forEach(([key]) => {
        updateUserInInfiniteQuery(
          queryClient,
          key as readonly string[],
          data.partner_user_id,
          { request_status: "sent", partnership_id: tempPartnershipId }
        );
      });

      updateUserInInfiniteQuery(
        queryClient,
        partnersQueryKeys.suggestedInfinite(),
        data.partner_user_id,
        { request_status: "sent", partnership_id: tempPartnershipId }
      );

      return { searchQueryState, suggestedQueryState };
    },
    onError: (_err, _data, context) => {
      context?.searchQueryState?.forEach(([key, value]: [any, any]) => {
        queryClient.setQueryData(key, value);
      });
      context?.suggestedQueryState?.forEach(([key, value]: [any, any]) => {
        queryClient.setQueryData(key, value);
      });
    },
    onSuccess: (response, data) => {
      const realId = response?.data?.id;
      if (!realId) return;

      updateUserInInfiniteQuery(
        queryClient,
        partnersQueryKeys.suggestedInfinite(),
        data.partner_user_id,
        { request_status: "sent", partnership_id: realId }
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: partnersQueryKeys.all });
    },
  });
};
```

## Checklist for New Hooks

When creating a new mutation hook, ensure:

- Query key factory exists for the entity

- onMutate cancels relevant queries

- onMutate snapshots previous data

- onMutate performs optimistic update

- onMutate returns context for rollback (include tempId if creating)

- onError rolls back all optimistic changes

- onSuccess replaces temp data with real data (precisely)

- onSettled invalidates relevant query groups

- Related caches are updated (counts, related lists)

- Lists are ordered deterministically (and pagination behavior is defined)

## File Locations

| File                           | Purpose                                     |
| ------------------------------ | ------------------------------------------- |
| `src/hooks/api/useGoals.ts`    | Goal mutations with optimistic updates      |
| `src/hooks/api/useCheckIns.ts` | Check-in mutations with optimistic updates  |
| `src/hooks/api/useSocial.ts`   | Social mutations (likes, follows, comments) |
| `src/hooks/api/useUser.ts`     | User profile and settings mutations         |
| `src/hooks/api/index.ts`       | Export all hooks                            |

## Debugging Tips

1. Enable React Query DevTools (Dev Only)

```tsx
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

<QueryClientProvider client={queryClient}>
  {children}
  <ReactQueryDevtools initialIsOpen={false} />
</QueryClientProvider>;
```

2. Log Cache State

```tsx
console.log("Current goals:", queryClient.getQueryData(goalsQueryKeys.list()));
```

3. Stale Data Triage

If “I changed the DB but I still see old data”:

- Are you changing data outside the app (Supabase dashboard)?
  → you need realtime, polling, or manual invalidation/refetch.

- Is enabled accidentally false?

- Is staleTime too long?

- Are you invalidating the correct query key?

- Is the list missing order by created_at or affected by pagination?

- Is the screen refetching when app returns to foreground?

4. Common Issues
   | Issue | Cause | Solution |
   | ----------------------------------- | ---------------------- | ------------------------------------------- |
   | Data not updating | Wrong query key | Use query key factory |
   | Duplicate items | Temp item not replaced | Replace by returned `tempId` |
   | Rollback not working | Missing context return | Always return context from `onMutate` |
   | Race condition | Didn’t cancel queries | Add `cancelQueries` in `onMutate` |
   | Doesn’t update after dashboard edit | No refetch/realtime | Add realtime / polling / foreground refetch |

## Summary

1. Queries are for reading; Mutations are for writing

2. Optimistic updates make the UI feel instant for user actions

3. React Query will not detect external DB edits unless you refetch/poll/realtime

4. Always use query key factories for consistency

5. Cancel queries before optimistic updates to prevent race conditions

6. Snapshot previous data for error rollback

7. Use precise temp replacement (do not delete all temp- items)

8. Always invalidate/refetch on settled for server truth (especially derived fields)

9. For mobile, add foreground refetch and/or Supabase Realtime for live updates
