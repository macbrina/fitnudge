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
  } = usePricingStore();

  // Auto-fetch plans on mount
  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  return {
    plans,
    isLoading,
    error,
    fetchPlans,
    getPlanById,
    getGoalLimit,
    canCreateGoal,
    clearError,
  };
};
