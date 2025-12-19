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
  ACTIVE: (goalId: string) => `/workout-sessions/active/${goalId}`,
  HISTORY: "/workout-sessions/history",
  STATS: "/workout-sessions/stats",
  FEEDBACK: "/workout-sessions/feedback",
};

// Request types
export interface StartSessionRequest {
  goal_id: string;
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

/**
 * Workout Sessions API Service
 */
export class WorkoutSessionsService extends BaseApiService {
  /**
   * Start a new workout session
   */
  async startSession(
    data: StartSessionRequest
  ): Promise<ApiResponse<WorkoutSession>> {
    return this.post<WorkoutSession>(ROUTES.START, data);
  }

  /**
   * Update session progress
   */
  async updateSession(
    sessionId: string,
    data: UpdateSessionRequest
  ): Promise<ApiResponse<WorkoutSession>> {
    return this.patch<WorkoutSession>(ROUTES.UPDATE(sessionId), data);
  }

  /**
   * Save progress for resume later
   */
  async saveProgress(
    sessionId: string,
    data: SaveProgressRequest
  ): Promise<ApiResponse<WorkoutSession>> {
    return this.post<WorkoutSession>(ROUTES.SAVE_PROGRESS(sessionId), data);
  }

  /**
   * Complete a workout session
   */
  async completeSession(
    sessionId: string,
    data: CompleteSessionRequest
  ): Promise<ApiResponse<WorkoutSession>> {
    return this.post<WorkoutSession>(ROUTES.COMPLETE(sessionId), data);
  }

  /**
   * Get active session for a goal
   */
  async getActiveSession(
    goalId: string
  ): Promise<ApiResponse<ActiveSessionResponse>> {
    return this.get<ActiveSessionResponse>(ROUTES.ACTIVE(goalId));
  }

  /**
   * Get workout history
   */
  async getHistory(
    params?: WorkoutHistoryParams
  ): Promise<ApiResponse<WorkoutHistoryResponse>> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append("limit", String(params.limit));
    if (params?.offset) queryParams.append("offset", String(params.offset));
    if (params?.status) queryParams.append("status", params.status);
    if (params?.goal_id) queryParams.append("goal_id", params.goal_id);

    const query = queryParams.toString();
    return this.get<WorkoutHistoryResponse>(
      query ? `${ROUTES.HISTORY}?${query}` : ROUTES.HISTORY
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
    data: SubmitFeedbackRequest
  ): Promise<ApiResponse<FeedbackResponse>> {
    return this.post<FeedbackResponse>(ROUTES.FEEDBACK, data);
  }
}

// Export singleton instance
export const workoutSessionsService = new WorkoutSessionsService();
