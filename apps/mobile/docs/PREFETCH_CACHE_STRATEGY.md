# Prefetch & Cache Strategy

> **Purpose**: Eliminate loading spinners when navigating through the app by prefetching critical data during the splash screen and persisting cache across app restarts.

## Table of Contents

- [Overview](#overview)
- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Adding New Prefetch Queries](#adding-new-prefetch-queries)
- [Query Priority Levels](#query-priority-levels)
- [Cache Settings Guide](#cache-settings-guide)
- [Files Involved](#files-involved)
- [Optimistic Updates](#optimistic-updates)
- [Troubleshooting](#troubleshooting)

---

## Overview

### The Problem

Without prefetching, users see loading spinners every time they navigate to a new screen:

```
App Start → Home (loading...) → Profile (loading...) → Goals (loading...)
```

### The Solution

Prefetch all critical data during the splash screen, then users see instant data:

```
Splash Screen (loading all data) → Home (instant) → Profile (instant) → Goals (instant)
```

### Key Benefits

1. **No loading spinners** on first navigation to screens
2. **Instant data on app restart** - cache persists to disk via MMKV
3. **Background refresh** - stale data shows immediately while fresh data loads
4. **30x faster** than AsyncStorage for cache operations

### Two-Part Strategy

To achieve truly instant UI, we use TWO techniques together:

1. **Prefetching** - Load data during splash screen
2. **placeholderData** - Show empty state instead of loading spinners

```typescript
// In hooks: Use placeholderData to prevent loading spinners
export const useHomeDashboard = () => {
  return useQuery({
    queryKey: ["home", "dashboard"],
    queryFn: () => homeService.getDashboard(),
    staleTime: 1 * 60 * 1000,
    refetchOnMount: false, // Don't force refetch if cached
    placeholderData: {
      // Show this instead of loading spinner
      items: [],
      stats: { active_count: 0, current_streak: 0 },
    },
  });
};
```

**Why both?**

- Prefetch populates cache during splash → data ready when screens mount
- placeholderData prevents loading spinners if prefetch didn't complete
- Result: UI always renders immediately, either with real data or empty state

### Hooks with placeholderData

The following hooks have `placeholderData` configured to show empty states instead of loading spinners:

| Hook                                                                 | File                     | placeholderData                             |
| -------------------------------------------------------------------- | ------------------------ | ------------------------------------------- |
| `useHomeDashboard`                                                   | `useHomeDashboard.ts`    | Empty items array, zero stats               |
| `useGoals`, `useActiveGoals`                                         | `useGoals.ts`            | `{ data: [], total: 0 }`                    |
| `useChallenges`, `useMyChallenges`, `usePublicChallenges`            | `useChallenges.ts`       | `{ data: [], total: 0 }`                    |
| `useCurrentUser`                                                     | `useUser.ts`             | `{ data: null }`                            |
| `useUserStats`                                                       | `useUser.ts`             | Zero stats object                           |
| `useCheckIns`, `useTodayCheckIns`                                    | `useCheckIns.ts`         | `{ data: [] }`                              |
| `useCheckInStats`                                                    | `useCheckIns.ts`         | Zero stats object                           |
| `useAchievementTypes`, `useMyAchievements`                           | `useAchievements.ts`     | `{ data: [] }`                              |
| `useAchievementStats`                                                | `useAchievements.ts`     | Zero stats object                           |
| `usePartners`, `usePendingPartnerRequests`, `useSentPartnerRequests` | `usePartners.ts`         | `{ data: [] }`                              |
| `useSearchPartners`                                                  | `usePartners.ts`         | `{ data: [], total: 0 }`                    |
| `useStreakInfo`                                                      | `useProgressData.ts`     | `{ current_streak: 0, longest_streak: 0 }`  |
| `useWeekProgress`, `useMoodTrends`, `useHabitChain`                  | `useProgressData.ts`     | `[]`                                        |
| `useTodayDailyMotivation`                                            | `useDailyMotivations.ts` | Empty motivation object                     |
| `useDailyMotivations`                                                | `useDailyMotivations.ts` | `[]`                                        |
| `useNudges`, `useSentNudges`                                         | `useNudges.ts`           | `{ data: [] }`                              |
| `useUnreadNudgesCount`                                               | `useNudges.ts`           | `{ data: { unread_count: 0 } }`             |
| `useFeed`, `useTrendingPosts`, `useNotifications`                    | `useSocial.ts`           | `{ data: [], total: 0 }`                    |
| `useTrendingHashtags`                                                | `useSocial.ts`           | `{ data: [] }`                              |
| `useReferralCode`                                                    | `useReferral.ts`         | `{ data: { code: "", referral_link: "" } }` |
| `useMyReferrals`                                                     | `useReferral.ts`         | `{ data: [] }`                              |
| `usePopularExercises`, `useSearchExercises`                          | `useExercises.ts`        | `{ data: [], total: 0 }`                    |
| `useAudioPreferences`                                                | `useAudioPreferences.ts` | Default audio settings object               |
| `useWorkoutMusic`                                                    | `useWorkoutMusic.ts`     | `[]`                                        |

### Hooks WITHOUT placeholderData (by design)

| Hook                               | Reason                                                   |
| ---------------------------------- | -------------------------------------------------------- |
| `usePlanStatus`                    | Uses polling with `staleTime: 0`, needs real-time status |
| `useSuggestedGoalsStatus`          | Uses polling, needs real-time status                     |
| `useExerciseDetails(id)`           | Detail views are acceptable to show loading              |
| `usePost(postId)`                  | Detail views are acceptable to show loading              |
| `useUserProfile(userId)`           | Detail views are acceptable to show loading              |
| `useComments(postId)`              | Detail views are acceptable to show loading              |
| `useFollowers`, `useFollowing`     | Secondary screens                                        |
| `useSearchUsers`, `useSearchPosts` | Search results need real data                            |

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────────┐
│                        APP STARTUP FLOW                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. _layout.tsx mounts                                              │
│     └─→ PersistQueryClientProvider loads cached data from MMKV     │
│         (Cached data is INSTANTLY available)                        │
│                                                                     │
│  2. index.tsx initializes                                           │
│     ├─→ Verify user authentication                                  │
│     ├─→ If authenticated, call prefetchCriticalData()               │
│     │   ├─→ Critical priority: Home dashboard (blocks splash)       │
│     │   ├─→ High priority: User profile, goals, stats (blocks)      │
│     │   └─→ Normal priority: Exercises, audio prefs (background)    │
│     └─→ Navigate to main app                                        │
│                                                                     │
│  3. User navigates through app                                      │
│     └─→ All data already in cache = NO LOADING SPINNERS             │
│                                                                     │
│  4. Cache automatically persists to MMKV on changes                 │
│     └─→ Next app launch = instant data from persisted cache         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Architecture

### Files Structure

```
apps/mobile/src/
├── lib/
│   └── queryClient.ts          # QueryClient + MMKV persistence setup
├── services/
│   └── prefetch.ts             # Prefetch service with all queries
├── app/
│   ├── _layout.tsx             # PersistQueryClientProvider wrapper
│   └── index.tsx               # Calls prefetchCriticalData() on startup
└── hooks/api/
    └── *.ts                    # Individual hooks (use same query keys!)
```

### Data Flow

```
                    ┌──────────────┐
                    │   MMKV Disk  │
                    │   Storage    │
                    └──────┬───────┘
                           │ hydrate on start
                           │ persist on change
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                     React Query Cache                         │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ ["home",    │  │ ["user",    │  │ ["goals",   │  ...     │
│  │ "dashboard"]│  │ "current"]  │  │ "active"]   │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│         ▲                ▲                ▲                  │
│         │                │                │                  │
└─────────┼────────────────┼────────────────┼──────────────────┘
          │                │                │
          │ prefetch       │ prefetch       │ prefetch
          │                │                │
    ┌─────┴────────────────┴────────────────┴─────┐
    │           prefetchCriticalData()            │
    │         (called during splash screen)        │
    └─────────────────────────────────────────────┘
```

---

## Adding New Prefetch Queries

### Step-by-Step Guide

When you need to add a new query to be prefetched during splash:

#### 1. Locate the existing hook

Find the hook that fetches this data. Example: `useHomeDashboard` in `hooks/api/useHomeDashboard.ts`:

```typescript
// hooks/api/useHomeDashboard.ts
export const homeDashboardQueryKeys = {
  all: ["home"] as const,
  dashboard: () => [...homeDashboardQueryKeys.all, "dashboard"] as const,
};

export const useHomeDashboard = () => {
  return useQuery({
    queryKey: homeDashboardQueryKeys.dashboard(), // ← This is the key!
    queryFn: async () => {
      const response = await homeService.getDashboard(timezone);
      return response.data;
    },
    staleTime: 1 * 60 * 1000,
  });
};
```

#### 2. Add to prefetch.ts

Open `services/prefetch.ts` and add your query to `getPrefetchConfigs()`:

```typescript
// services/prefetch.ts

import { homeDashboardQueryKeys } from "@/hooks/api/useHomeDashboard";
import { homeService } from "@/services/api";

const getPrefetchConfigs = (): PrefetchConfig[] => {
  return [
    // ... existing configs ...

    // ADD YOUR NEW QUERY HERE:
    {
      queryKey: homeDashboardQueryKeys.dashboard(), // MUST match hook exactly!
      queryFn: async () => {
        const response = await homeService.getDashboard(timezone);
        if (response.error) throw new Error(response.error);
        return response.data; // MUST return same shape as hook!
      },
      staleTime: 1 * 60 * 1000, // Match the hook's staleTime
      description: "Home dashboard data", // For logging
      priority: "critical", // critical | high | normal
    },
  ];
};
```

#### 3. Critical Rules

| Rule                                 | Why                                                       |
| ------------------------------------ | --------------------------------------------------------- |
| **queryKey MUST match exactly**      | If keys differ, prefetched data won't be used by the hook |
| **queryFn return shape MUST match**  | Hooks expect a specific data structure                    |
| **Import the service, not the hook** | We call the service directly, not the hook                |
| **Set appropriate priority**         | Critical blocks splash, normal runs in background         |

### Example: Adding Challenge Prefetch

```typescript
// 1. Find the hook in hooks/api/useChallenges.ts
export const useMyChallenges = (status?: string) => {
  return useQuery({
    queryKey: [...challengesQueryKeys.list(), "my", status],
    queryFn: () => challengesService.getMyChallenges(status),
    staleTime: 2 * 60 * 1000,
  });
};

// 2. Add to prefetch.ts
{
  queryKey: [...challengesQueryKeys.list(), "my", undefined], // Match default params!
  queryFn: async () => {
    const response = await challengesService.getMyChallenges();
    return response;
  },
  staleTime: 2 * 60 * 1000,
  description: "User's challenges",
  priority: "high",
},
```

---

## Query Priority Levels

| Priority   | Behavior                                                 | Use For                                 |
| ---------- | -------------------------------------------------------- | --------------------------------------- |
| `critical` | **Blocks splash screen** - App won't load until complete | Home screen data, essential UI data     |
| `high`     | **Blocks splash screen** - Runs after critical           | Profile, goals, stats - commonly viewed |
| `normal`   | **Runs in background** - Doesn't block splash            | Exercises, settings - less urgent       |

### Priority Guidelines

```typescript
// CRITICAL: First screen users see
{ priority: "critical", ... } // Home dashboard

// HIGH: Screens users navigate to often
{ priority: "high", ... } // Profile, Goals, Stats, Achievements

// NORMAL: Features used occasionally
{ priority: "normal", ... } // Exercise library, Audio settings, Challenges
```

---

## Cache Settings Guide

### staleTime vs gcTime

| Setting     | What It Does                        | Recommended Values                       |
| ----------- | ----------------------------------- | ---------------------------------------- |
| `staleTime` | How long before refetching on mount | 1-5 min for dynamic data, 24h for static |
| `gcTime`    | How long to keep unused data        | 24 hours (for persistence)               |

### Recommended staleTime by Data Type

| Data Type         | staleTime  | Reasoning                              |
| ----------------- | ---------- | -------------------------------------- |
| Home dashboard    | 1 minute   | Changes frequently, user expects fresh |
| User profile      | 5 minutes  | Changes rarely                         |
| Goals list        | 2 minutes  | User may create/complete goals         |
| Exercises         | 24 hours   | Static data, rarely changes            |
| Achievement types | 30 minutes | Static reference data                  |
| User stats        | 5 minutes  | Changes on check-ins                   |
| Audio preferences | 1 hour     | User settings, rarely change           |

### Setting staleTime in Hooks

```typescript
// In your hook (hooks/api/useExercises.ts)
export const useExerciseDetails = (exerciseId: string) => {
  return useQuery({
    queryKey: exercisesQueryKeys.detail(exerciseId),
    queryFn: () => exercisesService.getExerciseById(exerciseId),
    staleTime: 60 * 60 * 1000, // 1 hour - exercises don't change
    gcTime: 24 * 60 * 60 * 1000, // Keep in cache 24 hours
  });
};
```

---

## Files Involved

### `/src/lib/queryClient.ts`

**Purpose**: Central QueryClient configuration with MMKV persistence

**Key Exports**:

- `queryClient` - The singleton React Query client
- `queryPersister` - MMKV-based persister for cache
- `clearQueryCache()` - Call on logout to clear all data

**When to Modify**:

- Changing default cache settings
- Adding encryption to cache
- Changing persistence throttle time

### `/src/services/prefetch.ts`

**Purpose**: Defines what data to prefetch during splash screen

**Key Exports**:

- `prefetchCriticalData(queryClient)` - Main function called during splash
- `prefetchQuery()` - Utility for manual prefetching
- `isQueryFresh()` - Check if cached data is still fresh

**When to Modify**:

- Adding new queries to prefetch
- Changing query priorities
- Adding new data to splash loading

### `/src/app/_layout.tsx`

**Purpose**: Wraps app with PersistQueryClientProvider

**Key Changes Made**:

- Uses `PersistQueryClientProvider` instead of `QueryClientProvider`
- Imports `queryClient` and `queryPersister` from `@/lib/queryClient`

**When to Modify**:

- Rarely - only if changing provider structure

### `/src/app/index.tsx`

**Purpose**: Splash screen logic, calls prefetch

**Key Changes Made**:

- Imports `prefetchCriticalData` and `queryClient`
- Calls `prefetchCriticalData(queryClient)` after user verification

**When to Modify**:

- If prefetch should happen at a different point
- If adding splash screen progress indicator

---

## Optimistic Updates

### Do Optimistic Updates Still Work?

**YES!** Prefetching and optimistic updates work together perfectly.

Prefetching just **pre-populates** the cache. Optimistic updates **manipulate** that same cache. They're complementary:

```
┌─────────────────────────────────────────────────────────────┐
│                     React Query Cache                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Prefetch:          Puts data INTO cache on app start       │
│  useQuery:          Reads data FROM cache                   │
│  Optimistic Update: Modifies data IN cache immediately      │
│                                                             │
│  They all operate on the SAME cache!                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Example Flow

```
1. App starts
2. prefetchCriticalData() fetches goals → Cache: [goal1, goal2]
3. User navigates to Goals screen → Shows instantly (from cache)
4. User creates goal3 → Optimistic update → Cache: [goal1, goal2, goal3]
5. Server confirms → Cache updated with real goal3 data
6. User closes app
7. Cache persists to MMKV
8. User reopens app → Cache hydrated → [goal1, goal2, goal3] instant!
```

---

## Troubleshooting

### Data Not Appearing Instantly

**Check 1**: Query key mismatch

```typescript
// In hook
queryKey: ["goals", "active"];

// In prefetch - WRONG!
queryKey: ["goals", "list", "active"];

// In prefetch - CORRECT!
queryKey: ["goals", "active"];
```

**Check 2**: Data shape mismatch

```typescript
// Hook expects
{ data: Goal[], status: number }

// Prefetch returns - WRONG!
Goal[]

// Prefetch returns - CORRECT!
{ data: Goal[], status: number }
```

### Cache Not Persisting

**Check 1**: MMKV initialization

```typescript
// In queryClient.ts - ensure this doesn't throw
const queryStorage = createMMKV({
  id: "react-query-cache",
});
```

**Check 2**: gcTime too short

```typescript
// Default should be 24 hours for persistence
gcTime: 24 * 60 * 60 * 1000,
```

### Stale Data Showing

**Solution**: Reduce staleTime or invalidate on specific actions

```typescript
// In mutation onSuccess
queryClient.invalidateQueries({ queryKey: ["goals"] });
```

### Memory Issues

**Solution**: Limit what gets persisted

```typescript
// In queryClient.ts, can add dehydrate options
export const queryPersister = createSyncStoragePersister({
  storage: mmkvStorageAdapter,
  throttleTime: 1000,
  key: "REACT_QUERY_OFFLINE_CACHE",
  // Can add serialize/deserialize to filter what persists
});
```

---

## Quick Reference

### Add a New Prefetch Query

1. Find the hook's `queryKey` and `queryFn`
2. Add config to `getPrefetchConfigs()` in `services/prefetch.ts`
3. Match queryKey exactly, return same data shape
4. Set appropriate priority and staleTime

### Clear Cache on Logout

```typescript
import { clearQueryCache } from "@/lib/queryClient";

const handleLogout = () => {
  clearQueryCache(); // Clears React Query + MMKV
  // ... rest of logout logic
};
```

### Manual Prefetch Before Navigation

```typescript
import { prefetchQuery } from "@/services/prefetch";
import { queryClient } from "@/lib/queryClient";

// Before navigating to goal details
await prefetchQuery(
  queryClient,
  goalsQueryKeys.detail(goalId),
  () => goalsService.getGoal(goalId),
  2 * 60 * 1000
);

router.push(`/goals/${goalId}`);
```

---

## Summary

| What             | Where                  | When to Modify              |
| ---------------- | ---------------------- | --------------------------- |
| Cache settings   | `lib/queryClient.ts`   | Changing defaults           |
| Prefetch queries | `services/prefetch.ts` | Adding new data to prefetch |
| Provider setup   | `app/_layout.tsx`      | Rarely                      |
| Prefetch trigger | `app/index.tsx`        | Changing when prefetch runs |

**Remember**: The key to instant navigation is ensuring **query keys match exactly** between prefetch and hooks!
