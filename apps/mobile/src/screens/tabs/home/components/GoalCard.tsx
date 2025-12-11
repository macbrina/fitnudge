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
import {
  useDeleteGoal,
  useActivateGoal,
  useDeactivateGoal,
} from "@/hooks/api/useGoals";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { PlanStatusBadge } from "@/screens/goals/components/PlanStatusBadge";
import { Ionicons } from "@expo/vector-icons";
import { MOBILE_ROUTES } from "@/lib/routes";

interface GoalCardProps {
  goal: {
    id: string;
    title: string;
    category: string;
    current_streak?: number;
    is_active?: boolean;
    is_group_goal?: boolean;
    group_goal_role?: "owner" | "admin" | "member"; // For group goals
    converted_to_challenge_id?: string;
    archived_reason?: string | null;
    // Goal type fields
    goal_type?: "habit" | "time_challenge" | "target_challenge";
    target_checkins?: number;
    challenge_start_date?: string;
    challenge_end_date?: string;
    completed_at?: string;
    // Progress data (populated externally)
    completed_checkins?: number;
  };
  onPress?: () => void;
  onDeleted?: () => void;
  onActivated?: () => void;
  onDeactivated?: () => void;
  onShareGoal?: () => void; // For sharing goal with friends
  onShareAsChallenge?: () => void; // For creating challenge from goal
  onViewChallenge?: () => void; // For viewing converted challenge
  onInviteMembers?: () => void; // For group goals
  onViewMembers?: () => void; // For group goals
  onLeaveGroup?: () => void; // For group goals (non-owner)
  showMenu?: boolean; // Only show menu in GoalsScreen, not HomeScreen
  activeGoalsCount?: number; // Current number of active goals (for limit checking)
  style?: any;
}

