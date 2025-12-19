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

interface MealPlanCardProps {
  plan: any; // Full structured_data from actionable_plans
}

export function MealPlanCard({ plan }: MealPlanCardProps) {
  const styles = useStyles(makeMealPlanCardStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();

  const structure = plan.structure || {};
  const nutritionalTargets = structure.nutritional_targets || {};
  const reminders = structure.reminders || {};

  return (
    <Card shadow="lg" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="nutrition" size={28} color={brandColors.primary} />
        </View>
        <Text style={styles.cardTitle}>{t("goals.plan.meal_title")}</Text>
      </View>

      {/* Nutritional Targets */}
      {nutritionalTargets.protein && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("goals.plan.daily_targets")}
          </Text>
          <View style={styles.targetCard}>
            <Ionicons name="flask-outline" size={24} color={brandColors.primary} />
            <View style={styles.targetInfo}>
              <Text style={styles.targetValue}>
                {nutritionalTargets.protein}g
              </Text>
              <Text style={styles.targetLabel}>
                {t("goals.plan.protein")}
              </Text>
            </View>
          </View>

          {nutritionalTargets.calories && (
            <View style={styles.targetCard}>
              <Ionicons name="flame-outline" size={24} color={colors.text.secondary} />
              <View style={styles.targetInfo}>
                <Text style={styles.targetValue}>
                  {nutritionalTargets.calories}
                </Text>
                <Text style={styles.targetLabel}>
                  {t("goals.plan.calories")}
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Meal Schedule */}
      {Object.keys(reminders).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("goals.plan.meal_schedule")}
          </Text>
          <View style={styles.mealSchedule}>
            {reminders.breakfast && (
              <View style={styles.mealRow}>
                <Text style={styles.mealIcon}>🌅</Text>
                <Text style={styles.mealName}>
                  {t("goals.plan.breakfast")}
                </Text>
                <Text style={styles.mealTime}>{reminders.breakfast}</Text>
              </View>
            )}
            {reminders.lunch && (
              <View style={styles.mealRow}>
                <Text style={styles.mealIcon}>🌞</Text>
                <Text style={styles.mealName}>{t("goals.plan.lunch")}</Text>
                <Text style={styles.mealTime}>{reminders.lunch}</Text>
              </View>
            )}
            {reminders.dinner && (
              <View style={styles.mealRow}>
                <Text style={styles.mealIcon}>🌙</Text>
                <Text style={styles.mealName}>{t("goals.plan.dinner")}</Text>
                <Text style={styles.mealTime}>{reminders.dinner}</Text>
              </View>
            )}
          </View>
        </View>
      )}
    </Card>
  );
}

const makeMealPlanCardStyles = (tokens: any, colors: any, brand: any) => ({
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
    marginBottom: toRN(tokens.spacing[4]),
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[3]),
  },
  targetCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
    padding: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.lg),
    marginBottom: toRN(tokens.spacing[2]),
  },
  targetInfo: {
    flex: 1,
  },
  targetValue: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.groteskBold,
    color: brand.primary,
    marginBottom: toRN(tokens.spacing[0.5]),
  },
  targetLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.secondary,
  },
  mealSchedule: {
    gap: toRN(tokens.spacing[2]),
  },
  mealRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[2]),
  },
  mealIcon: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    width: toRN(tokens.spacing[8]),
  },
  mealName: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.primary,
  },
  mealTime: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskSemiBold,
    color: brand.primary,
  },
});

