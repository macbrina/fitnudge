# React Query Guide for FitNudge

This document explains how React Query (TanStack Query) is used in the FitNudge mobile app and why optimistic updates are critical for a great user experience.

## Table of Contents

1. [Why React Query?](#why-react-query)
2. [Core Concepts](#core-concepts)
3. [Query Keys Structure](#query-keys-structure)
4. [Queries (Reading Data)](#queries-reading-data)
5. [Mutations (Writing Data)](#mutations-writing-data)
6. [Optimistic Updates](#optimistic-updates)
7. [Best Practices](#best-practices)
8. [Common Patterns](#common-patterns)

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

---

## Query Keys Structure

Query keys are arrays that uniquely identify cached data. We use a factory pattern for consistency:

```typescript
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

```typescript
// Invalidates ALL goal queries (list, detail, active, stats)
queryClient.invalidateQueries({ queryKey: ["goals"] });

// Invalidates only the specific goal detail
queryClient.invalidateQueries({ queryKey: ["goals", "detail", "abc"] });
```

---

## Queries (Reading Data)

Queries are for **reading** data from the server.

### Basic Query

```typescript
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
| `refetchOnWindowFocus` | Refetch when tab gains focus         | Default: true       |

### Query Return Values

```typescript
const {
  data, // The cached data
  isLoading, // First load (no data yet)
  isFetching, // Any fetch in progress
  isError, // Query failed
  error, // Error object
  refetch, // Manual refetch function
} = useGoals();
```

---

## Mutations (Writing Data)

Mutations are for **creating, updating, or deleting** data.

### Basic Mutation (Without Optimistic Update)

```typescript
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

**Problem:** User clicks "Create" → waits 500-2000ms → sees update. Feels laggy.

---

## Optimistic Updates

Optimistic updates show changes **immediately** before the server responds.

### The Pattern

```
1. User action (click button)
2. Immediately update UI (optimistic)
3. Send request to server
4. On success: Replace optimistic data with real data
5. On error: Rollback to previous state
```

### Complete Example

```typescript
export const useCreateGoal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (goal: CreateGoalRequest) => goalsService.createGoal(goal),

    // 1️⃣ BEFORE the mutation runs
    onMutate: async (newGoal) => {
      // Cancel in-flight queries to prevent race conditions
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.list() });

      // Snapshot current data for potential rollback
      const previousGoals = queryClient.getQueryData(goalsQueryKeys.list());

      // Create optimistic goal with temporary ID
      const optimisticGoal = {
        id: `temp-${Date.now()}`,
        ...newGoal,
        created_at: new Date().toISOString(),
      };

      // Immediately add to cache (user sees it instantly!)
      queryClient.setQueryData(goalsQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: [...old.data, optimisticGoal] };
      });

      // Return context for rollback
      return { previousGoals };
    },

    // 2️⃣ If mutation FAILS
    onError: (err, newGoal, context) => {
      // Rollback to previous state
      if (context?.previousGoals) {
        queryClient.setQueryData(goalsQueryKeys.list(), context.previousGoals);
      }
    },

    // 3️⃣ If mutation SUCCEEDS
    onSuccess: (response) => {
      const realGoal = response?.data;
      if (realGoal) {
        // Replace temp goal with real one from server
        queryClient.setQueryData(goalsQueryKeys.list(), (old: any) => {
          if (!old?.data) return old;
          const filtered = old.data.filter(
            (g: any) => !g.id.startsWith("temp-")
          );
          return { ...old, data: [...filtered, realGoal] };
        });
      }
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

---

## Best Practices

### 1. Always Use Query Key Factories

```typescript
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

### 2. Cancel Queries Before Optimistic Update

```typescript
onMutate: async (data) => {
  // Prevent race conditions
  await queryClient.cancelQueries({ queryKey: goalsQueryKeys.list() });
  await queryClient.cancelQueries({ queryKey: goalsQueryKeys.active() });
  // ...
};
```

### 3. Snapshot Previous Data for Rollback

```typescript
onMutate: async (data) => {
  const previousGoals = queryClient.getQueryData(goalsQueryKeys.list());
  const previousStats = queryClient.getQueryData(userQueryKeys.userStats());

  // ... optimistic updates ...

  return { previousGoals, previousStats }; // For rollback
};
```

### 4. Use Temp IDs for Created Items

```typescript
const optimisticItem = {
  id: `temp-${Date.now()}`, // Temporary ID
  ...newData,
};

// Later, filter out temp items when real data arrives
const filtered = old.data.filter(
  (item: any) => !item.id?.startsWith?.("temp-")
);
```

### 5. Update All Related Caches

When creating a goal, update:

- Goals list
- Active goals
- User stats (counts)

```typescript
// Update list
queryClient.setQueryData(goalsQueryKeys.list(), ...);

// Update active goals
queryClient.setQueryData(goalsQueryKeys.active(), ...);

// Update stats
queryClient.setQueryData(userQueryKeys.userStats(), (old: any) => ({
  ...old,
  data: {
    ...old.data,
    total_goals: (old.data.total_goals || 0) + 1,
    active_goals: (old.data.active_goals || 0) + 1,
  },
}));
```

### 6. Invalidate After Success for Server-Calculated Data

Some data needs server-side calculation (streaks, completion rates):

```typescript
onSuccess: () => {
  // These need server recalculation
  queryClient.invalidateQueries({ queryKey: userQueryKeys.userStats() });
  queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.stats() });
};
```

---

## Common Patterns

### Pattern 1: Optimistic Create

```typescript
onMutate: async (newItem) => {
  await queryClient.cancelQueries({ queryKey: itemsQueryKeys.list() });
  const previous = queryClient.getQueryData(itemsQueryKeys.list());

  queryClient.setQueryData(itemsQueryKeys.list(), (old: any) => ({
    ...old,
    data: [...(old?.data || []), { id: `temp-${Date.now()}`, ...newItem }],
  }));

  return { previous };
},
onError: (_, __, context) => {
  queryClient.setQueryData(itemsQueryKeys.list(), context?.previous);
},
onSuccess: (response) => {
  queryClient.setQueryData(itemsQueryKeys.list(), (old: any) => ({
    ...old,
    data: old.data.filter((i: any) => !i.id?.startsWith?.("temp-")).concat(response.data),
  }));
}
```

### Pattern 2: Optimistic Update

```typescript
onMutate: async ({ id, updates }) => {
  await queryClient.cancelQueries({ queryKey: itemsQueryKeys.list() });
  const previous = queryClient.getQueryData(itemsQueryKeys.list());

  queryClient.setQueryData(itemsQueryKeys.list(), (old: any) => ({
    ...old,
    data: old.data.map((item: any) =>
      item.id === id ? { ...item, ...updates } : item
    ),
  }));

  return { previous };
},
onError: (_, __, context) => {
  queryClient.setQueryData(itemsQueryKeys.list(), context?.previous);
}
```

### Pattern 3: Optimistic Delete

```typescript
onMutate: async (id) => {
  await queryClient.cancelQueries({ queryKey: itemsQueryKeys.list() });
  const previous = queryClient.getQueryData(itemsQueryKeys.list());

  queryClient.setQueryData(itemsQueryKeys.list(), (old: any) => ({
    ...old,
    data: old.data.filter((item: any) => item.id !== id),
  }));

  return { previous };
},
onError: (_, __, context) => {
  queryClient.setQueryData(itemsQueryKeys.list(), context?.previous);
}
```

### Pattern 4: Optimistic Toggle (Like/Unlike, Follow/Unfollow)

```typescript
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
};
```

---

## Checklist for New Hooks

When creating a new mutation hook, ensure:

- [ ] Query key factory exists for the entity
- [ ] `onMutate` cancels relevant queries
- [ ] `onMutate` snapshots previous data
- [ ] `onMutate` performs optimistic update
- [ ] `onMutate` returns context for rollback
- [ ] `onError` rolls back all optimistic changes
- [ ] `onSuccess` replaces temp data with real data
- [ ] `onSuccess` invalidates server-calculated fields
- [ ] Related caches are updated (counts, related lists)

---

## File Locations

| File                           | Purpose                                     |
| ------------------------------ | ------------------------------------------- |
| `src/hooks/api/useGoals.ts`    | Goal mutations with optimistic updates      |
| `src/hooks/api/useCheckIns.ts` | Check-in mutations with optimistic updates  |
| `src/hooks/api/useSocial.ts`   | Social mutations (likes, follows, comments) |
| `src/hooks/api/useUser.ts`     | User profile and settings mutations         |
| `src/hooks/api/index.ts`       | Export all hooks                            |

---

## Debugging Tips

### 1. Enable React Query DevTools (Dev Only)

```tsx
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

<QueryClientProvider client={queryClient}>
  {children}
  <ReactQueryDevtools initialIsOpen={false} />
</QueryClientProvider>;
```

### 2. Log Cache State

```typescript
console.log("Current goals:", queryClient.getQueryData(goalsQueryKeys.list()));
```

### 3. Common Issues

| Issue                | Cause                  | Solution                                 |
| -------------------- | ---------------------- | ---------------------------------------- |
| Data not updating    | Wrong query key        | Use query key factory                    |
| Duplicate items      | No temp ID filtering   | Filter `temp-` prefix in onSuccess       |
| Rollback not working | Missing context return | Always return `{ previous }` in onMutate |
| Race condition       | Didn't cancel queries  | Add `cancelQueries` in onMutate          |

---

## Summary

1. **Queries** are for reading data; **Mutations** are for writing
2. **Optimistic updates** make the UI feel instant
3. Always use **query key factories** for consistency
4. **Cancel queries** before optimistic updates to prevent race conditions
5. **Snapshot previous data** for error rollback
6. **Update all related caches** (lists, details, counts)
7. **Invalidate** server-calculated fields on success
