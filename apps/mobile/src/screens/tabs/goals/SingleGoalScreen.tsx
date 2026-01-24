import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { useTranslation } from "@/lib/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { BackButton } from "@/components/ui/BackButton";
import { Card } from "@/components/ui/Card";
import { SingleGoalSkeleton } from "@/components/skeletons";
import {
  useGoal,
  useUpdateGoal,
  useDeleteGoal,
  useGoalInsights,
  useRefreshGoalInsights
} from "@/hooks/api/useGoals";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { AdBanner } from "@/components/ads";
import { ChevronRight, Moon, Lock, Sparkles } from "lucide-react-native";
import PatternInsights from "./PatternInsights";
import { useCheckIns, useCheckInsByDateRange } from "@/hooks/api/useCheckIns";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { CheckInModal } from "@/screens/tabs/home/components/CheckInModal";
import { CheckInDetailModal } from "@/components/modals/CheckInDetailModal";
import { CheckIn } from "@/services/api/checkins";
import Button from "@/components/ui/Button";
import { NotFoundState } from "@/components/ui/NotFoundState";
import { MOBILE_ROUTES } from "@/lib/routes";
import {
  CheckCircle,
  XCircle,
  Circle,
  Calendar,
  Clock,
  Flame,
  Target,
  MoreVertical,
  Edit,
  Archive,
  Trash2,
  RotateCcw
} from "lucide-react-native";
import { formatDate, formatReminderTime } from "@/utils/helper";

