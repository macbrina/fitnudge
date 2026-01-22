/**
 * V2 Goals Hooks
 *
 * React Query hooks for V2 goals (simple habit tracking).
 * Features:
 * - Optimistic updates for instant UI feedback
 * - Proper cache invalidation patterns
 * - Support for active/paused/archived status
 */

import { checkInsQueryKeys, goalsQueryKeys, userQueryKeys } from "@/hooks/api/queryKeys";
import { homeDashboardQueryKeys } from "@/hooks/api/useHomeDashboard";
import { useGoalNotifications } from "@/hooks/notifications/useGoalNotifications";
import { CreateGoalRequest, Goal, goalsService, UpdateGoalRequest } from "@/services/api/goals";
import { useAuthStore } from "@/stores/authStore";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Re-export for backward compatibility
export { goalsQueryKeys } from "@/hooks/api/queryKeys";

// Empty response for placeholder (prevents loading spinners)
const EMPTY_GOALS_RESPONSE = { data: [], status: 200 };

// =============================================================================
// QUERY HOOKS
// =============================================================================

/**
 * Get all active goals (default view)
 * Returns goals with status='active', includes today's completion status
 */
export const useGoals = () => {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: goalsQueryKeys.active(),
    queryFn: () => goalsService.getActiveGoals(),
    enabled: isAuthenticated,
    staleTime: 30 * 1000, // 30 seconds - goals status can change frequently
    refetchOnMount: true, // Always check for fresh data on mount
    placeholderData: EMPTY_GOALS_RESPONSE // Show empty instead of loading
  });
};

/**
 * Alias for useGoals - explicitly named for clarity
 */
export const useActiveGoals = useGoals;

/**
 * Get all goals including archived
 */
export const useAllGoals = () => {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: goalsQueryKeys.list(),
    queryFn: () => goalsService.getAllGoals(),
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
    refetchOnMount: true,
    placeholderData: EMPTY_GOALS_RESPONSE
  });
};

/**
 * Get archived goals only
 */
export const useArchivedGoals = () => {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: goalsQueryKeys.archived(),
    queryFn: () => goalsService.getArchivedGoals(),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes - archived goals rarely change
    placeholderData: EMPTY_GOALS_RESPONSE
  });
};

/**
 * Get a single goal by ID
 */
export const useGoal = (goalId: string) => {
  return useQuery({
    queryKey: goalsQueryKeys.detail(goalId),
    queryFn: () => goalsService.getGoal(goalId),
    enabled: !!goalId,
    staleTime: 2 * 60 * 1000 // 2 minutes
  });
};

/**
 * Get stats for a specific goal
 */
export const useGoalStats = (goalId: string) => {
  return useQuery({
    queryKey: goalsQueryKeys.stats(goalId),
    queryFn: () => goalsService.getGoalStats(goalId),
    enabled: !!goalId,
    staleTime: 2 * 60 * 1000 // 2 minutes
  });
};

/**
 * Get summary stats for all goals
 */
export const useGoalsSummary = () => {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: goalsQueryKeys.summary(),
    queryFn: () => goalsService.getGoalsSummary(),
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000 // 2 minutes
  });
};

// =============================================================================
// MUTATION HOOKS
// =============================================================================

/**
 * Create a new goal
 */
