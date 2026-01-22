/**
 * Analytics Hooks
 *
 * React Query hooks for fetching per-goal analytics dashboard data.
 * Premium feature: requires `advanced_analytics` subscription.
 *
 * V2: Analytics are now per-goal (requires goalId).
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { analyticsService, AnalyticsDashboard } from "@/services/api/analytics";
import { useSubscriptionStore } from "@/stores/subscriptionStore";

// Query keys - now include goalId
export const analyticsQueryKeys = {
  all: ["analytics"] as const,
  dashboard: (goalId: string, days: number) =>
    [...analyticsQueryKeys.all, "dashboard", goalId, days] as const
} as const;

/**
 * Fetch per-goal analytics dashboard data from the backend.
 *
 * V2: Analytics are now per-goal. Each goal has its own analytics.
 * Only fetches if user has `advanced_analytics` feature (premium).
 * Returns null data for free users - use dummy data instead.
 *
 * @param goalId Goal ID to analyze (required for fetch to happen)
 * @param days Number of days to analyze (default 30)
 */
export function useAnalyticsDashboard(goalId: string | null, days: number = 30) {
  const { hasFeature } = useSubscriptionStore();
  const isPremium = hasFeature("advanced_analytics");
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: analyticsQueryKeys.dashboard(goalId || "", days),
    queryFn: async () => {
      if (!goalId) {
        throw new Error("Goal ID is required");
      }

      const response = await analyticsService.getDashboard(goalId, days);

      if (response.error || !response.data) {
        throw new Error(response.error || "Failed to fetch analytics");
      }

      return response.data;
    },
    // Only fetch if user is premium AND has a selected goal
    enabled: isPremium && !!goalId,
    // Analytics data doesn't change frequently
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes cache
    // DONT REMOVE THIS COMMENT OUT - IT IS USED FOR TESTING
    // staleTime: 0, // Always refetch for testing
    // refetchOnMount: "always",
    // Don't retry on 403 (not premium) or 404 (goal not found)
    retry: (failureCount, error) => {
      if (error instanceof Error) {
        if (error.message.includes("premium") || error.message.includes("not found")) {
          return false;
        }
      }
      return failureCount < 2;
    }
  });

  /**
   * Force refresh analytics data, bypassing both React Query and Redis cache.
   * Use this for pull-to-refresh to ensure users get fresh data.
   */
  const forceRefresh = useCallback(async () => {
    if (!goalId) return;

    const response = await analyticsService.getDashboard(goalId, days, true);

    if (response.data) {
      // Update the cache with fresh data
      queryClient.setQueryData(analyticsQueryKeys.dashboard(goalId, days), response.data);
    }

    return response.data;
  }, [goalId, days, queryClient]);

  return {
    ...query,
    forceRefresh
  };
}

// Re-export types for convenience
export type {
  AnalyticsDashboard,
  HeatmapDataItem,
  ThisWeekItem,
  MoodTrendItem,
  WeeklyConsistencyItem,
  StreakHistoryItem,
  MonthlyTrendItem,
  SkipReasonItem
} from "@/services/api/analytics";
