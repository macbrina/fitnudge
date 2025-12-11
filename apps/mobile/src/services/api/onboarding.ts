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
  title: string;
  description: string;
  category: string;
  frequency: string;
  target_days?: number;
  days_of_week?: number[];
  reminder_times: string[];
  match_reason?: string;
  // Goal type fields
  goal_type?: "habit" | "time_challenge" | "target_challenge";
  duration_days?: number; // For time_challenge
  target_checkins?: number; // For target_challenge
}

export type SuggestedGoalsStatus =
  | "not_started"
  | "pending"
  | "ready"
  | "failed";

export interface SuggestedGoalsStatusResponse {
  status: SuggestedGoalsStatus;
  goals?: SuggestedGoal[];
  error?: string;
  updated_at?: string;
  regeneration_count?: number;
  goal_type?: "habit" | "time_challenge" | "target_challenge" | "mixed";
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
   * Trigger background generation of suggested goals.
   * @param goalType - Type of goals to generate: "habit" (default), "time_challenge", "target_challenge", or "mixed"
   */
  async requestSuggestedGoals(
    goalType:
      | "habit"
      | "time_challenge"
      | "target_challenge"
      | "mixed" = "habit"
  ): Promise<SuggestedGoalsStatusResponse> {
    try {
      const response = await this.post<SuggestedGoalsStatusResponse>(
        ROUTES.ONBOARDING.SUGGESTED_GOALS,
        { goal_type: goalType }
      );
      return response.data!;
    } catch (error) {
      logger.error("Failed to request suggested goals generation", {
        error: error instanceof Error ? error.message : String(error),
        goalType,
      });
      throw error;
    }
  }

  /**
   * Fetch the current status (and payload, if ready) of suggested goals.
   */
  async getSuggestedGoalsStatus(): Promise<SuggestedGoalsStatusResponse> {
    try {
      const response = await this.get<SuggestedGoalsStatusResponse>(
        ROUTES.ONBOARDING.SUGGESTED_GOALS
      );
      return response.data!;
    } catch (error) {
      logger.error("Failed to fetch suggested goals status", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Regenerate suggested goals for the current user.
   * This increments the regeneration count and generates new suggestions.
   * Free users: Limited to 1 regeneration
   * Starter+: Unlimited regenerations
   * @param goalType - Type of goals to generate: "habit" (default), "time_challenge", "target_challenge", or "mixed"
   */
  async regenerateSuggestedGoals(
    goalType:
      | "habit"
      | "time_challenge"
      | "target_challenge"
      | "mixed" = "habit"
  ): Promise<SuggestedGoalsStatusResponse> {
    try {
      const response = await this.put<SuggestedGoalsStatusResponse>(
        `${ROUTES.ONBOARDING.SUGGESTED_GOALS}/regenerate`,
        { goal_type: goalType }
      );
      return response.data!;
    } catch (error) {
      // Check if it's a 403 (regeneration limit reached) - this is expected behavior
      const is403 =
        error instanceof Error &&
        (error.message.includes("403") ||
          error.message.includes("Upgrade") ||
          error.message.includes("AI goal generations"));

      if (!is403) {
        // Expected limit-reached scenario - just log info, don't log as error
        logger.error("Failed to regenerate suggested goals", {
          error: error instanceof Error ? error.message : String(error),
          goalType,
        });
      }
      throw error;
    }
  }
}

// Export singleton instance
export const onboardingApi = new OnboardingApiService();
