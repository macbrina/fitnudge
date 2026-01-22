import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { toRN } from "@/lib/units";
import { GoalInsightsResponse, InsightsMetrics, PatternInsight } from "@/services/api/goals";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { useStyles, useTheme } from "@/themes";
import {
  AlertTriangle,
  Award,
  BarChart2,
  CheckCircle,
  Crown,
  Flame,
  Lightbulb,
  Target,
  TrendingDown,
  TrendingUp
} from "lucide-react-native";
import { ActivityIndicator, Text, View } from "react-native";

interface PatternInsightsProps {
  goalId: string;
  hasPatternDetection: boolean;
  insightsStatus: "pending" | "generating" | "completed" | "failed" | "insufficient_data";
  insightsData?: GoalInsightsResponse;
  insights: PatternInsight[];
  currentMetrics?: InsightsMetrics;
  previousMetrics?: InsightsMetrics;
  isLoading?: boolean;
  isRetrying?: boolean;
  onRetry?: () => void;
}

export default function PatternInsights({
  goalId,
  insights,
  hasPatternDetection,
  insightsStatus,
  insightsData,
  currentMetrics,
  previousMetrics,
  isLoading,
  isRetrying,
  onRetry
}: PatternInsightsProps) {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();

  // Show loading state inside the card
  if (isLoading) {
    return (
      <Card style={styles.insightsCard}>
        <View style={styles.insightsHeader}>
          <View style={styles.insightsIconWrap}>
            <Lightbulb size={18} color={brandColors.primary} />
          </View>
          <Text style={styles.sectionTitle}>{t("goals.insights")}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={brandColors.primary} />
          <Text style={styles.loadingText}>
            {t("goals.insights_loading") || "Loading insights..."}
          </Text>
        </View>
      </Card>
    );
  }

  return (
    <Card style={styles.insightsCard}>
      <View style={styles.insightsHeader}>
        <View style={styles.insightsIconWrap}>
          <Lightbulb size={18} color={brandColors.primary} />
        </View>
        <Text style={styles.sectionTitle}>{t("goals.insights")}</Text>
      </View>

      {!hasPatternDetection ? (
        // Upsell for free users
        <View style={styles.insightsUpsellBox}>
          <View style={styles.insightsUpsellHeader}>
            <Crown size={18} color={colors.feedback.warning} />
          </View>
          <Text style={styles.insightsUpsellTitle}>
            {t("goals.insights_upsell_title") || "Unlock Pattern Insights"}
          </Text>
          <Text style={styles.insightsUpsellText}>
            {t("goals.insights_upsell_subtitle") ||
              "Get AI-powered insights about your best days, skip patterns, and success trends."}
          </Text>
          <Button
            title={t("goals.insights_upsell_cta") || "Upgrade to Premium"}
            size="sm"
            onPress={() => {
              const { openModal } = useSubscriptionStore.getState();
              openModal();
            }}
            style={styles.insightsUpsellButton}
          />
        </View>
      ) : insightsStatus === "generating" ? (
        // AI is generating insights
        <View style={styles.insightsProgressBox}>
          <View style={styles.insightsProgressHeader}>
            <BarChart2 size={20} color={brandColors.primary} />
            <Text style={styles.insightsProgressTitle}>
              {t("goals.insights_generating_title") || "Analyzing Your Patterns"}
            </Text>
          </View>
          <Text style={styles.insightsProgressText}>
            {t("goals.insights_generating_subtitle") || "AI is analyzing your check-in history..."}
          </Text>
          <ActivityIndicator size="small" color={brandColors.primary} style={{ marginTop: 12 }} />
        </View>
      ) : insightsStatus === "insufficient_data" ? (
        // Not enough data - need more check-ins
        <View style={styles.insightsProgressBox}>
          <View style={styles.insightsProgressHeader}>
            <BarChart2 size={20} color={brandColors.primary} />
            <Text style={styles.insightsProgressTitle}>
              {t("goals.insights_building_title") || "Building Your Insights"}
            </Text>
          </View>
          <Text style={styles.insightsProgressText}>
            {t("goals.insights_building_progress", {
              current: insightsData?.checkins_count || 0,
              needed: insightsData?.min_required || 7
            }) ||
              `${insightsData?.checkins_count || 0} of ${insightsData?.min_required || 7} check-ins completed`}
          </Text>
          {/* Progress bar */}
          <View style={styles.insightsProgressBarContainer}>
            <View style={styles.insightsProgressBarBg}>
              <View
                style={[
                  styles.insightsProgressBarFill,
                  {
                    width: `${Math.min(100, ((insightsData?.checkins_count || 0) / (insightsData?.min_required || 7)) * 100)}%`,
                    backgroundColor: brandColors.primary
                  }
                ]}
              />
            </View>
            <Text style={styles.insightsProgressPercent}>
              {Math.round(
                Math.min(
                  100,
                  ((insightsData?.checkins_count || 0) / (insightsData?.min_required || 7)) * 100
                )
              )}
              %
            </Text>
          </View>
          <Text style={styles.insightsProgressHint}>
            {t("goals.insights_hint_daily") ||
              "Keep checking in to unlock AI-powered pattern insights"}
          </Text>
        </View>
      ) : insightsStatus === "failed" ? (
        // Generation failed - show retry option
        <View style={styles.insightsProgressBox}>
          <View style={styles.insightsProgressHeader}>
            <AlertTriangle size={20} color={colors.feedback.error} />
            <Text style={[styles.insightsProgressTitle, { color: colors.feedback.error }]}>
              {t("goals.insights_failed_title") || "Analysis Failed"}
            </Text>
          </View>
          <Text style={styles.insightsProgressText}>
            {t("goals.insights_failed_subtitle") ||
              "We couldn't analyze your patterns. Please try again."}
          </Text>
          {onRetry && (
            <Button
              title={t("goals.insights_retry") || "Try Again"}
              size="sm"
              onPress={onRetry}
              loading={isRetrying}
              disabled={isRetrying}
              style={{ marginTop: 12 }}
            />
          )}
        </View>
      ) : insights.length === 0 ? (
        // Completed but no insights (edge case)
        <View style={styles.insightsProgressBox}>
          <View style={styles.insightsProgressHeader}>
            <BarChart2 size={20} color={brandColors.primary} />
            <Text style={styles.insightsProgressTitle}>
              {t("goals.insights_no_patterns_title") || "No Patterns Yet"}
            </Text>
          </View>
          <Text style={styles.insightsProgressText}>
            {t("goals.insights_no_patterns_subtitle") ||
              "Keep checking in consistently and we'll find meaningful patterns in your data."}
          </Text>
        </View>
      ) : (
        // Show actual AI-generated insights
        insights.map((insight, index) => {
          const getInsightIcon = () => {
            switch (insight.type) {
              case "pattern":
                return <TrendingUp size={16} color={brandColors.primary} />;
              case "encouragement":
                return <Award size={16} color={colors.feedback.success} />;
              case "warning":
                return <AlertTriangle size={16} color={colors.feedback.warning} />;
              case "tip":
                return <Lightbulb size={16} color={brandColors.primary} />;
              default:
                return <BarChart2 size={16} color={colors.text.tertiary} />;
            }
          };

          const getInsightBgColor = () => {
            switch (insight.type) {
              case "pattern":
                return brandColors.primary + "15";
              case "encouragement":
                return colors.feedback.success + "15";
              case "warning":
                return colors.feedback.warning + "15";
              case "tip":
                return brandColors.primary + "15";
              default:
                return colors.text.tertiary + "15";
            }
          };

          return (
            <View
              key={index}
              style={[styles.insightItem, index < insights.length - 1 && styles.insightItemBorder]}
            >
              <View style={[styles.insightIconWrap, { backgroundColor: getInsightBgColor() }]}>
                {getInsightIcon()}
              </View>
              <Text style={styles.insightText}>{insight.text}</Text>
            </View>
          );
        })
      )}

      {/* Metrics Section - Only show when there's valuable data (trend comparison or best/worst day) */}
      {hasPatternDetection &&
        insightsStatus === "completed" &&
        currentMetrics &&
        // Only show if we have: trend data OR best/worst day patterns
        (previousMetrics ||
          currentMetrics.best_day_index !== null ||
          currentMetrics.worst_day_index !== null) && (
          <View style={styles.metricsSection}>
            <View style={styles.metricsDivider} />
            <Text style={styles.metricsTitle}>{t("goals.insights_metrics_title")}</Text>

            <View style={styles.metricsGrid}>
              {/* Completion Rate Trend - Only show when we have previous metrics to compare */}
              {previousMetrics && previousMetrics.completion_rate_30d !== undefined && (
                <View style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <Target size={16} color={brandColors.primary} />
                    <Text style={styles.metricLabel}>{t("goals.insights_completion_trend")}</Text>
                  </View>
                  <View style={styles.metricValueRow}>
                    <Text style={styles.metricValue}>
                      {currentMetrics.completion_rate_30d || 0}%
                    </Text>
                    <View style={styles.metricTrend}>
                      {currentMetrics.completion_rate_30d > previousMetrics.completion_rate_30d ? (
                        <>
                          <TrendingUp size={12} color={colors.feedback.success} />
                          <Text
                            style={[styles.metricTrendText, { color: colors.feedback.success }]}
                          >
                            +
                            {Math.round(
                              currentMetrics.completion_rate_30d -
                                previousMetrics.completion_rate_30d
                            )}
                            %
                          </Text>
                        </>
                      ) : currentMetrics.completion_rate_30d <
                        previousMetrics.completion_rate_30d ? (
                        <>
                          <TrendingDown size={12} color={colors.feedback.error} />
                          <Text style={[styles.metricTrendText, { color: colors.feedback.error }]}>
                            {Math.round(
                              currentMetrics.completion_rate_30d -
                                previousMetrics.completion_rate_30d
                            )}
                            %
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.metricTrendText}>{t("goals.insights_no_change")}</Text>
                      )}
                    </View>
                  </View>
                  <Text style={styles.metricSubtext}>{t("goals.insights_vs_previous")}</Text>
                </View>
              )}

              {/* Best Day - Only show when data exists */}
              {currentMetrics.best_day_index !== null &&
                currentMetrics.best_day_index !== undefined && (
                  <View style={styles.metricCard}>
                    <View style={styles.metricHeader}>
                      <CheckCircle size={16} color={colors.feedback.success} />
                      <Text style={styles.metricLabel}>{t("goals.insights_best_day")}</Text>
                    </View>
                    <Text style={styles.metricValue}>
                      {[
                        t("goals.day_sun"),
                        t("goals.day_mon"),
                        t("goals.day_tue"),
                        t("goals.day_wed"),
                        t("goals.day_thu"),
                        t("goals.day_fri"),
                        t("goals.day_sat")
                      ][currentMetrics.best_day_index] ||
                        ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
                          currentMetrics.best_day_index
                        ]}
                    </Text>
                    <Text style={styles.metricSubtext}>
                      {currentMetrics.best_day_rate || 0}% {t("goals.insights_success_rate")}
                    </Text>
                  </View>
                )}

              {/* Worst Day - Only show when data exists */}
              {currentMetrics.worst_day_index !== null &&
                currentMetrics.worst_day_index !== undefined && (
                  <View style={styles.metricCard}>
                    <View style={styles.metricHeader}>
                      <AlertTriangle size={16} color={colors.feedback.error} />
                      <Text style={styles.metricLabel}>{t("goals.insights_worst_day")}</Text>
                    </View>
                    <Text style={styles.metricValue}>
                      {[
                        t("goals.day_sun"),
                        t("goals.day_mon"),
                        t("goals.day_tue"),
                        t("goals.day_wed"),
                        t("goals.day_thu"),
                        t("goals.day_fri"),
                        t("goals.day_sat")
                      ][currentMetrics.worst_day_index] ||
                        ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
                          currentMetrics.worst_day_index
                        ]}
                    </Text>
                    <Text style={styles.metricSubtext}>
                      {currentMetrics.worst_day_rate || 0}% {t("goals.insights_success_rate")}
                    </Text>
                  </View>
                )}

              {/* Check-ins Analyzed - Context info */}
              {currentMetrics.total_checkins_30d > 0 && (
                <View style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <BarChart2 size={16} color={brandColors.primary} />
                    <Text style={styles.metricLabel}>{t("goals.insights_data_analyzed")}</Text>
                  </View>
                  <Text style={styles.metricValue}>{currentMetrics.total_checkins_30d}</Text>
                  <Text style={styles.metricSubtext}>
                    {currentMetrics.total_checkins_30d === 1
                      ? t("goals.insights_checkin_singular")
                      : t("goals.insights_checkin_plural")}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
    </Card>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  insightsCard: {
    padding: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[4])
  },
  insightsHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    marginBottom: toRN(tokens.spacing[3])
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary
  },
  insightsIconWrap: {
    width: toRN(32),
    height: toRN(32),
    borderRadius: toRN(16),
    backgroundColor: brand.primary + "15",
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  insightItem: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[3])
  },
  insightItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle
  },
  insightIconWrap: {
    width: toRN(28),
    height: toRN(28),
    borderRadius: toRN(14),
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  insightText: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5
  },
  // Metrics Section Styles
  metricsSection: {
    marginTop: toRN(tokens.spacing[2])
  },
  metricsDivider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginBottom: toRN(tokens.spacing[4])
  },
  metricsTitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[3])
  },
  metricsGrid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: toRN(tokens.spacing[3])
  },
  metricCard: {
    flex: 1,
    minWidth: "45%" as unknown as number,
    backgroundColor: colors.bg.muted,
    padding: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.lg)
  },
  metricHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
    marginBottom: toRN(tokens.spacing[1])
  },
  metricLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.tertiary
  },
  metricValueRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2])
  },
  metricValue: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary
  },
  metricTrend: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(2)
  },
  metricTrendText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskMedium
  },
  metricSubtext: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.tertiary,
    marginTop: toRN(2)
  },
  // Insights Upsell State
  insightsUpsellBox: {
    // backgroundColor: colors.bg.muted,
    padding: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.lg),
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2])
  },
  insightsUpsellHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2])
  },
  insightsUpsellTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary,
    textAlign: "center" as const
  },
  insightsUpsellText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5
  },
  insightsUpsellButton: {
    marginTop: toRN(tokens.spacing[2])
  },
  // Insights Generating State (legacy - keeping for reference)
  insightsGeneratingBox: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: brand.primary + "10",
    padding: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.lg),
    gap: toRN(tokens.spacing[3])
  },
  insightsGeneratingContent: {
    flex: 1,
    gap: toRN(tokens.spacing[1])
  },
  insightsGeneratingTitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskSemiBold,
    color: brand.primary
  },
  insightsGeneratingText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.xs) * 1.5
  },
  // Insights Progress State (new - shows actual progress)
  insightsProgressBox: {
    backgroundColor: colors.bg.muted,
    padding: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.lg),
    gap: toRN(tokens.spacing[3])
  },
  insightsProgressHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2])
  },
  insightsProgressTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary
  },
  insightsProgressText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.4
  },
  insightsProgressBarContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2])
  },
  insightsProgressBarBg: {
    flex: 1,
    height: toRN(8),
    backgroundColor: colors.border.subtle,
    borderRadius: toRN(4),
    overflow: "hidden" as const
  },
  insightsProgressBarFill: {
    height: "100%" as const,
    borderRadius: toRN(4)
  },
  insightsProgressPercent: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.tertiary,
    minWidth: toRN(32)
  },
  insightsProgressHint: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.tertiary,
    fontStyle: "italic" as const
  },
  loadingContainer: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: toRN(tokens.spacing[6]),
    gap: toRN(tokens.spacing[3])
  },
  loadingText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.secondary
  }
});
