/**
 * Progress Optimistic Updates Helper
 *
 * Provides functions to optimistically update progress-related query data
 * when logging hydration, meals, workouts, or check-ins.
 *
 * This ensures that GoalProgressSection and ChallengeProgressSection
 * update instantly without waiting for server responses.
 */

import { QueryClient } from "@tanstack/react-query";
import { progressQueryKeys } from "./useProgressData";
import { checkInsQueryKeys } from "./queryKeys";
import { homeDashboardQueryKeys } from "./useHomeDashboard";
import { trackingStatsQueryKeys } from "./useTrackingStats";

// Helper to format date as YYYY-MM-DD in LOCAL timezone
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Get Monday-based day index (Mon=0, Sun=6)
const getMondayBasedDayIndex = (date: Date): number => {
  const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, etc
  return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
};

// Period options used by GoalProgressSection
const PERIOD_OPTIONS = [7, 30, 90] as const;

export interface ProgressOptimisticContext {
  previousStreakInfo: any;
  previousWeekProgress: any;
  previousHabitChains: Map<number, any>;
  previousTodayCheckIns: any;
  previousGoalCheckIns: any;
  previousDashboard: any;
  previousTrackingStats: Map<string, any>; // Key: `${trackingType}-${period}`
  entityId: string;
  entityType: "goal" | "challenge";
  logDate: string;
}

// Tracking types for stats
const TRACKING_TYPES = ["workout", "meal", "hydration", "checkin"] as const;

/**
 * Cancel all progress-related queries for an entity
 */
export async function cancelProgressQueries(
  queryClient: QueryClient,
  entityId: string,
  entityType: "goal" | "challenge" = "goal",
): Promise<void> {
  await queryClient.cancelQueries({
    queryKey: progressQueryKeys.streak(entityId),
  });
  await queryClient.cancelQueries({
    queryKey: progressQueryKeys.weekProgress(entityId),
  });
  for (const period of PERIOD_OPTIONS) {
    await queryClient.cancelQueries({
      queryKey: [...progressQueryKeys.all, "chain", entityId, period],
    });
  }
  await queryClient.cancelQueries({
    queryKey: checkInsQueryKeys.today(),
  });
  await queryClient.cancelQueries({
    queryKey: checkInsQueryKeys.list(entityId),
  });
  // Cancel home dashboard to prevent race conditions
  await queryClient.cancelQueries({
    queryKey: homeDashboardQueryKeys.dashboard(),
  });
  // Cancel tracking stats for all types and periods
  await queryClient.cancelQueries({
    queryKey: trackingStatsQueryKeys.entity(entityType, entityId),
  });
}

/**
 * Snapshot all progress-related query data for potential rollback
 */
export function snapshotProgressData(
  queryClient: QueryClient,
  entityId: string,
  logDate: string,
  entityType: "goal" | "challenge" = "goal",
): ProgressOptimisticContext {
  const previousHabitChains = new Map<number, any>();
  for (const period of PERIOD_OPTIONS) {
    previousHabitChains.set(
      period,
      queryClient.getQueryData([
        ...progressQueryKeys.all,
        "chain",
        entityId,
        period,
      ]),
    );
  }

  // Snapshot tracking stats for all combinations
  const previousTrackingStats = new Map<string, any>();
  for (const trackingType of TRACKING_TYPES) {
    for (const period of PERIOD_OPTIONS) {
      const key = `${trackingType}-${period}`;
      previousTrackingStats.set(
        key,
        queryClient.getQueryData(
          trackingStatsQueryKeys.stats(
            entityType,
            entityId,
            trackingType,
            period,
          ),
        ),
      );
    }
  }

  return {
    previousStreakInfo: queryClient.getQueryData(
      progressQueryKeys.streak(entityId),
    ),
    previousWeekProgress: queryClient.getQueryData(
      progressQueryKeys.weekProgress(entityId),
    ),
    previousHabitChains,
    previousTodayCheckIns: queryClient.getQueryData(checkInsQueryKeys.today()),
    previousGoalCheckIns: queryClient.getQueryData(
      checkInsQueryKeys.list(entityId),
    ),
    previousDashboard: queryClient.getQueryData(
      homeDashboardQueryKeys.dashboard(),
    ),
    previousTrackingStats,
    entityId,
    entityType,
    logDate,
  };
}

/**
 * Optimistically update all progress data when a log is created
 * (hydration, meal, workout, or check-in)
 */
