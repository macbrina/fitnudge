import {
  useMutation,
  useQuery,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import {
  mealLogsService,
  MealLog,
  CreateMealLogRequest,
  UpdateMealLogRequest,
  EstimateNutritionRequest,
  NutritionEstimation,
  MealType,
  MealHistoryResponse,
} from "@/services/api/mealLogs";
import { homeDashboardQueryKeys } from "./useHomeDashboard";
import { trackingStatsQueryKeys } from "./useTrackingStats";
import { progressQueryKeys } from "./useProgressData";
import type {
  TrackingStatsResponse,
  MealStats,
} from "@/services/api/trackingStats";
import {
  cancelProgressQueries,
  snapshotProgressData,
  optimisticallyUpdateProgress,
  rollbackProgressData,
  ProgressOptimisticContext,
} from "./progressOptimisticUpdates";

// Period options that GoalProgressSection uses
const PERIOD_OPTIONS = [7, 30, 90] as const;

// Query keys
export const mealLogsQueryKeys = {
  all: ["mealLogs"] as const,
  list: (params?: {
    start_date?: string;
    end_date?: string;
    goal_id?: string;
    challenge_id?: string;
  }) => [...mealLogsQueryKeys.all, "list", params] as const,
  history: (params: { goal_id?: string; challenge_id?: string }) =>
    [...mealLogsQueryKeys.all, "history", params] as const,
};

/**
 * Hook to estimate nutrition using AI
 */
export function useEstimateNutrition() {
  return useMutation({
    mutationFn: async (request: EstimateNutritionRequest) => {
      const response = await mealLogsService.estimateNutrition(request);
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data as NutritionEstimation;
    },
  });
}

/**
 * Hook to log a meal with optimistic updates
 */
export function useLogMeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateMealLogRequest) => {
      const response = await mealLogsService.logMeal(data);
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data as MealLog;
    },

    // Optimistic update
    onMutate: async (newMealLog) => {
      // Use LOCAL date to match progressOptimisticUpdates which uses formatLocalDate
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const isToday = newMealLog.logged_date === today;

      // Cancel in-flight queries to prevent race conditions
      await queryClient.cancelQueries({ queryKey: mealLogsQueryKeys.all });

      // Also cancel tracking stats queries for instant updates
      if (newMealLog.goal_id) {
        await queryClient.cancelQueries({
          queryKey: trackingStatsQueryKeys.entity("goal", newMealLog.goal_id),
        });
        // Cancel progress queries for instant progress section updates
        await cancelProgressQueries(queryClient, newMealLog.goal_id, "goal");
      }
      if (newMealLog.challenge_id) {
        await queryClient.cancelQueries({
          queryKey: trackingStatsQueryKeys.entity(
            "challenge",
            newMealLog.challenge_id,
          ),
        });
        // Cancel progress queries for challenges too
        await cancelProgressQueries(
          queryClient,
          newMealLog.challenge_id,
          "challenge",
        );
      }

      // Snapshot current data for potential rollback
      const previousMealLogs = queryClient.getQueryData(
        mealLogsQueryKeys.list({
          start_date: newMealLog.logged_date,
          end_date: newMealLog.logged_date,
          goal_id: newMealLog.goal_id,
          challenge_id: newMealLog.challenge_id,
        }),
      );

      // Snapshot tracking stats for all periods (for rollback)
      const previousTrackingStats: Map<
        string,
        TrackingStatsResponse | undefined
      > = new Map();
      const entityType = newMealLog.goal_id
        ? "goal"
        : newMealLog.challenge_id
          ? "challenge"
          : null;
      const entityId = newMealLog.goal_id || newMealLog.challenge_id;

      if (entityType && entityId) {
        for (const period of PERIOD_OPTIONS) {
          const queryKey = trackingStatsQueryKeys.stats(
            entityType,
            entityId,
            "meal",
            period,
          );
          previousTrackingStats.set(
            `${entityType}-${entityId}-${period}`,
            queryClient.getQueryData<TrackingStatsResponse>(queryKey),
          );
        }
      }

      console.log("newMealLog", newMealLog);

      // Create optimistic meal log with temporary ID
      const optimisticMealLog: MealLog = {
        id: `temp-${Date.now()}`,
        user_id: "temp-user",
        meal_type: newMealLog.meal_type,
        meal_name: newMealLog.meal_name,
        meal_description: newMealLog.meal_description,
        logged_date: newMealLog.logged_date,
        logged_time: newMealLog.logged_time,
        goal_id: newMealLog.goal_id,
        challenge_id: newMealLog.challenge_id,
        estimated_calories: newMealLog.estimated_calories,
        estimated_protein: newMealLog.estimated_protein,
        health_rating: newMealLog.health_rating,
        notes: newMealLog.notes,
        photo_url: newMealLog.photo_url,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Immediately add to cache (list query)
      queryClient.setQueryData(
        mealLogsQueryKeys.list({
          start_date: newMealLog.logged_date,
          end_date: newMealLog.logged_date,
          goal_id: newMealLog.goal_id,
          challenge_id: newMealLog.challenge_id,
        }),
        (old: MealLog[] | undefined) => {
          if (!old) return [optimisticMealLog];
          return [...old, optimisticMealLog];
        },
      );

      // Optimistically update meal history (infinite scroll query)
      // Add the new meal to the first page at the beginning (newest first)
      queryClient.setQueryData(
        mealLogsQueryKeys.history({
          goal_id: newMealLog.goal_id,
          challenge_id: newMealLog.challenge_id,
        }),
        (old: any) => {
          if (!old?.pages?.length) return old;
          // Add to first page's data array at the beginning
          const newPages = [...old.pages];
          newPages[0] = {
            ...newPages[0],
            data: [optimisticMealLog, ...newPages[0].data],
            total: (newPages[0].total || 0) + 1,
          };
          return { ...old, pages: newPages };
        },
      );

      // Snapshot and optimistically update progress data (streak, week, chain)
      let previousProgressData: ProgressOptimisticContext | undefined;
      if (newMealLog.goal_id) {
        previousProgressData = snapshotProgressData(
          queryClient,
          newMealLog.goal_id,
          newMealLog.logged_date,
          "goal",
        );
        optimisticallyUpdateProgress(
          queryClient,
          newMealLog.goal_id,
          newMealLog.logged_date,
        );
      } else if (newMealLog.challenge_id) {
        previousProgressData = snapshotProgressData(
          queryClient,
          newMealLog.challenge_id,
          newMealLog.logged_date,
          "challenge",
        );
      }

      // Optimistically update tracking stats (MealProgressStats)
      if (entityType && entityId) {
        const isThisWeek = (() => {
          const logDate = new Date(newMealLog.logged_date);
          const now = new Date();
          const dayOfWeek = now.getDay();
          const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() + mondayOffset);
          weekStart.setHours(0, 0, 0, 0);
          return logDate >= weekStart;
        })();

        for (const period of PERIOD_OPTIONS) {
          const queryKey = trackingStatsQueryKeys.stats(
            entityType,
            entityId,
            "meal",
            period,
          );
          queryClient.setQueryData<TrackingStatsResponse>(queryKey, (old) => {
            const newCalories = newMealLog.estimated_calories || 0;
            const newProtein = newMealLog.estimated_protein || 0;
            const isHealthy = newMealLog.health_rating === "healthy";
            const isOkay = newMealLog.health_rating === "okay";
            const isUnhealthy = newMealLog.health_rating === "unhealthy";

            // If no existing data, create initial optimistic state
            if (!old?.meal) {
              const initialMeal: MealStats = {
                total_meals_logged: 1,
                meals_this_week: isThisWeek ? 1 : 0,
                total_calories: newCalories,
                total_protein: newProtein,
                avg_meals_per_day: Math.round((1 / period) * 10) / 10,
                avg_calories_per_day: newCalories,
                avg_protein_per_day: newProtein,
                healthy_meals: isHealthy ? 1 : 0,
                okay_meals: isOkay ? 1 : 0,
                unhealthy_meals: isUnhealthy ? 1 : 0,
                healthy_meal_percentage: isHealthy ? 100 : 0,
                okay_meal_percentage: isOkay ? 100 : 0,
                unhealthy_meal_percentage: isUnhealthy ? 100 : 0,
                period_days: period,
              };
              return {
                tracking_type: "meal" as const,
                entity_type: entityType as "goal" | "challenge",
                entity_id: entityId,
                period_days: period,
                meal: initialMeal,
              };
            }

            const meal = old.meal;
            const newTotalMeals = meal.total_meals_logged + 1;
            const newTotalCalories = meal.total_calories + newCalories;
            const newTotalProtein = meal.total_protein + newProtein;
            const newHealthyMeals = meal.healthy_meals + (isHealthy ? 1 : 0);
            const newOkayMeals = (meal.okay_meals || 0) + (isOkay ? 1 : 0);
            const newUnhealthyMeals =
              (meal.unhealthy_meals || 0) + (isUnhealthy ? 1 : 0);
            const newMealsThisWeek = isThisWeek
              ? meal.meals_this_week + 1
              : meal.meals_this_week;

            // Approximate recalculation of averages
            const newAvgMealsPerDay =
              newTotalMeals > 0
                ? Math.round((newTotalMeals / period) * 10) / 10
                : 0;
            const newAvgCalories =
              newTotalMeals > 0
                ? Math.round(
                    newTotalCalories /
                      Math.max(1, Math.ceil(newTotalMeals / 3)),
                  )
                : 0;
            const newAvgProtein =
              newTotalMeals > 0
                ? Math.round(
                    newTotalProtein / Math.max(1, Math.ceil(newTotalMeals / 3)),
                  )
                : 0;

            const updatedMeal: MealStats = {
              ...meal,
              total_meals_logged: newTotalMeals,
              meals_this_week: newMealsThisWeek,
              total_calories: newTotalCalories,
              total_protein: newTotalProtein,
              avg_meals_per_day: newAvgMealsPerDay,
              avg_calories_per_day: newAvgCalories,
              avg_protein_per_day: newAvgProtein,
              healthy_meals: newHealthyMeals,
              okay_meals: newOkayMeals,
              unhealthy_meals: newUnhealthyMeals,
              healthy_meal_percentage:
                newTotalMeals > 0
                  ? Math.round((newHealthyMeals / newTotalMeals) * 1000) / 10
                  : 0,
              okay_meal_percentage:
                newTotalMeals > 0
                  ? Math.round((newOkayMeals / newTotalMeals) * 1000) / 10
                  : 0,
              unhealthy_meal_percentage:
                newTotalMeals > 0
                  ? Math.round((newUnhealthyMeals / newTotalMeals) * 1000) / 10
                  : 0,
            };

            return {
              ...old,
              meal: updatedMeal,
            };
          });
        }
      }

      // Return context for rollback
      return {
        previousMealLogs,
        previousTrackingStats,
        previousProgressData,
        optimisticId: optimisticMealLog.id,
        entityType,
        entityId,
      };
    },

    // Rollback on error
    onError: (err, newMealLog, context) => {
      // Rollback list query
      if (context?.previousMealLogs !== undefined) {
        queryClient.setQueryData(
          mealLogsQueryKeys.list({
            start_date: newMealLog.logged_date,
            end_date: newMealLog.logged_date,
            goal_id: newMealLog.goal_id,
            challenge_id: newMealLog.challenge_id,
          }),
          context.previousMealLogs,
        );
      }

      // Rollback history query - remove optimistic entry
      if (context?.optimisticId) {
        queryClient.setQueryData(
          mealLogsQueryKeys.history({
            goal_id: newMealLog.goal_id,
            challenge_id: newMealLog.challenge_id,
          }),
          (old: any) => {
            if (!old?.pages?.length) return old;
            const newPages = old.pages.map((page: any) => ({
              ...page,
              data: page.data.filter(
                (meal: MealLog) => meal.id !== context.optimisticId,
              ),
              total: Math.max(0, (page.total || 0) - 1),
            }));
            return { ...old, pages: newPages };
          },
        );
      }

      // Rollback tracking stats
      if (
        context?.previousTrackingStats &&
        context.entityType &&
        context.entityId
      ) {
        for (const period of PERIOD_OPTIONS) {
          const key = `${context.entityType}-${context.entityId}-${period}`;
          const previousValue = context.previousTrackingStats.get(key);
          if (previousValue !== undefined) {
            queryClient.setQueryData(
              trackingStatsQueryKeys.stats(
                context.entityType,
                context.entityId,
                "meal",
                period,
              ),
              previousValue,
            );
          }
        }
      }

      // Rollback progress data (streak, week, chain)
      if (context?.previousProgressData) {
        rollbackProgressData(queryClient, context.previousProgressData);
      }
    },

    // Replace temp data with real data on success
    onSuccess: (realMealLog, variables, context) => {
      // Log current tracking stats state
      if (context?.entityType && context?.entityId) {
        for (const period of PERIOD_OPTIONS) {
          const queryKey = trackingStatsQueryKeys.stats(
            context.entityType,
            context.entityId,
            "meal",
            period,
          );
          queryClient.getQueryData<TrackingStatsResponse>(queryKey);
        }
      }

      // Replace optimistic meal log with real one in list query
      queryClient.setQueryData(
        mealLogsQueryKeys.list({
          start_date: variables.logged_date,
          end_date: variables.logged_date,
          goal_id: variables.goal_id,
          challenge_id: variables.challenge_id,
        }),
        (old: MealLog[] | undefined) => {
          if (!old) return [realMealLog];
          // Filter out temp items and add real one
          const filtered = old.filter((log) => !log.id?.startsWith?.("temp-"));
          return [...filtered, realMealLog];
        },
      );

      // Replace optimistic meal log with real one in history query
      queryClient.setQueryData(
        mealLogsQueryKeys.history({
          goal_id: variables.goal_id,
          challenge_id: variables.challenge_id,
        }),
        (old: any) => {
          if (!old?.pages?.length) return old;
          // Replace temp item with real one in all pages
          const newPages = old.pages.map((page: any) => ({
            ...page,
            data: page.data.map((meal: MealLog) =>
              meal.id?.startsWith?.("temp-") ? realMealLog : meal,
            ),
          }));
          return { ...old, pages: newPages };
        },
      );

      // Invalidate home dashboard for check-in auto-completion
      queryClient.invalidateQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
      });

      // If associated with a goal or challenge, invalidate related queries
      // NOTE: We do NOT invalidate progress queries (streak, weekProgress, chain) here
      // because they were already optimistically updated in onMutate.
      // This prevents a 2-second delay while waiting for refetch.
      // Realtime subscription handles syncing if server data differs.
      if (realMealLog.goal_id) {
        queryClient.invalidateQueries({
          queryKey: ["goals", realMealLog.goal_id],
        });
        queryClient.invalidateQueries({ queryKey: ["checkins"] });
        // NOTE: Tracking stats were optimistically updated in onMutate
        // Only invalidate if we need fresh data (e.g., for other components)
        // queryClient.invalidateQueries({
        //   queryKey: trackingStatsQueryKeys.entity("goal", realMealLog.goal_id),
        // });
      }
      if (realMealLog.challenge_id) {
        queryClient.invalidateQueries({
          queryKey: ["challenges", realMealLog.challenge_id],
        });
        queryClient.invalidateQueries({ queryKey: ["challengeCheckins"] });
      }
    },
  });
}

