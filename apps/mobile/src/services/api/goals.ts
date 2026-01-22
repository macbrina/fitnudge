/**
 * V2 Goals API Service
 *
 * Simplified goal tracking for accountability:
 * - Goals are simple habits (e.g., "Work out 3x/week", "Read daily")
 * - Yes/No check-ins
 * - Streak tracking
 * - No AI-generated plans, no tracking types, no categories
 */

import { BaseApiService, ApiResponse } from "./base";
import { ROUTES } from "@/lib/routes";

// Goal status
export type GoalStatus = "active" | "paused" | "archived";

// Frequency type
export type FrequencyType = "daily" | "weekly";

// Today's check-in status
export type TodayCheckinStatus = "completed" | "skipped" | "rest_day" | null;

/**
 * V2 Goal Interface
 * Matches the goals table in the V2 database schema
 */
export interface Goal {
  id: string;
  user_id: string;

  // Goal definition
  title: string;

  // Frequency
  frequency_type: FrequencyType;
  frequency_count: number; // Days per week: 7 for daily, 1-7 for weekly
  target_days: number[] | null; // 0=Sun, 1=Mon, ..., 6=Sat. null = any day

  // Reminder
  reminder_times: string[] | null; // Array of times like ["18:00"]

  // Motivation
  why_statement?: string | null; // User's personal "why"

  // Status
  status: GoalStatus;

  // Stats (denormalized for performance)
  current_streak: number;
  longest_streak: number;
  total_completions: number;

  // Metadata
  created_at: string;
  updated_at?: string | null;

  // Today's status (from include_today_status=true)
  today_checkin_status?: TodayCheckinStatus;
  progress_this_week?: { completed: number; target: number } | null;
}

/**
 * Create Goal Request
 */
export interface CreateGoalRequest {
  title: string;
  frequency_type: FrequencyType;
  frequency_count?: number; // 7 for daily, 1-7 for weekly (days per week)
  target_days?: number[];
  reminder_times?: string[];
  why_statement?: string;
}

/**
 * AI-generated Pattern Insight for a goal
 */
export interface PatternInsight {
  type: "pattern" | "encouragement" | "warning" | "tip";
  text: string;
  priority: number;
}

/**
 * Nudge configuration from AI analysis
 */
export interface NudgeConfig {
  risky_days: number[]; // 0=Sunday, 1=Monday, etc.
  risk_level: "low" | "medium" | "high";
  best_nudge_time: string;
  needs_extra_motivation: boolean;
}

/**
 * Metrics snapshot for trend comparison
 */
export interface InsightsMetrics {
  completion_rate_30d: number;
  completion_rate_7d: number;
  current_streak: number;
  longest_streak: number;
  total_checkins_30d: number;
  completed_checkins_30d: number;
  best_day_index?: number;
  best_day_rate?: number;
  worst_day_index?: number;
  worst_day_rate?: number;
  calculated_at?: string;
}

/**
 * Insight generation status
 */
export type InsightStatus = "pending" | "generating" | "completed" | "failed" | "insufficient_data";

/**
 * Goal Insights Response (Premium, AI-powered)
 */
export interface GoalInsightsResponse {
  goal_id: string;
  goal_title: string;
  status: InsightStatus;
  insights: PatternInsight[];
  nudge_config?: NudgeConfig;
  current_metrics?: InsightsMetrics;
  previous_metrics?: InsightsMetrics;
  checkins_count?: number; // For insufficient_data status
  min_required?: number; // For insufficient_data status
  generated_at?: string;
  summary?: string;
}

/**
 * Update Goal Request
 */
export interface UpdateGoalRequest {
  title?: string;
  frequency_type?: FrequencyType;
  frequency_count?: number;
  target_days?: number[];
  reminder_times?: string[];
  why_statement?: string;
  status?: GoalStatus;
}

/**
 * Goal Stats (single goal)
 */
export interface SingleGoalStats {
  goal_id: string;
  title: string;
  current_streak: number;
  longest_streak: number;
  total_completions: number;
  total_checkins: number;
  completed_checkins: number;
  completion_rate: number;
  checkins_last_7d: number;
  checkins_last_30d: number;
  goal_created: string;
}

/**
 * Goals Summary Stats (all goals)
 */
export interface GoalsSummaryStats {
  total_goals: number;
  active_goals: number;
  paused_goals: number;
  archived_goals: number;
  total_checkins: number;
  completed_checkins: number;
  completion_rate: number;
  best_streak_ever: number;
  current_best_streak: number;
}

/**
 * Popular Goal Template (for onboarding)
 */
export interface GoalTemplate {
  id: string;
  title: string;
  emoji: string;
  frequency_type: FrequencyType;
  frequency_count: number;
  description?: string;
}

