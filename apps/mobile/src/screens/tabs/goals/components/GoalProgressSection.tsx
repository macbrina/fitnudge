import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Card } from "@/components/ui/Card";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { Ionicons } from "@expo/vector-icons";
import {
  useStreakInfo,
  useWeekProgress,
  useHabitChain,
  useMoodTrends,
} from "@/hooks/api/useProgressData";
import { StreakCards } from "@/screens/tabs/home/components/StreakCards";
import { HabitChainCompact } from "@/screens/tabs/home/components/HabitChainCompact";
import { WeeklyProgressBar } from "@/screens/tabs/home/components/WeeklyProgressBar";
import { MoodTrendMini } from "@/screens/tabs/home/components/MoodTrendMini";

interface GoalProgressSectionProps {
  goalId: string;
  goalType?: "habit" | "time_challenge" | "target_challenge";
  targetCheckins?: number;
  challengeStartDate?: string;
  challengeEndDate?: string;
  frequency?: "daily" | "weekly";
  daysOfWeek?: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday
}

// Helper function to calculate scheduled days in a date range
const calculateScheduledDays = (
  startDate: Date,
  endDate: Date,
  frequency: "daily" | "weekly",
  daysOfWeek?: number[]
): number => {
  if (frequency === "daily") {
    return (
      Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1
    );
  }

  if (frequency === "weekly" && daysOfWeek && daysOfWeek.length > 0) {
    let count = 0;
    const current = new Date(startDate);
    while (current <= endDate) {
      // JavaScript getDay(): 0=Sunday, 1=Monday, ..., 6=Saturday (matches our format)
      if (daysOfWeek.includes(current.getDay())) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    return count;
  }

  // Fallback: assume daily
  return (
    Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1
  );
};

export function GoalProgressSection({
  goalId,
  goalType = "habit",
  targetCheckins,
  challengeStartDate,
  challengeEndDate,
  frequency = "daily",
  daysOfWeek,
}: GoalProgressSectionProps) {
  const styles = useStyles(makeGoalProgressSectionStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);

  // Fetch all progress data for this specific goal
  const { data: streakInfo, isLoading: streakLoading } = useStreakInfo(goalId);
  const { data: weekProgress, isLoading: weekLoading } =
    useWeekProgress(goalId);
  const { data: habitChain, isLoading: chainLoading } = useHabitChain(
    goalId,
    30
  );
  const { data: moodTrend, isLoading: moodLoading } = useMoodTrends(goalId, 7);

  const isLoading = streakLoading || weekLoading || chainLoading || moodLoading;

  // Calculate completion rate from habit chain data
  const completedDays =
    habitChain?.filter((day) => day.completed && !day.isFuture).length || 0;
  const totalPastDays = habitChain?.filter((day) => !day.isFuture).length || 0;
  const completionRate =
    totalPastDays > 0 ? Math.round((completedDays / totalPastDays) * 100) : 0;

  // For challenges, calculate progress towards target
  const renderChallengeProgress = () => {
    if (goalType === "target_challenge" && targetCheckins) {
      const progress = Math.min(completedDays, targetCheckins);
      const percentage = Math.round((progress / targetCheckins) * 100);

      return (
        <View style={styles.challengeProgress}>
          <View style={styles.challengeHeader}>
            <Text style={styles.challengeTitle}>
              {t("goals.progress.challenge_progress") || "Challenge Progress"}
            </Text>
            <Text style={styles.challengeStats}>
              {progress}/{targetCheckins} ({percentage}%)
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${percentage}%`,
                  backgroundColor: brandColors.primary,
                },
              ]}
            />
          </View>
          {percentage >= 100 && (
            <View style={styles.completedBadge}>
              <Ionicons name="trophy" size={16} color="#FFD700" />
              <Text style={styles.completedBadgeText}>
                {t("goals.progress.challenge_complete") ||
                  "Challenge Complete!"}
              </Text>
            </View>
          )}
        </View>
      );
    }

    if (
      goalType === "time_challenge" &&
      challengeStartDate &&
      challengeEndDate
    ) {
      const start = new Date(challengeStartDate);
      const end = new Date(challengeEndDate);
      const today = new Date();

      // Calculate SCHEDULED days (respecting frequency and days_of_week)
      const totalScheduledDays = calculateScheduledDays(
        start,
        end,
        frequency,
        daysOfWeek
      );

      // Calculate calendar days for time remaining
      const calendarDaysRemaining = Math.max(
        0,
        Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      );

      // Progress is based on completed check-ins vs total scheduled
      const percentage = Math.min(
        100,
        Math.round((completedDays / Math.max(totalScheduledDays, 1)) * 100)
      );
      const isCompleted = today > end;

      return (
        <View style={styles.challengeProgress}>
          <View style={styles.challengeHeader}>
            <Text style={styles.challengeTitle}>
              {t("goals.progress.time_challenge_progress") || "Time Challenge"}
            </Text>
            <Text style={styles.challengeStats}>
              {isCompleted
                ? t("goals.progress.completed") || "Completed"
                : `${calendarDaysRemaining} ${t("goals.progress.days_left") || "days left"}`}
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${percentage}%`,
                  backgroundColor: brandColors.primary,
                },
              ]}
            />
          </View>
          <View style={styles.challengeMeta}>
            <Text style={styles.challengeMetaText}>
              {completedDays}/{totalScheduledDays}{" "}
              {t("goals.progress.checkins") || "check-ins"}
            </Text>
            <Text style={styles.challengeMetaText}>
              {percentage}% {t("goals.progress.complete") || "complete"}
            </Text>
          </View>
          {isCompleted && (
            <View style={styles.completedBadge}>
              <Ionicons name="trophy" size={16} color="#FFD700" />
              <Text style={styles.completedBadgeText}>
                {t("goals.progress.challenge_complete") ||
                  "Challenge Complete!"}
              </Text>
            </View>
          )}
        </View>
      );
    }

    return null;
  };

  if (isLoading && !streakInfo) {
    return (
      <Card shadow="lg" style={styles.container}>
        <View style={styles.header}>
          <SkeletonBox
            width="50%"
            height={toRN(tokens.typography.fontSize.xl)}
            borderRadius={toRN(tokens.borderRadius.md)}
          />
        </View>

        {/* Streak Cards Skeleton */}
        <View style={styles.streakCardsRow}>
          <SkeletonBox
            width="48%"
            height={100}
            borderRadius={toRN(tokens.borderRadius.xl)}
          />
          <SkeletonBox
            width="48%"
            height={100}
            borderRadius={toRN(tokens.borderRadius.xl)}
          />
        </View>

        {/* Additional skeleton */}
        <SkeletonBox
          width="100%"
          height={60}
          borderRadius={toRN(tokens.borderRadius.md)}
        />
      </Card>
    );
  }

  return (
    <Card shadow="lg" style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.7}
      >
        <Text style={styles.sectionTitle}>
          {t("goals.progress.your_progress") || "Your Progress"}
        </Text>
        <Ionicons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={colors.text.tertiary}
        />
      </TouchableOpacity>

      {isExpanded && (
        <>
          {/* Streak Cards */}
          <StreakCards
            currentStreak={streakInfo?.current_streak || 0}
            longestStreak={streakInfo?.longest_streak || 0}
            isLoading={streakLoading}
          />

          {/* Challenge Progress (for challenges only) */}
          {renderChallengeProgress()}

          {/* Completion Rate Card */}
          <View style={styles.completionRateCard}>
            <View style={styles.completionRateHeader}>
              <Text style={styles.completionRateLabel}>
                {t("goals.progress.completion_rate") || "Completion Rate"}
              </Text>
              <Text style={styles.completionRateValue}>{completionRate}%</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${completionRate}%`,
                    backgroundColor:
                      completionRate >= 80
                        ? colors.feedback.success
                        : completionRate >= 50
                          ? brandColors.primary
                          : colors.feedback.warning,
                  },
                ]}
              />
            </View>
            <Text style={styles.completionRateSubtext}>
              {completedDays} {t("goals.progress.of") || "of"} {totalPastDays}{" "}
              {t("goals.progress.days") || "days"}
            </Text>
          </View>

          {/* Weekly Progress */}
          <WeeklyProgressBar {...weekProgress} isLoading={weekLoading} />

          {/* Habit Chain */}
          <HabitChainCompact data={habitChain || []} isLoading={chainLoading} />

          {/* Mood Trend */}
          {moodTrend && moodTrend.length > 0 && (
            <MoodTrendMini data={moodTrend} isLoading={moodLoading} />
          )}
        </>
      )}
    </Card>
  );
}

const makeGoalProgressSectionStyles = (
  tokens: any,
  colors: any,
  brand: any
) => ({
  container: {
    padding: toRN(tokens.spacing[5]),
    marginBottom: toRN(tokens.spacing[4]),
  },
  header: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[4]),
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
  },
  streakCardsRow: {
    flexDirection: "row" as const,
    gap: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[4]),
  },
  challengeProgress: {
    marginBottom: toRN(tokens.spacing[4]),
    padding: toRN(tokens.spacing[4]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.lg),
  },
  challengeHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[3]),
  },
  challengeTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary,
  },
  challengeStats: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.secondary,
  },
  challengeMeta: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    marginTop: toRN(tokens.spacing[2]),
  },
  challengeMetaText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.tertiary,
  },
  completedBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[2]),
    marginTop: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    backgroundColor: "rgba(255, 215, 0, 0.2)",
    borderRadius: toRN(tokens.borderRadius.md),
  },
  completedBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskBold,
    color: "#B8860B",
  },
  completionRateCard: {
    marginBottom: toRN(tokens.spacing[4]),
    padding: toRN(tokens.spacing[4]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.lg),
  },
  completionRateHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[2]),
  },
  completionRateLabel: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary,
  },
  completionRateValue: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.groteskBold,
    color: brand.primary,
  },
  completionRateSubtext: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[2]),
  },
  progressBarBg: {
    height: toRN(tokens.spacing[2]),
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.full),
    overflow: "hidden" as const,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: toRN(tokens.borderRadius.full),
  },
});
