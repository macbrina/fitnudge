/**
 * Prefetch Service
 *
 * Handles prefetching critical data during the splash screen so that
 * when users navigate through the app, data is already available.
 *
 * This eliminates loading spinners on first navigation to screens.
 *
 * @see docs/PREFETCH_CACHE_STRATEGY.md for full documentation
 */

import { QueryClient } from "@tanstack/react-query";
import { homeService } from "@/services/api";
import { userService } from "@/services/api/user";
import { achievementsService } from "@/services/api";
import { goalsService } from "@/services/api";
import { exercisesService } from "@/services/api/exercises";
import { audioPreferencesService } from "@/services/api/audioPreferences";
import { notificationsService } from "@/services/api/notifications";

// Import query keys for consistency with hooks
import { homeDashboardQueryKeys } from "@/hooks/api/useHomeDashboard";
import { userQueryKeys } from "@/hooks/api/useUser";
import { achievementsQueryKeys } from "@/hooks/api/useAchievements";
import { goalsQueryKeys } from "@/hooks/api/queryKeys";
import { exercisesQueryKeys } from "@/hooks/api/useExercises";
import { notificationHistoryQueryKeys } from "@/hooks/api/useNotificationHistory";

/**
 * Configuration for each prefetchable query
 *
 * IMPORTANT: When adding new prefetch queries, ensure:
 * 1. The queryKey matches EXACTLY what the hook uses
 * 2. The queryFn returns the same data shape as the hook
 * 3. You set appropriate staleTime for the data type
 */
interface PrefetchConfig {
  queryKey: readonly unknown[];
  queryFn: () => Promise<unknown>;
  staleTime: number;
  description: string;
  priority: "critical" | "high" | "normal";
  isInfinite?: boolean; // For infinite queries
}

/**
 * Get user's timezone for API calls that need it
 */
const getUserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
};

/**
 * All prefetchable queries configuration
 *
 * Add new queries here to have them prefetched during splash screen.
 * Group by priority:
 * - critical: Must complete before app loads (home screen data)
 * - high: Should complete but won't block app (profile, goals)
 * - normal: Nice to have, runs after high priority
 */