export const useCreateGoal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (goal: CreateGoalRequest) => goalsService.createGoal(goal),

    // Optimistic update for instant UI feedback
    onMutate: async (newGoal) => {
      // Cancel outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.active() });
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.list() });
      await queryClient.cancelQueries({ queryKey: userQueryKeys.userStats() });

      // Snapshot previous data for rollback
      const previousActiveGoals = queryClient.getQueryData(goalsQueryKeys.active());
      const previousAllGoals = queryClient.getQueryData(goalsQueryKeys.list());
      const previousUserStats = queryClient.getQueryData(userQueryKeys.userStats());

      // Create optimistic goal with temp ID
      const optimisticGoal: Partial<Goal> = {
        id: `temp-${Date.now()}`,
        ...newGoal,
        user_id: "",
        status: "active", // New goals start as active
        current_streak: 0,
        longest_streak: 0,
        total_completions: 0,
        created_at: new Date().toISOString(),
        today_checkin_status: null, // No check-in for new goals
        // For weekly goals, show progress (0/target)
        progress_this_week:
          newGoal.frequency_type === "weekly"
            ? { completed: 0, target: newGoal.frequency_count || 1 }
            : null
      };

      // Optimistically add to active goals list
      queryClient.setQueryData(goalsQueryKeys.active(), (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: [optimisticGoal, ...old.data] };
      });

      // Add to all goals list too
      queryClient.setQueryData(goalsQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: [optimisticGoal, ...old.data] };
      });

      // Optimistically update user stats
      queryClient.setQueryData(userQueryKeys.userStats(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: {
            ...old.data,
            total_goals: (old.data.total_goals || 0) + 1,
            active_goals: (old.data.active_goals || 0) + 1
          }
        };
      });

      return { previousActiveGoals, previousAllGoals, previousUserStats };
    },

    onError: (_err, _newGoal, context) => {
      // Rollback on error
      if (context?.previousActiveGoals) {
        queryClient.setQueryData(goalsQueryKeys.active(), context.previousActiveGoals);
      }
      if (context?.previousAllGoals) {
        queryClient.setQueryData(goalsQueryKeys.list(), context.previousAllGoals);
      }
      if (context?.previousUserStats) {
        queryClient.setQueryData(userQueryKeys.userStats(), context.previousUserStats);
      }
    },

    onSuccess: async (response) => {
      const realGoal = response?.data;
      if (realGoal) {
        // Replace optimistic goal with real one
        queryClient.setQueryData(goalsQueryKeys.active(), (old: any) => {
          if (!old?.data) return old;
          const filtered = old.data.filter((g: Goal) => !g.id.startsWith("temp-"));
          return { ...old, data: [realGoal, ...filtered] };
        });

        queryClient.setQueryData(goalsQueryKeys.list(), (old: any) => {
          if (!old?.data) return old;
          const filtered = old.data.filter((g: Goal) => !g.id.startsWith("temp-"));
          return { ...old, data: [realGoal, ...filtered] };
        });
      }

      // Invalidate for accurate server-side data
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.summary() });
      queryClient.invalidateQueries({ queryKey: userQueryKeys.userStats() });
      queryClient.invalidateQueries({ queryKey: homeDashboardQueryKeys.dashboard() });
    }
  });
};

/**
 * Update a goal
 */
export const useUpdateGoal = () => {
  const queryClient = useQueryClient();
  const { cancelGoalNotifications } = useGoalNotifications();

  return useMutation({
    mutationFn: ({ goalId, updates }: { goalId: string; updates: UpdateGoalRequest }) =>
      goalsService.updateGoal(goalId, updates),

    // Optimistic update
    onMutate: async ({ goalId, updates }) => {
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.active() });
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.list() });
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.archived() });
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.detail(goalId) });

      const previousActiveGoals = queryClient.getQueryData(goalsQueryKeys.active());
      const previousAllGoals = queryClient.getQueryData(goalsQueryKeys.list());
      const previousArchivedGoals = queryClient.getQueryData(goalsQueryKeys.archived());
      const previousDetail = queryClient.getQueryData(goalsQueryKeys.detail(goalId));

      // Get the goal data before updating (for archived list)
      const allGoals = previousAllGoals as any;
      const goal = allGoals?.data?.find((g: Goal) => g.id === goalId);

      // Update in active goals
      queryClient.setQueryData(goalsQueryKeys.active(), (old: any) => {
        if (!old?.data) return old;

        // If status is changing to non-active, remove from active list
        if (updates.status && updates.status !== "active") {
          return { ...old, data: old.data.filter((g: Goal) => g.id !== goalId) };
        }

        // Otherwise update in place
        return {
          ...old,
          data: old.data.map((g: Goal) =>
            g.id === goalId ? { ...g, ...updates, updated_at: new Date().toISOString() } : g
          )
        };
      });

      // Update in all goals list
      queryClient.setQueryData(goalsQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((g: Goal) =>
            g.id === goalId ? { ...g, ...updates, updated_at: new Date().toISOString() } : g
          )
        };
      });

      // Handle archived list based on status change
      if (updates.status === "archived" && goal) {
        const archivedGoal = { ...goal, ...updates, updated_at: new Date().toISOString() };
        queryClient.setQueryData(goalsQueryKeys.archived(), (old: any) => {
          if (!old?.data) return { data: [archivedGoal], status: 200 };
          const exists = old.data.some((g: Goal) => g.id === goalId);
          if (exists) {
            return {
              ...old,
              data: old.data.map((g: Goal) => (g.id === goalId ? archivedGoal : g))
            };
          }
          return { ...old, data: [...old.data, archivedGoal] };
        });
      } else if (updates.status === "active") {
        // Remove from archived if reactivating
        queryClient.setQueryData(goalsQueryKeys.archived(), (old: any) => {
          if (!old?.data) return old;
          return { ...old, data: old.data.filter((g: Goal) => g.id !== goalId) };
        });
      }

      // Update detail cache
      queryClient.setQueryData(goalsQueryKeys.detail(goalId), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: { ...old.data, ...updates, updated_at: new Date().toISOString() }
        };
      });

      return {
        previousActiveGoals,
        previousAllGoals,
        previousArchivedGoals,
        previousDetail,
        goalId
      };
    },

    onError: (_err, { goalId }, context) => {
      if (context?.previousActiveGoals) {
        queryClient.setQueryData(goalsQueryKeys.active(), context.previousActiveGoals);
      }
      if (context?.previousAllGoals) {
        queryClient.setQueryData(goalsQueryKeys.list(), context.previousAllGoals);
      }
      if (context?.previousArchivedGoals) {
        queryClient.setQueryData(goalsQueryKeys.archived(), context.previousArchivedGoals);
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(goalsQueryKeys.detail(goalId), context.previousDetail);
      }
    },

    onSuccess: async (response, { goalId, updates }) => {
      const updatedGoal = response?.data;

      // Cancel notifications if goal is deactivated
      if (updatedGoal && updates.status && updates.status !== "active") {
        await cancelGoalNotifications(goalId);
      }

      // Update detail with server response
      if (updatedGoal) {
        queryClient.setQueryData(goalsQueryKeys.detail(goalId), (old: any) => ({
          ...old,
          data: updatedGoal
        }));
      }

      // Refresh related queries
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.summary() });
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.archived() });
      queryClient.invalidateQueries({ queryKey: homeDashboardQueryKeys.dashboard() });
    }
  });
};

