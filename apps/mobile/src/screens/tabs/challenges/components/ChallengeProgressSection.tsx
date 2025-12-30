import React, { useState, useMemo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTranslation } from "@/lib/i18n";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { Card } from "@/components/ui/Card";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { Ionicons } from "@expo/vector-icons";
import { ChallengeCheckIn, ChallengeType } from "@/services/api/challenges";
import { StreakCards } from "@/screens/tabs/home/components/StreakCards";
import { WeeklyProgressBar } from "@/screens/tabs/home/components/WeeklyProgressBar";
import { HabitChainCompact } from "@/screens/tabs/home/components/HabitChainCompact";
import { MoodTrendMini } from "@/screens/tabs/home/components/MoodTrendMini";
import { TrackingTypeStats } from "@/components/progress";
import type { TrackingType } from "@/components/progress";

/**
 * Format a Date to YYYY-MM-DD in local timezone (not UTC)
 * This is important for comparing with check-in dates which are stored as local dates
 */
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

interface ChallengeProgressSectionProps {
  challengeId: string;
  challengeType: ChallengeType;
  targetValue?: number;
  myProgress: number;
  myRank?: number;
  totalParticipants: number;
  startDate: string;
  endDate?: string;
  checkIns: ChallengeCheckIn[];
  daysOfWeek?: number[];
  frequency?: "daily" | "weekly";
  trackingType?: TrackingType;
  isLoading?: boolean;
  isPartnerView?: boolean;
}

// Helper function to calculate scheduled days in a date range
const calculateScheduledDays = (
  startDate: Date,
  endDate: Date,
  frequency: "daily" | "weekly",
  daysOfWeek?: number[],
): number => {
  if (frequency === "daily") {
    return (
      Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      ) + 1
    );
  }

  if (frequency === "weekly" && daysOfWeek && daysOfWeek.length > 0) {
    let count = 0;
    const current = new Date(startDate);
    while (current <= endDate) {
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
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    ) + 1
  );
};

