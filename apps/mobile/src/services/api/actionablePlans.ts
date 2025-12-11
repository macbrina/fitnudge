import { BaseApiService } from "./base";
import { ROUTES } from "@/lib/routes";

export type PlanStatus =
  | "not_started"
  | "pending"
  | "generating"
  | "completed"
  | "failed";

export interface PlanStatusResponse {
  goal_id: string;
  status: PlanStatus;
  plan_type?: string;
  error_message?: string;
  generated_at?: string;
}

export interface ActionablePlan {
  id: string;
  goal_id: string;
  plan_type:
    | "meal_plan"
    | "workout_plan"
    | "habit_plan"
    | "accountability_plan";
  structured_data: {
    plan_type: string;
    structure: any;
    guidance: {
      description: string;
      tips: string[];
    };
  };
  status: PlanStatus;
  error_message?: string;
  generated_at: string;
  created_at: string;
  updated_at: string;
}

export interface GoalPlanResponse {
  goal_id: string;
  plan?: ActionablePlan;
  status: PlanStatus;
}

class ActionablePlansService extends BaseApiService {
  /**
   * Get plan generation status for a goal
   */
  async getPlanStatus(goalId: string): Promise<PlanStatusResponse> {
    const response = await this.get<PlanStatusResponse>(
      `${ROUTES.GOALS.BASE}/${goalId}/plan-status`
    );
    return response.data!;
  }

  /**
   * Get the complete actionable plan for a goal
   */
  async getGoalPlan(goalId: string): Promise<GoalPlanResponse> {
    const response = await this.get<GoalPlanResponse>(
      `${ROUTES.GOALS.BASE}/${goalId}/plan`
    );
    return response.data!;
  }

  /**
   * Retry plan generation for a failed plan
   */
  async retryPlanGeneration(goalId: string): Promise<PlanStatusResponse> {
    const response = await this.post<PlanStatusResponse>(
      `${ROUTES.GOALS.BASE}/${goalId}/plan/retry`,
      {}
    );
    return response.data!;
  }
}

export const actionablePlansService = new ActionablePlansService();
