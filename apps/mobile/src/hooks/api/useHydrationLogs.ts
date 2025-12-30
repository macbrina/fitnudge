import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  hydrationLogsService,
  HydrationLog,
  CreateHydrationLogRequest,
  DailyHydrationSummary,
  HYDRATION_PRESETS,
} from "@/services/api/hydrationLogs";
import { homeDashboardQueryKeys } from "./useHomeDashboard";
import { trackingStatsQueryKeys } from "./useTrackingStats";
import { progressQueryKeys } from "./useProgressData";
import type {
  TrackingStatsResponse,
  HydrationStats,
} from "@/services/api/trackingStats";
import {
  cancelProgressQueries,
  snapshotProgressData,
  optimisticallyUpdateProgress,
  rollbackProgressData,
  ProgressOptimisticContext,
} from "./progressOptimisticUpdates";

// Period options that GoalProgressSection uses
const PERIOD_OPTIONS = [7, 30, 90] as const;

// Query keys
export const hydrationLogsQueryKeys = {
  all: ["hydrationLogs"] as const,
  list: (params?: {
    logged_date?: string;
    goal_id?: string;
    challenge_id?: string;
  }) => [...hydrationLogsQueryKeys.all, "list", params] as const,
  dailySummary: (date: string, goalId?: string, challengeId?: string) =>
    [
      ...hydrationLogsQueryKeys.all,
      "dailySummary",
      date,
      goalId,
      challengeId,
    ] as const,
  presets: () => [...hydrationLogsQueryKeys.all, "presets"] as const,
};

/**
 * Hook to log water intake with optimistic updates
 */
