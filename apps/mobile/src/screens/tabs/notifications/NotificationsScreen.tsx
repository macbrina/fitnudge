import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/lib/i18n";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { MOBILE_ROUTES } from "@/lib/routes";
import { Card } from "@/components/ui/Card";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { formatRelativeTime } from "@/utils/helper";

// Hooks
import {
  useNotificationHistory,
  useMarkNotificationOpened,
  useMarkAllNotificationsOpened,
  NotificationHistoryItem,
  categorizeNotificationType,
  getNotificationIcon
} from "@/hooks/api/useNotificationHistory";

type NotificationTab = "all" | "activity" | "requests" | "system";

export default function NotificationsScreen() {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<NotificationTab>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [, setTimeTick] = useState(0);

  // Update relative times every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeTick((tick) => tick + 1);
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, []);

  // Fetch notification history with infinite scroll
  const { data, isLoading, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useNotificationHistory();

  const markOpenedMutation = useMarkNotificationOpened();
  const markAllOpenedMutation = useMarkAllNotificationsOpened();

  // Flatten pages into a single array
  const allNotifications = useMemo(() => {
    return data?.pages.flat() ?? [];
  }, [data?.pages]);

  // Count unread notifications
  const unreadNotifications = useMemo(() => {
    return allNotifications.filter((n) => !n.opened_at);
  }, [allNotifications]);

  const unreadCount = unreadNotifications.length;

  // Filter based on active tab
  const filteredNotifications = useMemo(() => {
    if (activeTab === "all") {
      return allNotifications;
    }

    return allNotifications.filter((n) => {
      const category = categorizeNotificationType(n.notification_type);
      if (activeTab === "activity") {
        return category === "activity";
      }
      if (activeTab === "requests") {
        return category === "requests";
      }
      if (activeTab === "system") {
        return category === "system";
      }
      return true;
    });
  }, [allNotifications, activeTab]);

  // Count notifications by category
  const activityCount = useMemo(() => {
    return allNotifications.filter(
      (n) => categorizeNotificationType(n.notification_type) === "activity"
    ).length;
  }, [allNotifications]);

  const requestsCount = useMemo(() => {
    return allNotifications.filter(
      (n) => categorizeNotificationType(n.notification_type) === "requests"
    ).length;
  }, [allNotifications]);

  const systemCount = useMemo(() => {
    return allNotifications.filter(
      (n) => categorizeNotificationType(n.notification_type) === "system"
    ).length;
  }, [allNotifications]);

  // Refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  // Mark all as read - single batch API call following SCALABILITY.md best practices
  // Marks ALL unread notifications in DB, not just visible ones
  const handleMarkAllAsRead = useCallback(() => {
    if (unreadCount === 0 || markAllOpenedMutation.isPending) return;

    // Single batch API call - optimistic update happens immediately
    markAllOpenedMutation.mutate();
  }, [unreadCount, markAllOpenedMutation]);

  // Load more when reaching end of list
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Handle notification press
  const handleNotificationPress = useCallback(
    (notification: NotificationHistoryItem) => {
      // Mark as opened
      if (!notification.opened_at) {
        markOpenedMutation.mutate(notification.id);
      }

      // Navigate based on notification type and data
      const data = notification.data;

      if (data?.deepLink) {
        // Use deep link if available
        try {
          router.push(data.deepLink as any);
          return;
        } catch (e) {
          // Fall through to type-based navigation
        }
      }

      // Type-based navigation
      switch (notification.notification_type) {
        case "reminder":
          if (data?.goalId || notification.entity_id) {
            const goalId = data?.goalId || notification.entity_id;
            router.push(MOBILE_ROUTES.GOALS.DETAILS + `?id=${goalId}`);
          }
          break;

        case "ai_motivation":
          if (data?.goalId || notification.entity_id) {
            // Goal-specific motivation - go to goal details
            const goalId = data?.goalId || notification.entity_id;
            router.push(MOBILE_ROUTES.GOALS.DETAILS + `?id=${goalId}`);
          } else {
            // General daily motivation - go to home where MotivationCard is visible
            router.push(MOBILE_ROUTES.MAIN.HOME);
          }
          break;

        // Adaptive nudges - navigate to goal if available
        case "adaptive_nudge":
          if (data?.goalId || notification.entity_id) {
            const goalId = data?.goalId || notification.entity_id;
            router.push(MOBILE_ROUTES.GOALS.DETAILS + `?id=${goalId}`);
          }
          break;

        case "partner_request":
          // Open partners screen with "received" tab active
          router.push(`${MOBILE_ROUTES.PROFILE.PARTNERS}?tab=received`);
          break;

        case "partner_accepted":
          // Open partners screen with default "partners" tab
          router.push(MOBILE_ROUTES.PROFILE.PARTNERS);
          break;

        // Partner nudges, cheers, milestones - go to ActivityScreen
        case "partner_nudge":
        case "partner_cheer":
        case "partner_milestone":
        case "partner_inactive":
          router.push(MOBILE_ROUTES.PROFILE.ACTIVITY);
          break;

        case "achievement":
        case "streak_milestone":
          router.push(MOBILE_ROUTES.PROFILE.ACHIEVEMENTS);
          break;

        case "weekly_recap":
          if (data?.recapId || notification.entity_id) {
            const recapId = data?.recapId || notification.entity_id;
            router.push(MOBILE_ROUTES.PROFILE.RECAP_DETAIL(recapId));
          } else {
            router.push(MOBILE_ROUTES.PROFILE.WEEKLY_RECAPS);
          }
          break;

        case "subscription":
          // Just show the notification, no navigation
          break;

        default:
          // Default: go to home
          router.push(MOBILE_ROUTES.MAIN.HOME);
          break;
      }
    },
    [router, markOpenedMutation]
  );

  // Render notification card
  const renderNotificationCard = ({ item }: { item: NotificationHistoryItem }) => {
    const icon = getNotificationIcon(item.notification_type);
    const isUnread = !item.opened_at;

    return (
      <TouchableOpacity onPress={() => handleNotificationPress(item)} activeOpacity={0.7}>
        <Card style={[styles.notificationCard, isUnread && styles.notificationCardUnread]}>
          <View style={styles.cardRow}>
            {/* Icon */}
            <View style={[styles.iconContainer, { backgroundColor: `${icon.color}15` }]}>
              <Ionicons name={icon.name as any} size={20} color={icon.color} />
            </View>

            {/* Content */}
            <View style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <Text
                  style={[styles.cardTitle, isUnread && styles.cardTitleUnread]}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
                {isUnread && <View style={styles.unreadDot} />}
              </View>

              <Text style={styles.cardBody} numberOfLines={3}>
                {item.body}
              </Text>

              <Text style={styles.cardTime}>{formatRelativeTime(item.sent_at)}</Text>
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  // Tab config
  const tabs: { id: NotificationTab; label: string; count?: number }[] = [
    {
      id: "all",
      label: t("notifications.all") || "All",
      count: allNotifications.length
    },
    {
      id: "activity",
      label: t("notifications.activity") || "Activity",
      count: activityCount
    },
    {
      id: "requests",
      label: t("notifications.requests") || "Requests",
      count: requestsCount
    },
    {
      id: "system",
      label: t("notifications.system") || "System",
      count: systemCount
    }
  ];

  // Footer component for loading more
  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={brandColors.primary} />
      </View>
    );
  };

  // Render skeleton loading state
  const renderSkeletonCard = (index: number) => (
    <Card key={`skeleton-${index}`} style={styles.notificationCard}>
      <View style={styles.cardRow}>
        {/* Icon skeleton */}
        <SkeletonBox width={44} height={44} borderRadius={22} style={{ marginRight: 12 }} />

        {/* Content skeleton */}
        <View style={styles.cardContent}>
          <SkeletonBox width="70%" height={16} borderRadius={4} style={{ marginBottom: 8 }} />
          <SkeletonBox width="100%" height={14} borderRadius={4} style={{ marginBottom: 4 }} />
          <SkeletonBox width="80%" height={14} borderRadius={4} style={{ marginBottom: 8 }} />
          <SkeletonBox width={60} height={12} borderRadius={4} />
        </View>
      </View>
    </Card>
  );

  const renderSkeletonLoading = () => (
    <View style={styles.skeletonContainer}>
      {[1, 2, 3, 4, 5].map((index) => renderSkeletonCard(index))}
    </View>
  );

  // Render empty state
  const renderEmptyState = () => {
    let emptyTitle = t("notifications.empty_title") || "No notifications";
    let emptyMessage =
      t("notifications.empty_message") || "When you receive notifications, they'll appear here.";

    if (activeTab === "activity") {
      emptyTitle = t("notifications.empty.activity_title") || "No Activity Yet";
      emptyMessage =
        t("notifications.empty.activity_description") ||
        "Partner cheers, nudges, and milestones will appear here.";
    } else if (activeTab === "requests") {
      emptyTitle = t("notifications.empty.requests_title") || "No Pending Requests";
      emptyMessage =
        t("notifications.empty.requests_description") ||
        "Partner requests and challenge invites will appear here.";
    } else if (activeTab === "system") {
      emptyTitle = t("notifications.empty.system_title") || "No System Notifications";
      emptyMessage =
        t("notifications.empty.system_description") ||
        "Important updates and alerts will appear here.";
    }

    return (
      <View style={styles.emptyState}>
        <Ionicons name="notifications-off-outline" size={64} color={colors.text.tertiary} />
        <Text style={styles.emptyTitle}>{emptyTitle}</Text>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("notifications.title") || "Notifications"}</Text>
        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={handleMarkAllAsRead}
            disabled={markAllOpenedMutation.isPending}
            style={styles.markAllReadButton}
          >
            {markAllOpenedMutation.isPending ? (
              <ActivityIndicator size="small" color={brandColors.primary} />
            ) : (
              <Text style={styles.markAllReadText}>
                {t("notifications.mark_all_read") || "Mark all read"}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
            {tab.count !== undefined && tab.count > 0 && (
              <View style={[styles.tabBadge, activeTab === tab.id && styles.tabBadgeActive]}>
                <Text
                  style={[styles.tabBadgeText, activeTab === tab.id && styles.tabBadgeTextActive]}
                >
                  {tab.count > 99 ? "99+" : tab.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <FlatList
        data={filteredNotifications}
        renderItem={renderNotificationCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={brandColors.primary}
          />
        }
        ListEmptyComponent={isLoading ? null : renderEmptyState}
        ListFooterComponent={renderFooter}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        showsVerticalScrollIndicator={false}
      />

      {/* Loading State - Skeleton */}
      {isLoading && filteredNotifications.length === 0 && renderSkeletonLoading()}
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brandColors: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  header: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.canvas,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle
  },
  headerTitle: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.bold,
    color: colors.text.primary
  },
  markAllReadButton: {
    paddingVertical: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[2])
  },
  markAllReadText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: brandColors.primary
  },
  // Tab Bar
  tabBar: {
    flexDirection: "row" as const,
    backgroundColor: colors.bg.card,
    paddingHorizontal: toRN(tokens.spacing[4]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle
  },
  tab: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    marginRight: toRN(tokens.spacing[2]),
    gap: toRN(tokens.spacing[1.5])
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: brandColors.primary
  },
  tabText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary
  },
  tabTextActive: {
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  tabBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.bg.muted,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[1.5])
  },
  tabBadgeActive: {
    backgroundColor: brandColors.primary
  },
  tabBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: colors.text.secondary
  },
  tabBadgeTextActive: {
    color: "#FFFFFF"
  },
  // List
  listContent: {
    padding: toRN(tokens.spacing[4]),
    flexGrow: 1
  },
  loadingFooter: {
    paddingVertical: toRN(tokens.spacing[4]),
    alignItems: "center" as const
  },
  skeletonContainer: {
    position: "absolute" as const,
    top: 130, // Below header and tabs
    left: 0,
    right: 0,
    bottom: 0,
    padding: toRN(tokens.spacing[4]),
    backgroundColor: colors.bg.canvas
  },
  // Notification Card
  notificationCard: {
    marginBottom: toRN(tokens.spacing[3]),
    padding: toRN(tokens.spacing[4])
  },
  notificationCardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: brandColors.primary
  },
  cardRow: {
    flexDirection: "row" as const
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginRight: toRN(tokens.spacing[3])
  },
  cardContent: {
    flex: 1
  },
  cardHeader: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    justifyContent: "space-between" as const,
    marginBottom: toRN(tokens.spacing[1])
  },
  cardTitle: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.primary,
    marginRight: toRN(tokens.spacing[2])
  },
  cardTitleUnread: {
    fontFamily: fontFamily.semiBold
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: brandColors.primary,
    marginTop: 4
  },
  cardBody: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    marginBottom: toRN(tokens.spacing[2]),
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.4
  },
  cardTime: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },
  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    padding: toRN(tokens.spacing[8])
  },
  emptyTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginTop: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[2])
  },
  emptyText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    textAlign: "center" as const,
    maxWidth: 280
  }
});
