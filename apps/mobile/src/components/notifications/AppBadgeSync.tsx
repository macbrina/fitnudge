/**
 * Syncs app icon badge (home screen) with unread notification count.
 * Uses Notifications.setBadgeCountAsync from expo-notifications.
 *
 * iOS: Works well. Android: Support varies by launcher (Samsung, etc.).
 */
import React, { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { useUnreadNotificationCount } from "@/hooks/api/useNotificationHistory";
import { useAuthStore } from "@/stores/authStore";

export function AppBadgeSync() {
  const { isAuthenticated, isVerifyingUser } = useAuthStore();
  const { unreadCount } = useUnreadNotificationCount();

  useEffect(() => {
    if (!isAuthenticated || isVerifyingUser) {
      // Clear badge on logout
      Notifications.setBadgeCountAsync(0).catch(() => {});
      return;
    }

    const count = Math.min(unreadCount, 99); // Cap at 99 for display
    Notifications.setBadgeCountAsync(count).catch((err) => {
      // Silently ignore - not all Android launchers support badges
      if (__DEV__) {
        console.warn("[AppBadgeSync] setBadgeCountAsync failed:", err);
      }
    });
  }, [isAuthenticated, isVerifyingUser, unreadCount]);

  return null;
}
