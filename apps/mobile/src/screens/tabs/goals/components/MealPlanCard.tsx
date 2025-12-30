import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Card } from "@/components/ui/Card";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/lib/i18n";
import { MOBILE_ROUTES } from "@/lib/routes";

interface MealPlanCardProps {
  plan: any; // Full structured_data from actionable_plans
  goalId?: string;
  challengeId?: string;
}

export function MealPlanCard({ plan, goalId, challengeId }: MealPlanCardProps) {
  const styles = useStyles(makeMealPlanCardStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Navigate to meal history
  const handleViewHistory = () => {
    if (goalId) {
      router.push(MOBILE_ROUTES.GOALS.MEAL_HISTORY(goalId));
    } else if (challengeId) {
      router.push(MOBILE_ROUTES.CHALLENGES.MEAL_HISTORY(challengeId));
    }
  };

  const structure = plan.structure || {};

  // Structure fields
  const dailyTargets = structure.daily_targets || {};
  const mealSchedule = structure.meal_schedule || {};
  const mealSuggestions = structure.meal_suggestions || {};

  // Extract values
  const calories = dailyTargets.calories;
  const proteinGrams = dailyTargets.protein_grams;
  const focusArea = dailyTargets.focus_area || "balanced_eating";
  const mealsPerDay = mealSchedule.meals_per_day || 3;

  // Check if we have meal suggestions to show
  const hasMealSuggestions =
    mealSuggestions.breakfast_ideas?.length > 0 ||
    mealSuggestions.lunch_ideas?.length > 0 ||
    mealSuggestions.dinner_ideas?.length > 0 ||
    mealSuggestions.snack_ideas?.length > 0;

  // Focus area display
  const focusAreaLabels: Record<string, string> = {
    portion_control: t("goals.plan.focus_portion_control") || "Portion Control",
    high_protein: t("goals.plan.focus_high_protein") || "High Protein",
    balanced_eating: t("goals.plan.focus_balanced") || "Balanced Eating",
    calorie_deficit: t("goals.plan.focus_calorie_deficit") || "Calorie Deficit",
    calorie_surplus: t("goals.plan.focus_calorie_surplus") || "Calorie Surplus",
    meal_timing: t("goals.plan.focus_meal_timing") || "Meal Timing",
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <Card shadow="lg" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="nutrition" size={28} color={brandColors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.cardTitle}>
            {t("goals.plan.meal_title") || "Meal Plan"}
          </Text>
          <Text style={styles.cardSubtitle}>
            {focusAreaLabels[focusArea] || focusArea}
          </Text>
        </View>
      </View>

      {/* Daily Targets */}
      {(calories || proteinGrams) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("goals.plan.daily_targets") || "Daily Targets"}
          </Text>
          <View style={styles.targetsRow}>
            {calories && (
              <View style={styles.targetCard}>
                <Ionicons name="flame-outline" size={24} color="#F59E0B" />
                <View style={styles.targetInfo}>
                  <Text style={styles.targetValue}>{calories}</Text>
                  <Text style={styles.targetLabel}>
                    {t("goals.plan.calories") || "calories"}
                  </Text>
                </View>
              </View>
            )}
            {proteinGrams && (
              <View style={styles.targetCard}>
                <Ionicons
                  name="flask-outline"
                  size={24}
                  color={brandColors.primary}
                />
                <View style={styles.targetInfo}>
                  <Text style={styles.targetValue}>{proteinGrams}g</Text>
                  <Text style={styles.targetLabel}>
                    {t("goals.plan.protein") || "protein"}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Meal Schedule */}
      {mealSchedule.suggested_times && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("goals.plan.meal_schedule") || "Meal Schedule"}
          </Text>
          <View style={styles.scheduleInfo}>
            <Text style={styles.scheduleText}>
              {mealsPerDay} {t("goals.plan.meals_day") || "meals per day"}
              {mealSchedule.include_snacks &&
                ` + ${t("goals.plan.snacks") || "snacks"}`}
            </Text>
          </View>
          <View style={styles.mealSchedule}>
            {mealSchedule.suggested_times.breakfast && (
              <View style={styles.mealRow}>
                <Ionicons name="sunny-outline" size={18} color="#F59E0B" />
                <Text style={styles.mealName}>
                  {t("goals.plan.breakfast") || "Breakfast"}
                </Text>
                <Text style={styles.mealTime}>
                  {mealSchedule.suggested_times.breakfast}
                </Text>
              </View>
            )}
            {mealSchedule.suggested_times.lunch && (
              <View style={styles.mealRow}>
                <Ionicons
                  name="partly-sunny-outline"
                  size={18}
                  color="#F97316"
                />
                <Text style={styles.mealName}>
                  {t("goals.plan.lunch") || "Lunch"}
                </Text>
                <Text style={styles.mealTime}>
                  {mealSchedule.suggested_times.lunch}
                </Text>
              </View>
            )}
            {mealSchedule.suggested_times.dinner && (
              <View style={styles.mealRow}>
                <Ionicons name="moon-outline" size={18} color="#6366F1" />
                <Text style={styles.mealName}>
                  {t("goals.plan.dinner") || "Dinner"}
                </Text>
                <Text style={styles.mealTime}>
                  {mealSchedule.suggested_times.dinner}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Meal Suggestions */}
      {hasMealSuggestions && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("goals.plan.meal_ideas") || "Meal Ideas"}
          </Text>

          {/* Breakfast Ideas */}
          {mealSuggestions.breakfast_ideas?.length > 0 && (
            <TouchableOpacity
              style={styles.collapsibleHeader}
              onPress={() => toggleSection("breakfast")}
              activeOpacity={0.7}
            >
              <View style={styles.collapsibleLeft}>
                <Ionicons name="sunny-outline" size={18} color="#F59E0B" />
                <Text style={styles.collapsibleTitle}>
                  {t("goals.plan.breakfast") || "Breakfast"}
                </Text>
              </View>
              <Ionicons
                name={
                  expandedSection === "breakfast"
                    ? "chevron-up"
                    : "chevron-down"
                }
                size={18}
                color={colors.text.tertiary}
              />
            </TouchableOpacity>
          )}
          {expandedSection === "breakfast" &&
            mealSuggestions.breakfast_ideas && (
              <View style={styles.suggestionsList}>
                {mealSuggestions.breakfast_ideas.map(
                  (idea: string, index: number) => (
                    <View key={index} style={styles.suggestionItem}>
                      <Text style={styles.suggestionBullet}>•</Text>
                      <Text style={styles.suggestionText}>{idea}</Text>
                    </View>
                  ),
                )}
              </View>
            )}

          {/* Lunch Ideas */}
          {mealSuggestions.lunch_ideas?.length > 0 && (
            <TouchableOpacity
              style={styles.collapsibleHeader}
              onPress={() => toggleSection("lunch")}
              activeOpacity={0.7}
            >
              <View style={styles.collapsibleLeft}>
                <Ionicons
                  name="partly-sunny-outline"
                  size={18}
                  color="#F97316"
                />
                <Text style={styles.collapsibleTitle}>
                  {t("goals.plan.lunch") || "Lunch"}
                </Text>
              </View>
              <Ionicons
                name={
                  expandedSection === "lunch" ? "chevron-up" : "chevron-down"
                }
                size={18}
                color={colors.text.tertiary}
              />
            </TouchableOpacity>
          )}
          {expandedSection === "lunch" && mealSuggestions.lunch_ideas && (
            <View style={styles.suggestionsList}>
              {mealSuggestions.lunch_ideas.map(
                (idea: string, index: number) => (
                  <View key={index} style={styles.suggestionItem}>
                    <Text style={styles.suggestionBullet}>•</Text>
                    <Text style={styles.suggestionText}>{idea}</Text>
                  </View>
                ),
              )}
            </View>
          )}

          {/* Dinner Ideas */}
          {mealSuggestions.dinner_ideas?.length > 0 && (
            <TouchableOpacity
              style={styles.collapsibleHeader}
              onPress={() => toggleSection("dinner")}
              activeOpacity={0.7}
            >
              <View style={styles.collapsibleLeft}>
                <Ionicons name="moon-outline" size={18} color="#6366F1" />
                <Text style={styles.collapsibleTitle}>
                  {t("goals.plan.dinner") || "Dinner"}
                </Text>
              </View>
              <Ionicons
                name={
                  expandedSection === "dinner" ? "chevron-up" : "chevron-down"
                }
                size={18}
                color={colors.text.tertiary}
              />
            </TouchableOpacity>
          )}
          {expandedSection === "dinner" && mealSuggestions.dinner_ideas && (
            <View style={styles.suggestionsList}>
              {mealSuggestions.dinner_ideas.map(
                (idea: string, index: number) => (
                  <View key={index} style={styles.suggestionItem}>
                    <Text style={styles.suggestionBullet}>•</Text>
                    <Text style={styles.suggestionText}>{idea}</Text>
                  </View>
                ),
              )}
            </View>
          )}

          {/* Snack Ideas */}
          {mealSuggestions.snack_ideas?.length > 0 && (
            <TouchableOpacity
              style={styles.collapsibleHeader}
              onPress={() => toggleSection("snacks")}
              activeOpacity={0.7}
            >
              <View style={styles.collapsibleLeft}>
                <Ionicons name="cafe-outline" size={18} color="#10B981" />
                <Text style={styles.collapsibleTitle}>
                  {t("goals.plan.snacks") || "Snacks"}
                </Text>
              </View>
              <Ionicons
                name={
                  expandedSection === "snacks" ? "chevron-up" : "chevron-down"
                }
                size={18}
                color={colors.text.tertiary}
              />
            </TouchableOpacity>
          )}
          {expandedSection === "snacks" && mealSuggestions.snack_ideas && (
            <View style={styles.suggestionsList}>
              {mealSuggestions.snack_ideas.map(
                (idea: string, index: number) => (
                  <View key={index} style={styles.suggestionItem}>
                    <Text style={styles.suggestionBullet}>•</Text>
                    <Text style={styles.suggestionText}>{idea}</Text>
                  </View>
                ),
              )}
            </View>
          )}
        </View>
      )}

      {/* View History Link */}
      {(goalId || challengeId) && (
        <TouchableOpacity
          style={styles.historyLink}
          onPress={handleViewHistory}
          activeOpacity={0.7}
        >
          <Ionicons name="time-outline" size={16} color={brandColors.primary} />
          <Text style={styles.historyLinkText}>
            {t("meals.view_history") || "View Meal History"}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={brandColors.primary}
          />
        </TouchableOpacity>
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
  headerText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
  },
  cardSubtitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskMedium,
    color: brand.primary,
    marginTop: toRN(tokens.spacing[0.5]),
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

  // Targets
  targetsRow: {
    flexDirection: "row" as const,
    gap: toRN(tokens.spacing[3]),
  },
  targetCard: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
    padding: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.lg),
  },
  targetInfo: {
    flex: 1,
  },
  targetValue: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[0.5]),
  },
  targetLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.secondary,
  },

  // Schedule
  scheduleInfo: {
    marginBottom: toRN(tokens.spacing[2]),
  },
  scheduleText: {
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
    paddingHorizontal: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.md),
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
    textTransform: "capitalize" as const,
  },

  // Collapsible Meal Ideas
  collapsibleHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.md),
    marginBottom: toRN(tokens.spacing[2]),
  },
  collapsibleLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
  },
  collapsibleTitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    textTransform: "capitalize" as const,
  },
  suggestionsList: {
    paddingHorizontal: toRN(tokens.spacing[3]),
    paddingBottom: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[2]),
    backgroundColor: colors.bg.secondary,
    borderRadius: toRN(tokens.borderRadius.md),
    marginTop: -toRN(tokens.spacing[2]),
  },
  suggestionItem: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[1.5]),
  },
  suggestionBullet: {
    fontSize: toRN(tokens.typography.fontSize.base),
    color: brand.primary,
  },
  suggestionText: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.4,
  },
  historyLink: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[2]),
    marginTop: toRN(tokens.spacing[4]),
    paddingTop: toRN(tokens.spacing[4]),
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  historyLinkText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: brand.primary,
  },
});
