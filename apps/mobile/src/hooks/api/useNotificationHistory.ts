/**
 * React Query hooks for notification history (notification_history table)
 *
 * These notifications are system-generated: reminders, AI motivation, subscription alerts, etc.
 */

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  notificationsService,
  type NotificationHistoryItem,
  type NotificationType
} from "@/services/api/notifications";
import { notificationHistoryQueryKeys } from "./queryKeys";

// Re-export types and query keys for convenience
export type { NotificationHistoryItem, NotificationType };
export { notificationHistoryQueryKeys };

// API functions
const PAGE_SIZE = 20;

async function fetchNotificationHistory(
  limit: number = PAGE_SIZE,
  offset: number = 0,
  notificationType?: string
): Promise<NotificationHistoryItem[]> {
  const response = await notificationsService.getHistory(limit, offset, notificationType);

  if (response.error || !response.data) {
    throw new Error(response.message || "Failed to fetch notifications");
  }

  return response.data;
}

async function markNotificationOpened(notificationId: string): Promise<void> {
  const response = await notificationsService.markOpened(notificationId);

  if (response.error) {
    throw new Error(response.message || "Failed to mark notification as opened");
  }
}

// Hooks

/**
 * Hook for fetching notification history with infinite scroll pagination
 */
export function useNotificationHistory(notificationType?: string) {
  return useInfiniteQuery({
    queryKey: notificationHistoryQueryKeys.list(notificationType),
    queryFn: ({ pageParam = 0 }) =>
      fetchNotificationHistory(PAGE_SIZE, pageParam, notificationType),
    getNextPageParam: (lastPage, allPages) => {
      // If we got fewer items than PAGE_SIZE, we've reached the end
      if (lastPage.length < PAGE_SIZE) {
        return undefined;
      }
      // Return the next offset
      return allPages.length * PAGE_SIZE;
    },
    initialPageParam: 0
  });
}

/**
 * Simple hook for prefetching first page of notifications
 */
export function useNotificationHistorySimple(limit: number = PAGE_SIZE) {
  return useQuery({
    queryKey: [...notificationHistoryQueryKeys.list(), "simple"],
    queryFn: () => fetchNotificationHistory(limit, 0)
  });
}

/**
 * Hook for getting unread notification count
 * Returns count of notifications where opened_at is null
 */
export function useUnreadNotificationCount() {
  // Fetch a reasonable number of recent notifications to count unread
  const query = useQuery({
    queryKey: notificationHistoryQueryKeys.unreadCount(),
    queryFn: () => fetchNotificationHistory(100, 0), // Fetch up to 100 to get accurate count
    staleTime: 30 * 1000 // 30 seconds - balance between freshness and API calls
  });

  // Count notifications where opened_at is null
  const unreadCount = query.data?.filter((n) => n.opened_at === null).length ?? 0;

  return {
    ...query,
    unreadCount
  };
}

export function useMarkNotificationOpened() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markNotificationOpened,
    // Optimistic update - immediately mark as opened in cache
    onMutate: async (notificationId: string) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({
        queryKey: notificationHistoryQueryKeys.all
      });

      // Snapshot the previous value for rollback on error
      const previousData = queryClient.getQueriesData({
        queryKey: notificationHistoryQueryKeys.list()
      });

      // Optimistically update the notification in all cached pages
      queryClient.setQueriesData(
        { queryKey: notificationHistoryQueryKeys.list() },
        (old: { pages: NotificationHistoryItem[][]; pageParams: number[] } | undefined) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page) =>
              page.map((notification) =>
                notification.id === notificationId
                  ? { ...notification, opened_at: new Date().toISOString() }
                  : notification
              )
            )
          };
        }
      );

      return { previousData };
    },
    // Rollback on error
    onError: (err, notificationId, context) => {
      if (context?.previousData) {
        // Restore the previous data
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    // Always refetch after error or success to ensure cache is in sync
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: notificationHistoryQueryKeys.all
      });
    }
  });
}

/**
 * Hook for marking ALL unread notifications as opened with optimistic update
 *
 * Following SCALABILITY.md best practices:
 * - Single API call (batch operation) instead of N+1 pattern
 * - Marks ALL unread notifications in DB, not just visible ones
 * - Optimistic UI update with rollback on error
 */
