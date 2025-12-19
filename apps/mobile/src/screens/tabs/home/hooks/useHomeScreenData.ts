import { useHomeDashboard } from "@/hooks/api/useHomeDashboard";
import { useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { homeDashboardQueryKeys } from "@/hooks/api/useHomeDashboard";
import {
  ActiveItem,
  PendingCheckIn,
  DashboardStats,
} from "@/services/api/home";

export interface HomeScreenData {
  // New combined data
  activeItems: ActiveItem[];
  todayPendingCheckIns: PendingCheckIn[];
  dashboardStats: DashboardStats | null;

  // Legacy fields for backward compatibility
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
 * Uses the combined /home/dashboard endpoint for efficiency
 *
 * Returns:
 * - activeItems: Combined list of goals, challenges, and group goals
 * - todayPendingCheckIns: Check-ins that need to be completed today
 * - dashboardStats: Combined stats (active count, streak, etc.)
 */
export function useHomeScreenData(): HomeScreenData {
  const queryClient = useQueryClient();

  const {
    data: dashboardData,
    isLoading,
    isError,
    refetch: refetchDashboard,
  } = useHomeDashboard();

  // Extract active items from response
  const activeItems = useMemo(() => {
    return dashboardData?.items || [];
  }, [dashboardData]);

  // Extract today's pending check-ins
  const todayPendingCheckIns = useMemo(() => {
    return dashboardData?.today_pending_checkins || [];
  }, [dashboardData]);

  // Extract dashboard stats
  const dashboardStats = useMemo(() => {
    return dashboardData?.stats || null;
  }, [dashboardData]);

  // Legacy: Extract just goals for backward compatibility
  const activeGoals = useMemo(() => {
    return activeItems
      .filter((item) => item.type === "goal")
      .map((item) => item.data);
  }, [activeItems]);

  // Legacy: Extract just goal check-ins for backward compatibility
  const todayCheckIns = useMemo(() => {
    return todayPendingCheckIns
      .filter((item) => item.type === "goal")
      .map((item) => ({
        ...item.data,
        goal: item.item,
      }));
  }, [todayPendingCheckIns]);

  // Legacy: Convert dashboard stats to old format
  const userStats = useMemo(() => {
    if (!dashboardStats) return null;
    return {
      total_goals: dashboardStats.active_count,
      active_goals: dashboardStats.active_count,
      total_check_ins: dashboardStats.total_check_ins,
      current_streak: dashboardStats.current_streak,
      longest_streak: dashboardStats.current_streak, // Not tracked in new API
      completion_rate: dashboardStats.completion_rate,
    };
  }, [dashboardStats]);

  // Refetch dashboard data
  const refetch = useCallback(async () => {
    await refetchDashboard();
    // Also invalidate related queries that might be affected
    queryClient.invalidateQueries({ queryKey: ["goals"] });
    queryClient.invalidateQueries({ queryKey: ["challenges"] });
    queryClient.invalidateQueries({ queryKey: ["check-ins"] });
  }, [refetchDashboard, queryClient]);

  return {
    // New combined data
    activeItems,
    todayPendingCheckIns,
    dashboardStats,

    // Legacy fields
    activeGoals,
    todayCheckIns,
    userStats,

    isLoading,
    hasError: isError,
    refetch,
  };
}
