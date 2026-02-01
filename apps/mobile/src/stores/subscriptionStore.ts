import { create } from "zustand";
import {
  subscriptionsService,
  SubscriptionResponse,
  FeaturesResponse,
  SubscriptionHistoryResponse
} from "@/services/api/subscriptions";
import { usePricingStore } from "@/stores/pricingStore";
import { logger } from "@/services/logger";

// 2-tier system: free + premium
type SubscriptionTier = "free" | "premium";

interface SubscriptionState {
  // User's subscription info
  subscription: SubscriptionResponse | null;
  features: FeaturesResponse | null;
  history: SubscriptionHistoryResponse | null;

  // Optimistic plan override (used after purchase before API confirms)
  optimisticPlan: SubscriptionTier | null;

  // Modal state (centralized subscription modal)
  isModalVisible: boolean;
  openModal: () => void;
  closeModal: () => void;

  // Loading & error states (separate for parallel fetching)
  isLoadingSubscription: boolean;
  isLoadingFeatures: boolean;
  isLoadingHistory: boolean;
  isLoading: boolean; // Combined loading state for convenience
  error: string | null;
  lastFetchedSubscription: number | null;
  lastFetchedFeatures: number | null;
  lastFetchedHistory: number | null;
  lastFetched: number | null; // Combined last fetched for backward compatibility
  lastSubscriptionRefresh: number | null; // Timestamp when subscription was refreshed (used to skip prefetch)

  // Actions
  fetchSubscription: () => Promise<void>;
  fetchFeatures: () => Promise<void>;
  fetchHistory: () => Promise<void>;
  refresh: () => Promise<void>; // Fetch subscription, features, and history

  // Optimistic update for immediate UI feedback after purchase
  setOptimisticPlan: (plan: SubscriptionTier) => void;
  clearOptimisticPlan: () => void;
  setLastSubscriptionRefresh: () => void; // Set timestamp to skip prefetch after purchase

  // Helper methods
  getPlan: () => string; // 'free' or 'premium'
  getTier: () => number; // 0 (free) or 1 (premium)
  hasFeature: (featureKey: string) => boolean;
  getFeatureValue: (featureKey: string) => any;
  canCreateGoal: (currentGoalCount: number) => boolean;
  getGoalLimit: () => number | null; // null means unlimited (goals user can CREATE)
  getActiveGoalLimit: () => number | null; // number of goals that can be ACTIVE simultaneously (null = unlimited)

  // Partner / accountability limits
  hasPartnerFeature: () => boolean; // has accountability_partner_limit
  getPartnerLimit: () => number | null; // accountability_partner_limit (null = unlimited, 0 = disabled)
  canSendPartnerRequest: (acceptedCount: number, pendingSentCount: number) => boolean;

  // Subscription history
  hasEverSubscribed: () => boolean; // Check if user has ever had a paid subscription

  clearError: () => void;
  reset: () => void;

