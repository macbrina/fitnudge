import { checkInsService, CreateCheckInRequest, UpdateCheckInRequest } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import {
  cancelProgressQueries,
  optimisticallyUpdateProgress,
  ProgressOptimisticContext,
  rollbackProgressData,
  snapshotProgressData
} from "./progressOptimisticUpdates";
import { homeDashboardQueryKeys } from "./useHomeDashboard";
// trackingStatsQueryKeys removed in V2
// Import from shared queryKeys to avoid circular dependency
import { checkInsQueryKeys, goalsQueryKeys } from "./queryKeys";
import { liveSurfaceManager } from "@/features/nextUp/LiveSurfaceManager";

// Re-export for backward compatibility
export { checkInsQueryKeys };

// Empty placeholders to prevent loading spinners
const EMPTY_CHECKINS_RESPONSE = { data: [], status: 200 };

// Check-ins Hooks
export const useCheckIns = (
  goalId?: string,
  options?: { limit?: number; enabled?: boolean; staleTime?: number }
) => {
  return useQuery({
    queryKey: checkInsQueryKeys.list(goalId),
    queryFn: () => checkInsService.getCheckIns(goalId, { limit: options?.limit ?? 30 }),
    // Enabled: if goalId provided, always enabled; if no goalId, check options.enabled (defaults to false)
    enabled: goalId ? true : (options?.enabled ?? false),
    // Short staleTime to avoid refetch-on-mount spam when screen remounts (e.g. navigation).
    // Realtime invalidate still triggers immediate refetch. 30s is enough to dedupe rapid remounts.
    staleTime: options?.staleTime ?? 30 * 1000,
    refetchOnMount: true, // Refetch when stale (e.g. after 30s or when invalidated)
    placeholderData: EMPTY_CHECKINS_RESPONSE
  });
};

export const useCheckIn = (checkInId: string) => {
  return useQuery({
    queryKey: checkInsQueryKeys.detail(checkInId),
    queryFn: () => checkInsService.getCheckIn(checkInId),
    enabled: !!checkInId,
    staleTime: 1 * 60 * 1000 // 1 minute
  });
};

