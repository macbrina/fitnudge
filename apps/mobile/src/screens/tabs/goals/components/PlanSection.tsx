import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Card } from "@/components/ui/Card";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/lib/i18n";
import { MOBILE_ROUTES } from "@/lib/routes";
import {
  usePlanStatus,
  useGoalPlan,
  useRetryPlanGeneration,
} from "@/hooks/api/useActionablePlans";
import { useWorkoutSession } from "@/hooks/useWorkoutSession";
import { PlanStatusBadge } from "./PlanStatusBadge";
import { WorkoutPlanCard } from "./WorkoutPlanCard";
import { MealPlanCard } from "./MealPlanCard";
import { HabitPlanCard } from "./HabitPlanCard";
import { AccountabilityPlanCard } from "./AccountabilityPlanCard";
import { PlanGuidanceCard } from "./PlanGuidanceCard";
import { ExerciseCard } from "./ExerciseCard";
import Button from "@/components/ui/Button";

type TabType = "workout" | "exercises" | "tips" | "progress";

interface PlanSectionProps {
  goalId: string;
  planStatus?: {
    status: string;
    error_message?: string | null;
  };
}

export function PlanSection({
  goalId,
  planStatus: propPlanStatus,
}: PlanSectionProps) {
  const styles = useStyles(makePlanSectionStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("workout");

  // Use prop status if provided, otherwise fetch
  const { data: fetchedStatusData, isLoading: statusLoading } = usePlanStatus(
    goalId,
    !propPlanStatus
  );

  const statusData = propPlanStatus || fetchedStatusData;
  const { data: planData, isLoading: planLoading } = useGoalPlan(
    goalId,
    statusData?.status === "completed"
  );
  const retryMutation = useRetryPlanGeneration();

  // Check for active workout session
  const { canResume, resumePercentage, isLoadingActiveSession } =
    useWorkoutSession(goalId);

  const status = statusData?.status || "not_started";
  const plan = planData?.plan;

  // Navigate to workout player - always starts fresh (resets any existing session)
  const handleStartWorkout = () => {
    router.push(MOBILE_ROUTES.WORKOUT.PLAYER_RESTART(goalId));
  };

  // Navigate to workout player with resume flag
  const handleContinueWorkout = () => {
    router.push(MOBILE_ROUTES.WORKOUT.PLAYER_RESUME(goalId));
  };

  // Loading state
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

  // Not started state
  if (status === "not_started") {
    return null;
  }

  // Ready state - Display plan
  if (status === "completed" && plan) {
    const planType = plan.plan_type;
    const structuredData = plan.structured_data;

    // For workout plans, show tabbed interface
    if (planType === "workout_plan") {
      const structure = structuredData.structure || {};
      const mainWorkout = structure.main_workout || structure.routine || {};
      const exercises = mainWorkout.exercises || [];
      // Note: Backend uses snake_case (warm_up, cool_down)
      const warmupExercises = structure.warm_up?.exercises || [];
      const cooldownExercises = structure.cool_down?.exercises || [];
      const totalExercisesCount =
        warmupExercises.length + exercises.length + cooldownExercises.length;
      const guidance = structuredData.guidance || {};
      const progression = structure.progression || {};

      const tabs: { key: TabType; label: string; icon: string }[] = [
        { key: "workout", label: t("goals.plan.workout_tab"), icon: "barbell" },
        {
          key: "exercises",
          label: t("goals.plan.exercises_tab"),
          icon: "list",
        },
        { key: "tips", label: t("goals.plan.tips_tab"), icon: "bulb" },
        {
          key: "progress",
          label: t("goals.plan.progress_tab"),
          icon: "trending-up",
        },
      ];

      return (
        <View style={styles.container}>
          {/* Tab Bar */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabBar}
            contentContainerStyle={styles.tabBarContent}
          >
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={16}
                  color={
                    activeTab === tab.key
                      ? brandColors.primary
                      : colors.text.tertiary
                  }
                />
                <Text
                  style={[
                    styles.tabText,
                    activeTab === tab.key && styles.tabTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Tab Content */}
          <Card shadow="lg" style={styles.tabContent}>
            {/* Workout Tab */}
            {activeTab === "workout" && (
              <View>
                {/* Guidance Description */}
                {guidance.description && (
                  <Text style={styles.guidanceDescription}>
                    {guidance.description}
                  </Text>
                )}

                {/* Summary Stats */}
                <View style={styles.summaryStats}>
                  <View style={styles.statBox}>
                    <Ionicons
                      name="time-outline"
                      size={20}
                      color={brandColors.primary}
                    />
                    <Text style={styles.statValue}>
                      {structure.total_duration_minutes || 30}
                    </Text>
                    <Text style={styles.statLabel}>{t("common.minutes")}</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Ionicons
                      name="barbell-outline"
                      size={20}
                      color={brandColors.primary}
                    />
                    <Text style={styles.statValue}>{totalExercisesCount}</Text>
                    <Text style={styles.statLabel}>
                      {t("workout.exercises")}
                    </Text>
                  </View>
                  <View style={styles.statBox}>
                    <Ionicons
                      name="layers-outline"
                      size={20}
                      color={brandColors.primary}
                    />
                    <Text style={styles.statValue}>
                      {exercises.reduce(
                        (sum: number, ex: any) => sum + (ex.sets || 3),
                        0
                      )}
                    </Text>
                    <Text style={styles.statLabel}>
                      {t("workout.total_sets")}
                    </Text>
                  </View>
                </View>

                {/* Weekly Focus */}
                {progression.weekly_focus && (
                  <View style={styles.weeklyFocus}>
                    <Text style={styles.weeklyFocusLabel}>
                      {t("goals.plan.weekly_focus")}
                    </Text>
                    <Text style={styles.weeklyFocusText}>
                      {progression.weekly_focus}
                    </Text>
                  </View>
                )}

                {/* Start/Continue Workout Button */}
                {canResume ? (
                  <View style={styles.workoutButtonGroup}>
                    <Button
                      title={t("workout.continue", {
                        percent: Math.round(resumePercentage),
                      })}
                      onPress={handleContinueWorkout}
                      variant="primary"
                      fullWidth
                      leftIcon="play"
                    />
                    <Button
                      title={t("workout.restart")}
                      onPress={handleStartWorkout}
                      variant="outline"
                      fullWidth
                      leftIcon="refresh"
                    />
                  </View>
                ) : (
                  <Button
                    title={t("workout.start_workout")}
                    onPress={handleStartWorkout}
                    variant="primary"
                    fullWidth
                    leftIcon="play"
                    style={{ marginTop: toRN(tokens.spacing[4]) }}
                  />
                )}
              </View>
            )}

            {/* Exercises Tab */}
            {activeTab === "exercises" && (
              <View>
                <Text style={styles.tabSectionTitle}>
                  {totalExercisesCount} {t("workout.exercises")}
                </Text>

                {/* Warmup Exercises */}
                {warmupExercises.length > 0 && (
                  <View style={styles.exerciseSection}>
                    <Text style={styles.exerciseSectionLabel}>
                      {t("workout.phase.warm_up")}
                    </Text>
                    {warmupExercises.map((exercise: any, index: number) => (
                      <ExerciseCard
                        key={`warmup-${index}`}
                        exercise={exercise}
                        index={index}
                      />
                    ))}
                  </View>
                )}

                {/* Main Workout Exercises */}
                {exercises.length > 0 && (
                  <View style={styles.exerciseSection}>
                    <Text style={styles.exerciseSectionLabel}>
                      {t("workout.phase.work")}
                    </Text>
                    {exercises.map((exercise: any, index: number) => (
                      <ExerciseCard
                        key={`main-${index}`}
                        exercise={exercise}
                        index={index}
                      />
                    ))}
                  </View>
                )}

                {/* Cooldown Exercises */}
                {cooldownExercises.length > 0 && (
                  <View style={styles.exerciseSection}>
                    <Text style={styles.exerciseSectionLabel}>
                      {t("workout.phase.cool_down")}
                    </Text>
                    {cooldownExercises.map((exercise: any, index: number) => (
                      <ExerciseCard
                        key={`cooldown-${index}`}
                        exercise={exercise}
                        index={index}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Tips Tab */}
            {activeTab === "tips" && (
              <View>
                {guidance.description && (
                  <View style={styles.guidanceDescription}>
                    <Text style={styles.guidanceText}>
                      {guidance.description}
                    </Text>
                  </View>
                )}

                {guidance.tips && guidance.tips.length > 0 && (
                  <View style={styles.tipsContainer}>
                    <Text style={styles.tabSectionTitle}>
                      {t("goals.plan.tips")}
                    </Text>
                    {guidance.tips.map((tip: string, index: number) => (
                      <View key={index} style={styles.tipItem}>
                        <View style={styles.tipIcon}>
                          <Ionicons
                            name="bulb"
                            size={16}
                            color={brandColors.primary}
                          />
                        </View>
                        <Text style={styles.tipText}>{tip}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Progress Tab */}
            {activeTab === "progress" && (
              <View>
                {/* Current Week */}
                {progression.current_week && (
                  <View style={styles.currentWeek}>
                    <Text style={styles.currentWeekLabel}>
                      {t("goals.plan.current_week")}
                    </Text>
                    <View style={styles.weekBadge}>
                      <Text style={styles.weekBadgeText}>
                        {t("goals.plan.week_x", {
                          week: progression.current_week,
                        })}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Weekly Adjustments */}
                {progression.weekly_adjustments &&
                  progression.weekly_adjustments.length > 0 && (
                    <View style={styles.weeklyProgression}>
                      <Text style={styles.tabSectionTitle}>
                        {t("goals.plan.progression_schedule")}
                      </Text>
                      {progression.weekly_adjustments.map(
                        (week: any, index: number) => (
                          <View
                            key={index}
                            style={[
                              styles.weekItem,
                              week.week === progression.current_week &&
                                styles.weekItemCurrent,
                            ]}
                          >
                            <View style={styles.weekHeader}>
                              <Text
                                style={[
                                  styles.weekNumber,
                                  week.week === progression.current_week &&
                                    styles.weekNumberCurrent,
                                ]}
                              >
                                {t("goals.plan.week_x", { week: week.week })}
                              </Text>
                              <Text style={styles.weekIntensity}>
                                {week.intensity}
                              </Text>
                            </View>
                            <Text style={styles.weekFocus}>{week.focus}</Text>
                          </View>
                        )
                      )}
                    </View>
                  )}
              </View>
            )}
          </Card>
        </View>
      );
    }

    // For non-workout plans, use original layout
    return (
      <View style={styles.container}>
        {planType === "meal_plan" && <MealPlanCard plan={structuredData} />}
        {planType === "habit_plan" && <HabitPlanCard plan={structuredData} />}
        {planType === "accountability_plan" && (
          <AccountabilityPlanCard plan={structuredData} />
        )}

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

  // Tab Bar
  tabBar: {
    marginBottom: toRN(tokens.spacing[3]),
  },
  tabBarContent: {
    gap: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[1]),
    paddingTop: toRN(tokens.spacing[2]),
  },
  tab: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.lg),
    backgroundColor: colors.bg.secondary,
  },
  tabActive: {
    backgroundColor: brand.primary + "15",
  },
  tabText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
  },
  tabTextActive: {
    color: brand.primary,
    fontFamily: fontFamily.semiBold,
  },

  // Tab Content
  tabContent: {
    marginBottom: toRN(tokens.spacing[4]),
  },
  tabSectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[3]),
  },

  // Exercise Section (for warmup, main, cooldown grouping)
  exerciseSection: {
    marginBottom: toRN(tokens.spacing[4]),
  },
  exerciseSectionLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: brand.primary,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    marginBottom: toRN(tokens.spacing[2]),
    paddingBottom: toRN(tokens.spacing[2]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },

  // Summary Stats
  // Guidance Description
  guidanceDescription: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.base) * 1.5,
    marginBottom: toRN(tokens.spacing[4]),
  },

  summaryStats: {
    flexDirection: "row" as const,
    justifyContent: "space-around" as const,
    marginBottom: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[4]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  statBox: {
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
  },
  statValue: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.groteskBold,
    color: brand.primary,
  },
  statLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
  },

  // Weekly Focus
  weeklyFocus: {
    backgroundColor: brand.primary + "10",
    borderRadius: toRN(tokens.borderRadius.lg),
    padding: toRN(tokens.spacing[3]),
  },
  weeklyFocusLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: brand.primary,
    textTransform: "uppercase" as const,
    marginBottom: toRN(tokens.spacing[1]),
  },
  weeklyFocusText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.primary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5,
  },

  // Workout Button Group (for continue/restart)
  workoutButtonGroup: {
    marginTop: toRN(tokens.spacing[4]),
    gap: toRN(tokens.spacing[2]),
    alignItems: "center" as const,
  },
  restartLink: {
    paddingVertical: toRN(tokens.spacing[3]),
  },
  restartLinkText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
    textDecorationLine: "underline" as const,
  },

  // Guidance Text
  guidanceText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.6,
  },

  // Tips
  tipsContainer: {
    gap: toRN(tokens.spacing[2]),
  },
  tipItem: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[2]),
  },
  tipIcon: {
    width: toRN(28),
    height: toRN(28),
    borderRadius: toRN(14),
    backgroundColor: brand.primary + "15",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginTop: toRN(tokens.spacing[0.5]),
  },
  tipText: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5,
  },

  // Progress
  currentWeek: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    marginBottom: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[4]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  currentWeekLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
  },
  weekBadge: {
    backgroundColor: brand.primary,
    paddingVertical: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.full),
  },
  weekBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: "#FFFFFF",
  },

  // Weekly Progression
  weeklyProgression: {
    gap: toRN(tokens.spacing[3]),
  },
  weekItem: {
    backgroundColor: colors.bg.secondary,
    borderRadius: toRN(tokens.borderRadius.lg),
    padding: toRN(tokens.spacing[3]),
  },
  weekItemCurrent: {
    backgroundColor: brand.primary + "10",
    borderWidth: 1,
    borderColor: brand.primary + "30",
  },
  weekHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[2]),
  },
  weekNumber: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
  weekNumberCurrent: {
    color: brand.primary,
  },
  weekIntensity: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
    textTransform: "capitalize" as const,
  },
  weekFocus: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.4,
  },

  // Loading state
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

  // Error state
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