  /** Clear fetch cache so next refresh/fetch will run. Used after offline retry. */
  clearFetchCache: () => void;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Tier mapping for optimistic updates (2-tier system)
const PLAN_TIERS: Record<SubscriptionTier, number> = {
  free: 0,
  premium: 1
};

/**
 * Helper to get feature value from pricingStore (V2 - Direct Plan Matching).
 *
 * V2 Simplified: Features are tied directly to plan_id (free/premium).
 * No tier inheritance - just direct plan matching.
 *
 * Logic:
 * - Look for feature directly on the user's plan
 * - If found and enabled: return feature_value (number for limits, null for unlimited)
 * - If not found or disabled: return false (no access)
 */
const getOptimisticFeatureValue = (
  planId: SubscriptionTier,
  featureKey: string
): number | boolean | null => {
  const pricingStore = usePricingStore.getState();

  // If plans aren't loaded yet, use conservative defaults
  if (pricingStore.plans.length === 0) {
    if (planId === "free") {
      // V2 free tier defaults (from 005_seed_data.sql)
      switch (featureKey) {
        case "active_goal_limit":
          return 2; // V2: Free users get 2 active goals
        case "accountability_partner_limit":
          return 1; // V2: Free users get 1 accountability partner
        case "ai_coach_chat":
          return 3; // V2: Free users get 3 AI coach messages per day
        case "pattern_detection":
        case "weekly_recap":
        case "advanced_analytics":
        case "adaptive_nudging":
        case "voice_notes":
        case "ai_checkin_response":
          return false; // Premium-only features
        case "daily_checkins":
        case "streak_tracking":
        case "daily_motivation":
        case "basic_stats":
          return true; // Free features enabled
        default:
          return false; // Unknown feature - no access
      }
    }
    // For premium, be optimistic
    return null; // null = unlimited/enabled
  }

  // V2: Direct plan matching - look for feature on user's plan only
  const userPlan = pricingStore.plans.find((p) => p.id.toLowerCase() === planId.toLowerCase());

  if (!userPlan) {
    // Plan not found - be conservative for free, optimistic for premium
    return planId === "free" ? false : null;
  }

  const feature = userPlan.features.find((f) => f.feature_key === featureKey);

  if (!feature) {
    // Feature not on this plan - no access
    return false;
  }

  if (!feature.is_enabled) {
    // Feature is disabled
    return false;
  }

  // Return feature_value (number for limits, null for unlimited/enabled)
  return feature.feature_value;
};

/**
 * Check if user has access to a feature (for optimistic updates).
 * Returns true if user has the feature, false otherwise.
 */
const hasOptimisticFeature = (planId: SubscriptionTier, featureKey: string): boolean => {
  const value = getOptimisticFeatureValue(planId, featureKey);

  // false = no access or disabled
  if (value === false) {
    return false;
  }

  // null = unlimited/enabled → has access
  if (value === null) {
    return true;
  }

  // number = has a limit
  // 0 = disabled (no access), > 0 = has access
  if (typeof value === "number") {
    return value > 0;
  }

  // true = has access (shouldn't happen with current logic but just in case)
  return Boolean(value);
};

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  // Initial state
  subscription: null,
  features: null,
  history: null,
  optimisticPlan: null,
  isModalVisible: false,
  isLoadingSubscription: false,
  isLoadingFeatures: false,
  isLoadingHistory: false,
  isLoading: false,
  error: null,
  lastFetchedSubscription: null,
  lastFetchedFeatures: null,
  lastFetchedHistory: null,
  lastFetched: null,
  lastSubscriptionRefresh: null, // Timestamp when subscription was refreshed (used to skip prefetch)

  // Modal actions
  openModal: () => set({ isModalVisible: true }),
  closeModal: () => set({ isModalVisible: false }),