export const useCreateCheckIn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (checkIn: CreateCheckInRequest) => checkInsService.createCheckIn(checkIn),
    // Optimistic update for instant UI feedback
    onMutate: async (newCheckIn) => {
      // Use LOCAL date to match progressOptimisticUpdates which uses formatLocalDate
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: checkInsQueryKeys.all });
      await queryClient.cancelQueries({ queryKey: checkInsQueryKeys.today() });
      await queryClient.cancelQueries({
        queryKey: checkInsQueryKeys.list(newCheckIn.goal_id)
      });
      await queryClient.cancelQueries({
        queryKey: homeDashboardQueryKeys.dashboard()
      });

      // Cancel progress queries for optimistic updates
      if (newCheckIn.goal_id) {
        await cancelProgressQueries(queryClient, newCheckIn.goal_id);
      }

      // Snapshot previous data
      const previousTodayCheckIns = queryClient.getQueryData(checkInsQueryKeys.today());
      const previousGoalCheckIns = queryClient.getQueryData(
        checkInsQueryKeys.list(newCheckIn.goal_id)
      );
      const previousDashboard = queryClient.getQueryData(homeDashboardQueryKeys.dashboard());
      const previousDateRangeQueries = newCheckIn.goal_id
        ? queryClient.getQueriesData({ queryKey: checkInsQueryKeys.all })
        : [];
      const previousInsights = newCheckIn.goal_id
        ? queryClient.getQueryData(goalsQueryKeys.insights(newCheckIn.goal_id))
        : undefined;

      // Snapshot progress data for rollback
      let previousProgressData: ProgressOptimisticContext | undefined;
      if (newCheckIn.goal_id) {
        previousProgressData = snapshotProgressData(queryClient, newCheckIn.goal_id, today);
      }

      const optimisticStatus = newCheckIn.is_rest_day
        ? "rest_day"
        : newCheckIn.completed
          ? "completed"
          : "skipped";

      // Create optimistic check-in
      const optimisticCheckIn = {
        id: `temp-${Date.now()}`,
        ...newCheckIn,
        status: optimisticStatus,
        check_in_date: newCheckIn.check_in_date || today,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Add to today's check-ins
      queryClient.setQueryData(checkInsQueryKeys.today(), (old: any) => {
        if (!old?.data) return old;
        const existingIdx = old.data.findIndex(
          (c: any) =>
            c.goal_id === optimisticCheckIn.goal_id &&
            c.check_in_date === optimisticCheckIn.check_in_date
        );
        if (existingIdx >= 0) {
          const next = [...old.data];
          next[existingIdx] = optimisticCheckIn;
          return { ...old, data: next };
        }
        return { ...old, data: [...old.data, optimisticCheckIn] };
      });

      // Add to goal's check-ins
      queryClient.setQueryData(checkInsQueryKeys.list(newCheckIn.goal_id), (old: any) => {
        if (!old?.data) return old;
        const existingIdx = old.data.findIndex(
          (c: any) =>
            c.goal_id === optimisticCheckIn.goal_id &&
            c.check_in_date === optimisticCheckIn.check_in_date
        );
        if (existingIdx >= 0) {
          const next = [...old.data];
          next[existingIdx] = optimisticCheckIn;
          return { ...old, data: next };
        }
        return { ...old, data: [...old.data, optimisticCheckIn] };
      });

      // Optimistically update home dashboard - remove from pending check-ins
      queryClient.setQueryData(homeDashboardQueryKeys.dashboard(), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          today_pending_checkins: (old.today_pending_checkins || []).filter(
            (c: any) => !(c.type === "goal" && c.data?.goal_id === newCheckIn.goal_id)
          )
        };
      });

      // Optimistically update progress data (streak, week, chain)
      if (newCheckIn.goal_id) {
        optimisticallyUpdateProgress(
          queryClient,
          newCheckIn.goal_id,
          today,
          newCheckIn.completed,
          newCheckIn.is_rest_day
        );
      }

      // Optimistically bump insights checkins_count (insufficient_data UI)
      // AND set status to "generating" only if we have enough check-ins (>= min_required)
      if (newCheckIn.goal_id) {
        queryClient.setQueryData(goalsQueryKeys.insights(newCheckIn.goal_id), (old: any) => {
          if (!old) {
            // Query hasn't been fetched yet - create optimistic entry
            // Don't set to generating if we don't know min_required yet
            return {
              data: {
                goal_id: newCheckIn.goal_id,
                status: "insufficient_data",
                insights: [],
                checkins_count: 1
              },
              status: 200
            };
          }

          if (!old.data) {
            // Data doesn't exist yet - create optimistic entry
            // Don't set to generating if we don't know min_required yet
            return {
              ...old,
              data: {
                goal_id: newCheckIn.goal_id,
                status: "insufficient_data",
                insights: [],
                checkins_count: 1
              }
            };
          }

          // Calculate new checkins_count
          const newCheckinsCount =
            typeof old.data.checkins_count === "number" ? old.data.checkins_count + 1 : 1;

          // Get min_required - try to calculate if not available
          let minRequired = old.data.min_required;
          if (minRequired === null || minRequired === undefined) {
            // Try to get from goal data if available
            const goalData = queryClient.getQueryData(
              goalsQueryKeys.detail(newCheckIn.goal_id)
            ) as any;
            const frequencyCount = goalData?.data?.frequency_count ?? 7;
            // Calculate using same formula as backend: max(3, min(7, frequency_count * 2))
            const twoWeeksWorth = frequencyCount * 2;
            minRequired = Math.max(3, Math.min(7, twoWeeksWorth));
          }

          // Only set to "generating" if we have enough check-ins
          const shouldGenerate = newCheckinsCount >= minRequired;

          // Update existing insights data
          const updatedData = {
            ...old.data,
            status: shouldGenerate
              ? ("generating" as const) // Set to generating only if enough check-ins
              : ("insufficient_data" as const), // Keep as insufficient_data if not enough
            checkins_count: newCheckinsCount,
            // Preserve min_required so it's available for future check-ins
            min_required: minRequired
          };

          return {
            ...old,
            data: updatedData
          };
        });
      }

      // Optimistically update any cached dateRange queries (used by SingleGoalScreen stats)
      if (newCheckIn.goal_id) {
        const optimisticDate = optimisticCheckIn.check_in_date;
        const dateRangeQueries = queryClient.getQueriesData({ queryKey: checkInsQueryKeys.all });
        for (const [key] of dateRangeQueries) {
          const k = key as unknown as (string | undefined)[];
          if (k[0] !== "checkIns" || k[1] !== "dateRange") continue;
          const start = k[2] as string | undefined;
          const end = k[3] as string | undefined;
          const goalId = k[4] as string | undefined;
          if (!start || !end || goalId !== newCheckIn.goal_id) continue;
          if (optimisticDate < start || optimisticDate > end) continue;

          queryClient.setQueryData(key, (old: any) => {
            if (!old?.data) return old;
            const existingIdx = old.data.findIndex(
              (c: any) =>
                c.goal_id === optimisticCheckIn.goal_id &&
                c.check_in_date === optimisticCheckIn.check_in_date
            );
            if (existingIdx >= 0) {
              const next = [...old.data];
              next[existingIdx] = optimisticCheckIn;
              return { ...old, data: next };
            }
            return { ...old, data: [...old.data, optimisticCheckIn] };
          });
        }
      }

      return {
        previousTodayCheckIns,
        previousGoalCheckIns,
        previousDashboard,
        previousProgressData,
        previousDateRangeQueries,
        previousInsights,
        goalId: newCheckIn.goal_id
      };
    },
    onError: (err, newCheckIn, context) => {
      // Rollback on error
      if (context?.previousTodayCheckIns) {
        queryClient.setQueryData(checkInsQueryKeys.today(), context.previousTodayCheckIns);
      }
      if (context?.previousGoalCheckIns) {
        queryClient.setQueryData(
          checkInsQueryKeys.list(newCheckIn.goal_id),
          context.previousGoalCheckIns
        );
      }
      if (context?.previousDashboard) {
        queryClient.setQueryData(homeDashboardQueryKeys.dashboard(), context.previousDashboard);
      }
      // Rollback progress data
      if (context?.previousProgressData) {
        rollbackProgressData(queryClient, context.previousProgressData);
      }
      if (context?.goalId && context?.previousInsights !== undefined) {
        queryClient.setQueryData(goalsQueryKeys.insights(context.goalId), context.previousInsights);
      }
      if (context?.previousDateRangeQueries?.length) {
        for (const [key, data] of context.previousDateRangeQueries) {
          queryClient.setQueryData(key, data);
        }
      }
      // Refresh persistent "Next up" surface after rollback.
      liveSurfaceManager
        .updateFromQueryClient(queryClient)
        .catch((e) => console.warn("[NextUp] update failed:", e));
    },
    onSuccess: (response, variables) => {
      // Replace optimistic with real data
      const realCheckIn = response?.data;
      if (realCheckIn) {
        queryClient.setQueryData(checkInsQueryKeys.today(), (old: any) => {
          if (!old?.data) return old;
          const idx = old.data.findIndex((c: any) => c.id?.startsWith?.("temp-"));
          if (idx >= 0) {
            const next = [...old.data];
            next[idx] = realCheckIn;
            return { ...old, data: next };
          }
          const existingIdx = old.data.findIndex(
            (c: any) =>
              c.goal_id === realCheckIn.goal_id && c.check_in_date === realCheckIn.check_in_date
          );
          if (existingIdx >= 0) {
            const next = [...old.data];
            next[existingIdx] = realCheckIn;
            return { ...old, data: next };
          }

          const filtered = old.data.filter((c: any) => c.id !== realCheckIn.id);
          return { ...old, data: [...filtered, realCheckIn] };
        });

        queryClient.setQueryData(checkInsQueryKeys.list(variables.goal_id), (old: any) => {
          if (!old?.data) return old;
          const idx = old.data.findIndex((c: any) => c.id?.startsWith?.("temp-"));
          if (idx >= 0) {
            const next = [...old.data];
            next[idx] = realCheckIn;
            return { ...old, data: next };
          }
          const existingIdx = old.data.findIndex(
            (c: any) =>
              c.goal_id === realCheckIn.goal_id && c.check_in_date === realCheckIn.check_in_date
          );
          if (existingIdx >= 0) {
            const next = [...old.data];
            next[existingIdx] = realCheckIn;
            return { ...old, data: next };
          }
          const filtered = old.data.filter((c: any) => c.id !== realCheckIn.id);
          return { ...old, data: [...filtered, realCheckIn] };
        });

        // Replace optimistic in any cached dateRange queries
        const dateRangeQueries = queryClient.getQueriesData({ queryKey: checkInsQueryKeys.all });
        for (const [key] of dateRangeQueries) {
          const k = key as unknown as (string | undefined)[];
          if (k[0] !== "checkIns" || k[1] !== "dateRange") continue;
          const start = k[2] as string | undefined;
          const end = k[3] as string | undefined;
          const goalId = k[4] as string | undefined;
          if (!start || !end || goalId !== variables.goal_id) continue;
          if (realCheckIn.check_in_date < start || realCheckIn.check_in_date > end) continue;

          queryClient.setQueryData(key, (old: any) => {
            if (!old?.data) return old;
            const idx = old.data.findIndex((c: any) => c.id?.startsWith?.("temp-"));
            if (idx >= 0) {
              const next = [...old.data];
              next[idx] = realCheckIn;
              return { ...old, data: next };
            }
            const existingIdx = old.data.findIndex(
              (c: any) =>
                c.goal_id === realCheckIn.goal_id && c.check_in_date === realCheckIn.check_in_date
            );
            if (existingIdx >= 0) {
              const next = [...old.data];
              next[existingIdx] = realCheckIn;
              return { ...old, data: next };
            }
            const filtered = old.data.filter((c: any) => c.id !== realCheckIn.id);
            return { ...old, data: [...filtered, realCheckIn] };
          });
        }

        // Insights checkins_count already updated optimistically in onMutate.
      }

      // Invalidate home dashboard
      queryClient.invalidateQueries({ queryKey: homeDashboardQueryKeys.dashboard() });
      // Invalidate goals lists (GoalCard shows today_checkin_status, streaks)
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.list() });
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.active() });
      // Note: Partner invalidation is handled by DB trigger → Realtime → handleAccountabilityPartnersChange
      // Goal-specific invalidations
      if (variables.goal_id) {
        queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.streak(variables.goal_id) });
        queryClient.invalidateQueries({ queryKey: goalsQueryKeys.detail(variables.goal_id) });
        // Invalidate dateRange (last-30) so SingleGoalScreen completion rate refetches and includes new check-in
        queryClient.invalidateQueries({
          predicate: (query) => {
            const k = query.queryKey as unknown[];
            return (
              Array.isArray(k) &&
              k[0] === "checkIns" &&
              k[1] === "dateRange" &&
              k[4] === variables.goal_id
            );
          }
        });
      }

      // Event-driven: update persistent "Next up" surface immediately from cache.
      liveSurfaceManager
        .updateFromQueryClient(queryClient)
        .catch((e) => console.warn("[NextUp] update failed:", e));
    }
  });
};

