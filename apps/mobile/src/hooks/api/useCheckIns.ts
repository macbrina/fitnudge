import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  checkInsService,
  CreateCheckInRequest,
  UpdateCheckInRequest,
  CheckInStats,
  CheckInCalendar,
} from "@/services/api";

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
    staleTime: 1 * 60 * 1000, // 1 minute
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
    onSuccess: (_, variables) => {
      // Invalidate check-ins for the specific goal
      queryClient.invalidateQueries({
        queryKey: checkInsQueryKeys.list(variables.goal_id),
      });
      // Also invalidate all check-ins
      queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.all });
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
    onSuccess: (_, { checkInId }) => {
      queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.all });
      queryClient.invalidateQueries({
        queryKey: checkInsQueryKeys.detail(checkInId),
      });
    },
  });
};

export const useDeleteCheckIn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (checkInId: string) => checkInsService.deleteCheckIn(checkInId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.all });
    },
  });
};

export const useCheckInStats = (goalId?: string) => {
  return useQuery({
    queryKey: checkInsQueryKeys.stats(goalId),
    queryFn: () => checkInsService.getCheckInStats(goalId),
    staleTime: 2 * 60 * 1000, // 2 minutes
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
  return useQuery({
    queryKey: checkInsQueryKeys.today(),
    queryFn: () => checkInsService.getTodayCheckIns(),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
};

export const useStreakData = (goalId?: string) => {
  return useQuery({
    queryKey: checkInsQueryKeys.streak(goalId),
    queryFn: () => checkInsService.getStreakData(goalId),
    staleTime: 5 * 60 * 1000, // 5 minutes
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
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};
