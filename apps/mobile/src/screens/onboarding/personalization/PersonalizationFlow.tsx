import React, { useEffect, useState, useMemo } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "@/lib/i18n";
import { usePostHog } from "@/hooks/usePostHog";
import { onboardingApi } from "@/services/api/onboarding";
import { logger } from "@/services/logger";
import { MOBILE_ROUTES } from "@/lib/routes";
import { useOnboardingStore } from "@/stores/onboardingStore";
import PersonalizationWelcomeScreen from "./PersonalizationWelcomeScreen";
import BiologicalSexScreen from "./BiologicalSexScreen";
import FitnessLevelScreen from "./FitnessLevelScreen";
import PrimaryGoalScreen from "./PrimaryGoalScreen";
import CurrentHabitsScreen from "./CurrentHabitsScreen";
import WorkoutSettingScreen from "./WorkoutSettingScreen";
import EquipmentScreen from "./EquipmentScreen";
import AvailableTimeScreen from "./AvailableTimeScreen";
import BiggestChallengeScreen from "./BiggestChallengeScreen";
import MotivationStyleScreen from "./MotivationStyleScreen";
import { storageUtil, STORAGE_KEYS } from "@/utils/storageUtil";
import PersonalizationWelcomeSkeleton from "@/components/onboarding/PersonalizationWelcomeSkeleton";

type PersonalizationStep =
  | "welcome"
  | "biological_sex"
  | "fitness_level"
  | "primary_goal"
  | "current_habits"
  | "workout_setting"
  | "equipment"
  | "available_time"
  | "biggest_challenge"
  | "motivation_style";

// Locations that require equipment selection
const LOCATIONS_REQUIRING_EQUIPMENT = ["home", "mix"];

