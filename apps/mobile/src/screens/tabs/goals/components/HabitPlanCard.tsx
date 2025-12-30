import React from "react";
import { View, Text } from "react-native";
import { Card } from "@/components/ui/Card";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/lib/i18n";

interface HabitPlanCardProps {
  plan: any; // Full structured_data from actionable_plans
}

export function HabitPlanCard({ plan }: HabitPlanCardProps) {
  const styles = useStyles(makeHabitPlanCardStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();

  const structure = plan.structure || {};
  const habitTracking = structure.habit_tracking || {};
  const reminders = structure.reminders || {};

  return (
    <Card shadow="lg" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons
            name="checkmark-done"
            size={28}
            color={brandColors.primary}
          />
        </View>
        <Text style={styles.cardTitle}>{t("goals.plan.habit_title")}</Text>
      </View>

      {/* Tracking Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t("goals.plan.tracking_frequency")}
        </Text>
        <View style={styles.frequencyCard}>
          <Ionicons name="calendar" size={20} color={brandColors.primary} />
          <View style={styles.frequencyInfo}>
            <Text style={styles.frequencyValue}>
              {habitTracking.check_in_frequency === "daily"
                ? t("goals.plan.daily_checkins")
                : t("goals.plan.weekly_checkins")}
            </Text>
            {habitTracking.target_days_per_week && (
              <Text style={styles.frequencySubtext}>
                {habitTracking.target_days_per_week}{" "}
                {t("goals.plan.days_per_week")}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Optimal Times */}
      {reminders.optimal_times && reminders.optimal_times.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("goals.plan.optimal_times")}
          </Text>
          <View style={styles.timesContainer}>
            {reminders.optimal_times.map((time: string, index: number) => (
              <View key={index} style={styles.timeChip}>
                <Ionicons
                  name="time-outline"
                  size={16}
                  color={brandColors.primary}
                />
                <Text style={styles.timeText}>{time}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </Card>
  );
}

const makeHabitPlanCardStyles = (tokens: any, colors: any, brand: any) => ({
  card: {
    marginBottom: toRN(tokens.spacing[4]),
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[3]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  iconContainer: {
    width: toRN(tokens.spacing[10]),
    height: toRN(tokens.spacing[10]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: brand.primary + "1A",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginRight: toRN(tokens.spacing[3]),
  },
  cardTitle: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
  },
  section: {
    marginBottom: toRN(tokens.spacing[3]),
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[3]),
  },
  frequencyCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
    padding: toRN(tokens.spacing[4]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.lg),
  },
  frequencyInfo: {
    flex: 1,
  },
  frequencyValue: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[0.5]),
  },
  frequencySubtext: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.secondary,
  },
  timesContainer: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: toRN(tokens.spacing[2]),
  },
  timeChip: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1.5]),
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    backgroundColor: brand.primary + "1A",
    borderRadius: toRN(tokens.borderRadius.full),
  },
  timeText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskSemiBold,
    color: brand.primary,
  },
});
