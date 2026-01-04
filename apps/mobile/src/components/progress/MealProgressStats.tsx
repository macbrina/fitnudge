/**
 * MealProgressStats - Meal tracking-specific progress statistics
 *
 * Shows:
 * - Total meals logged
 * - Average calories/protein per day
 * - Healthy meal percentage
 */

import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "@/lib/i18n";
import { useStyles, useTheme } from "@/themes";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { Ionicons } from "@expo/vector-icons";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { useMealStats } from "@/hooks/api/useTrackingStats";

interface MealProgressStatsProps {
  entityId: string;
  entityType?: "goal" | "challenge";
  period?: number;
}

export function MealProgressStats({
  entityId,
  entityType = "goal",
  period = 30
}: MealProgressStatsProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();

  const { data: stats, isLoading } = useMealStats(entityId, entityType, period);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <SkeletonBox width="100%" height={100} borderRadius={12} />
      </View>
    );
  }

  if (!stats) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="restaurant" size={18} color={brandColors.primary} />
        <Text style={styles.title}>{t("progress.meal_stats") || "Meal Stats"}</Text>
        <Text style={styles.period}>
          {t("progress.last_days", { days: period }) || `Last ${period} days`}
        </Text>
      </View>

      <View style={styles.statsGrid}>
        {/* Total Meals */}
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.total_meals_logged}</Text>
          <Text style={styles.statLabel}>{t("progress.meals_logged") || "Meals Logged"}</Text>
        </View>

        {/* This Week */}
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.meals_this_week}</Text>
          <Text style={styles.statLabel}>{t("progress.this_week") || "This Week"}</Text>
        </View>

        {/* Avg Calories */}
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{Math.round(stats.avg_calories_per_day)}</Text>
          <Text style={styles.statLabel}>{t("progress.avg_calories") || "Avg Cal/Day"}</Text>
        </View>

        {/* Avg Protein */}
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{Math.round(stats.avg_protein_per_day)}g</Text>
          <Text style={styles.statLabel}>{t("progress.avg_protein") || "Avg Protein/Day"}</Text>
        </View>
      </View>

      {/* Health Rating Distribution */}
      {stats.total_meals_logged > 0 && (
        <View style={styles.healthDistribution}>
          <Text style={styles.healthTitle}>{t("progress.meal_quality") || "Meal Quality"}</Text>

          {/* Distribution Bar */}
          <View style={styles.distributionBar}>
            {stats.healthy_meal_percentage > 0 && (
              <View
                style={[
                  styles.barSegment,
                  styles.barHealthy,
                  { width: `${stats.healthy_meal_percentage}%` }
                ]}
              />
            )}
            {stats.okay_meal_percentage > 0 && (
              <View
                style={[
                  styles.barSegment,
                  styles.barOkay,
                  { width: `${stats.okay_meal_percentage}%` }
                ]}
              />
            )}
            {stats.unhealthy_meal_percentage > 0 && (
              <View
                style={[
                  styles.barSegment,
                  styles.barUnhealthy,
                  { width: `${stats.unhealthy_meal_percentage}%` }
                ]}
              />
            )}
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.dotHealthy]} />
              <Text style={styles.legendText}>
                {stats.healthy_meals} {t("progress.healthy") || "healthy"}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.dotOkay]} />
              <Text style={styles.legendText}>
                {stats.okay_meals} {t("progress.okay") || "okay"}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.dotUnhealthy]} />
              <Text style={styles.legendText}>
                {stats.unhealthy_meals} {t("progress.unhealthy") || "unhealthy"}
              </Text>
            </View>
          </View>
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
    borderRadius: toRN(tokens.borderRadius.lg)
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    marginBottom: toRN(tokens.spacing[3])
  },
  title: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  period: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },
  statsGrid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    justifyContent: "space-between" as const,
    rowGap: toRN(tokens.spacing[3])
  },
  statItem: {
    width: "48%",
    padding: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.md),
    alignItems: "center" as const
  },
  statValue: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: brand.primary
  },
  statLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[1]),
    textAlign: "center" as const
  },
  // Health Distribution
  healthDistribution: {
    marginTop: toRN(tokens.spacing[3]),
    paddingTop: toRN(tokens.spacing[3]),
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle
  },
  healthTitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[2])
  },
  distributionBar: {
    flexDirection: "row" as const,
    height: toRN(12),
    borderRadius: toRN(6),
    overflow: "hidden" as const,
    backgroundColor: colors.bg.tertiary
  },
  barSegment: {
    height: "100%" as const
  },
  barHealthy: {
    backgroundColor: "#22C55E" // Green
  },
  barOkay: {
    backgroundColor: "#F59E0B" // Amber
  },
  barUnhealthy: {
    backgroundColor: "#EF4444" // Red
  },
  legend: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    marginTop: toRN(tokens.spacing[2])
  },
  legendItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1])
  },
  legendDot: {
    width: toRN(8),
    height: toRN(8),
    borderRadius: toRN(4)
  },
  dotHealthy: {
    backgroundColor: "#22C55E"
  },
  dotOkay: {
    backgroundColor: "#F59E0B"
  },
  dotUnhealthy: {
    backgroundColor: "#EF4444"
  },
  legendText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary
  }
});
