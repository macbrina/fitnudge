import { create } from "zustand";
import {
  goalsService,
  Goal,
  CreateGoalRequest,
  UpdateGoalRequest,
  GoalStats,
} from "@/services/api/goals";
import { logger } from "@/services/logger";

interface GoalsState {
  // State
  goals: Goal[];
  activeGoals: Goal[];
  completedGoals: Goal[];
  stats: GoalStats | null;
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;

  // Actions
  fetchGoals: () => Promise<void>;
  fetchActiveGoals: () => Promise<void>;
  fetchCompletedGoals: () => Promise<void>;
  fetchStats: (goalId?: string) => Promise<void>;
  createGoal: (goal: CreateGoalRequest) => Promise<Goal | null>;
  updateGoal: (
    goalId: string,
    updates: UpdateGoalRequest
  ) => Promise<Goal | null>;
  deleteGoal: (goalId: string) => Promise<boolean>;
  archiveGoal: (goalId: string) => Promise<boolean>;
  unarchiveGoal: (goalId: string) => Promise<boolean>;
  duplicateGoal: (goalId: string) => Promise<Goal | null>;
  getGoalById: (goalId: string) => Goal | undefined;
  getGoalsByCategory: (category: Goal["category"]) => Goal[];
  getCurrentGoalCount: () => number;
  clearError: () => void;
  reset: () => void;
}

const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

