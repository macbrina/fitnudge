import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CheckmarkCircle from "@/components/ui/CheckmarkCircle";
import { useTranslation } from "@/lib/i18n";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { Card } from "@/components/ui/Card";
import { HeatMapCalendar } from "@/components/ui/HeatMapCalendar";
import { WeeklyProgressView } from "@/components/ui/WeeklyProgressView";
import { PremiumChartOverlay } from "@/components/analytics/PremiumChartOverlay";
import { useGoals } from "@/hooks/api/useGoals";
import { useAnalyticsDashboard } from "@/hooks/api/useAnalytics";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { useTabBarInsets } from "@/hooks/useTabBarInsets";
import { AdBanner } from "@/components/ads";
import {
  DUMMY_WEEKLY_CONSISTENCY,
  DUMMY_STREAK_HISTORY,
  DUMMY_MONTHLY_TREND,
  DUMMY_SKIP_REASONS,
  DUMMY_MOOD_TREND
} from "@/data/analyticsDummyData";
import { LineChart, BarChart, PieChart } from "react-native-chart-kit";
import Svg, { Circle, G } from "react-native-svg";
import { MoodIcons } from "@/components/icons/CheckinIcons";

const screenWidth = Dimensions.get("window").width;

// Time range options
type TimeRange = 30 | 90 | 180;
const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: 30, label: "30d" },
  { value: 90, label: "90d" },
  { value: 180, label: "6mo" }
];

/**
 * Analytics Dashboard Screen - Premium Feature
 *
 * V2: Per-goal analytics with goal selector and time range toggle.
 * Free users see blurred preview with upgrade prompt.
 * Premium users see real data from backend.
 */
