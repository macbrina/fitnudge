import { BaseApiService, ApiResponse } from "./base";
import { ROUTES } from "@/lib/routes";

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
  frequency: "daily" | "weekly" | "monthly" | "custom";
  target_days: number;
  reminder_times: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateGoalRequest {
  title: string;
  description?: string;
  category: Goal["category"];
  frequency: Goal["frequency"];
  target_days: number;
  reminder_times: string[];
  is_active?: boolean;
}

export interface UpdateGoalRequest {
  title?: string;
  description?: string;
  category?: Goal["category"];
  frequency?: Goal["frequency"];
  target_days?: number;
  reminder_times?: string[];
  is_active?: boolean;
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
}

// Export singleton instance
export const goalsService = new GoalsService();
