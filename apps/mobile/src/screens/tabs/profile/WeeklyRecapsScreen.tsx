import React, { useState, useCallback, useMemo } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Markdown from "react-native-markdown-display";
import { useTranslation } from "@/lib/i18n";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { MOBILE_ROUTES } from "@/lib/routes";
import { Card } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { BackButton } from "@/components/ui/BackButton";
import { WeeklyRecapsSkeleton } from "@/components/skeletons";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { formatWeekRange } from "@/utils/helper";
import { useWeeklyRecaps } from "@/hooks/api/useWeeklyRecaps";
import type { WeeklyRecap } from "@/services/api/recaps";

export default function WeeklyRecapsScreen() {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { hasFeature, openModal: openSubscriptionModal } = useSubscriptionStore();

  const [refreshing, setRefreshing] = useState(false);

  // Markdown styles for summary preview
  const markdownStyles = useMemo(
    () => ({
      body: {
        fontSize: toRN(tokens.typography.fontSize.sm),
        fontFamily: fontFamily.regular,
        color: colors.text.secondary,
        lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5
      },
      paragraph: {
        marginBottom: 0,
        marginTop: 0
      },
      strong: {
        fontFamily: fontFamily.semiBold,
        color: colors.text.primary
      },
      em: {
        fontFamily: fontFamily.regularItalic
      },
      bullet_list: {
        marginBottom: 0,
        marginTop: 0
      },
      ordered_list: {
        marginBottom: 0,
        marginTop: 0
      },
      list_item: {
        marginBottom: 0
      }
    }),
    [colors]
  );

  // Check if user has premium access to weekly recaps
  const hasWeeklyRecapFeature = hasFeature("weekly_recap");

  // Only fetch recaps if user has premium access (enabled=hasWeeklyRecapFeature)
  const { data: recapsData, isLoading, refetch } = useWeeklyRecaps(20, 0, hasWeeklyRecapFeature);
  const recaps = recapsData?.data || [];

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleRecapPress = useCallback(
    (recap: WeeklyRecap) => {
      router.push(MOBILE_ROUTES.PROFILE.RECAP_DETAIL(recap.id));
    },
    [router]
  );

  const formatRecapWeekRange = (startDate: string, endDate: string) => {
    return formatWeekRange(startDate, endDate, "short");
  };

  const getCompletionRateColor = (rate: number) => {
    if (rate >= 80) return "#22C55E";
    if (rate >= 50) return "#F59E0B";
    return "#EF4444";
  };

  const renderRecapCard = ({ item }: { item: WeeklyRecap }) => {
    const stats = item.stats || {};
    const completionRate = stats.completion_rate || 0;
    const weekOverWeekChange = stats.week_over_week_change || 0;

    return (
      <TouchableOpacity onPress={() => handleRecapPress(item)} activeOpacity={0.7}>
        <Card style={styles.recapCard}>
          <View style={styles.recapHeader}>
            <View style={styles.weekBadge}>
              <Ionicons name="calendar-outline" size={14} color={colors.text.primary} />
              <Text style={styles.weekBadgeText}>
                {formatRecapWeekRange(item.week_start, item.week_end)}
              </Text>
            </View>
            <View style={styles.headerRight}>
              {weekOverWeekChange !== 0 && (
                <View
                  style={[
                    styles.changeBadge,
                    { backgroundColor: weekOverWeekChange > 0 ? "#22C55E15" : "#EF444415" }
                  ]}
                >
                  <Ionicons
                    name={weekOverWeekChange > 0 ? "trending-up" : "trending-down"}
                    size={12}
                    color={weekOverWeekChange > 0 ? "#22C55E" : "#EF4444"}
                  />
                  <Text
                    style={[
                      styles.changeText,
                      { color: weekOverWeekChange > 0 ? "#22C55E" : "#EF4444" }
                    ]}
                  >
                    {weekOverWeekChange > 0 ? "+" : ""}
                    {weekOverWeekChange}
                  </Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
            </View>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.total_check_ins || 0}</Text>
              <Text style={styles.statLabel}>{t("recaps.check_ins") || "Check-ins"}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: getCompletionRateColor(completionRate) }]}>
                {Math.round(completionRate)}%
              </Text>
              <Text style={styles.statLabel}>{t("recaps.completion") || "Completion"}</Text>
            </View>
            <View style={styles.statItem}>
              <View style={styles.streakValue}>
                <Ionicons
                  name={stats.current_streak > 0 ? "flame" : "flame-outline"}
                  size={16}
                  color={stats.current_streak > 0 ? "#EF4444" : colors.text.tertiary}
                />
                <Text style={styles.statValue}>{stats.current_streak || 0}</Text>
              </View>
              <Text style={styles.statLabel}>{t("recaps.streak") || "Streak"}</Text>
            </View>
          </View>

          {/* Goal Breakdown Preview */}
          {item.goal_breakdown && item.goal_breakdown.length > 0 && (
            <View style={styles.goalBreakdownPreview}>
              {item.goal_breakdown.slice(0, 2).map((goal, index) => (
                <View key={goal.goal_id || index} style={styles.goalPreviewItem}>
                  <View
                    style={[
                      styles.goalStatusDot,
                      {
                        backgroundColor:
                          goal.status === "excellent"
                            ? "#22C55E"
                            : goal.status === "good"
                              ? "#F59E0B"
                              : "#EF4444"
                      }
                    ]}
                  />
                  <Text style={styles.goalPreviewTitle} numberOfLines={1}>
                    {goal.title}
                  </Text>
                  <Text style={styles.goalPreviewRate}>{goal.completion_rate}%</Text>
                </View>
              ))}
              {item.goal_breakdown.length > 2 && (
                <Text style={styles.moreGoals}>+{item.goal_breakdown.length - 2} more</Text>
              )}
            </View>
          )}

          {/* AI Summary Preview */}
          {item.recap_text && (
            <View style={styles.summaryPreviewContainer}>
              <Markdown style={markdownStyles}>
                {item.recap_text.split("\n").slice(0, 3).join("\n").substring(0, 200)}
              </Markdown>
            </View>
          )}

          {/* Achievements Badge */}
          {item.achievements_unlocked && item.achievements_unlocked.length > 0 && (
            <View style={styles.achievementsBadge}>
              <Ionicons name="trophy" size={14} color={colors.text.primary} />
              <Text style={styles.achievementsText}>
                {item.achievements_unlocked.length} achievement
                {item.achievements_unlocked.length > 1 ? "s" : ""} unlocked
              </Text>
            </View>
          )}
        </Card>
      </TouchableOpacity>
    );
  };

  // Premium gate (shown only when free AND no historical recaps)
  const renderPremiumGate = () => (
    <View style={styles.premiumGate}>
      <View style={styles.premiumIconContainer}>
        <Ionicons name="analytics" size={48} color={brandColors.primary} />
      </View>
      <Text style={styles.premiumTitle}>{t("recaps.premium_title") || "Weekly Recaps"}</Text>
      <Text style={styles.premiumDescription}>
        {t("recaps.premium_description") ||
          "Get AI-powered weekly summaries of your progress, achievements, and personalized insights to help you stay on track."}
      </Text>
      <Button
        title={t("common.upgrade") || "Upgrade to Unlock"}
        onPress={openSubscriptionModal}
        style={styles.upgradeButton}
      />
    </View>
  );

  // Empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="document-text-outline" size={64} color={colors.text.tertiary} />
      <Text style={styles.emptyTitle}>{t("recaps.empty_title") || "No recaps yet"}</Text>
      <Text style={styles.emptyDescription}>
        {t("recaps.empty_description") ||
          "Your weekly recaps will appear here once you've completed your first week of activity."}
      </Text>
    </View>
  );

  // Show premium gate if user doesn't have the feature
  const showPremiumGate = !hasWeeklyRecapFeature;

  return (
    <View style={styles.container}>
      {/* Header */}
      <BackButton title={t("recaps.title") || "Weekly Recaps"} onPress={() => router.back()} />

      {/* Content */}
      {isLoading ? (
        <WeeklyRecapsSkeleton />
      ) : showPremiumGate ? (
        renderPremiumGate()
      ) : (
        <FlatList
          data={recaps}
          renderItem={renderRecapCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={brandColors.primary}
            />
          }
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  listContent: {
    padding: toRN(tokens.spacing[4]),
    flexGrow: 1
  },
  // Recap Card
  recapCard: {
    marginBottom: toRN(tokens.spacing[3]),
    padding: toRN(tokens.spacing[4])
  },
  recapHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[3])
  },
  headerRight: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2])
  },
  weekBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1.5]),
    paddingVertical: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[2]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.full)
  },
  weekBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  changeBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
    paddingVertical: toRN(tokens.spacing[0.5]),
    paddingHorizontal: toRN(tokens.spacing[1.5]),
    borderRadius: toRN(tokens.borderRadius.full)
  },
  changeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold
  },
  statsGrid: {
    flexDirection: "row" as const,
    justifyContent: "space-around" as const,
    paddingVertical: toRN(tokens.spacing[3]),
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.subtle
  },
  statItem: {
    alignItems: "center" as const
  },
  statValue: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: colors.text.primary
  },
  statLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[1])
  },
  streakValue: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1])
  },
  goalBreakdownPreview: {
    marginTop: toRN(tokens.spacing[3]),
    gap: toRN(tokens.spacing[1.5])
  },
  goalPreviewItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2])
  },
  goalStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  goalPreviewTitle: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary
  },
  goalPreviewRate: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  moreGoals: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginLeft: toRN(tokens.spacing[4])
  },
  summaryPreviewContainer: {
    marginTop: toRN(tokens.spacing[3]),
    maxHeight: 60,
    overflow: "hidden" as const
  },
  achievementsBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1.5]),
    marginTop: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[1.5]),
    paddingHorizontal: toRN(tokens.spacing[2]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.md),
    alignSelf: "flex-start" as const
  },
  achievementsText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
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
  upgradeButton: {
    minWidth: 200
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
  }
});
