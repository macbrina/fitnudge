import {
  actionablePlansQueryKeys,
  checkInsQueryKeys,
  goalsQueryKeys,
  userQueryKeys,
} from "@/hooks/api/queryKeys";
import { progressQueryKeys } from "@/hooks/api/useProgressData";
import {
  actionablePlansService,
  PlanStatus,
} from "@/services/api/actionablePlans";
import { logger } from "@/services/logger";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";

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
      // Poll every 2 seconds when pending or generating (faster feedback for users)
      const status = q.state.data?.status;
      if (status === "pending" || status === "generating") {
        return 2000;
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
    }
    prevStatusRef.current = currentStatus || null;
  }, [query.data?.status, queryClient, goalId]);

  return query;
};

/**
 * Hook to batch fetch plan statuses for multiple goals at once
 * Returns a map of goalId -> planStatus for easy lookup
 *
 * IMPORTANT: Polls every 3 seconds when ANY plan is pending/generating
 */
export const useBatchPlanStatuses = (goalIds: string[]) => {
  const queryClient = useQueryClient();
  const prevStatusesRef = useRef<Record<string, string>>({});

  const queries = useQueries({
    queries: goalIds.map((goalId) => ({
      queryKey: actionablePlansQueryKeys.planStatus(goalId),
      queryFn: () => actionablePlansService.getPlanStatus(goalId),
      staleTime: 0, // Always fetch fresh data
      refetchOnMount: "always" as const,
      refetchOnWindowFocus: true,
      // Each query polls independently based on its own status
      refetchInterval: (q: any) => {
        const status = q.state.data?.status;
        if (status === "pending" || status === "generating") {
          return 2000; // Poll every 2 seconds (faster feedback)
        }
        return false; // Stop polling
      },
      refetchIntervalInBackground: false,
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);

  // Create a map of goalId -> planStatus for easy lookup
  const planStatusMap = useMemo(() => {
    const map: Record<
      string,
      { status: PlanStatus; [key: string]: any } | undefined
    > = {};
    goalIds.forEach((goalId, index) => {
      map[goalId] = queries[index]?.data;
    });
    return map;
  }, [goalIds, queries]);

  // Check if any plan is currently generating
  const hasGeneratingPlan = useMemo(() => {
    return queries.some((q) => {
      const status = q.data?.status;
      return status === "pending" || status === "generating";
    });
  }, [queries]);

  // When a plan status changes to "completed", invalidate related queries
  useEffect(() => {
    queries.forEach((q, index) => {
      const goalId = goalIds[index];
      const currentStatus = q.data?.status;
      const prevStatus = prevStatusesRef.current[goalId];

      // Only invalidate when status CHANGES to completed (not on every render)
      if (
        currentStatus === "completed" &&
        prevStatus !== "completed" &&
        prevStatus !== undefined
      ) {
        logger.info(`Plan completed for goal ${goalId}, invalidating queries`);

        // Invalidate goals to sync the active state
        queryClient.invalidateQueries({ queryKey: goalsQueryKeys.active() });
        queryClient.invalidateQueries({ queryKey: goalsQueryKeys.list() });

        // Invalidate check-ins
        queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.today() });
        queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.all });
      }

      // Update previous status
      if (currentStatus) {
        prevStatusesRef.current[goalId] = currentStatus;
      }
    });
  }, [queries, goalIds, queryClient]);

  return {
    planStatusMap,
    isLoading,
    isError,
    queries,
    hasGeneratingPlan, // Expose this so UI can show a loading indicator
  };
};

/**
 * Hook to batch fetch plan statuses for multiple challenges at once
 * Returns a map of challengeId -> planStatus for easy lookup
 *
 * IMPORTANT: Polls every 3 seconds when ANY plan is pending/generating
 */
