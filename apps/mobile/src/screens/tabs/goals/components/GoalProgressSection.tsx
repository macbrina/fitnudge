import React, { useState, useMemo, useEffect } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
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
  progressQueryKeys,
} from "@/hooks/api/useProgressData";
import { trackingStatsQueryKeys } from "@/hooks/api/useTrackingStats";
import { trackingStatsService } from "@/services/api/trackingStats";
import { checkInsService } from "@/services/api";
import { StreakCards } from "@/screens/tabs/home/components/StreakCards";
import { HabitChainCompact } from "@/screens/tabs/home/components/HabitChainCompact";
import { WeeklyProgressBar } from "@/screens/tabs/home/components/WeeklyProgressBar";
import { MoodTrendMini } from "@/screens/tabs/home/components/MoodTrendMini";
import { TrackingTypeStats } from "@/components/progress";
import type { TrackingType } from "@/components/progress";

// Available period options for rolling window
const PERIOD_OPTIONS = [7, 30, 90] as const;
type PeriodOption = (typeof PERIOD_OPTIONS)[number];

interface GoalProgressSectionProps {
  goalId: string;
  trackingType?: TrackingType;
  frequency?: "daily" | "weekly";
  daysOfWeek?: number[];
  isPartnerView?: boolean;
}

// Helper to format date as YYYY-MM-DD in LOCAL timezone
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function GoalProgressSection({
  goalId,
  trackingType = "checkin",
  frequency = "daily",
  daysOfWeek,
  isPartnerView = false,
}: GoalProgressSectionProps) {
  const styles = useStyles(makeGoalProgressSectionStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>(30);

  // Prefetch all periods on mount to enable instant switching
  useEffect(() => {
    if (!goalId) return;

    // Prefetch tracking stats for all periods
    PERIOD_OPTIONS.forEach((period) => {
      // Prefetch meal/hydration/workout stats based on tracking type
      if (trackingType !== "checkin") {
        queryClient.prefetchQuery({
          queryKey: trackingStatsQueryKeys.stats(
            "goal",
            goalId,
            trackingType,
            period,
          ),
          queryFn: () =>
            trackingStatsService
              .getStats(goalId, "goal", trackingType, period)
              .then((r) => r.data),
          staleTime: 1000 * 60 * 5, // 5 minutes
        });
      }

      // Prefetch habit chain for all periods
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - period + 1);

      queryClient.prefetchQuery({
        queryKey: [...progressQueryKeys.all, "chain", goalId, period],
        queryFn: () =>
          checkInsService
            .getCheckInsByDateRange(
              formatLocalDate(startDate),
              formatLocalDate(endDate),
              goalId,
            )
            .then((r) => r.data || []),
        staleTime: 0,
      });

      // Prefetch mood trends for all periods (only for checkin tracking)
      if (trackingType === "checkin") {
        queryClient.prefetchQuery({
          queryKey: progressQueryKeys.moodTrend(goalId, period),
          queryFn: () =>
            checkInsService.getMoodTrends(goalId, period).then((r) => r.data),
          staleTime: 0,
        });
      }
    });
  }, [goalId, trackingType, queryClient]);

  // Fetch all progress data for this specific goal
  const { data: streakInfo, isLoading: streakLoading } = useStreakInfo(goalId);
  const { data: weekProgress, isLoading: weekLoading } =
    useWeekProgress(goalId);
  // Use selected period for habit chain
  const { data: habitChain, isLoading: chainLoading } = useHabitChain(
    goalId,
    selectedPeriod,
  );
  // Fetch mood trends only for checkin tracking type (mood is captured via check-ins)
  const { data: moodTrend, isLoading: moodLoading } = useMoodTrends(
    trackingType === "checkin" ? goalId : undefined,
    selectedPeriod,
  );

  const isLoading = streakLoading || weekLoading || chainLoading;

  // Calculate consistency rate from habit chain data, respecting scheduled days
  const { completedDays, totalScheduledDays, consistencyRate } = useMemo(() => {
    if (!habitChain) {
      return { completedDays: 0, totalScheduledDays: 0, consistencyRate: 0 };
    }

    let completed = 0;
    let scheduled = 0;

    for (const day of habitChain) {
      if (day.isFuture) continue;

      // For weekly frequency, only count scheduled days
      if (frequency === "weekly" && daysOfWeek?.length) {
        const dayDate = new Date(day.date);
        const dayOfWeek = dayDate.getDay();
        if (!daysOfWeek.includes(dayOfWeek)) continue;
      }

      scheduled++;
      if (day.completed) completed++;
    }

    return {
      completedDays: completed,
      totalScheduledDays: scheduled,
      consistencyRate:
        scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0,
    };
  }, [habitChain, frequency, daysOfWeek]);

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
            currentStreak={streakInfo?.current_streak || 0}
            longestStreak={streakInfo?.longest_streak || 0}
            isLoading={streakLoading}
          />

          {/* Period Selector */}
          <View style={styles.periodSelector}>
            {PERIOD_OPTIONS.map((period) => (
              <TouchableOpacity
                key={period}
                style={[
                  styles.periodButton,
                  selectedPeriod === period && styles.periodButtonActive,
                ]}
                onPress={() => setSelectedPeriod(period)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.periodButtonText,
                    selectedPeriod === period && styles.periodButtonTextActive,
                  ]}
                >
                  {period} {t("goals.progress.days") || "days"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Consistency Rate Card (renamed from Completion Rate) */}
          <View style={styles.consistencyCard}>
            <View style={styles.consistencyHeader}>
              <Text style={styles.consistencyLabel}>
                {t("goals.progress.consistency") || "Consistency"}
              </Text>
              <Text style={styles.consistencyValue}>{consistencyRate}%</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${consistencyRate}%`,
                    backgroundColor:
                      consistencyRate >= 80
                        ? colors.feedback.success
                        : consistencyRate >= 50
                          ? brandColors.primary
                          : colors.feedback.warning,
                  },
                ]}
              />
            </View>
            <Text style={styles.consistencySubtext}>
              {completedDays} {t("goals.progress.of") || "of"}{" "}
              {totalScheduledDays}{" "}
              {frequency === "weekly"
                ? t("goals.scheduled_days") || "scheduled days"
                : t("goals.progress.days") || "days"}{" "}
              (
              {t("goals.progress.last_days", { days: selectedPeriod }) ||
                `Last ${selectedPeriod} days`}
              )
            </Text>
          </View>

          {/* Tracking-Type Specific Stats */}
          {trackingType !== "checkin" && (
            <TrackingTypeStats
              entityId={goalId}
              entityType="goal"
              trackingType={trackingType}
              period={selectedPeriod}
            />
          )}

          {/* Weekly Progress */}
          <WeeklyProgressBar {...weekProgress} isLoading={weekLoading} />

          {/* Habit Chain */}
          <HabitChainCompact
            data={habitChain || []}
            days={selectedPeriod}
            isLoading={chainLoading}
          />

          {/* Mood Trend - only for checkin tracking type */}
          {trackingType === "checkin" && (
            <MoodTrendMini
              data={moodTrend || []}
              days={selectedPeriod}
              isLoading={moodLoading}
            />
          )}
        </>
      )}
    </Card>
  );
}

const makeGoalProgressSectionStyles = (
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
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
  },
  streakCardsRow: {
    flexDirection: "row" as const,
    gap: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[4]),
  },
  // Period Selector styles
  periodSelector: {
    flexDirection: "row" as const,
    gap: toRN(tokens.spacing[2]),
    marginBottom: toRN(tokens.spacing[4]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.full),
    padding: toRN(tokens.spacing[1]),
  },
  periodButton: {
    flex: 1,
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.full),
    alignItems: "center" as const,
  },
  periodButtonActive: {
    backgroundColor: colors.bg.card,
    shadowColor: colors.shadow?.sm || "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  periodButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.tertiary,
  },
  periodButtonTextActive: {
    color: brand.primary,
    fontFamily: fontFamily.groteskSemiBold,
  },
  // Consistency Card styles (renamed from completionRate)
  consistencyCard: {
    marginBottom: toRN(tokens.spacing[4]),
    padding: toRN(tokens.spacing[4]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.lg),
  },
  consistencyHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[2]),
  },
  consistencyLabel: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary,
  },
  consistencyValue: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.groteskBold,
    color: brand.primary,
  },
  consistencySubtext: {
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
