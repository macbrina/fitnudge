import React from "react";
import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/lib/i18n";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { Card } from "@/components/ui/Card";
import { BackButton } from "@/components/ui/BackButton";
import { formatWeekRange } from "@/utils/helper";

// Mock hook - Replace with actual API hook
const useWeeklyRecapDetail = (recapId: string) => {
  // TODO: Implement actual API call
  return {
    data: null as WeeklyRecapDetail | null,
    isLoading: false,
    refetch: async () => {}
  };
};

interface WeeklyRecapDetail {
  id: string;
  user_id: string;
  week_start_date: string;
  week_end_date: string;
  goals_completed: number;
  total_check_ins: number;
  streak_maintained: boolean;
  current_streak: number;
  longest_streak: number;
  highlights: string[];
  ai_summary: string;
  ai_recommendations: string[];
  daily_breakdown: {
    date: string;
    check_ins: number;
    mood: number;
    notes: string;
  }[];
  category_stats: {
    category: string;
    check_ins: number;
    completion_rate: number;
  }[];
  created_at: string;
}

export default function RecapDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const recapId = params.id || "";

  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const { data: recap, isLoading, refetch } = useWeeklyRecapDetail(recapId);

  const formatRecapWeekRange = (startDate: string, endDate: string) => {
    return formatWeekRange(startDate, endDate, "long");
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <BackButton
          title={t("recaps.detail_title") || "Weekly Recap"}
          onPress={() => router.back()}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={brandColors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!recap) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <BackButton
          title={t("recaps.detail_title") || "Weekly Recap"}
          onPress={() => router.back()}
        />
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={64} color={colors.text.tertiary} />
          <Text style={styles.emptyTitle}>{t("recaps.not_found_title") || "Recap not found"}</Text>
          <Text style={styles.emptyDescription}>
            {t("recaps.not_found_description") || "This weekly recap could not be found."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
      >
        {/* Week Header */}
        <View style={styles.weekHeader}>
          <Text style={styles.weekRange}>
            {formatRecapWeekRange(recap.week_start_date, recap.week_end_date)}
          </Text>
        </View>

        {/* Stats Overview */}
        <Card style={styles.statsCard}>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: `${brandColors.primary}15` }]}>
                <Ionicons name="checkmark-circle" size={24} color={brandColors.primary} />
              </View>
              <Text style={styles.statValue}>{recap.total_check_ins}</Text>
              <Text style={styles.statLabel}>{t("recaps.total_check_ins") || "Check-ins"}</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: "#22C55E15" }]}>
                <Ionicons name="trophy" size={24} color="#22C55E" />
              </View>
              <Text style={styles.statValue}>{recap.goals_completed}</Text>
              <Text style={styles.statLabel}>{t("recaps.goals_completed") || "Goals"}</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: "#EF444415" }]}>
                <Ionicons name="flame" size={24} color="#EF4444" />
              </View>
              <Text style={styles.statValue}>{recap.current_streak}</Text>
              <Text style={styles.statLabel}>{t("recaps.current_streak") || "Streak"}</Text>
            </View>
          </View>
        </Card>

        {/* AI Summary */}
        {recap.ai_summary && (
          <Card style={styles.summaryCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="sparkles" size={20} color={brandColors.primary} />
              <Text style={styles.cardTitle}>{t("recaps.ai_summary") || "AI Summary"}</Text>
            </View>
            <Text style={styles.summaryText}>{recap.ai_summary}</Text>
          </Card>
        )}

        {/* Highlights */}
        {recap.highlights && recap.highlights.length > 0 && (
          <Card style={styles.highlightsCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="star" size={20} color="#F59E0B" />
              <Text style={styles.cardTitle}>{t("recaps.highlights") || "Highlights"}</Text>
            </View>
            {recap.highlights.map((highlight, index) => (
              <View key={index} style={styles.highlightItem}>
                <View style={styles.highlightDot} />
                <Text style={styles.highlightText}>{highlight}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* AI Recommendations */}
        {recap.ai_recommendations && recap.ai_recommendations.length > 0 && (
          <Card style={styles.recommendationsCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="bulb" size={20} color="#8B5CF6" />
              <Text style={styles.cardTitle}>
                {t("recaps.recommendations") || "Recommendations"}
              </Text>
            </View>
            {recap.ai_recommendations.map((rec, index) => (
              <View key={index} style={styles.recommendationItem}>
                <Text style={styles.recommendationNumber}>{index + 1}</Text>
                <Text style={styles.recommendationText}>{rec}</Text>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    padding: toRN(tokens.spacing[4])
  },
  // Week Header
  weekHeader: {
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[4])
  },
  weekRange: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  // Stats Card
  statsCard: {
    marginBottom: toRN(tokens.spacing[4]),
    padding: toRN(tokens.spacing[4])
  },
  statsGrid: {
    flexDirection: "row" as const,
    justifyContent: "space-around" as const
  },
  statItem: {
    alignItems: "center" as const
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
  // Cards
  summaryCard: {
    marginBottom: toRN(tokens.spacing[4]),
    padding: toRN(tokens.spacing[4])
  },
  highlightsCard: {
    marginBottom: toRN(tokens.spacing[4]),
    padding: toRN(tokens.spacing[4])
  },
  recommendationsCard: {
    marginBottom: toRN(tokens.spacing[4]),
    padding: toRN(tokens.spacing[4])
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
  highlightItem: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    marginBottom: toRN(tokens.spacing[2])
  },
  highlightDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F59E0B",
    marginTop: 6,
    marginRight: toRN(tokens.spacing[2])
  },
  highlightText: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5
  },
  recommendationItem: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    marginBottom: toRN(tokens.spacing[3])
  },
  recommendationNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: `${brand.primary}15`,
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: brand.primary,
    textAlign: "center" as const,
    lineHeight: 24,
    marginRight: toRN(tokens.spacing[2])
  },
  recommendationText: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5
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
