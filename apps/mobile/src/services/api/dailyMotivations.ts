import { BaseApiService, ApiResponse } from "./base";
import { ROUTES } from "@/lib/routes";

// Daily Motivation Types
export interface DailyMotivation {
  id: string;
  user_id: string;
  message: string;
  background_style: string;
  background_colors: string[]; // Color array for the gradient
  date: string;
  generated_at: string;
  share_count: number;
  created_at: string;
}

// Daily Motivation Service
export class DailyMotivationService extends BaseApiService {
  async getToday(): Promise<ApiResponse<DailyMotivation>> {
    return this.get<DailyMotivation>(ROUTES.DAILY_MOTIVATIONS.TODAY);
  }

  async getList(
    limit: number = 30,
    offset: number = 0
  ): Promise<ApiResponse<DailyMotivation[]>> {
    return this.get<DailyMotivation[]>(
      `${ROUTES.DAILY_MOTIVATIONS.LIST}?limit=${limit}&offset=${offset}`
    );
  }

  async getById(motivationId: string): Promise<ApiResponse<DailyMotivation>> {
    return this.get<DailyMotivation>(
      `${ROUTES.DAILY_MOTIVATIONS.BASE}/${motivationId}`
    );
  }

  async share(
    motivationId: string
  ): Promise<ApiResponse<{ share_count: number }>> {
    return this.post<{ share_count: number }>(
      `${ROUTES.DAILY_MOTIVATIONS.BASE}/${motivationId}/share`,
      {}
    );
  }

  async regenerate(): Promise<ApiResponse<DailyMotivation>> {
    return this.post<DailyMotivation>(ROUTES.DAILY_MOTIVATIONS.REGENERATE, {});
  }
}

// Export singleton instance
export const dailyMotivationService = new DailyMotivationService();
