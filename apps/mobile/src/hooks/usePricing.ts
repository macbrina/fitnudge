import { useEffect } from "react";
import { usePricingStore } from "@/stores/pricingStore";

export const usePricing = () => {
  const {
    plans,
    isLoading,
    error,
    fetchPlans,
    getPlanById,
    getGoalLimit,
    canCreateGoal,
    clearError,
    lastFetched,
  } = usePricingStore();

  // Auto-fetch plans on mount, but only if we don't have cached data
  useEffect(() => {
    // Skip fetch if we already have plans (cache is handled in store)
    if (plans.length === 0) {
      fetchPlans();
    }
  }, []); // Empty deps - only run on mount

  return {
    plans,
    isLoading,
    error,
    fetchPlans,
    getPlanById,
    getGoalLimit,
    canCreateGoal,
    clearError,
    // Expose cache status for debugging
    isCached: lastFetched !== null && plans.length > 0,
  };
};
