/**
 * V2.1 Check-ins API Service
 *
 * Check-ins are the core of FitNudge V2.1:
 * - Pre-created daily with status='pending' by backend Celery task
 * - Updated when users respond to notifications (status -> completed/skipped/rest_day)
 * - Marked as 'missed' at end of day if no response
 * - Always associated with a goal
 * - Include mood (for completed) or skip_reason (for skipped)
 * - AI generates personalized response after each check-in
 *
 * Main endpoint: POST /check-ins
 */

import { BaseApiService, ApiResponse } from "./base";

// V2 Mood values (for completed check-ins)
export type CheckInMood = "tough" | "good" | "amazing";

// V2 Skip reasons (for skipped check-ins)
export type SkipReason = "work" | "tired" | "sick" | "schedule" | "other";

// V2.1 Check-in status values
export type CheckInStatus = "pending" | "completed" | "skipped" | "missed" | "rest_day";

// Mood options (for Yes)
export const MOODS: { value: CheckInMood; emoji: string; labelKey: string }[] = [
  { value: "tough", emoji: "😤", labelKey: "checkin.mood.tough" },
  { value: "good", emoji: "😊", labelKey: "checkin.mood.good" },
  { value: "amazing", emoji: "🔥", labelKey: "checkin.mood.amazing" }
];

// Skip reason options (for No)
export const SKIP_REASONS: { value: SkipReason; emoji: string; labelKey: string }[] = [
  { value: "work", emoji: "🏢", labelKey: "checkin.reason.work" },
  { value: "tired", emoji: "😴", labelKey: "checkin.reason.tired" },
  { value: "sick", emoji: "🤒", labelKey: "checkin.reason.sick" },
  { value: "schedule", emoji: "📅", labelKey: "checkin.reason.schedule" },
  { value: "other", emoji: "💭", labelKey: "checkin.reason.other" }
];

/**
 * V2 Check-in Interface
 * status is the single source of truth - no completed/is_rest_day columns
 */
export interface CheckIn {
  id: string;
  goal_id: string;
  user_id: string;
  check_in_date: string;
  status: CheckInStatus; // pending, completed, skipped, missed, rest_day
  mood?: CheckInMood;
  skip_reason?: SkipReason;
  note?: string;
  voice_note_url?: string; // Premium feature
  voice_note_transcript?: string;
  ai_response?: string; // AI's personalized message after check-in
  created_at: string;
}

/**
 * Create Check-in Request
 * Used when user responds to notification: Yes / No / Rest Day
 */
export interface CreateCheckInRequest {
  goal_id: string;
  check_in_date?: string; // YYYY-MM-DD, defaults to today
  completed: boolean;
  is_rest_day?: boolean;
  mood?: CheckInMood; // For completed check-ins
  skip_reason?: SkipReason; // For missed check-ins
  note?: string; // Optional reflection
  /** When true, backend skips queuing AI task; media upload queues it after VN is processed. */
  expect_voice_note?: boolean;
}

/**
 * Today's Status Response
 */
export interface TodayStatusResponse {
  goal_id: string;
  date: string;
  has_checked_in: boolean;
  check_in: CheckIn | null;
  can_check_in: boolean;
  is_scheduled_today: boolean;
}

/**
 * V2 Check-ins Service
 *
 * Note: Check-ins are accessed through goal endpoints in V2.
 * Use goalsService.getGoal() to get streak/completion data.
 */
export class CheckInsService extends BaseApiService {
  /**
   * Create a check-in for a goal (core V2 flow)
   *
   * This is the main check-in endpoint:
   * 1. User receives push notification
   * 2. User taps Yes / No / Rest Day
   * 3. This endpoint is called
   * 4. Backend creates check-in and generates AI response
   *
   * @param checkIn The check-in data including goal_id
   */
  async createCheckIn(checkIn: CreateCheckInRequest): Promise<ApiResponse<CheckIn>> {
    const { goal_id, ...data } = checkIn;
    return this.post<CheckIn>(`/check-ins`, { goal_id, ...data });
  }

  /**
   * Get check-ins for a specific goal or all check-ins
   *
   * @param goalId Optional goal ID to filter by
   * @param options Filter options
   */
  async getCheckIns(
    goalId?: string,
    options?: {
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
      excludePending?: boolean;
    }
  ): Promise<ApiResponse<CheckIn[]>> {
    const params = new URLSearchParams();

    // Goal ID is now a query param, not path param
    if (goalId) {
      params.append("goal_id", goalId);
    }
    if (options?.startDate) {
      params.append("start_date", options.startDate);
    }
    if (options?.endDate) {
      params.append("end_date", options.endDate);
    }
    if (options?.limit) {
      params.append("limit", options.limit.toString());
    }
    if (options?.offset) {
      params.append("offset", options.offset.toString());
    }
    if (options?.excludePending) {
      params.append("exclude_pending", "true");
    }

    const queryString = params.toString();
    const endpoint = `/check-ins${queryString ? `?${queryString}` : ""}`;

    return this.get<CheckIn[]>(endpoint);
  }

  /**
   * Get today's check-in status for a goal
   *
   * Returns:
   * - has_checked_in: whether user has checked in today
   * - check_in: the check-in data if exists
   * - can_check_in: whether user can check in (goal is active, scheduled for today)
   *
   * @param goalId The goal ID
   */
  async getTodayStatus(goalId: string): Promise<ApiResponse<TodayStatusResponse>> {
    return this.get<TodayStatusResponse>(`/check-ins/goal/${goalId}/today`);
  }

  /**
   * Quick check-in helpers for common scenarios
   */

