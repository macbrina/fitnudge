import { useCallback } from "react";
import { notificationScheduler } from "@/services/notifications/notificationScheduler";

/**
 * useGoalNotifications Hook
 *
 * Simplified hook for local notification cleanup only.
 * All scheduled notifications (check-ins, AI motivations, achievements, re-engagement)
 * are now handled by the backend via Expo Push Notifications.
 *
 * This hook only manages:
 * - Cancelling local notifications when goals are deleted
 * - Cancelling all notifications on logout
 */
export const useGoalNotifications = () => {
  /**
   * Cancel all local notifications for a specific goal
   * Useful when user deletes a goal
   */
  const cancelGoalNotifications = useCallback(async (goalId: string) => {
    try {
      await notificationScheduler.cancelGoalNotifications(goalId);
      console.log(`Local notifications cancelled for goal: ${goalId}`);
    } catch (error) {
      console.error("Failed to cancel goal notifications:", error);
    }
  }, []);

  /**
   * Cancel all local notifications
   * Useful for logout/cleanup
   */
  const cancelAllNotifications = useCallback(async () => {
    try {
      await notificationScheduler.cancelAllNotifications();
      console.log("All local notifications cancelled");
    } catch (error) {
      console.error("Failed to cancel all notifications:", error);
    }
  }, []);

  return {
    cancelGoalNotifications,
    cancelAllNotifications,
  };
};