/**
 * Delete a goal permanently
 */
export const useDeleteGoal = () => {
  const queryClient = useQueryClient();
  const { cancelGoalNotifications } = useGoalNotifications();

  return useMutation({
    mutationFn: (goalId: string) => goalsService.deleteGoal(goalId),

    onMutate: async (goalId) => {
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.active() });
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.list() });
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.archived() });
      await queryClient.cancelQueries({ queryKey: userQueryKeys.userStats() });
      await queryClient.cancelQueries({ queryKey: checkInsQueryKeys.today() });
      await queryClient.cancelQueries({ queryKey: homeDashboardQueryKeys.dashboard() });

      const previousActiveGoals = queryClient.getQueryData(goalsQueryKeys.active());
      const previousAllGoals = queryClient.getQueryData(goalsQueryKeys.list());
      const previousArchivedGoals = queryClient.getQueryData(goalsQueryKeys.archived());
      const previousUserStats = queryClient.getQueryData(userQueryKeys.userStats());
      const previousTodayCheckIns = queryClient.getQueryData(checkInsQueryKeys.today());
      const previousDashboard = queryClient.getQueryData(homeDashboardQueryKeys.dashboard());

      // Check if the goal being deleted is active
      const activeGoals = previousActiveGoals as any;
      const isActiveGoal = activeGoals?.data?.some((g: Goal) => g.id === goalId);

      // Optimistically remove from all goal lists
      queryClient.setQueryData(goalsQueryKeys.active(), (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.filter((g: Goal) => g.id !== goalId) };
      });

      queryClient.setQueryData(goalsQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.filter((g: Goal) => g.id !== goalId) };
      });

      queryClient.setQueryData(goalsQueryKeys.archived(), (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.filter((g: Goal) => g.id !== goalId) };
      });

      // Remove check-ins for deleted goal
      queryClient.setQueryData(checkInsQueryKeys.today(), (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.filter((c: any) => c.goal_id !== goalId) };
      });

      // Update user stats
      queryClient.setQueryData(userQueryKeys.userStats(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: {
            ...old.data,
            total_goals: Math.max(0, (old.data.total_goals || 0) - 1),
            ...(isActiveGoal && {
              active_goals: Math.max(0, (old.data.active_goals || 0) - 1)
            })
          }
        };
      });

      // Update home dashboard
      queryClient.setQueryData(homeDashboardQueryKeys.dashboard(), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          today_pending_checkins: (old.today_pending_checkins || []).filter(
            (item: any) => !(item.type === "goal" && item.data?.goal_id === goalId)
          )
        };
      });

      return {
        previousActiveGoals,
        previousAllGoals,
        previousArchivedGoals,
        previousUserStats,
        previousTodayCheckIns,
        previousDashboard,
        goalId
      };
    },

    onError: (_err, goalId, context) => {
      if (context?.previousActiveGoals) {
        queryClient.setQueryData(goalsQueryKeys.active(), context.previousActiveGoals);
      }
      if (context?.previousAllGoals) {
        queryClient.setQueryData(goalsQueryKeys.list(), context.previousAllGoals);
      }
      if (context?.previousArchivedGoals) {
        queryClient.setQueryData(goalsQueryKeys.archived(), context.previousArchivedGoals);
      }
      if (context?.previousUserStats) {
        queryClient.setQueryData(userQueryKeys.userStats(), context.previousUserStats);
      }
      if (context?.previousTodayCheckIns) {
        queryClient.setQueryData(checkInsQueryKeys.today(), context.previousTodayCheckIns);
      }
      if (context?.previousDashboard) {
        queryClient.setQueryData(homeDashboardQueryKeys.dashboard(), context.previousDashboard);
      }
    },

    onSuccess: async (_, goalId) => {
      // Cancel any scheduled notifications
      await cancelGoalNotifications(goalId);

      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.active() });
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.list() });
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.archived() });
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.summary() });
      queryClient.invalidateQueries({ queryKey: userQueryKeys.userStats() });
      queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.stats() });
      queryClient.invalidateQueries({ queryKey: homeDashboardQueryKeys.dashboard() });

      // Remove detail cache
      queryClient.removeQueries({ queryKey: goalsQueryKeys.detail(goalId) });
      queryClient.removeQueries({ queryKey: goalsQueryKeys.stats(goalId) });
    }
  });
};

