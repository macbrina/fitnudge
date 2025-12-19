import {
  actionablePlansQueryKeys,
  checkInsQueryKeys,
  goalsQueryKeys,
  userQueryKeys,
} from "@/hooks/api/queryKeys";
import { homeDashboardQueryKeys } from "@/hooks/api/useHomeDashboard";
import { useGoalNotifications } from "@/hooks/notifications/useGoalNotifications";
import {
  CreateGoalRequest,
  goalsService,
  UpdateGoalRequest,
} from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Re-export for backward compatibility
export { goalsQueryKeys } from "@/hooks/api/queryKeys";

// Goals Hooks
export const useGoals = () => {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: goalsQueryKeys.list(),
    queryFn: () => goalsService.getGoals(),
    enabled: isAuthenticated, // Only fetch when authenticated
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useGoal = (goalId: string) => {
  return useQuery({
    queryKey: goalsQueryKeys.detail(goalId),
    queryFn: () => goalsService.getGoal(goalId),
    enabled: !!goalId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useCreateGoal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (goal: CreateGoalRequest) => goalsService.createGoal(goal),
    // Optimistic update for instant UI feedback
    onMutate: async (newGoal) => {
      // Cancel outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.list() });
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.active() });
      await queryClient.cancelQueries({ queryKey: ["user", "stats"] });

      // Snapshot previous data for rollback
      const previousGoals = queryClient.getQueryData(goalsQueryKeys.list());
      const previousActiveGoals = queryClient.getQueryData(
        goalsQueryKeys.active()
      );
      const previousUserStats = queryClient.getQueryData(
        userQueryKeys.userStats()
      );

      // Create optimistic goal with temp ID
      const optimisticGoal = {
        id: `temp-${Date.now()}`,
        ...newGoal,
        user_id: "", // Will be set by backend
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: newGoal.is_active ?? true,
      };

      // Optimistically add to goals list
      queryClient.setQueryData(goalsQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: [...old.data, optimisticGoal] };
      });

      // Add to active goals if active
      if (optimisticGoal.is_active) {
        queryClient.setQueryData(goalsQueryKeys.active(), (old: any) => {
          if (!old?.data) return old;
          return { ...old, data: [...old.data, optimisticGoal] };
        });
      }

      // Optimistically update user stats (increment counts)
      queryClient.setQueryData(userQueryKeys.userStats(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: {
            ...old.data,
            total_goals: (old.data.total_goals || 0) + 1,
            ...(optimisticGoal.is_active && {
              active_goals: (old.data.active_goals || 0) + 1,
            }),
          },
        };
      });

      return { previousGoals, previousActiveGoals, previousUserStats };
    },
    onError: (err, newGoal, context) => {
      // Rollback on error
      if (context?.previousGoals) {
        queryClient.setQueryData(goalsQueryKeys.list(), context.previousGoals);
      }
      if (context?.previousActiveGoals) {
        queryClient.setQueryData(
          goalsQueryKeys.active(),
          context.previousActiveGoals
        );
      }
      if (context?.previousUserStats) {
        queryClient.setQueryData(
          userQueryKeys.userStats(),
          context.previousUserStats
        );
      }
    },
    onSuccess: async (response) => {
      // Replace optimistic goal with real one from server
      const realGoal = response?.data;
      if (realGoal) {
        queryClient.setQueryData(goalsQueryKeys.list(), (old: any) => {
          if (!old?.data) return old;
          // Remove temp and add real
          const filtered = old.data.filter(
            (g: any) => !g.id.startsWith("temp-")
          );
          return { ...old, data: [...filtered, realGoal] };
        });

        // IMPORTANT: Keep goal in active list even if is_active is false
        // Goal starts inactive until plan is ready, but we show it with "generating" badge
        // When plan is completed, backend activates the goal and we'll refetch
        queryClient.setQueryData(goalsQueryKeys.active(), (old: any) => {
          if (!old?.data) return old;
          const filtered = old.data.filter(
            (g: any) => !g.id.startsWith("temp-")
          );
          // Add goal with is_active forced to true for display purposes
          // Real state will be synced when plan is ready
          return {
            ...old,
            data: [...filtered, { ...realGoal, is_active: true }],
          };
        });
      }

      // Invalidate plan status queries to ensure they refetch
      queryClient.invalidateQueries({ queryKey: actionablePlansQueryKeys.all });
      // Invalidate user stats for accurate server-side calculation
      queryClient.invalidateQueries({ queryKey: userQueryKeys.userStats() });
    },
  });
};