export function optimisticallyUpdateProgress(
  queryClient: QueryClient,
  entityId: string,
  logDate: string,
): void {
  console.log("[optimisticallyUpdateProgress] 🚀 START", { entityId, logDate });

  const today = formatLocalDate(new Date());
  const isToday = logDate === today;

  // Only update if logging for today
  if (!isToday) {
    console.log("[optimisticallyUpdateProgress] ⚠️ Not today, skipping", {
      logDate,
      today,
    });
    return;
  }

  // 1. Update streak info
  const streakQueryKey = progressQueryKeys.streak(entityId);

  queryClient.setQueryData(streakQueryKey, (old: any) => {
    // If no existing data, create initial optimistic streak
    if (!old) {
      return {
        current_streak: 1,
        longest_streak: 1,
        last_check_in_date: today,
        goal_id: entityId,
      };
    }

    // Check if already checked in today
    const lastCheckInDate = old.last_check_in_date?.split("T")[0];
    if (lastCheckInDate === today) {
      // Already checked in today, no change
      return old;
    }

    // Check if streak continues (last check-in was yesterday)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatLocalDate(yesterday);

    let newCurrentStreak = old.current_streak || 0;
    if (lastCheckInDate === yesterdayStr) {
      // Continuing streak
      newCurrentStreak = (old.current_streak || 0) + 1;
    } else if (!lastCheckInDate) {
      // First check-in ever
      newCurrentStreak = 1;
    } else {
      // Streak broken, starting new
      newCurrentStreak = 1;
    }

    const result = {
      ...old,
      current_streak: newCurrentStreak,
      longest_streak: Math.max(old.longest_streak || 0, newCurrentStreak),
      last_check_in_date: today,
    };
    return result;
  });

  // 2. Update week progress (raw check-ins)
  const weekQueryKey = progressQueryKeys.weekProgress(entityId);

  queryClient.setQueryData(weekQueryKey, (old: any[] | undefined) => {
    // If no existing data, create array with optimistic check-in
    if (!old) {
      return [
        {
          id: `optimistic-${Date.now()}`,
          check_in_date: today,
          completed: true,
          goal_id: entityId,
          created_at: new Date().toISOString(),
        },
      ];
    }

    // Find existing check-in for today (completed or not)
    const existingIndex = old.findIndex((ci: any) => {
      const ciDate = ci.check_in_date?.split("T")[0];
      return ciDate === today;
    });

    if (existingIndex !== -1) {
      const existing = old[existingIndex];
      if (existing.completed) {
        // Already completed, no change needed

        return old;
      }
      // Update existing incomplete check-in to be completed

      const updated = [...old];
      updated[existingIndex] = { ...existing, completed: true };
      return updated;
    }

    // No check-in for today, add new one

    return [
      ...old,
      {
        id: `optimistic-${Date.now()}`,
        check_in_date: today,
        completed: true,
        goal_id: entityId,
        created_at: new Date().toISOString(),
      },
    ];
  });

  // 3. Update habit chain for all periods
  for (const period of PERIOD_OPTIONS) {
    const chainQueryKey = [...progressQueryKeys.all, "chain", entityId, period];
    queryClient.setQueryData(chainQueryKey, (old: any[] | undefined) => {
      // If no existing data, create array with optimistic check-in
      if (!old) {
        return [
          {
            id: `optimistic-${Date.now()}-${period}`,
            check_in_date: today,
            completed: true,
            goal_id: entityId,
            created_at: new Date().toISOString(),
          },
        ];
      }

      // Find existing check-in for today (completed or not)
      const existingIndex = old.findIndex((ci: any) => {
        const ciDate = ci.check_in_date?.split("T")[0];
        return ciDate === today;
      });

      if (existingIndex !== -1) {
        const existing = old[existingIndex];
        if (existing.completed) {
          // Already completed, no change needed
          return old;
        }
        // Update existing incomplete check-in to be completed
        const updated = [...old];
        updated[existingIndex] = { ...existing, completed: true };
        return updated;
      }

      // No check-in for today, add new one
      return [
        ...old,
        {
          id: `optimistic-${Date.now()}-${period}`,
          check_in_date: today,
          completed: true,
          goal_id: entityId,
          created_at: new Date().toISOString(),
        },
      ];
    });
  }

  // 4. Update today's check-ins list
  queryClient.setQueryData(checkInsQueryKeys.today(), (old: any) => {
    if (!old?.data) return old;

    // Check if this goal already has a completed check-in today
    const existingCheckIn = old.data.find(
      (ci: any) => ci.goal_id === entityId && ci.is_checked_in,
    );
    if (existingCheckIn) return old;

    // Find existing uncompleted check-in for this goal and mark as completed
    const updatedData = old.data.map((ci: any) => {
      if (ci.goal_id === entityId && !ci.is_checked_in) {
        return {
          ...ci,
          is_checked_in: true,
          completed: true,
          updated_at: new Date().toISOString(),
        };
      }
      return ci;
    });

    return { ...old, data: updatedData };
  });

  // 5. Update goal's check-ins list
  queryClient.setQueryData(checkInsQueryKeys.list(entityId), (old: any) => {
    if (!old?.data) return old;

    // Check if today already has a completed check-in
    const todayCheckIn = old.data.find((ci: any) => {
      const ciDate = ci.check_in_date?.split("T")[0];
      return ciDate === today;
    });

    if (todayCheckIn?.completed || todayCheckIn?.is_checked_in) return old;

    if (todayCheckIn) {
      // Mark existing as completed
      return {
        ...old,
        data: old.data.map((ci: any) =>
          ci.id === todayCheckIn.id
            ? { ...ci, completed: true, is_checked_in: true }
            : ci,
        ),
      };
    }

    // Add new optimistic check-in
    const optimisticCheckIn = {
      id: `optimistic-${Date.now()}`,
      check_in_date: today,
      completed: true,
      is_checked_in: true,
      goal_id: entityId,
      created_at: new Date().toISOString(),
    };

    return { ...old, data: [...old.data, optimisticCheckIn] };
  });

  // 6. Update home dashboard stats (streak and total check-ins)
  queryClient.setQueryData(homeDashboardQueryKeys.dashboard(), (old: any) => {
    if (!old?.stats) return old;

    // Get existing stats
    const { stats } = old;
    const currentStreak = stats.current_streak || 0;
    const totalCheckIns = stats.total_check_ins || 0;

    // Check if we already have a pending check-in for this goal in today_pending_checkins
    const hasPendingForGoal = old.today_pending_checkins?.some(
      (pc: any) =>
        pc.type === "goal" &&
        (pc.data?.goal_id === entityId || pc.item?.id === entityId) &&
        !pc.data?.is_checked_in,
    );

    if (!hasPendingForGoal) {
      // No pending check-in for this goal, don't update
      return old;
    }

    // Update stats optimistically
    return {
      ...old,
      stats: {
        ...stats,
        current_streak: currentStreak + 1,
        total_check_ins: totalCheckIns + 1,
      },
      // Mark the pending check-in as completed
      today_pending_checkins: old.today_pending_checkins?.filter(
        (pc: any) =>
          !(
            pc.type === "goal" &&
            (pc.data?.goal_id === entityId || pc.item?.id === entityId)
          ),
      ),
    };
  });
}