export function useLogHydration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateHydrationLogRequest) => {
      const response = await hydrationLogsService.logHydration(data);
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data as HydrationLog;
    },

    // Optimistic update
    onMutate: async (newLog) => {
      // Use LOCAL date to match progressOptimisticUpdates which uses formatLocalDate
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const logDate = newLog.logged_date || today;
      const isToday = logDate === today;

      // Cancel in-flight queries to prevent race conditions
      await queryClient.cancelQueries({ queryKey: hydrationLogsQueryKeys.all });

      // Also cancel tracking stats queries for instant updates
      if (newLog.goal_id) {
        await queryClient.cancelQueries({
          queryKey: trackingStatsQueryKeys.entity("goal", newLog.goal_id),
        });
        // Cancel progress queries for instant progress section updates
        await cancelProgressQueries(queryClient, newLog.goal_id, "goal");
      }
      if (newLog.challenge_id) {
        await queryClient.cancelQueries({
          queryKey: trackingStatsQueryKeys.entity(
            "challenge",
            newLog.challenge_id,
          ),
        });
        // Cancel progress queries for challenges too
        await cancelProgressQueries(
          queryClient,
          newLog.challenge_id,
          "challenge",
        );
      }

      // Snapshot current data for potential rollback
      const previousLogs = queryClient.getQueryData(
        hydrationLogsQueryKeys.list({
          logged_date: logDate,
          goal_id: newLog.goal_id,
          challenge_id: newLog.challenge_id,
        }),
      );

      const previousSummary = queryClient.getQueryData(
        hydrationLogsQueryKeys.dailySummary(
          logDate,
          newLog.goal_id,
          newLog.challenge_id,
        ),
      );

      // Snapshot tracking stats for all periods (for rollback)
      const previousTrackingStats: Map<
        string,
        TrackingStatsResponse | undefined
      > = new Map();
      const entityType = newLog.goal_id
        ? "goal"
        : newLog.challenge_id
          ? "challenge"
          : null;
      const entityId = newLog.goal_id || newLog.challenge_id;

      if (entityType && entityId) {
        for (const period of PERIOD_OPTIONS) {
          const queryKey = trackingStatsQueryKeys.stats(
            entityType,
            entityId,
            "hydration",
            period,
          );
          previousTrackingStats.set(
            `${entityType}-${entityId}-${period}`,
            queryClient.getQueryData<TrackingStatsResponse>(queryKey),
          );
        }
      }

      // Create optimistic hydration log with temporary ID
      const optimisticLog: HydrationLog = {
        id: `temp-${Date.now()}`,
        user_id: "temp-user",
        amount_ml: newLog.amount_ml,
        logged_date: logDate,
        logged_at: new Date().toISOString(),
        goal_id: newLog.goal_id,
        challenge_id: newLog.challenge_id,
        created_at: new Date().toISOString(),
      };

      // Immediately add to cache
      queryClient.setQueryData(
        hydrationLogsQueryKeys.list({
          logged_date: logDate,
          goal_id: newLog.goal_id,
          challenge_id: newLog.challenge_id,
        }),
        (old: HydrationLog[] | undefined) => {
          if (!old) return [optimisticLog];
          return [...old, optimisticLog];
        },
      );

      // Optimistically update the daily summary
      queryClient.setQueryData(
        hydrationLogsQueryKeys.dailySummary(
          logDate,
          newLog.goal_id,
          newLog.challenge_id,
        ),
        (old: DailyHydrationSummary | undefined) => {
          if (!old) {
            return {
              logged_date: logDate,
              total_amount_ml: newLog.amount_ml,
              log_count: 1,
              goal_id: newLog.goal_id,
              challenge_id: newLog.challenge_id,
              progress_percentage: 0,
            };
          }
          const newTotal = old.total_amount_ml + newLog.amount_ml;
          const targetMl = old.target_ml || 2000;
          return {
            ...old,
            total_amount_ml: newTotal,
            log_count: old.log_count + 1,
            progress_percentage: Math.min(100, (newTotal / targetMl) * 100),
          };
        },
      );

      // Snapshot and optimistically update progress data (streak, week, chain)
      let previousProgressData: ProgressOptimisticContext | undefined;
      if (newLog.goal_id) {
        previousProgressData = snapshotProgressData(
          queryClient,
          newLog.goal_id,
          logDate,
          "goal",
        );
        optimisticallyUpdateProgress(queryClient, newLog.goal_id, logDate);
      } else if (newLog.challenge_id) {
        previousProgressData = snapshotProgressData(
          queryClient,
          newLog.challenge_id,
          logDate,
          "challenge",
        );
      }

      // Optimistically update tracking stats (HydrationProgressStats)
      if (entityType && entityId) {
        for (const period of PERIOD_OPTIONS) {
          const queryKey = trackingStatsQueryKeys.stats(
            entityType,
            entityId,
            "hydration",
            period,
          );
          queryClient.setQueryData<TrackingStatsResponse>(queryKey, (old) => {
            if (!old?.hydration) return old;

            const hydration = old.hydration;
            const newTotalIntake = hydration.total_intake_ml + newLog.amount_ml;
            const newIntakeToday = isToday
              ? hydration.intake_today_ml + newLog.amount_ml
              : hydration.intake_today_ml;

            // Recalculate average (approximate - actual server will be accurate)
            const daysWithLogs =
              hydration.total_intake_ml > 0
                ? Math.max(
                    1,
                    Math.ceil(
                      hydration.total_intake_ml / hydration.avg_daily_intake_ml,
                    ),
                  )
                : 0;
            const newAvgDaily =
              daysWithLogs > 0
                ? newTotalIntake / daysWithLogs
                : newLog.amount_ml;

            // Check if today just hit the target
            const wasTargetHitToday =
              hydration.intake_today_ml >= hydration.daily_target_ml;
            const isTargetHitNow = newIntakeToday >= hydration.daily_target_ml;
            const newDaysTargetHit =
              !wasTargetHitToday && isTargetHitNow && isToday
                ? hydration.days_target_hit + 1
                : hydration.days_target_hit;

            const updatedHydration: HydrationStats = {
              ...hydration,
              total_intake_ml: newTotalIntake,
              intake_today_ml: newIntakeToday,
              avg_daily_intake_ml: Math.round(newAvgDaily),
              days_target_hit: newDaysTargetHit,
              target_hit_percentage:
                Math.round((newDaysTargetHit / period) * 100 * 10) / 10,
            };

            return {
              ...old,
              hydration: updatedHydration,
            };
          });
        }
      }

      // Return context for rollback
      return {
        previousLogs,
        previousSummary,
        previousTrackingStats,
        previousProgressData,
        logDate,
        optimisticId: optimisticLog.id,
        entityType,
        entityId,
      };
    },

    // Rollback on error
    onError: (err, newLog, context) => {
      if (context) {
        const logDate = context.logDate;

        if (context.previousLogs !== undefined) {
          queryClient.setQueryData(
            hydrationLogsQueryKeys.list({
              logged_date: logDate,
              goal_id: newLog.goal_id,
              challenge_id: newLog.challenge_id,
            }),
            context.previousLogs,
          );
        }

        if (context.previousSummary !== undefined) {
          queryClient.setQueryData(
            hydrationLogsQueryKeys.dailySummary(
              logDate,
              newLog.goal_id,
              newLog.challenge_id,
            ),
            context.previousSummary,
          );
        }

        // Rollback tracking stats
        if (
          context.previousTrackingStats &&
          context.entityType &&
          context.entityId
        ) {
          for (const period of PERIOD_OPTIONS) {
            const key = `${context.entityType}-${context.entityId}-${period}`;
            const previousValue = context.previousTrackingStats.get(key);
            if (previousValue !== undefined) {
              queryClient.setQueryData(
                trackingStatsQueryKeys.stats(
                  context.entityType,
                  context.entityId,
                  "hydration",
                  period,
                ),
                previousValue,
              );
            }
          }
        }

        // Rollback progress data (streak, week, chain)
        if (context.previousProgressData) {
          rollbackProgressData(queryClient, context.previousProgressData);
        }
      }
    },

    // Replace temp data with real data on success
    onSuccess: (realLog, variables, context) => {
      // Use LOCAL date to match optimistic updates which use formatLocalDate
      const now = new Date();
      const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const logDate = context?.logDate || variables.logged_date || localToday;

      // Replace optimistic log with real one
      queryClient.setQueryData(
        hydrationLogsQueryKeys.list({
          logged_date: logDate,
          goal_id: variables.goal_id,
          challenge_id: variables.challenge_id,
        }),
        (old: HydrationLog[] | undefined) => {
          if (!old) return [realLog];
          // Filter out temp items and add real one
          const filtered = old.filter((log) => !log.id?.startsWith?.("temp-"));
          return [...filtered, realLog];
        },
      );

      // Invalidate summary to get accurate server calculation
      queryClient.invalidateQueries({
        queryKey: hydrationLogsQueryKeys.dailySummary(
          logDate,
          variables.goal_id,
          variables.challenge_id,
        ),
      });

      // Invalidate home dashboard for check-in auto-completion
      queryClient.invalidateQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
      });

      // If associated with a goal or challenge, invalidate related queries
      if (realLog.goal_id) {
        queryClient.invalidateQueries({
          queryKey: ["goals", realLog.goal_id],
        });
        queryClient.invalidateQueries({ queryKey: ["checkins"] });
        // Invalidate tracking stats for hydration progress display
        queryClient.invalidateQueries({
          queryKey: trackingStatsQueryKeys.entity("goal", realLog.goal_id),
        });
        // Invalidate progress data (streak, habit chain, week progress) for instant UI update
        queryClient.invalidateQueries({
          queryKey: progressQueryKeys.streak(realLog.goal_id),
        });
        queryClient.invalidateQueries({
          queryKey: progressQueryKeys.weekProgress(realLog.goal_id),
        });
        queryClient.invalidateQueries({
          queryKey: [...progressQueryKeys.all, "chain", realLog.goal_id],
        });
      }
      if (realLog.challenge_id) {
        queryClient.invalidateQueries({
          queryKey: ["challenges", realLog.challenge_id],
        });
        queryClient.invalidateQueries({ queryKey: ["challengeCheckins"] });
        // Invalidate tracking stats for hydration progress display
        queryClient.invalidateQueries({
          queryKey: trackingStatsQueryKeys.entity(
            "challenge",
            realLog.challenge_id,
          ),
        });
        // Invalidate progress data for challenges too
        queryClient.invalidateQueries({
          queryKey: progressQueryKeys.streak(realLog.challenge_id),
        });
        queryClient.invalidateQueries({
          queryKey: progressQueryKeys.weekProgress(realLog.challenge_id),
        });
        queryClient.invalidateQueries({
          queryKey: [...progressQueryKeys.all, "chain", realLog.challenge_id],
        });
      }
    },
  });
}