export const useUpdateGoal = () => {
  const queryClient = useQueryClient();
  const { cancelGoalNotifications } = useGoalNotifications();

  return useMutation({
    mutationFn: ({
      goalId,
      updates,
    }: {
      goalId: string;
      updates: UpdateGoalRequest;
    }) => goalsService.updateGoal(goalId, updates),
    // Optimistic update for instant UI feedback
    onMutate: async ({ goalId, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.list() });
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.active() });
      await queryClient.cancelQueries({
        queryKey: goalsQueryKeys.detail(goalId),
      });

      // Snapshot previous data
      const previousGoals = queryClient.getQueryData(goalsQueryKeys.list());
      const previousActiveGoals = queryClient.getQueryData(
        goalsQueryKeys.active()
      );
      const previousDetail = queryClient.getQueryData(
        goalsQueryKeys.detail(goalId)
      );

      // Optimistically update goals list
      queryClient.setQueryData(goalsQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((g: any) =>
            g.id === goalId
              ? { ...g, ...updates, updated_at: new Date().toISOString() }
              : g
          ),
        };
      });

      // Handle active goals based on is_active status
      queryClient.setQueryData(goalsQueryKeys.active(), (old: any) => {
        if (!old?.data) return old;
        if (updates.is_active === false) {
          // Remove from active goals
          return { ...old, data: old.data.filter((g: any) => g.id !== goalId) };
        } else if (updates.is_active === true) {
          // Add to active goals if not already there
          const existing = old.data.find((g: any) => g.id === goalId);
          if (existing) {
            return {
              ...old,
              data: old.data.map((g: any) =>
                g.id === goalId ? { ...g, ...updates } : g
              ),
            };
          }
          // Get full goal from list
          const allGoals = queryClient.getQueryData(
            goalsQueryKeys.list()
          ) as any;
          const fullGoal = allGoals?.data?.find((g: any) => g.id === goalId);
          if (fullGoal) {
            return { ...old, data: [...old.data, { ...fullGoal, ...updates }] };
          }
        } else {
          // Just update in place
          return {
            ...old,
            data: old.data.map((g: any) =>
              g.id === goalId ? { ...g, ...updates } : g
            ),
          };
        }
        return old;
      });

      // Update detail cache
      queryClient.setQueryData(goalsQueryKeys.detail(goalId), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: {
            ...old.data,
            ...updates,
            updated_at: new Date().toISOString(),
          },
        };
      });

      return { previousGoals, previousActiveGoals, previousDetail, goalId };
    },
    onError: (err, { goalId }, context) => {
      // Rollback on error
      if (context?.previousGoals) {
        queryClient.setQueryData(goalsQueryKeys.list(), context.previousGoals);
      }
      if (context?.previousActiveGoals) {
        queryClient.setQueryData(
          goalsQueryKeys.active(),
          context.previousActiveGoals
        );
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(
          goalsQueryKeys.detail(goalId),
          context.previousDetail
        );
      }
    },
    onSuccess: async (response, { goalId, updates }) => {
      const updatedGoal = response?.data;

      // Handle local notification cleanup when goal is deactivated
      if (updatedGoal && updates.is_active !== undefined) {
        if (!updates.is_active && !updatedGoal.is_active) {
          await cancelGoalNotifications(goalId);
        }
      }

      // Update cache with real server response (to catch any server-side changes)
      if (updatedGoal) {
        queryClient.setQueryData(goalsQueryKeys.detail(goalId), (old: any) => ({
          ...old,
          data: updatedGoal,
        }));
      }

      // Invalidate plan status for this goal
      queryClient.invalidateQueries({
        queryKey: actionablePlansQueryKeys.planStatus(goalId),
      });
    },
  });
};

