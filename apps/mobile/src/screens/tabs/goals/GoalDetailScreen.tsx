import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useTranslation } from "@/lib/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { BackButton } from "@/components/ui/BackButton";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { useGoal } from "@/hooks/api/useGoals";
import { useTodayCheckIns, useCheckIns } from "@/hooks/api/useCheckIns";
import { CheckInModal } from "@/screens/tabs/home/components/CheckInModal";
import { CheckIn } from "@/services/api/checkins";
import { Ionicons } from "@expo/vector-icons";
import { formatDate } from "@/utils/helper";
import { PlanSection } from "./components/PlanSection";
import { GoalProgressSection } from "./components/GoalProgressSection";
import { usePlanStatus } from "@/hooks/api/useActionablePlans";
import Button from "@/components/ui/Button";

// Tab IDs
const TAB_OVERVIEW = "overview";
const TAB_PROGRESS = "progress";
const TAB_PLAN = "plan";

export default function GoalDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const goalId = params.id;
  const styles = useStyles(makeGoalDetailScreenStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const {
    data: goalResponse,
    isLoading: goalLoading,
    refetch: refetchGoal,
  } = useGoal(goalId || "");
  const {
    data: checkInsResponse,
    isLoading: checkInsLoading,
    refetch: refetchCheckIns,
  } = useCheckIns(goalId || undefined);
  const { data: todayCheckInsResponse, refetch: refetchTodayCheckIns } =
    useTodayCheckIns();

  const goal = goalResponse?.data;
  const checkIns = checkInsResponse?.data || [];

  // 🔄 Poll for plan status at screen level (not just when Plan tab is active)
  // This ensures we detect when plan generation completes regardless of which tab is shown
  const { data: planStatusData } = usePlanStatus(goalId);
  const planStatus = planStatusData?.status;
  const isPlanGenerating =
    planStatus === "pending" || planStatus === "generating";

  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [selectedCheckIn, setSelectedCheckIn] = useState<CheckIn | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState(TAB_OVERVIEW);
  const [showAllCheckIns, setShowAllCheckIns] = useState(false);

  // Number of check-ins to show initially
  const INITIAL_CHECKINS_COUNT = 3;

  // Find today's check-in for this goal
  const todayCheckIn = useMemo(() => {
    if (!todayCheckInsResponse?.data || !goalId) return null;
    const today = new Date().toISOString().split("T")[0];
    return (
      todayCheckInsResponse.data.find(
        (ci: CheckIn) => ci.goal_id === goalId && ci.date === today
      ) || null
    );
  }, [todayCheckInsResponse, goalId]);

  const handleCheckInPress = () => {
    if (todayCheckIn) {
      setSelectedCheckIn(todayCheckIn);
      setShowCheckInModal(true);
    } else {
      console.log("No check-in for today, need to create one first");
    }
  };

  const handleCheckInComplete = () => {
    refetchTodayCheckIns();
    setShowCheckInModal(false);
    setSelectedCheckIn(null);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchGoal(),
        refetchCheckIns(),
        refetchTodayCheckIns(),
      ]);
    } catch (error) {
      console.error("Error refreshing goal detail:", error);
    } finally {
      setRefreshing(false);
    }
  };

  // Tab configuration - always show all tabs, PlanSection handles empty state
  const tabs = useMemo(() => {
    return [
      { id: TAB_OVERVIEW, label: t("challenges.overview") || "Overview" },
      { id: TAB_PROGRESS, label: t("challenges.progress") || "Progress" },
      { id: TAB_PLAN, label: t("challenges.plan") || "Plan" },
    ];
  }, [t]);

  // Use is_checked_in (user has responded) not completed (user did the goal)
  const canCheckIn = todayCheckIn && !todayCheckIn.is_checked_in;

  // Render Overview Tab
  const renderOverviewTab = () => {
    if (!goal) return null;

    return (
      <>
        {/* Plan Generating Indicator */}
        {isPlanGenerating && (
          <Card shadow="sm" style={styles.generatingCard}>
            <View style={styles.generatingContent}>
              <Ionicons name="sparkles" size={20} color={brandColors.primary} />
              <View style={styles.generatingTextContainer}>
                <Text style={styles.generatingTitle}>
                  {t("goals.plan.generating_title")}
                </Text>
                <Text style={styles.generatingMessage}>
                  {t("goals.plan.generating_message")}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Goal Description */}
        <Card shadow="sm" style={styles.descriptionCard}>
          <Text style={styles.goalTitle}>{goal.title}</Text>
          {goal.description && (
            <Text style={styles.description}>{goal.description}</Text>
          )}

          {/* Date Info Row */}
          <View style={styles.dateInfoRow}>
            <View style={styles.dateInfoItem}>
              <Ionicons
                name="grid-outline"
                size={14}
                color={brandColors.primary}
              />
              <Text style={styles.dateInfoLabel}>
                {t("goals.category") || "Category"}
              </Text>
              <Text style={styles.dateInfoValue}>
                {t(`goals.category_${goal.category}`)}
              </Text>
            </View>

            <View style={styles.dateInfoItem}>
              <Ionicons
                name="repeat-outline"
                size={14}
                color={colors.text.secondary}
              />
              <Text style={styles.dateInfoLabel}>
                {t("goals.plan.frequency") || "Frequency"}
              </Text>
              <Text style={styles.dateInfoValue}>
                {t(`goals.frequency.${goal.frequency}`)}
              </Text>
            </View>
          </View>
        </Card>

        {/* Scheduled Days - Show for weekly goals */}
        {goal.frequency === "weekly" &&
          goal.days_of_week &&
          goal.days_of_week.length > 0 && (
            <View style={styles.scheduledDaysCard}>
              <Text style={styles.metaLabel}>
                {t("goals.scheduled_days") || "Scheduled Days"}
              </Text>
              <View style={styles.daysRow}>
                {["S", "M", "T", "W", "T", "F", "S"].map((dayLabel, index) => {
                  const isActive = (goal.days_of_week || []).includes(index);
                  return (
                    <View
                      key={index}
                      style={[
                        styles.dayBadge,
                        isActive && styles.dayBadgeActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayBadgeText,
                          isActive && styles.dayBadgeTextActive,
                        ]}
                      >
                        {dayLabel}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

        {/* Reminder Times / Workout Times */}
        {goal.reminder_times && goal.reminder_times.length > 0 && (
          <View style={styles.scheduledDaysCard}>
            <Text style={styles.metaLabel}>
              {t("goals.reminder_times") || "Workout Times"}
            </Text>
            <View style={styles.reminderTimesRow}>
              {goal.reminder_times.map((time, index) => (
                <View key={index} style={styles.reminderTimeBadge}>
                  <Ionicons
                    name="time-outline"
                    size={14}
                    color={brandColors.primary}
                  />
                  <Text style={styles.reminderTimeText}>{time}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Check In Button */}
        {canCheckIn && (
          <Button
            title={t("home.complete_checkin")}
            onPress={handleCheckInPress}
            leftIcon="checkmark-circle"
          />
        )}

        {/* No check-in scheduled for today */}
        {!todayCheckIn && goal.is_active && (
          <View style={styles.noCheckInCard}>
            <Ionicons
              name="calendar-outline"
              size={toRN(tokens.typography.fontSize.xl)}
              color={colors.text.tertiary}
            />
            <Text style={styles.noCheckInText}>
              {t("home.no_checkins_message")}
            </Text>
          </View>
        )}

        {/* Already checked in today */}
        {todayCheckIn?.is_checked_in && (
          <View style={styles.checkedInBadge}>
            <Ionicons
              name={
                todayCheckIn.completed ? "checkmark-circle" : "close-circle"
              }
              size={20}
              color={
                todayCheckIn.completed
                  ? colors.feedback.success
                  : colors.feedback.error
              }
            />
            <Text
              style={[
                styles.checkedInText,
                !todayCheckIn.completed && { color: colors.feedback.error },
              ]}
            >
              {todayCheckIn.completed
                ? t("checkin.completed_today") || "Completed today"
                : t("checkin.marked_incomplete") || "Marked as incomplete"}
            </Text>
          </View>
        )}
      </>
    );
  };

  // Render Progress Tab
  const renderProgressTab = () => {
    if (!goal) return null;

    return (
      <>
        {/* Goal Progress Section */}
        <GoalProgressSection
          goalId={goal.id}
          goalType={goal.goal_type}
          targetCheckins={goal.target_checkins}
          challengeStartDate={goal.challenge_start_date}
          challengeEndDate={goal.challenge_end_date}
          frequency={goal.frequency}
          daysOfWeek={goal.days_of_week}
        />

        {/* Check-Ins History */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {t("checkin.checkin_history")}
            </Text>
            {checkIns.length > 0 && (
              <Text style={styles.sectionCount}>
                {checkIns.length} {t("checkin.total") || "total"}
              </Text>
            )}
          </View>

          {checkInsLoading ? (
            <View>
              {[1, 2, 3].map((i) => (
                <SkeletonBox
                  key={i}
                  width="100%"
                  height={60}
                  style={{ marginBottom: toRN(tokens.spacing[3]) }}
                />
              ))}
            </View>
          ) : checkIns.length === 0 ? (
            <Card shadow="sm" style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                {t("checkin.no_checkins_yet")}
              </Text>
            </Card>
          ) : (
            <>
              <View style={styles.checkInsList}>
                {checkIns
                  .slice(
                    0,
                    showAllCheckIns ? checkIns.length : INITIAL_CHECKINS_COUNT
                  )
                  .map((checkIn: CheckIn) => (
                    <Card
                      key={checkIn.id}
                      shadow="sm"
                      style={styles.checkInCard}
                    >
                      <View style={styles.checkInCardContent}>
                        <View style={styles.checkInCardLeft}>
                          <Text style={styles.checkInDate}>
                            {formatDate(checkIn.date, "short")}
                          </Text>
                          {checkIn.reflection && (
                            <Text
                              style={styles.checkInReflection}
                              numberOfLines={2}
                            >
                              {checkIn.reflection}
                            </Text>
                          )}
                        </View>
                        <View style={styles.checkInCardRight}>
                          {checkIn.completed ? (
                            <Ionicons
                              name="checkmark-circle"
                              size={24}
                              color={colors.feedback.success}
                            />
                          ) : (
                            <Ionicons
                              name="ellipse-outline"
                              size={24}
                              color={colors.text.tertiary}
                            />
                          )}
                          {checkIn.mood && (
                            <Text style={styles.checkInMood}>
                              {["😞", "😐", "😊", "😄", "🤩"][checkIn.mood - 1]}
                            </Text>
                          )}
                        </View>
                      </View>
                    </Card>
                  ))}
              </View>

              {/* View All / Show Less Button */}
              {checkIns.length > INITIAL_CHECKINS_COUNT && (
                <TouchableOpacity
                  style={styles.viewAllButton}
                  onPress={() => setShowAllCheckIns(!showAllCheckIns)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.viewAllButtonText}>
                    {showAllCheckIns
                      ? t("common.show_less") || "Show Less"
                      : `${t("common.view_all") || "View All"} (${checkIns.length - INITIAL_CHECKINS_COUNT} ${t("common.more") || "more"})`}
                  </Text>
                  <Ionicons
                    name={showAllCheckIns ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={brandColors.primary}
                  />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </>
    );
  };

  // Render Plan Tab
  const renderPlanTab = () => {
    if (!goal) return null;

    // Pass planStatus prop to avoid duplicate polling
    return <PlanSection goalId={goal.id} planStatus={planStatusData} />;
  };

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case TAB_OVERVIEW:
        return renderOverviewTab();
      case TAB_PROGRESS:
        return renderProgressTab();
      case TAB_PLAN:
        return renderPlanTab();
      default:
        return renderOverviewTab();
    }
  };

  if (goalLoading) {
    return (
      <View style={styles.container}>
        <BackButton onPress={() => router.back()} />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
        >
          {/* Description Card Skeleton */}
          <Card shadow="sm" style={styles.descriptionCard}>
            <SkeletonBox
              width="60%"
              height={24}
              borderRadius={toRN(tokens.borderRadius.md)}
            />
            <SkeletonBox
              width="100%"
              height={60}
              borderRadius={toRN(tokens.borderRadius.md)}
              style={{ marginTop: toRN(tokens.spacing[2]) }}
            />
          </Card>

          {/* Meta Row Skeleton */}
          <View style={styles.metaRow}>
            <View style={styles.metaCard}>
              <SkeletonBox
                width="50%"
                height={12}
                borderRadius={toRN(tokens.borderRadius.sm)}
              />
              <SkeletonBox
                width="70%"
                height={20}
                borderRadius={toRN(tokens.borderRadius.sm)}
                style={{ marginTop: toRN(tokens.spacing[1]) }}
              />
            </View>
            <View style={styles.metaCard}>
              <SkeletonBox
                width="50%"
                height={12}
                borderRadius={toRN(tokens.borderRadius.sm)}
              />
              <SkeletonBox
                width="70%"
                height={20}
                borderRadius={toRN(tokens.borderRadius.sm)}
                style={{ marginTop: toRN(tokens.spacing[1]) }}
              />
            </View>
          </View>

          {/* Check-in Button Skeleton */}
          <SkeletonBox
            width="100%"
            height={toRN(tokens.spacing[12])}
            borderRadius={toRN(tokens.borderRadius.xl)}
            style={{ marginBottom: toRN(tokens.spacing[4]) }}
          />

          {/* Plan Section Skeleton */}
          <View style={styles.section}>
            <SkeletonBox
              width="40%"
              height={24}
              borderRadius={toRN(tokens.borderRadius.md)}
            />
            <Card
              shadow="md"
              style={{
                marginTop: toRN(tokens.spacing[4]),
                padding: toRN(tokens.spacing[6]),
              }}
            >
              <SkeletonBox
                width="60%"
                height={20}
                borderRadius={toRN(tokens.borderRadius.md)}
              />
              <SkeletonBox
                width="100%"
                height={100}
                borderRadius={toRN(tokens.borderRadius.md)}
                style={{ marginTop: toRN(tokens.spacing[4]) }}
              />
            </Card>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (!goal) {
    return (
      <View style={styles.container}>
        <BackButton onPress={() => router.back()} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{t("common.error")}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BackButton
        onPress={() => router.back()}
        title={goal.title}
        titleCentered
      />

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <Tabs
          tabs={tabs}
          selectedId={activeTab}
          onChange={setActiveTab}
          variant="underline"
          size="md"
          fullWidth
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.text.tertiary}
            colors={[colors.text.tertiary]}
          />
        }
      >
        {renderTabContent()}
      </ScrollView>

      {/* Check-In Modal */}
      {selectedCheckIn && (
        <CheckInModal
          visible={showCheckInModal}
          checkIn={selectedCheckIn}
          onClose={() => {
            setShowCheckInModal(false);
            setSelectedCheckIn(null);
          }}
          onComplete={handleCheckInComplete}
        />
      )}
    </View>
  );
}

const makeGoalDetailScreenStyles = (
  tokens: any,
  colors: any,
  brandColors: any
) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[6]),
  },
  tabsContainer: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[2]),
    backgroundColor: colors.bg.canvas,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    padding: toRN(tokens.spacing[6]),
  },
  errorText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
  },
  descriptionCard: {
    marginBottom: toRN(tokens.spacing[4]),
    padding: toRN(tokens.spacing[4]),
    marginTop: toRN(tokens.spacing[4]),
    backgroundColor: colors.bg.card,
  },
  description: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.primary,
    lineHeight: toRN(tokens.typography.fontSize.base) * 1.6,
  },
  goalTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[2]),
  },
  dateInfoRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "flex-start" as const,
    flexWrap: "wrap" as const,
    gap: toRN(tokens.spacing[3]),
    paddingTop: toRN(tokens.spacing[3]),
    marginTop: toRN(tokens.spacing[3]),
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  dateInfoItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1.5]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[2]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.full),
  },
  dateInfoLabel: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.xs),
    color: colors.text.secondary,
  },
  dateInfoValue: {
    fontFamily: fontFamily.semiBold,
    fontSize: toRN(tokens.typography.fontSize.xs),
    color: colors.text.primary,
  },
  metaRow: {
    flexDirection: "row" as const,
    gap: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[4]),
  },
  metaCard: {
    flex: 1,
    backgroundColor: colors.bg.card,
    padding: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.lg),
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  metaLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.tertiary,
    marginBottom: toRN(tokens.spacing[1]),
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary,
  },
  scheduledDaysCard: {
    backgroundColor: colors.bg.card,
    padding: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.xl),
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: toRN(tokens.spacing[4]),
  },
  daysRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    marginTop: toRN(tokens.spacing[2]),
  },
  dayBadge: {
    width: toRN(tokens.spacing[8]),
    height: toRN(tokens.spacing[8]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: colors.bg.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  dayBadgeActive: {
    backgroundColor: brandColors.primary,
  },
  dayBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.tertiary,
  },
  reminderTimesRow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: toRN(tokens.spacing[2]),
    marginTop: toRN(tokens.spacing[2]),
  },
  reminderTimeBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[2]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: colors.bg.muted,
  },
  reminderTimeText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.primary,
  },
  dayBadgeTextActive: {
    color: "#FFFFFF",
  },
  checkInButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: brandColors.primary,
    paddingVertical: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.xl),
    marginBottom: toRN(tokens.spacing[4]),
    gap: toRN(tokens.spacing[2]),
  },
  checkInButtonText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.bold,
    color: "#FFFFFF",
  },
  noCheckInCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: colors.bg.muted,
    padding: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.xl),
    marginBottom: toRN(tokens.spacing[4]),
    gap: toRN(tokens.spacing[2]),
  },
  noCheckInText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
  },
  checkedInBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    backgroundColor: colors.feedback.success + "15",
    borderRadius: toRN(tokens.borderRadius.xl),
    marginBottom: toRN(tokens.spacing[4]),
  },
  checkedInText: {
    fontFamily: fontFamily.medium,
    fontSize: toRN(tokens.typography.fontSize.base),
    color: colors.feedback.success,
  },
  section: {
    marginTop: toRN(tokens.spacing[4]),
  },
  sectionHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    marginBottom: toRN(tokens.spacing[4]),
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
  },
  sectionCount: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
  },
  emptyCard: {
    padding: toRN(tokens.spacing[6]),
    alignItems: "center" as const,
  },
  emptyText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
  },
  checkInsList: {
    gap: toRN(tokens.spacing[3]),
  },
  checkInCard: {
    padding: toRN(tokens.spacing[4]),
  },
  checkInCardContent: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
  checkInCardLeft: {
    flex: 1,
    marginRight: toRN(tokens.spacing[3]),
  },
  checkInDate: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[1]),
  },
  checkInReflection: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
  },
  checkInCardRight: {
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
  },
  checkInMood: {
    fontSize: toRN(tokens.typography.fontSize.lg),
  },
  viewAllButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[1]),
    paddingVertical: toRN(tokens.spacing[3]),
    marginTop: toRN(tokens.spacing[2]),
  },
  viewAllButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: brandColors.primary,
  },
  // Plan generating indicator styles
  generatingCard: {
    marginBottom: toRN(tokens.spacing[4]),
    padding: toRN(tokens.spacing[4]),
    backgroundColor: brandColors.primary + "15",
    borderWidth: 1,
    borderColor: brandColors.primary + "30",
  },
  generatingContent: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
  },
  generatingTextContainer: {
    flex: 1,
  },
  generatingTitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: brandColors.primary,
  },
  generatingMessage: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    marginTop: toRN(tokens.spacing[0.5]),
  },
  // Plan ready indicator styles
  planReadyCard: {
    marginBottom: toRN(tokens.spacing[4]),
    padding: toRN(tokens.spacing[3]),
    backgroundColor: colors.feedback.success + "15",
    borderRadius: toRN(tokens.borderRadius.lg),
    borderWidth: 1,
    borderColor: colors.feedback.success + "30",
  },
  planReadyContent: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
  },
  planReadyText: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.feedback.success,
  },
});