/**
 * Activate a goal (set status to 'active')
 */
export const useActivateGoal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (goalId: string) => goalsService.activateGoal(goalId),

    onMutate: async (goalId) => {
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.active() });
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.list() });
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.archived() });
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.detail(goalId) });

      const previousActiveGoals = queryClient.getQueryData(goalsQueryKeys.active());
      const previousAllGoals = queryClient.getQueryData(goalsQueryKeys.list());
      const previousArchivedGoals = queryClient.getQueryData(goalsQueryKeys.archived());
      const previousDetail = queryClient.getQueryData(goalsQueryKeys.detail(goalId));
      const previousUserStats = queryClient.getQueryData(userQueryKeys.userStats());

      // Get the goal from list
      const allGoals = previousAllGoals as any;
      const goal = allGoals?.data?.find((g: Goal) => g.id === goalId);

      if (goal) {
        const activatedGoal = { ...goal, status: "active" as const };

        // Add to active goals
        queryClient.setQueryData(goalsQueryKeys.active(), (old: any) => {
          if (!old?.data) return old;
          const exists = old.data.some((g: Goal) => g.id === goalId);
          if (exists) {
            return {
              ...old,
              data: old.data.map((g: Goal) => (g.id === goalId ? activatedGoal : g))
            };
          }
          return { ...old, data: [...old.data, activatedGoal] };
        });

        // Update in all goals
        queryClient.setQueryData(goalsQueryKeys.list(), (old: any) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((g: Goal) => (g.id === goalId ? activatedGoal : g))
          };
        });

        // Remove from archived
        queryClient.setQueryData(goalsQueryKeys.archived(), (old: any) => {
          if (!old?.data) return old;
          return { ...old, data: old.data.filter((g: Goal) => g.id !== goalId) };
        });

        // Update detail
        queryClient.setQueryData(goalsQueryKeys.detail(goalId), (old: any) => {
          if (!old?.data) return old;
          return { ...old, data: activatedGoal };
        });
      }

      // Update user stats
      queryClient.setQueryData(userQueryKeys.userStats(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: {
            ...old.data,
            active_goals: (old.data.active_goals || 0) + 1
          }
        };
      });

      return {
        previousActiveGoals,
        previousAllGoals,
        previousArchivedGoals,
        previousDetail,
        previousUserStats,
        goalId
      };
    },

    onError: (_err, goalId, context) => {
      if (context?.previousActiveGoals) {
        queryClient.setQueryData(goalsQueryKeys.active(), context.previousActiveGoals);
      }
      if (context?.previousAllGoals) {
        queryClient.setQueryData(goalsQueryKeys.list(), context.previousAllGoals);
      }
      if (context?.previousArchivedGoals) {
        queryClient.setQueryData(goalsQueryKeys.archived(), context.previousArchivedGoals);
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(goalsQueryKeys.detail(goalId), context.previousDetail);
      }
      if (context?.previousUserStats) {
        queryClient.setQueryData(userQueryKeys.userStats(), context.previousUserStats);
      }
    },

    onSuccess: async (response, goalId) => {
      const updatedGoal = response?.data?.goal;
      if (updatedGoal) {
        queryClient.setQueryData(goalsQueryKeys.detail(goalId), (old: any) => ({
          ...old,
          data: updatedGoal
        }));
      }

      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.summary() });
      queryClient.invalidateQueries({ queryKey: userQueryKeys.userStats() });
      queryClient.invalidateQueries({ queryKey: homeDashboardQueryKeys.dashboard() });
    }
  });
};

