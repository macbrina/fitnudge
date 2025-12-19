import { BaseApiService, ApiResponse } from "./base";
import { Goal } from "./goals";
import { Challenge } from "./challenges";

// Types for the home dashboard API
export interface ActiveItem {
  type: "goal" | "challenge";
  data: Goal | Challenge;
}

export interface PendingCheckIn {
  type: "goal" | "challenge";
  data: {
    id?: string;
    goal_id?: string;
    challenge_id?: string;
    check_in_date: string;
    is_checked_in: boolean;
    notes?: string;
    mood?: string;
    photo_url?: string;
  };
  item: Goal | Challenge;
}

export interface DashboardStats {
  active_count: number;
  current_streak: number;
  total_check_ins: number;
  completion_rate: number;
}

export interface HomeDashboardResponse {
  items: ActiveItem[];
  today_pending_checkins: PendingCheckIn[];
  stats: DashboardStats;
}

class HomeService extends BaseApiService {
  /**
   * Get combined home dashboard data
   * Includes active items, pending check-ins, and stats
   */
  async getDashboard(
    timezone: string = "UTC"
  ): Promise<ApiResponse<HomeDashboardResponse>> {
    return this.get<HomeDashboardResponse>(
      `/home/dashboard?timezone=${encodeURIComponent(timezone)}`
    );
  }
}

export const homeService = new HomeService();
