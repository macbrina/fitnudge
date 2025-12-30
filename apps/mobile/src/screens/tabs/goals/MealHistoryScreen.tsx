/**
 * MealHistoryScreen - Paginated meal history with infinite scroll
 *
 * Shows all meals logged for a goal or challenge, grouped by date.
 * Features:
 * - Infinite scroll pagination
 * - Photo thumbnails with full-size viewer
 * - Grouped by date (Today, Yesterday, specific dates)
 * - Empty state with CTA
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Modal as RNModal,
  Image,
  Dimensions,
  StatusBar,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/lib/i18n";
import { useStyles, useTheme } from "@/themes";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { tokens } from "@/themes/tokens";
import { useMealHistory } from "@/hooks/api/useMealLogs";
import { MealHistoryCard } from "@/components/progress/MealHistoryCard";
import { MealLog } from "@/services/api/mealLogs";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import BackButton from "@/components/ui/BackButton";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function MealHistoryScreen() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Get params from navigation
  const { goalId, challengeId } = useLocalSearchParams<{
    goalId?: string;
    challengeId?: string;
  }>();

  // Photo viewer state
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Fetch meal history with infinite scroll
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useMealHistory(goalId, challengeId, !!(goalId || challengeId));

  // Flatten pages into single array
  const allMeals = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.data);
  }, [data]);

  // Group meals by date
  const groupedMeals = useMemo(() => {
    const groups: { title: string; data: MealLog[] }[] = [];
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .split("T")[0];

    let currentDate = "";
    let currentGroup: MealLog[] = [];

    allMeals.forEach((meal) => {
      if (meal.logged_date !== currentDate) {
        // Save previous group
        if (currentGroup.length > 0) {
          groups.push({
            title: formatDateHeader(currentDate, today, yesterday, t),
            data: currentGroup,
          });
        }
        // Start new group
        currentDate = meal.logged_date;
        currentGroup = [meal];
      } else {
        currentGroup.push(meal);
      }
    });

    // Don't forget the last group
    if (currentGroup.length > 0) {
      groups.push({
        title: formatDateHeader(currentDate, today, yesterday, t),
        data: currentGroup,
      });
    }

    return groups;
  }, [allMeals, t]);

  // Flatten for FlatList (with section headers)
  const flatData = useMemo(() => {
    const items: { type: "header" | "meal"; title?: string; meal?: MealLog }[] =
      [];
    groupedMeals.forEach((group) => {
      items.push({ type: "header", title: group.title });
      group.data.forEach((meal) => {
        items.push({ type: "meal", meal });
      });
    });
    return items;
  }, [groupedMeals]);

  // Handle end reached for infinite scroll
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Handle photo press
  const handlePhotoPress = useCallback((photoUrl: string) => {
    setSelectedPhoto(photoUrl);
  }, []);

  // Render item
  const renderItem = useCallback(
    ({
      item,
    }: {
      item: { type: "header" | "meal"; title?: string; meal?: MealLog };
    }) => {
      if (item.type === "header") {
        return <Text style={styles.sectionHeader}>{item.title}</Text>;
      }
      if (item.type === "meal" && item.meal) {
        return (
          <MealHistoryCard meal={item.meal} onPhotoPress={handlePhotoPress} />
        );
      }
      return null;
    },
    [styles, handlePhotoPress],
  );

  // Key extractor
  const keyExtractor = useCallback(
    (
      item: { type: "header" | "meal"; title?: string; meal?: MealLog },
      index: number,
    ) => {
      if (item.type === "header") {
        return `header-${item.title}-${index}`;
      }
      return item.meal?.id || `meal-${index}`;
    },
    [],
  );

  // Footer component (loading indicator)
  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={brandColors.primary} />
        <Text style={styles.loadingText}>
          {t("common.loading") || "Loading..."}
        </Text>
      </View>
    );
  }, [isFetchingNextPage, brandColors.primary, styles, t]);

  // Empty state
  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="restaurant-outline"
          size={64}
          color={colors.text.tertiary}
        />
        <Text style={styles.emptyTitle}>
          {t("meals.no_meals_yet") || "No meals logged yet"}
        </Text>
        <Text style={styles.emptyMessage}>
          {t("meals.no_meals_message") ||
            "Start logging your meals to see them here"}
        </Text>
      </View>
    );
  }, [isLoading, styles, colors, t]);

  // Loading skeleton
  if (isLoading) {
    return (
      <View style={styles.container}>
        <BackButton
          title={t("meals.meal_history") || "Meal History"}
          onPress={() => router.back()}
        />
        <View style={styles.skeletonContainer}>
          <SkeletonBox width="30%" height={20} borderRadius={4} />
          <SkeletonBox width="100%" height={80} borderRadius={12} />
          <SkeletonBox width="100%" height={80} borderRadius={12} />
          <SkeletonBox width="30%" height={20} borderRadius={4} />
          <SkeletonBox width="100%" height={80} borderRadius={12} />
          <SkeletonBox width="100%" height={80} borderRadius={12} />
        </View>
      </View>
    );
  }

  // Error state
  if (isError) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={64}
            color={colors.feedback.error}
          />
          <Text style={styles.errorTitle}>{t("common.error") || "Error"}</Text>
          <Text style={styles.errorMessage}>
            {t("meals.failed_to_load") || "Failed to load meal history"}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => refetch()}
          >
            <Text style={styles.retryText}>{t("common.retry") || "Retry"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BackButton
        title={t("meals.meal_history") || "Meal History"}
        onPress={() => router.back()}
        titleCentered={true}
      />
      <FlatList
        data={flatData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={[
          styles.listContent,
          flatData.length === 0 && styles.emptyListContent,
        ]}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />

      {/* Photo Lightbox */}
      <RNModal
        visible={!!selectedPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <View style={styles.lightboxContainer}>
          {/* Close button */}
          <TouchableOpacity
            style={[styles.lightboxClose, { top: insets.top + 16 }]}
            onPress={() => setSelectedPhoto(null)}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Image */}
          {selectedPhoto && (
            <Image
              source={{ uri: selectedPhoto }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
          )}
        </View>
      </RNModal>
    </View>
  );
}