// Pre-defined popular goal templates for V2 onboarding
export const POPULAR_GOALS: GoalTemplate[] = [
  {
    id: "workout",
    title: "Work out",
    emoji: "🏋️",
    frequency_type: "weekly",
    frequency_count: 3,
    description: "Build strength and stay active"
  },
  {
    id: "read",
    title: "Read",
    emoji: "📚",
    frequency_type: "daily",
    frequency_count: 7,
    description: "Expand your mind daily"
  },
  {
    id: "meditate",
    title: "Meditate",
    emoji: "🧘",
    frequency_type: "daily",
    frequency_count: 7,
    description: "Find calm and clarity"
  },
  {
    id: "hydrate",
    title: "Drink water",
    emoji: "💧",
    frequency_type: "daily",
    frequency_count: 7,
    description: "Stay hydrated throughout the day"
  },
  {
    id: "journal",
    title: "Journal",
    emoji: "📝",
    frequency_type: "daily",
    frequency_count: 7,
    description: "Reflect and grow"
  },
  {
    id: "walk",
    title: "Take a walk",
    emoji: "🚶",
    frequency_type: "daily",
    frequency_count: 7,
    description: "Get moving and clear your head"
  },
  {
    id: "sleep",
    title: "Sleep 8 hours",
    emoji: "😴",
    frequency_type: "daily",
    frequency_count: 7,
    description: "Prioritize rest and recovery"
  },
  {
    id: "no-phone",
    title: "No phone in bed",
    emoji: "📵",
    frequency_type: "daily",
    frequency_count: 7,
    description: "Better sleep starts with no screens"
  }
];

/**
 * V2 Goals Service
 */
export class GoalsService extends BaseApiService {
  /**
   * Get all goals with optional filters
   * @param activeOnly - If true, only return active goals (default: true)
   * @param includeTodayStatus - If true, include today_checkin_status and progress_this_week (default: true)
   */
  async getGoals(
    activeOnly: boolean = true,
    includeTodayStatus: boolean = true
  ): Promise<ApiResponse<Goal[]>> {
    const params = new URLSearchParams();
    params.append("active_only", String(activeOnly));
    params.append("include_today_status", String(includeTodayStatus));
    return this.get<Goal[]>(`${ROUTES.GOALS.BASE}/?${params.toString()}`);
  }

  /**
   * Get active goals only
   */
  async getActiveGoals(): Promise<ApiResponse<Goal[]>> {
    return this.getGoals(true, true);
  }

  /**
   * Get all goals including archived
   */
  async getAllGoals(): Promise<ApiResponse<Goal[]>> {
    return this.getGoals(false, true);
  }

  /**
   * Get archived goals only
   * Note: Backend doesn't have a direct filter for archived,
   * so we get all and filter client-side
   */
  async getArchivedGoals(): Promise<ApiResponse<Goal[]>> {
    const response = await this.getGoals(false, false);
    if (response.data) {
      response.data = response.data.filter((g) => g.status === "archived");
    }
    return response;
  }

  /**
   * Get a single goal by ID
   */
  async getGoal(goalId: string): Promise<ApiResponse<Goal>> {
    return this.get<Goal>(ROUTES.GOALS.GET(goalId));
  }

  /**
   * Create a new goal
   */
  async createGoal(goal: CreateGoalRequest): Promise<ApiResponse<Goal>> {
    return this.post<Goal>(ROUTES.GOALS.CREATE, goal);
  }

  /**
   * Update a goal
   */
  async updateGoal(goalId: string, updates: UpdateGoalRequest): Promise<ApiResponse<Goal>> {
    return this.put<Goal>(ROUTES.GOALS.UPDATE(goalId), updates);
  }

  /**
   * Delete a goal permanently
   */
  async deleteGoal(goalId: string): Promise<ApiResponse<void>> {
    return this.delete(ROUTES.GOALS.DELETE(goalId));
  }

  /**
   * Activate a goal (set status to 'active')
   * Subject to active goal limits based on user's plan
   */
  async activateGoal(goalId: string): Promise<ApiResponse<{ message: string; goal: Goal }>> {
    return this.post<{ message: string; goal: Goal }>(ROUTES.GOALS.ACTIVATE(goalId), {});
  }

  /**
   * Deactivate a goal (set status to 'paused')
   */
  async deactivateGoal(goalId: string): Promise<ApiResponse<{ message: string; goal: Goal }>> {
    return this.post<{ message: string; goal: Goal }>(ROUTES.GOALS.DEACTIVATE(goalId), {});
  }

  /**
   * Archive a goal (set status to 'archived')
   * Archived goals don't count toward limits
   */
  async archiveGoal(goalId: string): Promise<ApiResponse<{ message: string; goal: Goal }>> {
    return this.post<{ message: string; goal: Goal }>(ROUTES.GOALS.ARCHIVE(goalId), {});
  }

  /**
   * Get statistics for a specific goal
   */
  async getGoalStats(goalId: string): Promise<ApiResponse<SingleGoalStats>> {
    return this.get<SingleGoalStats>(ROUTES.GOALS.GET_STATS(goalId));
  }

  /**
   * Get summary statistics for all goals
   */
  async getGoalsSummary(): Promise<ApiResponse<GoalsSummaryStats>> {
    return this.get<GoalsSummaryStats>(ROUTES.GOALS.STATS_SUMMARY);
  }

  /**
   * Get pattern insights for a specific goal (Premium)
   */
  async getGoalInsights(goalId: string): Promise<ApiResponse<GoalInsightsResponse>> {
    return this.get<GoalInsightsResponse>(ROUTES.GOALS.GET_INSIGHTS(goalId));
  }

  /**
   * Force refresh AI-generated pattern insights for a goal (Premium)
   */
  async refreshGoalInsights(
    goalId: string
  ): Promise<ApiResponse<{ message: string; status: InsightStatus; insights_count: number }>> {
    return this.post(ROUTES.GOALS.REFRESH_INSIGHTS(goalId), {});
  }
}

// Export singleton instance
export const goalsService = new GoalsService();
