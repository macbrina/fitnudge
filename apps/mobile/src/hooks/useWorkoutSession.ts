import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  workoutSessionsService,
  StartSessionRequest,
  UpdateSessionRequest,
  CompleteSessionRequest,
  WorkoutHistoryParams,
} from "@/services/api/workoutSessions";
import type {
  WorkoutSession,
  ActiveSessionResponse,
  SaveProgressRequest,
  SubmitFeedbackRequest,
  WorkoutStats,
} from "@/types/workout";

// Query keys factory for workout sessions
export const workoutSessionQueryKeys = {
  all: ["workout-session"] as const,
  active: (goalId?: string) =>
    [...workoutSessionQueryKeys.all, "active", goalId] as const,
  history: (params?: WorkoutHistoryParams) =>
    [...workoutSessionQueryKeys.all, "history", params] as const,
  stats: () => ["workout-stats"] as const,
};

/**
 * Hook for managing workout session API calls
 *
 * Handles:
 * - Starting a new session (or returning existing one)
 * - Updating progress during workout
 * - Saving progress for later resume
 * - Completing sessions
 * - Submitting quit feedback with optimistic updates
 * - Fetching workout history and stats
 */
export function useWorkoutSession(goalId?: string) {
  const queryClient = useQueryClient();

  // Get active session for goal (to check if can resume)
  const activeSessionQuery = useQuery<ActiveSessionResponse>({
    queryKey: workoutSessionQueryKeys.active(goalId),
    queryFn: async () => {
      if (!goalId) return { session: null, can_resume: false };
      const response = await workoutSessionsService.getActiveSession(goalId);
      return response.data || { session: null, can_resume: false };
    },
    enabled: !!goalId,
    staleTime: 30000, // 30 seconds
  });

  // Start a new workout session (or return existing one)
  const startSessionMutation = useMutation({
    mutationFn: async (data: StartSessionRequest) => {
      // Check if there's already an active session for this goal
      const existingSession = queryClient.getQueryData<ActiveSessionResponse>(
        workoutSessionQueryKeys.active(data.goal_id)
      );

      // If there's an existing in-progress session, return it instead of creating new one
      if (existingSession?.session && existingSession?.can_resume) {
        return existingSession.session;
      }

      // Otherwise create a new session
      const response = await workoutSessionsService.startSession(data);
      return response.data!;
    },
    onSuccess: (session) => {
      // Update the active session cache with the new/existing session
      if (goalId) {
        queryClient.setQueryData<ActiveSessionResponse>(
          workoutSessionQueryKeys.active(goalId),
          {
            session,
            can_resume: true,
            completion_percentage: session.completion_percentage || 0,
            current_phase: session.current_phase || "warmup",
            current_exercise_index: session.current_exercise_index || 0,
          }
        );
      }
    },
  });

  // Update session progress
  const updateSessionMutation = useMutation({
    mutationFn: async ({
      sessionId,
      data,
    }: {
      sessionId: string;
      data: UpdateSessionRequest;
    }) => {
      const response = await workoutSessionsService.updateSession(
        sessionId,
        data
      );
      return response.data!;
    },
  });

  // Save progress for resume later with optimistic update
  const saveProgressMutation = useMutation({
    mutationFn: async ({
      sessionId,
      data,
    }: {
      sessionId: string;
      data: SaveProgressRequest;
    }) => {
      const response = await workoutSessionsService.saveProgress(
        sessionId,
        data
      );
      return response.data!;
    },

    // Optimistic update
    onMutate: async ({ data }) => {
      await queryClient.cancelQueries({
        queryKey: workoutSessionQueryKeys.active(goalId),
      });

      const previousActiveSession =
        queryClient.getQueryData<ActiveSessionResponse>(
          workoutSessionQueryKeys.active(goalId)
        );

      if (previousActiveSession?.session) {
        queryClient.setQueryData<ActiveSessionResponse>(
          workoutSessionQueryKeys.active(goalId),
          {
            ...previousActiveSession,
            can_resume: true,
            completion_percentage: data.completion_percentage,
            current_phase: data.current_phase,
            current_exercise_index: data.current_exercise_index,
            session: {
              ...previousActiveSession.session,
              ...data,
              paused_at: new Date().toISOString(),
            },
          }
        );
      }

      return { previousActiveSession };
    },

    onError: (err, variables, context) => {
      if (context?.previousActiveSession) {
        queryClient.setQueryData(
          workoutSessionQueryKeys.active(goalId),
          context.previousActiveSession
        );
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: workoutSessionQueryKeys.active(goalId),
      });
    },
  });

  // Complete workout session
  const completeSessionMutation = useMutation({
    mutationFn: async ({
      sessionId,
      data,
    }: {
      sessionId: string;
      data: CompleteSessionRequest;
    }) => {
      const response = await workoutSessionsService.completeSession(
        sessionId,
        data
      );
      return response.data!;
    },

    // Optimistic update - clear the active session since it's completed
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: workoutSessionQueryKeys.active(goalId),
      });

      const previousActiveSession =
        queryClient.getQueryData<ActiveSessionResponse>(
          workoutSessionQueryKeys.active(goalId)
        );

      // Clear the active session (workout is done)
      queryClient.setQueryData<ActiveSessionResponse>(
        workoutSessionQueryKeys.active(goalId),
        {
          session: null,
          can_resume: false,
          completion_percentage: 0,
        }
      );

      return { previousActiveSession };
    },

    onError: (err, variables, context) => {
      if (context?.previousActiveSession) {
        queryClient.setQueryData(
          workoutSessionQueryKeys.active(goalId),
          context.previousActiveSession
        );
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workoutSessionQueryKeys.all,
      });
      queryClient.invalidateQueries({
        queryKey: workoutSessionQueryKeys.stats(),
      });
    },
  });

  // Submit workout feedback with optimistic update
  const submitFeedbackMutation = useMutation({
    mutationFn: async (data: SubmitFeedbackRequest) => {
      const response = await workoutSessionsService.submitFeedback(data);
      return response.data!;
    },

    // Optimistic update - immediately update the active session cache
    onMutate: async (data) => {
      // Cancel any outgoing queries
      await queryClient.cancelQueries({
        queryKey: workoutSessionQueryKeys.active(data.goal_id),
      });

      // Snapshot previous value for rollback
      const previousActiveSession =
        queryClient.getQueryData<ActiveSessionResponse>(
          workoutSessionQueryKeys.active(data.goal_id)
        );

      // Optimistically update the active session with new progress
      if (previousActiveSession?.session) {
        queryClient.setQueryData<ActiveSessionResponse>(
          workoutSessionQueryKeys.active(data.goal_id),
          {
            ...previousActiveSession,
            can_resume: true,
            completion_percentage: data.completion_percentage,
            session: {
              ...previousActiveSession.session,
              completion_percentage: data.completion_percentage,
              exercises_completed: data.exercises_completed,
              paused_at: new Date().toISOString(),
            },
          }
        );
      }

      return { previousActiveSession, goalId: data.goal_id };
    },

    // Rollback on error
    onError: (err, data, context) => {
      if (context?.previousActiveSession) {
        queryClient.setQueryData(
          workoutSessionQueryKeys.active(context.goalId),
          context.previousActiveSession
        );
      }
    },

    // Refetch to ensure server state is synced
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({
        queryKey: workoutSessionQueryKeys.active(variables.goal_id),
      });
    },
  });

  // Get workout history
  const useWorkoutHistory = (options?: WorkoutHistoryParams) => {
    return useQuery<{ sessions: WorkoutSession[]; total: number }>({
      queryKey: workoutSessionQueryKeys.history(options),
      queryFn: async () => {
        const response = await workoutSessionsService.getHistory(options);
        return response.data || { sessions: [], total: 0 };
      },
      staleTime: 60000, // 1 minute
    });
  };

  // Get workout stats
  const workoutStatsQuery = useQuery<WorkoutStats>({
    queryKey: workoutSessionQueryKeys.stats(),
    queryFn: async () => {
      const response = await workoutSessionsService.getStats();
      return response.data!;
    },
    staleTime: 60000, // 1 minute
  });

  return {
    // Queries
    activeSession: activeSessionQuery.data,
    isLoadingActiveSession: activeSessionQuery.isLoading,
    canResume: activeSessionQuery.data?.can_resume ?? false,
    resumePercentage: activeSessionQuery.data?.completion_percentage ?? 0,
    workoutStats: workoutStatsQuery.data,
    isLoadingStats: workoutStatsQuery.isLoading,

    // Mutations
    startSession: startSessionMutation.mutateAsync,
    isStartingSession: startSessionMutation.isPending,

    updateSession: updateSessionMutation.mutateAsync,
    isUpdatingSession: updateSessionMutation.isPending,

    saveProgress: saveProgressMutation.mutateAsync,
    isSavingProgress: saveProgressMutation.isPending,

    completeSession: completeSessionMutation.mutateAsync,
    isCompletingSession: completeSessionMutation.isPending,

    submitFeedback: submitFeedbackMutation.mutateAsync,
    isSubmittingFeedback: submitFeedbackMutation.isPending,

    // Utility function
    useWorkoutHistory,

    // Refresh functions
    refreshActiveSession: () =>
      queryClient.invalidateQueries({
        queryKey: workoutSessionQueryKeys.active(goalId),
      }),
  };
}
