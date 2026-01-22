/**
 * V2 Progress Optimistic Updates Helper
 *
 * Provides functions to optimistically update progress-related query data
 * when creating check-ins. Ensures instant UI updates without waiting
 * for server responses.
 */

import { QueryClient } from "@tanstack/react-query";
import { checkInsQueryKeys, goalsQueryKeys } from "./queryKeys";

// Helper to format date as YYYY-MM-DD in LOCAL timezone
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Helper to check if a date string is within the current week (Sunday to Saturday)
const isDateInCurrentWeek = (dateStr: string): boolean => {
  const date = new Date(dateStr + "T00:00:00");
  const now = new Date();

  // Get start of current week (Sunday)
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  // Get end of current week (Saturday)
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return date >= startOfWeek && date <= endOfWeek;
};

export interface ProgressOptimisticContext {
  previousGoalsList: any;
  previousGoalsActive: any;
  previousGoalDetail: any;
  previousTodayCheckIns: any;
  previousGoalCheckIns: any;
  goalId: string;
  logDate: string;
}

/**
 * Cancel all progress-related queries for a goal
 */
export async function cancelProgressQueries(
  queryClient: QueryClient,
  goalId: string
): Promise<void> {
  await queryClient.cancelQueries({
    queryKey: goalsQueryKeys.list()
  });
  await queryClient.cancelQueries({
    queryKey: goalsQueryKeys.active()
  });
  await queryClient.cancelQueries({
    queryKey: goalsQueryKeys.detail(goalId)
  });
  await queryClient.cancelQueries({
    queryKey: checkInsQueryKeys.today()
  });
  await queryClient.cancelQueries({
    queryKey: checkInsQueryKeys.list(goalId)
  });
}

/**
 * Snapshot all progress-related query data for potential rollback
 */
export function snapshotProgressData(
  queryClient: QueryClient,
  goalId: string,
  logDate: string
): ProgressOptimisticContext {
  return {
    previousGoalsList: queryClient.getQueryData(goalsQueryKeys.list()),
    previousGoalsActive: queryClient.getQueryData(goalsQueryKeys.active()),
    previousGoalDetail: queryClient.getQueryData(goalsQueryKeys.detail(goalId)),
    previousTodayCheckIns: queryClient.getQueryData(checkInsQueryKeys.today()),
    previousGoalCheckIns: queryClient.getQueryData(checkInsQueryKeys.list(goalId)),
    goalId,
    logDate
  };
}

/**
 * Helper to update a goal's progress fields
 */
function updateGoalProgress(
  goal: any,
  goalId: string,
  isToday: boolean,
  isThisWeek: boolean,
  completed: boolean,
  isRestDay: boolean
): any {
  if (goal.id !== goalId) return goal;

  // Start with the current goal
  const updatedGoal = { ...goal };

  // Update today_checkin_status if this is a check-in for today
  if (isToday) {
    if (completed) {
      updatedGoal.today_checkin_status = "completed";
    } else if (isRestDay) {
      updatedGoal.today_checkin_status = "rest_day";
    } else {
      updatedGoal.today_checkin_status = "skipped";
    }
  }

  // Update progress_this_week if completed and within current week
  if (completed && isThisWeek && goal.frequency_type === "weekly") {
    const currentProgress = goal.progress_this_week || {
      completed: 0,
      target: goal.frequency_count || 3
    };
    updatedGoal.progress_this_week = {
      completed: currentProgress.completed + 1,
      target: currentProgress.target
    };
  }

  // Update streak for today's check-ins
  // Rest days PRESERVE the streak (don't break it) but don't INCREMENT it
  if (isToday) {
    if (completed) {
      // Completed: increment streak
      const newStreak = (goal.current_streak || 0) + 1;
      updatedGoal.current_streak = newStreak;
      updatedGoal.longest_streak = Math.max(goal.longest_streak || 0, newStreak);
      updatedGoal.total_completions = (goal.total_completions || 0) + 1;
    } else if (isRestDay) {
      // Rest day: preserve streak (no change to current_streak)
      // Streak is preserved, not incremented
    } else {
      // Skipped check-in resets streak
      updatedGoal.current_streak = 0;
    }
  }

  return updatedGoal;
}

/**
 * Optimistically update progress data when a check-in is created
 */
