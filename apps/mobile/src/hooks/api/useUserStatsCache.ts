/**
 * Hook for accessing user stats cache
 *
 * The user_stats_cache table is maintained by database triggers and contains
 * pre-calculated user statistics for fast access:
 * - Active goals/challenges count
 * - Total check-ins
 * - Current and longest streak
 * - 30-day completion rate
 * - Workout stats
 * - Meal and hydration logs count
 *
 * This data is primarily consumed by the home dashboard, but this hook
 * provides direct access for other components that need specific stats.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";

// Query keys for user stats cache
export const userStatsCacheQueryKeys = {
  all: ["userStatsCache"] as const,
  user: (userId: string) => [...userStatsCacheQueryKeys.all, userId] as const,
};

export interface UserStatsCache {
  user_id: string;
  active_goals_count: number;
  active_challenges_count: number;
  completed_goals_count: number;
  completed_challenges_count: number;
  total_goal_checkins: number;
  total_challenge_checkins: number;
  total_checkins: number;
  current_streak: number;
  longest_streak: number;
  last_checkin_date: string | null;
  completion_rate_30d: number;
  scheduled_30d: number;
  completed_30d: number;
  total_workouts: number;
  total_workout_minutes: number;
  total_meals_logged: number;
  total_hydration_logs: number;
  updated_at: string;
}

/**
 * Hook to fetch the user's cached stats directly from user_stats_cache table.
 *
 * Note: For most cases, use useHomeDashboard() instead as it returns the
 * same stats and is already being fetched. This hook is for cases where
 * you need stats without the full dashboard data.
 */
export const useUserStatsCache = () => {
  const { user, isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: userStatsCacheQueryKeys.user(user?.id || ""),
    queryFn: async () => {
      if (!user?.id || !supabase) {
        throw new Error("User not authenticated");
      }

      const { data, error } = await supabase
        .from("user_stats_cache")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) {
        // If no row exists, the user hasn't had any activity yet
        if (error.code === "PGRST116") {
          return null;
        }
        throw error;
      }

      return data as UserStatsCache;
    },
    enabled: isAuthenticated && !!user?.id,
    staleTime: 30 * 1000, // 30 seconds - cache is updated by triggers
  });
};

/**
 * Hook to manually refresh user stats cache.
 * This triggers the database function to recalculate all stats.
 */
export const useRefreshUserStatsCache = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return async () => {
    if (!user?.id || !supabase) return;

    try {
      // Call the database function to refresh stats
      // Cast to any to handle the new RPC function not being in types yet
      await (supabase.rpc as any)("refresh_user_stats_cache", {
        p_user_id: user.id,
      });

      // Invalidate queries to refetch fresh data
      queryClient.invalidateQueries({
        queryKey: userStatsCacheQueryKeys.user(user.id),
      });
    } catch (error) {
      console.error("Failed to refresh user stats cache:", error);
    }
  };
};

export default useUserStatsCache;