const getPrefetchConfigs = (): PrefetchConfig[] => {
  const timezone = getUserTimezone();

  return [
    // ==================== CRITICAL PRIORITY ====================
    // These are for the first screen users see (Home tab)

    {
      queryKey: homeDashboardQueryKeys.dashboard(),
      queryFn: async () => {
        const response = await homeService.getDashboard(timezone);
        if (response.error) throw new Error(response.error);
        return response.data;
      },
      staleTime: 1 * 60 * 1000, // 1 minute
      description: "Home dashboard (items, stats, pending check-ins)",
      priority: "critical"
    },

    // ==================== HIGH PRIORITY ====================
    // These are for commonly accessed screens

    {
      queryKey: userQueryKeys.currentUser,
      queryFn: async () => {
        const response = await userService.getCurrentUser();
        return response;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      description: "Current user profile",
      priority: "high"
    },

    {
      queryKey: userQueryKeys.userStats(),
      queryFn: async () => {
        const response = await userService.getUserStats();
        return response;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      description: "User stats (streak, goals count, check-ins)",
      priority: "high"
    },

    {
      queryKey: goalsQueryKeys.active(),
      queryFn: async () => {
        const response = await goalsService.getActiveGoals();
        return response;
      },
      staleTime: 2 * 60 * 1000, // 2 minutes
      description: "Active goals list for Goals tab",
      priority: "high"
    },

    {
      queryKey: achievementsQueryKeys.myAchievements(),
      queryFn: async () => {
        const response = await achievementsService.getMyAchievements();
        return response;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      description: "User's unlocked achievements",
      priority: "high"
    },

    {
      queryKey: notificationHistoryQueryKeys.list(),
      queryFn: async () => {
        const response = await notificationsService.getHistory(20, 0);
        if (response.error) throw new Error(response.error);
        return response.data;
      },
      staleTime: 1 * 60 * 1000, // 1 minute (notifications change frequently)
      description: "Notification history for Notifications tab",
      priority: "high",
      isInfinite: true // Flag for infinite query
    },

    // ==================== NORMAL PRIORITY ====================
    // These are for less frequently accessed features

    {
      queryKey: exercisesQueryKeys.popular(20),
      queryFn: async () => {
        const response = await exercisesService.getPopularExercises(20);
        return response;
      },
      staleTime: 24 * 60 * 60 * 1000, // 24 hours (exercises rarely change)
      description: "Popular exercises for workout picker",
      priority: "normal"
    },

    {
      queryKey: ["audio-preferences"],
      queryFn: async () => {
        const response = await audioPreferencesService.getPreferences();
        return response;
      },
      staleTime: 60 * 60 * 1000, // 1 hour
      description: "Audio preferences for workout player",
      priority: "normal"
    }
  ];
};

/**
 * Prefetch all critical data during splash screen
 *
 * This function is called from index.tsx after user authentication is verified.
 * It runs all prefetch queries in parallel, grouped by priority.
 *
 * @param queryClient - The React Query client instance
 * @returns Promise that resolves when critical + high priority prefetching is done
 */
export async function prefetchCriticalData(queryClient: QueryClient): Promise<void> {
  const configs = getPrefetchConfigs();

  // Group configs by priority
  const critical = configs.filter((c) => c.priority === "critical");
  const high = configs.filter((c) => c.priority === "high");
  const normal = configs.filter((c) => c.priority === "normal");

  console.log(
    `[Prefetch] Starting prefetch: ${critical.length} critical, ${high.length} high, ${normal.length} normal`
  );

  const prefetchOne = async (config: PrefetchConfig): Promise<void> => {
    try {
      if (config.isInfinite) {
        // Use prefetchInfiniteQuery for infinite queries
        await queryClient.prefetchInfiniteQuery({
          queryKey: config.queryKey,
          queryFn: config.queryFn,
          staleTime: config.staleTime,
          initialPageParam: 0
        });
      } else {
        await queryClient.prefetchQuery({
          queryKey: config.queryKey,
          queryFn: config.queryFn,
          staleTime: config.staleTime
        });
      }
      console.log(`[Prefetch] ✓ ${config.description}`);
    } catch (error) {
      // Log but don't fail - prefetch is best-effort
      console.warn(`[Prefetch] ✗ ${config.description}:`, error);
    }
  };

  // Run critical queries first (must complete)
  await Promise.all(critical.map(prefetchOne));

  // Run high priority in parallel (should complete but don't block)
  await Promise.all(high.map(prefetchOne));

  // Fire off normal priority but don't wait for them
  // They'll complete in background while user starts using the app
  Promise.all(normal.map(prefetchOne)).catch(() => {
    // Silently ignore - normal priority failures are fine
  });

  console.log("[Prefetch] Critical and high priority prefetch complete");
}

/**
 * Prefetch a specific query manually
 *
 * Use this to prefetch data before navigation, e.g.:
 * - Prefetch goal details when user hovers over a goal card
 * - Prefetch challenge data when user opens challenges tab
 *
 * @param queryClient - The React Query client instance
 * @param queryKey - The query key to prefetch
 * @param queryFn - The function to fetch the data
 * @param staleTime - How long the data should be considered fresh
 */
export async function prefetchQuery<T>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  staleTime: number = 5 * 60 * 1000
): Promise<void> {
  try {
    await queryClient.prefetchQuery({
      queryKey,
      queryFn,
      staleTime
    });
  } catch (error) {
    console.warn(`[Prefetch] Failed to prefetch ${queryKey.join("/")}:`, error);
  }
}

/**
 * Check if a query is already cached and fresh
 *
 * Use this to avoid unnecessary prefetches
 */
export function isQueryFresh(queryClient: QueryClient, queryKey: readonly unknown[]): boolean {
  const state = queryClient.getQueryState(queryKey);
  if (!state || !state.data) return false;

  const staleTime = 5 * 60 * 1000; // Default 5 minutes
  const isStale = Date.now() - state.dataUpdatedAt > staleTime;

  return !isStale;
}
