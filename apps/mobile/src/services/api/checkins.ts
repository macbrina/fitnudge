import { BaseApiService, ApiResponse } from "./base";
import { ROUTES } from "@/lib/routes";

// Check-ins Types
export interface CheckIn {
  id: string;
  goal_id: string;
  user_id: string;
  date: string;
  completed: boolean;
  reflection?: string;
  mood?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCheckInRequest {
  goal_id: string;
  date: string;
  completed: boolean;
  reflection?: string;
  mood?: number;
}

export interface UpdateCheckInRequest {
  completed?: boolean;
  reflection?: string;
  mood?: number;
}

export interface CheckInStats {
  total_check_ins: number;
  completed_check_ins: number;
  current_streak: number;
  longest_streak: number;
  completion_rate: number;
  average_mood: number;
  most_productive_day: string;
  most_productive_time: string;
}

export interface CheckInCalendar {
  date: string;
  completed: boolean;
  mood?: number;
  goal_id: string;
  goal_title: string;
}

// Check-ins Service
export class CheckInsService extends BaseApiService {
  async getCheckIns(goalId?: string): Promise<ApiResponse<CheckIn[]>> {
    const endpoint = goalId
      ? ROUTES.GOALS.CHECKINS(goalId)
      : ROUTES.CHECKINS.LIST;
    return this.get<CheckIn[]>(endpoint);
  }

  async getCheckIn(checkInId: string): Promise<ApiResponse<CheckIn>> {
    return this.get<CheckIn>(ROUTES.CHECKINS.GET(checkInId));
  }

  async createCheckIn(
    checkIn: CreateCheckInRequest
  ): Promise<ApiResponse<CheckIn>> {
    return this.post<CheckIn>(ROUTES.CHECKINS.CREATE, checkIn);
  }

  async updateCheckIn(
    checkInId: string,
    updates: UpdateCheckInRequest
  ): Promise<ApiResponse<CheckIn>> {
    return this.put<CheckIn>(ROUTES.CHECKINS.UPDATE(checkInId), updates);
  }

  async deleteCheckIn(checkInId: string): Promise<ApiResponse> {
    return this.delete(ROUTES.CHECKINS.DELETE(checkInId));
  }

  async getCheckInStats(goalId?: string): Promise<ApiResponse<CheckInStats>> {
    const endpoint = goalId
      ? ROUTES.CHECKINS.STATS_BY_GOAL(goalId)
      : ROUTES.CHECKINS.STATS;
    return this.get<CheckInStats>(endpoint);
  }

  async getCheckInCalendar(
    year: number,
    month: number,
    goalId?: string
  ): Promise<ApiResponse<CheckInCalendar[]>> {
    const params = new URLSearchParams({
      year: year.toString(),
      month: month.toString(),
    });

    if (goalId) {
      params.append("goal_id", goalId);
    }

    return this.get<CheckInCalendar[]>(
      `${ROUTES.CHECKINS.CALENDAR}?${params.toString()}`
    );
  }

  async getCheckInsByDateRange(
    startDate: string,
    endDate: string,
    goalId?: string
  ): Promise<ApiResponse<CheckIn[]>> {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    });

    if (goalId) {
      params.append("goal_id", goalId);
    }

    return this.get<CheckIn[]>(
      `${ROUTES.CHECKINS.BY_DATE_RANGE}?${params.toString()}`
    );
  }

  async getTodayCheckIns(): Promise<ApiResponse<CheckIn[]>> {
    return this.get<CheckIn[]>(ROUTES.CHECKINS.TODAY);
  }

  async getStreakData(goalId?: string): Promise<
    ApiResponse<{
      current_streak: number;
      longest_streak: number;
      streak_dates: string[];
    }>
  > {
    const endpoint = goalId
      ? ROUTES.CHECKINS.STREAK_BY_GOAL(goalId)
      : ROUTES.CHECKINS.STREAK;
    return this.get(endpoint);
  }

  async bulkCreateCheckIns(
    checkIns: CreateCheckInRequest[]
  ): Promise<ApiResponse<CheckIn[]>> {
    return this.post<CheckIn[]>(ROUTES.CHECKINS.BULK_CREATE, {
      check_ins: checkIns,
    });
  }

  async getMoodTrends(
    goalId?: string,
    days: number = 30
  ): Promise<
    ApiResponse<
      {
        date: string;
        average_mood: number;
        check_ins_count: number;
      }[]
    >
  > {
    const params = new URLSearchParams({
      days: days.toString(),
    });

    if (goalId) {
      params.append("goal_id", goalId);
    }

    return this.get(`${ROUTES.CHECKINS.MOOD_TRENDS}?${params.toString()}`);
  }
}

// Export singleton instance
export const checkInsService = new CheckInsService();