export default function AnalyticsScreen() {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const tabBarInsets = useTabBarInsets();

  // Check premium status
  const { hasFeature } = useSubscriptionStore();
  const isPremium = hasFeature("advanced_analytics");

  // Fetch active goals for selector
  const { data: goalsResponse, isLoading: isLoadingGoals } = useGoals();
  const activeGoals = useMemo(() => {
    const goals = goalsResponse?.data || [];
    return goals.filter((g: { status: string }) => g.status === "active");
  }, [goalsResponse]);

  // Goal selector state - default to first active goal
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [showGoalPicker, setShowGoalPicker] = useState(false);

  // Time range state - default to 30 days
  const [timeRange, setTimeRange] = useState<TimeRange>(30);

  // Set initial selected goal when goals load
  useEffect(() => {
    if (activeGoals.length > 0 && !selectedGoalId) {
      setSelectedGoalId(activeGoals[0].id);
    }
  }, [activeGoals, selectedGoalId]);

  // Get selected goal info
  const selectedGoal = useMemo(() => {
    return activeGoals.find((g: { id: string }) => g.id === selectedGoalId) as
      | { id: string; title: string; status: string }
      | undefined;
  }, [activeGoals, selectedGoalId]);

  // Fetch per-goal analytics dashboard from backend (premium only)
  const {
    data: dashboardData,
    isLoading: isLoadingDashboard,
    isFetching: isFetchingDashboard,
    forceRefresh: forceRefreshDashboard
  } = useAnalyticsDashboard(selectedGoalId, timeRange);

  // Detect when user switched goal/days and data doesn't match yet
  // This shows loading when switching, but not during background refetches
  const isDataStale = useMemo(() => {
    if (!dashboardData || !selectedGoalId) return false;
    // Data is stale if it's from a different goal or time range than currently selected
    return dashboardData.goal_id !== selectedGoalId || dashboardData.data_range_days !== timeRange;
  }, [dashboardData, selectedGoalId, timeRange]);

  // Show loading when: initial load OR user switched goal/days (data is stale and fetching)
  const isLoading =
    isLoadingGoals || (isPremium && (isLoadingDashboard || (isDataStale && isFetchingDashboard)));

  // Pull-to-refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (isPremium) {
        // Force refresh bypasses Redis cache for fresh data
        await forceRefreshDashboard();
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [forceRefreshDashboard, isPremium]);

  // Transform heatmap data from backend (V2: data comes from RPC with all statuses)
  const heatMapData = useMemo(() => {
    if (!isPremium || !dashboardData?.heatmap_data) return [];

    return dashboardData.heatmap_data.map((item) => ({
      date: item.date,
      status: item.status as
        | "pending"
        | "completed"
        | "skipped"
        | "missed"
        | "rest_day"
        | "not_scheduled"
        | "no_data",
      isScheduled: !["not_scheduled", "no_data"].includes(item.status)
    }));
  }, [isPremium, dashboardData?.heatmap_data]);

  // This week data from backend - now includes proper statuses
  const thisWeekData = useMemo(() => {
    if (!isPremium || !dashboardData?.this_week_summary) return [];

    return dashboardData.this_week_summary.map((item) => ({
      date: item.date,
      status: item.status as
        | "pending"
        | "completed"
        | "skipped"
        | "missed"
        | "rest_day"
        | "not_scheduled"
        | "no_data",
      isScheduled: !["not_scheduled", "no_data"].includes(item.status)
    }));
  }, [isPremium, dashboardData?.this_week_summary]);

  // Get chart data - premium users get real data (even if empty), free users get dummy
  // Premium with empty data will show "no data" states, free users see blurred dummy preview
  const weeklyData = useMemo(() => {
    if (isPremium) {
      // Premium: return real data (may be empty)
      return (dashboardData?.weekly_consistency || []).map((d) => ({
        day: d.day,
        percentage: d.percentage
      }));
    }
    // Free: show dummy data for preview
    return DUMMY_WEEKLY_CONSISTENCY;
  }, [isPremium, dashboardData]);

  const streakData = useMemo(() => {
    if (isPremium) {
      return (dashboardData?.streak_history || []).map((d) => ({
        week: d.week,
        streak: d.max_streak
      }));
    }
    return DUMMY_STREAK_HISTORY;
  }, [isPremium, dashboardData]);

  const monthlyData = useMemo(() => {
    if (isPremium) {
      return (dashboardData?.monthly_trend || []).map((d) => ({
        month: d.month,
        percentage: d.percentage
      }));
    }
    return DUMMY_MONTHLY_TREND;
  }, [isPremium, dashboardData]);

  const skipData = useMemo(() => {
    if (isPremium) {
      return dashboardData?.skip_reasons || [];
    }
    return DUMMY_SKIP_REASONS;
  }, [isPremium, dashboardData]);

  // Mood trend data
  const moodData = useMemo(() => {
    if (isPremium) {
      return dashboardData?.mood_trend || [];
    }
    return DUMMY_MOOD_TREND;
  }, [isPremium, dashboardData]);

  // Check if we have actual data to show (for premium empty states)
  const hasWeeklyData = weeklyData.length > 0;
  const hasStreakData = streakData.some((d) => d.streak > 0);
  const hasMonthlyData = monthlyData.some((d) => d.percentage > 0);
  const hasSkipData = skipData.length > 0;
  const hasMoodData = moodData.length > 0;

  // Chart configuration
  const chartConfig = {
    backgroundGradientFrom: colors.bg.surface,
    backgroundGradientTo: colors.bg.surface,
    color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
    labelColor: () => colors.text.secondary,
    strokeWidth: 2,
    barPercentage: 0.6,
    decimalPlaces: 0,
    propsForLabels: {
      fontFamily: fontFamily.medium,
      fontSize: 10
    }
  };

  // No active goals state
  if (!isLoadingGoals && activeGoals.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t("navigation.progress") || "Progress"}</Text>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="analytics-outline" size={64} color={colors.text.tertiary} />
          <Text style={styles.emptyStateTitle}>
            {t("analytics.no_goals_title") || "No Active Goals"}
          </Text>
          <Text style={styles.emptyStateText}>
            {t("analytics.no_goals_desc") || "Create a goal to start tracking your progress"}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Screen Header with Goal Selector and Time Range */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("navigation.progress") || "Progress"}</Text>
      </View>

      {/* Cache hint - shows when data is served from cache */}
      {isPremium && dashboardData?.cache_hit && (
        <View style={styles.cacheHintBanner}>
          <Ionicons name="flash" size={14} color={colors.text.tertiary} />
          <Text style={styles.cacheHintBannerText}>
            {t("analytics.cached_hint") || "Showing cached data • Pull down to refresh"}
          </Text>
        </View>
      )}

      {/* Goal Selector Label */}
      <Text style={styles.controlsLabel}>
        {t("analytics.viewing_goal") || "Viewing analytics for:"}
      </Text>

      {/* Goal Selector and Time Range Row - Outside header */}
      {isPremium && (
        <View style={styles.controlsRow}>
          {/* Goal Selector Dropdown */}
          <TouchableOpacity
            style={styles.goalSelector}
            onPress={() => setShowGoalPicker(!showGoalPicker)}
            activeOpacity={0.7}
          >
            <Ionicons name="flag" size={16} color={brandColors.primary} style={styles.goalIcon} />
            <Text style={styles.goalSelectorText} numberOfLines={1}>
              {selectedGoal?.title || t("analytics.select_goal") || "Select Goal"}
            </Text>
            <Ionicons
              name={showGoalPicker ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.text.secondary}
            />
          </TouchableOpacity>

          {/* Time Range Toggle */}
          <View style={styles.timeRangeToggle}>
            {TIME_RANGES.map((range) => (
              <TouchableOpacity
                key={range.value}
                style={[
                  styles.timeRangeButton,
                  timeRange === range.value && styles.timeRangeButtonActive
                ]}
                onPress={() => setTimeRange(range.value)}
              >
                <Text
                  style={[
                    styles.timeRangeText,
                    timeRange === range.value && styles.timeRangeTextActive
                  ]}
                >
                  {range.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Goal Picker Dropdown (shown when expanded) */}
      {showGoalPicker && (
        <View style={styles.goalPickerDropdown}>
          {activeGoals.map((goal: { id: string; title: string }) => (
            <TouchableOpacity
              key={goal.id}
              style={[
                styles.goalPickerItem,
                goal.id === selectedGoalId && styles.goalPickerItemActive
              ]}
              onPress={() => {
                setSelectedGoalId(goal.id);
                setShowGoalPicker(false);
              }}
            >
              <Text
                style={[
                  styles.goalPickerText,
                  goal.id === selectedGoalId && styles.goalPickerTextActive
                ]}
                numberOfLines={1}
              >
                {goal.title}
              </Text>
              {goal.id === selectedGoalId && (
                <Ionicons name="checkmark" size={16} color={brandColors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarInsets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={brandColors.primary}
            colors={[brandColors.primary]}
          />
        }
      >
        {/* Premium Upgrade Banner - Only show for free users */}
        {!isPremium && <PremiumUpgradeBanner />}

        {/* =========== ALL PREMIUM FEATURES =========== */}

        {/* This Week Summary (always shows last 7 days) */}
        <Card style={styles.weeklyCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="today" size={20} color={colors.text.secondary} />
            <Text style={styles.sectionTitle}>{t("progress.this_week") || "This Week"}</Text>
          </View>

          <PremiumChartOverlay
            showOverlay={!isPremium}
            message={t("analytics.unlock_weekly_progress") || "See your weekly progress"}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={brandColors.primary} />
              </View>
            ) : (
              <WeeklyProgressView
                checkIns={thisWeekData.length > 0 ? thisWeekData : heatMapData}
                targetDays={dashboardData?.target_days}
                goalCreatedAt={dashboardData?.goal_created_at}
              />
            )}
          </PremiumChartOverlay>
        </Card>

        {/* Activity Heat Map (uses time range) */}
        <Card style={styles.heatMapCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar" size={20} color={colors.text.secondary} />
            <Text style={styles.sectionTitle}>{t("progress.title") || "Activity"}</Text>
          </View>
          <Text style={styles.sectionSubtitle}>{t("progress.last_days", { days: timeRange })}</Text>

          <PremiumChartOverlay
            showOverlay={!isPremium}
            message={t("analytics.unlock_heatmap") || "Visualize your activity patterns"}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={brandColors.primary} />
              </View>
            ) : (
              <HeatMapCalendar
                checkIns={heatMapData}
                daysToShow={timeRange}
                targetDays={dashboardData?.target_days}
                goalCreatedAt={dashboardData?.goal_created_at}
              />
            )}
          </PremiumChartOverlay>
        </Card>

        {/* Ad Banner - Shows for free users after Activity section */}
        <AdBanner unitId="PROGRESS_BANNER" />

        {/* Summary Stats */}
        <Card style={styles.summaryCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="stats-chart" size={20} color={colors.text.secondary} />
            <Text style={styles.sectionTitle}>{t("analytics.overview") || "Overview"}</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            {t("analytics.last_days", { days: timeRange })}
          </Text>

          <PremiumChartOverlay
            showOverlay={!isPremium}
            message={t("analytics.unlock_overview") || "Get detailed insights on your progress"}
          >
            {isLoading ? (
              <View style={styles.chartLoadingContainer}>
                <ActivityIndicator size="small" color={brandColors.primary} />
              </View>
            ) : (
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {isPremium && dashboardData ? dashboardData.completion_rate.toFixed(1) : "78.5"}
                    %
                  </Text>
                  <Text style={styles.statLabel}>
                    {t("analytics.completion_rate") || "Completion Rate"}
                  </Text>
                </View>

                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {isPremium && dashboardData ? dashboardData.current_streak : "12"}
                  </Text>
                  <Text style={styles.statLabel}>
                    {t("analytics.current_streak") || "Current Streak"}
                  </Text>
                </View>

                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {isPremium && dashboardData ? dashboardData.longest_streak : "28"}
                  </Text>
                  <Text style={styles.statLabel}>
                    {t("analytics.longest_streak") || "Longest Streak"}
                  </Text>
                </View>

                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {isPremium && dashboardData ? dashboardData.completed_check_ins : "156"}
                  </Text>
                  <Text style={styles.statLabel}>{t("analytics.completed") || "Completed"}</Text>
                </View>
              </View>
            )}
          </PremiumChartOverlay>
        </Card>

        {/* 1. Weekly Consistency Bar Chart */}
        <Card style={styles.chartCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="bar-chart" size={20} color={colors.text.secondary} />
            <Text style={styles.sectionTitle}>
              {t("analytics.weekly_consistency") || "Weekly Consistency"}
            </Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            {t("analytics.weekly_consistency_desc") || "Your best performing days"}
          </Text>

          <PremiumChartOverlay
            showOverlay={!isPremium}
            message={t("analytics.unlock_weekly") || "See which days you perform best"}
          >
            {isLoading ? (
              <View style={styles.chartLoadingContainer}>
                <ActivityIndicator size="small" color={brandColors.primary} />
              </View>
            ) : !hasWeeklyData ? (
              <View style={styles.emptyChartContainer}>
                <Ionicons name="bar-chart-outline" size={48} color={colors.text.tertiary} />
                <Text style={styles.emptyChartText}>
                  {t("analytics.no_weekly_data") ||
                    "Complete check-ins to see your weekly patterns"}
                </Text>
              </View>
            ) : (
              <View style={styles.chartWrapper}>
                <BarChart
                  data={{
                    labels: weeklyData.map((d) => d.day),
                    datasets: [{ data: weeklyData.map((d) => d.percentage) }]
                  }}
                  width={screenWidth - toRN(tokens.spacing[8]) - 32}
                  height={180}
                  chartConfig={{
                    ...chartConfig,
                    barPercentage: 0.7
                  }}
                  style={styles.chart}
                  fromZero
                  showValuesOnTopOfBars
                  withInnerLines={false}
                  yAxisLabel=""
                  yAxisSuffix="%"
                />
              </View>
            )}
          </PremiumChartOverlay>
        </Card>

        {/* 2. Streak History Line Chart */}
        <Card style={styles.chartCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trending-up" size={20} color={colors.text.secondary} />
            <Text style={styles.sectionTitle}>
              {t("analytics.streak_history") || "Streak History"}
            </Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            {t("analytics.streak_history_desc") || "Your streak growth over time"}
          </Text>

          <PremiumChartOverlay
            showOverlay={!isPremium}
            message={t("analytics.unlock_streak") || "Track your streak progress"}
          >
            {isLoading ? (
              <View style={styles.chartLoadingContainer}>
                <ActivityIndicator size="small" color={brandColors.primary} />
              </View>
            ) : !hasStreakData ? (
              <View style={styles.emptyChartContainer}>
                <Ionicons name="trending-up-outline" size={48} color={colors.text.tertiary} />
                <Text style={styles.emptyChartText}>
                  {t("analytics.no_streak_data") || "Start a streak to see your progress"}
                </Text>
              </View>
            ) : (
              <View style={styles.chartWrapper}>
                <LineChart
                  data={{
                    // Show every other label to avoid cramping with 12+ weeks
                    labels: streakData.map((d, i) => (i % 2 === 0 ? d.week : "")),
                    datasets: [{ data: streakData.map((d) => d.streak || 0) }]
                  }}
                  width={screenWidth - toRN(tokens.spacing[8]) - 32}
                  height={180}
                  chartConfig={{
                    ...chartConfig,
                    color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`
                  }}
                  style={styles.chart}
                  bezier
                  withInnerLines={false}
                  withDots
                />
              </View>
            )}
          </PremiumChartOverlay>
        </Card>

        {/* 3. Mood Trend Chart */}
        <Card style={styles.chartCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="happy" size={20} color={colors.text.secondary} />
            <Text style={styles.sectionTitle}>{t("analytics.mood_trend") || "Mood Trend"}</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            {t("analytics.mood_trend_desc") || "How you feel about this goal"}
          </Text>

          <PremiumChartOverlay
            showOverlay={!isPremium}
            message={t("analytics.unlock_mood") || "Track your mood patterns"}
          >
            {isLoading ? (
              <View style={styles.chartLoadingContainer}>
                <ActivityIndicator size="small" color={brandColors.primary} />
              </View>
            ) : !hasMoodData ? (
              <View style={styles.emptyChartContainer}>
                <Ionicons name="happy-outline" size={48} color={colors.text.tertiary} />
                <Text style={styles.emptyChartText}>
                  {t("analytics.no_mood_data") || "No mood data yet. Add mood to your check-ins!"}
                </Text>
              </View>
            ) : moodData.length < 2 ? (
              // Need at least 2 data points to show a trend line
              <View style={styles.singleMoodContainer}>
                <MoodIcons
                  mood={(moodData[0]?.mood as "tough" | "good" | "amazing") || "good"}
                  size={56}
                />
                <Text style={styles.singleMoodText}>{moodData[0]?.label || ""}</Text>
                <Text style={[styles.emptyChartText, { marginTop: 8 }]}>
                  {t("analytics.need_more_mood_data") ||
                    "Check in more days to see your mood trend!"}
                </Text>
              </View>
            ) : (
              <View style={styles.moodChartWrapper}>
                {/* Mood Y-axis legend (left side) - using same icons as CheckInModal */}
                <View style={styles.moodYAxis}>
                  <View style={styles.moodYAxisItem}>
                    <MoodIcons mood="amazing" size={24} />
                  </View>
                  <View style={styles.moodYAxisItem}>
                    <MoodIcons mood="good" size={24} />
                  </View>
                  <View style={styles.moodYAxisItem}>
                    <MoodIcons mood="tough" size={24} />
                  </View>
                </View>
                <View style={styles.moodChartContainer}>
                  <LineChart
                    data={{
                      labels: moodData.map((d: { label: string; mood_score: number }, i: number) =>
                        i % Math.ceil(moodData.length / 6) === 0 ? d.label : ""
                      ),
                      datasets: [
                        {
                          data: moodData.map((d: { mood_score: number }) => d.mood_score)
                        }
                      ]
                    }}
                    width={screenWidth - toRN(tokens.spacing[8]) - 72}
                    height={160}
                    chartConfig={{
                      ...chartConfig,
                      color: (opacity = 1) => `rgba(236, 72, 153, ${opacity})`,
                      propsForDots: {
                        r: "5",
                        strokeWidth: "2",
                        stroke: "#EC4899"
                      }
                    }}
                    style={styles.chart}
                    bezier
                    withInnerLines={false}
                    withDots
                    fromZero
                    segments={3}
                    formatYLabel={() => ""}
                  />
                </View>
              </View>
            )}
          </PremiumChartOverlay>
        </Card>

        {/* 4. Monthly Trend Line Chart */}
        <Card style={styles.chartCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="analytics" size={20} color={colors.text.secondary} />
            <Text style={styles.sectionTitle}>
              {t("analytics.monthly_trend") || "Monthly Trend"}
            </Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            {t("analytics.monthly_trend_desc") || "Your consistency over months"}
          </Text>

          <PremiumChartOverlay
            showOverlay={!isPremium}
            message={t("analytics.unlock_monthly") || "See your monthly progress"}
          >
            {isLoading ? (
              <View style={styles.chartLoadingContainer}>
                <ActivityIndicator size="small" color={brandColors.primary} />
              </View>
            ) : !hasMonthlyData ? (
              <View style={styles.emptyChartContainer}>
                <Ionicons name="analytics-outline" size={48} color={colors.text.tertiary} />
                <Text style={styles.emptyChartText}>
                  {t("analytics.no_monthly_data") || "Check in regularly to see monthly trends"}
                </Text>
              </View>
            ) : (
              <View style={styles.chartWrapper}>
                <LineChart
                  data={{
                    labels: monthlyData.map((d) => d.month),
                    datasets: [{ data: monthlyData.map((d) => d.percentage) }]
                  }}
                  width={screenWidth - toRN(tokens.spacing[8]) - 32}
                  height={180}
                  chartConfig={{
                    ...chartConfig,
                    color: (opacity = 1) => `rgba(245, 158, 11, ${opacity})`
                  }}
                  style={styles.chart}
                  bezier
                  withInnerLines={false}
                  withDots
                  yAxisSuffix="%"
                />
              </View>
            )}
          </PremiumChartOverlay>
        </Card>

        {/* 5. Skip Reasons Pie Chart */}
        <Card style={styles.chartCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="pie-chart" size={20} color={colors.text.secondary} />
            <Text style={styles.sectionTitle}>{t("analytics.skip_reasons") || "Skip Reasons"}</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            {t("analytics.skip_reasons_desc") || "Why you miss check-ins"}
          </Text>

          <PremiumChartOverlay
            showOverlay={!isPremium}
            message={t("analytics.unlock_skip") || "Identify patterns in missed days"}
          >
            {isLoading ? (
              <View style={styles.chartLoadingContainer}>
                <ActivityIndicator size="small" color={brandColors.primary} />
              </View>
            ) : !hasSkipData ? (
              <View style={styles.emptyChartContainer}>
                <Ionicons
                  name="ellipsis-horizontal-outline"
                  size={48}
                  color={colors.text.tertiary}
                />
                <Text style={styles.emptyChartText}>
                  {t("analytics.no_skips") || "No skipped check-ins! 🎉"}
                </Text>
              </View>
            ) : (
              <View style={styles.pieChartContainer}>
                <PieChart
                  data={skipData.map((d) => ({
                    name: d.label,
                    population: d.count,
                    color: d.color,
                    legendFontColor: colors.text.secondary,
                    legendFontSize: 12
                  }))}
                  width={screenWidth - toRN(tokens.spacing[8]) - 32}
                  height={180}
                  chartConfig={chartConfig}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft="15"
                  absolute
                />
              </View>
            )}
          </PremiumChartOverlay>
        </Card>

        {/* Bottom spacing */}
        <View style={{ height: toRN(tokens.spacing[4]) }} />
      </ScrollView>
    </View>
  );
}

/**
 * Premium Upgrade Banner Component
 * Shows once at the top for free users
 */
function PremiumUpgradeBanner() {
  const styles = useStyles(makeBannerStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const { openModal } = useSubscriptionStore();

  return (
    <TouchableOpacity
      style={[styles.bannerContainer, { backgroundColor: `${brandColors.primary}15` }]}
      onPress={openModal}
      activeOpacity={0.8}
    >
      <Ionicons name="diamond" size={20} color={brandColors.primary} />
      <View style={styles.bannerTextContainer}>
        <Text style={[styles.bannerTitle, { color: colors.text.primary }]}>
          {t("analytics.unlock_premium") || "Unlock Premium Analytics"}
        </Text>
        <Text style={[styles.bannerSubtitle, { color: colors.text.secondary }]}>
          {t("analytics.unlock_premium_desc") || "Get detailed insights and charts"}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={brandColors.primary} />
    </TouchableOpacity>
  );
}

const makeBannerStyles = (tokens: any, colors: any, brand: any) => ({
  bannerContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    padding: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.xl),
    gap: toRN(tokens.spacing[3])
  },
  bannerTextContainer: {
    flex: 1
  },
  bannerTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold
  },
  bannerSubtitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    marginTop: toRN(tokens.spacing[0.5])
  }
});

/**
 * Progress Ring Component for Goal Comparison
 */
interface ProgressRingProps {
  title: string;
  percentage: number;
  color: string;
  size?: number;
}

function ProgressRing({ title, percentage, color, size = 80 }: ProgressRingProps) {
  const { colors } = useTheme();
  const styles = useStyles(makeProgressRingStyles);

  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (percentage / 100) * circumference;

  return (
    <View style={styles.ringContainer}>
      <View style={{ width: size, height: size, position: "relative" }}>
        <Svg width={size} height={size}>
          <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
            {/* Background circle */}
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={`${color}20`}
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {/* Progress circle */}
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={color}
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={`${progress} ${circumference - progress}`}
              strokeLinecap="round"
            />
          </G>
        </Svg>
        {/* Percentage text - centered using absolute positioning */}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: "center",
            alignItems: "center"
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontFamily: fontFamily.bold,
              color: colors.text.primary
            }}
          >
            {percentage}%
          </Text>
        </View>
      </View>
      <Text style={styles.ringTitle} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

const makeProgressRingStyles = (tokens: any, colors: any) => ({
  ringContainer: {
    alignItems: "center" as const,
    width: "30%" as any // 3 per row with some spacing
  },
  ringTitle: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
    marginTop: toRN(tokens.spacing[1]),
    textAlign: "center" as const
  }
});

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  header: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingTop: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[2]),
    marginBottom: toRN(tokens.spacing[4]),
    borderBottomWidth: 2,
    borderBottomColor: colors.border.subtle
  },
  headerTitle: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.bold,
    color: colors.text.primary
  },
  // Controls section label
  controlsLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
    paddingHorizontal: toRN(tokens.spacing[4])
    // marginTop: toRN(tokens.spacing[3])
  },
  // Goal selector and time range row
  controlsRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[2]),
    marginTop: toRN(tokens.spacing[1])
  },
  goalSelector: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: colors.bg.secondary,
    borderRadius: toRN(tokens.borderRadius.lg),
    paddingHorizontal: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[2]),
    gap: toRN(tokens.spacing[2])
  },
  goalIcon: {
    marginRight: toRN(tokens.spacing[1])
  },
  goalSelectorText: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  timeRangeToggle: {
    flexDirection: "row" as const,
    backgroundColor: colors.bg.secondary,
    borderRadius: toRN(tokens.borderRadius.lg),
    padding: toRN(tokens.spacing[1])
  },
  timeRangeButton: {
    paddingHorizontal: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[1.5]),
    borderRadius: toRN(tokens.borderRadius.md)
  },
  timeRangeButtonActive: {
    backgroundColor: brand.primary
  },
  timeRangeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: colors.text.secondary
  },
  timeRangeTextActive: {
    color: "#FFFFFF"
  },
  // Goal picker dropdown
  goalPickerDropdown: {
    marginHorizontal: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[2]),
    backgroundColor: colors.bg.surface,
    borderRadius: toRN(tokens.borderRadius.lg),
    borderWidth: 1,
    borderColor: colors.border.subtle,
    overflow: "hidden" as const
  },
  goalPickerItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[3]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle
  },
  goalPickerItemActive: {
    backgroundColor: `${brand.primary}10`
  },
  goalPickerText: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.primary
  },
  goalPickerTextActive: {
    color: brand.primary,
    fontFamily: fontFamily.semiBold
  },
  // Empty state (no active goals)
  emptyState: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    padding: toRN(tokens.spacing[8])
  },
  emptyStateTitle: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    marginTop: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[2])
  },
  emptyStateText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    padding: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[8]),
    gap: toRN(tokens.spacing[4])
  },
  weeklyCard: {
    padding: toRN(tokens.spacing[4])
  },
  heatMapCard: {
    padding: toRN(tokens.spacing[4])
  },
  chartCard: {
    padding: toRN(tokens.spacing[4])
  },
  summaryCard: {
    padding: toRN(tokens.spacing[4])
  },
  sectionHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    marginBottom: toRN(tokens.spacing[1])
  },
  cacheHintBanner: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[1]),
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    backgroundColor: colors.bg.muted,
    marginBottom: toRN(tokens.spacing[2])
  },
  cacheHintBannerText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },
  statsGrid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    justifyContent: "space-between" as const,
    gap: toRN(tokens.spacing[4])
  },
  statItem: {
    width: "45%" as any,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[2]),
    backgroundColor: colors.bg.secondary,
    borderRadius: toRN(tokens.borderRadius.lg)
  },
  statValue: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.bold,
    color: brand.primary
  },
  statLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
    marginTop: toRN(tokens.spacing[1]),
    textAlign: "center" as const
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: colors.text.primary
  },
  sectionSubtitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginBottom: toRN(tokens.spacing[4])
  },
  loadingContainer: {
    height: 120,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  chartLoadingContainer: {
    height: 180,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  chartWrapper: {
    alignItems: "center" as const,
    marginHorizontal: -toRN(tokens.spacing[2])
  },
  // Mood chart wrapper with horizontal layout for emoji Y-axis
  moodChartWrapper: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginLeft: toRN(tokens.spacing[1]),
    marginRight: -toRN(tokens.spacing[2])
  },
  chart: {
    borderRadius: toRN(tokens.borderRadius.lg)
  },
  progressRingsContainer: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    justifyContent: "space-evenly" as const,
    alignItems: "flex-start" as const,
    paddingVertical: toRN(tokens.spacing[3]),
    rowGap: toRN(tokens.spacing[4])
  },
  pieChartContainer: {
    alignItems: "center" as const
  },
  emptyChartContainer: {
    height: 180,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2])
  },
  emptyChartText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
    textAlign: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[4])
  },
  // Single mood data point display (need 2+ for trend)
  singleMoodContainer: {
    height: 180,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2])
  },
  singleMoodText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.primary
  },
  // Mood chart with Y-axis emojis
  moodChartContainer: {
    flex: 1
  },
  moodYAxis: {
    width: 32,
    height: 140,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingTop: toRN(tokens.spacing[2]),
    paddingBottom: toRN(tokens.spacing[2])
  },
  moodYAxisItem: {
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  moodLegendText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary
  }
});
