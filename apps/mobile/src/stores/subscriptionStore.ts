import { create } from "zustand";
import {
  subscriptionsService,
  SubscriptionResponse,
  FeaturesResponse,
} from "@/services/api/subscriptions";
import { logger } from "@/services/logger";

interface SubscriptionState {
  // User's subscription info
  subscription: SubscriptionResponse | null;
  features: FeaturesResponse | null;

  // Loading & error states (separate for parallel fetching)
  isLoadingSubscription: boolean;
  isLoadingFeatures: boolean;
  isLoading: boolean; // Combined loading state for convenience
  error: string | null;
  lastFetchedSubscription: number | null;
  lastFetchedFeatures: number | null;
  lastFetched: number | null; // Combined last fetched for backward compatibility

  // Actions
  fetchSubscription: () => Promise<void>;
  fetchFeatures: () => Promise<void>;
  refresh: () => Promise<void>; // Fetch both subscription and features

  // Helper methods
  getPlan: () => string; // 'free', 'starter', 'pro', 'elite'
  getTier: () => number; // 0, 1, 2, 3
  hasFeature: (featureKey: string) => boolean;
  getFeatureValue: (featureKey: string) => any;
  canCreateGoal: (currentGoalCount: number) => boolean;
  getGoalLimit: () => number | null; // null means unlimited (goals user can CREATE)
  getActiveGoalLimit: () => number | null; // number of goals that can be ACTIVE simultaneously (null = unlimited)

  // Challenge limits
  getChallengeLimit: () => number | null; // null = unlimited, 0 = disabled
  canParticipateInChallenge: (currentCount: number) => boolean;

  clearError: () => void;
  reset: () => void;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  // Initial state
  subscription: null,
  features: null,
  isLoadingSubscription: false,
  isLoadingFeatures: false,
  isLoading: false,
  error: null,
  lastFetchedSubscription: null,
  lastFetchedFeatures: null,
  lastFetched: null,

