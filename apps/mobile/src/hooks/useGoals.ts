import { useEffect } from "react";
import { useGoalsStore } from "@/stores/goalsStore";
import { useAuthStore } from "@/stores/authStore";

export const useGoals = () => {
  const { isAuthenticated } = useAuthStore();
  const {
    goals,
    activeGoals,
    completedGoals,
    stats,
    isLoading,
    error,
    fetchGoals,
    fetchActiveGoals,
    fetchCompletedGoals,
    fetchStats,
    createGoal,
    updateGoal,
    deleteGoal,
    archiveGoal,
    unarchiveGoal,
    duplicateGoal,
    getGoalById,
    getGoalsByCategory,
    getCurrentGoalCount,
    clearError,
  } = useGoalsStore();

  // Auto-fetch goals on mount, but only if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchGoals();
    }
  }, [fetchGoals, isAuthenticated]);

  return {
    goals,
    activeGoals,
    completedGoals,
    stats,
    isLoading,
    error,
    fetchGoals,
    fetchActiveGoals,
    fetchCompletedGoals,
    fetchStats,
    createGoal,
    updateGoal,
    deleteGoal,
    archiveGoal,
    unarchiveGoal,
    duplicateGoal,
    getGoalById,
    getGoalsByCategory,
    getCurrentGoalCount,
    clearError,
  };
};
