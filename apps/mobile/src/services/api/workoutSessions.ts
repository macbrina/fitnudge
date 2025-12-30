import { BaseApiService, ApiResponse } from "./base";
import type {
  WorkoutSession,
  ActiveSessionResponse,
  SaveProgressRequest,
  SubmitFeedbackRequest,
  WorkoutStats,
  WorkoutPhase,
} from "@/types/workout";

// API route helpers
const ROUTES = {
  START: "/workout-sessions/start",
  UPDATE: (id: string) => `/workout-sessions/${id}`,
  COMPLETE: (id: string) => `/workout-sessions/${id}/complete`,
  SAVE_PROGRESS: (id: string) => `/workout-sessions/${id}/save-progress`,
  // Legacy goal-based routes (for backward compatibility)
  ACTIVE: (goalId: string) => `/workout-sessions/active/${goalId}`,
  CAN_START: (goalId: string) => `/workout-sessions/can-start/${goalId}`,
  // New entity-based routes (supports both goals and challenges)
  ACTIVE_ENTITY: (entityId: string, entityType: "goal" | "challenge") =>
    `/workout-sessions/active/${entityId}?entity_type=${entityType}`,
  CAN_START_ENTITY: (entityId: string, entityType: "goal" | "challenge") =>
    `/workout-sessions/can-start/${entityId}?entity_type=${entityType}`,
  HISTORY: "/workout-sessions/history",
  STATS: "/workout-sessions/stats",
  FEEDBACK: "/workout-sessions/feedback",
  REFLECTION: "/workout-sessions/reflection",
};

// Request types
export interface StartSessionRequest {
  goal_id?: string; // For goal-based workouts
  challenge_id?: string; // For standalone challenge workouts
  plan_id?: string;
  exercises_total: number;
  sets_total: number;
}

export interface UpdateSessionRequest {
  exercises_completed?: number;
  sets_completed?: number;
  exercises_skipped?: number;
  paused_duration_seconds?: number;
  current_phase?: WorkoutPhase;
  current_exercise_index?: number;
  current_set?: number;
  current_round?: number;
  completion_percentage?: number;
  workout_data?: Record<string, any>;
}

export interface CompleteSessionRequest {
  exercises_completed: number;
  exercises_skipped: number;
  sets_completed: number;
  paused_duration_seconds: number;
  workout_data?: Record<string, any>;
}

export interface WorkoutHistoryParams {
  limit?: number;
  offset?: number;
  status?: string;
  goal_id?: string;
}

export interface WorkoutHistoryResponse {
  sessions: WorkoutSession[];
  total: number;
}

export interface FeedbackResponse {
  success: boolean;
  feedback_id: string;
  message: string;
}

// New types for practice mode and completion flow
export interface CanStartSessionResponse {
  can_start: boolean;
  is_practice: boolean;
  reason: string;
  sessions_today: number;
  allowed_sessions: number;
  is_scheduled_day: boolean;
}

export interface Achievement {
  id: string;
  badge_key: string;
  badge_name: string;
  badge_description: string;
  points: number;
  rarity: string;
  unlocked_at?: string;
}

export interface StreakInfo {
  current_streak: number;
  longest_streak: number;
  milestone_target: number;
  days_until_milestone: number;
  workout_dates_this_week: string[];
}

export interface CompletedSessionResponse {
  session: WorkoutSession;
  achievements_unlocked: Achievement[];
  streak: StreakInfo;
  workout_number_today: number;
  is_practice: boolean;
  can_add_reflection: boolean; // Whether user can add mood/notes/photo
}

export interface UpdateFeedbackRequest {
  feedback_rating: "hard" | "just_right" | "easy";
}

export interface SaveReflectionRequest {
  goal_id?: string;
  challenge_id?: string;
  mood?: string;
  notes?: string;
  photo_url?: string;
}

export interface SaveReflectionResponse {
  success: boolean;
  message: string;
  check_in_id?: string;
}

/**
 * Workout Sessions API Service
 */
export class WorkoutSessionsService extends BaseApiService {
  /**
   * Start a new workout session
   */
  async startSession(
    data: StartSessionRequest,
  ): Promise<ApiResponse<WorkoutSession>> {
    return this.post<WorkoutSession>(ROUTES.START, data);
  }

