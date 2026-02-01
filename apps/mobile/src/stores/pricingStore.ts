import { create } from "zustand";
import { subscriptionPlansApi, PricingPlan } from "@/services/api/subscriptionPlans";
import { logger } from "@/services/logger";

interface PricingState {
  // State
  plans: PricingPlan[];
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;

  // Actions
  fetchPlans: (force?: boolean) => Promise<void>;
  getPlanById: (id: string) => PricingPlan | undefined;
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
  fetchPlans: async (force = false) => {
    const { lastFetched, plans } = get();

    // Skip cache check when force=true (e.g. offline retry)
    if (!force) {
      const hasValidData = plans && plans.length > 0;
      if (hasValidData && lastFetched && Date.now() - lastFetched < CACHE_DURATION) {
        return;
      }
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
          lastFetched: Date.now()
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.error("Failed to fetch subscription plans", {
          error: errorMessage
        });

        set({
          isLoading: false,
          error: errorMessage
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
    return plan?.active_goal_limit ?? null;
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
      lastFetched: null
    });
  }
}));
