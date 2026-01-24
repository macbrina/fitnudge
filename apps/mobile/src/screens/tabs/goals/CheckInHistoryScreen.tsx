/**
 * Check-in History Screen
 *
 * Displays paginated list of all check-ins for a goal.
 * Supports infinite scroll and tap to view details.
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl
} from "react-native";
import { useTranslation } from "@/lib/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { BackButton } from "@/components/ui/BackButton";
import { CheckInHistorySkeleton } from "@/components/skeletons";
import { useGoal } from "@/hooks/api/useGoals";
import { useInfiniteCheckIns } from "@/hooks/api/useCheckIns";
import { CheckIn } from "@/services/api/checkins";
import { CheckInDetailModal } from "@/components/modals/CheckInDetailModal";
import { CheckCircle, XCircle, Moon, Calendar, Circle } from "lucide-react-native";
import { formatDate } from "@/utils/helper";
import { MoodIcons, SkipIcons } from "@/components/icons/CheckinIcons";

const PAGE_SIZE = 20;

export default function CheckInHistoryScreen() {
  const params = useLocalSearchParams<{ goalId?: string }>();
  const goalId = params.goalId;

  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const [selectedCheckInId, setSelectedCheckInId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch goal for title
  const { data: goalResponse, isLoading: goalLoading } = useGoal(goalId || "");
  const goal = goalResponse?.data;

  // Fetch check-ins with infinite scroll
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: checkInsLoading,
    refetch
  } = useInfiniteCheckIns(goalId || "", PAGE_SIZE);

  // Flatten pages into single array
  const checkIns = data?.pages.flatMap((page) => page.data || []) || [];

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }, [refetch]);

  // Load more handler
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Render check-in item
  const renderCheckInItem = useCallback(
    ({ item }: { item: CheckIn }) => {
      // V2: status is the single source of truth
      const effectiveStatus = item.status || "pending";

      const getStatusIcon = () => {
        switch (effectiveStatus) {
          case "rest_day":
            return <Moon size={20} color={colors.text.tertiary} />;
          case "completed":
            return <CheckCircle size={20} color={colors.feedback.success} />;
          case "pending":
            return <Circle size={20} color={colors.text.tertiary} />;
          case "skipped":
          case "missed":
          default:
            return <XCircle size={20} color={colors.feedback.error} />;
        }
      };

      const getStatusText = () => {
        switch (effectiveStatus) {
          case "rest_day":
            return t("checkin.rest_day");
          case "completed":
            return t("goals.completed");
          case "pending":
            return t("goals.pending");
          case "skipped":
          case "missed":
          default:
            return t("goals.missed");
        }
      };

      const getStatusColor = () => {
        switch (effectiveStatus) {
          case "rest_day":
          case "pending":
            return colors.text.tertiary;
          case "completed":
            return colors.feedback.success;
          default:
            return colors.feedback.error;
        }
      };

      return (
        <TouchableOpacity
          style={styles.checkInItem}
          onPress={() => setSelectedCheckInId(item.id)}
          activeOpacity={0.7}
        >
          <View style={styles.checkInLeft}>
            <View style={styles.iconWrap}>{getStatusIcon()}</View>
            <View style={styles.checkInInfo}>
              <Text style={styles.checkInDate}>{formatDate(item.check_in_date)}</Text>
              <Text style={[styles.checkInStatus, { color: getStatusColor() }]}>
                {getStatusText()}
              </Text>
            </View>
          </View>

          <View style={styles.checkInRight}>
            {/* Show mood icon for completed */}
            {effectiveStatus === "completed" && item.mood && (
              <MoodIcons mood={item.mood} size={24} />
            )}
            {/* Show skip reason icon for skipped/missed */}
            {(effectiveStatus === "skipped" || effectiveStatus === "missed") &&
              item.skip_reason && <SkipIcons mood={item.skip_reason} size={22} />}
          </View>
        </TouchableOpacity>
      );
    },
    [colors, styles, t]
  );

  // Footer loader
  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={brandColors.primary} />
      </View>
    );
  }, [isFetchingNextPage, brandColors.primary, styles.footerLoader]);

  // Empty state
  const renderEmpty = useCallback(() => {
    if (checkInsLoading) return null;
    return (
      <View style={styles.emptyState}>
        <Calendar size={48} color={colors.text.tertiary} />
        <Text style={styles.emptyText}>{t("checkin.no_checkins_yet")}</Text>
      </View>
    );
  }, [checkInsLoading, colors.text.tertiary, styles, t]);

  // Loading state
  if (goalLoading || (checkInsLoading && checkIns.length === 0)) {
    return <CheckInHistorySkeleton />;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <BackButton title={goal?.title || t("checkin.history_title")} onPress={() => router.back()} />

      {/* Subtitle */}
      <View style={styles.subtitleContainer}>
        <Text style={styles.subtitle}>
          {t("checkin.history_title")} ({checkIns.length} {t("checkin.total")})
        </Text>
      </View>

      {/* Check-ins List */}
      <FlatList
        data={checkIns}
        renderItem={renderCheckInItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={brandColors.primary}
          />
        }
      />

      {/* Detail Modal (checkIn from list so AI response updates live when ready) */}
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
  subtitleContainer: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[3])
  },
  subtitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.tertiary
  },
  listContent: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[8])
  },
  checkInItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    backgroundColor: colors.bg.card,
    padding: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.lg),
    marginBottom: toRN(tokens.spacing[2])
  },
  checkInLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3])
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  checkInInfo: {
    gap: toRN(tokens.spacing[0.5])
  },
  checkInDate: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.primary
  },
  checkInStatus: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular
  },
  checkInRight: {
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  footerLoader: {
    paddingVertical: toRN(tokens.spacing[4]),
    alignItems: "center" as const
  },
  emptyState: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: toRN(tokens.spacing[16]),
    gap: toRN(tokens.spacing[3])
  },
  emptyText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.tertiary,
    textAlign: "center" as const
  }
});
