/**
 * Prefetch Service - V2 Simplified
 *
 * Handles prefetching critical data during the splash screen so that
 * when users navigate through the app, data is already available.
 */

import { QueryClient } from "@tanstack/react-query";
import { homeService } from "@/services/api";
import { userService } from "@/services/api/user";
import { achievementsService } from "@/services/api";
import { goalsService } from "@/services/api";
import { dailyMotivationService } from "@/services/api";
import { notificationsService } from "@/services/api/notifications";

import { homeDashboardQueryKeys } from "@/hooks/api/useHomeDashboard";
import { userQueryKeys } from "@/hooks/api/useUser";
import { achievementsQueryKeys } from "@/hooks/api/useAchievements";
import { dailyMotivationsQueryKeys } from "@/hooks/api/useDailyMotivations";
import { goalsQueryKeys, partnersQueryKeys } from "@/hooks/api/queryKeys";
import { notificationHistoryQueryKeys } from "@/hooks/api/useNotificationHistory";
import { partnersService } from "@/services/api/partners";
import { logger } from "@/services/logger";

// =====================================================
// Coordinated Initialization (prevents duplicate fetches)
// =====================================================

// Module-level promise for deduplication - shared across imports
let initializationPromise: Promise<void> | null = null;

/**
 * Initialize authenticated user data with deduplication.
 *
 * This function coordinates between index.tsx and _layout.tsx to prevent
 * duplicate fetches when both try to initialize at the same time.
 *
 * - First caller starts the fetch and stores the promise
 * - Subsequent callers await the existing promise instead of starting new fetches
 * - Safe to call from multiple places (index.tsx, _layout.tsx deep links, etc.)
 */
