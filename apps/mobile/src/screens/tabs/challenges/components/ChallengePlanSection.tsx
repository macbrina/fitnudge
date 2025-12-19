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
import { WorkoutPlanCard } from "@/screens/tabs/goals/components/WorkoutPlanCard";
import { MealPlanCard } from "@/screens/tabs/goals/components/MealPlanCard";
import { HabitPlanCard } from "@/screens/tabs/goals/components/HabitPlanCard";
import { PlanGuidanceCard } from "@/screens/tabs/goals/components/PlanGuidanceCard";

// Matches the backend structure: { status, plan_type, structured_data, error_message }
interface ActionablePlanData {
  status?: string;
  plan_type?: string;
  structured_data?: Record<string, unknown>;
  error_message?: string | null;
}

interface ChallengePlanSectionProps {
  actionablePlan?: ActionablePlanData | null;
  category?: string;
}

export function ChallengePlanSection({
  actionablePlan,
  category,
}: ChallengePlanSectionProps) {
  const styles = useStyles(makeChallengePlanSectionStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();

  // No actionable plan data or no structured_data
  if (!actionablePlan || !actionablePlan.structured_data) {
    return (
      <Card shadow="md" style={styles.container}>
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconContainer}>
            <Ionicons
              name="fitness-outline"
              size={48}
              color={colors.text.tertiary}
            />
          </View>
          <Text style={styles.emptyTitle}>
            {t("challenges.no_plan") || "No Plan Available"}
          </Text>
          <Text style={styles.emptyText}>
            {t("challenges.no_plan_description") ||
              "This challenge doesn't have a structured plan. Just follow the challenge description and check in daily!"}
          </Text>
        </View>
      </Card>
    );
  }

  const planType = actionablePlan.plan_type;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const structuredData = actionablePlan.structured_data as any;

  // Plan generation failed or in progress
  if (actionablePlan.status === "failed") {
    return (
      <Card shadow="md" style={styles.errorCard}>
        <Ionicons
          name="alert-circle-outline"
          size={32}
          color={colors.feedback.error}
        />
        <Text style={styles.errorTitle}>
          {t("goals.plan.failed_title") || "Plan Generation Failed"}
        </Text>
        <Text style={styles.errorText}>
          {actionablePlan.error_message ||
            t("goals.plan.failed_message") ||
            "The plan couldn't be generated."}
        </Text>
      </Card>
    );
  }

  if (actionablePlan.status === "generating") {
    return (
      <Card shadow="md" style={styles.loadingCard}>
        <Ionicons name="sparkles" size={32} color={brandColors.primary} />
        <Text style={styles.loadingTitle}>
          {t("goals.plan.generating_title") || "Generating Your Plan"}
        </Text>
        <Text style={styles.loadingText}>
          {t("goals.plan.generating_message") ||
            "AI is creating your personalized plan..."}
        </Text>
      </Card>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.planHeader}>
        <Text style={styles.planHeaderTitle}>
          {t("challenges.workout_plan") || "Workout Plan"}
        </Text>
        <View style={styles.aiBadge}>
          <Ionicons name="sparkles" size={12} color={brandColors.primary} />
          <Text style={styles.aiBadgeText}>AI</Text>
        </View>
      </View>

      {/* Plan-specific card */}
      {planType === "workout_plan" && structuredData && (
        <WorkoutPlanCard plan={structuredData} />
      )}
      {planType === "meal_plan" && structuredData && (
        <MealPlanCard plan={structuredData} />
      )}
      {planType === "habit_plan" && structuredData && (
        <HabitPlanCard plan={structuredData} />
      )}

      {/* Fallback for unknown plan types */}
      {!["workout_plan", "meal_plan", "habit_plan"].includes(planType || "") &&
        structuredData && (
          <Card shadow="sm" style={styles.genericPlanCard}>
            <Text style={styles.genericPlanTitle}>
              {t("challenges.your_plan") || "Your Plan"}
            </Text>
            {typeof structuredData.description === "string" && (
              <Text style={styles.genericPlanText}>
                {structuredData.description}
              </Text>
            )}
          </Card>
        )}

      {/* Guidance Card - contains tips and description (inside structured_data.guidance) */}
      {structuredData?.guidance &&
        typeof structuredData.guidance.description === "string" &&
        Array.isArray(structuredData.guidance.tips) && (
          <PlanGuidanceCard guidance={structuredData.guidance} />
        )}
    </View>
  );
}

const makeChallengePlanSectionStyles = (
  tokens: any,
  colors: any,
  brand: any
) => ({
  container: {
    gap: toRN(tokens.spacing[3]),
    padding: toRN(tokens.spacing[4]),
  },
  planHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[2]),
  },
  planHeaderTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
  aiBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[1]),
    backgroundColor: brand.primary + "15",
    borderRadius: toRN(tokens.borderRadius.full),
  },
  aiBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: brand.primary,
  },
  emptyCard: {
    padding: toRN(tokens.spacing[6]),
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.bg.muted,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[2]),
  },
  emptyTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    textAlign: "center" as const,
  },
  emptyText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    lineHeight: toRN(tokens.typography.fontSize.sm * 1.5),
  },
  errorCard: {
    padding: toRN(tokens.spacing[6]),
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
  },
  errorTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
  errorText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const,
  },
  loadingCard: {
    padding: toRN(tokens.spacing[6]),
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
  },
  loadingTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
  loadingText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const,
  },
  genericPlanCard: {
    padding: toRN(tokens.spacing[4]),
    gap: toRN(tokens.spacing[2]),
  },
  genericPlanTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
  genericPlanText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm * 1.5),
  },
});
