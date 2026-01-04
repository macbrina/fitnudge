import { BaseApiService, ApiResponse } from "./base";

// =============================================================================
// Types
// =============================================================================

export interface WorkoutStats {
  total_workouts: number;
  total_duration_minutes: number;
  workouts_this_week: number;
  avg_duration_minutes: number;
  exercises_completed: number;
  total_calories_burned: number;
  rest_days: number;
  period_days: number;
}

export interface MealStats {
  total_meals_logged: number;
  meals_this_week: number;
  avg_meals_per_day: number;
  total_calories: number;
  total_protein: number;
  avg_calories_per_day: number;
  avg_protein_per_day: number;
  healthy_meals: number;
  okay_meals: number;
  unhealthy_meals: number;
  healthy_meal_percentage: number;
  okay_meal_percentage: number;
  unhealthy_meal_percentage: number;
  period_days: number;
}

export interface HydrationStats {
  total_intake_ml: number;
  avg_daily_intake_ml: number;
  days_target_hit: number;
  target_hit_percentage: number;
  intake_today_ml: number;
  daily_target_ml: number;
  period_days: number;
}

export interface CheckinStats {
  total_checkins: number;
  completed_checkins: number;
  completion_rate: number;
  avg_mood: number | null;
  mood_trend: { date: string; mood: number }[];
  period_days: number;
}

export interface TrackingStatsResponse {
  tracking_type: "workout" | "meal" | "hydration" | "checkin";
  entity_type: "goal" | "challenge";
  entity_id: string;
  period_days: number;
  workout?: WorkoutStats;
  meal?: MealStats;
  hydration?: HydrationStats;
  checkin?: CheckinStats;
}

export type TrackingType = "workout" | "meal" | "hydration" | "checkin";

// =============================================================================
// Service
// =============================================================================

class TrackingStatsService extends BaseApiService {
  constructor() {
    super();
  }

  /**
   * Get tracking-type-specific statistics for a goal or challenge
   */
  async getStats(
    entityId: string,
    entityType: "goal" | "challenge",
    trackingType: TrackingType,
    period: number = 30
  ): Promise<ApiResponse<TrackingStatsResponse>> {
    const params = new URLSearchParams({
      entity_id: entityId,
      entity_type: entityType,
      tracking_type: trackingType,
      period: period.toString()
    });

    return this.get<TrackingStatsResponse>(`/tracking-stats?${params.toString()}`);
  }
}

export const trackingStatsService = new TrackingStatsService();