export function GoalCard({
  goal,
  onPress,
  onDeleted,
  onActivated,
  onDeactivated,
  onShareGoal,
  onShareAsChallenge,
  onViewChallenge,
  onInviteMembers,
  onViewMembers,
  onLeaveGroup,
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
  const { data: planStatus } = usePlanStatus(goal.id);
  const deleteGoal = useDeleteGoal();
  const activateGoal = useActivateGoal();
  const deactivateGoal = useDeactivateGoal();
  const retryPlan = useRetryPlanGeneration();

  // Check if goal failed (plan generation failed)
  const isGoalFailed = goal.archived_reason === "failed";
  const isConvertedToChallenge =
    goal.archived_reason === "converted_to_challenge";

  // Get active goal limit and feature access from subscription
  const activeGoalLimit = useSubscriptionStore(
    (state) => state.getActiveGoalLimit?.() ?? 1
  );
  const hasFeature = useSubscriptionStore((state) => state.hasFeature);

  // Feature checks
  const canShareGoal = hasFeature?.("goal_shares") ?? false;
  const canCreateChallenge = hasFeature?.("challenge_create") ?? false;
  const canUseGroupGoals = hasFeature?.("group_goals") ?? false;

  // Category info with emoji, label, and color
  const CATEGORY_INFO: Record<
    string,
    { emoji: string; label: string; color: string }
  > = {
    fitness: { emoji: "💪", label: "Fitness", color: "#EF4444" },
    nutrition: { emoji: "🥗", label: "Nutrition", color: "#22C55E" },
    wellness: { emoji: "🧘", label: "Wellness", color: "#8B5CF6" },
    mindfulness: { emoji: "🧠", label: "Mindfulness", color: "#3B82F6" },
    sleep: { emoji: "😴", label: "Sleep", color: "#6366F1" },
    custom: { emoji: "🎯", label: "Custom", color: "#F59E0B" },
  };

  // Goal type info
  const GOAL_TYPE_INFO: Record<
    string,
    { icon: keyof typeof Ionicons.glyphMap; label: string }
  > = {
    habit: { icon: "refresh-outline", label: "Habit" },
    time_challenge: { icon: "calendar-outline", label: "Time Challenge" },
    target_challenge: { icon: "flag-outline", label: "Target Challenge" },
  };

  const categoryInfo = CATEGORY_INFO[goal.category] || CATEGORY_INFO.custom;
  const emoji = categoryInfo.emoji;

  // Determine goal type (default to habit)
  const goalType = goal.goal_type || "habit";

  // Calculate progress for different goal types
  const getProgressDisplay = () => {
    if (
      goalType === "time_challenge" &&
      goal.challenge_start_date &&
      goal.challenge_end_date
    ) {
      // Normalize dates to midnight to avoid partial day issues
      const start = new Date(goal.challenge_start_date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(goal.challenge_end_date);
      end.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Calculate total days (end date is inclusive, so add 1)
      const totalDays =
        Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) +
        1;

      // Days elapsed since start (0 on first day)
      const daysElapsed = Math.max(
        0,
        Math.round((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      );

      // Current day number (1-indexed)
      const currentDay = Math.min(daysElapsed + 1, totalDays);
      const daysRemaining = Math.max(0, totalDays - currentDay);
      const progress = Math.min(
        100,
        Math.max(0, (currentDay / totalDays) * 100)
      );

      return {
        type: "time_challenge" as const,
        currentDay,
        totalDays,
        daysRemaining,
        progress,
      };
    }

    if (goalType === "target_challenge" && goal.target_checkins) {
      const completed = goal.completed_checkins || 0;
      const target = goal.target_checkins;
      const progress = Math.min(100, (completed / target) * 100);

      return {
        type: "target_challenge" as const,
        completed,
        target,
        progress,
      };
    }

    // Default: Habit
    return {
      type: "habit" as const,
      streak: goal.current_streak || 0,
    };
  };

  const progressDisplay = getProgressDisplay();

  // Goal type badge - always show
  const goalTypeInfo = GOAL_TYPE_INFO[goalType] || GOAL_TYPE_INFO.habit;

  const handleDelete = async () => {
    const confirmed = await showConfirm({
      title: t("goals.delete_goal"),
      message: t("goals.delete_goal_confirm", { title: goal.title }),
      variant: "error",
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
    });

    if (confirmed) {
      console.log(`[GoalCard] Deleting goal ${goal.id} via mobile app...`);
      try {
        await deleteGoal.mutateAsync(goal.id);
        console.log(`[GoalCard] ✅ Goal deleted successfully!`);
        onDeleted?.();
      } catch (error) {
        console.error(`[GoalCard] ❌ Delete failed:`, error);
        await showAlert({
          title: t("common.error"),
          message: t("goals.delete_goal_error"),
          variant: "error",
          confirmLabel: t("common.ok"),
        });
      }
    }
  };

  const handleActivate = async () => {
    // Goals converted to challenges cannot be reactivated
    if (isConvertedToChallenge) {
      await showAlert({
        title: t("goals.cannot_reactivate_title") || "Cannot Reactivate",
        message:
          t("goals.cannot_reactivate_converted") ||
          "This goal was converted to a challenge and cannot be reactivated.",
        variant: "warning",
        confirmLabel: t("common.ok"),
      });
      return;
    }

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

    try {
      await activateGoal.mutateAsync(goal.id);
      onActivated?.();
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.detail || t("goals.activate_goal_error");
      await showAlert({
        title: t("common.error"),
        message: errorMessage,
        variant: "error",
        confirmLabel: t("common.ok"),
      });
    }
  };

  const handleDeactivate = async () => {
    try {
      await deactivateGoal.mutateAsync(goal.id);
      onDeactivated?.();
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.detail || t("goals.deactivate_goal_error");
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

    // === Section 1: Primary Actions (Activate/Deactivate) ===
    const primaryOptions: BottomMenuOption[] = [];

    if (goal.is_active) {
      primaryOptions.push({
        id: "deactivate",
        label: t("goals.deactivate_goal") || "Deactivate Goal",
        description:
          t("goals.deactivate_goal_desc") || "Pause tracking this goal",
        icon: "pause-circle-outline",
        onPress: handleDeactivate,
      });
    } else {
      primaryOptions.push({
        id: "activate",
        label: t("goals.activate_goal") || "Activate Goal",
        description:
          t("goals.activate_goal_desc") || "Start tracking this goal",
        icon: "play-circle-outline",
        onPress: handleActivate,
        // Disable if converted to challenge
        disabled: isConvertedToChallenge,
      });
    }

    if (primaryOptions.length > 0) {
      sections.push({ id: "primary", options: primaryOptions });
    }

    // === Section 2: Sharing Actions ===
    const sharingOptions: BottomMenuOption[] = [];

    // Share Goal (for habits, requires goal_shares feature)
    if (goalType === "habit" && !goal.is_group_goal) {
      sharingOptions.push({
        id: "share_goal",
        label: t("goals.share_goal") || "Share Goal",
        description:
          t("goals.share_goal_desc") || "Let friends view your progress",
        icon: "share-social-outline",
        onPress: () => onShareGoal?.(),
        disabled: !canShareGoal,
      });
    }

    // Share as Challenge (for time/target challenges, requires challenge_create)
    if (
      (goalType === "time_challenge" || goalType === "target_challenge") &&
      !goal.converted_to_challenge_id
    ) {
      sharingOptions.push({
        id: "share_challenge",
        label: t("goals.share_as_challenge") || "Share as Challenge",
        description:
          t("goals.share_as_challenge_desc") ||
          "Create a challenge for friends to join",
        icon: "trophy-outline",
        onPress: () => onShareAsChallenge?.(),
        disabled: !canCreateChallenge,
      });
    }

    // View Challenge (if converted)
    if (goal.converted_to_challenge_id) {
      sharingOptions.push({
        id: "view_challenge",
        label: t("goals.view_challenge") || "View Challenge",
        description:
          t("goals.view_challenge_desc") ||
          "See the challenge created from this goal",
        icon: "trophy-outline",
        onPress: () => {
          if (onViewChallenge) {
            onViewChallenge();
          } else if (goal.converted_to_challenge_id) {
            router.push(
              MOBILE_ROUTES.CHALLENGES.DETAILS(goal.converted_to_challenge_id)
            );
          }
        },
      });
    }

    if (sharingOptions.length > 0) {
      sections.push({ id: "sharing", options: sharingOptions });
    }

    // === Section 3: Group Goal Actions ===
    if (goal.is_group_goal) {
      const groupOptions: BottomMenuOption[] = [];
      const isOwner = goal.group_goal_role === "owner";
      const isAdmin =
        goal.group_goal_role === "admin" || goal.group_goal_role === "owner";

      // Invite Members (owner/admin only)
      if (isAdmin) {
        groupOptions.push({
          id: "invite_members",
          label: t("goals.invite_members") || "Invite Members",
          description:
            t("goals.invite_members_desc") || "Add friends to this group goal",
          icon: "person-add-outline",
          onPress: () => onInviteMembers?.(),
          disabled: !canUseGroupGoals,
        });
      }

      // View Members (everyone)
      groupOptions.push({
        id: "view_members",
        label: t("goals.view_members") || "View Members",
        description: t("goals.view_members_desc") || "See who's in this group",
        icon: "people-outline",
        onPress: () => onViewMembers?.(),
      });

      // Leave Group (non-owner only)
      if (!isOwner) {
        groupOptions.push({
          id: "leave_group",
          label: t("goals.leave_group") || "Leave Group",
          description:
            t("goals.leave_group_desc") || "Remove yourself from this group",
          icon: "exit-outline",
          onPress: () => onLeaveGroup?.(),
          destructive: true,
        });
      }

      if (groupOptions.length > 0) {
        sections.push({ id: "group", options: groupOptions });
      }
    }

    // === Section 4: Danger Zone (Delete) ===
    const dangerOptions: BottomMenuOption[] = [];

    dangerOptions.push({
      id: "delete",
      label: t("goals.delete_goal") || "Delete Goal",
      description:
        t("goals.delete_goal_desc") || "Permanently remove this goal",
      icon: "trash-outline",
      destructive: true,
      onPress: handleDelete,
    });

    sections.push({ id: "danger", options: dangerOptions });

    return sections;
  };

  const menuSections = buildMenuSections();

  // Render progress section based on goal type
  const renderProgress = () => {
    if (!progressDisplay) return null;

    if (
      progressDisplay.type === "time_challenge" &&
      planStatus?.status === "completed"
    ) {
      const { currentDay, totalDays, daysRemaining, progress } =
        progressDisplay;
      return (
        <View style={styles.progressSection}>
          <View style={styles.progressRow}>
            <Text style={styles.progressValue}>
              Day {currentDay}
              <Text style={styles.progressTotal}>/{totalDays}</Text>
            </Text>
            <Text style={styles.progressSubtext}>
              {daysRemaining > 0
                ? `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left`
                : "🎉 Complete!"}
            </Text>
          </View>
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                { width: `${progress}%`, backgroundColor: categoryInfo.color },
              ]}
            />
          </View>
        </View>
      );
    }

    if (
      progressDisplay.type === "target_challenge" &&
      planStatus?.status === "completed"
    ) {
      const { completed, target, progress } = progressDisplay;
      return (
        <View style={styles.progressSection}>
          <View style={styles.progressRow}>
            <Text style={styles.progressValue}>
              {completed}
              <Text style={styles.progressTotal}>/{target}</Text>
            </Text>
            <Text style={styles.progressSubtext}>check-ins</Text>
          </View>
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                { width: `${progress}%`, backgroundColor: categoryInfo.color },
              ]}
            />
          </View>
        </View>
      );
    }

    // Habit - show streak
    if (
      progressDisplay.type === "habit" &&
      progressDisplay.streak > 0 &&
      planStatus?.status === "completed"
    ) {
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

  return (
    <TouchableOpacity
      onPress={planStatus?.status === "completed" ? onPress : undefined}
      activeOpacity={0.7}
    >
      <Card
        shadow="sm"
        style={[styles.card, style]}
        disabled={planStatus?.status !== "completed"}
      >
        {/* Header Row */}
        <View style={styles.header}>
          {/* Icon */}
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: `${categoryInfo.color}12` },
            ]}
          >
            <Text style={styles.emoji}>{emoji}</Text>
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
                  name={goalTypeInfo.icon}
                  size={10}
                  color={colors.text.tertiary}
                />
                <Text style={styles.typeText}>{goalTypeInfo.label}</Text>
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
            <View style={styles.planStatusRow}>
              <PlanStatusBadge
                status={isGoalFailed ? "failed" : planStatus.status}
                size="sm"
              />
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
        infoLink={
          isConvertedToChallenge
            ? {
                id: "converted_info",
                label:
                  t("goals.converted_to_challenge_info") ||
                  "Why can't I reactivate this?",
                description:
                  t("goals.converted_to_challenge_info_desc") ||
                  "This goal was converted to a challenge. View the challenge instead.",
              }
            : undefined
        }
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
  emoji: {
    fontSize: toRN(tokens.typography.fontSize.xl),
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