export default function PersonalizationFlow() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const { t } = useTranslation();
  const { capture } = usePostHog();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [hasExistingProfile, setHasExistingProfile] = useState(false);
  const {
    preferred_location,
    setBiologicalSex,
    setFitnessLevel,
    setPrimaryGoal,
    setCurrentFrequency,
    setPreferredLocation,
    setAvailableEquipment,
    setAvailableTime,
    setBiggestChallenge,
    setMotivationStyle,
    loadProfile,
    submitProfile
  } = useOnboardingStore();

  // Calculate steps dynamically based on whether equipment selection is needed
  const steps = useMemo((): PersonalizationStep[] => {
    const baseSteps: PersonalizationStep[] = [
      "welcome",
      "biological_sex",
      "fitness_level",
      "primary_goal",
      "current_habits",
      "workout_setting"
    ];

    // Only show equipment step for home/mix locations
    if (LOCATIONS_REQUIRING_EQUIPMENT.includes(preferred_location)) {
      baseSteps.push("equipment");
    }

    baseSteps.push("available_time", "biggest_challenge", "motivation_style");

    return baseSteps;
  }, [preferred_location]);

  // Load existing profile on mount to populate store
  // Always start from first step (welcome screen) regardless of profile existence
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setIsLoadingProfile(true);
        // Load profile to populate store with existing data
        const profileExists = await loadProfile();
        setHasExistingProfile(profileExists);
        // Always start from the first step (welcome screen)
        setCurrentStepIndex(0);
      } catch (error) {
        logger.error("Error loading fitness profile", {
          error: error instanceof Error ? error.message : String(error)
        });
      } finally {
        setIsLoadingProfile(false);
      }
    };

    fetchProfile();
  }, []); // Only run on mount

  const currentStep = steps[currentStepIndex];
  const totalSteps = steps.length;

  // Show loading state while fetching profile
  if (isLoadingProfile) {
    return <PersonalizationWelcomeSkeleton />;
  }

  const goToNextStep = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handleWelcomeContinue = () => {
    goToNextStep();
  };

  const handleBiologicalSexContinue = (biologicalSex: string) => {
    setBiologicalSex(biologicalSex);
    goToNextStep();
  };

  const handleFitnessLevelContinue = (fitnessLevel: string) => {
    setFitnessLevel(fitnessLevel);
    goToNextStep();
  };

  const handlePrimaryGoalContinue = (primaryGoal: string) => {
    setPrimaryGoal(primaryGoal);
    goToNextStep();
  };

  const handleCurrentHabitsContinue = (currentFrequency: string) => {
    setCurrentFrequency(currentFrequency);
    goToNextStep();
  };

  const handleWorkoutSettingContinue = (preferredLocationValue: string) => {
    setPreferredLocation(preferredLocationValue);

    // If gym or outdoor, clear equipment (not needed)
    if (!LOCATIONS_REQUIRING_EQUIPMENT.includes(preferredLocationValue)) {
      // Clear equipment - gym has all, outdoor has body weight only
      setAvailableEquipment([]);
    }

    goToNextStep();
  };

  const handleEquipmentContinue = (equipment: string[]) => {
    setAvailableEquipment(equipment);
    goToNextStep();
  };

  const handleAvailableTimeContinue = (availableTime: string) => {
    setAvailableTime(availableTime);
    goToNextStep();
  };

  const handleBiggestChallengeContinue = (biggestChallenge: string) => {
    setBiggestChallenge(biggestChallenge);
    goToNextStep();
  };

  const handleMotivationStyleContinue = async (motivationStyle: string) => {
    try {
      setIsSubmitting(true);
      setMotivationStyle(motivationStyle);

      // Submit profile to backend
      await submitProfile();

      // Only request suggested goals for new users (first-time onboarding)
      // Skip for users who already have a profile (updating their preferences)
      if (!hasExistingProfile) {
        try {
          // Default to "habit" for onboarding - users can regenerate with different types later
          await onboardingApi.requestSuggestedGoals("habit");
        } catch (error) {
          logger.warn("Failed to queue suggested goals generation", {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Personalization completed - tracked via PostHog above

      // Mark step as seen
      await storageUtil.setItem(STORAGE_KEYS.HAS_SEEN_PERSONALIZATION, true);

      // Navigate directly to subscription while goals generate in background
      router.push(MOBILE_ROUTES.MAIN.HOME);
    } catch (error) {
      logger.error("Error submitting personalization profile", {
        error: error instanceof Error ? error.message : String(error),
        step: "motivation_style"
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

  // Common step props for all screens
  const stepProps = {
    currentStep: currentStepIndex + 1,
    totalSteps
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case "welcome":
        return <PersonalizationWelcomeScreen onContinue={handleWelcomeContinue} {...stepProps} />;
      case "biological_sex":
        return (
          <BiologicalSexScreen
            onContinue={handleBiologicalSexContinue}
            onBack={handleBack}
            {...stepProps}
          />
        );
      case "fitness_level":
        return (
          <FitnessLevelScreen
            onContinue={handleFitnessLevelContinue}
            onBack={handleBack}
            {...stepProps}
          />
        );
      case "primary_goal":
        return (
          <PrimaryGoalScreen
            onContinue={handlePrimaryGoalContinue}
            onBack={handleBack}
            {...stepProps}
          />
        );
      case "current_habits":
        return (
          <CurrentHabitsScreen
            onContinue={handleCurrentHabitsContinue}
            onBack={handleBack}
            {...stepProps}
          />
        );
      case "workout_setting":
        return (
          <WorkoutSettingScreen
            onContinue={handleWorkoutSettingContinue}
            onBack={handleBack}
            {...stepProps}
          />
        );
      case "equipment":
        return (
          <EquipmentScreen
            onContinue={handleEquipmentContinue}
            onBack={handleBack}
            {...stepProps}
          />
        );
      case "available_time":
        return (
          <AvailableTimeScreen
            onContinue={handleAvailableTimeContinue}
            onBack={handleBack}
            {...stepProps}
          />
        );
      case "biggest_challenge":
        return (
          <BiggestChallengeScreen
            onContinue={handleBiggestChallengeContinue}
            onBack={handleBack}
            {...stepProps}
          />
        );
      case "motivation_style":
        return (
          <MotivationStyleScreen
            onContinue={handleMotivationStyleContinue}
            onBack={handleBack}
            isSubmitting={isSubmitting}
            hasExistingProfile={hasExistingProfile}
            {...stepProps}
          />
        );
      default:
        return null;
    }
  };

  return <View style={{ flex: 1 }}>{renderCurrentStep()}</View>;
}
