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

interface HydrationPlanCardProps {
  plan: any; // Full structured_data from actionable_plans
}

export function HydrationPlanCard({ plan }: HydrationPlanCardProps) {
  const styles = useStyles(makeHydrationPlanCardStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();

  const structure = plan.structure || {};
  const dailyTargets = structure.daily_targets || {};
  const reminderSchedule = structure.reminder_schedule || {};
  const hydrationTips = structure.hydration_tips || [];

  // Calculate glasses remaining for display
  const targetGlasses = dailyTargets.glasses || 8;
  const totalMl = dailyTargets.total_ml || 2000;
  const glassSizeMl = dailyTargets.glass_size_ml || 250;

  return (
    <Card shadow="lg" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="water" size={28} color={brandColors.primary} />
        </View>
        <Text style={styles.cardTitle}>
          {t("goals.plan.hydration_title") || "Hydration Plan"}
        </Text>
      </View>

      {/* Daily Target */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t("goals.plan.daily_target") || "Daily Target"}
        </Text>
        <View style={styles.targetCard}>
          <View style={styles.targetMain}>
            <Text style={styles.targetValue}>{targetGlasses}</Text>
            <Text style={styles.targetUnit}>
              {t("goals.plan.glasses") || "glasses"}
            </Text>
          </View>
          <View style={styles.targetDivider} />
          <View style={styles.targetSecondary}>
            <Text style={styles.targetMl}>{totalMl}ml</Text>
            <Text style={styles.targetSubtext}>
              ({glassSizeMl}ml {t("goals.plan.per_glass") || "per glass"})
            </Text>
          </View>
        </View>
      </View>

      {/* Reminder Schedule */}
      {reminderSchedule.suggested_times &&
        reminderSchedule.suggested_times.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("goals.plan.reminder_schedule") || "Reminder Schedule"}
            </Text>
            <View style={styles.timesContainer}>
              {reminderSchedule.suggested_times.map(
                (time: string, index: number) => (
                  <View key={index} style={styles.timeChip}>
                    <Ionicons
                      name="notifications-outline"
                      size={14}
                      color={brandColors.primary}
                    />
                    <Text style={styles.timeText}>{time}</Text>
                  </View>
                ),
              )}
            </View>
            {reminderSchedule.frequency && (
              <Text style={styles.frequencyNote}>
                {reminderSchedule.frequency === "every_2_hours"
                  ? t("goals.plan.every_2_hours") || "Every 2 hours"
                  : reminderSchedule.frequency}
              </Text>
            )}
          </View>
        )}

      {/* Hydration Tips */}
      {hydrationTips.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("goals.plan.quick_tips") || "Quick Tips"}
          </Text>
          <View style={styles.tipsContainer}>
            {hydrationTips.slice(0, 3).map((tip: string, index: number) => (
              <View key={index} style={styles.tipRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={brandColors.primary}
                />
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </Card>
  );
}

const makeHydrationPlanCardStyles = (tokens: any, colors: any, brand: any) => ({
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
    backgroundColor: "#3B82F6" + "1A", // Blue tint for water
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
    marginBottom: toRN(tokens.spacing[4]),
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[3]),
  },

  // Target Card
  targetCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    padding: toRN(tokens.spacing[4]),
    backgroundColor: "#3B82F6" + "10", // Light blue background
    borderRadius: toRN(tokens.borderRadius.lg),
    borderWidth: 1,
    borderColor: "#3B82F6" + "20",
  },
  targetMain: {
    alignItems: "center" as const,
    flex: 1,
  },
  targetValue: {
    fontSize: toRN(tokens.typography.fontSize["4xl"]),
    fontFamily: fontFamily.groteskBold,
    color: "#3B82F6",
  },
  targetUnit: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.secondary,
    marginTop: toRN(tokens.spacing[0.5]),
  },
  targetDivider: {
    width: 1,
    height: "60%",
    backgroundColor: colors.border.default,
    marginHorizontal: toRN(tokens.spacing[4]),
  },
  targetSecondary: {
    alignItems: "center" as const,
    flex: 1,
  },
  targetMl: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
  },
  targetSubtext: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[0.5]),
  },

  // Times
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
    textTransform: "capitalize" as const,
  },
  frequencyNote: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[2]),
  },

  // Tips
  tipsContainer: {
    gap: toRN(tokens.spacing[2]),
  },
  tipRow: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: toRN(tokens.spacing[2]),
  },
  tipText: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.4,
  },
});