  // Actions
  fetchSubscription: async () => {
    const { lastFetchedSubscription, isLoadingSubscription } = get();

    // Check if we have recent data
    if (
      lastFetchedSubscription &&
      Date.now() - lastFetchedSubscription < CACHE_DURATION
    ) {
      return;
    }

    // Prevent multiple simultaneous requests for subscription
    if (isLoadingSubscription) {
      return;
    }

    set({ isLoadingSubscription: true, isLoading: true, error: null });

    try {
      const response = await subscriptionsService.getMySubscription();

      if (response.data) {
        const now = Date.now();
        set((state) => ({
          subscription: response.data!,
          isLoadingSubscription: false,
          isLoading: state.isLoadingFeatures, // Only false if features is also done
          error: null,
          lastFetchedSubscription: now,
          lastFetched: now,
        }));
      } else {
        const errorMessage =
          response.error ||
          response.message ||
          `Failed to fetch subscription${response.status ? ` (status: ${response.status})` : ""}`;
        throw new Error(errorMessage);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("Failed to fetch subscription", {
        error: errorMessage,
      });

      set((state) => ({
        isLoadingSubscription: false,
        isLoading: state.isLoadingFeatures, // Only false if features is also done
        error: errorMessage,
      }));
    }
  },

  fetchFeatures: async () => {
    const { lastFetchedFeatures, isLoadingFeatures } = get();

    // Check if we have recent data
    if (
      lastFetchedFeatures &&
      Date.now() - lastFetchedFeatures < CACHE_DURATION
    ) {
      return;
    }

    // Prevent multiple simultaneous requests for features
    if (isLoadingFeatures) {
      return;
    }

    set({ isLoadingFeatures: true, isLoading: true, error: null });

    try {
      const response = await subscriptionsService.getAvailableFeatures();

      if (response.data) {
        const now = Date.now();
        set((state) => ({
          features: response.data!,
          isLoadingFeatures: false,
          isLoading: state.isLoadingSubscription, // Only false if subscription is also done
          error: null,
          lastFetchedFeatures: now,
          lastFetched: now,
        }));
      } else {
        const errorMessage =
          response.error ||
          response.message ||
          `Failed to fetch features${response.status ? ` (status: ${response.status})` : ""}`;
        throw new Error(errorMessage);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("Failed to fetch features", {
        error: errorMessage,
      });

      set((state) => ({
        isLoadingFeatures: false,
        isLoading: state.isLoadingSubscription, // Only false if subscription is also done
        error: errorMessage,
      }));
    }
  },

  refresh: async () => {
    // Fetch both subscription and features, bypassing cache
    const now = Date.now();
    set({
      isLoading: true,
      isLoadingSubscription: true,
      isLoadingFeatures: true,
      error: null,
      lastFetchedSubscription: null,
      lastFetchedFeatures: null,
      lastFetched: null,
    });

    try {
      // Fetch both in parallel
      const [subscriptionResponse, featuresResponse] = await Promise.all([
        subscriptionsService.getMySubscription(),
        subscriptionsService.getAvailableFeatures(),
      ]);

      if (subscriptionResponse.data && featuresResponse.data) {
        set({
          subscription: subscriptionResponse.data,
          features: featuresResponse.data,
          isLoading: false,
          isLoadingSubscription: false,
          isLoadingFeatures: false,
          error: null,
          lastFetchedSubscription: now,
          lastFetchedFeatures: now,
          lastFetched: now,
        });
      } else {
        // Handle partial success or failure
        const errors = [];
        if (!subscriptionResponse.data) {
          errors.push("subscription");
        }
        if (!featuresResponse.data) {
          errors.push("features");
        }

        // Update state with what we got
        set({
          subscription: subscriptionResponse.data || null,
          features: featuresResponse.data || null,
          isLoading: false,
          isLoadingSubscription: false,
          isLoadingFeatures: false,
          lastFetchedSubscription: subscriptionResponse.data ? now : null,
          lastFetchedFeatures: featuresResponse.data ? now : null,
          lastFetched:
            subscriptionResponse.data || featuresResponse.data ? now : null,
        });

        throw new Error(`Failed to fetch: ${errors.join(", ")}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("Failed to refresh subscription", {
        error: errorMessage,
      });

      set({
        isLoading: false,
        isLoadingSubscription: false,
        isLoadingFeatures: false,
        error: errorMessage,
      });
    }
  },

  // Helper methods
  getPlan: () => {
    const { subscription, features } = get();
    // Prefer features.plan (from tier-based system) over subscription.plan
    return features?.plan || subscription?.plan || "free";
  },

  getTier: () => {
    const { features } = get();
    return features?.tier ?? 0;
  },

  hasFeature: (featureKey: string) => {
    const { features } = get();
    if (!features) return false;

    // Check if feature exists in features dict
    const featureValue = features.features[featureKey];

    // If it's a boolean, return it directly
    if (typeof featureValue === "boolean") {
      return featureValue;
    }

    // If it's a number or other value, feature exists
    return featureValue !== undefined && featureValue !== null;
  },

  getFeatureValue: (featureKey: string) => {
    const { features } = get();
    if (!features) return null;

    // Find the feature in features_list to get the actual numeric value
    // features.features[key] only gives boolean (has access), not the value
    const feature = features.features_list.find(
      (f) => f.feature_key === featureKey
    );

    if (feature) {
      // Return the actual feature_value (could be number, null for unlimited, etc.)
      return feature.feature_value;
    }

    // Feature not found - return null (which typically means unlimited)
    return null;
  },

  canCreateGoal: (currentGoalCount: number) => {
    const goalLimit = get().getGoalLimit();

    // If goal_limit is null, it means unlimited
    if (goalLimit === null) {
      return true;
    }

    return currentGoalCount < goalLimit;
  },

  getGoalLimit: () => {
    const { features } = get();
    if (!features) return 1; // Features not loaded yet, default to most restrictive

    // Find the "goals" feature in features_list
    // feature_value = null means unlimited, otherwise it's the limit number
    const goalsFeature = features.features_list.find(
      (f) => f.feature_key === "goals"
    );

    if (goalsFeature) {
      // null = unlimited, number = that's the limit
      return goalsFeature.feature_value;
    }

    // Fallback if "goals" feature not found (shouldn't happen with proper DB setup)
    return 1;
  },

  // Get the limit for how many goals can be ACTIVE simultaneously
  getActiveGoalLimit: () => {
    const { features } = get();
    if (!features) return 1; // Features not loaded yet, default to most restrictive

    // Find the "active_goal_limit" feature in features_list
    const activeGoalFeature = features.features_list.find(
      (f) => f.feature_key === "active_goal_limit"
    );

    if (activeGoalFeature) {
      // null = unlimited, number = that's the limit
      return activeGoalFeature.feature_value;
    }

    // Fallback if feature not found
    return 1;
  },

  // Get the limit for challenges (created + joined)
  getChallengeLimit: () => {
    const { features } = get();
    if (!features) return 1; // Default to most restrictive

    const challengeFeature = features.features_list.find(
      (f) => f.feature_key === "challenge_limit"
    );

    if (challengeFeature) {
      // null = unlimited, 0 = disabled, number = limit
      return challengeFeature.feature_value;
    }

    return 1;
  },

  canParticipateInChallenge: (currentCount: number) => {
    const limit = get().getChallengeLimit();

    // null = unlimited
    if (limit === null) return true;
    // 0 = feature disabled
    if (limit === 0) return false;

    return currentCount < limit;
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set({
      subscription: null,
      features: null,
      isLoading: false,
      isLoadingSubscription: false,
      isLoadingFeatures: false,
      error: null,
      lastFetched: null,
      lastFetchedSubscription: null,
      lastFetchedFeatures: null,
    });
  },
}));