export async function initializeAuthenticatedData(queryClient: QueryClient): Promise<void> {
  // If already initializing, wait for that instead of starting new
  if (initializationPromise) {
    logger.debug("[Prefetch] Initialization already in progress, waiting...");
    return initializationPromise;
  }

  // Dynamic imports to avoid circular dependencies
  const [{ useSubscriptionStore }, { usePricingStore }] = await Promise.all([
    import("@/stores/subscriptionStore"),
    import("@/stores/pricingStore")
  ]);

  // Check if already loaded (from previous init or cache)
  const hasSubscription = useSubscriptionStore.getState().subscription !== null;
  const hasFeatures = useSubscriptionStore.getState().features !== null;
  const hasPricing = usePricingStore.getState().plans.length > 0;

  if (hasSubscription && hasFeatures && hasPricing) {
    logger.debug("[Prefetch] Data already loaded, skipping initialization");
    return; // Already loaded, skip
  }

  logger.info("[Prefetch] Starting authenticated data initialization...");

  initializationPromise = (async () => {
    try {
      // Fetch subscription data, features, history, pricing plans,
      // AND prefetch critical React Query data in parallel
      await Promise.all([
        useSubscriptionStore.getState().fetchSubscription(),
        useSubscriptionStore.getState().fetchFeatures(),
        useSubscriptionStore.getState().fetchHistory(),
        usePricingStore.getState().fetchPlans(),
        prefetchCriticalData(queryClient)
      ]);

      // Prefetch high priority data (partners, motivation, achievements)
      // Don't await - let it run in background
      prefetchHighPriorityData(queryClient).catch(() => {
        // Silently ignore errors - these are not critical
      });

      logger.info("[Prefetch] Authenticated data initialization complete");
    } finally {
      // Clear promise so future calls can run again if needed
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}

/**
 * Refresh authenticated user data (for foreground resume).
 *
 * Unlike initializeAuthenticatedData, this always refetches regardless of cache.
 * Used when app comes to foreground to ensure fresh data.
 */
export async function refreshAuthenticatedData(queryClient: QueryClient): Promise<void> {
  const [{ useSubscriptionStore }, { usePricingStore }] = await Promise.all([
    import("@/stores/subscriptionStore"),
    import("@/stores/pricingStore")
  ]);

  const hasPricing = usePricingStore.getState().plans.length > 0;

  await Promise.all([
    useSubscriptionStore.getState().fetchSubscription(),
    useSubscriptionStore.getState().fetchFeatures(),
    useSubscriptionStore.getState().fetchHistory(),
    !hasPricing ? usePricingStore.getState().fetchPlans() : Promise.resolve(),
    prefetchCriticalData(queryClient)
  ]);

  prefetchHighPriorityData(queryClient).catch(() => {
    // Silently ignore errors - these are not critical
  });
}

/**
 * Get user's timezone for API calls
 */
function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Prefetch configuration
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
 * Define prefetch queries for V2
 */
function getPrefetchConfigs(): PrefetchConfig[] {
  const timezone = getUserTimezone();

  return [
    // Critical - needed immediately on home screen
    {
      queryKey: homeDashboardQueryKeys.dashboard(),
      queryFn: async () => {
        // Must extract .data to match useHomeDashboard
        const response = await homeService.getDashboard(timezone);
        if (response.error) {
          throw new Error(response.error);
        }
        return response.data;
      },
      staleTime: 2 * 60 * 1000, // 2 minutes
      description: "Home dashboard",
      priority: "critical"
    },
    {
      queryKey: userQueryKeys.currentUser,
      queryFn: () => userService.getCurrentUser(),
      staleTime: 5 * 60 * 1000, // 5 minutes
      description: "Current user",
      priority: "critical"
    },
    {
      queryKey: goalsQueryKeys.list(),
      queryFn: () => goalsService.getGoals(),
      staleTime: 30 * 1000, // 30 seconds
      description: "Goals list",
      priority: "critical"
    },
    // Motivation card is visible on home screen - must be critical
    {
      queryKey: dailyMotivationsQueryKeys.today(),
      queryFn: async () => {
        // Must extract .data to match useTodayDailyMotivation
        const response = await dailyMotivationService.getToday();
        if (response.status !== 200 || !response.data) {
          throw new Error(response.error || "Failed to fetch daily motivation");
        }
        return response.data;
      },
      staleTime: 60 * 60 * 1000, // 1 hour
      description: "Today's motivation",
      priority: "critical"
    },
    // Notification count shows in tab bar - must be critical
    {
      queryKey: notificationHistoryQueryKeys.unreadCount(),
      queryFn: async () => {
        // Must extract .data to match useUnreadNotificationCount's fetchNotificationHistory
        const response = await notificationsService.getHistory(100, 0);
        if (response.error || !response.data) {
          throw new Error(response.message || "Failed to fetch notifications");
        }
        return response.data;
      },
      staleTime: 30 * 1000, // 30 seconds
      description: "Notification count",
      priority: "critical"
    },

    // High priority - needed soon after home screen
    {
      queryKey: achievementsQueryKeys.myAchievements(),
      queryFn: () => achievementsService.getMyAchievements(),
      staleTime: 5 * 60 * 1000, // 5 minutes
      description: "Achievements",
      priority: "high"
    },
    {
      queryKey: partnersQueryKeys.listWithGoals(),
      queryFn: () => partnersService.getPartners(true),
      staleTime: 60 * 1000, // 1 minute
      description: "Partners with today's goals",
      priority: "high"
    },
    // Notification list for when user navigates to notifications screen
    // Uses infinite query - must match useNotificationHistory hook
    {
      queryKey: notificationHistoryQueryKeys.list(),
      queryFn: async () => {
        // Must extract .data to match useNotificationHistory's fetchNotificationHistory
        const response = await notificationsService.getHistory(20, 0);
        if (response.error || !response.data) {
          throw new Error(response.message || "Failed to fetch notifications");
        }
        return response.data;
      },
      staleTime: 2 * 60 * 1000, // 2 minutes
      description: "Notifications list",
      priority: "high",
      isInfinite: true
    }
  ];
}

/**
 * Helper to prefetch a single config (handles both regular and infinite queries)
 */
async function prefetchConfig(queryClient: QueryClient, config: PrefetchConfig): Promise<void> {
  if (config.isInfinite) {
    // Use prefetchInfiniteQuery for infinite queries
    await queryClient.prefetchInfiniteQuery({
      queryKey: config.queryKey,
      queryFn: () => config.queryFn(),
      staleTime: config.staleTime,
      initialPageParam: 0,
      getNextPageParam: () => undefined // Only prefetch first page
    });
  } else {
    await queryClient.prefetchQuery({
      queryKey: config.queryKey,
      queryFn: config.queryFn,
      staleTime: config.staleTime
    });
  }
}

/**
 * Prefetch critical data for authenticated users
 */
export async function prefetchCriticalData(queryClient: QueryClient): Promise<void> {
  const configs = getPrefetchConfigs();
  const criticalConfigs = configs.filter((c) => c.priority === "critical");

  logger.info("[Prefetch] Starting critical data prefetch...");

  const results = await Promise.allSettled(
    criticalConfigs.map(async (config) => {
      try {
        await prefetchConfig(queryClient, config);
        logger.debug(`[Prefetch] ✓ ${config.description}`);
      } catch (error) {
        logger.warn(`[Prefetch] ✗ ${config.description}`);
        throw error;
      }
    })
  );

  const successful = results.filter((r) => r.status === "fulfilled").length;
  logger.info(`[Prefetch] Critical complete: ${successful}/${criticalConfigs.length}`);
}

/**
 * Prefetch high priority data (after critical)
 */
export async function prefetchHighPriorityData(queryClient: QueryClient): Promise<void> {
  const configs = getPrefetchConfigs();
  const highConfigs = configs.filter((c) => c.priority === "high");

  logger.debug("[Prefetch] Starting high priority data prefetch...");

  await Promise.allSettled(
    highConfigs.map(async (config) => {
      try {
        await prefetchConfig(queryClient, config);
        logger.debug(`[Prefetch] ✓ ${config.description}`);
      } catch (error) {
        logger.warn(`[Prefetch] ✗ ${config.description}`);
      }
    })
  );
}

/**
 * Prefetch all data (background)
 */
export async function prefetchAllData(queryClient: QueryClient): Promise<void> {
  const configs = getPrefetchConfigs();

  await Promise.allSettled(
    configs.map(async (config) => {
      try {
        await prefetchConfig(queryClient, config);
      } catch (error) {
        logger.debug(`[Prefetch] ✗ ${config.description}`);
      }
    })
  );
}

/**
 * Clear all prefetched data
 */
export function clearPrefetchedData(queryClient: QueryClient): void {
  queryClient.clear();
  logger.info("[Prefetch] Cleared all cached data");
}