export const useDeleteGoal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (goalId: string) => goalsService.deleteGoal(goalId),
    // Optimistic update for instant UI feedback
    onMutate: async (goalId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.list() });
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.active() });
      await queryClient.cancelQueries({ queryKey: userQueryKeys.userStats() });
      await queryClient.cancelQueries({ queryKey: checkInsQueryKeys.today() });
      await queryClient.cancelQueries({ queryKey: checkInsQueryKeys.stats() });
      await queryClient.cancelQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
      });

      // Snapshot previous data
      const previousGoals = queryClient.getQueryData(goalsQueryKeys.list());
      const previousActiveGoals = queryClient.getQueryData(
        goalsQueryKeys.active()
      );
      const previousUserStats = queryClient.getQueryData(
        userQueryKeys.userStats()
      );
      const previousTodayCheckIns = queryClient.getQueryData(
        checkInsQueryKeys.today()
      );
      const previousCheckInStats = queryClient.getQueryData(
        checkInsQueryKeys.stats()
      );
      const previousDashboard = queryClient.getQueryData(
        homeDashboardQueryKeys.dashboard()
      );

      // Check if the goal being deleted is active (for stats update)
      const activeGoals = previousActiveGoals as any;
      const isActiveGoal = activeGoals?.data?.some((g: any) => g.id === goalId);

      // Count check-ins being removed for this goal
      const todayCheckIns = previousTodayCheckIns as any;
      const removedCheckInsCount =
        todayCheckIns?.data?.filter((c: any) => c.goal_id === goalId).length ||
        0;

      // Optimistically remove from goals lists
      queryClient.setQueryData(goalsQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.filter((g: any) => g.id !== goalId) };
      });

      queryClient.setQueryData(goalsQueryKeys.active(), (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.filter((g: any) => g.id !== goalId) };
      });

      // Optimistically remove check-ins for the deleted goal (TodaysActionsCard)
      queryClient.setQueryData(checkInsQueryKeys.today(), (old: any) => {
        if (!old?.data) return old;
        const newData = old.data.filter((c: any) => c.goal_id !== goalId);
        return {
          ...old,
          data: newData,
        };
      });

      // Optimistically update user stats (decrement counts)
      queryClient.setQueryData(userQueryKeys.userStats(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: {
            ...old.data,
            total_goals: Math.max(0, (old.data.total_goals || 0) - 1),
            total_check_ins: Math.max(
              0,
              (old.data.total_check_ins || 0) - removedCheckInsCount
            ),
            // Only decrement active_goals if it was an active goal
            ...(isActiveGoal && {
              active_goals: Math.max(0, (old.data.active_goals || 0) - 1),
            }),
          },
        };
      });

      // Optimistically update check-in stats (QuickStatsGrid completion rate)
      queryClient.setQueryData(checkInsQueryKeys.stats(), (old: any) => {
        if (!old?.data) return old;
        // Recalculate stats after removing this goal's check-ins
        const totalCheckIns = Math.max(
          0,
          (old.data.total_check_ins || 0) - removedCheckInsCount
        );
        return {
          ...old,
          data: {
            ...old.data,
            total_check_ins: totalCheckIns,
            // Keep other stats as is - server will recalculate on next fetch
          },
        };
      });

      // Optimistically update home dashboard (HomeScreen)
      queryClient.setQueryData(
        homeDashboardQueryKeys.dashboard(),
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            // Remove goal from items
            items: (old.items || []).filter(
              (item: any) => !(item.type === "goal" && item.data?.id === goalId)
            ),
            // Remove pending check-ins for this goal
            today_pending_checkins: (old.today_pending_checkins || []).filter(
              (item: any) =>
                !(item.type === "goal" && item.data?.goal_id === goalId)
            ),
            // Update stats
            stats: old.stats
              ? {
                  ...old.stats,
                  active_count: Math.max(0, (old.stats.active_count || 0) - 1),
                }
              : old.stats,
          };
        }
      );

      return {
        previousGoals,
        previousActiveGoals,
        previousUserStats,
        previousTodayCheckIns,
        previousCheckInStats,
        previousDashboard,
      };
    },
    onError: (err, goalId, context) => {
      // Rollback on error
      if (context?.previousGoals) {
        queryClient.setQueryData(goalsQueryKeys.list(), context.previousGoals);
      }
      if (context?.previousActiveGoals) {
        queryClient.setQueryData(
          goalsQueryKeys.active(),
          context.previousActiveGoals
        );
      }
      if (context?.previousUserStats) {
        queryClient.setQueryData(
          userQueryKeys.userStats(),
          context.previousUserStats
        );
      }
      if (context?.previousTodayCheckIns) {
        queryClient.setQueryData(
          checkInsQueryKeys.today(),
          context.previousTodayCheckIns
        );
      }
      if (context?.previousCheckInStats) {
        queryClient.setQueryData(
          checkInsQueryKeys.stats(),
          context.previousCheckInStats
        );
      }
      if (context?.previousDashboard) {
        queryClient.setQueryData(
          homeDashboardQueryKeys.dashboard(),
          context.previousDashboard
        );
      }
    },
    onSuccess: () => {
      // Invalidate all related queries to ensure UI is in sync
      // Goals list (GoalsScreen counts and tabs)
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.list() });
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.active() });
      // Stats for accurate recalculation from server
      queryClient.invalidateQueries({ queryKey: userQueryKeys.userStats() });
      queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.stats() });
      // Home dashboard (HomeScreen uses this)
      queryClient.invalidateQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
      });
    },
  });
};