export function ChallengeProgressSection({
  challengeId,
  challengeType,
  targetValue,
  myProgress,
  myRank,
  totalParticipants,
  startDate,
  endDate,
  checkIns,
  daysOfWeek,
  frequency = "daily",
  trackingType = "checkin",
  isLoading = false,
  isPartnerView = false,
}: ChallengeProgressSectionProps) {
  const styles = useStyles(makeChallengeProgressSectionStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);

  // Calculate current streak
  const currentStreak = useMemo(() => {
    if (checkIns.length === 0) return 0;

    const sorted = [...checkIns].sort(
      (a, b) =>
        new Date(b.check_in_date).getTime() -
        new Date(a.check_in_date).getTime(),
    );

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < sorted.length; i++) {
      const checkInDate = new Date(sorted[i].check_in_date);
      checkInDate.setHours(0, 0, 0, 0);

      const expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() - i);

      if (checkInDate.getTime() === expectedDate.getTime()) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }, [checkIns]);

  // Calculate longest streak
  const longestStreak = useMemo(() => {
    if (checkIns.length === 0) return 0;

    const sorted = [...checkIns].sort(
      (a, b) =>
        new Date(a.check_in_date).getTime() -
        new Date(b.check_in_date).getTime(),
    );

    let longest = 1;
    let current = 1;

    for (let i = 1; i < sorted.length; i++) {
      const prevDate = new Date(sorted[i - 1].check_in_date);
      const currDate = new Date(sorted[i].check_in_date);
      prevDate.setHours(0, 0, 0, 0);
      currDate.setHours(0, 0, 0, 0);

      const diff =
        (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

      if (diff === 1) {
        current++;
        longest = Math.max(longest, current);
      } else if (diff > 1) {
        current = 1;
      }
    }

    return longest;
  }, [checkIns]);

  // Week progress data for WeeklyProgressBar
  const weekProgress = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const weekStart = new Date(today);
    // Adjust to Monday start (1=Monday, 0=Sunday becomes 7)
    const adjustedDay = dayOfWeek === 0 ? 7 : dayOfWeek;
    weekStart.setDate(today.getDate() - adjustedDay + 1);
    weekStart.setHours(0, 0, 0, 0);

    const daysCompleted: boolean[] = [];
    let completedCount = 0;

    // [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      // Use local date format to match check_in_date which is stored as local date
      const dateStr = formatLocalDate(date);
      const completed = checkIns.some((ci) => ci.check_in_date === dateStr);

      if (completed) completedCount++;
      daysCompleted.push(completed);
    }

    return {
      completed: completedCount,
      total: 7,
      percentage: Math.round((completedCount / 7) * 100),
      daysCompleted,
    };
  }, [checkIns]);

  // Habit chain data (last 30 days) for HabitChainCompact
  const habitChainData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = formatLocalDate(today);
    const data: {
      date: string;
      completed: boolean;
      isFuture: boolean;
      isToday: boolean;
    }[] = [];

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      // Use local date format to match check_in_date which is stored as local date
      const dateStr = formatLocalDate(date);
      const isToday = dateStr === todayStr;
      const isFuture = date > today;
      const completed = checkIns.some((ci) => ci.check_in_date === dateStr);

      data.push({
        date: dateStr,
        completed,
        isFuture,
        isToday,
      });
    }

    return data;
  }, [checkIns]);

  // Mood trend data for MoodTrendMini
  // Convert string moods to numeric values (1-5)
  const moodTrendData = useMemo(() => {
    const moodToNumber: Record<string, number> = {
      terrible: 1,
      bad: 2,
      okay: 3,
      good: 4,
      great: 5,
    };

    const moods = checkIns
      .filter((ci) => ci.mood)
      .slice(0, 7)
      .map((ci) => ({
        date: ci.check_in_date,
        mood: moodToNumber[ci.mood || "good"] || 4,
      }));

    return moods;
  }, [checkIns]);

  // Completion rate - based on scheduled days only (excluding rest days)
  const { completedScheduledDays, totalScheduledPastDays } = useMemo(() => {
    let completed = 0;
    let total = 0;

    for (const day of habitChainData) {
      if (day.isFuture) continue;

      const dayDate = new Date(day.date);
      const dayOfWeek = dayDate.getDay(); // 0=Sunday, 1=Monday, etc.

      // Check if this day is a scheduled day
      const isScheduledDay =
        frequency === "daily" ||
        (daysOfWeek && daysOfWeek.length > 0
          ? daysOfWeek.includes(dayOfWeek)
          : true); // If no daysOfWeek specified, count all days

      if (isScheduledDay) {
        total++;
        if (day.completed) {
          completed++;
        }
      }
    }

    return { completedScheduledDays: completed, totalScheduledPastDays: total };
  }, [habitChainData, daysOfWeek, frequency]);

  const completionRate =
    totalScheduledPastDays > 0
      ? Math.round((completedScheduledDays / totalScheduledPastDays) * 100)
      : 0;

  // Challenge-specific progress
  const renderChallengeProgress = () => {
    if (
      (challengeType === "streak" || challengeType === "checkin_count") &&
      targetValue
    ) {
      const progress = Math.min(checkIns.length, targetValue);
      const percentage = Math.round((progress / targetValue) * 100);

      return (
        <View style={styles.challengeProgress}>
          <View style={styles.challengeHeader}>
            <Text style={styles.challengeTitle}>
              {t("goals.progress.challenge_progress") || "Challenge Progress"}
            </Text>
            <Text style={styles.challengeStats}>
              {progress}/{targetValue} ({percentage}%)
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

    if (challengeType === "streak" && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const today = new Date();

      const totalScheduledDays = calculateScheduledDays(
        start,
        end,
        frequency,
        daysOfWeek,
      );

      const calendarDaysRemaining = Math.max(
        0,
        Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
      );

      const percentage = Math.min(
        100,
        Math.round((checkIns.length / Math.max(totalScheduledDays, 1)) * 100),
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
              {checkIns.length}/{totalScheduledDays}{" "}
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

  if (isLoading) {
    return (
      <Card shadow="lg" style={styles.container}>
        <View style={styles.header}>
          <SkeletonBox
            width="50%"
            height={toRN(tokens.typography.fontSize.xl)}
            borderRadius={toRN(tokens.borderRadius.md)}
          />
        </View>
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
          {isPartnerView
            ? t("goals.progress.partners_progress") || "Partner's Progress"
            : t("goals.progress.your_progress") || "Your Progress"}
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
            currentStreak={currentStreak}
            longestStreak={longestStreak}
            isLoading={false}
          />

          {/* Rank Card - Challenge Specific */}
          <View style={styles.rankCard}>
            <View style={styles.rankIconContainer}>
              <Ionicons
                name="trophy"
                size={24}
                color={
                  myRank === 1
                    ? "#FFD700"
                    : myRank === 2
                      ? "#C0C0C0"
                      : myRank === 3
                        ? "#CD7F32"
                        : brandColors.primary
                }
              />
            </View>
            <View style={styles.rankInfo}>
              <Text style={styles.rankLabel}>
                {t("challenges.your_rank") || "Your Rank"}
              </Text>
              {myRank && myRank > 0 ? (
                <Text style={styles.rankValue}>
                  #{myRank}{" "}
                  <Text style={styles.rankSecondary}>
                    of {totalParticipants}
                  </Text>
                </Text>
              ) : (
                <Text style={styles.rankValue}>
                  {t("challenges.no_rank") || "No rank yet"}
                </Text>
              )}
            </View>
            <View style={styles.checkInsInfo}>
              <Text style={styles.checkInsLabel}>
                {t("checkin.check_ins") || "Check-ins"}
              </Text>
              <Text style={styles.checkInsValue}>{checkIns.length}</Text>
            </View>
          </View>

          {/* Challenge Progress */}
          {renderChallengeProgress()}

          {/* Tracking-Type Specific Stats */}
          {trackingType !== "checkin" && (
            <TrackingTypeStats
              entityId={challengeId}
              entityType="challenge"
              trackingType={trackingType}
              period={30}
            />
          )}

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
              {completedScheduledDays} {t("goals.progress.of") || "of"}{" "}
              {totalScheduledPastDays}{" "}
              {t("goals.scheduled_days") || "scheduled days"}
            </Text>
          </View>

          {/* Weekly Progress */}
          <WeeklyProgressBar {...weekProgress} isLoading={false} />

          {/* Habit Chain (Last 30 Days) */}
          <HabitChainCompact data={habitChainData} isLoading={false} />

          {/* Mood Trend */}
          {moodTrendData.length > 0 && (
            <MoodTrendMini data={moodTrendData} isLoading={false} />
          )}
        </>
      )}
    </Card>
  );
}

const makeChallengeProgressSectionStyles = (
  tokens: any,
  colors: any,
  brand: any,
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
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
  },
  streakCardsRow: {
    flexDirection: "row" as const,
    gap: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[4]),
  },
  rankCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    padding: toRN(tokens.spacing[4]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.lg),
    marginBottom: toRN(tokens.spacing[4]),
    gap: toRN(tokens.spacing[3]),
  },
  rankIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bg.card,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  rankInfo: {
    flex: 1,
  },
  rankLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
  },
  rankValue: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
  },
  rankSecondary: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
  },
  checkInsInfo: {
    alignItems: "flex-end" as const,
  },
  checkInsLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
  },
  checkInsValue: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: brand.primary,
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
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
  challengeStats: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
  },
  challengeMeta: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    marginTop: toRN(tokens.spacing[2]),
  },
  challengeMetaText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
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
    fontFamily: fontFamily.bold,
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
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
  completionRateValue: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: brand.primary,
  },
  completionRateSubtext: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
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
