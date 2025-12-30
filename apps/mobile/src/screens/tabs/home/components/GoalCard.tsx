import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Card } from "@/components/ui/Card";
import {
  BottomMenuSheet,
  BottomMenuOption,
  BottomMenuSection,
} from "@/components/ui/BottomMenuSheet";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import {
  usePlanStatus,
  useRetryPlanGeneration,
} from "@/hooks/api/useActionablePlans";
import { useActivateGoal, useDeactivateGoal } from "@/hooks/api/useGoals";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { PlanStatusBadge } from "@/screens/tabs/goals/components/PlanStatusBadge";
import { Ionicons } from "@expo/vector-icons";
import { MOBILE_ROUTES } from "@/lib/routes";
import { PlanStatus } from "@/services/api/actionablePlans";

interface PlanStatusData {
  status: PlanStatus;
  [key: string]: any;
}

interface GoalCardProps {
  goal: {
    id: string;
    title: string;
    category: string;
    current_streak?: number;
    status?: string;
    archived_reason?: string | null;
    completed_at?: string;
    // Progress data (populated externally)
    completed_checkins?: number;
  };
  planStatus?: PlanStatusData; // Optional: pass from parent to avoid individual fetching
  onPress?: () => void;
  showMenu?: boolean; // Only show menu in GoalsScreen, not HomeScreen
  activeGoalsCount?: number; // Current number of active goals (for limit checking)
  style?: any;
}

