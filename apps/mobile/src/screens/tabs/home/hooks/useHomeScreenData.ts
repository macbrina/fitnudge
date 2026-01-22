import { useActiveGoals } from "@/hooks/api/useGoals";
import { useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { TodayCheckinStatus } from "@/services/api/goals";

interface GoalForHomeScreen {
  id: string;
  title: string;
  frequency_type?: string;
  frequency_count?: number;
  current_streak?: number;
  longest_streak?: number;
  total_completions?: number;
  status?: string;
  // V2 additions
  today_checkin_status?: TodayCheckinStatus;
  progress_this_week?: { completed: number; target: number } | null;
  reminder_times?: string[] | null;
}

export interface HomeScreenData {
  /** Active goals scheduled for today (filtered by target_days) */
  todayGoals: GoalForHomeScreen[];
  /** Whether user has any active goals at all (regardless of schedule) */
  hasActiveGoals: boolean;
  /** Current streak for MotivationCard fallback */
  currentStreak: number;

  isLoading: boolean;
  hasError: boolean;
  refetch: () => Promise<void>;
}

// Maximum goals to show on home screen horizontal scroll
const MAX_HOME_GOALS = 5;

/**
 * Check if a goal is scheduled for today
 * - Daily goals: always scheduled
 * - Weekly goals: check if today's day of week is in target_days
 */
function isGoalScheduledForToday(goal: {
  frequency_type?: string;
  target_days?: number[] | null;
}): boolean {
  // Daily goals are always scheduled
  if (goal.frequency_type === "daily") return true;

  // For weekly goals, check if today is in target_days
  const todayDayOfWeek = new Date().getDay(); // 0 = Sunday, 6 = Saturday
  return goal.target_days?.includes(todayDayOfWeek) ?? false;
}

/**
 * Custom hook to fetch all data needed for the home screen
 * V2: Shows active goals scheduled for today with check-in status
 */
export function useHomeScreenData(): HomeScreenData {
  const queryClient = useQueryClient();

  const { data: goalsResponse, isLoading, isError, refetch: refetchGoals } = useActiveGoals();

  // Check if user has any active goals at all
  const hasActiveGoals = useMemo(() => {
    const goals = goalsResponse?.data || [];
    return goals.length > 0;
  }, [goalsResponse]);

  // Extract active goals scheduled for today
  const todayGoals = useMemo(() => {
    const goals = goalsResponse?.data || [];

    // Filter to only goals scheduled for today
    const scheduledForToday = goals.filter((goal) => isGoalScheduledForToday(goal));

    // Sort by: not checked in today first, then by streak (descending)
    const sorted = [...scheduledForToday].sort((a, b) => {
      // Goals not checked in today come first (null status = no check-in)
      const aHasCheckin = a.today_checkin_status != null;
      const bHasCheckin = b.today_checkin_status != null;
      if (aHasCheckin !== bHasCheckin) {
        return aHasCheckin ? 1 : -1;
      }
      // Then sort by current streak (descending)
      return (b.current_streak || 0) - (a.current_streak || 0);
    });

    // Limit to MAX_HOME_GOALS for home screen
    return sorted.slice(0, MAX_HOME_GOALS).map((goal) => ({
      id: goal.id,
      title: goal.title,
      frequency_type: goal.frequency_type,
      frequency_count: goal.frequency_count,
      current_streak: goal.current_streak,
      longest_streak: goal.longest_streak,
      total_completions: goal.total_completions,
      status: goal.status,
      // V2 additions
      today_checkin_status: goal.today_checkin_status,
      progress_this_week: goal.progress_this_week,
      reminder_times: goal.reminder_times
    }));
  }, [goalsResponse]);

  // Calculate overall streak from the highest goal streak
  const currentStreak = useMemo(() => {
    if (todayGoals.length === 0) return 0;
    return Math.max(...todayGoals.map((g) => g.current_streak || 0));
  }, [todayGoals]);

  // Refetch goals data
  const refetch = useCallback(async () => {
    await refetchGoals();
    // Also invalidate related queries
    queryClient.invalidateQueries({ queryKey: ["goals"] });
    queryClient.invalidateQueries({ queryKey: ["check-ins"] });
  }, [refetchGoals, queryClient]);

  return {
    todayGoals,
    hasActiveGoals,
    currentStreak,
    isLoading,
    hasError: isError,
    refetch
  };
}
