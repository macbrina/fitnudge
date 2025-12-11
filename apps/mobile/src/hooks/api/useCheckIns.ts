import {
  checkInsService,
  CreateCheckInRequest,
  UpdateCheckInRequest,
} from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Query Keys
export const checkInsQueryKeys = {
  all: ["checkIns"] as const,
  list: (goalId?: string) =>
    [...checkInsQueryKeys.all, "list", goalId] as const,
  detail: (id: string) => [...checkInsQueryKeys.all, "detail", id] as const,
  stats: (goalId?: string) =>
    [...checkInsQueryKeys.all, "stats", goalId] as const,
  calendar: (year: number, month: number, goalId?: string) =>
    [...checkInsQueryKeys.all, "calendar", year, month, goalId] as const,
  today: () => [...checkInsQueryKeys.all, "today"] as const,
  streak: (goalId?: string) =>
    [...checkInsQueryKeys.all, "streak", goalId] as const,
  moodTrends: (goalId?: string, days?: number) =>
    [...checkInsQueryKeys.all, "moodTrends", goalId, days] as const,
} as const;

// Check-ins Hooks
export const useCheckIns = (goalId?: string) => {
  return useQuery({
    queryKey: checkInsQueryKeys.list(goalId),
    queryFn: () => checkInsService.getCheckIns(goalId),
    staleTime: 0, // Refetch immediately when invalidated (realtime updates)
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
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: checkInsQueryKeys.all });
      await queryClient.cancelQueries({ queryKey: checkInsQueryKeys.today() });
      await queryClient.cancelQueries({
        queryKey: checkInsQueryKeys.list(newCheckIn.goal_id),
      });

      // Snapshot previous data
      const previousTodayCheckIns = queryClient.getQueryData(
        checkInsQueryKeys.today()
      );
      const previousGoalCheckIns = queryClient.getQueryData(
        checkInsQueryKeys.list(newCheckIn.goal_id)
      );

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
        }
      );

      return {
        previousTodayCheckIns,
        previousGoalCheckIns,
        goalId: newCheckIn.goal_id,
      };
    },
    onError: (err, newCheckIn, context) => {
      // Rollback on error
      if (context?.previousTodayCheckIns) {
        queryClient.setQueryData(
          checkInsQueryKeys.today(),
          context.previousTodayCheckIns
        );
      }
      if (context?.previousGoalCheckIns) {
        queryClient.setQueryData(
          checkInsQueryKeys.list(newCheckIn.goal_id),
          context.previousGoalCheckIns
        );
      }
    },
    onSuccess: (response, variables) => {
      // Replace optimistic with real data
      const realCheckIn = response?.data;
      if (realCheckIn) {
        queryClient.setQueryData(checkInsQueryKeys.today(), (old: any) => {
          if (!old?.data) return old;
          const filtered = old.data.filter(
            (c: any) => !c.id?.startsWith?.("temp-")
          );
          return { ...old, data: [...filtered, realCheckIn] };
        });

        queryClient.setQueryData(
          checkInsQueryKeys.list(variables.goal_id),
          (old: any) => {
            if (!old?.data) return old;
            const filtered = old.data.filter(
              (c: any) => !c.id?.startsWith?.("temp-")
            );
            return { ...old, data: [...filtered, realCheckIn] };
          }
        );
      }
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
      const previousTodayCheckIns = queryClient.getQueryData(
        checkInsQueryKeys.today()
      );
      const previousDetail = queryClient.getQueryData(
        checkInsQueryKeys.detail(checkInId)
      );

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
              : c
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
        }
      );

      return { previousTodayCheckIns, previousDetail, checkInId };
    },
    onError: (err, { checkInId }, context) => {
      // Rollback on error
      if (context?.previousTodayCheckIns) {
        queryClient.setQueryData(
          checkInsQueryKeys.today(),
          context.previousTodayCheckIns
        );
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(
          checkInsQueryKeys.detail(checkInId),
          context.previousDetail
        );
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
              c.id === checkInId ? updatedCheckIn : c
            ),
          };
        });

        queryClient.setQueryData(
          checkInsQueryKeys.detail(checkInId),
          (old: any) => ({
            ...old,
            data: updatedCheckIn,
          })
        );
      }

      // Invalidate stats and progress data (these need real recalculation from server)
      queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.stats() });
      queryClient.invalidateQueries({ queryKey: ["progress"] });
      queryClient.invalidateQueries({ queryKey: ["user", "stats"] });
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
        checkInsQueryKeys.today()
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
          context.previousTodayCheckIns
        );
      }
    },
    onSuccess: () => {
      // Invalidate stats for recalculation
      queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.stats() });
      queryClient.invalidateQueries({ queryKey: ["progress"] });
      queryClient.invalidateQueries({ queryKey: ["user", "stats"] });
    },
  });
};

export const useCheckInStats = (goalId?: string) => {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: checkInsQueryKeys.stats(goalId),
    queryFn: () => checkInsService.getCheckInStats(goalId),
    enabled: isAuthenticated, // Only fetch when authenticated
    staleTime: 0, // Refetch immediately when invalidated (realtime updates)
  });
};

export const useCheckInCalendar = (
  year: number,
  month: number,
  goalId?: string
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
  goalId?: string
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
    enabled: isAuthenticated, // Only fetch when authenticated
    staleTime: 0, // Refetch immediately when invalidated (realtime updates)
    refetchInterval: isAuthenticated ? 60 * 1000 : false, // Only refetch when authenticated
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
