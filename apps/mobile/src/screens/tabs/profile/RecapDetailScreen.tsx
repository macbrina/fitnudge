import React from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { NotFoundState } from "@/components/ui/NotFoundState";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import CheckmarkCircle from "@/components/ui/CheckmarkCircle";
import { useTranslation } from "@/lib/i18n";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { Card } from "@/components/ui/Card";
import { BackButton } from "@/components/ui/BackButton";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import Button from "@/components/ui/Button";
import Markdown from "react-native-markdown-display";
import { formatWeekRange } from "@/utils/helper";
import { useWeeklyRecapDetail } from "@/hooks/api/useWeeklyRecaps";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { UserAvatar } from "@/components/avatars";
import Svg, { Circle } from "react-native-svg";
import type {
  GoalBreakdown,
  CompletionRateTrend,
  AchievementUnlocked
} from "@/services/api/recaps";
import { RecapDetailSkeleton } from "@/components/skeletons";
import { getRarityColor } from "@/hooks/api/useAchievements";

export default function RecapDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const recapId = params.id || "";

  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { hasFeature, openModal: openSubscriptionModal } = useSubscriptionStore();

  // Check if user has premium access to weekly recaps
  const hasWeeklyRecapFeature = hasFeature("weekly_recap");

  // Only fetch if user has premium access (enabled=hasWeeklyRecapFeature)
  const {
    data: recap,
    isLoading,
    refetch,
    isRefetching
  } = useWeeklyRecapDetail(recapId, hasWeeklyRecapFeature);

  const formatRecapWeekRange = (startDate: string, endDate: string) => {
    return formatWeekRange(startDate, endDate, "long");
  };

  const getCompletionRateColor = (rate: number) => {
    if (rate >= 80) return colors.feedback.success;
    if (rate >= 50) return colors.feedback.warning;
    return colors.feedback.error;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "excellent":
        return colors.feedback.success;
      case "good":
        return colors.feedback.warning;
      default:
        return colors.feedback.error;
    }
  };

  // Premium gate - show upgrade prompt for free users
  if (!hasWeeklyRecapFeature) {
    return (
      <View style={styles.container}>
        <BackButton
          title={t("recaps.detail_title") || "Weekly Recap"}
          onPress={() => router.back()}
        />
        <View style={styles.premiumGate}>
          <View style={styles.premiumIconContainer}>
            <Ionicons name="diamond" size={48} color={brandColors.primary} />
          </View>
          <Text style={styles.premiumTitle}>{t("recaps.premium_title") || "Premium Feature"}</Text>
          <Text style={styles.premiumDescription}>
            {t("recaps.premium_description") ||
              "Weekly recaps require a premium subscription. Upgrade to get AI-powered insights on your progress."}
          </Text>
          <Button
            title={t("common.upgrade") || "Upgrade to Premium"}
            onPress={openSubscriptionModal}
          />
        </View>
      </View>
    );
  }

  if (isLoading) {
    return <RecapDetailSkeleton />;
  }

  if (!recap) {
    return (
      <NotFoundState
        title={t("recaps.not_found_title") || "Recap not found"}
        description={t("recaps.not_found_description") || "This weekly recap could not be found."}
        icon="document-text-outline"
      />
    );
  }

  const stats = recap.stats || {};
  const weekOverWeekChange = stats.week_over_week_change || 0;
  const completionRate = stats.completion_rate || 0;
  const completionColor = getCompletionRateColor(completionRate);

  const CompletionRing = ({
    size,
    strokeWidth,
    percent,
    color
  }: {
    size: number;
    strokeWidth: number;
    percent: number;
    color: string;
  }) => {
    const clamped = Math.max(0, Math.min(100, percent));
    const r = (size - strokeWidth) / 2;
    const cx = size / 2;
    const cy = size / 2;
    const circumference = 2 * Math.PI * r;
    const dashOffset = circumference * (1 - clamped / 100);

    return (
      <View style={[styles.ringWrap, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={colors.border.subtle}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            rotation={-90}
            origin={`${cx}, ${cy}`}
          />
        </Svg>
        <View style={styles.ringCenter}>
          <Text style={[styles.ringValue, { color }]}>{Math.round(clamped)}%</Text>
          <Text style={styles.ringLabel}>{t("recaps.completion") || "Completion"}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <BackButton
        title={t("recaps.detail_title") || "Weekly Recap"}
        onPress={() => router.back()}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={brandColors.primary}
          />
        }
      >
        {/* Hero Summary */}
        <Card shadow="lg" style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTitleWrap}>
              <Text style={styles.heroWeekRange}>
                {formatRecapWeekRange(recap.week_start, recap.week_end)}
              </Text>
              <View style={styles.heroMetaRow}>
                <View style={styles.heroMetaPill}>
                  <Ionicons name="flag" size={14} color={colors.text.tertiary} />
                  <Text style={styles.heroMetaText}>
                    {t("recaps.goals_hit_count", {
                      hit: recap.goals_hit || 0,
                      total: recap.goals_total || 0
                    })}
                  </Text>
                </View>
                <View style={styles.heroMetaPill}>
                  <Ionicons name="calendar" size={14} color={colors.text.tertiary} />
                  <Text style={styles.heroMetaText}>
                    {t("recaps.active_days_count", { count: stats.days_with_checkins || 0 })}
                  </Text>
                </View>
              </View>
            </View>

            {weekOverWeekChange !== 0 && (
              <View
                style={[
                  styles.wowBadge,
                  weekOverWeekChange > 0 ? styles.wowBadgePositive : styles.wowBadgeNegative
                ]}
              >
                <Ionicons
                  name={weekOverWeekChange > 0 ? "trending-up" : "trending-down"}
                  size={14}
                  color={weekOverWeekChange > 0 ? colors.feedback.success : colors.feedback.error}
                />
                <Text
                  style={[
                    styles.wowText,
                    weekOverWeekChange > 0 ? styles.wowTextPositive : styles.wowTextNegative
                  ]}
                >
                  {weekOverWeekChange > 0 ? "+" : ""}
                  {weekOverWeekChange}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.heroBody}>
            <View style={styles.heroRingRow}>
              <CompletionRing
                size={104}
                strokeWidth={10}
                percent={completionRate}
                color={completionColor}
              />
            </View>

            <View style={styles.heroTilesRow}>
              <View style={styles.heroTile}>
                <View
                  style={[styles.heroTileIcon, { backgroundColor: `${brandColors.primary}15` }]}
                >
                  <CheckmarkCircle size={18} />
                </View>
                <View style={styles.heroTileText}>
                  <Text style={styles.heroTileValue}>{stats.total_check_ins || 0}</Text>
                  <Text style={styles.heroTileLabel}>
                    {t("recaps.total_check_ins") || "Check-ins"}
                  </Text>
                </View>
              </View>

              <View style={styles.heroTile}>
                <View
                  style={[styles.heroTileIcon, { backgroundColor: `${colors.feedback.error}15` }]}
                >
                  <Ionicons name="flame" size={18} color={colors.feedback.error} />
                </View>
                <View style={styles.heroTileText}>
                  <Text style={styles.heroTileValue}>{stats.current_streak || 0}</Text>
                  <Text style={styles.heroTileLabel}>{t("recaps.current_streak") || "Streak"}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Additional Stats Row */}
          <View style={styles.additionalStats}>
            {stats.strongest_day && (
              <View style={styles.additionalStatItem}>
                <Ionicons name="star" size={16} color={colors.feedback.warning} />
                <Text style={styles.additionalStatText}>
                  {t("recaps.best_day", { day: stats.strongest_day })}
                </Text>
              </View>
            )}
          </View>
        </Card>

        {/* AI Summary */}
        {recap.recap_text && (
          <Card style={styles.summaryCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="sparkles" size={20} color={colors.text.primary} />
              <Text style={styles.cardTitle}>{t("recaps.ai_summary")}</Text>
            </View>
            <Markdown
              style={{
                body: styles.summaryText,
                paragraph: { marginBottom: toRN(tokens.spacing[3]) },
                heading1: {
                  ...styles.summaryText,
                  fontFamily: fontFamily.bold,
                  fontSize: toRN(tokens.typography.fontSize.lg),
                  marginBottom: toRN(tokens.spacing[2])
                },
                heading2: {
                  ...styles.summaryText,
                  fontFamily: fontFamily.semiBold,
                  fontSize: toRN(tokens.typography.fontSize.base),
                  marginBottom: toRN(tokens.spacing[2])
                },
                heading3: {
                  ...styles.summaryText,
                  fontFamily: fontFamily.semiBold,
                  marginBottom: toRN(tokens.spacing[2])
                },
                strong: { fontFamily: fontFamily.semiBold, color: colors.text.primary },
                em: { fontStyle: "italic" as const },
                bullet_list: { marginBottom: toRN(tokens.spacing[3]) },
                ordered_list: { marginBottom: toRN(tokens.spacing[3]) },
                list_item: { marginBottom: toRN(tokens.spacing[1.5]) },
                bullet_list_icon: {
                  color: brandColors.primary,
                  marginRight: toRN(tokens.spacing[2])
                },
                ordered_list_icon: {
                  color: brandColors.primary,
                  fontFamily: fontFamily.semiBold,
                  marginRight: toRN(tokens.spacing[2])
                }
              }}
            >
              {recap.recap_text}
            </Markdown>
          </Card>
        )}

        {/* AI Insights Grid - Win, Insight, Focus, Motivational */}
        {(recap.win || recap.insight || recap.focus_next_week || recap.motivational_close) && (
          <View style={styles.insightsGrid}>
            {/* Your Big Win */}
            {recap.win && (
              <Card style={styles.insightCard}>
                <View style={styles.insightHeader}>
                  <Ionicons name="trophy" size={16} color={colors.feedback.warning} />
                  <Text style={styles.insightLabel}>{t("recaps.win")}</Text>
                </View>
                <Text style={styles.insightText}>{recap.win}</Text>
              </Card>
            )}

            {/* Key Insight */}
            {recap.insight && (
              <Card style={styles.insightCard}>
                <View style={styles.insightHeader}>
                  <Ionicons name="bulb" size={16} color={brandColors.primary} />
                  <Text style={styles.insightLabel}>{t("recaps.insight")}</Text>
                </View>
                <Text style={styles.insightText}>{recap.insight}</Text>
              </Card>
            )}

            {/* Focus for Next Week */}
            {recap.focus_next_week && (
              <Card style={styles.insightCard}>
                <View style={styles.insightHeader}>
                  <Ionicons name="arrow-forward-circle" size={16} color={colors.feedback.success} />
                  <Text style={styles.insightLabel}>{t("recaps.focus_next_week")}</Text>
                </View>
                <Text style={styles.insightText}>{recap.focus_next_week}</Text>
              </Card>
            )}

            {/* Motivational Close */}
            {recap.motivational_close && (
              <Card style={styles.insightCard}>
                <View style={styles.insightHeader}>
                  <Ionicons name="heart" size={16} color={colors.feedback.error} />
                  <Text style={styles.insightLabel}>{t("recaps.motivational_close")}</Text>
                </View>
                <Text style={styles.insightText}>{recap.motivational_close}</Text>
              </Card>
            )}
          </View>
        )}

        {/* Goal Breakdown */}
        {recap.goal_breakdown && recap.goal_breakdown.length > 0 && (
          <Card style={styles.breakdownCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="flag" size={20} color={colors.text.primary} />
              <Text style={styles.cardTitle}>{t("recaps.goal_breakdown") || "Goal Breakdown"}</Text>
            </View>
            {recap.goal_breakdown.map((goal: GoalBreakdown, index: number) => (
              <View
                key={goal.goal_id || index}
                style={[
                  styles.goalItem,
                  index < recap.goal_breakdown!.length - 1 && styles.goalItemBorder
                ]}
              >
                <View style={styles.goalHeader}>
                  <View
                    style={[styles.statusDot, { backgroundColor: getStatusColor(goal.status) }]}
                  />
                  <Text
                    style={[styles.goalTitle, goal.is_archived && styles.archivedGoalTitle]}
                    numberOfLines={1}
                  >
                    {goal.title}
                    {goal.is_archived && ` ${t("recaps.archived_label")}`}
                  </Text>
                  <Text style={[styles.goalRate, { color: getStatusColor(goal.status) }]}>
                    {goal.completion_rate}%
                  </Text>
                </View>
                <View style={styles.goalDetails}>
                  <Text style={styles.goalDetailText}>
                    {t("recaps.completed_count", {
                      completed: goal.completed,
                      total: goal.total
                    })}
                  </Text>
                  <Text style={styles.goalDetailText}>
                    {goal.days_active} {t("recaps.active_days")}
                  </Text>
                </View>
                {/* Progress Bar */}
                <View style={styles.progressBarContainer}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        width: `${goal.completion_rate}%`,
                        backgroundColor: getStatusColor(goal.status)
                      }
                    ]}
                  />
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* 4-Week Trend */}
        {recap.completion_rate_trend && recap.completion_rate_trend.length > 0 && (
          <Card style={styles.trendCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="analytics" size={20} color={colors.text.primary} />
              <Text style={styles.cardTitle}>{t("recaps.trend") || "4-Week Trend"}</Text>
            </View>
            <View style={styles.trendContainer}>
              {recap.completion_rate_trend.map((week: CompletionRateTrend, index: number) => {
                const bgColor = week.is_current ? brandColors.primary : `${brandColors.primary}60`;
                const barHeight = `${Math.max(week.completion_rate, 10)}%`;
                return (
                  <View key={week.week_start || index} style={styles.trendItem}>
                    <View
                      style={[styles.trendBar, { height: barHeight, backgroundColor: bgColor }]}
                    />
                    <Text style={[styles.trendLabel, week.is_current && styles.trendLabelActive]}>
                      {week.week_label}
                    </Text>
                    <Text style={styles.trendValue}>{Math.round(week.completion_rate)}%</Text>
                  </View>
                );
              })}
            </View>
          </Card>
        )}

        {/* Achievements Unlocked */}
        {recap.achievements_unlocked && recap.achievements_unlocked.length > 0 && (
          <Card style={styles.achievementsCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="ribbon" size={20} color={colors.text.primary} />
              <Text style={styles.cardTitle}>
                {t("recaps.achievements") || "Achievements Unlocked"}
              </Text>
            </View>
            {recap.achievements_unlocked.map((achievement: AchievementUnlocked, index: number) => {
              const rarityColor = getRarityColor(achievement.rarity || "common", {
                colors,
                brandColors
              });
              const hasBorder = index < recap.achievements_unlocked!.length - 1;
              return (
                <View
                  key={achievement.badge_key || index}
                  style={[styles.achievementItem, hasBorder && styles.achievementItemBorder]}
                >
                  <View style={[styles.achievementIcon, { backgroundColor: `${rarityColor}15` }]}>
                    <Ionicons name="medal" size={20} color={rarityColor} />
                  </View>
                  <View style={styles.achievementDetails}>
                    <Text style={styles.achievementName}>{achievement.badge_name}</Text>
                    {achievement.description && (
                      <Text style={styles.achievementDescription}>{achievement.description}</Text>
                    )}
                  </View>
                  <View style={[styles.rarityBadge, { backgroundColor: `${rarityColor}15` }]}>
                    <Text style={[styles.rarityText, { color: rarityColor }]}>
                      {achievement.rarity || "common"}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Card>
        )}

        {/* Partners Context - supports multiple partners */}
        {recap.partner_context && recap.partner_context.length > 0 && (
          <Card style={styles.partnerCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="people" size={20} color={colors.text.primary} />
              <Text style={styles.cardTitle}>
                {recap.partner_context.length === 1
                  ? t("recaps.partner") || "Accountability Partner"
                  : t("recaps.partners") || "Accountability Partners"}
              </Text>
            </View>
            {recap.partner_context.map((partner: any, index: number) => (
              <View
                key={partner.partner_id || index}
                style={[
                  styles.partnerContent,
                  index < (recap.partner_context?.length ?? 0) - 1 && styles.partnerItemBorder
                ]}
              >
                <UserAvatar
                  profilePictureUrl={
                    partner?.profile_picture_url ?? partner?.profilePictureUrl ?? undefined
                  }
                  name={partner?.partner_name}
                  size={44}
                  placeholderColor={brandColors.primary}
                />
                <View style={styles.partnerDetails}>
                  <Text style={styles.partnerName}>{partner.partner_name}</Text>
                  <View style={styles.partnerStreak}>
                    <Ionicons name="flame" size={14} color={colors.feedback.error} />
                    <Text style={styles.partnerStreakText}>
                      {t("recaps.day_streak", { count: partner.partner_streak })}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Spacer */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    padding: toRN(tokens.spacing[4])
  },
  // Hero
  heroCard: {
    marginBottom: toRN(tokens.spacing[4]),
    padding: toRN(tokens.spacing[5]),
    borderRadius: toRN(tokens.borderRadius["2xl"])
  },
  heroTopRow: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    justifyContent: "space-between" as const,
    gap: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[4])
  },
  heroTitleWrap: {
    flex: 1
  },
  heroWeekRange: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[1])
  },
  heroMetaRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    flexWrap: "wrap" as const
  },
  heroMetaText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary
  },
  heroMetaPill: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1.5]),
    paddingVertical: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[2]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: colors.bg.muted,
    borderWidth: 1,
    borderColor: colors.border.subtle
  },
  wowBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1.5]),
    paddingVertical: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[2]),
    borderRadius: toRN(tokens.borderRadius.full)
  },
  wowBadgePositive: {
    backgroundColor: `${colors.feedback.success}15`
  },
  wowBadgeNegative: {
    backgroundColor: `${colors.feedback.error}15`
  },
  wowText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold
  },
  wowTextPositive: {
    color: colors.feedback.success
  },
  wowTextNegative: {
    color: colors.feedback.error
  },
  heroBody: {
    marginBottom: toRN(tokens.spacing[4])
  },
  heroRingRow: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: toRN(tokens.spacing[4])
  },
  heroTilesRow: {
    flexDirection: "row" as const,
    gap: toRN(tokens.spacing[3])
  },
  heroTile: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.xl),
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle
  },
  heroTileIcon: {
    width: toRN(tokens.spacing[10]),
    height: toRN(tokens.spacing[10]),
    borderRadius: toRN(tokens.borderRadius.full),
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  heroTileText: {
    flex: 1
  },
  heroTileValue: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: colors.text.primary
  },
  heroTileLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[0.5])
  },
  ringWrap: {
    position: "relative" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  ringCenter: {
    position: "absolute" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[2])
  },
  ringValue: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold
  },
  ringLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[0.5])
  },
  // (removed) old side-by-side hero stat rows in favor of hero tiles
  // Week Header
  weekHeader: {
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[4]),
    gap: toRN(tokens.spacing[2])
  },
  weekRange: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  changeBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1.5]),
    paddingVertical: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[2]),
    borderRadius: toRN(tokens.borderRadius.full)
  },
  changeText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold
  },
  // Stats Card
  statsCard: {
    marginBottom: toRN(tokens.spacing[4]),
    padding: toRN(tokens.spacing[5])
  },
  statsGrid: {
    flexDirection: "row" as const,
    justifyContent: "space-around" as const
  },
  statItem: {
    alignItems: "center" as const
  },
  statIcon: {
    width: toRN(tokens.spacing[12]),
    height: toRN(tokens.spacing[12]),
    borderRadius: toRN(tokens.borderRadius.full),
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[2])
  },
  statValue: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.bold,
    color: colors.text.primary
  },
  statLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[1])
  },
  additionalStats: {
    flexDirection: "row" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[4]),
    marginTop: toRN(tokens.spacing[3]),
    paddingTop: toRN(tokens.spacing[3]),
    borderTopWidth: 1,
    borderColor: colors.border.subtle
  },
  additionalStatItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1])
  },
  additionalStatText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary
  },
  goalsHitRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[2]),
    marginTop: toRN(tokens.spacing[3]),
    paddingTop: toRN(tokens.spacing[3]),
    borderTopWidth: 1,
    borderColor: colors.border.subtle
  },
  goalsHitText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  // Cards
  summaryCard: {
    marginBottom: toRN(tokens.spacing[4]),
    padding: toRN(tokens.spacing[5])
  },
  breakdownCard: {
    marginBottom: toRN(tokens.spacing[4]),
    padding: toRN(tokens.spacing[5])
  },
  trendCard: {
    marginBottom: toRN(tokens.spacing[4]),
    padding: toRN(tokens.spacing[5])
  },
  achievementsCard: {
    marginBottom: toRN(tokens.spacing[4]),
    padding: toRN(tokens.spacing[5])
  },
  partnerCard: {
    marginBottom: toRN(tokens.spacing[4]),
    padding: toRN(tokens.spacing[5])
  },
  cardHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    marginBottom: toRN(tokens.spacing[3])
  },
  cardTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  summaryText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.6
  },
  // AI Insights Grid
  insightsGrid: {
    marginBottom: toRN(tokens.spacing[4])
  },
  insightCard: {
    padding: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[4])
  },
  insightHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    marginBottom: toRN(tokens.spacing[1.5])
  },
  insightIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[3])
  },
  insightLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: colors.text.tertiary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5
  },
  insightText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.primary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5
  },
  // Goal Breakdown
  goalItem: {
    paddingVertical: toRN(tokens.spacing[3])
  },
  goalItemBorder: {
    borderBottomWidth: 1,
    borderColor: colors.border.subtle
  },
  goalHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    marginBottom: toRN(tokens.spacing[1])
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  goalTitle: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  archivedGoalTitle: {
    color: colors.text.tertiary,
    fontStyle: "italic" as const
  },
  goalRate: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.bold
  },
  goalDetails: {
    flexDirection: "row" as const,
    gap: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[2]),
    marginLeft: toRN(tokens.spacing[4])
  },
  goalDetailText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: colors.border.subtle,
    borderRadius: 2,
    marginLeft: toRN(tokens.spacing[4]),
    overflow: "hidden" as const
  },
  progressBar: {
    height: "100%" as const,
    borderRadius: 2
  },
  // Trend
  trendContainer: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "flex-end" as const,
    height: 120,
    paddingTop: toRN(tokens.spacing[2])
  },
  trendItem: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "flex-end" as const,
    height: "100%" as const
  },
  trendBar: {
    width: "60%" as const,
    borderRadius: toRN(tokens.borderRadius.sm),
    minHeight: 10
  },
  trendLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[1])
  },
  trendLabelActive: {
    fontFamily: fontFamily.semiBold,
    color: brand.primary
  },
  trendValue: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  // Achievements
  achievementItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[3]),
    gap: toRN(tokens.spacing[3])
  },
  achievementItemBorder: {
    borderBottomWidth: 1,
    borderColor: colors.border.subtle
  },
  achievementIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  achievementDetails: {
    flex: 1
  },
  achievementName: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  achievementDescription: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[0.5])
  },
  rarityBadge: {
    paddingVertical: toRN(tokens.spacing[0.5]),
    paddingHorizontal: toRN(tokens.spacing[2]),
    borderRadius: toRN(tokens.borderRadius.full)
  },
  rarityText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    textTransform: "capitalize" as const
  },
  // Partner
  partnerContent: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[2])
  },
  partnerItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    marginBottom: toRN(tokens.spacing[2])
  },
  partnerDetails: {
    flex: 1
  },
  partnerName: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  partnerStreak: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
    marginTop: toRN(tokens.spacing[0.5])
  },
  partnerStreakText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary
  },
  // Premium Gate
  premiumGate: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[8])
  },
  premiumIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: `${brand.primary}15`,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[4])
  },
  premiumTitle: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[2]),
    textAlign: "center" as const
  },
  premiumDescription: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    lineHeight: toRN(tokens.typography.fontSize.base) * 1.5,
    marginBottom: toRN(tokens.spacing[6])
  },
  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[8])
  },
  emptyTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginTop: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[2])
  },
  emptyDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    textAlign: "center" as const,
    maxWidth: 280
  },
  bottomSpacer: {
    height: toRN(tokens.spacing[8])
  }
});
