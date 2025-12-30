import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/lib/i18n";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { MOBILE_ROUTES } from "@/lib/routes";
import { Card } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { BackButton } from "@/components/ui/BackButton";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { formatWeekRange } from "@/utils/helper";

// Mock hook - Replace with actual API hook
const useWeeklyRecaps = () => {
  // TODO: Implement actual API call
  return {
    data: { data: [] as WeeklyRecap[] },
    isLoading: false,
    refetch: async () => {},
  };
};

interface WeeklyRecap {
  id: string;
  user_id: string;
  week_start_date: string;
  week_end_date: string;
  goals_completed: number;
  total_check_ins: number;
  streak_maintained: boolean;
  current_streak: number;
  highlights: string[];
  ai_summary: string;
  created_at: string;
}

export default function WeeklyRecapsScreen() {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { hasFeature } = useSubscriptionStore();

  const [refreshing, setRefreshing] = useState(false);

  // Check if user has access to weekly recaps
  const hasWeeklyRecapFeature = hasFeature("weekly_recap");

  // Fetch recaps
  const { data: recapsData, isLoading, refetch } = useWeeklyRecaps();
  const recaps = recapsData?.data || [];

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleRecapPress = (recap: WeeklyRecap) => {
    router.push(MOBILE_ROUTES.PROFILE.RECAP_DETAIL(recap.id));
  };

  const formatRecapWeekRange = (startDate: string, endDate: string) => {
    return formatWeekRange(startDate, endDate, "short");
  };

  const renderRecapCard = ({ item }: { item: WeeklyRecap }) => (
    <TouchableOpacity
      onPress={() => handleRecapPress(item)}
      activeOpacity={0.7}
    >
      <Card style={styles.recapCard}>
        <View style={styles.recapHeader}>
          <View style={styles.weekBadge}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color={brandColors.primary}
            />
            <Text style={styles.weekBadgeText}>
              {formatRecapWeekRange(item.week_start_date, item.week_end_date)}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.text.tertiary}
          />
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{item.total_check_ins}</Text>
            <Text style={styles.statLabel}>
              {t("recaps.check_ins") || "Check-ins"}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{item.goals_completed}</Text>
            <Text style={styles.statLabel}>
              {t("recaps.goals_completed") || "Goals"}
            </Text>
          </View>
          <View style={styles.statItem}>
            <View style={styles.streakValue}>
              <Ionicons
                name={item.streak_maintained ? "flame" : "flame-outline"}
                size={16}
                color={
                  item.streak_maintained ? "#EF4444" : colors.text.tertiary
                }
              />
              <Text style={styles.statValue}>{item.current_streak}</Text>
            </View>
            <Text style={styles.statLabel}>
              {t("recaps.streak") || "Streak"}
            </Text>
          </View>
        </View>

        {/* AI Summary Preview */}
        {item.ai_summary && (
          <Text style={styles.summaryPreview} numberOfLines={2}>
            {item.ai_summary}
          </Text>
        )}
      </Card>
    </TouchableOpacity>
  );

  // Premium gate
  const renderPremiumGate = () => (
    <View style={styles.premiumGate}>
      <View style={styles.premiumIconContainer}>
        <Ionicons name="analytics" size={48} color={brandColors.primary} />
      </View>
      <Text style={styles.premiumTitle}>
        {t("recaps.premium_title") || "Weekly Recaps"}
      </Text>
      <Text style={styles.premiumDescription}>
        {t("recaps.premium_description") ||
          "Get AI-powered weekly summaries of your progress, achievements, and personalized insights to help you stay on track."}
      </Text>
      <Button
        title={t("common.upgrade") || "Upgrade to Unlock"}
        onPress={() => router.push(MOBILE_ROUTES.ONBOARDING.SUBSCRIPTION)}
        style={styles.upgradeButton}
      />
    </View>
  );

  // Empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons
        name="document-text-outline"
        size={64}
        color={colors.text.tertiary}
      />
      <Text style={styles.emptyTitle}>
        {t("recaps.empty_title") || "No recaps yet"}
      </Text>
      <Text style={styles.emptyDescription}>
        {t("recaps.empty_description") ||
          "Your weekly recaps will appear here once you've completed your first week of activity."}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <BackButton
        title={t("recaps.title") || "Weekly Recaps"}
        onPress={() => router.back()}
      />

      {/* Content */}
      {!hasWeeklyRecapFeature ? (
        renderPremiumGate()
      ) : isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={brandColors.primary} />
        </View>
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
    backgroundColor: colors.bg.canvas,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  listContent: {
    padding: toRN(tokens.spacing[4]),
    flexGrow: 1,
  },
  // Recap Card
  recapCard: {
    marginBottom: toRN(tokens.spacing[3]),
    padding: toRN(tokens.spacing[4]),
  },
  recapHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[3]),
  },
  weekBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1.5]),
    paddingVertical: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[2]),
    backgroundColor: `${brand.primary}15`,
    borderRadius: toRN(tokens.borderRadius.full),
  },
  weekBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: brand.primary,
  },
  statsGrid: {
    flexDirection: "row" as const,
    justifyContent: "space-around" as const,
    paddingVertical: toRN(tokens.spacing[3]),
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.subtle,
  },
  statItem: {
    alignItems: "center" as const,
  },
  statValue: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[1]),
  },
  streakValue: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
  },
  summaryPreview: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    marginTop: toRN(tokens.spacing[3]),
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5,
  },
  // Premium Gate
  premiumGate: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[8]),
  },
  premiumIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: `${brand.primary}15`,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[4]),
  },
  premiumTitle: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[2]),
    textAlign: "center" as const,
  },
  premiumDescription: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    lineHeight: toRN(tokens.typography.fontSize.base) * 1.5,
    marginBottom: toRN(tokens.spacing[6]),
  },
  upgradeButton: {
    minWidth: 200,
  },
  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[8]),
  },
  emptyTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginTop: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[2]),
  },
  emptyDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    textAlign: "center" as const,
    maxWidth: 280,
  },
});
