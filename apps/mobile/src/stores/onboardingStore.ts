import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * V2 Onboarding Store
 * Stores all data collected during onboarding flow.
 * Persisted to AsyncStorage so users don't lose progress.
 *
 * Flow:
 * 1. Name - What should we call you?
 * 2. Motivation Style - How should AI motivate you?
 * 3. First Goal - What do you want to stay accountable to?
 * 4. Goal Details - Frequency, days, reminder time
 * 5. Why Matters - Why is this goal important? (optional)
 * 6. Complete!
 */

interface OnboardingState {
  // Screen 3: Name
  name: string;

  // Screen 4: Motivation Style
  motivation_style: "supportive" | "tough_love" | "calm" | "";

  // Screen 5: First Goal
  selected_goal_type: "workout" | "read" | "meditate" | "hydration" | "journal" | "custom" | "";

  // Screen 5b/5c: Goal Details
  goal_title: string; // For custom goals or populated from selected type
  goal_frequency: number; // Times per week (1-7)
  goal_days: string[]; // Selected days ['mon', 'tue', etc.]
  goal_reminder_time: string; // ISO time string e.g., "18:00"
  goal_reminder_before_minutes: number; // 0 = exact time, else minutes before
  goal_checkin_delay_minutes: number; // 0 = at reminder time, else minutes after
  goal_is_daily: boolean; // For custom goals

  // Screen 6: Why Matters
  goal_why: string;

  // Morning Motivation Settings (sent with completeOnboarding)
  morning_motivation_enabled: boolean;
  morning_motivation_time: string; // HH:MM format

  // State
  isCompleted: boolean;

  // Actions
  setName: (name: string) => void;
  setMotivationStyle: (style: "supportive" | "tough_love" | "calm") => void;
  setSelectedGoalType: (
    type: "workout" | "read" | "meditate" | "hydration" | "journal" | "custom"
  ) => void;
  setGoalTitle: (title: string) => void;
  setGoalFrequency: (frequency: number) => void;
  setGoalDays: (days: string[]) => void;
  setGoalReminderTime: (time: string) => void;
  setGoalReminderBeforeMinutes: (minutes: number) => void;
  setGoalCheckinDelayMinutes: (minutes: number) => void;
  setGoalIsDaily: (isDaily: boolean) => void;
  setGoalWhy: (why: string) => void;
  setMorningMotivationEnabled: (enabled: boolean) => void;
  setMorningMotivationTime: (time: string) => void;
  setCompleted: (completed: boolean) => void;
  reset: () => void;
}

const initialState = {
  name: "",
  motivation_style: "" as const,
  selected_goal_type: "" as const,
  goal_title: "",
  goal_frequency: 3,
  goal_days: [] as string[],
  goal_reminder_time: "18:00",
  goal_reminder_before_minutes: 30,
  goal_checkin_delay_minutes: 30,
  goal_is_daily: false,
  goal_why: "",
  morning_motivation_enabled: true,
  morning_motivation_time: "08:00",
  isCompleted: false
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...initialState,

      // Actions
      setName: (name) => set({ name }),

      setMotivationStyle: (style) => set({ motivation_style: style }),

      setSelectedGoalType: (type) => set({ selected_goal_type: type }),

      setGoalTitle: (title) => set({ goal_title: title }),

      setGoalFrequency: (frequency) => set({ goal_frequency: frequency }),

      setGoalDays: (days) => set({ goal_days: days }),

      setGoalReminderTime: (time) => set({ goal_reminder_time: time }),

      setGoalReminderBeforeMinutes: (minutes: number) =>
        set({ goal_reminder_before_minutes: minutes }),

      setGoalCheckinDelayMinutes: (minutes: number) => set({ goal_checkin_delay_minutes: minutes }),

      setGoalIsDaily: (isDaily) => set({ goal_is_daily: isDaily }),

      setGoalWhy: (why) => set({ goal_why: why }),

      setMorningMotivationEnabled: (enabled) => set({ morning_motivation_enabled: enabled }),

      setMorningMotivationTime: (time) => set({ morning_motivation_time: time }),

      setCompleted: (completed) => set({ isCompleted: completed }),

      reset: () => set(initialState)
    }),
    {
      name: "onboarding-storage",
      storage: createJSONStorage(() => AsyncStorage)
    }
  )
);