// Helper to format date header
function formatDateHeader(
  dateStr: string,
  today: string,
  yesterday: string,
  t: (key: string) => string,
): string {
  if (dateStr === today) {
    return t("common.today") || "Today";
  }
  if (dateStr === yesterday) {
    return t("common.yesterday") || "Yesterday";
  }
  // Format as "Mon, Dec 25"
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
  listContent: {
    padding: toRN(tokens.spacing[4]),
  },
  emptyListContent: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  sectionHeader: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.secondary,
    marginTop: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[2]),
  },
  loadingFooter: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: toRN(tokens.spacing[4]),
    gap: toRN(tokens.spacing[2]),
  },
  loadingText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
  },
  // Empty state
  emptyContainer: {
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[8]),
    gap: toRN(tokens.spacing[3]),
  },
  emptyTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
  emptyMessage: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    textAlign: "center" as const,
    maxWidth: "80%" as const,
  },
  // Error state
  errorContainer: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[6]),
    gap: toRN(tokens.spacing[3]),
  },
  errorTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
  errorMessage: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    textAlign: "center" as const,
  },
  retryButton: {
    marginTop: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[6]),
    paddingVertical: toRN(tokens.spacing[3]),
    backgroundColor: brand.primary,
    borderRadius: toRN(tokens.borderRadius.lg),
  },
  retryText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: "#FFFFFF",
  },
  // Skeleton
  skeletonContainer: {
    padding: toRN(tokens.spacing[4]),
    gap: toRN(tokens.spacing[3]),
  },
  // Lightbox
  lightboxContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  lightboxClose: {
    position: "absolute" as const,
    right: toRN(tokens.spacing[4]),
    zIndex: 10,
    padding: toRN(tokens.spacing[2]),
  },
  lightboxImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
  },
});
