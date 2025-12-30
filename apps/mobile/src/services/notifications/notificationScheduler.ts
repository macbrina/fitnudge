import { notificationService } from "./notificationService";
import {
  NotificationCategory,
  NotificationData,
  ScheduledNotification,
} from "./notificationTypes";

/**
 * NotificationScheduler
 *
 * Simplified notification scheduler for local cleanup operations only.
 * All scheduled notifications (check-ins, AI motivations, achievements, re-engagement)
 * are now handled by the backend via Expo Push Notifications.
 *
 * This class only manages:
 * - Cancelling local notifications (cleanup on logout/goal deletion)
 * - Querying scheduled local notifications (for debugging)
 */
class NotificationScheduler {
  private static instance: NotificationScheduler;

  private constructor() {}

  public static getInstance(): NotificationScheduler {
    if (!NotificationScheduler.instance) {
      NotificationScheduler.instance = new NotificationScheduler();
    }
    return NotificationScheduler.instance;
  }

  /**
   * Cancel all notifications for a specific goal
   * Useful when user deletes a goal
   */
  public async cancelGoalNotifications(goalId: string): Promise<void> {
    try {
      // Get all scheduled notifications
      const allNotifications =
        await notificationService.getScheduledNotifications();

      // Cancel notifications related to this goal
      for (const notif of allNotifications) {
        const data = notif.content.data as NotificationData;
        if (data?.goalId === goalId) {
          await notificationService.cancelScheduledNotification(
            notif.identifier,
          );
        }
      }

      console.log(`All local notifications cancelled for goal ${goalId}`);
    } catch (error) {
      console.error("Failed to cancel goal notifications:", error);
    }
  }

  /**
   * Cancel all scheduled local notifications
   * Useful for logout/cleanup
   */
  public async cancelAllNotifications(): Promise<void> {
    try {
      await notificationService.cancelAllScheduledNotifications();
      console.log("All local notifications cancelled");
    } catch (error) {
      console.error("Failed to cancel all notifications:", error);
    }
  }

  /**
   * Get all scheduled local notifications
   * Useful for debugging
   */
  public async getScheduledNotifications(): Promise<ScheduledNotification[]> {
    try {
      const notifications =
        await notificationService.getScheduledNotifications();
      return notifications.map((notif) => ({
        id: notif.identifier,
        title: notif.content.title || "",
        body: notif.content.body || "",
        data: notif.content.data as NotificationData,
        trigger: notif.trigger as any,
        category: notif.content.categoryIdentifier as NotificationCategory,
      }));
    } catch (error) {
      console.error("Failed to get scheduled notifications:", error);
      return [];
    }
  }
}

export const notificationScheduler = NotificationScheduler.getInstance();