export const useBatchChallengePlanStatuses = (challengeIds: string[]) => {
  const queryClient = useQueryClient();
  const prevStatusesRef = useRef<Record<string, string>>({});

  const queries = useQueries({
    queries: challengeIds.map((challengeId) => ({
      queryKey: actionablePlansQueryKeys.challengePlanStatus(challengeId),
      queryFn: () => actionablePlansService.getChallengePlanStatus(challengeId),
      staleTime: 0, // Always fetch fresh data
      refetchOnMount: "always" as const,
      refetchOnWindowFocus: true,
      // Each query polls independently based on its own status
      refetchInterval: (q: any) => {
        const status = q.state.data?.status;
        if (status === "pending" || status === "generating") {
          return 2000; // Poll every 2 seconds (faster feedback)
        }
        return false; // Stop polling
      },
      refetchIntervalInBackground: false,
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);

  // Create a map of challengeId -> planStatus for easy lookup
  const planStatusMap = useMemo(() => {
    const map: Record<
      string,
      { status: PlanStatus; [key: string]: any } | undefined
    > = {};
    challengeIds.forEach((challengeId, index) => {
      map[challengeId] = queries[index]?.data;
    });
    return map;
  }, [challengeIds, queries]);

  // Check if any plan is currently generating
  const hasGeneratingPlan = useMemo(() => {
    return queries.some((q) => {
      const status = q.data?.status;
      return status === "pending" || status === "generating";
    });
  }, [queries]);

  // When a plan status changes to "completed", invalidate related queries
  useEffect(() => {
    queries.forEach((q, index) => {
      const challengeId = challengeIds[index];
      const currentStatus = q.data?.status;
      const prevStatus = prevStatusesRef.current[challengeId];

      // Only invalidate when status CHANGES to completed (not on every render)
      if (
        currentStatus === "completed" &&
        prevStatus !== "completed" &&
        prevStatus !== undefined
      ) {
        logger.info(
          `Plan completed for challenge ${challengeId}, invalidating queries`,
        );

        // Invalidate challenges
        queryClient.invalidateQueries({ queryKey: ["challenges"] });

        // Invalidate check-ins
        queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.today() });
        queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.all });
      }

      // Update previous status
      if (currentStatus) {
        prevStatusesRef.current[challengeId] = currentStatus;
      }
    });
  }, [queries, challengeIds, queryClient]);

  return {
    planStatusMap,
    isLoading,
    isError,
    queries,
    hasGeneratingPlan, // Expose this so UI can show a loading indicator
  };
};

/**
 * Hook to get the complete actionable plan for a goal
 */