/**
 * Optimistically update workout tracking stats when a workout is completed
 */
export function optimisticallyUpdateWorkoutStats(
  queryClient: QueryClient,
  entityId: string,
  entityType: "goal" | "challenge",
  workoutData: {
    durationSeconds: number;
    exercisesCompleted: number;
    caloriesBurned?: number;
  },
): void {
  const durationMinutes = Math.round(workoutData.durationSeconds / 60);
  const calories =
    workoutData.caloriesBurned || Math.round(durationMinutes * 6.5);

  // Update tracking stats for all periods
  for (const period of PERIOD_OPTIONS) {
    queryClient.setQueryData(
      trackingStatsQueryKeys.stats(entityType, entityId, "workout", period),
      (old: any) => {
        if (!old) {
          // Return optimistic initial state if no previous data
          return {
            workout: {
              total_workouts: 1,
              total_duration_minutes: durationMinutes,
              workouts_this_week: 1,
              avg_duration_minutes: durationMinutes,
              exercises_completed: workoutData.exercisesCompleted,
              rest_days: period - 1,
              period_days: period,
              total_calories_burned: calories,
            },
          };
        }

        const workout = old.workout || {};
        const newTotalWorkouts = (workout.total_workouts || 0) + 1;
        const newTotalDuration =
          (workout.total_duration_minutes || 0) + durationMinutes;

        return {
          ...old,
          workout: {
            ...workout,
            total_workouts: newTotalWorkouts,
            total_duration_minutes: newTotalDuration,
            workouts_this_week: (workout.workouts_this_week || 0) + 1,
            avg_duration_minutes: Math.round(
              newTotalDuration / newTotalWorkouts,
            ),
            exercises_completed:
              (workout.exercises_completed || 0) +
              workoutData.exercisesCompleted,
            total_calories_burned:
              (workout.total_calories_burned || 0) + calories,
          },
        };
      },
    );
  }
}

/**
 * Optimistically update hydration tracking stats when hydration is logged
 */
