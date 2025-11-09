import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  goalsService,
  CreateGoalRequest,
  UpdateGoalRequest,
  GoalStats,
  Goal,
} from "@/services/api";
import { useGoalNotifications } from "@/hooks/notifications/useGoalNotifications";
import { useUserTimezone } from "@/hooks/useUserTimezone";
import { useAuthStore } from "@/stores/authStore";

// Query Keys
export const goalsQueryKeys = {
  all: ["goals"] as const,
  list: () => [...goalsQueryKeys.all, "list"] as const,
  detail: (id: string) => [...goalsQueryKeys.all, "detail", id] as const,
  templates: () => [...goalsQueryKeys.all, "templates"] as const,
  stats: (id?: string) => [...goalsQueryKeys.all, "stats", id] as const,
  byCategory: (category: string) =>
    [...goalsQueryKeys.all, "category", category] as const,
  active: () => [...goalsQueryKeys.all, "active"] as const,
  completed: () => [...goalsQueryKeys.all, "completed"] as const,
} as const;

// Goals Hooks
export const useGoals = () => {
  return useQuery({
    queryKey: goalsQueryKeys.list(),
    queryFn: () => goalsService.getGoals(),
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
  const { scheduleGoalNotifications } = useGoalNotifications();
  const userTimezone = useUserTimezone();

  return useMutation({
    mutationFn: (goal: CreateGoalRequest) => goalsService.createGoal(goal),
    onSuccess: async (response) => {
      // Schedule reminders if goal was created as active
      if (
        response?.data &&
        response.data.is_active &&
        response.data.reminder_times &&
        response.data.reminder_times.length > 0
      ) {
        await scheduleGoalNotifications({
          id: response.data.id,
          title: response.data.title,
          reminderTimes: response.data.reminder_times,
          timezone: userTimezone,
        });
      }

      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.active() });
    },
  });
};

export const useUpdateGoal = () => {
  const queryClient = useQueryClient();
  const { scheduleGoalNotifications, cancelGoalNotifications } =
    useGoalNotifications();
  const userTimezone = useUserTimezone();

  return useMutation({
    mutationFn: ({
      goalId,
      updates,
    }: {
      goalId: string;
      updates: UpdateGoalRequest;
    }) => goalsService.updateGoal(goalId, updates),
    onSuccess: async (response, { goalId, updates }) => {
      const updatedGoal = response?.data;

      // Handle reminder scheduling/cancellation based on is_active change
      if (updatedGoal && updates.is_active !== undefined) {
        if (updates.is_active && updatedGoal.is_active) {
          // Goal was activated - schedule reminders
          if (
            updatedGoal.reminder_times &&
            updatedGoal.reminder_times.length > 0
          ) {
            await scheduleGoalNotifications({
              id: updatedGoal.id,
              title: updatedGoal.title,
              reminderTimes: updatedGoal.reminder_times,
              timezone: userTimezone,
            });
          }
        } else if (!updates.is_active && !updatedGoal.is_active) {
          // Goal was deactivated - cancel reminders
          await cancelGoalNotifications(goalId);
        }
      }

      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.all });
      queryClient.invalidateQueries({
        queryKey: goalsQueryKeys.detail(goalId),
      });
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.active() });
    },
  });
};

export const useDeleteGoal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (goalId: string) => goalsService.deleteGoal(goalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.all });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.all });
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
    onSuccess: async (_, goalId) => {
      // Cancel reminders for archived goal
      await cancelGoalNotifications(goalId);

      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.all });
      queryClient.invalidateQueries({
        queryKey: goalsQueryKeys.detail(goalId),
      });
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.active() });
    },
  });
};

export const useUnarchiveGoal = () => {
  const queryClient = useQueryClient();
  const { scheduleGoalNotifications } = useGoalNotifications();
  const userTimezone = useUserTimezone();

  return useMutation({
    mutationFn: (goalId: string) => goalsService.unarchiveGoal(goalId),
    onSuccess: async (response, goalId) => {
      // Schedule reminders for unarchived (activated) goal
      if (
        response?.data &&
        response.data.is_active &&
        response.data.reminder_times &&
        response.data.reminder_times.length > 0
      ) {
        await scheduleGoalNotifications({
          id: response.data.id,
          title: response.data.title,
          reminderTimes: response.data.reminder_times,
          timezone: userTimezone,
        });
      }

      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.all });
      queryClient.invalidateQueries({
        queryKey: goalsQueryKeys.detail(goalId),
      });
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.active() });
    },
  });
};

export const useActivateGoal = () => {
  const queryClient = useQueryClient();
  const { scheduleGoalNotifications } = useGoalNotifications();
  const userTimezone = useUserTimezone();

  return useMutation({
    mutationFn: (goalId: string) => goalsService.activateGoal(goalId),
    onSuccess: async (response, goalId) => {
      // Schedule reminders for activated goal
      if (
        response?.data &&
        response.data.is_active &&
        response.data.reminder_times &&
        response.data.reminder_times.length > 0
      ) {
        await scheduleGoalNotifications({
          id: response.data.id,
          title: response.data.title,
          reminderTimes: response.data.reminder_times,
          timezone: userTimezone,
        });
      }

      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.all });
      queryClient.invalidateQueries({
        queryKey: goalsQueryKeys.detail(goalId),
      });
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.active() });
    },
  });
};

export const useDuplicateGoal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (goalId: string) => goalsService.duplicateGoal(goalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.all });
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