export const useGoalPlan = (goalId: string | undefined, enabled = true) => {
  return useQuery({
    queryKey: actionablePlansQueryKeys.plan(goalId || ""),
    queryFn: () => actionablePlansService.getGoalPlan(goalId!),
    enabled: enabled && !!goalId,
    staleTime: 5 * 60 * 1000, // 5 minutes - use cached data for 5 min
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache for 10 min
    refetchOnMount: false, // Don't refetch if data exists in cache
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook to get the complete actionable plan for a challenge
 */
export const useChallengePlan = (
  challengeId: string | undefined,
  enabled = true,
) => {
  return useQuery({
    queryKey: actionablePlansQueryKeys.challengePlan(challengeId || ""),
    queryFn: () => actionablePlansService.getChallengePlan(challengeId!),
    enabled: enabled && !!challengeId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook to get plan status for a challenge
 * Similar to usePlanStatus but for challenges
 */
export const useChallengePlanStatus = (
  challengeId: string | undefined,
  enabled = true,
) => {
  const queryClient = useQueryClient();
  const prevStatusRef = useRef<string | null>(null);

  const query = useQuery({
    queryKey: actionablePlansQueryKeys.challengePlanStatus(challengeId || ""),
    queryFn: () => actionablePlansService.getChallengePlanStatus(challengeId!),
    enabled: enabled && !!challengeId,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (status === "pending" || status === "generating") {
        return 2000; // Poll every 2 seconds (faster feedback)
      }
      return false;
    },
    refetchIntervalInBackground: false,
  });

  // When status changes to "completed", invalidate challenge queries
  useEffect(() => {
    const currentStatus = query.data?.status;
    const justBecameCompleted =
      currentStatus === "completed" && prevStatusRef.current !== "completed";

    if (justBecameCompleted) {
      // Plan just became ready - invalidate challenge-related queries
      queryClient.invalidateQueries({ queryKey: ["challenges"] });
    }
    prevStatusRef.current = currentStatus || null;
  }, [query.data?.status, queryClient, challengeId]);

  return query;
};

/**
 * Hook to prefetch a goal's plan data
 * Use this in PlanSection to warm up the cache before user clicks "Start Workout"
 */
export const usePrefetchGoalPlan = () => {
  const queryClient = useQueryClient();

  return (goalId: string) => {
    queryClient.prefetchQuery({
      queryKey: actionablePlansQueryKeys.plan(goalId),
      queryFn: () => actionablePlansService.getGoalPlan(goalId),
      staleTime: 5 * 60 * 1000,
    });
  };
};

/**
 * Hook to prefetch a challenge's plan data
 */
export const usePrefetchChallengePlan = () => {
  const queryClient = useQueryClient();

  return (challengeId: string) => {
    queryClient.prefetchQuery({
      queryKey: actionablePlansQueryKeys.challengePlan(challengeId),
      queryFn: () => actionablePlansService.getChallengePlan(challengeId),
      staleTime: 5 * 60 * 1000,
    });
  };
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
        actionablePlansQueryKeys.planStatus(goalId),
      );

      // Optimistically set status to generating
      queryClient.setQueryData(
        actionablePlansQueryKeys.planStatus(goalId),
        (old: any) => {
          if (!old) return { status: "generating" };
          return { ...old, status: "generating" };
        },
      );

      return { previousStatus, goalId };
    },
    onError: (error, goalId, context) => {
      // Rollback on error
      if (context?.previousStatus) {
        queryClient.setQueryData(
          actionablePlansQueryKeys.planStatus(goalId),
          context.previousStatus,
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
      // (retry endpoint clears archived_reason and sets status: "active")
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.active() });
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.list() });
    },
  });
};

/**
 * Hook to retry plan generation for a failed challenge plan
 */
export const useRetryChallengePlanGeneration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (challengeId: string) =>
      actionablePlansService.retryChallengePlanGeneration(challengeId),
    // Optimistic update - show generating status instantly
    onMutate: async (challengeId) => {
      await queryClient.cancelQueries({
        queryKey: actionablePlansQueryKeys.challengePlanStatus(challengeId),
      });

      const previousStatus = queryClient.getQueryData(
        actionablePlansQueryKeys.challengePlanStatus(challengeId),
      );

      // Optimistically set status to generating
      queryClient.setQueryData(
        actionablePlansQueryKeys.challengePlanStatus(challengeId),
        (old: any) => {
          if (!old) return { status: "generating" };
          return { ...old, status: "generating" };
        },
      );

      return { previousStatus, challengeId };
    },
    onError: (error, challengeId, context) => {
      // Rollback on error
      if (context?.previousStatus) {
        queryClient.setQueryData(
          actionablePlansQueryKeys.challengePlanStatus(challengeId),
          context.previousStatus,
        );
      }
      logger.error("Failed to retry challenge plan generation", {
        error: error instanceof Error ? error.message : String(error),
      });
    },
    onSuccess: (data, challengeId) => {
      // Invalidate plan status to start polling
      queryClient.invalidateQueries({
        queryKey: actionablePlansQueryKeys.challengePlanStatus(challengeId),
      });

      // Invalidate challenges to reflect the re-activated state
      queryClient.invalidateQueries({ queryKey: ["challenges"] });
    },
  });
};
