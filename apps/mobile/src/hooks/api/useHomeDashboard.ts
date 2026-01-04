import { useQuery } from "@tanstack/react-query";
import { homeService, HomeDashboardResponse } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { useUserTimezone } from "@/hooks/useUserTimezone";

// Query keys for home dashboard
export const homeDashboardQueryKeys = {
  all: ["home"] as const,
  dashboard: () => [...homeDashboardQueryKeys.all, "dashboard"] as const
};

/**
 * Empty dashboard data for placeholder (prevents loading spinners)
 */
const EMPTY_DASHBOARD: HomeDashboardResponse = {
  items: [],
  today_pending_checkins: [],
  stats: {
    active_count: 0,
    current_streak: 0,
    total_check_ins: 0,
    completion_rate: 0
  }
};

/**
 * Hook to fetch the combined home dashboard data.
 * Returns active items (goals, challenges, group goals),
 * today's pending check-ins, and combined stats.
 *
 * Uses placeholderData to prevent loading spinners - shows empty state
 * immediately while data loads in background.
 */
export const useHomeDashboard = () => {
  const { isAuthenticated } = useAuthStore();
  const timezone = useUserTimezone();

  return useQuery({
    queryKey: homeDashboardQueryKeys.dashboard(),
    queryFn: async () => {
      const response = await homeService.getDashboard(timezone);
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data as HomeDashboardResponse;
    },
    enabled: isAuthenticated,
    staleTime: 1 * 60 * 1000, // 1 minute
    // Use cached data if available, don't force refetch on mount
    // RealtimeContext handles refresh when app comes to foreground
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    // Provide empty data as placeholder to prevent loading spinners
    // This makes the UI render immediately with empty state
    placeholderData: EMPTY_DASHBOARD
  });
};

export default useHomeDashboard;