export const useGoalTemplates = () => {
  return useQuery({
    queryKey: goalsQueryKeys.templates(),
    queryFn: () => goalsService.getGoalTemplates(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useCreateGoalFromTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (templateId: string) =>
      goalsService.createGoalFromTemplate(templateId),
    // Note: Can't do optimistic update since we don't know the goal details
    // Just invalidate on success for consistency
    onSuccess: (response) => {
      const newGoal = response?.data;
      if (newGoal) {
        // Add to list immediately
        queryClient.setQueryData(goalsQueryKeys.list(), (old: any) => {
          if (!old?.data) return old;
          return { ...old, data: [...old.data, newGoal] };
        });

        if (newGoal.is_active) {
          queryClient.setQueryData(goalsQueryKeys.active(), (old: any) => {
            if (!old?.data) return old;
            return { ...old, data: [...old.data, newGoal] };
          });
        }

        // Update stats
        queryClient.setQueryData(userQueryKeys.userStats(), (old: any) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: {
              ...old.data,
              total_goals: (old.data.total_goals || 0) + 1,
              ...(newGoal.is_active && {
                active_goals: (old.data.active_goals || 0) + 1,
              }),
            },
          };
        });
      }
      queryClient.invalidateQueries({ queryKey: userQueryKeys.userStats() });
    },
  });
};

export const useGoalStats = (goalId?: string) => {
  return useQuery({
    queryKey: goalsQueryKeys.stats(goalId),
    queryFn: () => goalsService.getGoalStats(goalId),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useArchiveGoal = () => {
  const queryClient = useQueryClient();
  const { cancelGoalNotifications } = useGoalNotifications();

  return useMutation({
    mutationFn: (goalId: string) => goalsService.archiveGoal(goalId),
    // Optimistic update for instant UI feedback
    onMutate: async (goalId) => {
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.list() });
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.active() });

      const previousGoals = queryClient.getQueryData(goalsQueryKeys.list());
      const previousActiveGoals = queryClient.getQueryData(
        goalsQueryKeys.active()
      );
      const previousUserStats = queryClient.getQueryData(
        userQueryKeys.userStats()
      );

      // Optimistically update is_active to false
      queryClient.setQueryData(goalsQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((g: any) =>
            g.id === goalId ? { ...g, is_active: false } : g
          ),
        };
      });

      // Remove from active goals
      queryClient.setQueryData(goalsQueryKeys.active(), (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.filter((g: any) => g.id !== goalId) };
      });

      // Decrement active goals count
      queryClient.setQueryData(userQueryKeys.userStats(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: {
            ...old.data,
            active_goals: Math.max(0, (old.data.active_goals || 0) - 1),
          },
        };
      });

      return { previousGoals, previousActiveGoals, previousUserStats };
    },
    onError: (err, goalId, context) => {
      if (context?.previousGoals) {
        queryClient.setQueryData(goalsQueryKeys.list(), context.previousGoals);
      }
      if (context?.previousActiveGoals) {
        queryClient.setQueryData(
          goalsQueryKeys.active(),
          context.previousActiveGoals
        );
      }
      if (context?.previousUserStats) {
        queryClient.setQueryData(
          userQueryKeys.userStats(),
          context.previousUserStats
        );
      }
    },
    onSuccess: async (_, goalId) => {
      await cancelGoalNotifications(goalId);
      queryClient.invalidateQueries({
        queryKey: actionablePlansQueryKeys.planStatus(goalId),
      });
      queryClient.invalidateQueries({ queryKey: userQueryKeys.userStats() });
    },
  });
};