/**
 * Hook to log a glass of water (237ml) with optimistic updates
 */
export function useLogGlass() {
  const logHydration = useLogHydration();

  return useMutation({
    mutationFn: async ({
      goalId,
      challengeId,
    }: {
      goalId?: string;
      challengeId?: string;
    }) => {
      return logHydration.mutateAsync({
        amount_ml: HYDRATION_PRESETS.glass,
        goal_id: goalId,
        challenge_id: challengeId,
      });
    },
  });
}

/**
 * Hook to log a bottle of water (500ml) with optimistic updates
 */
export function useLogBottle() {
  const logHydration = useLogHydration();

  return useMutation({
    mutationFn: async ({
      goalId,
      challengeId,
    }: {
      goalId?: string;
      challengeId?: string;
    }) => {
      return logHydration.mutateAsync({
        amount_ml: HYDRATION_PRESETS.bottle,
        goal_id: goalId,
        challenge_id: challengeId,
      });
    },
  });
}

/**
 * Hook to get hydration logs
 */
export function useHydrationLogs(params?: {
  logged_date?: string;
  goal_id?: string;
  challenge_id?: string;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}) {
  const { enabled = true, ...queryParams } = params || {};

  return useQuery({
    queryKey: hydrationLogsQueryKeys.list(queryParams),
    queryFn: async () => {
      const response = await hydrationLogsService.getHydrationLogs(queryParams);
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data as HydrationLog[];
    },
    enabled,
  });
}