/**
 * Hook to get meal logs
 */
export function useMealLogs(params?: {
  start_date?: string;
  end_date?: string;
  goal_id?: string;
  challenge_id?: string;
  meal_type?: MealType;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}) {
  const { enabled = true, ...queryParams } = params || {};

  return useQuery({
    queryKey: mealLogsQueryKeys.list(queryParams),
    queryFn: async () => {
      const response = await mealLogsService.getMealLogs(queryParams);
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data as MealLog[];
    },
    enabled,
  });
}

/**
 * Hook to get today's meal logs for a specific goal/challenge
 */
export function useTodaysMealLogs(goalId?: string, challengeId?: string) {
  const today = new Date().toISOString().split("T")[0];

  return useMealLogs({
    start_date: today,
    end_date: today,
    goal_id: goalId,
    challenge_id: challengeId,
    enabled: !!(goalId || challengeId),
  });
}

/**
 * Hook to update a meal log with optimistic updates
 */
export function useUpdateMealLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      mealLogId,
      data,
    }: {
      mealLogId: string;
      data: UpdateMealLogRequest;
    }) => {
      const response = await mealLogsService.updateMealLog(mealLogId, data);
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data as MealLog;
    },

    onMutate: async ({ mealLogId, data }) => {
      // Cancel in-flight queries
      await queryClient.cancelQueries({ queryKey: mealLogsQueryKeys.all });

      // Get all cached meal log lists and update optimistically
      const queriesData = queryClient.getQueriesData<MealLog[]>({
        queryKey: mealLogsQueryKeys.all,
      });

      // Update the meal log in all cached lists
      queriesData.forEach(([queryKey, oldData]) => {
        if (Array.isArray(oldData)) {
          queryClient.setQueryData(queryKey, (old: MealLog[] | undefined) => {
            if (!old) return old;
            return old.map((log) =>
              log.id === mealLogId ? { ...log, ...data } : log,
            );
          });
        }
      });

      return { queriesData };
    },

    onError: (err, variables, context) => {
      // Rollback all queries to previous state
      context?.queriesData?.forEach(([queryKey, value]) => {
        queryClient.setQueryData(queryKey, value);
      });
    },

    onSuccess: () => {
      // Invalidate to ensure fresh data from server
      queryClient.invalidateQueries({ queryKey: mealLogsQueryKeys.all });
    },
  });
}

