import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "@/lib/i18n";
import { usePostHog } from "@/hooks/usePostHog";
import { onboardingApi } from "@/services/api/onboarding";
import { logger } from "@/services/logger";
import { MOBILE_ROUTES } from "@/lib/routes";
import { useOnboardingStore } from "@/stores/onboardingStore";
import PersonalizationWelcomeScreen from "./PersonalizationWelcomeScreen";
import FitnessLevelScreen from "./FitnessLevelScreen";
import PrimaryGoalScreen from "./PrimaryGoalScreen";
import CurrentHabitsScreen from "./CurrentHabitsScreen";
import WorkoutSettingScreen from "./WorkoutSettingScreen";
import AvailableTimeScreen from "./AvailableTimeScreen";
import BiggestChallengeScreen from "./BiggestChallengeScreen";
import MotivationStyleScreen from "./MotivationStyleScreen";
import { storageUtil, STORAGE_KEYS } from "@/utils/storageUtil";
import PersonalizationWelcomeSkeleton from "@/components/onboarding/PersonalizationWelcomeSkeleton";

type PersonalizationStep =
  | "welcome"
  | "fitness_level"
  | "primary_goal"
  | "current_habits"
  | "workout_setting"
  | "available_time"
  | "biggest_challenge"
  | "motivation_style";

const STEPS: PersonalizationStep[] = [
  "welcome",
  "fitness_level",
  "primary_goal",
  "current_habits",
  "workout_setting",
  "available_time",
  "biggest_challenge",
  "motivation_style",
];

export default function PersonalizationFlow() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const { t } = useTranslation();
  const { capture } = usePostHog();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const {
    setFitnessLevel,
    setPrimaryGoal,
    setCurrentFrequency,
    setPreferredLocation,
    setAvailableTime,
    setBiggestChallenge,
    setMotivationStyle,
    loadProfile,
    submitProfile,
  } = useOnboardingStore();

  // Load existing profile on mount to populate store
  // Always start from first step (welcome screen) regardless of profile existence
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setIsLoadingProfile(true);
        // Load profile to populate store with existing data
        await loadProfile();
        // Always start from the first step (welcome screen)
        setCurrentStepIndex(0);
      } catch (error) {
        logger.error("Error loading fitness profile", {
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setIsLoadingProfile(false);
      }
    };

    fetchProfile();
  }, []); // Only run on mount

  const currentStep = STEPS[currentStepIndex];

  // Show loading state while fetching profile
  if (isLoadingProfile) {
    return <PersonalizationWelcomeSkeleton />;
  }

  const handleWelcomeContinue = () => {
    setCurrentStepIndex(1);
  };

  const handleFitnessLevelContinue = (fitnessLevel: string) => {
    setFitnessLevel(fitnessLevel);
    setCurrentStepIndex(2);
  };

  const handlePrimaryGoalContinue = (primaryGoal: string) => {
    setPrimaryGoal(primaryGoal);
    setCurrentStepIndex(3);
  };

  const handleCurrentHabitsContinue = (currentFrequency: string) => {
    setCurrentFrequency(currentFrequency);
    setCurrentStepIndex(4);
  };

  const handleWorkoutSettingContinue = (preferredLocation: string) => {
    setPreferredLocation(preferredLocation);
    setCurrentStepIndex(5);
  };

  const handleAvailableTimeContinue = (availableTime: string) => {
    setAvailableTime(availableTime);
    setCurrentStepIndex(6);
  };

  const handleBiggestChallengeContinue = (biggestChallenge: string) => {
    setBiggestChallenge(biggestChallenge);
    setCurrentStepIndex(7);
  };

  const handleMotivationStyleContinue = async (motivationStyle: string) => {
    try {
      setIsSubmitting(true);
      setMotivationStyle(motivationStyle);

      // Submit profile to backend
      await submitProfile();

      // Track completion
      capture("personalization_completed", {
        step: "motivation_style",
        total_steps: STEPS.length,
      });

      try {
        // Default to "habit" for onboarding - users can regenerate with different types later
        await onboardingApi.requestSuggestedGoals("habit");
      } catch (error) {
        logger.warn("Failed to queue suggested goals generation", {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Personalization completed - tracked via PostHog above

      // Mark step as seen
      await storageUtil.setItem(STORAGE_KEYS.HAS_SEEN_PERSONALIZATION, true);

      // Navigate directly to subscription while goals generate in background
      router.push(MOBILE_ROUTES.MAIN.HOME);
    } catch (error) {
      logger.error("Error submitting personalization profile", {
        error: error instanceof Error ? error.message : String(error),
        step: "motivation_style",
      });

      // Still continue to next step even if submission fails
      // The user can retry later
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case "welcome":
        return (
          <PersonalizationWelcomeScreen onContinue={handleWelcomeContinue} />
        );
      case "fitness_level":
        return (
          <FitnessLevelScreen
            onContinue={handleFitnessLevelContinue}
            onBack={handleBack}
          />
        );
      case "primary_goal":
        return (
          <PrimaryGoalScreen
            onContinue={handlePrimaryGoalContinue}
            onBack={handleBack}
          />
        );
      case "current_habits":
        return (
          <CurrentHabitsScreen
            onContinue={handleCurrentHabitsContinue}
            onBack={handleBack}
          />
        );
      case "workout_setting":
        return (
          <WorkoutSettingScreen
            onContinue={handleWorkoutSettingContinue}
            onBack={handleBack}
          />
        );
      case "available_time":
        return (
          <AvailableTimeScreen
            onContinue={handleAvailableTimeContinue}
            onBack={handleBack}
          />
        );
      case "biggest_challenge":
        return (
          <BiggestChallengeScreen
            onContinue={handleBiggestChallengeContinue}
            onBack={handleBack}
          />
        );
      case "motivation_style":
        return (
          <MotivationStyleScreen
            onContinue={handleMotivationStyleContinue}
            onBack={handleBack}
            isSubmitting={isSubmitting}
          />
        );
      default:
        return null;
    }
  };

  return <View style={{ flex: 1 }}>{renderCurrentStep()}</View>;
}
