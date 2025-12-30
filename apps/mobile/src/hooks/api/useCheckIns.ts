import {
  checkInsService,
  CreateCheckInRequest,
  UpdateCheckInRequest,
} from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelProgressQueries,
  optimisticallyUpdateProgress,
  ProgressOptimisticContext,
  rollbackProgressData,
  snapshotProgressData,
} from "./progressOptimisticUpdates";
import { homeDashboardQueryKeys } from "./useHomeDashboard";
import { trackingStatsQueryKeys } from "./useTrackingStats";
// Import from shared queryKeys to avoid circular dependency
import { checkInsQueryKeys } from "./queryKeys";

// Re-export for backward compatibility
export { checkInsQueryKeys };

// Empty placeholders to prevent loading spinners
const EMPTY_CHECKINS_RESPONSE = { data: [], status: 200 };

// Check-ins Hooks
export const useCheckIns = (goalId?: string) => {
  return useQuery({
    queryKey: checkInsQueryKeys.list(goalId),
    queryFn: () => checkInsService.getCheckIns(goalId),
    staleTime: 0, // Refetch immediately when invalidated (realtime updates)
    refetchOnMount: false,
    placeholderData: EMPTY_CHECKINS_RESPONSE,
  });
};

export const useCheckIn = (checkInId: string) => {
  return useQuery({
    queryKey: checkInsQueryKeys.detail(checkInId),
    queryFn: () => checkInsService.getCheckIn(checkInId),
    enabled: !!checkInId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
};

export const useCreateCheckIn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (checkIn: CreateCheckInRequest) =>
      checkInsService.createCheckIn(checkIn),
    // Optimistic update for instant UI feedback
    onMutate: async (newCheckIn) => {
      // Use LOCAL date to match progressOptimisticUpdates which uses formatLocalDate
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: checkInsQueryKeys.all });
      await queryClient.cancelQueries({ queryKey: checkInsQueryKeys.today() });
      await queryClient.cancelQueries({
        queryKey: checkInsQueryKeys.list(newCheckIn.goal_id),
      });
      await queryClient.cancelQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
      });

      // Cancel progress queries for optimistic updates
      if (newCheckIn.goal_id) {
        await cancelProgressQueries(queryClient, newCheckIn.goal_id, "goal");
      }

      // Snapshot previous data
      const previousTodayCheckIns = queryClient.getQueryData(
        checkInsQueryKeys.today(),
      );
      const previousGoalCheckIns = queryClient.getQueryData(
        checkInsQueryKeys.list(newCheckIn.goal_id),
      );
      const previousDashboard = queryClient.getQueryData(
        homeDashboardQueryKeys.dashboard(),
      );

      // Snapshot progress data for rollback
      let previousProgressData: ProgressOptimisticContext | undefined;
      if (newCheckIn.goal_id) {
        previousProgressData = snapshotProgressData(
          queryClient,
          newCheckIn.goal_id,
          today,
          "goal",
        );
      }

      // Create optimistic check-in
      const optimisticCheckIn = {
        id: `temp-${Date.now()}`,
        ...newCheckIn,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_checked_in: false,
      };

      // Add to today's check-ins
      queryClient.setQueryData(checkInsQueryKeys.today(), (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: [...old.data, optimisticCheckIn] };
      });

      // Add to goal's check-ins
      queryClient.setQueryData(
        checkInsQueryKeys.list(newCheckIn.goal_id),
        (old: any) => {
          if (!old?.data) return old;
          return { ...old, data: [...old.data, optimisticCheckIn] };
        },
      );

      // Optimistically update home dashboard
      queryClient.setQueryData(
        homeDashboardQueryKeys.dashboard(),
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            // Remove this goal from pending check-ins
            today_pending_checkins: (old.today_pending_checkins || []).filter(
              (c: any) =>
                !(c.type === "goal" && c.data?.goal_id === newCheckIn.goal_id),
            ),
            // Optimistically update stats
            stats: old.stats
              ? {
                  ...old.stats,
                  total_check_ins: (old.stats.total_check_ins || 0) + 1,
                }
              : old.stats,
          };
        },
      );

      // Optimistically update progress data (streak, week, chain)
      if (newCheckIn.goal_id) {
        optimisticallyUpdateProgress(queryClient, newCheckIn.goal_id, today);
      }

      return {
        previousTodayCheckIns,
        previousGoalCheckIns,
        previousDashboard,
        previousProgressData,
        goalId: newCheckIn.goal_id,
      };
    },
    onError: (err, newCheckIn, context) => {
      // Rollback on error
      if (context?.previousTodayCheckIns) {
        queryClient.setQueryData(
          checkInsQueryKeys.today(),
          context.previousTodayCheckIns,
        );
      }
      if (context?.previousGoalCheckIns) {
        queryClient.setQueryData(
          checkInsQueryKeys.list(newCheckIn.goal_id),
          context.previousGoalCheckIns,
        );
      }
      if (context?.previousDashboard) {
        queryClient.setQueryData(
          homeDashboardQueryKeys.dashboard(),
          context.previousDashboard,
        );
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
          const filtered = old.data.filter(
            (c: any) => !c.id?.startsWith?.("temp-"),
          );
          return { ...old, data: [...filtered, realCheckIn] };
        });

        queryClient.setQueryData(
          checkInsQueryKeys.list(variables.goal_id),
          (old: any) => {
            if (!old?.data) return old;
            const filtered = old.data.filter(
              (c: any) => !c.id?.startsWith?.("temp-"),
            );
            return { ...old, data: [...filtered, realCheckIn] };
          },
        );
      }

      // Invalidate home dashboard (shows both goals and challenges)
      queryClient.invalidateQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
      });
    },
  });
};

