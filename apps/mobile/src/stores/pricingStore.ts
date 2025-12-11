import { create } from "zustand";
import {
  subscriptionPlansApi,
  SubscriptionPlan,
} from "@/services/api/subscriptionPlans";
import { logger } from "@/services/logger";

interface PricingState {
  // State
  plans: SubscriptionPlan[];
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;

  // Actions
  fetchPlans: () => Promise<void>;
  getPlanById: (id: string) => SubscriptionPlan | undefined;
  getGoalLimit: (planId: string) => number | null; // null means unlimited
  canCreateGoal: (planId: string, currentGoalCount: number) => boolean;
  clearError: () => void;
  reset: () => void;
}

// 30 minutes - subscription plans rarely change
const CACHE_DURATION = 30 * 60 * 1000;

// Track in-flight request promise for deduplication
let fetchPromise: Promise<void> | null = null;

export const usePricingStore = create<PricingState>((set, get) => ({
  // Initial state
  plans: [],
  isLoading: false,
  error: null,
  lastFetched: null,

  // Actions
  fetchPlans: async () => {
    const { lastFetched, plans } = get();

    // Check if we have recent data - return immediately without touching isLoading
    if (
      lastFetched &&
      Date.now() - lastFetched < CACHE_DURATION &&
      plans.length > 0
    ) {
      return;
    }

    // If a request is already in flight, wait for it instead of starting a new one
    if (fetchPromise) {
      return fetchPromise;
    }

    set({ isLoading: true, error: null });

    fetchPromise = (async () => {
      try {
        const plans = await subscriptionPlansApi.getPlans();

        set({
          plans,
          isLoading: false,
          error: null,
          lastFetched: Date.now(),
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        logger.error("Failed to fetch subscription plans", {
          error: errorMessage,
        });

        set({
          isLoading: false,
          error: errorMessage,
        });
      } finally {
        fetchPromise = null;
      }
    })();

    return fetchPromise;
  },

  getPlanById: (id: string) => {
    const { plans } = get();
    return plans.find((plan) => plan.id === id);
  },

  getGoalLimit: (planId: string) => {
    const plan = get().getPlanById(planId);
    return plan?.goal_limit ?? null;
  },

  canCreateGoal: (planId: string, currentGoalCount: number) => {
    const goalLimit = get().getGoalLimit(planId);

    // If goal_limit is null, it means unlimited
    if (goalLimit === null) {
      return true;
    }

    return currentGoalCount < goalLimit;
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set({
      plans: [],
      isLoading: false,
      error: null,
      lastFetched: null,
    });
  },
}));