export const useGoalsStore = create<GoalsState>((set, get) => ({
  // Initial state
  goals: [],
  activeGoals: [],
  completedGoals: [],
  stats: null,
  isLoading: false,
  error: null,
  lastFetched: null,

  // Actions
  fetchGoals: async () => {
    const { lastFetched, isLoading } = get();

    // Check if we have recent data
    if (lastFetched && Date.now() - lastFetched < CACHE_DURATION) {
      return;
    }

    // Prevent multiple simultaneous requests
    if (isLoading) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await goalsService.getGoals();

      // Check if request was successful and data is an array
      if (response.data && Array.isArray(response.data)) {
        const goals = response.data;
        const activeGoals = goals.filter((goal) => goal.is_active);
        const completedGoals = goals.filter((goal) => !goal.is_active);

        set({
          goals,
          activeGoals,
          completedGoals,
          isLoading: false,
          error: null,
          lastFetched: Date.now(),
        });

        console.info(
          `Fetched ${goals.length} goals (${activeGoals.length} active, ${completedGoals.length} completed)`
        );
      } else {
        // Data is undefined (failed request) or not in expected format
        const errorMessage =
          response.error ||
          response.message ||
          `Failed to fetch goals${response.status ? ` (status: ${response.status})` : ""}`;
        throw new Error(errorMessage);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("Failed to fetch goals", {
        error: errorMessage,
      });

      set({
        isLoading: false,
        error: errorMessage,
      });
    }
  },

  fetchActiveGoals: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await goalsService.getActiveGoals();

      if (response.data && Array.isArray(response.data)) {
        set({
          activeGoals: response.data,
          isLoading: false,
          error: null,
          lastFetched: Date.now(),
        });

        logger.info(`Fetched ${response.data.length} active goals`);
      } else {
        const errorMessage =
          response.error ||
          response.message ||
          `Failed to fetch active goals${response.status ? ` (status: ${response.status})` : ""}`;
        throw new Error(errorMessage);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("Failed to fetch active goals", {
        error: errorMessage,
      });

      set({
        isLoading: false,
        error: errorMessage,
      });
    }
  },

  fetchCompletedGoals: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await goalsService.getCompletedGoals();

      if (response.data && Array.isArray(response.data)) {
        set({
          completedGoals: response.data,
          isLoading: false,
          error: null,
          lastFetched: Date.now(),
        });

        logger.info(`Fetched ${response.data.length} completed goals`);
      } else {
        const errorMessage =
          response.error ||
          response.message ||
          `Failed to fetch completed goals${response.status ? ` (status: ${response.status})` : ""}`;
        throw new Error(errorMessage);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("Failed to fetch completed goals", {
        error: errorMessage,
      });

      set({
        isLoading: false,
        error: errorMessage,
      });
    }
  },

  fetchStats: async (goalId?: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await goalsService.getGoalStats(goalId);

      if (response.data) {
        set({
          stats: response.data,
          isLoading: false,
          error: null,
        });

        logger.info("Fetched goal stats", { goalId });
      } else {
        throw new Error(response.message || "Failed to fetch goal stats");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("Failed to fetch goal stats", {
        error: errorMessage,
        goalId,
      });

      set({
        isLoading: false,
        error: errorMessage,
      });
    }
  },

  createGoal: async (goalData: CreateGoalRequest) => {
    set({ isLoading: true, error: null });

    try {
      const response = await goalsService.createGoal(goalData);

      if (response.data) {
        const newGoal = response.data;

        set((state) => ({
          goals: [...state.goals, newGoal],
          activeGoals: newGoal.is_active
            ? [...state.activeGoals, newGoal]
            : state.activeGoals,
          isLoading: false,
          error: null,
          lastFetched: Date.now(),
        }));

        logger.info("Goal created successfully", { goalId: newGoal.id });
        return newGoal;
      } else {
        throw new Error(response.message || "Failed to create goal");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("Failed to create goal", {
        error: errorMessage,
        goalData,
      });

      set({
        isLoading: false,
        error: errorMessage,
      });
      return null;
    }
  },

  updateGoal: async (goalId: string, updates: UpdateGoalRequest) => {
    set({ isLoading: true, error: null });

    try {
      const response = await goalsService.updateGoal(goalId, updates);

      if (response.data) {
        const updatedGoal = response.data;

        set((state) => ({
          goals: state.goals.map((goal) =>
            goal.id === goalId ? updatedGoal : goal
          ),
          activeGoals: updatedGoal.is_active
            ? state.activeGoals.map((goal) =>
                goal.id === goalId ? updatedGoal : goal
              )
            : state.activeGoals.filter((goal) => goal.id !== goalId),
          completedGoals: updatedGoal.is_active
            ? state.completedGoals.filter((goal) => goal.id !== goalId)
            : state.completedGoals.map((goal) =>
                goal.id === goalId ? updatedGoal : goal
              ),
          isLoading: false,
          error: null,
          lastFetched: Date.now(),
        }));

        logger.info("Goal updated successfully", { goalId });
        return updatedGoal;
      } else {
        throw new Error(response.message || "Failed to update goal");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("Failed to update goal", {
        error: errorMessage,
        goalId,
        updates,
      });

      set({
        isLoading: false,
        error: errorMessage,
      });
      return null;
    }
  },

  deleteGoal: async (goalId: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await goalsService.deleteGoal(goalId);

      if (response.data !== undefined) {
        set((state) => ({
          goals: state.goals.filter((goal) => goal.id !== goalId),
          activeGoals: state.activeGoals.filter((goal) => goal.id !== goalId),
          completedGoals: state.completedGoals.filter(
            (goal) => goal.id !== goalId
          ),
          isLoading: false,
          error: null,
          lastFetched: Date.now(),
        }));

        logger.info("Goal deleted successfully", { goalId });
        return true;
      } else {
        throw new Error(response.message || "Failed to delete goal");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("Failed to delete goal", {
        error: errorMessage,
        goalId,
      });

      set({
        isLoading: false,
        error: errorMessage,
      });
      return false;
    }
  },

  archiveGoal: async (goalId: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await goalsService.archiveGoal(goalId);

      if (response.data) {
        const archivedGoal = response.data;

        set((state) => ({
          goals: state.goals.map((goal) =>
            goal.id === goalId ? archivedGoal : goal
          ),
          activeGoals: state.activeGoals.filter((goal) => goal.id !== goalId),
          completedGoals: [...state.completedGoals, archivedGoal],
          isLoading: false,
          error: null,
          lastFetched: Date.now(),
        }));

        logger.info("Goal archived successfully", { goalId });
        return true;
      } else {
        throw new Error(response.message || "Failed to archive goal");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("Failed to archive goal", {
        error: errorMessage,
        goalId,
      });

      set({
        isLoading: false,
        error: errorMessage,
      });
      return false;
    }
  },

  unarchiveGoal: async (goalId: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await goalsService.unarchiveGoal(goalId);

      if (response.data) {
        const unarchivedGoal = response.data;

        set((state) => ({
          goals: state.goals.map((goal) =>
            goal.id === goalId ? unarchivedGoal : goal
          ),
          activeGoals: [...state.activeGoals, unarchivedGoal],
          completedGoals: state.completedGoals.filter(
            (goal) => goal.id !== goalId
          ),
          isLoading: false,
          error: null,
          lastFetched: Date.now(),
        }));

        logger.info("Goal unarchived successfully", { goalId });
        return true;
      } else {
        throw new Error(response.message || "Failed to unarchive goal");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("Failed to unarchive goal", {
        error: errorMessage,
        goalId,
      });

      set({
        isLoading: false,
        error: errorMessage,
      });
      return false;
    }
  },

  duplicateGoal: async (goalId: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await goalsService.duplicateGoal(goalId);

      if (response.data) {
        const duplicatedGoal = response.data;

        set((state) => ({
          goals: [...state.goals, duplicatedGoal],
          activeGoals: duplicatedGoal.is_active
            ? [...state.activeGoals, duplicatedGoal]
            : state.activeGoals,
          isLoading: false,
          error: null,
          lastFetched: Date.now(),
        }));

        logger.info("Goal duplicated successfully", {
          goalId,
          newGoalId: duplicatedGoal.id,
        });
        return duplicatedGoal;
      } else {
        throw new Error(response.message || "Failed to duplicate goal");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("Failed to duplicate goal", {
        error: errorMessage,
        goalId,
      });

      set({
        isLoading: false,
        error: errorMessage,
      });
      return null;
    }
  },

  getGoalById: (goalId: string) => {
    const { goals } = get();
    return goals.find((goal) => goal.id === goalId);
  },

  getGoalsByCategory: (category: Goal["category"]) => {
    const { goals } = get();
    return goals.filter((goal) => goal.category === category);
  },

  getCurrentGoalCount: () => {
    const { activeGoals } = get();
    return activeGoals.length;
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set({
      goals: [],
      activeGoals: [],
      completedGoals: [],
      stats: null,
      isLoading: false,
      error: null,
      lastFetched: null,
    });
  },
}));