export const useUnarchiveGoal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (goalId: string) => goalsService.unarchiveGoal(goalId),
    // Optimistic update for instant UI feedback
    onMutate: async (goalId) => {
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.list() });
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.active() });

      const previousGoals = queryClient.getQueryData(goalsQueryKeys.list());
      const previousActiveGoals = queryClient.getQueryData(
        goalsQueryKeys.active()
      );
      const previousUserStats = queryClient.getQueryData(
        userQueryKeys.userStats()
      );

      // Get the goal to add to active
      const allGoals = previousGoals as any;
      const goal = allGoals?.data?.find((g: any) => g.id === goalId);

      // Optimistically update is_active to true
      queryClient.setQueryData(goalsQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((g: any) =>
            g.id === goalId ? { ...g, is_active: true } : g
          ),
        };
      });

      // Add to active goals
      if (goal) {
        queryClient.setQueryData(goalsQueryKeys.active(), (old: any) => {
          if (!old?.data) return old;
          const exists = old.data.some((g: any) => g.id === goalId);
          if (exists) return old;
          return { ...old, data: [...old.data, { ...goal, is_active: true }] };
        });
      }

      // Increment active goals count
      queryClient.setQueryData(userQueryKeys.userStats(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: {
            ...old.data,
            active_goals: (old.data.active_goals || 0) + 1,
          },
        };
      });

      return { previousGoals, previousActiveGoals, previousUserStats };
    },
    onError: (err, goalId, context) => {
      if (context?.previousGoals) {
        queryClient.setQueryData(goalsQueryKeys.list(), context.previousGoals);
      }
      if (context?.previousActiveGoals) {
        queryClient.setQueryData(
          goalsQueryKeys.active(),
          context.previousActiveGoals
        );
      }
      if (context?.previousUserStats) {
        queryClient.setQueryData(
          userQueryKeys.userStats(),
          context.previousUserStats
        );
      }
    },
    onSuccess: async (response, goalId) => {
      queryClient.invalidateQueries({
        queryKey: actionablePlansQueryKeys.planStatus(goalId),
      });
      queryClient.invalidateQueries({ queryKey: userQueryKeys.userStats() });
    },
  });
};

export const useActivateGoal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (goalId: string) => goalsService.activateGoal(goalId),
    // Optimistic update for instant UI feedback
    onMutate: async (goalId) => {
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.list() });
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.active() });
      await queryClient.cancelQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
      });

      const previousGoals = queryClient.getQueryData(goalsQueryKeys.list());
      const previousActiveGoals = queryClient.getQueryData(
        goalsQueryKeys.active()
      );
      const previousUserStats = queryClient.getQueryData(
        userQueryKeys.userStats()
      );
      const previousDashboard = queryClient.getQueryData(
        homeDashboardQueryKeys.dashboard()
      );

      // Get the goal to add to active
      const allGoals = previousGoals as any;
      const goal = allGoals?.data?.find((g: any) => g.id === goalId);

      // Optimistically update is_active to true
      queryClient.setQueryData(goalsQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((g: any) =>
            g.id === goalId ? { ...g, is_active: true } : g
          ),
        };
      });

      // Add to active goals
      if (goal) {
        queryClient.setQueryData(goalsQueryKeys.active(), (old: any) => {
          if (!old?.data) return old;
          const exists = old.data.some((g: any) => g.id === goalId);
          if (exists) return old;
          return { ...old, data: [...old.data, { ...goal, is_active: true }] };
        });
      }

      // Increment active goals count
      queryClient.setQueryData(userQueryKeys.userStats(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: {
            ...old.data,
            active_goals: (old.data.active_goals || 0) + 1,
          },
        };
      });

      // Optimistically update home dashboard
      queryClient.setQueryData(
        homeDashboardQueryKeys.dashboard(),
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            stats: old.stats
              ? {
                  ...old.stats,
                  active_count: (old.stats.active_count || 0) + 1,
                }
              : old.stats,
          };
        }
      );

      return {
        previousGoals,
        previousActiveGoals,
        previousUserStats,
        previousDashboard,
      };
    },
    onError: (err, goalId, context) => {
      if (context?.previousGoals) {
        queryClient.setQueryData(goalsQueryKeys.list(), context.previousGoals);
      }
      if (context?.previousActiveGoals) {
        queryClient.setQueryData(
          goalsQueryKeys.active(),
          context.previousActiveGoals
        );
      }
      if (context?.previousUserStats) {
        queryClient.setQueryData(
          userQueryKeys.userStats(),
          context.previousUserStats
        );
      }
      if (context?.previousDashboard) {
        queryClient.setQueryData(
          homeDashboardQueryKeys.dashboard(),
          context.previousDashboard
        );
      }
    },
    onSuccess: async (response, goalId) => {
      queryClient.invalidateQueries({
        queryKey: actionablePlansQueryKeys.planStatus(goalId),
      });
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.list() });
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.active() });
      queryClient.invalidateQueries({ queryKey: userQueryKeys.userStats() });
      queryClient.invalidateQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
      });
    },
  });
};