export const useUpdateCheckIn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ checkInId, updates }: { checkInId: string; updates: UpdateCheckInRequest }) =>
      checkInsService.updateCheckIn(checkInId, updates),
    // Optimistic update for instant UI feedback on check-in
    onMutate: async ({ checkInId, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: checkInsQueryKeys.all });
      await queryClient.cancelQueries({ queryKey: checkInsQueryKeys.today() });

      // Snapshot previous data
      const previousTodayCheckIns = queryClient.getQueryData<any>(checkInsQueryKeys.today());
      const previousDetail = queryClient.getQueryData(checkInsQueryKeys.detail(checkInId));

      // Find the goal_id from the cached check-in
      const existingCheckIn = previousTodayCheckIns?.data?.find((c: any) => c.id === checkInId);
      const goalId = existingCheckIn?.goal_id;
      // Use LOCAL date to match progressOptimisticUpdates which uses formatLocalDate
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      // Cancel and snapshot progress queries for optimistic updates
      let previousProgressData: ProgressOptimisticContext | undefined;
      if (goalId) {
        await cancelProgressQueries(queryClient, goalId);
        previousProgressData = snapshotProgressData(queryClient, goalId, today);
      }

      // Optimistically update today's check-ins
      queryClient.setQueryData(checkInsQueryKeys.today(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((c: any) =>
            c.id === checkInId
              ? {
                  ...c,
                  ...updates,
                  is_checked_in: true,
                  updated_at: new Date().toISOString()
                }
              : c
          )
        };
      });

      // Update detail cache if it exists
      queryClient.setQueryData(checkInsQueryKeys.detail(checkInId), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: {
            ...old.data,
            ...updates,
            is_checked_in: true,
            updated_at: new Date().toISOString()
          }
        };
      });

      // Optimistically update progress data (streak, week, chain)
      if (goalId && updates.completed !== undefined) {
        optimisticallyUpdateProgress(
          queryClient,
          goalId,
          today,
          updates.completed,
          updates.is_rest_day
        );
      }

      return {
        previousTodayCheckIns,
        previousDetail,
        previousProgressData,
        checkInId,
        goalId
      };
    },
    onError: (err, { checkInId }, context) => {
      // Rollback on error
      if (context?.previousTodayCheckIns) {
        queryClient.setQueryData(checkInsQueryKeys.today(), context.previousTodayCheckIns);
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(checkInsQueryKeys.detail(checkInId), context.previousDetail);
      }
      // Rollback progress data
      if (context?.previousProgressData) {
        rollbackProgressData(queryClient, context.previousProgressData);
      }
      liveSurfaceManager
        .updateFromQueryClient(queryClient)
        .catch((e) => console.warn("[NextUp] update failed:", e));
    },
    onSuccess: (response, { checkInId }, context) => {
      const goalId = context?.goalId;

      // Update with real server response
      const updatedCheckIn = response?.data;
      if (updatedCheckIn) {
        queryClient.setQueryData(checkInsQueryKeys.today(), (old: any) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((c: any) => (c.id === checkInId ? updatedCheckIn : c))
          };
        });

        queryClient.setQueryData(checkInsQueryKeys.detail(checkInId), (old: any) => ({
          ...old,
          data: updatedCheckIn
        }));
      }

      // Invalidate stats and progress data (these need real recalculation from server)
      queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.stats() });
      queryClient.invalidateQueries({ queryKey: ["progress"] });
      queryClient.invalidateQueries({ queryKey: ["user", "stats"] });
      // Invalidate home dashboard
      queryClient.invalidateQueries({ queryKey: homeDashboardQueryKeys.dashboard() });
      // Invalidate goals lists (GoalCard shows today_checkin_status, streaks)
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.list() });
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.active() });
      // Note: Partner invalidation is handled by DB trigger → Realtime → handleAccountabilityPartnersChange
      // Goal-specific invalidations
      if (goalId) {
        queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.streak(goalId) });
        queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.list(goalId) });
        queryClient.invalidateQueries({ queryKey: goalsQueryKeys.detail(goalId) });
      }

      liveSurfaceManager
        .updateFromQueryClient(queryClient)
        .catch((e) => console.warn("[NextUp] update failed:", e));
    }
  });
};