export function optimisticallyUpdateProgress(
  queryClient: QueryClient,
  goalId: string,
  logDate: string,
  completed: boolean,
  isRestDay: boolean = false
): void {
  const today = formatLocalDate(new Date());
  const isToday = logDate === today;
  const isThisWeek = isDateInCurrentWeek(logDate);

  // Update goals list (GoalsScreen uses this)
  queryClient.setQueryData(goalsQueryKeys.list(), (old: any) => {
    if (!old?.data) return old;
    return {
      ...old,
      data: old.data.map((goal: any) =>
        updateGoalProgress(goal, goalId, isToday, isThisWeek, completed, isRestDay)
      )
    };
  });

  // Update active goals (HomeScreen/GoalCard uses this)
  queryClient.setQueryData(goalsQueryKeys.active(), (old: any) => {
    if (!old?.data) return old;
    return {
      ...old,
      data: old.data.map((goal: any) =>
        updateGoalProgress(goal, goalId, isToday, isThisWeek, completed, isRestDay)
      )
    };
  });

  // Update single goal detail (SingleGoalScreen uses this)
  queryClient.setQueryData(goalsQueryKeys.detail(goalId), (old: any) => {
    if (!old?.data) return old;
    return {
      ...old,
      data: updateGoalProgress(old.data, goalId, isToday, isThisWeek, completed, isRestDay)
    };
  });

  // Update today's check-ins list
  queryClient.setQueryData(checkInsQueryKeys.today(), (old: any) => {
    if (!old?.data) return old;

    // Check if this goal already has a check-in today
    const existingCheckIn = old.data.find((ci: any) => ci.goal_id === goalId && ci.is_checked_in);
    if (existingCheckIn) return old;

    // Add optimistic check-in or update existing
    // V2.1: Include status field in optimistic update
    const getStatus = () => {
      if (isRestDay) return "rest_day";
      if (completed) return "completed";
      return "skipped";
    };

    const updatedData = old.data.map((ci: any) => {
      if (ci.goal_id === goalId && (!ci.is_checked_in || ci.status === "pending")) {
        return {
          ...ci,
          status: getStatus(),
          is_checked_in: true,
          updated_at: new Date().toISOString()
        };
      }
      return ci;
    });

    return { ...old, data: updatedData };
  });

  // Update goal's check-ins list
  queryClient.setQueryData(checkInsQueryKeys.list(goalId), (old: any) => {
    if (!old?.data) return old;

    // Check if today already has a check-in
    const todayCheckIn = old.data.find((ci: any) => {
      const ciDate = ci.check_in_date?.split("T")[0];
      return ciDate === today;
    });

    if (todayCheckIn?.is_checked_in) return old;

    // V2.1: Determine status for optimistic update
    const status = isRestDay ? "rest_day" : completed ? "completed" : "skipped";

    if (todayCheckIn) {
      // Mark existing as completed (update pending -> responded)
      return {
        ...old,
        data: old.data.map((ci: any) =>
          ci.id === todayCheckIn.id ? { ...ci, status, is_checked_in: true } : ci
        )
      };
    }

    // Add new optimistic check-in (V2: only status, no completed/is_rest_day)
    const optimisticCheckIn = {
      id: `optimistic-${Date.now()}`,
      check_in_date: today,
      status,
      is_checked_in: true,
      goal_id: goalId,
      created_at: new Date().toISOString()
    };

    return { ...old, data: [...old.data, optimisticCheckIn] };
  });
}

/**
 * Rollback progress data on error
 */
export function rollbackProgressData(
  queryClient: QueryClient,
  context: ProgressOptimisticContext
): void {
  const {
    goalId,
    previousGoalsList,
    previousGoalsActive,
    previousGoalDetail,
    previousTodayCheckIns,
    previousGoalCheckIns
  } = context;

  if (previousGoalsList !== undefined) {
    queryClient.setQueryData(goalsQueryKeys.list(), previousGoalsList);
  }

  if (previousGoalsActive !== undefined) {
    queryClient.setQueryData(goalsQueryKeys.active(), previousGoalsActive);
  }

  if (previousGoalDetail !== undefined) {
    queryClient.setQueryData(goalsQueryKeys.detail(goalId), previousGoalDetail);
  }

  if (previousTodayCheckIns !== undefined) {
    queryClient.setQueryData(checkInsQueryKeys.today(), previousTodayCheckIns);
  }

  if (previousGoalCheckIns !== undefined) {
    queryClient.setQueryData(checkInsQueryKeys.list(goalId), previousGoalCheckIns);
  }
}
