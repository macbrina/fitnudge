import { BaseApiService, ApiResponse } from "./base";
import { ROUTES } from "@/lib/routes";
import { logger } from "@/services/logger";

export interface FitnessProfileRequest {
  fitness_level: string;
  primary_goal: string;
  current_frequency: string;
  preferred_location: string;
  available_time: string;
  motivation_style: string;
  biggest_challenge: string;
}

export interface FitnessProfileResponse {
  id: string;
  user_id: string;
  fitness_level: string;
  primary_goal: string;
  current_frequency: string;
  preferred_location: string;
  available_time: string;
  motivation_style: string;
  biggest_challenge: string;
  completed_at: string;
}

export interface SuggestedGoal {
  id: string;
  title: string; // Changed from 'name' to match goals table
  description: string;
  category: string;
  frequency: string;
  target_days?: number;
  reminder_times: string[];
  match_reason: string;
}

class OnboardingApiService extends BaseApiService {
  /**
   * Save user's fitness profile
   */
  async saveProfile(
    profileData: FitnessProfileRequest
  ): Promise<FitnessProfileResponse> {
    try {
      // Saving profile - tracked via PostHog in component

      const response = await this.post<FitnessProfileResponse>(
        ROUTES.ONBOARDING.PROFILE,
        profileData
      );

      // Profile saved successfully - tracked via PostHog in component
      return response.data!;
    } catch (error) {
      logger.error("Failed to save fitness profile", {
        error: error instanceof Error ? error.message : String(error),
        profileData,
      });
      throw error;
    }
  }

  /**
   * Get user's fitness profile
   */
  async getProfile(): Promise<FitnessProfileResponse> {
    try {
      // Fetching profile - tracked via PostHog in component

      const response = await this.get<FitnessProfileResponse>(
        ROUTES.ONBOARDING.PROFILE
      );

      // Profile fetched successfully - tracked via PostHog in component
      return response.data!;
    } catch (error) {
      logger.error("Failed to fetch fitness profile", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get AI-suggested goals based on user profile
   * Uses extended timeout (60s) to allow for AI generation
   */
  async getSuggestedGoals(): Promise<ApiResponse<SuggestedGoal[]>> {
    try {
      // Fetching goals - tracked via PostHog in component
      // The base timeout (60s) is sufficient for AI generation
      const response = await this.get<SuggestedGoal[]>(
        ROUTES.ONBOARDING.SUGGESTED_GOALS
      );

      // Goals fetched successfully - tracked via PostHog in component
      return response;
    } catch (error) {
      logger.error("Failed to fetch suggested goals", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

// Export singleton instance
export const onboardingApi = new OnboardingApiService();
