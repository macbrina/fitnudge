import { BaseApiService, ApiResponse } from "./base";
import { ROUTES } from "@/lib/routes";
import { logger } from "@/services/logger";

// V2 Onboarding Complete Request
export interface OnboardingCompleteRequest {
  name: string;
  motivation_style: "supportive" | "tough_love" | "calm";
  morning_motivation_enabled?: boolean;
  morning_motivation_time?: string; // HH:MM format
}

export interface OnboardingCompleteResponse {
  success: boolean;
  user_id: string;
  first_name: string;
  motivation_style: string;
  morning_motivation_enabled: boolean;
  onboarding_completed: boolean;
}

class OnboardingApiService extends BaseApiService {
  /**
   * Complete V2 onboarding - saves user preferences and marks onboarding as complete.
   * This sets onboarding_completed_at on the user record.
   */
  async completeOnboarding(data: OnboardingCompleteRequest): Promise<OnboardingCompleteResponse> {
    try {
      const response = await this.post<OnboardingCompleteResponse>(
        ROUTES.ONBOARDING.COMPLETE,
        data
      );
      return response.data!;
    } catch (error) {
      logger.error("Failed to complete onboarding", {
        error: error instanceof Error ? error.message : String(error),
        data
      });
      throw error;
    }
  }
}

// Export singleton instance
export const onboardingApi = new OnboardingApiService();
