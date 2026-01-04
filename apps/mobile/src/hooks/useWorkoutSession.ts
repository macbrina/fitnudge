import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  workoutSessionsService,
  StartSessionRequest,
  UpdateSessionRequest,
  CompleteSessionRequest,
  WorkoutHistoryParams,
  CompletedSessionResponse
} from "@/services/api/workoutSessions";
import type {
  WorkoutSession,
  ActiveSessionResponse,
  SaveProgressRequest,
  SubmitFeedbackRequest,
  WorkoutStats
} from "@/types/workout";
import { trackingStatsQueryKeys } from "./api/useTrackingStats";
import { progressQueryKeys } from "./api/useProgressData";
import {
  cancelProgressQueries,
  snapshotProgressData,
  optimisticallyUpdateProgress,
  rollbackProgressData,
  optimisticallyUpdateWorkoutStats,
  ProgressOptimisticContext
} from "./api/progressOptimisticUpdates";

// Query keys factory for workout sessions
export const workoutSessionQueryKeys = {
  all: ["workout-session"] as const,
  active: (entityId?: string, isChallenge?: boolean) =>
    [
      ...workoutSessionQueryKeys.all,
      "active",
      isChallenge ? "challenge" : "goal",
      entityId
    ] as const,
  history: (params?: WorkoutHistoryParams) =>
    [...workoutSessionQueryKeys.all, "history", params] as const,
  stats: () => ["workout-stats"] as const
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
 *
 * @param entityId - Either a goal ID or challenge ID
 * @param isChallenge - Whether this is for a standalone challenge (default: false)
 */
export function useWorkoutSession(entityId?: string, isChallenge: boolean = false) {
  const queryClient = useQueryClient();

  // For backwards compatibility, treat entityId as goalId when isChallenge is false
  const goalId = !isChallenge ? entityId : undefined;
  const challengeId = isChallenge ? entityId : undefined;

  // Get active session for goal/challenge (to check if can resume)
  const activeSessionQuery = useQuery<ActiveSessionResponse>({
    queryKey: workoutSessionQueryKeys.active(entityId, isChallenge),
    queryFn: async () => {
      if (!entityId) return { session: null, can_resume: false };
      // Use entity-based lookup that supports both goals and challenges
      const response = await workoutSessionsService.getActiveSessionByEntity(
        entityId,
        isChallenge ? "challenge" : "goal"
      );
      return response.data || { session: null, can_resume: false };
    },
    enabled: !!entityId,
    staleTime: 30000 // 30 seconds
  });

  // Start a new workout session (or return existing one)
  const startSessionMutation = useMutation({
    mutationFn: async (data: StartSessionRequest) => {
      // Determine entity ID from either goal_id or challenge_id
      const sessionEntityId = data.goal_id || data.challenge_id;
      const sessionIsChallenge = !!data.challenge_id;

      // Check if there's already an active session for this entity
      const existingSession = queryClient.getQueryData<ActiveSessionResponse>(
        workoutSessionQueryKeys.active(sessionEntityId, sessionIsChallenge)
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
      if (entityId) {
        queryClient.setQueryData<ActiveSessionResponse>(
          workoutSessionQueryKeys.active(entityId, isChallenge),
          {
            session,
            can_resume: true,
            completion_percentage: session.completion_percentage || 0,
            current_phase: session.current_phase || "warmup",
            current_exercise_index: session.current_exercise_index || 0
          }
        );
      }
    }
  });

  // Update session progress
  const updateSessionMutation = useMutation({
    mutationFn: async ({ sessionId, data }: { sessionId: string; data: UpdateSessionRequest }) => {
      const response = await workoutSessionsService.updateSession(sessionId, data);
      return response.data!;
    }
  });

  // Save progress for resume later with optimistic update
  const saveProgressMutation = useMutation({
    mutationFn: async ({ sessionId, data }: { sessionId: string; data: SaveProgressRequest }) => {
      const response = await workoutSessionsService.saveProgress(sessionId, data);
      return response.data!;
    },

    // Optimistic update
    onMutate: async ({ data }) => {
      await queryClient.cancelQueries({
        queryKey: workoutSessionQueryKeys.active(entityId, isChallenge)
      });

      const previousActiveSession = queryClient.getQueryData<ActiveSessionResponse>(
        workoutSessionQueryKeys.active(entityId, isChallenge)
      );

      if (previousActiveSession?.session) {
        queryClient.setQueryData<ActiveSessionResponse>(
          workoutSessionQueryKeys.active(entityId, isChallenge),
          {
            ...previousActiveSession,
            can_resume: true,
            completion_percentage: data.completion_percentage,
            current_phase: data.current_phase,
            current_exercise_index: data.current_exercise_index,
            session: {
              ...previousActiveSession.session,
              ...data,
              paused_at: new Date().toISOString()
            }
          }
        );
      }

      return { previousActiveSession };
    },

    onError: (err, variables, context) => {
      if (context?.previousActiveSession) {
        queryClient.setQueryData(
          workoutSessionQueryKeys.active(entityId, isChallenge),
          context.previousActiveSession
        );
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: workoutSessionQueryKeys.active(entityId, isChallenge)
      });
    }
  });

  // Complete workout session
  const completeSessionMutation = useMutation<
    CompletedSessionResponse,
    Error,
    { sessionId: string; data: CompleteSessionRequest },
    {
      previousActiveSession: ActiveSessionResponse | undefined;
      previousProgressData: ProgressOptimisticContext | undefined;
      workoutData: CompleteSessionRequest;
    }
  >({
    mutationFn: async ({ sessionId, data }) => {
      const response = await workoutSessionsService.completeSession(sessionId, data);
      return response.data!;
    },

    // Optimistic update - clear the active session since it's completed
    onMutate: async ({ data }) => {
      // Use LOCAL date to match progressOptimisticUpdates which uses formatLocalDate
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const entityType = isChallenge ? "challenge" : "goal";

      await queryClient.cancelQueries({
        queryKey: workoutSessionQueryKeys.active(entityId, isChallenge)
      });

      const previousActiveSession = queryClient.getQueryData<ActiveSessionResponse>(
        workoutSessionQueryKeys.active(entityId, isChallenge)
      );

      // Cancel and snapshot progress queries (for both goals and challenges)
      let previousProgressData: ProgressOptimisticContext | undefined;
      if (entityId) {
        await cancelProgressQueries(queryClient, entityId, entityType);
        previousProgressData = snapshotProgressData(queryClient, entityId, today, entityType);
      }

      // Clear the active session (workout is done)
      queryClient.setQueryData<ActiveSessionResponse>(
        workoutSessionQueryKeys.active(entityId, isChallenge),
        {
          session: null,
          can_resume: false,
          completion_percentage: 0
        }
      );

      // Optimistically update progress data (streak, week, chain) for goals
      if (entityId && !isChallenge) {
        optimisticallyUpdateProgress(queryClient, entityId, today);
      }

      // Optimistically update workout tracking stats for instant UI feedback
      if (entityId) {
        // Estimate duration from the session (paused_duration is subtracted on backend)
        // For now, we use a reasonable estimate - the real data will come from server response
        const estimatedDurationSeconds =
          (previousActiveSession?.session?.started_at
            ? Math.floor(
                (Date.now() - new Date(previousActiveSession.session.started_at).getTime()) / 1000
              )
            : 0) - (data.paused_duration_seconds || 0);

        optimisticallyUpdateWorkoutStats(queryClient, entityId, entityType, {
          durationSeconds: Math.max(0, estimatedDurationSeconds),
          exercisesCompleted: data.exercises_completed,
          // Calories will be calculated by backend, estimate ~6.5 cal/min
          caloriesBurned: Math.round((estimatedDurationSeconds / 60) * 6.5)
        });
      }

      return { previousActiveSession, previousProgressData, workoutData: data };
    },

    onError: (_err, _variables, context) => {
      if (context?.previousActiveSession) {
        queryClient.setQueryData(
          workoutSessionQueryKeys.active(entityId, isChallenge),
          context.previousActiveSession
        );
      }
      // Rollback progress data
      if (context?.previousProgressData) {
        rollbackProgressData(queryClient, context.previousProgressData);
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workoutSessionQueryKeys.all
      });
      queryClient.invalidateQueries({
        queryKey: workoutSessionQueryKeys.stats()
      });
      // Invalidate tracking stats for workout progress display
      if (entityId) {
        queryClient.invalidateQueries({
          queryKey: trackingStatsQueryKeys.entity(isChallenge ? "challenge" : "goal", entityId)
        });
        // Invalidate progress data (streak, habit chain, week progress) for instant UI update
        queryClient.invalidateQueries({
          queryKey: progressQueryKeys.streak(entityId)
        });
        queryClient.invalidateQueries({
          queryKey: progressQueryKeys.weekProgress(entityId)
        });
        queryClient.invalidateQueries({
          queryKey: [...progressQueryKeys.all, "chain", entityId]
        });
      }
    }
  });

  // Submit workout feedback with optimistic update
  const submitFeedbackMutation = useMutation({
    mutationFn: async (data: SubmitFeedbackRequest) => {
      const response = await workoutSessionsService.submitFeedback(data);
      return response.data!;
    },

    // Optimistic update - immediately update the active session cache
    onMutate: async (data) => {
      // Determine entity info from the feedback data
      const feedbackEntityId = data.goal_id || data.challenge_id;
      const feedbackIsChallenge = !!data.challenge_id;

      // Cancel any outgoing queries
      await queryClient.cancelQueries({
        queryKey: workoutSessionQueryKeys.active(feedbackEntityId, feedbackIsChallenge)
      });

      // Snapshot previous value for rollback
      const previousActiveSession = queryClient.getQueryData<ActiveSessionResponse>(
        workoutSessionQueryKeys.active(feedbackEntityId, feedbackIsChallenge)
      );

      // Optimistically update the active session with new progress
      if (previousActiveSession?.session) {
        queryClient.setQueryData<ActiveSessionResponse>(
          workoutSessionQueryKeys.active(feedbackEntityId, feedbackIsChallenge),
          {
            ...previousActiveSession,
            can_resume: true,
            completion_percentage: data.completion_percentage,
            session: {
              ...previousActiveSession.session,
              completion_percentage: data.completion_percentage,
              exercises_completed: data.exercises_completed,
              paused_at: new Date().toISOString()
            }
          }
        );
      }

      return {
        previousActiveSession,
        entityId: feedbackEntityId,
        isChallenge: feedbackIsChallenge
      };
    },

    // Rollback on error
    onError: (err, data, context) => {
      if (context?.previousActiveSession) {
        queryClient.setQueryData(
          workoutSessionQueryKeys.active(context.entityId, context.isChallenge),
          context.previousActiveSession
        );
      }
    },

    // Refetch to ensure server state is synced
    onSettled: (data, error, variables) => {
      const feedbackEntityId = variables.goal_id || variables.challenge_id;
      const feedbackIsChallenge = !!variables.challenge_id;
      queryClient.invalidateQueries({
        queryKey: workoutSessionQueryKeys.active(feedbackEntityId, feedbackIsChallenge)
      });
    }
  });

  // Get workout history
  const useWorkoutHistory = (options?: WorkoutHistoryParams) => {
    return useQuery<{ sessions: WorkoutSession[]; total: number }>({
      queryKey: workoutSessionQueryKeys.history(options),
      queryFn: async () => {
        const response = await workoutSessionsService.getHistory(options);
        return response.data || { sessions: [], total: 0 };
      },
      staleTime: 60000 // 1 minute
    });
  };

  // Get workout stats
  const workoutStatsQuery = useQuery<WorkoutStats>({
    queryKey: workoutSessionQueryKeys.stats(),
    queryFn: async () => {
      const response = await workoutSessionsService.getStats();
      return response.data!;
    },
    staleTime: 60000 // 1 minute
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
        queryKey: workoutSessionQueryKeys.active(entityId, isChallenge)
      })
  };
}
