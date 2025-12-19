import { useQuery } from "@tanstack/react-query";
import { homeService, HomeDashboardResponse } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { useUserTimezone } from "@/hooks/useUserTimezone";

// Query keys for home dashboard
export const homeDashboardQueryKeys = {
  all: ["home"] as const,
  dashboard: () => [...homeDashboardQueryKeys.all, "dashboard"] as const,
};

/**
 * Hook to fetch the combined home dashboard data.
 * Returns active items (goals, challenges, group goals),
 * today's pending check-ins, and combined stats.
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
    staleTime: 1 * 60 * 1000, // 1 minute - shorter since this is the main dashboard
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
};

export default useHomeDashboard;
