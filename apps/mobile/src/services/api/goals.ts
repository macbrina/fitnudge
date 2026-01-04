import { BaseApiService, ApiResponse } from "./base";
import { ROUTES } from "@/lib/routes";

// Goal status type
export type GoalStatus = "active" | "paused" | "completed" | "archived";
export type CompletionReason = "duration" | "target" | "manual";

// Goal type - goals are now habits only (challenges handle time/target based goals)
export type GoalType = "habit";

// Tracking type - determines how user completes their check-in
export type TrackingType = "workout" | "meal" | "hydration" | "checkin";

// Goals Types - Goals are habits only (ongoing activities without fixed end dates)
export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  category: "fitness" | "nutrition" | "wellness" | "mindfulness" | "sleep";
  frequency: "daily" | "weekly";
  target_days: number;
  days_of_week?: number[]; // Array of day numbers (0-6): 0=Sunday, 1=Monday, ..., 6=Saturday
  reminder_times: string[];
  status: GoalStatus;
  tracking_type: TrackingType; // How user completes check-in
  created_at: string;
  updated_at: string;
  // Completion fields
  completed_at?: string;
  completion_reason?: CompletionReason;
  archived_reason?: string;
}

export interface CreateGoalRequest {
  title: string;
  description?: string;
  category: Goal["category"];
  frequency: Goal["frequency"];
  target_days: number;
  days_of_week?: number[];
  reminder_times: string[];
  tracking_type?: TrackingType; // Defaults to 'checkin' or 'workout' for fitness
  status?: GoalStatus;
}

export interface UpdateGoalRequest {
  title?: string;
  description?: string;
  category?: Goal["category"];
  frequency?: Goal["frequency"];
  target_days?: number;
  days_of_week?: number[];
  reminder_times?: string[];
  status?: GoalStatus;
}

/**
 * Restricted edit request for user-facing goal edits.
 * Only allows fields that don't affect the AI-generated plan.
 */
export interface EditGoalRequest {
  title?: string;
  description?: string;
  days_of_week?: number[]; // ADD only - cannot remove existing days
  reminder_times?: string[];
}

// Goal Type Suggestion Types
export interface GoalTypeSuggestionRequest {
  goal_type: GoalType | "mixed";
  duration_days?: 30 | 60 | 90; // For time_challenge
  target_range?: "small" | "medium" | "ambitious"; // For target_challenge
}

export interface GoalTypeSuggestion {
  id: string;
  title: string;
  description: string;
  category: Goal["category"];
  frequency: Goal["frequency"];
  target_days?: number;
  days_of_week?: number[];
  reminder_times?: string[];
  goal_type: GoalType;
  duration_days?: number; // For time_challenge
  target_checkins?: number; // For target_challenge
  match_reason?: string;
}

export interface GoalTypeSuggestionResponse {
  goal_type: GoalType | "mixed";
  suggestions: GoalTypeSuggestion[];
}

export interface GoalTemplate {
  id: string;
  name: string;
  description: string;
  category: Goal["category"];
  frequency: Goal["frequency"];
  target_days: number;
  reminder_times: string[];
  created_at: string;
}

export interface GoalStats {
  total_goals: number;
  active_goals: number;
  completed_goals: number;
  current_streak: number;
  longest_streak: number;
  total_check_ins: number;
  completion_rate: number;
}

// Goals Service
export class GoalsService extends BaseApiService {
  async getGoals(): Promise<ApiResponse<Goal[]>> {
    // Pass active_only=false to get all goals (active, archived, paused, completed)
    return this.get<Goal[]>(`${ROUTES.GOALS.LIST}?active_only=false`);
  }

  async getGoal(goalId: string): Promise<ApiResponse<Goal>> {
    return this.get<Goal>(ROUTES.GOALS.GET(goalId));
  }

  async createGoal(goal: CreateGoalRequest): Promise<ApiResponse<Goal>> {
    return this.post<Goal>(ROUTES.GOALS.CREATE, goal);
  }

  async updateGoal(goalId: string, updates: UpdateGoalRequest): Promise<ApiResponse<Goal>> {
    return this.put<Goal>(ROUTES.GOALS.UPDATE(goalId), updates);
  }

  /**
   * Edit goal with restricted fields (user-facing).
   * Only allows changes that don't affect the AI-generated plan:
   * - title, description: Safe (plan was based on original, user is warned)
   * - days_of_week: ADD only, cannot remove existing days
   * - reminder_times: Just notification preferences
   */
  async editGoal(goalId: string, edits: EditGoalRequest): Promise<ApiResponse<Goal>> {
    return this.patch<Goal>(`${ROUTES.GOALS.GET(goalId)}/edit`, edits);
  }

  async deleteGoal(goalId: string): Promise<ApiResponse> {
    return this.delete(ROUTES.GOALS.DELETE(goalId));
  }

  async getGoalTemplates(): Promise<ApiResponse<GoalTemplate[]>> {
    return this.get<GoalTemplate[]>(ROUTES.GOALS.TEMPLATES);
  }

  async createGoalFromTemplate(templateId: string): Promise<ApiResponse<Goal>> {
    return this.post<Goal>(`${ROUTES.GOALS.TEMPLATES}/${templateId}/create`, {});
  }

  async getGoalStats(goalId?: string): Promise<ApiResponse<GoalStats>> {
    const endpoint = goalId ? ROUTES.GOALS.GET_STATS(goalId) : ROUTES.GOALS.STATS;
    return this.get<GoalStats>(endpoint);
  }

  async archiveGoal(goalId: string): Promise<ApiResponse<Goal>> {
    return this.put<Goal>(ROUTES.GOALS.ARCHIVE(goalId), {});
  }

  async unarchiveGoal(goalId: string): Promise<ApiResponse<Goal>> {
    return this.put<Goal>(ROUTES.GOALS.UNARCHIVE(goalId), {});
  }

  async activateGoal(goalId: string): Promise<ApiResponse<Goal>> {
    return this.post<Goal>(ROUTES.GOALS.ACTIVATE(goalId), {});
  }

  async deactivateGoal(goalId: string): Promise<ApiResponse<Goal>> {
    return this.post<Goal>(ROUTES.GOALS.DEACTIVATE(goalId), {});
  }

  async duplicateGoal(goalId: string): Promise<ApiResponse<Goal>> {
    return this.post<Goal>(ROUTES.GOALS.DUPLICATE_GOAL(goalId), {});
  }

  async getGoalsByCategory(category: Goal["category"]): Promise<ApiResponse<Goal[]>> {
    return this.get<Goal[]>(ROUTES.GOALS.GET_GOALS_BY_CATEGORY(category));
  }

  async getActiveGoals(): Promise<ApiResponse<Goal[]>> {
    return this.get<Goal[]>(ROUTES.GOALS.GET_ACTIVE_GOALS);
  }

  async getCompletedGoals(): Promise<ApiResponse<Goal[]>> {
    return this.get<Goal[]>(ROUTES.GOALS.GET_COMPLETED_GOALS);
  }

  /**
   * Get AI-powered goal suggestions based on goal type
   */
  async getSuggestionsByType(
    request: GoalTypeSuggestionRequest
  ): Promise<ApiResponse<GoalTypeSuggestionResponse>> {
    return this.post<GoalTypeSuggestionResponse>(
      `${ROUTES.GOALS.LIST}/suggestions-by-type`,
      request
    );
  }
}

// Export singleton instance
export const goalsService = new GoalsService();