  /**
   * Mark goal as completed for today
   */
  async markCompleted(
    goalId: string,
    mood?: CheckInMood,
    note?: string
  ): Promise<ApiResponse<CheckIn>> {
    return this.createCheckIn({
      goal_id: goalId,
      completed: true,
      is_rest_day: false,
      mood,
      note
    });
  }

  /**
   * Mark goal as missed for today
   */
  async markMissed(
    goalId: string,
    skipReason?: SkipReason,
    note?: string
  ): Promise<ApiResponse<CheckIn>> {
    return this.createCheckIn({
      goal_id: goalId,
      completed: false,
      is_rest_day: false,
      skip_reason: skipReason,
      note
    });
  }

  /**
   * Mark today as a rest day (streak preserved)
   */
  async markRestDay(goalId: string, note?: string): Promise<ApiResponse<CheckIn>> {
    return this.createCheckIn({
      goal_id: goalId,
      completed: false,
      is_rest_day: true,
      note
    });
  }

  /**
   * Get check-ins for the current week
   */
  async getWeekCheckIns(goalId: string): Promise<ApiResponse<CheckIn[]>> {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday

    return this.getCheckIns(goalId, {
      startDate: startOfWeek.toISOString().split("T")[0],
      endDate: endOfWeek.toISOString().split("T")[0]
    });
  }

  /**
   * Get check-ins for the current month
   */
  async getMonthCheckIns(
    goalId: string,
    year?: number,
    month?: number
  ): Promise<ApiResponse<CheckIn[]>> {
    const now = new Date();
    const targetYear = year ?? now.getFullYear();
    const targetMonth = month ?? now.getMonth() + 1;

    const startDate = `${targetYear}-${String(targetMonth).padStart(2, "0")}-01`;
    const lastDay = new Date(targetYear, targetMonth, 0).getDate();
    const endDate = `${targetYear}-${String(targetMonth).padStart(2, "0")}-${lastDay}`;

    return this.getCheckIns(goalId, { startDate, endDate });
  }

  /**
   * Get a single check-in by ID
   */
  async getCheckIn(checkInId: string): Promise<ApiResponse<CheckIn>> {
    return this.get<CheckIn>(`/check-ins/${checkInId}`);
  }

  /**
   * Update an existing check-in
   */
  async updateCheckIn(
    checkInId: string,
    data: Partial<CreateCheckInRequest>
  ): Promise<ApiResponse<CheckIn>> {
    return this.put<CheckIn>(`/check-ins/${checkInId}`, data);
  }

  /**
   * Delete a check-in
   */
  async deleteCheckIn(checkInId: string): Promise<ApiResponse<void>> {
    return this.delete(`/check-ins/${checkInId}`);
  }

  /**
   * Get check-in stats for a goal or all goals
   */
  async getCheckInStats(goalId?: string): Promise<ApiResponse<CheckInStats>> {
    const params = goalId ? `?goal_id=${goalId}` : "";
    return this.get<CheckInStats>(`/check-ins/stats${params}`);
  }

  /**
   * Get check-in calendar data for a specific month
   */
  async getCheckInCalendar(
    year: number,
    month: number,
    goalId?: string
  ): Promise<ApiResponse<any>> {
    const params = new URLSearchParams();
    params.append("year", year.toString());
    params.append("month", month.toString());
    if (goalId) params.append("goal_id", goalId);
    return this.get(`/check-ins/calendar?${params.toString()}`);
  }

  /**
   * Get check-ins by date range
   */
  async getCheckInsByDateRange(
    startDate: string,
    endDate: string,
    goalId?: string
  ): Promise<ApiResponse<CheckIn[]>> {
    return this.getCheckIns(goalId, { startDate, endDate });
  }

  /**
   * Get today's check-ins for all goals
   */
  async getTodayCheckIns(): Promise<ApiResponse<CheckIn[]>> {
    return this.get<CheckIn[]>("/check-ins/today");
  }

  /**
   * Get streak data for a goal or all goals
   */
  async getStreakData(goalId?: string): Promise<ApiResponse<StreakData>> {
    const params = goalId ? `?goal_id=${goalId}` : "";
    return this.get<StreakData>(`/check-ins/streak${params}`);
  }

  /**
   * Bulk create check-ins
   */
  async bulkCreateCheckIns(checkIns: CreateCheckInRequest[]): Promise<ApiResponse<CheckIn[]>> {
    return this.post<CheckIn[]>("/check-ins/bulk", { check_ins: checkIns });
  }

  /**
   * Get mood trends for a goal
   */
  async getMoodTrends(goalId?: string, days: number = 30): Promise<ApiResponse<MoodTrend[]>> {
    const params = new URLSearchParams();
    if (goalId) params.append("goal_id", goalId);
    params.append("days", days.toString());
    return this.get<MoodTrend[]>(`/check-ins/mood-trends?${params.toString()}`);
  }
}

/**
 * Check-in statistics
 */
export interface CheckInStats {
  total_check_ins: number;
  completed_check_ins: number;
  completion_rate: number;
  current_streak: number;
  longest_streak: number;
  checkins_last_7d?: number;
  checkins_last_30d?: number;
  most_productive_day?: string;
  most_productive_time?: string;
}

/**
 * Streak data
 */
export interface StreakData {
  current_streak: number;
  longest_streak: number;
  last_check_in_date?: string;
}

/**
 * Mood trend data
 */
export interface MoodTrend {
  date: string;
  mood: CheckInMood;
  count: number;
}

/**
 * Update check-in request
 */
export interface UpdateCheckInRequest {
  completed?: boolean;
  is_rest_day?: boolean;
  mood?: CheckInMood;
  skip_reason?: SkipReason;
  note?: string;
}

// Export singleton instance
export const checkInsService = new CheckInsService();
