/**
 * WorkoutProgressStats - Workout-specific progress statistics
 *
 * Shows:
 * - Total workouts in period
 * - Total duration
 * - Workouts this week
 * - Average workout duration
 */

import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "@/lib/i18n";
import { useStyles, useTheme } from "@/themes";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { Ionicons } from "@expo/vector-icons";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { useWorkoutStats, WorkoutStats } from "@/hooks/api/useTrackingStats";

interface WorkoutProgressStatsProps {
  entityId: string;
  entityType?: "goal" | "challenge";
  period?: number;
}

export function WorkoutProgressStats({
  entityId,
  entityType = "goal",
  period = 30,
}: WorkoutProgressStatsProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();

  const { data: stats, isLoading } = useWorkoutStats(
    entityId,
    entityType,
    period,
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <SkeletonBox width="100%" height={100} borderRadius={12} />
      </View>
    );
  }

  if (!stats) return null;

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="fitness" size={18} color={brandColors.primary} />
        <Text style={styles.title}>
          {t("progress.workout_stats") || "Workout Stats"}
        </Text>
        <Text style={styles.period}>
          {t("progress.last_days", { days: period }) || `Last ${period} days`}
        </Text>
      </View>

      <View style={styles.statsGrid}>
        {/* Total Workouts */}
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.total_workouts}</Text>
          <Text style={styles.statLabel}>
            {t("progress.workouts") || "Workouts"}
          </Text>
        </View>

        {/* Calories Burned */}
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {stats.total_calories_burned > 0
              ? stats.total_calories_burned.toLocaleString()
              : "—"}
          </Text>
          <Text style={styles.statLabel}>
            {t("progress.calories_burned") || "Calories"}
          </Text>
        </View>

        {/* Total Duration */}
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {formatDuration(stats.total_duration_minutes)}
          </Text>
          <Text style={styles.statLabel}>
            {t("progress.total_time") || "Total Time"}
          </Text>
        </View>

        {/* This Week */}
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.workouts_this_week}</Text>
          <Text style={styles.statLabel}>
            {t("progress.this_week") || "This Week"}
          </Text>
        </View>
      </View>

      {/* Exercise Count */}
      {stats.exercises_completed > 0 && (
        <View style={styles.exerciseRow}>
          <Ionicons
            name="barbell-outline"
            size={14}
            color={colors.text.secondary}
          />
          <Text style={styles.exerciseText}>
            {stats.exercises_completed}{" "}
            {t("progress.exercises_completed") || "exercises completed"}
          </Text>
        </View>
      )}
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    marginBottom: toRN(tokens.spacing[4]),
    padding: toRN(tokens.spacing[4]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.lg),
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    marginBottom: toRN(tokens.spacing[3]),
  },
  title: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
  period: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
  },
  statsGrid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    justifyContent: "space-between" as const,
    rowGap: toRN(tokens.spacing[3]),
  },
  statItem: {
    width: "48%",
    padding: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.md),
    alignItems: "center" as const,
  },
  statValue: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: brand.primary,
  },
  statLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[1]),
  },
  exerciseRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1.5]),
    marginTop: toRN(tokens.spacing[3]),
    paddingTop: toRN(tokens.spacing[3]),
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  exerciseText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
  },
});
