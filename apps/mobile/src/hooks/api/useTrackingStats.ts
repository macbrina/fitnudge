/**
 * Hook for fetching tracking-type-specific statistics
 *
 * Supports:
 * - Workout stats: total workouts, duration, exercises
 * - Meal stats: meals logged, calories, protein
 * - Hydration stats: water intake, target progress
 * - Check-in stats: completion rate, mood trends
 */

import { useQuery } from "@tanstack/react-query";
import {
  trackingStatsService,
  TrackingStatsResponse,
  TrackingType,
  WorkoutStats,
  MealStats,
  HydrationStats,
  CheckinStats,
} from "@/services/api/trackingStats";

// Re-export types for convenience
export type {
  TrackingStatsResponse,
  TrackingType,
  WorkoutStats,
  MealStats,
  HydrationStats,
  CheckinStats,
};

// =============================================================================
// Query Keys
// =============================================================================

export const trackingStatsQueryKeys = {
  all: ["tracking-stats"] as const,
  entity: (entityType: string, entityId: string) =>
    [...trackingStatsQueryKeys.all, entityType, entityId] as const,
  stats: (
    entityType: string,
    entityId: string,
    trackingType: string,
    period: number,
  ) =>
    [
      ...trackingStatsQueryKeys.entity(entityType, entityId),
      trackingType,
      period,
    ] as const,
};

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook to fetch tracking-type-specific stats for a goal or challenge
 *
 * @param entityId - Goal or Challenge ID
 * @param entityType - "goal" or "challenge"
 * @param trackingType - "workout", "meal", "hydration", or "checkin"
 * @param period - Number of days to analyze (default: 30)
 * @param enabled - Whether to fetch (default: true)
 */
export function useTrackingStats(
  entityId: string | undefined,
  entityType: "goal" | "challenge" = "goal",
  trackingType: TrackingType = "checkin",
  period: number = 30,
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: trackingStatsQueryKeys.stats(
      entityType,
      entityId || "",
      trackingType,
      period,
    ),
    queryFn: async () => {
      const response = await trackingStatsService.getStats(
        entityId!,
        entityType,
        trackingType,
        period,
      );
      return response.data;
    },
    enabled: enabled && !!entityId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook specifically for workout stats
 */
export function useWorkoutStats(
  entityId: string | undefined,
  entityType: "goal" | "challenge" = "goal",
  period: number = 30,
  enabled: boolean = true,
) {
  const query = useTrackingStats(
    entityId,
    entityType,
    "workout",
    period,
    enabled,
  );

  return {
    ...query,
    data: query.data?.workout,
  };
}

/**
 * Hook specifically for meal stats
 */
export function useMealStats(
  entityId: string | undefined,
  entityType: "goal" | "challenge" = "goal",
  period: number = 30,
  enabled: boolean = true,
) {
  const query = useTrackingStats(entityId, entityType, "meal", period, enabled);

  return {
    ...query,
    data: query.data?.meal,
  };
}

/**
 * Hook specifically for hydration stats
 */
export function useHydrationStats(
  entityId: string | undefined,
  entityType: "goal" | "challenge" = "goal",
  period: number = 30,
  enabled: boolean = true,
) {
  const query = useTrackingStats(
    entityId,
    entityType,
    "hydration",
    period,
    enabled,
  );

  return {
    ...query,
    data: query.data?.hydration,
  };
}

/**
 * Hook specifically for check-in stats
 */
export function useCheckinStats(
  entityId: string | undefined,
  entityType: "goal" | "challenge" = "goal",
  period: number = 30,
  enabled: boolean = true,
) {
  const query = useTrackingStats(
    entityId,
    entityType,
    "checkin",
    period,
    enabled,
  );

  return {
    ...query,
    data: query.data?.checkin,
  };
}