export const useDeleteCheckIn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (checkInId: string) => checkInsService.deleteCheckIn(checkInId),
    // Optimistic update for instant UI feedback
    onMutate: async (checkInId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: checkInsQueryKeys.all });
      await queryClient.cancelQueries({ queryKey: checkInsQueryKeys.today() });

      // Snapshot previous data and find the goal_id before removal
      const previousTodayCheckIns = queryClient.getQueryData(checkInsQueryKeys.today()) as any;
      let deletedCheckIn = previousTodayCheckIns?.data?.find((c: any) => c.id === checkInId);
      let goalId = deletedCheckIn?.goal_id;

      // If not in today's cache, search all check-in caches (e.g., SingleGoalScreen history)
      if (!goalId) {
        const allQueries = queryClient.getQueriesData({ queryKey: checkInsQueryKeys.all });
        for (const [, data] of allQueries) {
          const queryData = data as any;
          const found = queryData?.data?.find?.((c: any) => c.id === checkInId);
          if (found?.goal_id) {
            deletedCheckIn = found;
            goalId = found.goal_id;
            break;
          }
        }
      }

      // Cancel goal-specific queries if we have goalId
      if (goalId) {
        await queryClient.cancelQueries({ queryKey: checkInsQueryKeys.list(goalId) });
        await queryClient.cancelQueries({ queryKey: checkInsQueryKeys.streak(goalId) });
        await queryClient.cancelQueries({ queryKey: goalsQueryKeys.detail(goalId) });
      }

      // Optimistically remove from today's check-ins
      queryClient.setQueryData(checkInsQueryKeys.today(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((c: any) => c.id !== checkInId)
        };
      });

      // Optimistically remove from goal-specific check-ins
      if (goalId) {
        queryClient.setQueryData(checkInsQueryKeys.list(goalId), (old: any) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.filter((c: any) => c.id !== checkInId)
          };
        });
      }

      return { previousTodayCheckIns, goalId };
    },
    onError: (err, checkInId, context) => {
      // Rollback on error
      if (context?.previousTodayCheckIns) {
        queryClient.setQueryData(checkInsQueryKeys.today(), context.previousTodayCheckIns);
      }
      liveSurfaceManager
        .updateFromQueryClient(queryClient)
        .catch((e) => console.warn("[NextUp] update failed:", e));
    },
    onSuccess: (_, __, context) => {
      const goalId = context?.goalId;

      // Invalidate stats for recalculation
      queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.stats() });
      queryClient.invalidateQueries({ queryKey: ["progress"] });
      queryClient.invalidateQueries({ queryKey: ["user", "stats"] });
      // Invalidate goals lists (GoalCard shows today_checkin_status, streaks)
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.list() });
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.active() });
      // Invalidate home dashboard
      queryClient.invalidateQueries({ queryKey: homeDashboardQueryKeys.dashboard() });
      // Note: Partner invalidation is handled by DB trigger → Realtime → handleAccountabilityPartnersChange

      // Goal-specific invalidations
      if (goalId) {
        queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.streak(goalId) });
        queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.list(goalId) });
        queryClient.invalidateQueries({ queryKey: goalsQueryKeys.detail(goalId) });
      }

      liveSurfaceManager
        .updateFromQueryClient(queryClient)
        .catch((e) => console.warn("[NextUp] update failed:", e));
    }
  });
};

