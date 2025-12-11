import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Card } from "@/components/ui/Card";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/lib/i18n";
import {
  usePlanStatus,
  useGoalPlan,
  useRetryPlanGeneration,
} from "@/hooks/api/useActionablePlans";
import { PlanStatusBadge } from "./PlanStatusBadge";
import { WorkoutPlanCard } from "./WorkoutPlanCard";
import { MealPlanCard } from "./MealPlanCard";
import { HabitPlanCard } from "./HabitPlanCard";
import { AccountabilityPlanCard } from "./AccountabilityPlanCard";
import { PlanGuidanceCard } from "./PlanGuidanceCard";
import Button from "@/components/ui/Button";

interface PlanSectionProps {
  goalId: string;
}

export function PlanSection({ goalId }: PlanSectionProps) {
  const styles = useStyles(makePlanSectionStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();

  const { data: statusData, isLoading: statusLoading } = usePlanStatus(goalId);
  const { data: planData, isLoading: planLoading } = useGoalPlan(
    goalId,
    statusData?.status === "completed"
  );
  const retryMutation = useRetryPlanGeneration();

  const status = statusData?.status || "not_started";
  const plan = planData?.plan;

  // Loading state - show skeleton while status or plan is loading
  if (statusLoading || planLoading) {
    return (
      <Card shadow="md" style={styles.loadingCard}>
        <View style={styles.loadingHeader}>
          <Ionicons name="sparkles" size={24} color={brandColors.primary} />
          <Text style={styles.loadingTitle}>
            {status === "generating"
              ? t("goals.plan.generating_title")
              : t("goals.plan.loading_title")}
          </Text>
        </View>

        <View style={styles.loadingContent}>
          <SkeletonBox
            height={60}
            borderRadius={toRN(tokens.borderRadius.lg)}
          />
          <SkeletonBox
            height={40}
            borderRadius={toRN(tokens.borderRadius.lg)}
            style={{ marginTop: toRN(tokens.spacing[3]) }}
          />
          <SkeletonBox
            height={40}
            borderRadius={toRN(tokens.borderRadius.lg)}
            style={{ marginTop: toRN(tokens.spacing[3]) }}
          />
        </View>

        <Text style={styles.loadingMessage}>
          {status === "generating"
            ? t("goals.plan.generating_message")
            : t("goals.plan.loading_message")}
        </Text>
      </Card>
    );
  }

  // Failed state
  if (status === "failed") {
    return (
      <Card shadow="md" style={styles.errorCard}>
        <View style={styles.errorHeader}>
          <Ionicons
            name="alert-circle"
            size={48}
            color={colors.feedback.error}
          />
          <Text style={styles.errorTitle}>{t("goals.plan.failed_title")}</Text>
        </View>

        <Text style={styles.errorMessage}>
          {statusData?.error_message || t("goals.plan.failed_message")}
        </Text>

        <Text style={styles.errorHelpText}>{t("goals.plan.failed_help")}</Text>

        <Button
          title={t("goals.plan.retry_generation")}
          onPress={() => retryMutation.mutate(goalId)}
          disabled={retryMutation.isPending}
          loading={retryMutation.isPending}
          variant="primary"
          size="md"
          fullWidth
          leftIcon="refresh"
        />
      </Card>
    );
  }

  // Not started state (shouldn't happen, but handle it)
  if (status === "not_started") {
    return null;
  }

  // Ready state - Display plan
  if (status === "completed" && plan) {
    const planType = plan.plan_type;
    const structuredData = plan.structured_data;

    return (
      <View style={styles.container}>
        <View style={styles.planHeader}>
          <Text style={styles.planHeaderTitle}>
            {t("goals.plan.your_ai_plan")}
          </Text>
          <PlanStatusBadge status={status} size="sm" />
        </View>

        {/* Plan-specific card */}
        {planType === "workout_plan" && (
          <WorkoutPlanCard plan={structuredData} />
        )}
        {planType === "meal_plan" && <MealPlanCard plan={structuredData} />}
        {planType === "habit_plan" && <HabitPlanCard plan={structuredData} />}
        {planType === "accountability_plan" && (
          <AccountabilityPlanCard plan={structuredData} />
        )}

        {/* Guidance Card (always shown) */}
        {structuredData.guidance && (
          <PlanGuidanceCard guidance={structuredData.guidance} />
        )}
      </View>
    );
  }

  return null;
}

const makePlanSectionStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    marginBottom: toRN(tokens.spacing[6]),
  },
  planHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[4]),
    paddingHorizontal: toRN(tokens.spacing[1]),
  },
  planHeaderTitle: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
  },
  loadingCard: {
    marginBottom: toRN(tokens.spacing[4]),
  },
  loadingHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[4]),
  },
  loadingTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
  },
  loadingContent: {
    marginBottom: toRN(tokens.spacing[4]),
  },
  loadingMessage: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.tertiary,
    textAlign: "center" as const,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5,
  },
  errorCard: {
    marginBottom: toRN(tokens.spacing[4]),
    alignItems: "center" as const,
  },
  errorHeader: {
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[3]),
  },
  errorTitle: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
    marginTop: toRN(tokens.spacing[2]),
    textAlign: "center" as const,
  },
  errorMessage: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[2]),
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5,
  },
  errorHelpText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.tertiary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[4]),
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5,
  },
});