/**
 * Deactivate a goal (set status to 'paused')
 */
export const useDeactivateGoal = () => {
  const queryClient = useQueryClient();
  const { cancelGoalNotifications } = useGoalNotifications();

  return useMutation({
    mutationFn: (goalId: string) => goalsService.deactivateGoal(goalId),

    onMutate: async (goalId) => {
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.active() });
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.list() });
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.detail(goalId) });

      const previousActiveGoals = queryClient.getQueryData(goalsQueryKeys.active());
      const previousAllGoals = queryClient.getQueryData(goalsQueryKeys.list());
      const previousDetail = queryClient.getQueryData(goalsQueryKeys.detail(goalId));
      const previousUserStats = queryClient.getQueryData(userQueryKeys.userStats());
      const previousDashboard = queryClient.getQueryData(homeDashboardQueryKeys.dashboard());

      // Remove from active goals
      queryClient.setQueryData(goalsQueryKeys.active(), (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.filter((g: Goal) => g.id !== goalId) };
      });

      // Update status in all goals
      queryClient.setQueryData(goalsQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((g: Goal) => (g.id === goalId ? { ...g, status: "paused" } : g))
        };
      });

      // Update detail
      queryClient.setQueryData(goalsQueryKeys.detail(goalId), (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: { ...old.data, status: "paused" } };
      });

      // Update user stats
      queryClient.setQueryData(userQueryKeys.userStats(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: {
            ...old.data,
            active_goals: Math.max(0, (old.data.active_goals || 1) - 1)
          }
        };
      });

      // Remove from dashboard pending
      queryClient.setQueryData(homeDashboardQueryKeys.dashboard(), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          today_pending_checkins: (old.today_pending_checkins || []).filter(
            (item: any) => !(item.type === "goal" && item.data?.goal_id === goalId)
          )
        };
      });

      return {
        previousActiveGoals,
        previousAllGoals,
        previousDetail,
        previousUserStats,
        previousDashboard,
        goalId
      };
    },

    onError: (_err, goalId, context) => {
      if (context?.previousActiveGoals) {
        queryClient.setQueryData(goalsQueryKeys.active(), context.previousActiveGoals);
      }
      if (context?.previousAllGoals) {
        queryClient.setQueryData(goalsQueryKeys.list(), context.previousAllGoals);
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(goalsQueryKeys.detail(goalId), context.previousDetail);
      }
      if (context?.previousUserStats) {
        queryClient.setQueryData(userQueryKeys.userStats(), context.previousUserStats);
      }
      if (context?.previousDashboard) {
        queryClient.setQueryData(homeDashboardQueryKeys.dashboard(), context.previousDashboard);
      }
    },

    onSuccess: async (response, goalId) => {
      // Cancel notifications
      await cancelGoalNotifications(goalId);

      const updatedGoal = response?.data?.goal;
      if (updatedGoal) {
        queryClient.setQueryData(goalsQueryKeys.detail(goalId), (old: any) => ({
          ...old,
          data: updatedGoal
        }));
      }

      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.summary() });
      queryClient.invalidateQueries({ queryKey: userQueryKeys.userStats() });
      queryClient.invalidateQueries({ queryKey: homeDashboardQueryKeys.dashboard() });
    }
  });
};

/**
 * Archive a goal (set status to 'archived')
 */
