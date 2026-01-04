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
  useChallengePlanStatus,
  useChallengePlan,
  useRetryPlanGeneration
} from "@/hooks/api/useActionablePlans";
import { useWorkoutSession } from "@/hooks/useWorkoutSession";
import { usePrefetchWorkoutMusic } from "@/hooks/api/useWorkoutMusic";
import { usePrefetchAudioPreferences } from "@/hooks/api/useAudioPreferences";
import { useStreakInfo } from "@/hooks/api/useProgressData";
import { PlanStatusBadge } from "./PlanStatusBadge";
import { WorkoutPlanCard } from "./WorkoutPlanCard";
import { MealPlanCard } from "./MealPlanCard";
import { HydrationPlanCard } from "./HydrationPlanCard";
import { HabitPlanCard } from "./HabitPlanCard";
import { AccountabilityPlanCard } from "./AccountabilityPlanCard";
import { PlanGuidanceCard } from "./PlanGuidanceCard";
import { ExerciseCard } from "./ExerciseCard";
import Button from "@/components/ui/Button";

type TabType = "workout" | "exercises" | "tips" | "progress";

interface PlanSectionProps {
  /** Goal ID - provide this for goal-based plans */
  goalId?: string;
  /** Challenge ID - provide this for standalone challenge plans */
  challengeId?: string;
  planStatus?: {
    status: string;
    error_message?: string | null;
  };
  /** Entity status - required to enable workout actions */
  entityStatus?: string;
  /** Whether today is a scheduled day for this goal/challenge */
  isScheduledDay?: boolean;
  /** Whether viewing as a partner (read-only, restricted content) */
  isPartnerView?: boolean;
}

