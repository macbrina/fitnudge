import React from "react";
import { View } from "react-native";
import { Card } from "@/components/ui/Card";
import { useStyles } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { StatCard } from "./StatCard";
import { useTranslation } from "@/lib/i18n";
import { SkeletonBox } from "@/components/ui/SkeletonBox";

interface QuickStatsGridProps {
  userStats: {
    active_goals: number;
    current_streak: number;
    total_check_ins: number;
    completion_rate: number;
  } | null;
  isLoading: boolean;
}

export function QuickStatsGrid({ userStats, isLoading }: QuickStatsGridProps) {
  const styles = useStyles(makeQuickStatsGridStyles);
  const { t } = useTranslation();

  if (isLoading || !userStats) {
    return (
      <View style={styles.container}>
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} shadow="md" style={styles.statCard}>
            <View style={{ alignItems: "center" }}>
              <SkeletonBox
                width="70%"
                height={toRN(tokens.typography.fontSize["3xl"])}
                borderRadius={toRN(tokens.borderRadius.base)}
                style={{ marginBottom: toRN(tokens.spacing[1]) }}
              />
              <SkeletonBox
                width="60%"
                height={toRN(tokens.typography.fontSize.sm)}
                borderRadius={toRN(tokens.borderRadius.base)}
              />
            </View>
          </Card>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatCard
        label={t("home.active_goals")}
        value={userStats.active_goals}
        // icon="🎯"
      />
      <StatCard
        label={t("home.current_streak")}
        value={userStats.current_streak}
        // icon="🔥"
      />
      <StatCard
        label={t("home.total_checkins")}
        value={userStats.total_check_ins}
        // icon="✓"
      />
      <StatCard
        label={t("home.completion_rate")}
        value={`${userStats.completion_rate}%`}
        // icon="📊"
      />
    </View>
  );
}

const makeQuickStatsGridStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[4]),
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    padding: toRN(tokens.spacing[4]),
  },
});