export const useUpdateCheckIn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      checkInId,
      updates,
    }: {
      checkInId: string;
      updates: UpdateCheckInRequest;
    }) => checkInsService.updateCheckIn(checkInId, updates),
    // Optimistic update for instant UI feedback on check-in
    onMutate: async ({ checkInId, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: checkInsQueryKeys.all });
      await queryClient.cancelQueries({ queryKey: checkInsQueryKeys.today() });

      // Snapshot previous data
      const previousTodayCheckIns = queryClient.getQueryData<any>(
        checkInsQueryKeys.today(),
      );
      const previousDetail = queryClient.getQueryData(
        checkInsQueryKeys.detail(checkInId),
      );

      // Find the goal_id from the cached check-in
      const existingCheckIn = previousTodayCheckIns?.data?.find(
        (c: any) => c.id === checkInId,
      );
      const goalId = existingCheckIn?.goal_id;
      // Use LOCAL date to match progressOptimisticUpdates which uses formatLocalDate
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      // Cancel and snapshot progress queries for optimistic updates
      let previousProgressData: ProgressOptimisticContext | undefined;
      if (goalId) {
        await cancelProgressQueries(queryClient, goalId, "goal");
        previousProgressData = snapshotProgressData(
          queryClient,
          goalId,
          today,
          "goal",
        );
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
                  updated_at: new Date().toISOString(),
                }
              : c,
          ),
        };
      });

      // Update detail cache if it exists
      queryClient.setQueryData(
        checkInsQueryKeys.detail(checkInId),
        (old: any) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: {
              ...old.data,
              ...updates,
              is_checked_in: true,
              updated_at: new Date().toISOString(),
            },
          };
        },
      );

      // Optimistically update progress data (streak, week, chain)
      if (goalId) {
        optimisticallyUpdateProgress(queryClient, goalId, today);
      }

      return {
        previousTodayCheckIns,
        previousDetail,
        previousProgressData,
        checkInId,
        goalId,
      };
    },
    onError: (err, { checkInId }, context) => {
      // Rollback on error
      if (context?.previousTodayCheckIns) {
        queryClient.setQueryData(
          checkInsQueryKeys.today(),
          context.previousTodayCheckIns,
        );
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(
          checkInsQueryKeys.detail(checkInId),
          context.previousDetail,
        );
      }
      // Rollback progress data
      if (context?.previousProgressData) {
        rollbackProgressData(queryClient, context.previousProgressData);
      }
    },
    onSuccess: (response, { checkInId }) => {
      // Update with real server response
      const updatedCheckIn = response?.data;
      if (updatedCheckIn) {
        queryClient.setQueryData(checkInsQueryKeys.today(), (old: any) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((c: any) =>
              c.id === checkInId ? updatedCheckIn : c,
            ),
          };
        });

        queryClient.setQueryData(
          checkInsQueryKeys.detail(checkInId),
          (old: any) => ({
            ...old,
            data: updatedCheckIn,
          }),
        );
      }

      // Invalidate stats and progress data (these need real recalculation from server)
      queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.stats() });
      queryClient.invalidateQueries({ queryKey: ["progress"] });
      queryClient.invalidateQueries({ queryKey: ["user", "stats"] });
      // Invalidate home dashboard (shows both goals and challenges)
      queryClient.invalidateQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
      });
      // Invalidate tracking stats for checkin progress display
      queryClient.invalidateQueries({
        queryKey: trackingStatsQueryKeys.all,
      });
    },
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

      // Snapshot previous data
      const previousTodayCheckIns = queryClient.getQueryData(
        checkInsQueryKeys.today(),
      );

      // Optimistically remove from today's check-ins
      queryClient.setQueryData(checkInsQueryKeys.today(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((c: any) => c.id !== checkInId),
        };
      });

      return { previousTodayCheckIns };
    },
    onError: (err, checkInId, context) => {
      // Rollback on error
      if (context?.previousTodayCheckIns) {
        queryClient.setQueryData(
          checkInsQueryKeys.today(),
          context.previousTodayCheckIns,
        );
      }
    },
    onSuccess: () => {
      // Invalidate stats for recalculation
      queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.stats() });
      queryClient.invalidateQueries({ queryKey: ["progress"] });
      queryClient.invalidateQueries({ queryKey: ["user", "stats"] });
      // Invalidate home dashboard (shows both goals and challenges)
      queryClient.invalidateQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
      });
    },
  });
};