export function PlanSection({
  goalId,
  challengeId,
  planStatus: propPlanStatus,
  entityStatus,
  isScheduledDay = true,
  isPartnerView = false
}: PlanSectionProps) {
  const styles = useStyles(makePlanSectionStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("workout");

  // Determine if this is a goal or challenge plan
  const isChallenge = !!challengeId && !goalId;
  const entityId = goalId || challengeId || "";

  // Use prop status if provided, otherwise fetch (goal or challenge)
  const { data: goalStatusData, isLoading: goalStatusLoading } = usePlanStatus(
    goalId,
    !propPlanStatus && !!goalId
  );
  const { data: challengeStatusData, isLoading: challengeStatusLoading } = useChallengePlanStatus(
    challengeId,
    !propPlanStatus && isChallenge
  );

  const statusLoading = goalStatusLoading || challengeStatusLoading;
  const fetchedStatusData = isChallenge ? challengeStatusData : goalStatusData;
  const statusData = propPlanStatus || fetchedStatusData;

  // Fetch plan data (goal or challenge)
  const { data: goalPlanData, isLoading: goalPlanLoading } = useGoalPlan(
    goalId,
    statusData?.status === "completed" && !!goalId
  );
  const { data: challengePlanData, isLoading: challengePlanLoading } = useChallengePlan(
    challengeId,
    statusData?.status === "completed" && isChallenge
  );

  const planLoading = goalPlanLoading || challengePlanLoading;
  const planData = isChallenge ? challengePlanData : goalPlanData;

  const retryMutation = useRetryPlanGeneration();

  // Fetch streak info for Progress tab (works for both goals and challenges)
  const { data: streakInfo } = useStreakInfo(entityId);

  // Check for active workout session (works for both goals and challenges)
  const { canResume, resumePercentage, isLoadingActiveSession } = useWorkoutSession(
    entityId,
    isChallenge
  );

  // Prefetch workout music and audio preferences when plan is ready
  const { prefetch: prefetchMusic } = usePrefetchWorkoutMusic();
  const { prefetch: prefetchAudioPrefs } = usePrefetchAudioPreferences();

  const status = statusData?.status || "not_started";
  const plan = planData?.plan;

  // Check if entity is active (can perform actions like starting workouts)
  const isEntityActive = entityStatus === "active";

  // Prefetch music and audio preferences when workout plan is ready
  React.useEffect(() => {
    if (status === "completed" && plan?.plan_type === "workout_plan") {
      prefetchMusic();
      prefetchAudioPrefs();
    }
  }, [status, plan?.plan_type, prefetchMusic, prefetchAudioPrefs]);

  // Navigate to workout player - always starts fresh (resets any existing session)
  const handleStartWorkout = () => {
    if (isChallenge && challengeId) {
      router.push(MOBILE_ROUTES.WORKOUT.CHALLENGE_PLAYER_RESTART(challengeId));
    } else if (goalId) {
      router.push(MOBILE_ROUTES.WORKOUT.PLAYER_RESTART(goalId));
    }
  };

  // Navigate to workout player with resume flag
  const handleContinueWorkout = () => {
    if (isChallenge && challengeId) {
      router.push(MOBILE_ROUTES.WORKOUT.CHALLENGE_PLAYER_RESUME(challengeId));
    } else if (goalId) {
      router.push(MOBILE_ROUTES.WORKOUT.PLAYER_RESUME(goalId));
    }
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
          <SkeletonBox height={60} borderRadius={toRN(tokens.borderRadius.lg)} />
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
          <Ionicons name="alert-circle" size={48} color={colors.feedback.error} />
          <Text style={styles.errorTitle}>{t("goals.plan.failed_title")}</Text>
        </View>

        <Text style={styles.errorMessage}>
          {statusData?.error_message || t("goals.plan.failed_message")}
        </Text>

        <Text style={styles.errorHelpText}>{t("goals.plan.failed_help")}</Text>

        <Button
          title={t("goals.plan.retry_generation")}
          onPress={() => retryMutation.mutate(entityId)}
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

  // Partner view - show restricted message
  // Status can be "restricted" from backend, or we check isPartnerView prop + completed
  if (status === "restricted" || (isPartnerView && status === "completed")) {
    return (
      <Card shadow="md" style={styles.restrictedCard}>
        <View style={styles.restrictedHeader}>
          <View style={styles.restrictedIconContainer}>
            <Ionicons name="lock-closed" size={32} color={brandColors.primary} />
          </View>
          <Text style={styles.restrictedTitle}>
            {t("partners.plan_restricted_title") || "Plan Details Restricted"}
          </Text>
        </View>

        <Text style={styles.restrictedMessage}>
          {t("partners.plan_restricted_message") ||
            "Your partner has an active plan for this goal. Plan details are private to protect their personal journey."}
        </Text>

        <View style={styles.restrictedInfo}>
          <View style={styles.restrictedInfoItem}>
            <Ionicons name="checkmark-circle" size={20} color={colors.feedback.success} />
            <Text style={styles.restrictedInfoText}>
              {t("partners.plan_has_active") || "Has an active plan"}
            </Text>
          </View>
          <View style={styles.restrictedInfoItem}>
            <Ionicons name="eye-outline" size={20} color={colors.text.tertiary} />
            <Text style={styles.restrictedInfoText}>
              {t("partners.can_view_progress") || "You can view their progress stats"}
            </Text>
          </View>
        </View>
      </Card>
    );
  }

  // Ready state - Display plan
  if (status === "completed" && plan) {
    const planType = plan.plan_type;
    const structuredData = plan.structured_data;

    // For workout plans, show tabbed interface
    if (planType === "workout_plan") {
      const structure = structuredData.structure || {};
      const mainWorkout = structure.main_workout || structure.routine || {};
      const exercises = (mainWorkout as any).exercises || [];
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
          icon: "list"
        },
        { key: "tips", label: t("goals.plan.tips_tab"), icon: "bulb" },
        {
          key: "progress",
          label: t("goals.plan.progress_tab"),
          icon: "trending-up"
        }
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
                  color={activeTab === tab.key ? brandColors.primary : colors.text.tertiary}
                />
                <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
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
                  <Text style={styles.guidanceDescription}>{guidance.description}</Text>
                )}

                {/* Summary Stats */}
                <View style={styles.summaryStats}>
                  <View style={styles.statBox}>
                    <Ionicons name="time-outline" size={20} color={brandColors.primary} />
                    <Text style={styles.statValue}>{structure.total_duration_minutes || 30}</Text>
                    <Text style={styles.statLabel}>{t("common.minutes")}</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Ionicons name="barbell-outline" size={20} color={brandColors.primary} />
                    <Text style={styles.statValue}>{totalExercisesCount}</Text>
                    <Text style={styles.statLabel}>{t("workout.exercises")}</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Ionicons name="layers-outline" size={20} color={brandColors.primary} />
                    <Text style={styles.statValue}>
                      {exercises.reduce((sum: number, ex: any) => sum + (ex.sets || 3), 0)}
                    </Text>
                    <Text style={styles.statLabel}>{t("workout.total_sets")}</Text>
                  </View>
                </View>

                {/* Weekly Focus */}
                {progression.weekly_focus && (
                  <View style={styles.weeklyFocus}>
                    <Text style={styles.weeklyFocusLabel}>{t("goals.plan.weekly_focus")}</Text>
                    <Text style={styles.weeklyFocusText}>{progression.weekly_focus}</Text>
                  </View>
                )}

                {/* Start/Continue Workout Button - only if entity is active and scheduled day */}
                {isEntityActive && isScheduledDay ? (
                  canResume ? (
                    <View style={styles.workoutButtonGroup}>
                      <Button
                        title={t("workout.continue", {
                          percent: Math.round(resumePercentage)
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
                  )
                ) : isEntityActive && !isScheduledDay ? (
                  <View style={styles.inactiveMessage}>
                    <Ionicons name="moon-outline" size={20} color={colors.text.tertiary} />
                    <Text style={styles.inactiveMessageText}>
                      {t("goals.rest_day") || "Rest day - no action scheduled for today"}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.inactiveMessage}>
                    <Ionicons name="pause-circle-outline" size={20} color={colors.text.tertiary} />
                    <Text style={styles.inactiveMessageText}>
                      {isChallenge
                        ? t("challenges.challenge_not_active") ||
                          "This challenge is not currently active"
                        : t("goals.goal_not_active") || "This goal is not currently active"}
                    </Text>
                  </View>
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
                    <Text style={styles.exerciseSectionLabel}>{t("workout.phase.warm_up")}</Text>
                    {warmupExercises.map((exercise: any, index: number) => (
                      <ExerciseCard key={`warmup-${index}`} exercise={exercise} index={index} />
                    ))}
                  </View>
                )}

                {/* Main Workout Exercises */}
                {exercises.length > 0 && (
                  <View style={styles.exerciseSection}>
                    <Text style={styles.exerciseSectionLabel}>{t("workout.phase.work")}</Text>
                    {exercises.map((exercise: any, index: number) => (
                      <ExerciseCard key={`main-${index}`} exercise={exercise} index={index} />
                    ))}
                  </View>
                )}

                {/* Cooldown Exercises */}
                {cooldownExercises.length > 0 && (
                  <View style={styles.exerciseSection}>
                    <Text style={styles.exerciseSectionLabel}>{t("workout.phase.cool_down")}</Text>
                    {cooldownExercises.map((exercise: any, index: number) => (
                      <ExerciseCard key={`cooldown-${index}`} exercise={exercise} index={index} />
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
                    <Text style={styles.guidanceText}>{guidance.description}</Text>
                  </View>
                )}

                {guidance.tips && guidance.tips.length > 0 && (
                  <View style={styles.tipsContainer}>
                    <Text style={styles.tabSectionTitle}>{t("goals.plan.tips")}</Text>
                    {guidance.tips.map((tip: string, index: number) => (
                      <View key={index} style={styles.tipItem}>
                        <View style={styles.tipIcon}>
                          <Ionicons name="bulb" size={16} color={brandColors.primary} />
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
                {/* Determine goal type from challenge_info or progression */}
                {(() => {
                  const challengeInfo = structure.challenge_info;
                  const challengeType = challengeInfo?.type;

                  // Check both locations for streak milestones:
                  // - guidance.streak_milestones (single-prompt system)
                  // - structure.progression.streak_milestones (multi-agent system)
                  const streakMilestones =
                    guidance.streak_milestones || progression.streak_milestones;

                  // Also check progression.goal_type from multi-agent system
                  const progressionGoalType = progression.goal_type;

                  // HABIT: Show streak milestones with enhanced UI
                  if (
                    (streakMilestones && streakMilestones.length > 0 && !challengeType) ||
                    (progressionGoalType === "habit" && !challengeType)
                  ) {
                    // Get current streak from API
                    const currentStreak = streakInfo?.current_streak || 0;
                    const sortedMilestones = streakMilestones
                      ? [...streakMilestones].sort((a: any, b: any) => a.days - b.days)
                      : [];
                    const nextMilestone = sortedMilestones.find((m: any) => m.days > currentStreak);
                    const progressToNext = nextMilestone
                      ? Math.min(100, (currentStreak / nextMilestone.days) * 100)
                      : 100;

                    return (
                      <View style={styles.habitProgressContainer}>
                        {/* Current Streak Hero Section */}
                        <View style={styles.streakHeroSection}>
                          <View style={styles.streakFireContainer}>
                            <View
                              style={[
                                styles.streakFireGlow,
                                currentStreak > 0 && styles.streakFireGlowActive
                              ]}
                            />
                            <Ionicons
                              name="flame"
                              size={56}
                              color={currentStreak > 0 ? "#FF6B35" : colors.text.tertiary}
                            />
                          </View>
                          <Text style={styles.streakCount}>{currentStreak}</Text>
                          <Text style={styles.streakLabel}>
                            {Number(currentStreak) === 1 ? t("common.day") : t("common.days")}{" "}
                            {t("goals.progress.streak") || "streak"}
                          </Text>

                          {/* Progress to next milestone */}
                          {nextMilestone && (
                            <View style={styles.nextMilestoneProgress}>
                              <View style={styles.progressBarContainer}>
                                <View
                                  style={[styles.progressBarFill, { width: `${progressToNext}%` }]}
                                />
                              </View>
                              <Text style={styles.nextMilestoneText}>
                                {nextMilestone.days - currentStreak}{" "}
                                {t("common.days").toLowerCase()}{" "}
                                {t("goals.progress.until") || "until"} {nextMilestone.title}
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Weekly Focus */}
                        {progression.weekly_focus && (
                          <View style={styles.weeklyFocusCard}>
                            <View style={styles.weeklyFocusIcon}>
                              <Ionicons name="bulb" size={20} color={brandColors.primary} />
                            </View>
                            <View style={styles.weeklyFocusContent}>
                              <Text style={styles.weeklyFocusCardLabel}>
                                {t("goals.plan.weekly_focus")}
                              </Text>
                              <Text style={styles.weeklyFocusCardText}>
                                {progression.weekly_focus}
                              </Text>
                            </View>
                          </View>
                        )}

                        {/* Milestones Timeline */}
                        {sortedMilestones.length > 0 && (
                          <View style={styles.milestonesTimeline}>
                            <Text style={styles.milestonesTimelineTitle}>
                              {t("goals.plan.your_journey") || "Your Journey"}
                            </Text>

                            {sortedMilestones.map((milestone: any, index: number) => {
                              const isAchieved = currentStreak >= milestone.days;
                              const isCurrent = nextMilestone?.days === milestone.days;
                              const isLast = index === sortedMilestones.length - 1;

                              return (
                                <View key={index} style={styles.timelineItem}>
                                  {/* Timeline connector */}
                                  {!isLast && (
                                    <View
                                      style={[
                                        styles.timelineConnector,
                                        isAchieved && styles.timelineConnectorAchieved
                                      ]}
                                    />
                                  )}

                                  {/* Milestone node */}
                                  <View
                                    style={[
                                      styles.timelineNode,
                                      isAchieved && styles.timelineNodeAchieved,
                                      isCurrent && styles.timelineNodeCurrent
                                    ]}
                                  >
                                    {isAchieved ? (
                                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                                    ) : (
                                      <Text
                                        style={[
                                          styles.timelineNodeText,
                                          isCurrent && styles.timelineNodeTextCurrent
                                        ]}
                                      >
                                        {milestone.days}
                                      </Text>
                                    )}
                                  </View>

                                  {/* Milestone content */}
                                  <View
                                    style={[
                                      styles.timelineMilestoneContent,
                                      isAchieved && styles.timelineMilestoneContentAchieved
                                    ]}
                                  >
                                    <View style={styles.timelineMilestoneHeader}>
                                      <Text
                                        style={[
                                          styles.timelineMilestoneTitle,
                                          isAchieved && styles.timelineMilestoneTitleAchieved
                                        ]}
                                      >
                                        {milestone.title}
                                      </Text>
                                      {isAchieved && (
                                        <View style={styles.achievedBadge}>
                                          <Ionicons name="trophy" size={12} color="#F59E0B" />
                                        </View>
                                      )}
                                    </View>
                                    <Text
                                      style={[
                                        styles.timelineMilestoneDesc,
                                        isAchieved && styles.timelineMilestoneDescAchieved
                                      ]}
                                    >
                                      {milestone.description}
                                    </Text>
                                  </View>
                                </View>
                              );
                            })}
                          </View>
                        )}

                        {/* Empty state for habits without milestones */}
                        {sortedMilestones.length === 0 && (
                          <View style={styles.emptyMilestones}>
                            <Ionicons
                              name="trophy-outline"
                              size={48}
                              color={colors.text.tertiary}
                            />
                            <Text style={styles.emptyMilestonesText}>
                              {t("goals.plan.habit_ongoing_message") ||
                                "Build your streak! Check in daily to unlock milestones."}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  }

                  // TARGET CHALLENGE: Show count-based milestones
                  if (challengeType === "target_challenge" && challengeInfo) {
                    const milestones = challengeInfo.milestones || [];
                    return (
                      <View style={styles.targetMilestones}>
                        <Text style={styles.tabSectionTitle}>
                          {t("goals.plan.target_milestones")}
                        </Text>
                        <Text style={styles.targetDescription}>
                          {t("goals.plan.target_description", {
                            count: challengeInfo.target_checkins || 0
                          })}
                        </Text>
                        {milestones.map((milestone: any, index: number) => (
                          <View key={index} style={styles.targetMilestoneItem}>
                            <View style={styles.targetPercent}>
                              <Text style={styles.targetPercentText}>{milestone.percent}%</Text>
                            </View>
                            <View style={styles.milestoneContent}>
                              <Text style={styles.milestoneTitle}>{milestone.title}</Text>
                              <Text style={styles.milestoneDescription}>
                                {milestone.count} {t("goals.plan.check_ins")}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    );
                  }

                  // TIME CHALLENGE: Show weekly progression (default)
                  return (
                    <>
                      {/* Current Week */}
                      {progression.current_week && (
                        <View style={styles.currentWeek}>
                          <Text style={styles.currentWeekLabel}>
                            {t("goals.plan.current_week")}
                          </Text>
                          <View style={styles.weekBadge}>
                            <Text style={styles.weekBadgeText}>
                              {t("goals.plan.week_x", {
                                week: progression.current_week
                              })}
                            </Text>
                          </View>
                        </View>
                      )}

                      {/* Challenge Duration Info */}
                      {challengeInfo?.duration_days && (
                        <View style={styles.challengeDuration}>
                          <Ionicons
                            name="calendar-outline"
                            size={16}
                            color={colors.text.tertiary}
                          />
                          <Text style={styles.challengeDurationText}>
                            {challengeInfo.duration_days} {t("common.days")} •{" "}
                            {Math.ceil(challengeInfo.duration_days / 7)} {t("common.weeks")}
                          </Text>
                        </View>
                      )}

                      {/* Weekly Adjustments */}
                      {progression.weekly_adjustments &&
                        progression.weekly_adjustments.length > 0 && (
                          <View style={styles.weeklyProgression}>
                            <Text style={styles.tabSectionTitle}>
                              {t("goals.plan.progression_schedule")}
                            </Text>
                            {progression.weekly_adjustments.map((week: any, index: number) => (
                              <View
                                key={index}
                                style={[
                                  styles.weekItem,
                                  week.week === progression.current_week && styles.weekItemCurrent
                                ]}
                              >
                                <View style={styles.weekHeader}>
                                  <Text
                                    style={[
                                      styles.weekNumber,
                                      week.week === progression.current_week &&
                                        styles.weekNumberCurrent
                                    ]}
                                  >
                                    {t("goals.plan.week_x", {
                                      week: week.week
                                    })}
                                  </Text>
                                  <Text style={styles.weekIntensity}>{week.intensity}</Text>
                                </View>
                                <Text style={styles.weekFocus}>{week.focus}</Text>
                              </View>
                            ))}
                          </View>
                        )}

                      {/* Time Challenge Milestones */}
                      {challengeInfo?.milestones && challengeInfo.milestones.length > 0 && (
                        <View style={styles.timeMilestones}>
                          <Text style={styles.tabSectionTitle}>{t("goals.plan.milestones")}</Text>
                          {challengeInfo.milestones.map((milestone: any, index: number) => (
                            <View key={index} style={styles.timeMilestoneItem}>
                              <View style={styles.dayBadge}>
                                <Text style={styles.dayBadgeText}>
                                  {t("common.day")} {milestone.day}
                                </Text>
                              </View>
                              <View style={styles.milestoneContent}>
                                <Text style={styles.milestoneTitle}>{milestone.title}</Text>
                                <Text style={styles.milestoneDescription}>
                                  {milestone.description}
                                </Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                    </>
                  );
                })()}
              </View>
            )}
          </Card>
        </View>
      );
    }

    // For non-workout plans, use original layout
    // For meal_plan, check tracking_type to determine if it's meal or hydration
    const trackingType = (structuredData as any).tracking_type as string | undefined;

    return (
      <View style={styles.container}>
        {planType === "meal_plan" && trackingType === "hydration" && (
          <HydrationPlanCard plan={structuredData} />
        )}
        {planType === "meal_plan" && trackingType !== "hydration" && (
          <MealPlanCard plan={structuredData} goalId={goalId} challengeId={challengeId} />
        )}
        {planType === "habit_plan" && <HabitPlanCard plan={structuredData} />}
        {planType === "accountability_plan" && <AccountabilityPlanCard plan={structuredData} />}

        {structuredData.guidance && <PlanGuidanceCard guidance={structuredData.guidance} />}
      </View>
    );
  }

  return null;
}

const makePlanSectionStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    marginBottom: toRN(tokens.spacing[6])
  },

  // Tab Bar
  tabBar: {
    marginBottom: toRN(tokens.spacing[3])
  },
  tabBarContent: {
    gap: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[1]),
    paddingTop: toRN(tokens.spacing[2])
  },
  tab: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.lg),
    backgroundColor: colors.bg.secondary
  },
  tabActive: {
    backgroundColor: brand.primary + "15"
  },
  tabText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary
  },
  tabTextActive: {
    color: brand.primary,
    fontFamily: fontFamily.semiBold
  },

  // Tab Content
  tabContent: {
    marginBottom: toRN(tokens.spacing[4])
  },
  tabSectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[3])
  },

  // Exercise Section (for warmup, main, cooldown grouping)
  exerciseSection: {
    marginBottom: toRN(tokens.spacing[4])
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
    borderBottomColor: colors.border.subtle
  },

  // Summary Stats
  // Guidance Description
  guidanceDescription: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.base) * 1.5,
    marginBottom: toRN(tokens.spacing[4])
  },

  summaryStats: {
    flexDirection: "row" as const,
    justifyContent: "space-around" as const,
    marginBottom: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[4]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle
  },
  statBox: {
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1])
  },
  statValue: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.groteskBold,
    color: brand.primary
  },
  statLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary
  },

  // Weekly Focus
  weeklyFocus: {
    backgroundColor: brand.primary + "10",
    borderRadius: toRN(tokens.borderRadius.lg),
    padding: toRN(tokens.spacing[3])
  },
  weeklyFocusLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: brand.primary,
    textTransform: "uppercase" as const,
    marginBottom: toRN(tokens.spacing[1])
  },
  weeklyFocusText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.primary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5
  },

  // Workout Button Group (for continue/restart)
  workoutButtonGroup: {
    marginTop: toRN(tokens.spacing[4]),
    gap: toRN(tokens.spacing[2]),
    alignItems: "center" as const
  },
  restartLink: {
    paddingVertical: toRN(tokens.spacing[3])
  },
  restartLinkText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
    textDecorationLine: "underline" as const
  },
  inactiveMessage: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[2]),
    marginTop: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.lg)
  },
  inactiveMessageText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    textAlign: "center" as const
  },

  // Guidance Text
  guidanceText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.6
  },

  // Tips
  tipsContainer: {
    gap: toRN(tokens.spacing[2])
  },
  tipItem: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[2])
  },
  tipIcon: {
    width: toRN(28),
    height: toRN(28),
    borderRadius: toRN(14),
    backgroundColor: brand.primary + "15",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginTop: toRN(tokens.spacing[0.5])
  },
  tipText: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5
  },

  // Progress
  currentWeek: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    marginBottom: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[4]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle
  },
  currentWeekLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary
  },
  weekBadge: {
    backgroundColor: brand.primary,
    paddingVertical: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.full)
  },
  weekBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: "#FFFFFF"
  },

  // Enhanced Habit Progress (for HABITS)
  habitProgressContainer: {
    gap: toRN(tokens.spacing[5])
  },

  // Streak Hero Section
  streakHeroSection: {
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[6]),
    backgroundColor: colors.bg.secondary,
    borderRadius: toRN(tokens.borderRadius.xl)
  },
  streakFireContainer: {
    position: "relative" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: toRN(tokens.spacing[2])
  },
  streakFireGlow: {
    position: "absolute" as const,
    width: toRN(80),
    height: toRN(80),
    borderRadius: toRN(40),
    backgroundColor: colors.bg.tertiary
  },
  streakFireGlowActive: {
    backgroundColor: "#FF6B35" + "20"
  },
  streakCount: {
    fontSize: toRN(tokens.typography.fontSize["4xl"]),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
    marginTop: toRN(tokens.spacing[1])
  },
  streakLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
    textTransform: "uppercase" as const,
    letterSpacing: 1
  },
  nextMilestoneProgress: {
    width: "80%" as const,
    marginTop: toRN(tokens.spacing[4]),
    alignItems: "center" as const
  },
  progressBarContainer: {
    width: "100%" as const,
    height: toRN(6),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(3),
    overflow: "hidden" as const
  },
  progressBarFill: {
    height: "100%" as const,
    backgroundColor: brand.primary,
    borderRadius: toRN(3)
  },
  nextMilestoneText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[2]),
    textAlign: "center" as const
  },

  // Weekly Focus Card
  weeklyFocusCard: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: toRN(tokens.spacing[3]),
    padding: toRN(tokens.spacing[4]),
    backgroundColor: brand.primary + "08",
    borderRadius: toRN(tokens.borderRadius.xl),
    borderWidth: 1,
    borderColor: brand.primary + "20"
  },
  weeklyFocusIcon: {
    width: toRN(36),
    height: toRN(36),
    borderRadius: toRN(18),
    backgroundColor: brand.primary + "15",
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  weeklyFocusContent: {
    flex: 1
  },
  weeklyFocusCardLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: brand.primary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: toRN(tokens.spacing[1])
  },
  weeklyFocusCardText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.primary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5
  },

  // Milestones Timeline
  milestonesTimeline: {
    gap: toRN(tokens.spacing[3])
  },
  milestonesTimelineTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[2])
  },
  timelineItem: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: toRN(tokens.spacing[3]),
    position: "relative" as const,
    paddingBottom: toRN(tokens.spacing[3])
  },
  timelineConnector: {
    position: "absolute" as const,
    left: toRN(15),
    top: toRN(32),
    width: toRN(2),
    height: "100%" as const,
    backgroundColor: colors.border.subtle
  },
  timelineConnectorAchieved: {
    backgroundColor: brand.primary
  },
  timelineNode: {
    width: toRN(32),
    height: toRN(32),
    borderRadius: toRN(16),
    backgroundColor: colors.bg.tertiary,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 2,
    borderColor: colors.border.subtle,
    zIndex: 1
  },
  timelineNodeAchieved: {
    backgroundColor: brand.primary,
    borderColor: brand.primary
  },
  timelineNodeCurrent: {
    borderColor: brand.primary,
    borderWidth: 2
  },
  timelineNodeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: colors.text.tertiary
  },
  timelineNodeTextCurrent: {
    color: brand.primary
  },
  timelineMilestoneContent: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
    borderRadius: toRN(tokens.borderRadius.lg),
    padding: toRN(tokens.spacing[3])
  },
  timelineMilestoneContentAchieved: {
    backgroundColor: brand.primary + "08",
    borderWidth: 1,
    borderColor: brand.primary + "20"
  },
  timelineMilestoneHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    marginBottom: toRN(tokens.spacing[1])
  },
  timelineMilestoneTitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  timelineMilestoneTitleAchieved: {
    color: brand.primary
  },
  timelineMilestoneDesc: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.4
  },
  timelineMilestoneDescAchieved: {
    color: colors.text.tertiary
  },
  achievedBadge: {
    width: toRN(24),
    height: toRN(24),
    borderRadius: toRN(12),
    backgroundColor: "#FEF3C7",
    alignItems: "center" as const,
    justifyContent: "center" as const
  },

  // Empty Milestones
  emptyMilestones: {
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[8]),
    gap: toRN(tokens.spacing[3])
  },
  emptyMilestonesText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    textAlign: "center" as const,
    maxWidth: "80%" as const,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5
  },

  // Legacy Streak Milestones (kept for backwards compatibility)
  streakMilestones: {
    gap: toRN(tokens.spacing[3])
  },
  milestoneItem: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.secondary,
    borderRadius: toRN(tokens.borderRadius.lg),
    padding: toRN(tokens.spacing[3])
  },
  milestoneBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
    backgroundColor: brand.primary + "15",
    paddingVertical: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[2]),
    borderRadius: toRN(tokens.borderRadius.md)
  },
  milestoneDays: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: brand.primary
  },
  milestoneContent: {
    flex: 1
  },
  milestoneTitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[0.5])
  },
  milestoneDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary
  },

  // Target Milestones (for TARGET CHALLENGES)
  targetMilestones: {
    gap: toRN(tokens.spacing[3])
  },
  targetDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    marginBottom: toRN(tokens.spacing[2])
  },
  targetMilestoneItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.secondary,
    borderRadius: toRN(tokens.borderRadius.lg),
    padding: toRN(tokens.spacing[3])
  },
  targetPercent: {
    width: toRN(48),
    height: toRN(48),
    borderRadius: toRN(24),
    backgroundColor: brand.primary + "15",
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  targetPercentText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskBold,
    color: brand.primary
  },

  // Time Challenge (duration info)
  challengeDuration: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    marginBottom: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[3]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle
  },
  challengeDurationText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },
  timeMilestones: {
    marginTop: toRN(tokens.spacing[4]),
    gap: toRN(tokens.spacing[2])
  },
  timeMilestoneItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.secondary,
    borderRadius: toRN(tokens.borderRadius.lg),
    padding: toRN(tokens.spacing[3])
  },
  dayBadge: {
    backgroundColor: brand.primary + "15",
    paddingVertical: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[2]),
    borderRadius: toRN(tokens.borderRadius.md)
  },
  dayBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: brand.primary
  },

  // Weekly Progression
  weeklyProgression: {
    gap: toRN(tokens.spacing[3])
  },
  weekItem: {
    backgroundColor: colors.bg.secondary,
    borderRadius: toRN(tokens.borderRadius.lg),
    padding: toRN(tokens.spacing[3])
  },
  weekItemCurrent: {
    backgroundColor: brand.primary + "10",
    borderWidth: 1,
    borderColor: brand.primary + "30"
  },
  weekHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[2])
  },
  weekNumber: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  weekNumberCurrent: {
    color: brand.primary
  },
  weekIntensity: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
    textTransform: "capitalize" as const
  },
  weekFocus: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.4
  },

  // Restricted view (partner)
  restrictedCard: {
    marginBottom: toRN(tokens.spacing[4]),
    alignItems: "center" as const
  },
  restrictedHeader: {
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[4])
  },
  restrictedIconContainer: {
    width: toRN(72),
    height: toRN(72),
    borderRadius: toRN(36),
    backgroundColor: brand.primary + "15",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: toRN(tokens.spacing[3])
  },
  restrictedTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
    textAlign: "center" as const
  },
  restrictedMessage: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.6,
    marginBottom: toRN(tokens.spacing[5]),
    paddingHorizontal: toRN(tokens.spacing[2])
  },
  restrictedInfo: {
    width: "100%" as const,
    gap: toRN(tokens.spacing[3]),
    paddingTop: toRN(tokens.spacing[4]),
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle
  },
  restrictedInfoItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[2])
  },
  restrictedInfoText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.primary
  },

  // Loading state
  loadingCard: {
    marginBottom: toRN(tokens.spacing[4])
  },
  loadingHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[4])
  },
  loadingTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary
  },
  loadingContent: {
    marginBottom: toRN(tokens.spacing[4])
  },
  loadingMessage: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.tertiary,
    textAlign: "center" as const,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5
  },

  // Error state
  errorCard: {
    marginBottom: toRN(tokens.spacing[4]),
    alignItems: "center" as const
  },
  errorHeader: {
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[3])
  },
  errorTitle: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
    marginTop: toRN(tokens.spacing[2]),
    textAlign: "center" as const
  },
  errorMessage: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[2]),
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5
  },
  errorHelpText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.tertiary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[4]),
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5
  }
});
