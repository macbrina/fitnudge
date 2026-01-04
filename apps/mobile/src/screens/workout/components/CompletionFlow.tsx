import React, { useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { WorkoutStats } from "@/hooks/useWorkoutTimer";
import { AchievementUnlockedScreen } from "./AchievementUnlockedScreen";
import { StreakScreen } from "./StreakScreen";
import { WorkoutSummaryScreen } from "./WorkoutSummaryScreen";
import { WorkoutReflectionScreen, WorkoutReflectionData } from "./WorkoutReflectionScreen";

interface Achievement {
  id: string;
  badge_key: string;
  badge_name: string;
  badge_description: string;
  points: number;
  rarity: string;
  unlocked_at?: string;
}

interface StreakInfo {
  current_streak: number;
  longest_streak: number;
  milestone_target: number;
  days_until_milestone: number;
  workout_dates_this_week: string[];
}

interface CompletionData {
  achievements_unlocked: Achievement[];
  streak: StreakInfo;
  workout_number_today: number;
  is_practice: boolean;
  can_add_reflection: boolean;
}

type FlowStep = "achievements" | "streak" | "summary" | "reflection";

interface CompletionFlowProps {
  stats: WorkoutStats;
  completionData: CompletionData;
  dayNumber?: number;
  onComplete: (feedback: "hard" | "just_right" | "easy" | null) => void;
  onUpdateFeedback?: (feedback: "hard" | "just_right" | "easy") => Promise<void>;
  onSaveReflection?: (data: WorkoutReflectionData) => Promise<unknown>;
}

export function CompletionFlow({
  stats,
  completionData,
  dayNumber = 1,
  onComplete,
  onUpdateFeedback,
  onSaveReflection
}: CompletionFlowProps) {
  const [currentStep, setCurrentStep] = useState<FlowStep>("achievements");
  const [currentAchievementIndex, setCurrentAchievementIndex] = useState(0);
  const [savedFeedback, setSavedFeedback] = useState<"hard" | "just_right" | "easy" | null>(null);

  const { achievements_unlocked, streak, workout_number_today, is_practice, can_add_reflection } =
    completionData;

  // Determine the flow steps based on data
  const hasAchievements = achievements_unlocked && achievements_unlocked.length > 0;
  const hasStreak = streak && streak.current_streak > 0 && !is_practice;

  // Calculate initial step
  useEffect(() => {
    if (hasAchievements) {
      setCurrentStep("achievements");
    } else if (hasStreak) {
      setCurrentStep("streak");
    } else {
      setCurrentStep("summary");
    }
  }, [hasAchievements, hasStreak]);

  // Handle achievement screen continue
  const handleAchievementContinue = () => {
    if (currentAchievementIndex < achievements_unlocked.length - 1) {
      // Show next achievement
      setCurrentAchievementIndex((prev) => prev + 1);
    } else if (hasStreak) {
      // Move to streak screen
      setCurrentStep("streak");
    } else {
      // Move to summary
      setCurrentStep("summary");
    }
  };

  // Handle streak screen continue
  const handleStreakContinue = () => {
    setCurrentStep("summary");
  };

  // Handle summary finish - move to reflection step (skip if not allowed)
  const handleSummaryFinish = async (feedback: "hard" | "just_right" | "easy" | null) => {
    // Save feedback
    if (feedback && onUpdateFeedback) {
      try {
        await onUpdateFeedback(feedback);
      } catch (error) {
        console.error("Failed to update feedback:", error);
      }
    }
    setSavedFeedback(feedback);

    // Skip reflection if:
    // - It's a practice session
    // - Backend says reflection can't be added (not scheduled day, already recorded, etc.)
    if (is_practice || !can_add_reflection) {
      onComplete(feedback);
      return;
    }

    // Move to reflection step
    setCurrentStep("reflection");
  };

  // Handle reflection continue
  const handleReflectionContinue = (data: WorkoutReflectionData | null) => {
    // Save reflection data in background (fire and forget - don't block exit)
    if (data && onSaveReflection) {
      onSaveReflection(data).catch((error) => {
        console.error("Failed to save reflection:", error);
      });
    }

    // Complete the flow immediately without waiting
    onComplete(savedFeedback);
  };

  // Handle reflection skip
  const handleReflectionSkip = () => {
    // Complete without saving reflection
    onComplete(savedFeedback);
  };

  // Render current step
  const renderCurrentStep = () => {
    switch (currentStep) {
      case "achievements":
        if (!hasAchievements) {
          // Skip to next step
          if (hasStreak) {
            setCurrentStep("streak");
            return null;
          }
          setCurrentStep("summary");
          return null;
        }
        return (
          <AchievementUnlockedScreen
            achievement={achievements_unlocked[currentAchievementIndex]}
            onContinue={handleAchievementContinue}
          />
        );

      case "streak":
        if (!hasStreak) {
          setCurrentStep("summary");
          return null;
        }
        return (
          <StreakScreen
            streak={streak}
            workoutNumberToday={workout_number_today}
            onContinue={handleStreakContinue}
          />
        );

      case "summary":
        return (
          <WorkoutSummaryScreen
            stats={stats}
            dayNumber={dayNumber}
            isPractice={is_practice}
            onFinish={handleSummaryFinish}
          />
        );

      case "reflection":
        return (
          <WorkoutReflectionScreen
            onContinue={handleReflectionContinue}
            onSkip={handleReflectionSkip}
          />
        );

      default:
        return null;
    }
  };

  return <View style={styles.container}>{renderCurrentStep()}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  }
});

// Re-export types for use by parent components
export type { CompletionData, Achievement, StreakInfo, WorkoutReflectionData };