export function GoalCard({
  goal,
  planStatus: planStatusProp,
  onPress,
  showMenu = false,
  activeGoalsCount = 0,
  style,
}: GoalCardProps) {
  const styles = useStyles(makeGoalCardStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const { showConfirm, showAlert } = useAlertModal();
  const [showActionSheet, setShowActionSheet] = useState(false);
  const router = useRouter();

  // Hooks
  // Use passed planStatus if available, otherwise fetch (for backward compatibility with HomeScreen)
  const { data: fetchedPlanStatus } = usePlanStatus(
    goal.id,
    !planStatusProp, // Only fetch if not passed from parent
  );
  const planStatus = planStatusProp || fetchedPlanStatus;

  const activateGoal = useActivateGoal();
  const deactivateGoal = useDeactivateGoal();
  const retryPlan = useRetryPlanGeneration();

  // Check if goal failed (plan generation failed)
  const isGoalFailed = goal.archived_reason === "failed";

  // Card should be disabled if plan not ready
  // Active status check happens inside detail screen for actions
  const isCardDisabled = planStatus?.status !== "completed";

  // Get active goal limit and feature access from subscription
  const activeGoalLimit = useSubscriptionStore(
    (state) => state.getActiveGoalLimit?.() ?? 1,
  );
  const hasFeature = useSubscriptionStore((state) => state.hasFeature);

  // Category info with icon, label, and color
  const CATEGORY_INFO: Record<
    string,
    { icon: keyof typeof Ionicons.glyphMap; label: string; color: string }
  > = {
    fitness: { icon: "fitness-outline", label: "Fitness", color: "#EF4444" },
    nutrition: {
      icon: "nutrition-outline",
      label: "Nutrition",
      color: "#22C55E",
    },
    wellness: { icon: "leaf-outline", label: "Wellness", color: "#8B5CF6" },
    mindfulness: {
      icon: "flower-outline",
      label: "Mindfulness",
      color: "#3B82F6",
    },
    sleep: { icon: "moon-outline", label: "Sleep", color: "#6366F1" },
  };

  // Goal type info
  const categoryInfo = CATEGORY_INFO[goal.category] || CATEGORY_INFO.wellness;

  // Goals are now habits only - show streak
  const progressDisplay = {
    type: "habit" as const,
    streak: goal.current_streak || 0,
  };

  const handleResume = async () => {
    // Check active goal limit
    if (activeGoalsCount >= activeGoalLimit) {
      await showAlert({
        title: t("goals.active_limit_reached_title"),
        message: t("goals.active_limit_reached_message", {
          limit: activeGoalLimit,
        }),
        variant: "warning",
        confirmLabel: t("common.ok"),
      });
      return;
    }

    // Check if plan is ready
    if (planStatus?.status !== "completed") {
      await showAlert({
        title: t("goals.plan_not_ready_title") || "Plan Not Ready",
        message:
          t("goals.plan_not_ready_message") ||
          "Your goal plan is still being generated. Please wait until it's ready.",
        variant: "warning",
        confirmLabel: t("common.ok"),
      });
      return;
    }

    try {
      await activateGoal.mutateAsync(goal.id);
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.detail ||
        t("goals.resume_goal_error") ||
        "Failed to resume goal";
      await showAlert({
        title: t("common.error"),
        message: errorMessage,
        variant: "error",
        confirmLabel: t("common.ok"),
      });
    }
  };

  const handlePause = async () => {
    try {
      await deactivateGoal.mutateAsync(goal.id);
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.detail ||
        t("goals.pause_goal_error") ||
        "Failed to pause goal";
      await showAlert({
        title: t("common.error"),
        message: errorMessage,
        variant: "error",
        confirmLabel: t("common.ok"),
      });
    }
  };

  const handleRetryPlan = async () => {
    try {
      await retryPlan.mutateAsync(goal.id);
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.detail ||
        t("goals.retry_plan_error") ||
        "Failed to retry plan generation";
      await showAlert({
        title: t("common.error"),
        message: errorMessage,
        variant: "error",
        confirmLabel: t("common.ok"),
      });
    }
  };

  // Build menu sections dynamically based on goal state
  const buildMenuSections = (): BottomMenuSection[] => {
    const sections: BottomMenuSection[] = [];

    // === Section 1: Primary Actions (Pause/Resume) ===
    const primaryOptions: BottomMenuOption[] = [];

    // Active goals can be paused
    if (goal.status === "active") {
      primaryOptions.push({
        id: "pause",
        label: t("goals.pause_goal") || "Pause Goal",
        description:
          t("goals.pause_goal_desc") || "Temporarily stop tracking this goal",
        icon: "pause-circle-outline",
        onPress: handlePause,
      });
    }

    // Archived goals can be resumed (not completed goals)
    if (goal.status === "archived") {
      primaryOptions.push({
        id: "resume",
        label: t("goals.resume_goal") || "Resume Goal",
        description:
          t("goals.resume_goal_desc") || "Continue tracking this goal",
        icon: "play-circle-outline",
        onPress: handleResume,
      });
    }

    if (primaryOptions.length > 0) {
      sections.push({ id: "primary", options: primaryOptions });
    }

    // No delete option - we preserve data for limits/history

    return sections;
  };

  const menuSections = buildMenuSections();

  // Render progress section - habits show streak
  const renderProgress = () => {
    if (!progressDisplay) return null;

    // Show streak for habits
    if (progressDisplay.streak > 0 && planStatus?.status === "completed") {
      return (
        <View style={styles.streakContainer}>
          <Ionicons
            name="flame"
            size={toRN(tokens.typography.fontSize.sm)}
            color="#F59E0B"
          />
          <Text style={styles.streakText}>
            {progressDisplay.streak}{" "}
            {progressDisplay.streak === 1
              ? t("home.streak_day")
              : t("home.streak_days")}
          </Text>
        </View>
      );
    }

    return null;
  };

  // Note: We no longer show a skeleton here while loading actionable plans.
  // The main screen skeleton handles initial loading. Plan status badge
  // will appear when data loads, avoiding double-loading visual effect.

  return (
    <TouchableOpacity
      onPress={!isCardDisabled ? onPress : undefined}
      activeOpacity={0.7}
    >
      <Card shadow="sm" style={[styles.card, style]} disabled={isCardDisabled}>
        {/* Header Row */}
        <View style={styles.header}>
          {/* Icon */}
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: `${categoryInfo.color}12` },
            ]}
          >
            <Ionicons
              name={categoryInfo.icon}
              size={toRN(tokens.typography.fontSize.xl)}
              color={categoryInfo.color}
            />
          </View>

          {/* Title & Meta */}
          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
              {goal.title}
            </Text>
            <View style={styles.metaRow}>
              <View
                style={[
                  styles.categoryPill,
                  { backgroundColor: `${categoryInfo.color}15` },
                ]}
              >
                <Text
                  style={[styles.categoryText, { color: categoryInfo.color }]}
                >
                  {categoryInfo.label}
                </Text>
              </View>
              <View style={styles.typePill}>
                <Ionicons
                  name="refresh-outline"
                  size={10}
                  color={colors.text.tertiary}
                />
                <Text style={styles.typeText}>
                  {t("goals.habit") || "Habit"}
                </Text>
              </View>
            </View>
          </View>

          {/* Menu Button */}
          {showMenu && (
            <TouchableOpacity
              onPress={() => setShowActionSheet(true)}
              style={styles.menuButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={toRN(tokens.typography.fontSize.xl)}
                color={colors.text.secondary}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Progress Section */}
        {renderProgress()}

        {/* Plan Status - show for pending, generating, completed, or failed */}
        {planStatus &&
          (planStatus.status === "pending" ||
            planStatus.status === "generating" ||
            planStatus.status === "completed" ||
            planStatus.status === "failed" ||
            isGoalFailed) && (
            <View
              style={[
                styles.planStatusRow,
                {
                  justifyContent:
                    planStatus.status === "completed"
                      ? "flex-end"
                      : "space-between",
                },
              ]}
            >
              {planStatus.status !== "completed" && (
                <PlanStatusBadge
                  status={isGoalFailed ? "failed" : planStatus.status}
                  size="sm"
                />
              )}
              {planStatus.status === "completed" && !isGoalFailed && (
                <TouchableOpacity
                  onPress={onPress}
                  style={styles.viewPlanButton}
                >
                  <Text style={styles.viewPlanText}>
                    {t("goals.view_plan")}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={toRN(tokens.typography.fontSize.xs)}
                    color={brandColors.primary}
                  />
                </TouchableOpacity>
              )}
              {(planStatus.status === "failed" || isGoalFailed) && (
                <TouchableOpacity
                  onPress={handleRetryPlan}
                  style={styles.retryButton}
                  disabled={retryPlan.isPending}
                >
                  <Ionicons
                    name="refresh-outline"
                    size={toRN(tokens.typography.fontSize.sm)}
                    color={brandColors.primary}
                  />
                  <Text style={styles.retryButtonText}>
                    {retryPlan.isPending
                      ? t("common.loading") || "..."
                      : t("goals.retry") || "Retry"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
      </Card>

      {/* Bottom Menu Sheet */}
      <BottomMenuSheet
        visible={showActionSheet}
        title={goal.title}
        sections={menuSections}
        onClose={() => setShowActionSheet(false)}
      />
    </TouchableOpacity>
  );
}

const makeGoalCardStyles = (tokens: any, colors: any, brand: any) => ({
  card: {
    minWidth: 220,
    marginRight: toRN(tokens.spacing[3]),
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
  },
  menuButton: {
    padding: toRN(tokens.spacing[1]),
    marginLeft: toRN(tokens.spacing[1]),
  },
  iconContainer: {
    width: toRN(44),
    height: toRN(44),
    borderRadius: toRN(tokens.borderRadius.lg),
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginRight: toRN(tokens.spacing[3]),
  },
  titleContainer: {
    flex: 1,
    paddingRight: toRN(tokens.spacing[2]),
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    lineHeight: toRN(tokens.typography.fontSize.base) * 1.3,
    marginBottom: toRN(tokens.spacing[1.5] || 6),
  },
  metaRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    flexWrap: "wrap" as const,
    gap: toRN(tokens.spacing[1.5] || 6),
  },
  categoryPill: {
    paddingHorizontal: toRN(tokens.spacing[2]),
    paddingVertical: 3,
    borderRadius: toRN(tokens.borderRadius.full),
  },
  categoryText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
  },
  typePill: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 3,
    paddingHorizontal: toRN(tokens.spacing[2]),
    paddingVertical: 3,
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: colors.bg.muted,
  },
  typeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
  },
  // Progress section
  progressSection: {
    marginTop: toRN(tokens.spacing[3]),
    paddingTop: toRN(tokens.spacing[3]),
    borderTopWidth: 1,
    borderTopColor: colors.border.default + "40",
  },
  progressRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    marginBottom: toRN(tokens.spacing[2]),
  },
  progressStats: {
    flexDirection: "row" as const,
    alignItems: "baseline" as const,
    gap: toRN(tokens.spacing[2]),
  },
  progressValue: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
  },
  progressTotal: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
  },
  progressSubtext: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: colors.bg.muted,
    borderRadius: 3,
    overflow: "hidden" as const,
  },
  progressBar: {
    height: "100%" as const,
    borderRadius: 3,
  },
  // Streak (habit)
  streakContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
    marginTop: toRN(tokens.spacing[3]),
    paddingTop: toRN(tokens.spacing[3]),
    borderTopWidth: 1,
    borderTopColor: colors.border.default + "40",
  },
  streakText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
  },
  // Plan status
  planStatusRow: {
    marginTop: toRN(tokens.spacing[3]),
    paddingTop: toRN(tokens.spacing[3]),
    borderTopWidth: 1,
    borderTopColor: colors.border.default + "40",
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
  viewPlanButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 2,
  },
  viewPlanText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: brand.primary,
  },
  retryButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    paddingHorizontal: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[1]),
    borderRadius: toRN(tokens.borderRadius.md),
    backgroundColor: `${brand.primary}15`,
  },
  retryButtonText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: brand.primary,
  },
});
