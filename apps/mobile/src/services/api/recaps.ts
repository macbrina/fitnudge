/**
 * Weekly Recaps API Service
 *
 * Handles API calls for weekly progress recaps.
 */

import { BaseApiService, ApiResponse } from "./base";
import { ROUTES } from "@/lib/routes";

// ============================================================================
// Types
// ============================================================================

export interface GoalBreakdown {
  goal_id: string;
  title: string;
  completed: number;
  total: number; // V2: renamed from 'scheduled'
  days_active: number;
  completion_rate: number;
  status: "excellent" | "good" | "needs_attention";
  current_streak?: number;
  longest_streak?: number;
  is_archived?: boolean;
}

export interface CompletionRateTrend {
  week_start: string;
  week_label: string;
  completed: number;
  scheduled: number;
  completion_rate: number;
  is_current: boolean;
}

export interface AchievementUnlocked {
  badge_key?: string;
  badge_name: string;
  description?: string;
  category?: string;
  rarity?: string;
  unlocked_at?: string;
}

export interface PartnerContext {
  partner_id: string;
  partner_name: string;
  partner_streak: number;
  partnership_id?: string;
}

export interface WeeklyRecapStats {
  completed_check_ins: number;
  days_with_checkins: number;
  current_streak: number;
  longest_streak: number;
  completion_rate: number;
  total_check_ins?: number;
  rest_day_count?: number;
  previous_week_checkins?: number;
  week_over_week_change?: number;
  strongest_day?: string;
  weakest_day?: string;
  mood_distribution?: Record<string, number>; // { 'tough': 2, 'good': 5, 'amazing': 3 }
}

export interface WeeklyRecap {
  id: string;
  user_id?: string;
  week_start: string;
  week_end: string;
  goal_id?: string;
  goal_title?: string;
  // DB summary columns
  goals_hit?: number;
  goals_total?: number;
  consistency_percent?: number;
  // Full stats object
  stats: WeeklyRecapStats;
  goal_breakdown?: GoalBreakdown[];
  completion_rate_trend?: CompletionRateTrend[];
  partner_context?: PartnerContext[];
  achievements_unlocked?: AchievementUnlocked[];
  // AI-generated content
  summary?: string; // Short AI summary
  recap_text?: string; // Full recap text (same as summary for now)
  win?: string;
  insight?: string;
  focus_next_week?: string;
  motivational_close?: string;
  generated_at: string;
  created_at?: string;
  updated_at?: string;
}

export interface WeeklyRecapsListResponse {
  data: WeeklyRecap[];
  total: number;
}

// ============================================================================
// API Service
// ============================================================================

export class RecapsService extends BaseApiService {
  /**
   * Get list of cached weekly recaps for current user
   */
  async getList(
    limit: number = 10,
    offset: number = 0
  ): Promise<ApiResponse<WeeklyRecapsListResponse>> {
    return this.get<WeeklyRecapsListResponse>(
      `${ROUTES.RECAPS.LIST}?limit=${limit}&offset=${offset}`
    );
  }

  /**
   * Get current week's recap (generates if not cached)
   */
  async getCurrentWeek(forceRegenerate: boolean = false): Promise<ApiResponse<WeeklyRecap>> {
    const params = forceRegenerate ? "?force_regenerate=true" : "";
    return this.get<WeeklyRecap>(`${ROUTES.RECAPS.CURRENT}${params}`);
  }

  /**
   * Get a specific recap by ID
   */
  async getById(recapId: string): Promise<ApiResponse<WeeklyRecap>> {
    return this.get<WeeklyRecap>(ROUTES.RECAPS.GET(recapId));
  }
}

// Export singleton instance
export const recapsService = new RecapsService();
