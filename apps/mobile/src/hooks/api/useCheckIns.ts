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

// Re-export for backward compatibility
export { checkInsQueryKeys };

// Empty placeholders to prevent loading spinners
const EMPTY_CHECKINS_RESPONSE = { data: [], status: 200 };

// Check-ins Hooks
export const useCheckIns = (goalId?: string, options?: { limit?: number; enabled?: boolean }) => {
  return useQuery({
    queryKey: checkInsQueryKeys.list(goalId),
    queryFn: () => checkInsService.getCheckIns(goalId, { limit: options?.limit ?? 30 }),
    // Enabled: if goalId provided, always enabled; if no goalId, check options.enabled (defaults to false)
    enabled: goalId ? true : (options?.enabled ?? false),
    staleTime: 0, // Refetch immediately when invalidated (realtime updates)
    refetchOnMount: true, // Always check for fresh data on mount
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

      // Snapshot progress data for rollback
      let previousProgressData: ProgressOptimisticContext | undefined;
      if (newCheckIn.goal_id) {
        previousProgressData = snapshotProgressData(queryClient, newCheckIn.goal_id, today);
      }

      // Create optimistic check-in
      const optimisticCheckIn = {
        id: `temp-${Date.now()}`,
        ...newCheckIn,
        check_in_date: newCheckIn.check_in_date || today,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Add to today's check-ins
      queryClient.setQueryData(checkInsQueryKeys.today(), (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: [...old.data, optimisticCheckIn] };
      });

      // Add to goal's check-ins
      queryClient.setQueryData(checkInsQueryKeys.list(newCheckIn.goal_id), (old: any) => {
        if (!old?.data) return old;
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

      return {
        previousTodayCheckIns,
        previousGoalCheckIns,
        previousDashboard,
        previousProgressData,
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
    },
    onSuccess: (response, variables) => {
      // Replace optimistic with real data
      const realCheckIn = response?.data;
      if (realCheckIn) {
        queryClient.setQueryData(checkInsQueryKeys.today(), (old: any) => {
          if (!old?.data) return old;
          // Filter out temp IDs AND the real ID (in case realtime already added it)
          const filtered = old.data.filter(
            (c: any) => !c.id?.startsWith?.("temp-") && c.id !== realCheckIn.id
          );
          return { ...old, data: [...filtered, realCheckIn] };
        });

        queryClient.setQueryData(checkInsQueryKeys.list(variables.goal_id), (old: any) => {
          if (!old?.data) return old;
          // Filter out temp IDs AND the real ID (in case realtime already added it)
          const filtered = old.data.filter(
            (c: any) => !c.id?.startsWith?.("temp-") && c.id !== realCheckIn.id
          );
          return { ...old, data: [...filtered, realCheckIn] };
        });

        // Note: No need to update insights checkins_count here.
        // With pre-created pending check-ins, the count already includes today's check-in.
        // User responding updates the existing check-in, not creating a new one.
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
      }
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
