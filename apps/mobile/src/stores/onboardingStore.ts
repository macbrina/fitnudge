import { create } from "zustand";
import { logger } from "@/services/logger";
import { onboardingApi } from "@/services/api/onboarding";
import { FitnessProfile } from "@/types/user";

interface OnboardingState {
  // Profile data
  biological_sex: string; // 'male', 'female', 'prefer_not_to_say'
  fitness_level: string;
  primary_goal: string;
  current_frequency: string;
  preferred_location: string;
  available_time: string;
  motivation_style: string;
  biggest_challenge: string;
  available_equipment: string[];

  // State
  isSubmitting: boolean;
  isCompleted: boolean;
  hasFitnessProfile: boolean | null; // null = not checked yet, true/false = checked
  error: string | null;

  // Actions
  setBiologicalSex: (sex: string) => void;
  setFitnessLevel: (level: string) => void;
  setPrimaryGoal: (goal: string) => void;
  setCurrentFrequency: (frequency: string) => void;
  setPreferredLocation: (location: string) => void;
  setAvailableTime: (time: string) => void;
  setMotivationStyle: (style: string) => void;
  setBiggestChallenge: (challenge: string) => void;
  setAvailableEquipment: (equipment: string[]) => void;
  loadProfile: () => Promise<boolean>; // Returns true if profile exists, false otherwise
  checkHasFitnessProfile: () => Promise<boolean>; // Quick check without loading full profile
  submitProfile: () => Promise<void>;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  // Initial state
  biological_sex: "",
  fitness_level: "",
  primary_goal: "",
  current_frequency: "",
  preferred_location: "",
  available_time: "",
  motivation_style: "",
  biggest_challenge: "",
  available_equipment: [],
  isSubmitting: false,
  isCompleted: false,
  hasFitnessProfile: null, // null = not checked yet
  error: null,

  // Actions
  setBiologicalSex: (sex: string) => {
    set({ biological_sex: sex });
  },

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

  setAvailableEquipment: (equipment: string[]) => {
    set({ available_equipment: equipment });
  },

  loadProfile: async () => {
    try {
      const profile = await onboardingApi.getProfile();

      if (profile) {
        // Populate store with existing profile data
        set({
          biological_sex: profile.biological_sex || "",
          fitness_level: profile.fitness_level || "",
          primary_goal: profile.primary_goal || "",
          current_frequency: profile.current_frequency || "",
          preferred_location: profile.preferred_location || "",
          available_time: profile.available_time || "",
          motivation_style: profile.motivation_style || "",
          biggest_challenge: profile.biggest_challenge || "",
          available_equipment: profile.available_equipment || [],
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
    // biological_sex is optional (user can choose 'prefer_not_to_say' or skip)
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
      (field) => !state[field as keyof typeof state],
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
        biological_sex: state.biological_sex || undefined, // Optional field
        fitness_level: state.fitness_level,
        primary_goal: state.primary_goal,
        current_frequency: state.current_frequency,
        preferred_location: state.preferred_location,
        available_time: state.available_time,
        motivation_style: state.motivation_style,
        biggest_challenge: state.biggest_challenge,
        available_equipment: state.available_equipment,
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
      biological_sex: "",
      fitness_level: "",
      primary_goal: "",
      current_frequency: "",
      preferred_location: "",
      available_time: "",
      motivation_style: "",
      biggest_challenge: "",
      available_equipment: [],
      isSubmitting: false,
      isCompleted: false,
      hasFitnessProfile: null,
      error: null,
    });
  },
}));
