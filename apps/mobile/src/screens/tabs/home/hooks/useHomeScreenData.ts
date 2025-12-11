import { useActiveGoals } from "@/hooks/api/useGoals";
import { useTodayCheckIns, useCheckInStats } from "@/hooks/api/useCheckIns";
import { useUserStats } from "@/hooks/api/useUser";
import { useMemo } from "react";

export interface HomeScreenData {
  activeGoals: any[];
  todayCheckIns: any[];
  userStats: {
    total_goals: number;
    active_goals: number;
    total_check_ins: number;
    current_streak: number;
    longest_streak: number;
    completion_rate: number;
  } | null;
  isLoading: boolean;
  hasError: boolean;
  refetch: () => Promise<void>;
}

/**
 * Custom hook to fetch all data needed for the home screen
 * Centralizes data fetching logic and prevents prop drilling
 *
 * Uses React Query for all server state (goals, check-ins, stats)
 * This ensures Realtime cache invalidation works properly
 */
export function useHomeScreenData(): HomeScreenData {
  // Use React Query for goals (not Zustand) - enables Realtime updates
  const {
    data: activeGoalsResponse,
    isLoading: goalsLoading,
    isError: goalsError,
    refetch: refetchGoals,
  } = useActiveGoals();

  const {
    data: todayCheckInsResponse,
    isLoading: checkInsLoading,
    isError: checkInsError,
    refetch: refetchCheckIns,
  } = useTodayCheckIns();

  const {
    data: userStatsResponse,
    isLoading: userStatsLoading,
    isError: userStatsError,
    refetch: refetchUserStats,
  } = useUserStats();

  const {
    data: checkInStatsResponse,
    isLoading: checkInStatsLoading,
    refetch: refetchCheckInStats,
  } = useCheckInStats();

  // Extract active goals from React Query response
  const activeGoals = useMemo(() => {
    if (!activeGoalsResponse?.data) return [];
    return Array.isArray(activeGoalsResponse.data)
      ? activeGoalsResponse.data
      : [];
  }, [activeGoalsResponse]);

  const todayCheckIns = useMemo(() => {
    if (!todayCheckInsResponse?.data) return [];
    return Array.isArray(todayCheckInsResponse.data)
      ? todayCheckInsResponse.data
      : [];
  }, [todayCheckInsResponse]);

  const userStats = useMemo(() => {
    if (!userStatsResponse?.data) return null;
    const stats = userStatsResponse.data;

    // Calculate active goals (total - completed)
    const activeGoalsCount = Math.max(
      0,
      (stats.total_goals || 0) - (stats.completed_goals || 0)
    );

    // Calculate completion rate from check-in stats if available
    let completionRate = 0;
    if (checkInStatsResponse?.data) {
      completionRate = Math.round(
        checkInStatsResponse.data.completion_rate || 0
      );
    } else if (stats.total_check_ins > 0) {
      // Fallback: calculate from total check-ins (rough estimate)
      completionRate = Math.min(
        100,
        Math.round((stats.current_streak / 7) * 100)
      );
    }

    return {
      total_goals: stats.total_goals || 0,
      active_goals: activeGoalsCount,
      total_check_ins: stats.total_check_ins || 0,
      current_streak: stats.current_streak || 0,
      longest_streak: stats.longest_streak || 0,
      completion_rate: completionRate,
    };
  }, [userStatsResponse, checkInStatsResponse]);

  const isLoading =
    goalsLoading ||
    checkInsLoading ||
    userStatsLoading ||
    checkInStatsLoading ||
    false;
  const hasError = goalsError || checkInsError || userStatsError || false;

  // Refetch all data (all React Query now!)
  const refetch = async () => {
    await Promise.all([
      refetchGoals(),
      refetchCheckIns(),
      refetchUserStats(),
      refetchCheckInStats(),
    ]);
  };

  return {
    activeGoals,
    todayCheckIns,
    userStats,
    isLoading,
    hasError,
    refetch,
  };
}
