import { BaseApiService, ApiResponse } from "./base";
import { Goal } from "./goals";

// Types for the home dashboard API

export interface PendingCheckIn {
  type: "goal";
  data: {
    id?: string;
    goal_id?: string;
    check_in_date: string;
    is_checked_in: boolean;
    notes?: string;
    mood?: string;
    photo_url?: string;
  };
  item: Goal;
}

export interface HomeDashboardResponse {
  today_pending_checkins: PendingCheckIn[];
  current_streak: number;
}

class HomeService extends BaseApiService {
  /**
   * Get combined home dashboard data
   * Includes pending check-ins and current streak
   */
  async getDashboard(timezone: string = "UTC"): Promise<ApiResponse<HomeDashboardResponse>> {
    return this.get<HomeDashboardResponse>(
      `/home/dashboard?timezone=${encodeURIComponent(timezone)}`
    );
  }
}

export const homeService = new HomeService();
