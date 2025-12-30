import { BaseApiService, ApiResponse } from "./base";
import { ROUTES } from "@/lib/routes";

// Common presets (in milliliters)
export const HYDRATION_PRESETS = {
  glass: 237, // 1 glass = 8 oz = 237 ml
  bottle: 500, // Small bottle = 500 ml (16 oz)
  large_bottle: 750, // Large bottle = 750 ml (25 oz)
  liter: 1000, // 1 liter
} as const;

export interface HydrationLog {
  id: string;
  user_id: string;
  goal_id?: string;
  challenge_id?: string;
  amount_ml: number;
  logged_date: string;
  logged_at: string;
  created_at: string;
}

export interface CreateHydrationLogRequest {
  amount_ml: number;
  logged_date?: string; // Format: YYYY-MM-DD, defaults to today
  goal_id?: string;
  challenge_id?: string;
}

export interface DailyHydrationSummary {
  logged_date: string;
  total_amount_ml: number;
  log_count: number;
  goal_id?: string;
  challenge_id?: string;
  target_ml?: number;
  progress_percentage: number;
}

export interface HydrationPresetsResponse {
  glass_ml: number;
  bottle_ml: number;
  large_bottle_ml: number;
  liter_ml: number;
}

class HydrationLogsService extends BaseApiService {
  /**
   * Get available hydration presets
   */
  async getPresets(): Promise<ApiResponse<HydrationPresetsResponse>> {
    return this.get<HydrationPresetsResponse>(ROUTES.HYDRATION.PRESETS);
  }

  /**
   * Log water intake
   */
  async logHydration(
    data: CreateHydrationLogRequest,
  ): Promise<ApiResponse<HydrationLog>> {
    return this.post<HydrationLog>(ROUTES.HYDRATION.CREATE, data);
  }

  /**
   * Get hydration logs for the current user
   */
  async getHydrationLogs(params?: {
    logged_date?: string;
    goal_id?: string;
    challenge_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<HydrationLog[]>> {
    const queryParams = new URLSearchParams();
    if (params?.logged_date)
      queryParams.append("logged_date", params.logged_date);
    if (params?.goal_id) queryParams.append("goal_id", params.goal_id);
    if (params?.challenge_id)
      queryParams.append("challenge_id", params.challenge_id);
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.offset) queryParams.append("offset", params.offset.toString());

    const url = queryParams.toString()
      ? `${ROUTES.HYDRATION.LIST}?${queryParams.toString()}`
      : ROUTES.HYDRATION.LIST;

    return this.get<HydrationLog[]>(url);
  }

  /**
   * Get daily hydration summary
   */
  async getDailyHydrationSummary(
    date: string,
    params?: { goal_id?: string; challenge_id?: string },
  ): Promise<ApiResponse<DailyHydrationSummary>> {
    const queryParams = new URLSearchParams();
    if (params?.goal_id) queryParams.append("goal_id", params.goal_id);
    if (params?.challenge_id)
      queryParams.append("challenge_id", params.challenge_id);

    const url = queryParams.toString()
      ? `${ROUTES.HYDRATION.SUMMARY(date)}?${queryParams.toString()}`
      : ROUTES.HYDRATION.SUMMARY(date);

    return this.get<DailyHydrationSummary>(url);
  }

  /**
   * Delete a hydration log
   */
  async deleteHydrationLog(logId: string): Promise<ApiResponse<void>> {
    return this.delete(ROUTES.HYDRATION.DELETE(logId));
  }

  // Helper methods for quick logging with presets

  /**
   * Log one glass of water (237ml / 8oz)
   */
  async logGlass(
    goalId?: string,
    challengeId?: string,
  ): Promise<ApiResponse<HydrationLog>> {
    return this.logHydration({
      amount_ml: HYDRATION_PRESETS.glass,
      goal_id: goalId,
      challenge_id: challengeId,
    });
  }

  /**
   * Log one bottle of water (500ml / 16oz)
   */
  async logBottle(
    goalId?: string,
    challengeId?: string,
  ): Promise<ApiResponse<HydrationLog>> {
    return this.logHydration({
      amount_ml: HYDRATION_PRESETS.bottle,
      goal_id: goalId,
      challenge_id: challengeId,
    });
  }

  /**
   * Log one large bottle of water (750ml / 25oz)
   */
  async logLargeBottle(
    goalId?: string,
    challengeId?: string,
  ): Promise<ApiResponse<HydrationLog>> {
    return this.logHydration({
      amount_ml: HYDRATION_PRESETS.large_bottle,
      goal_id: goalId,
      challenge_id: challengeId,
    });
  }
}

export const hydrationLogsService = new HydrationLogsService();