export const useCheckInStats = (goalId?: string) => {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: checkInsQueryKeys.stats(goalId),
    queryFn: () => checkInsService.getCheckInStats(goalId),
    enabled: isAuthenticated,
    staleTime: 0, // Refetch immediately when invalidated (realtime updates)
    refetchOnMount: false,
    placeholderData: {
      data: {
        total_check_ins: 0,
        completed_check_ins: 0,
        current_streak: 0,
        longest_streak: 0,
        completion_rate: 0,
        most_productive_day: "",
        most_productive_time: "",
      },
      status: 200,
    },
  });
};

export const useCheckInCalendar = (
  year: number,
  month: number,
  goalId?: string,
) => {
  return useQuery({
    queryKey: checkInsQueryKeys.calendar(year, month, goalId),
    queryFn: () => checkInsService.getCheckInCalendar(year, month, goalId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCheckInsByDateRange = (
  startDate: string,
  endDate: string,
  goalId?: string,
) => {
  return useQuery({
    queryKey: [
      ...checkInsQueryKeys.all,
      "dateRange",
      startDate,
      endDate,
      goalId,
    ],
    queryFn: () =>
      checkInsService.getCheckInsByDateRange(startDate, endDate, goalId),
    enabled: !!startDate && !!endDate,
    staleTime: 2 * 60 * 1000, // 2 minutes
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
    refetchOnMount: false,
    placeholderData: EMPTY_CHECKINS_RESPONSE,
  });
};

export const useStreakData = (goalId?: string) => {
  return useQuery({
    queryKey: checkInsQueryKeys.streak(goalId),
    queryFn: () => checkInsService.getStreakData(goalId),
    staleTime: 0, // refetch immediately when invalidated (realtime updates)
  });
};

export const useBulkCreateCheckIns = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (checkIns: CreateCheckInRequest[]) =>
      checkInsService.bulkCreateCheckIns(checkIns),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.all });
      // Invalidate home dashboard (shows both goals and challenges)
      queryClient.invalidateQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
      });
    },
  });
};

export const useMoodTrends = (goalId?: string, days: number = 30) => {
  return useQuery({
    queryKey: checkInsQueryKeys.moodTrends(goalId, days),
    queryFn: () => checkInsService.getMoodTrends(goalId, days),
    staleTime: 0, // refetch immediately when invalidated (realtime updates)
  });
};
