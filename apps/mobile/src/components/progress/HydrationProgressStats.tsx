/**
 * HydrationProgressStats - Hydration tracking-specific progress statistics
 *
 * Shows:
 * - Today's intake vs target
 * - Average daily intake
 * - Days target hit
 */

import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "@/lib/i18n";
import { useStyles, useTheme } from "@/themes";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { Ionicons } from "@expo/vector-icons";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { useHydrationStats } from "@/hooks/api/useTrackingStats";

interface HydrationProgressStatsProps {
  entityId: string;
  entityType?: "goal" | "challenge";
  period?: number;
}

export function HydrationProgressStats({
  entityId,
  entityType = "goal",
  period = 30
}: HydrationProgressStatsProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();

  const { data: stats, isLoading } = useHydrationStats(entityId, entityType, period);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <SkeletonBox width="100%" height={120} borderRadius={12} />
      </View>
    );
  }

  if (!stats) return null;

  const todayPercentage = Math.min(
    100,
    Math.round((stats.intake_today_ml / stats.daily_target_ml) * 100)
  );

  const formatMl = (ml: number) => {
    if (ml >= 1000) {
      return `${(ml / 1000).toFixed(1)}L`;
    }
    return `${ml}ml`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="water" size={18} color={brandColors.primary} />
        <Text style={styles.title}>{t("progress.hydration_stats") || "Hydration Stats"}</Text>
        <Text style={styles.period}>
          {t("progress.last_days", { days: period }) || `Last ${period} days`}
        </Text>
      </View>

      {/* Today's Progress */}
      <View style={styles.todayCard}>
        <Text style={styles.todayLabel}>{t("progress.today") || "Today"}</Text>
        <View style={styles.todayProgress}>
          <Text style={styles.todayValue}>{formatMl(stats.intake_today_ml)}</Text>
          <Text style={styles.todayTarget}>/ {formatMl(stats.daily_target_ml)}</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${todayPercentage}%`,
                backgroundColor:
                  todayPercentage >= 100 ? colors.feedback.success : brandColors.primary
              }
            ]}
          />
        </View>
        <Text style={styles.todayPercentage}>{todayPercentage}%</Text>
      </View>

      <View style={styles.statsGrid}>
        {/* Avg Daily */}
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatMl(Math.round(stats.avg_daily_intake_ml))}</Text>
          <Text style={styles.statLabel}>{t("progress.avg_daily") || "Avg/Day"}</Text>
        </View>

        {/* Days Target Hit */}
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.days_target_hit}</Text>
          <Text style={styles.statLabel}>{t("progress.target_hit_days") || "Days Target Hit"}</Text>
        </View>
      </View>

      {/* Target Hit Percentage */}
      <View style={styles.targetRow}>
        <Ionicons
          name="checkmark-circle"
          size={14}
          color={
            stats.target_hit_percentage >= 80
              ? colors.feedback.success
              : stats.target_hit_percentage >= 50
                ? brandColors.primary
                : colors.feedback.warning
          }
        />
        <Text style={styles.targetText}>
          {stats.target_hit_percentage}%{" "}
          {t("progress.target_success_rate") || "target success rate"}
        </Text>
      </View>
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
  todayCard: {
    padding: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.md),
    marginBottom: toRN(tokens.spacing[3])
  },
  todayLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
    marginBottom: toRN(tokens.spacing[1])
  },
  todayProgress: {
    flexDirection: "row" as const,
    alignItems: "baseline" as const,
    marginBottom: toRN(tokens.spacing[2])
  },
  todayValue: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.bold,
    color: brand.primary
  },
  todayTarget: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginLeft: toRN(tokens.spacing[1])
  },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.full),
    overflow: "hidden" as const
  },
  progressBarFill: {
    height: "100%",
    borderRadius: toRN(tokens.borderRadius.full)
  },
  todayPercentage: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
    textAlign: "right" as const,
    marginTop: toRN(tokens.spacing[1])
  },
  statsGrid: {
    flexDirection: "row" as const,
    gap: toRN(tokens.spacing[3])
  },
  statItem: {
    flex: 1,
    padding: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.md),
    alignItems: "center" as const
  },
  statValue: {
    fontSize: toRN(tokens.typography.fontSize.lg),
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
  targetRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1.5]),
    marginTop: toRN(tokens.spacing[3]),
    paddingTop: toRN(tokens.spacing[3]),
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle
  },
  targetText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary
  }
});