export const useCheckInStats = (goalId?: string) => {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: checkInsQueryKeys.stats(goalId),
    queryFn: () => checkInsService.getCheckInStats(goalId),
    enabled: isAuthenticated,
    staleTime: 0, // Refetch immediately when invalidated (realtime updates)
    refetchOnMount: true, // Always check for fresh data on mount
    placeholderData: {
      data: {
        total_check_ins: 0,
        completed_check_ins: 0,
        current_streak: 0,
        longest_streak: 0,
        completion_rate: 0,
        most_productive_day: "",
        most_productive_time: ""
      },
      status: 200
    }
  });
};

export const useCheckInCalendar = (year: number, month: number, goalId?: string) => {
  return useQuery({
    queryKey: checkInsQueryKeys.calendar(year, month, goalId),
    queryFn: () => checkInsService.getCheckInCalendar(year, month, goalId),
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
};

export const useCheckInsByDateRange = (startDate: string, endDate: string, goalId?: string) => {
  return useQuery({
    queryKey: [...checkInsQueryKeys.all, "dateRange", startDate, endDate, goalId],
    queryFn: () => checkInsService.getCheckInsByDateRange(startDate, endDate, goalId),
    enabled: !!startDate && !!endDate,
    staleTime: 2 * 60 * 1000 // 2 minutes
  });
};

export const useTodayCheckIns = () => {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: checkInsQueryKeys.today(),
    queryFn: () => checkInsService.getTodayCheckIns(),
    enabled: isAuthenticated,
    staleTime: 0, // Refetch immediately when invalidated (realtime updates)
    refetchInterval: isAuthenticated ? 60 * 1000 : false,
    refetchOnMount: true, // Always check for fresh data on mount
    placeholderData: EMPTY_CHECKINS_RESPONSE
  });
};