/**
 * Hook to get today's hydration logs for a specific goal/challenge
 */
export function useTodaysHydrationLogs(goalId?: string, challengeId?: string) {
  const today = new Date().toISOString().split("T")[0];

  return useHydrationLogs({
    logged_date: today,
    goal_id: goalId,
    challenge_id: challengeId,
    enabled: !!(goalId || challengeId),
  });
}

/**
 * Hook to get daily hydration summary
 */
export function useDailyHydrationSummary(
  date: string,
  goalId?: string,
  challengeId?: string,
) {
  return useQuery({
    queryKey: hydrationLogsQueryKeys.dailySummary(date, goalId, challengeId),
    queryFn: async () => {
      const response = await hydrationLogsService.getDailyHydrationSummary(
        date,
        { goal_id: goalId, challenge_id: challengeId },
      );
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data as DailyHydrationSummary;
    },
    enabled: !!date,
  });
}

/**
 * Hook to get today's hydration summary
 */
export function useTodaysHydrationSummary(
  goalId?: string,
  challengeId?: string,
) {
  const today = new Date().toISOString().split("T")[0];
  return useDailyHydrationSummary(today, goalId, challengeId);
}

/**
 * Hook to delete a hydration log with optimistic updates
 */
export function useDeleteHydrationLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (logId: string) => {
      const response = await hydrationLogsService.deleteHydrationLog(logId);
      if (response.error) {
        throw new Error(response.error);
      }
    },

    onMutate: async (logId) => {
      // Cancel in-flight queries
      await queryClient.cancelQueries({ queryKey: hydrationLogsQueryKeys.all });

      // Get all cached hydration log lists
      const queriesData = queryClient.getQueriesData<HydrationLog[]>({
        queryKey: hydrationLogsQueryKeys.all,
      });

      // Find the log being deleted to update summary
      let deletedLog: HydrationLog | undefined;
      queriesData.forEach(([, data]) => {
        if (Array.isArray(data)) {
          const found = data.find((log) => log.id === logId);
          if (found) deletedLog = found;
        }
      });

      // Remove the hydration log from all cached lists
      queriesData.forEach(([queryKey, oldData]) => {
        if (Array.isArray(oldData)) {
          queryClient.setQueryData(
            queryKey,
            (old: HydrationLog[] | undefined) => {
              if (!old) return old;
              return old.filter((log) => log.id !== logId);
            },
          );
        }
      });

      // Optimistically update summary if we found the deleted log
      if (deletedLog) {
        const logDate = deletedLog.logged_date;
        queryClient.setQueryData(
          hydrationLogsQueryKeys.dailySummary(
            logDate,
            deletedLog.goal_id,
            deletedLog.challenge_id,
          ),
          (old: DailyHydrationSummary | undefined) => {
            if (!old) return old;
            const newTotal = Math.max(
              0,
              old.total_amount_ml - deletedLog!.amount_ml,
            );
            const targetMl = old.target_ml || 2000;
            return {
              ...old,
              total_amount_ml: newTotal,
              log_count: Math.max(0, old.log_count - 1),
              progress_percentage: Math.min(100, (newTotal / targetMl) * 100),
            };
          },
        );
      }

      return { queriesData, deletedLog };
    },

    onError: (err, logId, context) => {
      // Rollback all queries to previous state
      context?.queriesData?.forEach(([queryKey, value]) => {
        queryClient.setQueryData(queryKey, value);
      });
    },

    onSuccess: () => {
      // Invalidate to ensure fresh data from server
      queryClient.invalidateQueries({ queryKey: hydrationLogsQueryKeys.all });
    },
  });
}

// Export presets for use in components
export { HYDRATION_PRESETS };