export const useArchiveGoal = () => {
  const queryClient = useQueryClient();
  const { cancelGoalNotifications } = useGoalNotifications();

  return useMutation({
    mutationFn: (goalId: string) => goalsService.archiveGoal(goalId),

    onMutate: async (goalId) => {
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.active() });
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.list() });
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.archived() });
      await queryClient.cancelQueries({ queryKey: goalsQueryKeys.detail(goalId) });

      const previousActiveGoals = queryClient.getQueryData(goalsQueryKeys.active());
      const previousAllGoals = queryClient.getQueryData(goalsQueryKeys.list());
      const previousArchivedGoals = queryClient.getQueryData(goalsQueryKeys.archived());
      const previousDetail = queryClient.getQueryData(goalsQueryKeys.detail(goalId));
      const previousUserStats = queryClient.getQueryData(userQueryKeys.userStats());

      // Get goal data before archiving
      const allGoals = previousAllGoals as any;
      const goal = allGoals?.data?.find((g: Goal) => g.id === goalId);
      const wasActive = goal?.status === "active";

      if (goal) {
        const archivedGoal = { ...goal, status: "archived" as const };

        // Remove from active goals
        queryClient.setQueryData(goalsQueryKeys.active(), (old: any) => {
          if (!old?.data) return old;
          return { ...old, data: old.data.filter((g: Goal) => g.id !== goalId) };
        });

        // Update in all goals
        queryClient.setQueryData(goalsQueryKeys.list(), (old: any) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((g: Goal) => (g.id === goalId ? archivedGoal : g))
          };
        });

        // Add to archived goals
        queryClient.setQueryData(goalsQueryKeys.archived(), (old: any) => {
          if (!old?.data) return { data: [archivedGoal], status: 200 };
          const exists = old.data.some((g: Goal) => g.id === goalId);
          if (exists) {
            return {
              ...old,
              data: old.data.map((g: Goal) => (g.id === goalId ? archivedGoal : g))
            };
          }
          return { ...old, data: [...old.data, archivedGoal] };
        });

        // Update detail
        queryClient.setQueryData(goalsQueryKeys.detail(goalId), (old: any) => {
          if (!old?.data) return old;
          return { ...old, data: archivedGoal };
        });
      }

      // Update user stats if was active
      if (wasActive) {
        queryClient.setQueryData(userQueryKeys.userStats(), (old: any) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: {
              ...old.data,
              active_goals: Math.max(0, (old.data.active_goals || 1) - 1)
            }
          };
        });
      }

      return {
        previousActiveGoals,
        previousAllGoals,
        previousArchivedGoals,
        previousDetail,
        previousUserStats,
        goalId
      };
    },

    onError: (_err, goalId, context) => {
      if (context?.previousActiveGoals) {
        queryClient.setQueryData(goalsQueryKeys.active(), context.previousActiveGoals);
      }
      if (context?.previousAllGoals) {
        queryClient.setQueryData(goalsQueryKeys.list(), context.previousAllGoals);
      }
      if (context?.previousArchivedGoals) {
        queryClient.setQueryData(goalsQueryKeys.archived(), context.previousArchivedGoals);
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(goalsQueryKeys.detail(goalId), context.previousDetail);
      }
      if (context?.previousUserStats) {
        queryClient.setQueryData(userQueryKeys.userStats(), context.previousUserStats);
      }
    },

    onSuccess: async (response, goalId) => {
      // Cancel notifications
      await cancelGoalNotifications(goalId);

      const updatedGoal = response?.data?.goal;
      if (updatedGoal) {
        queryClient.setQueryData(goalsQueryKeys.detail(goalId), (old: any) => ({
          ...old,
          data: updatedGoal
        }));
      }

      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.summary() });
      queryClient.invalidateQueries({ queryKey: userQueryKeys.userStats() });
      queryClient.invalidateQueries({ queryKey: homeDashboardQueryKeys.dashboard() });
    }
  });
};

// =============================================================================
// GOAL INSIGHTS (Premium)
// =============================================================================

/**
 * Get pattern insights for a specific goal
 * Premium feature - returns empty array for free users
 */
export const useGoalInsights = (goalId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: goalsQueryKeys.insights(goalId),
    queryFn: () => goalsService.getGoalInsights(goalId),
    enabled: enabled && !!goalId,
    staleTime: 1000 * 60 * 60, // 1 hour - insights don't change often
    gcTime: 1000 * 60 * 60 * 24 // Keep for 24 hours
    // staleTime: 0, // Always refetch for testing
    // refetchOnMount: "always",
  });
};

/**
 * Force refresh goal insights
 */
export const useRefreshGoalInsights = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (goalId: string) => goalsService.refreshGoalInsights(goalId),

    onSuccess: (_response, goalId) => {
      // Invalidate insights cache to force refetch
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.insights(goalId) });
    }
  });
};