  /**
   * Update session progress
   */
  async updateSession(
    sessionId: string,
    data: UpdateSessionRequest,
  ): Promise<ApiResponse<WorkoutSession>> {
    return this.patch<WorkoutSession>(ROUTES.UPDATE(sessionId), data);
  }

  /**
   * Save progress for resume later
   */
  async saveProgress(
    sessionId: string,
    data: SaveProgressRequest,
  ): Promise<ApiResponse<WorkoutSession>> {
    return this.post<WorkoutSession>(ROUTES.SAVE_PROGRESS(sessionId), data);
  }

  /**
   * Complete a workout session (returns enriched data)
   */
  async completeSession(
    sessionId: string,
    data: CompleteSessionRequest,
  ): Promise<ApiResponse<CompletedSessionResponse>> {
    return this.post<CompletedSessionResponse>(
      ROUTES.COMPLETE(sessionId),
      data,
    );
  }

  /**
   * Check if user can start a session (or if it would be practice)
   */
  async canStartSession(
    goalId: string,
  ): Promise<ApiResponse<CanStartSessionResponse>> {
    return this.get<CanStartSessionResponse>(ROUTES.CAN_START(goalId));
  }

  /**
   * Update session feedback rating
   */
  async updateFeedback(
    sessionId: string,
    feedback: "hard" | "just_right" | "easy",
  ): Promise<ApiResponse<WorkoutSession>> {
    return this.patch<WorkoutSession>(ROUTES.UPDATE(sessionId), {
      feedback_rating: feedback,
    });
  }

  /**
   * Get active session for a goal (legacy - for backward compatibility)
   */
  async getActiveSession(
    goalId: string,
  ): Promise<ApiResponse<ActiveSessionResponse>> {
    return this.get<ActiveSessionResponse>(ROUTES.ACTIVE(goalId));
  }

  /**
   * Get active session for a goal or challenge
   * @param entityId - Goal ID or Challenge ID
   * @param entityType - "goal" or "challenge"
   */
  async getActiveSessionByEntity(
    entityId: string,
    entityType: "goal" | "challenge",
  ): Promise<ApiResponse<ActiveSessionResponse>> {
    return this.get<ActiveSessionResponse>(
      ROUTES.ACTIVE_ENTITY(entityId, entityType),
    );
  }

  /**
   * Check if user can start a session for a challenge
   * @param entityId - Goal ID or Challenge ID
   * @param entityType - "goal" or "challenge"
   */
  async canStartSessionByEntity(
    entityId: string,
    entityType: "goal" | "challenge",
  ): Promise<ApiResponse<CanStartSessionResponse>> {
    return this.get<CanStartSessionResponse>(
      ROUTES.CAN_START_ENTITY(entityId, entityType),
    );
  }

  /**
   * Get workout history
   */
  async getHistory(
    params?: WorkoutHistoryParams,
  ): Promise<ApiResponse<WorkoutHistoryResponse>> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append("limit", String(params.limit));
    if (params?.offset) queryParams.append("offset", String(params.offset));
    if (params?.status) queryParams.append("status", params.status);
    if (params?.goal_id) queryParams.append("goal_id", params.goal_id);

    const query = queryParams.toString();
    return this.get<WorkoutHistoryResponse>(
      query ? `${ROUTES.HISTORY}?${query}` : ROUTES.HISTORY,
    );
  }

  /**
   * Get workout stats
   */
  async getStats(): Promise<ApiResponse<WorkoutStats>> {
    return this.get<WorkoutStats>(ROUTES.STATS);
  }

  /**
   * Submit workout feedback
   */
  async submitFeedback(
    data: SubmitFeedbackRequest,
  ): Promise<ApiResponse<FeedbackResponse>> {
    return this.post<FeedbackResponse>(ROUTES.FEEDBACK, data);
  }

  /**
   * Save workout reflection (mood, notes, photo) after completion
   * This updates the check-in that was auto-created when workout finished
   */
  async saveReflection(
    data: SaveReflectionRequest,
  ): Promise<ApiResponse<SaveReflectionResponse>> {
    return this.post<SaveReflectionResponse>(ROUTES.REFLECTION, data);
  }
}

// Export singleton instance
export const workoutSessionsService = new WorkoutSessionsService();
