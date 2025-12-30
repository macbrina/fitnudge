import { BaseApiService } from "./base";
import { ROUTES } from "@/lib/routes";

export type PlanStatus =
  | "not_started"
  | "pending"
  | "generating"
  | "completed"
  | "failed";

export interface PlanStatusResponse {
  goal_id?: string;
  challenge_id?: string;
  status: PlanStatus;
  plan_type?: string;
  error_message?: string;
  generated_at?: string;
}

// Streak milestones for HABIT goals (ongoing, no end date)
export interface StreakMilestone {
  days: number;
  title: string;
  description: string;
}

// Time-based milestones for TIME CHALLENGE
export interface TimeMilestone {
  day: number;
  title: string;
  description: string;
}

// Count-based milestones for TARGET CHALLENGE
export interface TargetMilestone {
  count: number;
  percent: number;
  title: string;
  description: string;
}

// Challenge info for challenges
export interface ChallengeInfo {
  type: "time_challenge" | "target_challenge";
  // Time challenge fields
  duration_days?: number;
  start_date?: string;
  end_date?: string;
  milestones?: TimeMilestone[] | TargetMilestone[];
  // Target challenge fields
  target_checkins?: number;
  rewards?: { at_percent: number; reward: string }[];
}

// Weekly progression for time challenges
export interface WeeklyAdjustment {
  week: number;
  focus: string;
  intensity: "light" | "moderate" | "moderate-high" | "high";
}

export interface Progression {
  current_week?: number;
  weekly_focus?: string;
  weekly_adjustments?: WeeklyAdjustment[];
  // Multi-agent system also includes these in progression:
  goal_type?: "habit" | "time_challenge" | "target_challenge";
  streak_milestones?: StreakMilestone[];
}

export interface PlanGuidance {
  description: string;
  tips: string[];
  // For HABIT goals - streak-based milestones
  streak_milestones?: StreakMilestone[];
}

export interface PlanStructure {
  // Common fields
  challenge_info?: ChallengeInfo;
  progression?: Progression;
  // Workout-specific
  total_duration_minutes?: number;
  main_workout?: { exercises: any[] };
  routine?: { exercises: any[] };
  warm_up?: { exercises: any[] };
  cool_down?: { exercises: any[] };
  // Other plan-specific fields
  [key: string]: any;
}

export interface ActionablePlan {
  id: string;
  goal_id?: string;
  challenge_id?: string; // For standalone challenges
  plan_type:
    | "meal_plan"
    | "workout_plan"
    | "habit_plan"
    | "accountability_plan";
  structured_data: {
    plan_type: string;
    tracking_type?: "workout" | "meal" | "hydration" | "checkin";
    structure: PlanStructure;
    guidance: PlanGuidance;
  };
  status: PlanStatus;
  error_message?: string;
  generated_at: string;
  created_at: string;
  updated_at: string;
}

export interface GoalPlanResponse {
  goal_id?: string;
  challenge_id?: string;
  plan?: ActionablePlan;
  status: PlanStatus;
}

// Alias for challenge plans (same response structure)
export type ChallengePlanResponse = GoalPlanResponse;

class ActionablePlansService extends BaseApiService {
  /**
   * Get plan generation status for a goal
   */
  async getPlanStatus(goalId: string): Promise<PlanStatusResponse> {
    const response = await this.get<PlanStatusResponse>(
      `${ROUTES.GOALS.BASE}/${goalId}/plan-status`,
    );
    return response.data!;
  }

  /**
   * Get plan generation status for a challenge
   */
  async getChallengePlanStatus(
    challengeId: string,
  ): Promise<PlanStatusResponse> {
    const response = await this.get<PlanStatusResponse>(
      `${ROUTES.CHALLENGES.BASE}/${challengeId}/plan-status`,
    );
    return response.data!;
  }

  /**
   * Get the complete actionable plan for a goal
   */
  async getGoalPlan(goalId: string): Promise<GoalPlanResponse> {
    const response = await this.get<GoalPlanResponse>(
      `${ROUTES.GOALS.BASE}/${goalId}/plan`,
    );
    return response.data!;
  }

  /**
   * Get the complete actionable plan for a challenge
   */
  async getChallengePlan(challengeId: string): Promise<ChallengePlanResponse> {
    const response = await this.get<ChallengePlanResponse>(
      `${ROUTES.CHALLENGES.BASE}/${challengeId}/plan`,
    );
    return response.data!;
  }

  /**
   * Retry plan generation for a failed plan (goal)
   */
  async retryPlanGeneration(goalId: string): Promise<PlanStatusResponse> {
    const response = await this.post<PlanStatusResponse>(
      `${ROUTES.GOALS.BASE}/${goalId}/plan/retry`,
      {},
    );
    return response.data!;
  }

  /**
   * Retry plan generation for a failed challenge plan
   */
  async retryChallengePlanGeneration(
    challengeId: string,
  ): Promise<PlanStatusResponse> {
    const response = await this.post<PlanStatusResponse>(
      `${ROUTES.CHALLENGES.BASE}/${challengeId}/plan/retry`,
      {},
    );
    return response.data!;
  }
}

export const actionablePlansService = new ActionablePlansService();
