import React, { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { logger } from "@/services/logger";
import { MOBILE_ROUTES } from "@/lib/routes";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { storageUtil, STORAGE_KEYS } from "@/utils/storageUtil";
import { onboardingApi } from "@/services/api/onboarding";
import { goalsService, FrequencyType } from "@/services/api/goals";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/lib/i18n";
import NameScreen from "./NameScreen";
import MotivationStyleScreen from "./MotivationStyleScreen";
import FirstGoalScreen from "./FirstGoalScreen";
import GoalDetailsScreen, { GoalDetails } from "./GoalDetailsScreen";
import CustomGoalScreen, { CustomGoalDetails } from "./CustomGoalScreen";
import WhyMattersScreen from "./WhyMattersScreen";
import OnboardingCompleteScreen from "./OnboardingCompleteScreen";

// Goal type keys for translation lookup
const GOAL_TYPE_KEYS = ["workout", "read", "meditate", "hydration", "journal"] as const;

type OnboardingStep =
  | "name"
  | "motivation_style"
  | "first_goal"
  | "goal_details"
  | "custom_goal"
  | "why_matters"
  | "complete";

export default function PersonalizationFlow() {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("name");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper to get translated goal title
  const getGoalTitle = (goalType: string): string => {
    if (GOAL_TYPE_KEYS.includes(goalType as (typeof GOAL_TYPE_KEYS)[number])) {
      return t(`onboarding.first_goal.goal_titles.${goalType}`);
    }
    return goalType;
  };

  // Get all store values and setters
  const {
    name,
    motivation_style,
    selected_goal_type,
    goal_title,
    goal_frequency,
    goal_days,
    goal_reminder_time,
    goal_why,
    morning_motivation_enabled,
    morning_motivation_time,
    setName,
    setMotivationStyle,
    setSelectedGoalType,
    setGoalTitle,
    setGoalFrequency,
    setGoalDays,
    setGoalReminderTime,
    setGoalIsDaily,
    setGoalWhy,
    setCompleted,
    reset: resetOnboarding
  } = useOnboardingStore();

  // Calculate total steps (excluding complete screen)
  const totalSteps = 5; // name, motivation, goal, details, why

  const getStepNumber = (): number => {
    switch (currentStep) {
      case "name":
        return 1;
      case "motivation_style":
        return 2;
      case "first_goal":
        return 3;
      case "goal_details":
      case "custom_goal":
        return 4;
      case "why_matters":
        return 5;
      default:
        return 1;
    }
  };

  const handleNameContinue = (newName: string) => {
    setName(newName);
    setCurrentStep("motivation_style");
  };

  const handleMotivationStyleContinue = (style: "supportive" | "tough_love" | "calm") => {
    setMotivationStyle(style);
    setCurrentStep("first_goal");
  };

  const handleFirstGoalContinue = (
    goalType: "workout" | "read" | "meditate" | "hydration" | "journal" | "custom"
  ) => {
    setSelectedGoalType(goalType);

    // Set default title for predefined goals
    if (goalType !== "custom") {
      setGoalTitle(getGoalTitle(goalType));
    }

    if (goalType === "custom") {
      setCurrentStep("custom_goal");
    } else {
      setCurrentStep("goal_details");
    }
  };

  const handleGoalDetailsContinue = (details: GoalDetails) => {
    setGoalFrequency(details.frequency);
    setGoalIsDaily(details.isDaily);
    setGoalDays(details.days);
    // reminderTimes is now an array - store first one for onboarding (free users get 1)
    setGoalReminderTime(details.reminderTimes[0] || "18:00");
    setCurrentStep("why_matters");
  };

  const handleCustomGoalContinue = (details: CustomGoalDetails) => {
    setGoalTitle(details.title);
    setGoalFrequency(details.frequency);
    setGoalIsDaily(details.isDaily);
    setGoalDays(details.days);
    // reminderTimes is now an array - store first one for onboarding (free users get 1)
    setGoalReminderTime(details.reminderTimes[0] || "18:00");
    setCurrentStep("why_matters");
  };

  const handleWhyMattersContinue = async (why: string) => {
    // Set loading immediately to disable button
    setIsSubmitting(true);

    try {
      setGoalWhy(why);

      // Get isDaily from store
      const isDaily = useOnboardingStore.getState().goal_is_daily;

      // 1. Complete onboarding - saves user preferences and marks onboarding_completed_at
      await onboardingApi.completeOnboarding({
        name,
        motivation_style: motivation_style || "supportive",
        morning_motivation_enabled,
        morning_motivation_time
      });

      // 2. Create the first goal
      // Convert day names to day numbers (0 = Sunday, 1 = Monday, etc.)
      const dayNameToNumber: Record<string, number> = {
        sun: 0,
        mon: 1,
        tue: 2,
        wed: 3,
        thu: 4,
        fri: 5,
        sat: 6
      };
      const targetDays = goal_days
        .map((day) => dayNameToNumber[day])
        .filter((d) => d !== undefined);

      // For daily goals, set target_days to all days [0-6] for consistent handling
      const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
      await goalsService.createGoal({
        title: goal_title,
        frequency_type: isDaily ? "daily" : ("weekly" as FrequencyType),
        frequency_count: isDaily ? 7 : goal_frequency,
        target_days: isDaily ? ALL_DAYS : targetDays,
        reminder_times: [goal_reminder_time],
        why_statement: why || undefined
      });

      // 3. Update auth store with onboarding_completed_at
      const updateUser = useAuthStore.getState().updateUser;
      updateUser({ onboarding_completed_at: new Date().toISOString() });

      // Mark onboarding as complete locally
      await storageUtil.setItem(STORAGE_KEYS.HAS_SEEN_PERSONALIZATION, true);
      setCompleted(true);

      setCurrentStep("complete");
    } catch (error) {
      logger.error("Error completing onboarding", {
        error: error instanceof Error ? error.message : String(error)
      });

      // Still move to complete screen even if API fails
      // User can retry later, and local state is saved
      await storageUtil.setItem(STORAGE_KEYS.HAS_SEEN_PERSONALIZATION, true);
      setCompleted(true);
      setCurrentStep("complete");
      // Re-enable button on error so user can retry
      setIsSubmitting(false);
    }
  };

  const handleWhyMattersSkip = async () => {
    await handleWhyMattersContinue("");
  };

  const handleComplete = () => {
    // Clear onboarding store - all data is already saved to backend
    resetOnboarding();
    router.replace(MOBILE_ROUTES.MAIN.HOME);
  };

  const handleBack = () => {
    switch (currentStep) {
      case "motivation_style":
        setCurrentStep("name");
        break;
      case "first_goal":
        setCurrentStep("motivation_style");
        break;
      case "goal_details":
      case "custom_goal":
        setCurrentStep("first_goal");
        break;
      case "why_matters":
        if (selected_goal_type === "custom") {
          setCurrentStep("custom_goal");
        } else {
          setCurrentStep("goal_details");
        }
        break;
    }
  };

  // Helper to format time string for display
  const formatReminderTimeForDisplay = (timeString: string): string => {
    const [hours, minutes] = timeString.split(":").map(Number);
    const date = new Date();
    date.setHours(hours, minutes);
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case "name":
        return (
          <NameScreen
            onContinue={handleNameContinue}
            currentStep={getStepNumber()}
            totalSteps={totalSteps}
          />
        );
      case "motivation_style":
        return (
          <MotivationStyleScreen
            onContinue={handleMotivationStyleContinue}
            onBack={handleBack}
            currentStep={getStepNumber()}
            totalSteps={totalSteps}
          />
        );
      case "first_goal":
        return (
          <FirstGoalScreen
            onContinue={handleFirstGoalContinue}
            onBack={handleBack}
            currentStep={getStepNumber()}
            totalSteps={totalSteps}
          />
        );
      case "goal_details":
        return (
          <GoalDetailsScreen
            goalType={selected_goal_type}
            goalTitle={goal_title || getGoalTitle(selected_goal_type)}
            onContinue={handleGoalDetailsContinue}
            onBack={handleBack}
            currentStep={getStepNumber()}
            totalSteps={totalSteps}
          />
        );
      case "custom_goal":
        return (
          <CustomGoalScreen
            onContinue={handleCustomGoalContinue}
            onBack={handleBack}
            currentStep={getStepNumber()}
            totalSteps={totalSteps}
          />
        );
      case "why_matters":
        return (
          <WhyMattersScreen
            onContinue={handleWhyMattersContinue}
            onSkip={handleWhyMattersSkip}
            onBack={handleBack}
            currentStep={getStepNumber()}
            totalSteps={totalSteps}
            isLoading={isSubmitting}
          />
        );
      case "complete":
        return (
          <OnboardingCompleteScreen
            name={name}
            reminderTime={formatReminderTimeForDisplay(goal_reminder_time)}
            onComplete={handleComplete}
          />
        );
      default:
        return null;
    }
  };

  return <View style={{ flex: 1 }}>{renderCurrentStep()}</View>;
}