/**
 * Hook to delete a meal log with optimistic updates
 */
export function useDeleteMealLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mealLogId: string) => {
      const response = await mealLogsService.deleteMealLog(mealLogId);
      if (response.error) {
        throw new Error(response.error);
      }
    },

    onMutate: async (mealLogId) => {
      // Cancel in-flight queries
      await queryClient.cancelQueries({ queryKey: mealLogsQueryKeys.all });

      // Get all cached meal log lists
      const queriesData = queryClient.getQueriesData<MealLog[]>({
        queryKey: mealLogsQueryKeys.all,
      });

      // Remove the meal log from all cached lists
      queriesData.forEach(([queryKey, oldData]) => {
        if (Array.isArray(oldData)) {
          queryClient.setQueryData(queryKey, (old: MealLog[] | undefined) => {
            if (!old) return old;
            return old.filter((log) => log.id !== mealLogId);
          });
        }
      });

      return { queriesData };
    },

    onError: (err, mealLogId, context) => {
      // Rollback all queries to previous state
      context?.queriesData?.forEach(([queryKey, value]) => {
        queryClient.setQueryData(queryKey, value);
      });
    },

    onSuccess: () => {
      // Invalidate to ensure fresh data from server
      queryClient.invalidateQueries({ queryKey: mealLogsQueryKeys.all });
    },
  });
}