export default function SingleGoalScreen() {
  const params = useLocalSearchParams<{ id?: string; openCheckIn?: string }>();
  const goalId = params.id;
  const shouldOpenCheckIn = params.openCheckIn === "true";

  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { showAlert, showToast } = useAlertModal();

  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCheckInId, setSelectedCheckInId] = useState<string | null>(null);

  // Subscription check for premium features
  const { hasFeature } = useSubscriptionStore();
  const hasPatternDetection = hasFeature("pattern_detection");

  // Fetch goal
  const {
    data: goalResponse,
    isLoading: goalLoading,
    refetch: refetchGoal
  } = useGoal(goalId || "");

  const goal = goalResponse?.data;

  // Fetch check-ins for this goal (recent list, streak)
  const {
    data: checkInsData,
    isLoading: checkInsLoading,
    refetch: refetchCheckIns
  } = useCheckIns(goalId);

  const checkIns = checkInsData?.data || [];

  // Last-30-day range for schedule-aware completion rate (off-days excluded)
  // Shows last 30 days, or since goal creation if the goal is newer than 30 days
  const last30Range = useMemo(() => {
    if (!goal?.created_at) return null;
    const today = new Date();
    const end = today.toISOString().slice(0, 10);
    const from = new Date(today);
    from.setDate(today.getDate() - 30);
    const startDefault = from.toISOString().slice(0, 10);
    const created = new Date(goal.created_at);
    const startCreated = created.toISOString().slice(0, 10);
    const start = startCreated > startDefault ? startCreated : startDefault;
    return { start, end };
  }, [goal?.created_at]);

  const { data: last30Data, refetch: refetchLast30 } = useCheckInsByDateRange(
    last30Range?.start ?? "",
    last30Range?.end ?? "",
    goalId ?? undefined
  );
  const checkInsLast30 = last30Data?.data ?? [];

  // Fetch insights (Premium only) – refetch on pull-to-refresh so PatternInsights uses fresh DB data
  const {
    data: insightsResponse,
    isLoading: insightsLoading,
    refetch: refetchInsights
  } = useGoalInsights(goalId || "", hasPatternDetection);
  const insightsData = insightsResponse?.data;
  const insightsStatus = insightsData?.status || "pending";
  const insights = insightsData?.insights || [];
  const currentMetrics = insightsData?.current_metrics;
  const previousMetrics = insightsData?.previous_metrics;

  // Mutations
  const updateMutation = useUpdateGoal();
  const deleteMutation = useDeleteGoal();
  const refreshInsightsMutation = useRefreshGoalInsights();

  // Handle retry for failed insights
  const handleRetryInsights = useCallback(() => {
    if (goalId) {
      refreshInsightsMutation.mutate(goalId);
    }
  }, [goalId, refreshInsightsMutation]);

  // Stats: schedule-aware for last 30 days (or since goal creation if newer)
  // Off-days excluded from rate - only scheduled days count
  const stats = useMemo(() => {
    const completedFromLast30 = checkInsLast30.filter(
      (c) => c.status === "completed" || c.status === "rest_day"
    ).length;

    if (!goal || !last30Range) {
      const completed = checkIns.filter((c) => c.status === "completed").length;
      const total = checkIns.filter((c) => c.status !== "pending").length;
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
      return { completed, total, completionRate };
    }

    const goalCreated = goal.created_at
      ? new Date(goal.created_at).toISOString().slice(0, 10)
      : null;
    if (!goalCreated) {
      return {
        completed: completedFromLast30,
        total: 0,
        completionRate: 0
      };
    }

    const { start, end } = last30Range;
    let scheduledDays = 0;
    const s = new Date(start);
    const e = new Date(end);
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      if (dateStr < goalCreated) continue;
      if (goal.frequency_type === "daily") {
        scheduledDays += 1;
      } else if (goal.frequency_type === "weekly" && goal.target_days?.length) {
        const dow = d.getDay();
        if (goal.target_days.includes(dow)) scheduledDays += 1;
      } else if (
        goal.frequency_type === "weekly" &&
        (!goal.target_days || goal.target_days.length === 0)
      ) {
        scheduledDays += 1;
      }
    }

    const completionRate =
      scheduledDays > 0 ? Math.round((100 * completedFromLast30) / scheduledDays) : 0;
    return {
      completed: completedFromLast30,
      total: scheduledDays,
      completionRate
    };
  }, [checkIns, checkInsLast30, goal, last30Range]);

  // Check if today is a scheduled day for this goal
  const isScheduledToday = useMemo(() => {
    if (!goal) return false;
    if (goal.frequency_type === "daily") return true;

    // For weekly goals, check if today is in target_days
    const todayDayOfWeek = new Date().getDay(); // 0 = Sunday, 6 = Saturday
    return goal.target_days?.includes(todayDayOfWeek) ?? false;
  }, [goal?.frequency_type, goal?.target_days]);

  // Get today's check-in and its status
  // With pre-created check-ins, a "pending" status means user hasn't responded yet
  const todayCheckIn = useMemo(() => {
    if (!checkIns.length) return null;

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    return checkIns.find((checkIn) => checkIn.check_in_date === todayStr) || null;
  }, [checkIns]);

  // User can check in if: scheduled today AND (no check-in exists OR check-in is pending)
  const canCheckInToday = useMemo(() => {
    if (!isScheduledToday) return false;
    // No check-in exists (edge case) or check-in is pending
    return !todayCheckIn || todayCheckIn.status === "pending";
  }, [isScheduledToday, todayCheckIn]);

  // Track if we've already auto-opened the modal (prevent re-opening on re-renders)
  const hasAutoOpenedRef = useRef(false);

  // Auto-open CheckInModal when coming from notification deep link
  useEffect(() => {
    if (
      shouldOpenCheckIn &&
      !hasAutoOpenedRef.current &&
      goal &&
      goal.status === "active" &&
      canCheckInToday &&
      !goalLoading &&
      !checkInsLoading
    ) {
      hasAutoOpenedRef.current = true;
      setShowCheckInModal(true);
    }
  }, [shouldOpenCheckIn, goal, canCheckInToday, goalLoading, checkInsLoading]);

  // Refresh handler – refetch goal, check-ins, last-30 stats, and insights so PatternInsights gets fresh data
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([refetchGoal(), refetchCheckIns(), refetchLast30(), refetchInsights()]);
    setIsRefreshing(false);
  }, [refetchGoal, refetchCheckIns, refetchLast30, refetchInsights]);

  // Check if goal is archived
  const isArchived = goal?.status === "archived";

  // Archive goal
  const handleArchive = useCallback(async () => {
    setShowMenu(false);
    const confirmed = await showAlert({
      title: t("goals.archive.title"),
      message: t("goals.archive.message"),
      variant: "warning",
      confirmLabel: t("goals.archive.confirm"),
      cancelLabel: t("common.cancel"),
      showCancel: true
    });

    if (confirmed) {
      try {
        await updateMutation.mutateAsync({ goalId: goalId!, updates: { status: "archived" } });
        router.back();
      } catch (error) {
        showToast({ title: t("goals.archive.error"), variant: "error" });
      }
    }
  }, [goalId, updateMutation, showAlert, showToast, t, router]);

  // Activate archived goal
  const handleActivate = useCallback(async () => {
    setShowMenu(false);
    const confirmed = await showAlert({
      title: t("goals.activate.title"),
      message: t("goals.activate.message"),
      variant: "info",
      confirmLabel: t("goals.activate.confirm"),
      cancelLabel: t("common.cancel"),
      showCancel: true
    });

    if (confirmed) {
      try {
        await updateMutation.mutateAsync({ goalId: goalId!, updates: { status: "active" } });
        router.back();
      } catch (error) {
        showToast({ title: t("goals.activate.error"), variant: "error" });
      }
    }
  }, [goalId, updateMutation, showAlert, showToast, t]);

  // Delete goal
  const handleDelete = useCallback(async () => {
    setShowMenu(false);
    const confirmed = await showAlert({
      title: t("goals.delete.title"),
      message: t("goals.delete.message"),
      variant: "error",
      confirmLabel: t("goals.delete.confirm"),
      cancelLabel: t("common.cancel"),
      showCancel: true
    });

    if (confirmed) {
      try {
        await deleteMutation.mutateAsync(goalId!);
        router.back();
      } catch (error) {
        showToast({ title: t("goals.delete.error"), variant: "error" });
      }
    }
  }, [goalId, deleteMutation, showAlert, showToast, t, router]);

  // Edit goal
  const handleEdit = useCallback(() => {
    setShowMenu(false);
    router.push({
      pathname: MOBILE_ROUTES.GOALS.CREATE,
      params: { goalId, mode: "edit" }
    });
  }, [goalId, router]);

  // Loading state - don't wait for insights, they load in their own card
  if (goalLoading || checkInsLoading) {
    return <SingleGoalSkeleton />;
  }

  // Not found state
  if (!goal) {
    return (
      <NotFoundState
        title={t("goals.not_found.title")}
        description={t("goals.not_found.message")}
      />
    );
  }

  // Current streak from recent check-ins (V2: use status field)
  let currentStreak = 0;
  const sortedCheckIns = [...checkIns].sort(
    (a, b) => new Date(b.check_in_date).getTime() - new Date(a.check_in_date).getTime()
  );
  for (const checkIn of sortedCheckIns) {
    if (checkIn.status === "completed" || checkIn.status === "rest_day") {
      currentStreak++;
    } else if (checkIn.status !== "pending") {
      break; // missed or skipped breaks streak
    }
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <BackButton
        title={goal.title}
        onPress={() => router.back()}
        rightInput={
          <TouchableOpacity onPress={() => setShowMenu(!showMenu)} style={styles.menuButton}>
            <MoreVertical size={24} color={colors.text.primary} />
          </TouchableOpacity>
        }
      />

      {/* Dropdown Menu */}
      {showMenu && (
        <>
          {/* Backdrop to close menu on outside tap */}
          <TouchableOpacity
            style={styles.menuBackdrop}
            activeOpacity={1}
            onPress={() => setShowMenu(false)}
          />
          <View style={styles.menu}>
            <TouchableOpacity style={styles.menuItem} onPress={handleEdit}>
              <Edit size={18} color={colors.text.primary} />
              <Text style={styles.menuText}>{t("common.edit")}</Text>
            </TouchableOpacity>
            {isArchived ? (
              <TouchableOpacity style={styles.menuItem} onPress={handleActivate}>
                <RotateCcw size={18} color={colors.text.secondary} />
                <Text style={[styles.menuText, { color: colors.text.secondary }]}>
                  {t("goals.activate.action")}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.menuItem} onPress={handleArchive}>
                <Archive size={18} color={colors.text.secondary} />
                <Text style={[styles.menuText, { color: colors.text.secondary }]}>
                  {t("goals.archive.action")}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
              <Trash2 size={18} color={colors.feedback.error} />
              <Text style={[styles.menuText, { color: colors.feedback.error }]}>
                {t("common.delete")}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={brandColors.primary}
          />
        }
      >
        {/* Goal Info Card */}
        <Card style={styles.infoCard}>
          <View style={styles.goalHeader}>
            <View style={styles.goalInfo}>
              <Text style={styles.goalTitle}>{goal.title}</Text>
              {goal.why_statement && (
                <Text style={styles.goalDescription}>{goal.why_statement}</Text>
              )}
            </View>
          </View>

          {/* Streak & Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Flame size={20} color={brandColors.primary} />
              <Text style={styles.statValue}>{currentStreak}</Text>
              <Text style={styles.statLabel}>{t("goals.stats.streak")}</Text>
            </View>
            <View style={styles.statItem}>
              <Target size={20} color={colors.feedback.success} />
              <Text style={styles.statValue}>{stats.completionRate}%</Text>
              <Text style={styles.statLabel}>{t("goals.stats.rate")}</Text>
            </View>
            <View style={styles.statItem}>
              <CheckCircle size={20} color={colors.feedback.success} />
              <Text style={styles.statValue}>{stats.completed}</Text>
              <Text style={styles.statLabel}>{t("goals.stats.completed")}</Text>
            </View>
          </View>
        </Card>

        {/* Schedule Card */}
        <Card style={styles.scheduleCard}>
          <View style={styles.scheduleRow}>
            {/* Schedule */}
            <View style={styles.scheduleItem}>
              <View
                style={[styles.scheduleIconWrap, { backgroundColor: brandColors.primary + "15" }]}
              >
                <Calendar size={16} color={brandColors.primary} />
              </View>
              <View style={styles.scheduleContent}>
                <Text style={styles.scheduleLabel}>{t("goals.scheduled_days")}</Text>
                {goal.frequency_type === "daily" ? (
                  <Text style={styles.scheduleValue}>{t("goals.daily")}</Text>
                ) : (
                  <View style={styles.daysContainer}>
                    {goal.target_days && goal.target_days.length > 0 ? (
                      goal.target_days
                        .sort((a, b) => a - b)
                        .map((day) => {
                          const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
                          return (
                            <View key={day} style={styles.dayPill}>
                              <Text style={styles.dayPillText}>
                                {t(`common.days_of_week.${dayKeys[day]}`)}
                              </Text>
                            </View>
                          );
                        })
                    ) : (
                      <Text style={styles.scheduleValue}>
                        {goal.frequency_count}x {t("goals.frequency.per_week")}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            </View>

            {/* Reminder */}
            {goal.reminder_times && goal.reminder_times.length > 0 && (
              <View style={styles.scheduleItem}>
                <View
                  style={[
                    styles.scheduleIconWrap,
                    { backgroundColor: colors.feedback.success + "15" }
                  ]}
                >
                  <Clock size={16} color={colors.feedback.success} />
                </View>
                <View style={styles.scheduleContent}>
                  <Text style={styles.scheduleLabel}>{t("goals.reminder_times")}</Text>
                  <View style={styles.timesContainer}>
                    {goal.reminder_times.map((time, index) => (
                      <Text key={index} style={styles.scheduleValue}>
                        {formatReminderTime(time)}
                        {index < goal.reminder_times!.length - 1 ? ", " : ""}
                      </Text>
                    ))}
                  </View>
                </View>
              </View>
            )}
          </View>
        </Card>

        {/* Check-in Button - Only show if active and can check in today (pending or no check-in) */}
        {goal.status === "active" && canCheckInToday && (
          <Button
            onPress={() => setShowCheckInModal(true)}
            title={t("goals.check_in_now")}
            variant="primary"
            size="md"
            fullWidth
            style={{ marginBottom: toRN(tokens.spacing[4]) }}
          />
        )}

        {/* Pattern Insights Section */}
        <PatternInsights
          goalId={goalId || ""}
          hasPatternDetection={hasPatternDetection}
          insightsStatus={insightsStatus}
          insightsData={insightsData}
          insights={insights}
          currentMetrics={currentMetrics}
          previousMetrics={previousMetrics}
          isLoading={insightsLoading}
          isRetrying={refreshInsightsMutation.isPending}
          onRetry={handleRetryInsights}
        />

        {/* Recent Check-ins */}
        <Card style={styles.historyCard}>
          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitle}>{t("goals.recent_checkins")}</Text>
            {checkIns.filter((c) => c.status !== "pending").length > 5 && (
              <TouchableOpacity
                style={styles.seeAllButton}
                onPress={() =>
                  router.push({
                    pathname: MOBILE_ROUTES.GOALS.CHECKIN_HISTORY,
                    params: { goalId }
                  })
                }
              >
                <Text style={styles.seeAllText}>{t("checkin.see_all")}</Text>
                <ChevronRight size={16} color={brandColors.primary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter out pending check-ins for history display, sorted by latest first */}
          {checkIns.filter((c) => c.status !== "pending").length === 0 ? (
            <Text style={styles.emptyText}>{t("goals.no_checkins_yet")}</Text>
          ) : (
            [...checkIns]
              .filter((c) => c.status !== "pending")
              .sort(
                (a, b) => new Date(b.check_in_date).getTime() - new Date(a.check_in_date).getTime()
              )
              .slice(0, 5)
              .map((checkIn) => (
                <TouchableOpacity
                  key={checkIn.id}
                  style={styles.checkInItem}
                  onPress={() => setSelectedCheckInId(checkIn.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.checkInIcon}>
                    {checkIn.status === "rest_day" ? (
                      <Moon size={18} color={colors.text.tertiary} />
                    ) : checkIn.status === "completed" ? (
                      <CheckCircle size={18} color={colors.feedback.success} />
                    ) : checkIn.status === "pending" ? (
                      <Circle size={18} color={colors.text.tertiary} />
                    ) : (
                      <XCircle size={18} color={colors.feedback.error} />
                    )}
                  </View>
                  <View style={styles.checkInInfo}>
                    <Text style={styles.checkInDate}>{formatDate(checkIn.check_in_date)}</Text>
                    {checkIn.note && (
                      <Text style={styles.checkInNote} numberOfLines={1}>
                        {checkIn.note}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.checkInStatus,
                      {
                        color:
                          checkIn.status === "rest_day" || checkIn.status === "pending"
                            ? colors.text.tertiary
                            : checkIn.status === "completed"
                              ? colors.feedback.success
                              : colors.feedback.error
                      }
                    ]}
                  >
                    {checkIn.status === "rest_day"
                      ? t("checkin.rest_day")
                      : checkIn.status === "completed"
                        ? t("goals.completed")
                        : checkIn.status === "pending"
                          ? t("goals.pending")
                          : t("goals.missed")}
                  </Text>
                </TouchableOpacity>
              ))
          )}
        </Card>

        {/* Ad Banner - Only shows for free users */}
        <AdBanner unitId="GOAL_DETAIL_BANNER" showUpgradeCTA={false} />
      </ScrollView>

      {/* Check-in Modal */}
      {goal && (
        <CheckInModal
          isVisible={showCheckInModal}
          goal={{ id: goal.id, title: goal.title, why_statement: goal.why_statement || undefined }}
          onClose={() => setShowCheckInModal(false)}
          onSuccess={() => {
            setShowCheckInModal(false);
            refetchGoal();
            refetchCheckIns();
            refetchLast30();
          }}
        />
      )}

      {/* Check-in Detail Modal (checkIn from list so AI response updates live when ready) */}
      <CheckInDetailModal
        isVisible={!!selectedCheckInId}
        checkIn={checkIns.find((c) => c.id === selectedCheckInId) ?? null}
        goalTitle={goal?.title}
        onClose={() => setSelectedCheckInId(null)}
      />
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[3]),
    gap: toRN(tokens.spacing[3])
  },
  headerTitle: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontWeight: tokens.typography.fontWeight.semibold,
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary
  },
  menuButton: {
    padding: toRN(tokens.spacing[2])
  },
  menuBackdrop: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99
  },
  menu: {
    position: "absolute" as const,
    top: 60,
    right: toRN(tokens.spacing[4]),
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.lg),
    padding: toRN(tokens.spacing[2]),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100
  },
  menuItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    padding: toRN(tokens.spacing[3]),
    gap: toRN(tokens.spacing[3])
  },
  menuText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.primary
  },
  content: {
    flex: 1,
    paddingHorizontal: toRN(tokens.spacing[4])
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[8])
  },
  infoCard: {
    padding: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[4])
  },
  goalHeader: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[4])
  },
  goalInfo: {
    flex: 1
  },
  goalTitle: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontWeight: tokens.typography.fontWeight.bold,
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[1])
  },
  goalDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.secondary,
    fontFamily: fontFamily.groteskRegular
  },
  scheduleCard: {
    padding: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[4])
  },
  scheduleRow: {
    flexDirection: "column" as const,
    gap: toRN(tokens.spacing[4])
  },
  scheduleItem: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: toRN(tokens.spacing[3])
  },
  scheduleIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  scheduleContent: {
    flex: 1,
    gap: toRN(tokens.spacing[1])
  },
  scheduleLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.tertiary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5
  },
  scheduleValue: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary
  },
  daysContainer: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: toRN(tokens.spacing[1])
  },
  dayPill: {
    backgroundColor: brand.primary + "15",
    paddingHorizontal: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[0.5]),
    borderRadius: toRN(tokens.borderRadius.md)
  },
  dayPillText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskSemiBold,
    color: brand.primary
  },
  timesContainer: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const
  },
  statsRow: {
    flexDirection: "row" as const,
    justifyContent: "space-around" as const,
    paddingTop: toRN(tokens.spacing[4]),
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle
  },
  statItem: {
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1])
  },
  statValue: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontWeight: tokens.typography.fontWeight.bold,
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary
  },
  statLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    color: colors.text.tertiary,
    fontFamily: fontFamily.groteskRegular
  },
  historyCard: {
    padding: toRN(tokens.spacing[4])
  },
  historyHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[3])
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontWeight: tokens.typography.fontWeight.semibold,
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary
  },
  seeAllButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1])
  },
  seeAllText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskMedium,
    color: brand.primary
  },
  emptyText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.tertiary,
    fontFamily: fontFamily.groteskRegular,
    textAlign: "center" as const,
    paddingVertical: toRN(tokens.spacing[6])
  },
  checkInItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[3]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle
  },
  checkInIcon: {
    marginRight: toRN(tokens.spacing[3])
  },
  checkInInfo: {
    flex: 1
  },
  checkInDate: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontWeight: tokens.typography.fontWeight.medium,
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.primary
  },
  checkInNote: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    color: colors.text.tertiary,
    fontFamily: fontFamily.groteskRegular,
    marginTop: toRN(tokens.spacing[0.5])
  },
  checkInStatus: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.secondary
  }
});
