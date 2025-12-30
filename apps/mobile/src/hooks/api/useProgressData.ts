import { useQuery } from "@tanstack/react-query";
import { checkInsService } from "@/services/api";
import { useMemo } from "react";

// Helper to format date as YYYY-MM-DD in LOCAL timezone
// (toISOString uses UTC which causes timezone issues)
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Helper to parse date string and get local day of week
const getLocalDayOfWeek = (dateStr: string): number => {
  // Parse YYYY-MM-DD as local date (add T00:00:00 to avoid UTC parsing)
  const [year, month, day] = dateStr.split("T")[0].split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getDay();
};

export const progressQueryKeys = {
  all: ["progress"] as const,
  streak: (goalId?: string) =>
    [...progressQueryKeys.all, "streak", goalId] as const,
  weekProgress: (goalId?: string) =>
    [...progressQueryKeys.all, "week", goalId] as const,
  moodTrend: (goalId?: string, days?: number) =>
    [...progressQueryKeys.all, "mood", goalId, days] as const,
} as const;

// Empty placeholder for streak data
const EMPTY_STREAK = { current_streak: 0, longest_streak: 0 };

// Hook for streak info (current + longest)
export const useStreakInfo = (goalId?: string) => {
  return useQuery({
    queryKey: progressQueryKeys.streak(goalId),
    queryFn: async () => {
      const response = await checkInsService.getStreakInfo(goalId);
      return response.data;
    },
    staleTime: 0, // Refetch immediately when invalidated (realtime updates)
    refetchOnMount: false,
    placeholderData: EMPTY_STREAK,
    // NOTE: Don't use keepPreviousData for goal-specific queries!
    // It causes stale data to show when switching between goals.
  });
};

// Hook for weekly progress
export const useWeekProgress = (goalId?: string) => {
  const { data: checkIns, isLoading } = useQuery({
    queryKey: progressQueryKeys.weekProgress(goalId),
    queryFn: async () => {
      const today = new Date();
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7)); // Get Monday
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const response = await checkInsService.getCheckInsByDateRange(
        formatLocalDate(monday),
        formatLocalDate(sunday),
        goalId,
      );
      return response.data || [];
    },
    staleTime: 0, // Refetch immediately when invalidated (realtime updates)
    // NOTE: Don't use keepPreviousData for goal-specific queries!
  });

  const weekData = useMemo(() => {
    if (!checkIns) {
      return {
        completed: 0,
        total: 7,
        percentage: 0,
        daysCompleted: [false, false, false, false, false, false, false],
      };
    }

    // Map check-ins to days of week (Mon-Sun)
    const daysCompleted = [false, false, false, false, false, false, false];
    let completedCount = 0;

    checkIns.forEach((checkIn: any) => {
      if (checkIn.completed) {
        // Use local day parsing to avoid timezone issues
        const dayOfWeek = getLocalDayOfWeek(checkIn.check_in_date);
        const dayIndex = (dayOfWeek + 6) % 7; // Convert to Mon=0, Sun=6
        daysCompleted[dayIndex] = true;
        completedCount++;
      }
    });

    return {
      completed: completedCount,
      total: 7,
      percentage: Math.round((completedCount / 7) * 100),
      daysCompleted,
    };
  }, [checkIns]);

  return {
    data: weekData,
    isLoading,
  };
};

// Hook for mood trends
export const useMoodTrends = (goalId?: string, days: number = 7) => {
  const { data: stats, isLoading } = useQuery({
    queryKey: progressQueryKeys.moodTrend(goalId, days),
    queryFn: async () => {
      const response = await checkInsService.getMoodTrends(goalId, days);
      return response.data;
    },
    staleTime: 0, // Refetch immediately when invalidated (realtime updates)
    // NOTE: Don't use keepPreviousData for goal-specific queries!
  });

  const moodData = useMemo(() => {
    if (!stats || !Array.isArray(stats)) {
      return [];
    }

    // Transform array of {date, average_mood, check_ins_count} to {date, mood}
    return stats.map((item) => ({
      date: item.date,
      mood: Math.round(item.average_mood), // Round to nearest integer (1-5)
    }));
  }, [stats]);

  return {
    data: moodData,
    isLoading,
  };
};

// Hook for habit chain data (last 30 days)
export const useHabitChain = (goalId?: string, days: number = 30) => {
  const { data: checkIns, isLoading } = useQuery({
    queryKey: [...progressQueryKeys.all, "chain", goalId, days],
    queryFn: async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days + 1);

      const response = await checkInsService.getCheckInsByDateRange(
        formatLocalDate(startDate),
        formatLocalDate(endDate),
        goalId,
      );
      return response.data || [];
    },
    staleTime: 0, // Refetch immediately when invalidated (realtime updates)
    // NOTE: Don't use keepPreviousData for goal-specific queries!
  });

  const chainData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = formatLocalDate(today);

    const chain = [];
    let completedCount = 0;
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = formatLocalDate(date);

      // Check-in date might be "2024-12-06" or "2024-12-06T00:00:00Z"
      const checkIn = checkIns?.find((ci: any) => {
        const ciDateStr = ci.check_in_date?.split("T")[0];
        return ciDateStr === dateStr;
      });
      // Use string comparison to avoid Date object comparison issues
      const isFuture = dateStr > todayStr;
      const completed = checkIn?.completed || false;
      if (completed && !isFuture) completedCount++;

      chain.push({
        date: dateStr,
        completed,
        isFuture,
      });
    }

    return chain;
  }, [checkIns, days, goalId]);

  return {
    data: chainData,
    isLoading,
  };
};