export const useDeactivateGoal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (goalId: string) => goalsService.deactivateGoal(goalId),
    // Optimistic update for instant UI feedback
    onMutate: async (goalId) => {
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.list() });
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.active() });
      await queryClient.cancelQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
      });

      const previousGoals = queryClient.getQueryData(goalsQueryKeys.list());
      const previousActiveGoals = queryClient.getQueryData(
        goalsQueryKeys.active()
      );
      const previousUserStats = queryClient.getQueryData(
        userQueryKeys.userStats()
      );
      const previousDashboard = queryClient.getQueryData(
        homeDashboardQueryKeys.dashboard()
      );

      // Optimistically update is_active to false
      queryClient.setQueryData(goalsQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((g: any) =>
            g.id === goalId ? { ...g, is_active: false } : g
          ),
        };
      });

      // Remove from active goals
      queryClient.setQueryData(goalsQueryKeys.active(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((g: any) => g.id !== goalId),
        };
      });

      // Decrement active goals count
      queryClient.setQueryData(userQueryKeys.userStats(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: {
            ...old.data,
            active_goals: Math.max(0, (old.data.active_goals || 1) - 1),
          },
        };
      });

      // Optimistically update home dashboard
      queryClient.setQueryData(
        homeDashboardQueryKeys.dashboard(),
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            // Remove goal from items
            items: (old.items || []).filter(
              (item: any) => !(item.type === "goal" && item.data?.id === goalId)
            ),
            stats: old.stats
              ? {
                  ...old.stats,
                  active_count: Math.max(0, (old.stats.active_count || 1) - 1),
                }
              : old.stats,
          };
        }
      );

      return {
        previousGoals,
        previousActiveGoals,
        previousUserStats,
        previousDashboard,
      };
    },
    onError: (err, goalId, context) => {
      if (context?.previousGoals) {
        queryClient.setQueryData(goalsQueryKeys.list(), context.previousGoals);
      }
      if (context?.previousActiveGoals) {
        queryClient.setQueryData(
          goalsQueryKeys.active(),
          context.previousActiveGoals
        );
      }
      if (context?.previousUserStats) {
        queryClient.setQueryData(
          userQueryKeys.userStats(),
          context.previousUserStats
        );
      }
      if (context?.previousDashboard) {
        queryClient.setQueryData(
          homeDashboardQueryKeys.dashboard(),
          context.previousDashboard
        );
      }
    },
    onSuccess: async (response, goalId) => {
      queryClient.invalidateQueries({
        queryKey: actionablePlansQueryKeys.planStatus(goalId),
      });
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.list() });
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.active() });
      queryClient.invalidateQueries({ queryKey: userQueryKeys.userStats() });
      queryClient.invalidateQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
      });
    },
  });
};

export const useDuplicateGoal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (goalId: string) => goalsService.duplicateGoal(goalId),
    // Update cache with new goal on success
    onSuccess: (response) => {
      const newGoal = response?.data;
      if (newGoal) {
        // Add to list immediately
        queryClient.setQueryData(goalsQueryKeys.list(), (old: any) => {
          if (!old?.data) return old;
          return { ...old, data: [...old.data, newGoal] };
        });

        if (newGoal.is_active) {
          queryClient.setQueryData(goalsQueryKeys.active(), (old: any) => {
            if (!old?.data) return old;
            return { ...old, data: [...old.data, newGoal] };
          });
        }

        // Update stats
        queryClient.setQueryData(userQueryKeys.userStats(), (old: any) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: {
              ...old.data,
              total_goals: (old.data.total_goals || 0) + 1,
              ...(newGoal.is_active && {
                active_goals: (old.data.active_goals || 0) + 1,
              }),
            },
          };
        });
      }
      queryClient.invalidateQueries({ queryKey: userQueryKeys.userStats() });
    },
  });
};

export const useGoalsByCategory = (category: string) => {
  return useQuery({
    queryKey: goalsQueryKeys.byCategory(category),
    queryFn: () => goalsService.getGoalsByCategory(category as any),
    enabled: !!category,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useActiveGoals = () => {
  return useQuery({
    queryKey: goalsQueryKeys.active(),
    queryFn: () => goalsService.getActiveGoals(),
    staleTime: 1 * 60 * 1000, // 1 minute
  });
};

export const useCompletedGoals = () => {
  return useQuery({
    queryKey: goalsQueryKeys.completed(),
    queryFn: () => goalsService.getCompletedGoals(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
