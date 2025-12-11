import { BaseApiService, ApiResponse } from "./base";
import { ROUTES } from "@/lib/routes";

// Goal type literals
export type GoalType = "habit" | "time_challenge" | "target_challenge";
export type CompletionReason = "duration" | "target" | "manual";

// Goals Types
export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  category:
    | "fitness"
    | "nutrition"
    | "wellness"
    | "mindfulness"
    | "sleep"
    | "custom";
  frequency: "daily" | "weekly";
  target_days: number;
  days_of_week?: number[]; // Array of day numbers (0-6): 0=Sunday, 1=Monday, ..., 6=Saturday
  reminder_times: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Goal type fields
  goal_type?: GoalType;
  challenge_id?: string; // Links to shared challenge
  target_checkins?: number; // For target_challenge
  challenge_start_date?: string; // For time_challenge
  challenge_end_date?: string; // For time_challenge
  completed_at?: string; // When challenge was completed
  completion_reason?: CompletionReason;
}

export interface CreateGoalRequest {
  title: string;
  description?: string;
  category: Goal["category"];
  frequency: Goal["frequency"];
  target_days: number;
  days_of_week?: number[];
  reminder_times: string[];
  is_active?: boolean;
  // Goal type fields
  goal_type?: GoalType;
  target_checkins?: number; // For target_challenge
  challenge_duration_days?: number; // For time_challenge (30, 60, 90)
  challenge_id?: string; // Link to shared challenge
}

export interface UpdateGoalRequest {
  title?: string;
  description?: string;
  category?: Goal["category"];
  frequency?: Goal["frequency"];
  target_days?: number;
  days_of_week?: number[];
  reminder_times?: string[];
  is_active?: boolean;
  // Goal type fields (mostly immutable)
  goal_type?: GoalType;
  target_checkins?: number;
  completed_at?: string;
  completion_reason?: CompletionReason;
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
    return this.get<Goal[]>(ROUTES.GOALS.LIST);
  }

  async getGoal(goalId: string): Promise<ApiResponse<Goal>> {
    return this.get<Goal>(ROUTES.GOALS.GET(goalId));
  }

  async createGoal(goal: CreateGoalRequest): Promise<ApiResponse<Goal>> {
    return this.post<Goal>(ROUTES.GOALS.CREATE, goal);
  }

  async updateGoal(
    goalId: string,
    updates: UpdateGoalRequest
  ): Promise<ApiResponse<Goal>> {
    return this.put<Goal>(ROUTES.GOALS.UPDATE(goalId), updates);
  }

  async deleteGoal(goalId: string): Promise<ApiResponse> {
    return this.delete(ROUTES.GOALS.DELETE(goalId));
  }

  async getGoalTemplates(): Promise<ApiResponse<GoalTemplate[]>> {
    return this.get<GoalTemplate[]>(ROUTES.GOALS.TEMPLATES);
  }

  async createGoalFromTemplate(templateId: string): Promise<ApiResponse<Goal>> {
    return this.post<Goal>(
      `${ROUTES.GOALS.TEMPLATES}/${templateId}/create`,
      {}
    );
  }

  async getGoalStats(goalId?: string): Promise<ApiResponse<GoalStats>> {
    const endpoint = goalId
      ? ROUTES.GOALS.GET_STATS(goalId)
      : ROUTES.GOALS.STATS;
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

  async getGoalsByCategory(
    category: Goal["category"]
  ): Promise<ApiResponse<Goal[]>> {
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
