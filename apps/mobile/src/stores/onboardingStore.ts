import { create } from "zustand";
import { logger } from "@/services/logger";
import { onboardingApi } from "@/services/api/onboarding";
import { FitnessProfile } from "@/types/user";

interface OnboardingState {
  // Profile data
  fitness_level: string;
  primary_goal: string;
  current_frequency: string;
  preferred_location: string;
  available_time: string;
  motivation_style: string;
  biggest_challenge: string;

  // State
  isSubmitting: boolean;
  isCompleted: boolean;
  hasFitnessProfile: boolean | null; // null = not checked yet, true/false = checked
  error: string | null;

  // Actions
  setFitnessLevel: (level: string) => void;
  setPrimaryGoal: (goal: string) => void;
  setCurrentFrequency: (frequency: string) => void;
  setPreferredLocation: (location: string) => void;
  setAvailableTime: (time: string) => void;
  setMotivationStyle: (style: string) => void;
  setBiggestChallenge: (challenge: string) => void;
  loadProfile: () => Promise<boolean>; // Returns true if profile exists, false otherwise
  checkHasFitnessProfile: () => Promise<boolean>; // Quick check without loading full profile
  submitProfile: () => Promise<void>;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  // Initial state
  fitness_level: "",
  primary_goal: "",
  current_frequency: "",
  preferred_location: "",
  available_time: "",
  motivation_style: "",
  biggest_challenge: "",
  isSubmitting: false,
  isCompleted: false,
  hasFitnessProfile: null, // null = not checked yet
  error: null,

  // Actions
  setFitnessLevel: (level: string) => {
    set({ fitness_level: level });
  },

  setPrimaryGoal: (goal: string) => {
    set({ primary_goal: goal });
  },

  setCurrentFrequency: (frequency: string) => {
    set({ current_frequency: frequency });
  },

  setPreferredLocation: (location: string) => {
    set({ preferred_location: location });
  },

  setAvailableTime: (time: string) => {
    set({ available_time: time });
  },

  setMotivationStyle: (style: string) => {
    set({ motivation_style: style });
  },

  setBiggestChallenge: (challenge: string) => {
    set({ biggest_challenge: challenge });
  },

  loadProfile: async () => {
    try {
      const profile = await onboardingApi.getProfile();

      if (profile) {
        // Populate store with existing profile data
        set({
          fitness_level: profile.fitness_level || "",
          primary_goal: profile.primary_goal || "",
          current_frequency: profile.current_frequency || "",
          preferred_location: profile.preferred_location || "",
          available_time: profile.available_time || "",
          motivation_style: profile.motivation_style || "",
          biggest_challenge: profile.biggest_challenge || "",
          isCompleted: true, // Profile exists, so it's been completed
          hasFitnessProfile: true,
        });

        return true; // Profile exists
      }

      set({ hasFitnessProfile: false });
      return false; // No profile found
    } catch (error) {
      // Profile doesn't exist or error fetching - not an error state
      // Just means user needs to complete onboarding
      const errorMessage =
        error instanceof Error ? error.message : "Failed to load profile";

      // Only log if it's not a 404 (not found)
      if (
        !errorMessage.includes("404") &&
        !errorMessage.includes("not found")
      ) {
        logger.error("Failed to load fitness profile", {
          error: errorMessage,
        });
      }

      set({ hasFitnessProfile: false });
      return false; // No profile exists
    }
  },

  checkHasFitnessProfile: async () => {
    // If already checked, return cached value
    const currentState = get().hasFitnessProfile;
    if (currentState !== null) {
      return currentState;
    }

    // Otherwise, load profile to check
    return get().loadProfile();
  },

  submitProfile: async () => {
    const state = get();

    // Validate required fields
    const requiredFields = [
      "fitness_level",
      "primary_goal",
      "current_frequency",
      "preferred_location",
      "available_time",
      "motivation_style",
      "biggest_challenge",
    ];

    const missingFields = requiredFields.filter(
      (field) => !state[field as keyof typeof state]
    );

    if (missingFields.length > 0) {
      const error = `Missing required fields: ${missingFields.join(", ")}`;
      logger.error("Profile validation failed", { missingFields });
      set({ error, isSubmitting: false });
      throw new Error(error);
    }

    set({ isSubmitting: true, error: null });

    try {
      const profileData: FitnessProfile = {
        fitness_level: state.fitness_level,
        primary_goal: state.primary_goal,
        current_frequency: state.current_frequency,
        preferred_location: state.preferred_location,
        available_time: state.available_time,
        motivation_style: state.motivation_style,
        biggest_challenge: state.biggest_challenge,
      };

      // Submitting profile - tracked via PostHog in component

      await onboardingApi.saveProfile(profileData);

      set({
        isCompleted: true,
        isSubmitting: false,
        error: null,
      });

      // Profile submitted successfully - tracked via PostHog in component
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to submit profile";

      logger.error("Failed to submit fitness profile", {
        error: errorMessage,
        profileData: {
          fitness_level: state.fitness_level,
          primary_goal: state.primary_goal,
          current_frequency: state.current_frequency,
          preferred_location: state.preferred_location,
          available_time: state.available_time,
          motivation_style: state.motivation_style,
          biggest_challenge: state.biggest_challenge,
        },
      });

      set({
        error: errorMessage,
        isSubmitting: false,
      });

      throw error;
    }
  },

  reset: () => {
    set({
      fitness_level: "",
      primary_goal: "",
      current_frequency: "",
      preferred_location: "",
      available_time: "",
      motivation_style: "",
      biggest_challenge: "",
      isSubmitting: false,
      isCompleted: false,
      hasFitnessProfile: null,
      error: null,
    });
  },
}));
