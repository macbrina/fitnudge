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
  /** Combined list of active goals, challenges, and group goals */
  activeItems: ActiveItem[];
  /** Check-ins (goals + challenges) that need to be completed today */
  todayPendingCheckIns: PendingCheckIn[];
  /** Combined stats (active count, streak, completion rate, etc.) */
  dashboardStats: DashboardStats | null;

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
 * - todayPendingCheckIns: Check-ins (goals + challenges) that need to be completed today
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

  // Extract active items from response (goals + challenges)
  const activeItems = useMemo(() => {
    return dashboardData?.items || [];
  }, [dashboardData]);

  // Extract today's pending check-ins (goals + challenges)
  const todayPendingCheckIns = useMemo(() => {
    return dashboardData?.today_pending_checkins || [];
  }, [dashboardData]);

  // Extract dashboard stats
  const dashboardStats = useMemo(() => {
    return dashboardData?.stats || null;
  }, [dashboardData]);

  // Refetch dashboard data
  const refetch = useCallback(async () => {
    await refetchDashboard();
    // Also invalidate related queries that might be affected
    queryClient.invalidateQueries({ queryKey: ["goals"] });
    queryClient.invalidateQueries({ queryKey: ["challenges"] });
    queryClient.invalidateQueries({ queryKey: ["check-ins"] });
  }, [refetchDashboard, queryClient]);

  return {
    activeItems,
    todayPendingCheckIns,
    dashboardStats,
    isLoading,
    hasError: isError,
    refetch,
  };
}