/**
 * Daily nutrition summary for a specific date
 */
export interface DailyNutritionSummary {
  total_calories: number;
  total_protein: number;
  meal_count: number;
  healthy_count: number;
  target_calories: number;
  target_protein: number;
  calories_remaining: number;
  protein_remaining: number;
  calories_percentage: number;
  protein_percentage: number;
}

// Default daily targets (can be customized based on user settings)
const DEFAULT_CALORIE_TARGET = 2000;
const DEFAULT_PROTEIN_TARGET = 50; // grams

/**
 * Hook to get today's nutrition summary
 * Calculates totals from today's logged meals
 */
export function useTodaysNutritionSummary(
  goalId?: string,
  challengeId?: string,
  calorieTarget: number = DEFAULT_CALORIE_TARGET,
  proteinTarget: number = DEFAULT_PROTEIN_TARGET,
) {
  const today = new Date().toISOString().split("T")[0];

  const { data: mealLogs, isLoading } = useQuery({
    queryKey: mealLogsQueryKeys.list({
      start_date: today,
      end_date: today,
      goal_id: goalId,
      challenge_id: challengeId,
    }),
    queryFn: async () => {
      const response = await mealLogsService.getMealLogs({
        start_date: today,
        end_date: today,
        goal_id: goalId,
        challenge_id: challengeId,
      });
      return response.data || [];
    },
    staleTime: 0,
  });

  // Calculate summary from meal logs
  const summary: DailyNutritionSummary = {
    total_calories: 0,
    total_protein: 0,
    meal_count: 0,
    healthy_count: 0,
    target_calories: calorieTarget,
    target_protein: proteinTarget,
    calories_remaining: calorieTarget,
    protein_remaining: proteinTarget,
    calories_percentage: 0,
    protein_percentage: 0,
  };

  if (mealLogs && mealLogs.length > 0) {
    summary.meal_count = mealLogs.length;
    summary.total_calories = mealLogs.reduce(
      (sum, log) => sum + (log.estimated_calories || 0),
      0,
    );
    summary.total_protein = mealLogs.reduce(
      (sum, log) => sum + (log.estimated_protein || 0),
      0,
    );
    summary.healthy_count = mealLogs.filter(
      (log) => log.health_rating === "healthy",
    ).length;

    summary.calories_remaining = Math.max(
      0,
      calorieTarget - summary.total_calories,
    );
    summary.protein_remaining = Math.max(
      0,
      proteinTarget - summary.total_protein,
    );
    summary.calories_percentage = Math.round(
      (summary.total_calories / calorieTarget) * 100,
    );
    summary.protein_percentage = Math.round(
      (summary.total_protein / proteinTarget) * 100,
    );
  }

  return {
    data: summary,
    isLoading,
    refetch: () => {},
  };
}

/**
 * Hook to get paginated meal history with infinite scroll
 */
export function useMealHistory(
  goalId?: string,
  challengeId?: string,
  enabled: boolean = true,
) {
  const ITEMS_PER_PAGE = 20;

  return useInfiniteQuery({
    queryKey: mealLogsQueryKeys.history({
      goal_id: goalId,
      challenge_id: challengeId,
    }),
    queryFn: async ({ pageParam = 1 }) => {
      const response = await mealLogsService.getMealHistory({
        goal_id: goalId,
        challenge_id: challengeId,
        page: pageParam,
        limit: ITEMS_PER_PAGE,
      });
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data as MealHistoryResponse;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.has_more) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    enabled,
  });
}