export const useStreakData = (goalId?: string) => {
  return useQuery({
    queryKey: checkInsQueryKeys.streak(goalId),
    queryFn: () => checkInsService.getStreakData(goalId),
    staleTime: 0 // refetch immediately when invalidated (realtime updates)
  });
};

export const useBulkCreateCheckIns = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (checkIns: CreateCheckInRequest[]) => checkInsService.bulkCreateCheckIns(checkIns),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.all });
      // Invalidate home dashboard
      queryClient.invalidateQueries({
        queryKey: homeDashboardQueryKeys.dashboard()
      });
    }
  });
};

export const useMoodTrends = (goalId?: string, days: number = 30) => {
  return useQuery({
    queryKey: checkInsQueryKeys.moodTrends(goalId, days),
    queryFn: () => checkInsService.getMoodTrends(goalId, days),
    staleTime: 0 // refetch immediately when invalidated (realtime updates)
  });
};

/**
 * Infinite scroll hook for check-ins history
 * Supports pagination with offset-based loading
 */
export const useInfiniteCheckIns = (
  goalId: string,
  pageSize: number = 20,
  excludePending: boolean = true
) => {
  return useInfiniteQuery({
    queryKey: [...checkInsQueryKeys.list(goalId), "infinite", excludePending],
    queryFn: async ({ pageParam = 0 }) => {
      const response = await checkInsService.getCheckIns(goalId, {
        limit: pageSize,
        offset: pageParam,
        excludePending // Exclude pending by default for history views
      });
      return response;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      // If we got fewer items than pageSize, we've reached the end
      const items = lastPage.data || [];
      if (items.length < pageSize) {
        return undefined;
      }
      // Calculate next offset
      return allPages.reduce((acc, page) => acc + (page.data?.length || 0), 0);
    },
    enabled: !!goalId,
    staleTime: 0
  });
};