export function useMarkAllNotificationsOpened() {
  const queryClient = useQueryClient();

  return useMutation({
    // Single batch API call - no notification IDs needed
    mutationFn: async () => {
      const response = await notificationsService.markAllOpened();
      if (response.status !== 200 || !response.data) {
        throw new Error(response.error || "Failed to mark all notifications as opened");
      }
      return response.data;
    },

    // Optimistic update - immediately mark ALL notifications as opened in cache
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: notificationHistoryQueryKeys.all
      });

      // Snapshot the previous values for rollback
      const previousListData = queryClient.getQueriesData({
        queryKey: notificationHistoryQueryKeys.list()
      });
      const previousUnreadData = queryClient.getQueryData(
        notificationHistoryQueryKeys.unreadCount()
      );

      const openedAt = new Date().toISOString();

      // Optimistically update ALL notifications in infinite query pages
      queryClient.setQueriesData(
        { queryKey: notificationHistoryQueryKeys.list() },
        (old: { pages: NotificationHistoryItem[][]; pageParams: number[] } | undefined) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page) =>
              page.map((notification) =>
                notification.opened_at ? notification : { ...notification, opened_at: openedAt }
              )
            )
          };
        }
      );

      // Clear the unread count (all are now opened)
      queryClient.setQueryData(
        notificationHistoryQueryKeys.unreadCount(),
        (old: NotificationHistoryItem[] | undefined) => {
          if (!old) return [];
          return old.map((notification) => ({ ...notification, opened_at: openedAt }));
        }
      );

      return { previousListData, previousUnreadData };
    },

    // Rollback on error
    onError: (_err, _variables, context) => {
      // Restore list queries
      if (context?.previousListData) {
        context.previousListData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      // Restore unread count query
      if (context?.previousUnreadData) {
        queryClient.setQueryData(
          notificationHistoryQueryKeys.unreadCount(),
          context.previousUnreadData
        );
      }
    },

    // Invalidate on success to sync with server (fetches any notifications not yet loaded)
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: notificationHistoryQueryKeys.all
      });
    }
  });
}

/**
 * V2 Notification Categorization
 *
 * Categories:
 * - requests: Partner requests requiring action
 * - system: System notifications (subscription, achievements, recaps)
 * - activity: Partner activity and adaptive nudges
 * - other: Fallback for uncategorized
 */
export function categorizeNotificationType(
  type: NotificationType
): "requests" | "system" | "activity" | "other" {
  const requestTypes: NotificationType[] = ["partner_request"];

  const systemTypes: NotificationType[] = [
    "subscription",
    "reengagement",
    "achievement",
    "streak_milestone",
    "weekly_recap",
    "general"
  ];

  // V2: Activity notifications (partner actions, adaptive nudges)
  const activityTypes: NotificationType[] = [
    "partner_nudge",
    "partner_cheer",
    "partner_milestone",
    "partner_accepted",
    "partner_inactive",
    "adaptive_nudge"
  ];

  if (requestTypes.includes(type)) {
    return "requests";
  }

  if (systemTypes.includes(type)) {
    return "system";
  }

  if (activityTypes.includes(type)) {
    return "activity";
  }

  return "other";
}

/**
 * V2 Notification Icons
 * Returns icon name and color for each notification type
 */
export function getNotificationIcon(type: NotificationType): {
  name: string;
  color: string;
} {
  switch (type) {
    // Core types
    case "reminder":
      return { name: "time-outline", color: "#3B82F6" }; // blue
    case "ai_motivation":
      return { name: "sparkles", color: "#8B5CF6" }; // purple
    case "subscription":
      return { name: "card-outline", color: "#F59E0B" }; // amber
    case "reengagement":
      return { name: "notifications-outline", color: "#6366F1" }; // indigo
    case "achievement":
      return { name: "trophy-outline", color: "#F59E0B" }; // amber
    case "streak_milestone":
      return { name: "flame-outline", color: "#F59E0B" }; // amber
    case "weekly_recap":
      return { name: "calendar-outline", color: "#3B82F6" }; // blue
    case "adaptive_nudge":
      return { name: "bulb-outline", color: "#F59E0B" }; // amber - smart/AI feel

    // Partner types
    case "partner_request":
      return { name: "person-add-outline", color: "#3B82F6" }; // blue
    case "partner_accepted":
      return { name: "people-outline", color: "#10B981" }; // green
    case "partner_nudge":
      return { name: "hand-left-outline", color: "#EC4899" }; // pink
    case "partner_cheer":
      return { name: "happy-outline", color: "#10B981" }; // green
    case "partner_milestone":
      return { name: "ribbon-outline", color: "#F59E0B" }; // amber
    case "partner_inactive":
      return { name: "alert-circle-outline", color: "#6366F1" }; // indigo

    case "general":
    default:
      return { name: "notifications-outline", color: "#6B7280" }; // gray
  }
}