export function optimisticallyUpdateHydrationStats(
  queryClient: QueryClient,
  entityId: string,
  entityType: "goal" | "challenge",
  amountMl: number,
  dailyTargetMl: number = 2000,
): void {
  for (const period of PERIOD_OPTIONS) {
    queryClient.setQueryData(
      trackingStatsQueryKeys.stats(entityType, entityId, "hydration", period),
      (old: any) => {
        if (!old) {
          const targetReached = amountMl >= dailyTargetMl ? 1 : 0;
          return {
            hydration: {
              total_intake_ml: amountMl,
              avg_daily_ml: amountMl,
              days_target_reached: targetReached,
              total_logs: 1,
              daily_target_ml: dailyTargetMl,
              period_days: period,
              today_intake_ml: amountMl,
            },
          };
        }

        const hydration = old.hydration || {};
        const newTotalIntake = (hydration.total_intake_ml || 0) + amountMl;
        const newTodayIntake = (hydration.today_intake_ml || 0) + amountMl;
        const newTotalLogs = (hydration.total_logs || 0) + 1;

        return {
          ...old,
          hydration: {
            ...hydration,
            total_intake_ml: newTotalIntake,
            today_intake_ml: newTodayIntake,
            total_logs: newTotalLogs,
            avg_daily_ml: Math.round(
              newTotalIntake / Math.max(1, hydration.period_days || 1),
            ),
          },
        };
      },
    );
  }
}

/**
 * Optimistically update meal tracking stats when a meal is logged
 */
export function optimisticallyUpdateMealStats(
  queryClient: QueryClient,
  entityId: string,
  entityType: "goal" | "challenge",
  mealData: {
    calories?: number;
    protein?: number;
    isHealthy?: boolean;
  },
): void {
  for (const period of PERIOD_OPTIONS) {
    queryClient.setQueryData(
      trackingStatsQueryKeys.stats(entityType, entityId, "meal", period),
      (old: any) => {
        if (!old) {
          return {
            meal: {
              total_meals: 1,
              total_calories: mealData.calories || 0,
              total_protein: mealData.protein || 0,
              avg_calories_per_meal: mealData.calories || 0,
              healthy_meal_count: mealData.isHealthy ? 1 : 0,
              period_days: period,
            },
          };
        }

        const meal = old.meal || {};
        const newTotalMeals = (meal.total_meals || 0) + 1;
        const newTotalCalories =
          (meal.total_calories || 0) + (mealData.calories || 0);

        return {
          ...old,
          meal: {
            ...meal,
            total_meals: newTotalMeals,
            total_calories: newTotalCalories,
            total_protein: (meal.total_protein || 0) + (mealData.protein || 0),
            avg_calories_per_meal: Math.round(newTotalCalories / newTotalMeals),
            healthy_meal_count:
              (meal.healthy_meal_count || 0) + (mealData.isHealthy ? 1 : 0),
          },
        };
      },
    );
  }
}

/**
 * Rollback progress data on error
 */
export function rollbackProgressData(
  queryClient: QueryClient,
  context: ProgressOptimisticContext,
): void {
  const {
    entityId,
    entityType,
    previousStreakInfo,
    previousWeekProgress,
    previousHabitChains,
    previousTodayCheckIns,
    previousGoalCheckIns,
    previousDashboard,
    previousTrackingStats,
  } = context;

  if (previousStreakInfo !== undefined) {
    queryClient.setQueryData(
      progressQueryKeys.streak(entityId),
      previousStreakInfo,
    );
  }

  if (previousWeekProgress !== undefined) {
    queryClient.setQueryData(
      progressQueryKeys.weekProgress(entityId),
      previousWeekProgress,
    );
  }

  for (const [period, data] of previousHabitChains) {
    if (data !== undefined) {
      queryClient.setQueryData(
        [...progressQueryKeys.all, "chain", entityId, period],
        data,
      );
    }
  }

  if (previousTodayCheckIns !== undefined) {
    queryClient.setQueryData(checkInsQueryKeys.today(), previousTodayCheckIns);
  }

  if (previousGoalCheckIns !== undefined) {
    queryClient.setQueryData(
      checkInsQueryKeys.list(entityId),
      previousGoalCheckIns,
    );
  }

  if (previousDashboard !== undefined) {
    queryClient.setQueryData(
      homeDashboardQueryKeys.dashboard(),
      previousDashboard,
    );
  }

  // Rollback tracking stats
  if (previousTrackingStats) {
    for (const [key, data] of previousTrackingStats) {
      if (data !== undefined) {
        const [trackingType, periodStr] = key.split("-");
        const period = parseInt(periodStr, 10);
        queryClient.setQueryData(
          trackingStatsQueryKeys.stats(
            entityType,
            entityId,
            trackingType,
            period,
          ),
          data,
        );
      }
    }
  }
}