  // Actions
  fetchSubscription: async () => {
    const { lastFetchedSubscription, isLoadingSubscription } = get();

    // Check if we have recent data
    if (lastFetchedSubscription && Date.now() - lastFetchedSubscription < CACHE_DURATION) {
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
          lastFetched: now
        }));
      } else {
        const errorMessage =
          response.error ||
          response.message ||
          `Failed to fetch subscription${response.status ? ` (status: ${response.status})` : ""}`;
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.log("error", error);
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error("Failed to fetch subscription", {
        error: errorMessage
      });

      set((state) => ({
        isLoadingSubscription: false,
        isLoading: state.isLoadingFeatures, // Only false if features is also done
        error: errorMessage
      }));
    }
  },

  fetchFeatures: async () => {
    const { lastFetchedFeatures, isLoadingFeatures, features } = get();

    // Check if we have recent data AND features_list is not empty
    // If features is null or features_list is empty, we should refetch
    const hasValidData = features && features.features_list && features.features_list.length > 0;
    if (hasValidData && lastFetchedFeatures && Date.now() - lastFetchedFeatures < CACHE_DURATION) {
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
          lastFetched: now
        }));
        console.log("[SubscriptionStore] Features stored successfully");
      } else {
        const errorMessage =
          response.error ||
          response.message ||
          `Failed to fetch features${response.status ? ` (status: ${response.status})` : ""}`;
        console.error("[SubscriptionStore] No data in response:", errorMessage);
        throw new Error(errorMessage);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error("[SubscriptionStore] Failed to fetch features:", errorMessage);
      logger.error("Failed to fetch features", {
        error: errorMessage
      });

      set((state) => ({
        isLoadingFeatures: false,
        isLoading: state.isLoadingSubscription, // Only false if subscription is also done
        error: errorMessage
      }));
    }
  },

  fetchHistory: async () => {
    const { lastFetchedHistory, isLoadingHistory } = get();

    // Check if we have recent data
    if (lastFetchedHistory && Date.now() - lastFetchedHistory < CACHE_DURATION) {
      return;
    }

    // Prevent multiple simultaneous requests for history
    if (isLoadingHistory) {
      return;
    }

    set({ isLoadingHistory: true, error: null });

    try {
      const response = await subscriptionsService.getSubscriptionHistory();

      if (response.data) {
        const now = Date.now();
        set({
          history: response.data,
          isLoadingHistory: false,
          error: null,
          lastFetchedHistory: now
        });
      } else {
        const errorMessage =
          response.error ||
          response.message ||
          `Failed to fetch history${response.status ? ` (status: ${response.status})` : ""}`;
        throw new Error(errorMessage);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error("Failed to fetch subscription history", {
        error: errorMessage
      });

      set({
        isLoadingHistory: false,
        error: errorMessage
      });
    }
  },

  refresh: async () => {
    // Fetch subscription, features, and history, bypassing cache
    const now = Date.now();
    set({
      isLoading: true,
      isLoadingSubscription: true,
      isLoadingFeatures: true,
      isLoadingHistory: true,
      error: null,
      lastFetchedSubscription: null,
      lastFetchedFeatures: null,
      lastFetchedHistory: null,
      lastFetched: null
    });

    try {
      // Fetch all in parallel
      const [subscriptionResponse, featuresResponse, historyResponse] = await Promise.all([
        subscriptionsService.getMySubscription(),
        subscriptionsService.getAvailableFeatures(),
        subscriptionsService.getSubscriptionHistory()
      ]);

      if (subscriptionResponse.data && featuresResponse.data) {
        set({
          subscription: subscriptionResponse.data,
          features: featuresResponse.data,
          history: historyResponse.data || null,
          optimisticPlan: null, // Clear optimistic plan - real data is now available
          isLoading: false,
          isLoadingSubscription: false,
          isLoadingFeatures: false,
          isLoadingHistory: false,
          error: null,
          lastFetchedSubscription: now,
          lastFetchedFeatures: now,
          lastFetchedHistory: historyResponse.data ? now : null,
          lastFetched: now,
          lastSubscriptionRefresh: now // Track when subscription was refreshed
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
          history: historyResponse.data || null,
          isLoading: false,
          isLoadingSubscription: false,
          isLoadingFeatures: false,
          isLoadingHistory: false,
          lastFetchedSubscription: subscriptionResponse.data ? now : null,
          lastFetchedFeatures: featuresResponse.data ? now : null,
          lastFetchedHistory: historyResponse.data ? now : null,
          lastFetched: subscriptionResponse.data || featuresResponse.data ? now : null
        });

        throw new Error(`Failed to fetch: ${errors.join(", ")}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error("Failed to refresh subscription", {
        error: errorMessage
      });

      set({
        isLoading: false,
        isLoadingSubscription: false,
        isLoadingFeatures: false,
        isLoadingHistory: false,
        error: errorMessage
      });
    }
  },

  // Optimistic update for immediate UI feedback after purchase
  setOptimisticPlan: (plan: SubscriptionTier) => {
    set({ optimisticPlan: plan });
    // Clear cache so next refresh() fetches fresh data
    set({
      lastFetchedSubscription: null,
      lastFetchedFeatures: null,
      lastFetched: null
    });
  },

  clearOptimisticPlan: () => {
    set({ optimisticPlan: null });
  },

  // Set timestamp to skip prefetch after subscription purchase
  setLastSubscriptionRefresh: () => {
    set({ lastSubscriptionRefresh: Date.now() });
  },

  // Helper methods
  getPlan: () => {
    const { subscription, features, optimisticPlan } = get();
    // Use optimistic plan if set (immediate feedback after purchase)
    if (optimisticPlan) {
      return optimisticPlan;
    }
    // Prefer features.plan (from tier-based system) over subscription.plan
    return features?.plan || subscription?.plan || "free";
  },

  getTier: () => {
    const { features, optimisticPlan } = get();
    // Use optimistic plan tier if set
    if (optimisticPlan) {
      return PLAN_TIERS[optimisticPlan];
    }
    return features?.tier ?? 0;
  },

  hasFeature: (featureKey: string) => {
    const { features, optimisticPlan } = get();

    // If optimistic plan is set, use pricingStore with tier inheritance
    if (optimisticPlan) {
      return hasOptimisticFeature(optimisticPlan, featureKey);
    }

    // Non-optimistic: use backend-provided features (already has tier inheritance)
    if (!features) return false;

    // Check if feature exists in features dict
    const featureValue = features.features[featureKey];

    // If it's a boolean, return it directly
    if (typeof featureValue === "boolean") {
      return featureValue;
    }

    // If it's a number, check if > 0 (0 = disabled)
    if (typeof featureValue === "number") {
      return featureValue > 0;
    }

    // If it's null, it means unlimited/enabled → has access
    // If undefined, feature doesn't exist → no access
    return featureValue === null;
  },

  getFeatureValue: (featureKey: string) => {
    const { features, optimisticPlan } = get();

    // Use optimistic plan if set (from pricingStore if available)
    if (optimisticPlan) {
      return getOptimisticFeatureValue(optimisticPlan, featureKey);
    }

    if (!features) return null;

    // Find the feature in features_list to get the actual numeric value
    // features.features[key] only gives boolean (has access), not the value
    const feature = features.features_list.find((f) => f.feature_key === featureKey);

    if (feature) {
      // Return the actual feature_value (could be number, null for unlimited, etc.)
      return feature.feature_value;
    }

    // Feature not found - return null (which typically means unlimited)
    return null;
  },

  canCreateGoal: (currentGoalCount: number) => {
    const goalLimit = get().getGoalLimit();
    console.log("goalLimit", goalLimit);

    // If goal_limit is null, it means unlimited
    if (goalLimit === null) {
      return true;
    }

    return currentGoalCount < goalLimit;
  },

  getGoalLimit: () => {
    const { features, optimisticPlan } = get();

    // Use optimistic plan limits if set (from pricingStore if available)
    if (optimisticPlan) {
      const value = getOptimisticFeatureValue(optimisticPlan, "active_goal_limit");
      return typeof value === "number" ? value : (value as number | null);
    }

    if (!features) return 2; // V2: Default to free tier limit (2 goals)

    // Find the "active_goal_limit" feature in features_list
    // feature_value = null means unlimited, otherwise it's the limit number
    const goalsFeature = features.features_list.find((f) => f.feature_key === "active_goal_limit");

    if (goalsFeature) {
      // null = unlimited, number = that's the limit
      return goalsFeature.feature_value;
    }

    // Fallback if "active_goal_limit" feature not found
    return 2; // V2: Free tier default
  },

  // Get the limit for how many goals can be ACTIVE simultaneously
  getActiveGoalLimit: () => {
    const { features, optimisticPlan } = get();

    // Use optimistic plan limits if set (from pricingStore if available)
    if (optimisticPlan) {
      const value = getOptimisticFeatureValue(optimisticPlan, "active_goal_limit");
      return typeof value === "number" ? value : (value as number | null);
    }

    if (!features) return 2; // V2: Default to free tier limit (2 active goals)

    // Find the "active_goal_limit" feature in features_list
    const activeGoalFeature = features.features_list.find(
      (f) => f.feature_key === "active_goal_limit"
    );

    if (activeGoalFeature) {
      // V2: Free=2, Premium=10 (no more unlimited for AI context limits)
      return activeGoalFeature.feature_value;
    }

    // Fallback if feature not found
    return 2; // V2: Free tier default
  },

  // Partner / accountability methods
  hasPartnerFeature: () => {
    return get().hasFeature("accountability_partner_limit");
  },

  getPartnerLimit: () => {
    const { features, optimisticPlan } = get();

    // Use optimistic plan limits if set (from pricingStore if available)
    if (optimisticPlan) {
      const value = getOptimisticFeatureValue(optimisticPlan, "accountability_partner_limit");
      return typeof value === "number" ? value : (value as number | null);
    }

    if (!features) return 1; // V2: Free tier gets 1 partner

    const partnerFeature = features.features_list.find(
      (f) => f.feature_key === "accountability_partner_limit"
    );

    if (partnerFeature) {
      // null = unlimited, 0 = disabled, number = limit
      return partnerFeature.feature_value;
    }

    return 1; // V2: Free tier default
  },

  canSendPartnerRequest: (acceptedCount: number, pendingSentCount: number) => {
    // First check if user has the accountability_partner_limit feature
    if (!get().hasPartnerFeature()) return false;

    const limit = get().getPartnerLimit();

    // null = unlimited
    if (limit === null) return true;
    // 0 = feature disabled
    if (limit === 0) return false;

    // Count both accepted partners and pending sent requests against the limit
    return acceptedCount + pendingSentCount < limit;
  },

  // Subscription history - check if user has ever had a paid subscription
  // This is fetched from the backend and persists even if app is reinstalled
  hasEverSubscribed: () => {
    const { history } = get();
    // If history not loaded yet, default to false (will be updated after fetch)
    if (!history) return false;
    return history.has_ever_subscribed;
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set({
      subscription: null,
      features: null,
      history: null,
      optimisticPlan: null,
      isModalVisible: false,
      isLoading: false,
      isLoadingSubscription: false,
      isLoadingFeatures: false,
      isLoadingHistory: false,
      error: null,
      lastFetched: null,
      lastFetchedSubscription: null,
      lastFetchedFeatures: null,
      lastFetchedHistory: null
    });
  },

  clearFetchCache: () => {
    set({
      lastFetchedSubscription: null,
      lastFetchedFeatures: null,
      lastFetchedHistory: null,
      lastFetched: null
    });
  }
}));
