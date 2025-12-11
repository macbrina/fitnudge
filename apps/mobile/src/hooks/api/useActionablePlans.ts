import {
  actionablePlansQueryKeys,
  checkInsQueryKeys,
  goalsQueryKeys,
  userQueryKeys,
} from "@/hooks/api/queryKeys";
import { progressQueryKeys } from "@/hooks/api/useProgressData";
import { actionablePlansService } from "@/services/api/actionablePlans";
import { logger } from "@/services/logger";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

// Re-export for backward compatibility
export { actionablePlansQueryKeys } from "@/hooks/api/queryKeys";

/**
 * Hook to get plan generation status for a goal
 * Automatically polls every 3 seconds when status is "pending" or "generating"
 * When status becomes "completed", invalidates goals to sync active state
 */
export const usePlanStatus = (goalId: string | undefined, enabled = true) => {
  const queryClient = useQueryClient();
  const prevStatusRef = useRef<string | null>(null);

  const query = useQuery({
    queryKey: actionablePlansQueryKeys.planStatus(goalId || ""),
    queryFn: () => actionablePlansService.getPlanStatus(goalId!),
    enabled: enabled && !!goalId,
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: "always", // Force refetch on mount to get latest status
    refetchOnWindowFocus: true,
    refetchInterval: (q) => {
      // Poll every 3 seconds when pending or generating
      const status = q.state.data?.status;
      if (status === "pending" || status === "generating") {
        return 3000;
      }
      // Stop polling when completed, failed, or not_started
      return false;
    },
    refetchIntervalInBackground: false,
  });

  // When status changes to "completed", invalidate goals, check-ins, and stats
  // Also invalidate on first mount if status is already "completed" (goal activated while away)
  useEffect(() => {
    const currentStatus = query.data?.status;
    const isFirstMount = prevStatusRef.current === null;
    const justBecameCompleted =
      currentStatus === "completed" && prevStatusRef.current !== "completed";

    if (justBecameCompleted) {
      // Plan just became ready (either during polling or on first mount)
      // Goal is now active on backend, initial check-in has been created

      // Invalidate goals to sync the active state
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.active() });
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.list() });

      // Invalidate check-ins to fetch the newly created check-in
      queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.today() });
      queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.stats() });

      // Invalidate user stats to update QuickStatsGrid
      queryClient.invalidateQueries({ queryKey: userQueryKeys.userStats() });

      // Invalidate progress data for this goal to ensure fresh data
      queryClient.invalidateQueries({
        queryKey: progressQueryKeys.streak(goalId),
      });
      queryClient.invalidateQueries({
        queryKey: progressQueryKeys.weekProgress(goalId),
      });
      queryClient.invalidateQueries({
        queryKey: progressQueryKeys.moodTrend(goalId),
      });
      // Also invalidate chain data (habit chain uses a custom key)
      queryClient.invalidateQueries({
        queryKey: [...progressQueryKeys.all, "chain", goalId],
      });

      // Log for debugging
      console.log(
        `[usePlanStatus] Goal ${goalId} plan completed, invalidated queries (firstMount: ${isFirstMount})`
      );
    }
    prevStatusRef.current = currentStatus || null;
  }, [query.data?.status, queryClient, goalId]);

  return query;
};

/**
 * Hook to get the complete actionable plan for a goal
 */
export const useGoalPlan = (goalId: string | undefined, enabled = true) => {
  return useQuery({
    queryKey: actionablePlansQueryKeys.plan(goalId || ""),
    queryFn: () => actionablePlansService.getGoalPlan(goalId!),
    enabled: enabled && !!goalId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook to retry plan generation for a failed plan
 */
export const useRetryPlanGeneration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (goalId: string) =>
      actionablePlansService.retryPlanGeneration(goalId),
    // Optimistic update - show generating status instantly
    onMutate: async (goalId) => {
      await queryClient.cancelQueries({
        queryKey: actionablePlansQueryKeys.planStatus(goalId),
      });

      const previousStatus = queryClient.getQueryData(
        actionablePlansQueryKeys.planStatus(goalId)
      );

      // Optimistically set status to generating
      queryClient.setQueryData(
        actionablePlansQueryKeys.planStatus(goalId),
        (old: any) => {
          if (!old) return { status: "generating" };
          return { ...old, status: "generating" };
        }
      );

      return { previousStatus, goalId };
    },
    onError: (error, goalId, context) => {
      // Rollback on error
      if (context?.previousStatus) {
        queryClient.setQueryData(
          actionablePlansQueryKeys.planStatus(goalId),
          context.previousStatus
        );
      }
      logger.error("Failed to retry plan generation", {
        error: error instanceof Error ? error.message : String(error),
      });
    },
    onSuccess: (data, goalId) => {
      // Invalidate plan status to start polling
      queryClient.invalidateQueries({
        queryKey: actionablePlansQueryKeys.planStatus(goalId),
      });

      // Invalidate goals to reflect the re-activated state
      // (retry endpoint clears archived_reason and sets is_active: true)
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.active() });
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.list() });
    },
  });
};
