/**
 * Analytics API Service
 *
 * Fetches pre-computed per-goal analytics dashboard data from the backend.
 * Premium feature: requires `advanced_analytics` subscription.
 *
 * V2: Analytics are now per-goal (requires goalId).
 */

import { BaseApiService, ApiResponse } from "./base";

// =============================================================================
// TYPES - Match backend Pydantic models
// =============================================================================

// New: Heatmap data for calendar
export interface HeatmapDataItem {
  date: string; // ISO date
  status: string; // completed, rest_day, skipped, missed
  intensity: number; // 0-4 for coloring
}

// New: This week summary
export interface ThisWeekItem {
  date: string; // ISO date
  day_name: string; // Mon, Tue, etc.
  day_of_week: number; // 0=Sun, 1=Mon, etc.
  status: string; // completed, rest_day, skipped, missed, pending, no_data
}

// New: Mood trend data
export interface MoodTrendItem {
  date: string; // ISO date
  mood: string; // tough, good, amazing
  mood_score: number; // 1, 2, 3
  label: string; // "Jan 15" format
}

export interface WeeklyConsistencyItem {
  day: string; // Mon, Tue, Wed, Thu, Fri, Sat, Sun
  day_index: number; // 0=Sun, 1=Mon, ..., 6=Sat
  percentage: number; // 0-100
  completed: number;
  total: number;
}

export interface StreakHistoryItem {
  week: string; // W1, W2, ..., W12
  week_start: string; // ISO date
  max_streak: number;
}

export interface MonthlyTrendItem {
  month: string; // Jan, Feb, ..., Dec
  month_index: number; // 0-11
  year: number;
  percentage: number; // 0-100
  completed: number;
  total: number;
}

export interface SkipReasonItem {
  reason: string; // work, tired, sick, schedule, other
  label: string;
  count: number;
  percentage: number; // 0-100
  color: string;
}

export interface AnalyticsDashboard {
  // Goal info
  goal_id: string | null;
  goal_title: string | null;
  goal_created_at: string | null; // ISO date when goal was created
  // Target days for schedule: null = daily (all days), array = specific days (0=Sun, 1=Mon, etc.)
  target_days: number[] | null;

  // Summary stats
  total_check_ins: number;
  completed_check_ins: number;
  completion_rate: number;
  current_streak: number;
  longest_streak: number;

  // New: Heatmap and this week data
  heatmap_data: HeatmapDataItem[];
  this_week_summary: ThisWeekItem[];

  // Chart data
  weekly_consistency: WeeklyConsistencyItem[];
  streak_history: StreakHistoryItem[];
  monthly_trend: MonthlyTrendItem[];
  skip_reasons: SkipReasonItem[];

  // New: Mood trend
  mood_trend: MoodTrendItem[];

  // Metadata
  data_range_days: number;
  generated_at: string;
  cache_hit?: boolean; // True if served from Redis cache
}

// =============================================================================
// SERVICE
// =============================================================================

class AnalyticsService extends BaseApiService {
  /**
   * Get per-goal analytics dashboard data.
   *
   * V2: Analytics are now per-goal.
   * Premium feature: requires `advanced_analytics` subscription.
   * Returns 403 if user doesn't have access.
   *
   * @param goalId Goal ID to analyze (required)
   * @param days Number of days to analyze (7-180, default 30)
   * @param skipCache Force fresh data (bypass Redis cache)
   */
  async getDashboard(
    goalId: string,
    days: number = 30,
    skipCache: boolean = false
  ): Promise<ApiResponse<AnalyticsDashboard>> {
    const params = new URLSearchParams({
      goal_id: goalId,
      days: days.toString()
    });
    if (skipCache) {
      params.append("skip_cache", "true");
    }
    return this.get<AnalyticsDashboard>(`/analytics/dashboard?${params.toString()}`);
  }
}

export const analyticsService = new AnalyticsService();
