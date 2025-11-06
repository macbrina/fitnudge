import { convertTimeToDeviceTimezone } from "@/utils/helper";
import * as Notifications from "expo-notifications";
import { notificationService } from "./notificationService";
import {
  NotificationCategory,
  NotificationData,
  ScheduledNotification,
} from "./notificationTypes";

interface GoalReminder {
  goalId: string;
  goalTitle: string;
  reminderTimes: string[]; // Array of times in HH:MM format
  timezone: string;
}

interface CheckInReminder {
  goalId: string;
  goalTitle: string;
  reminderTime: string; // HH:MM format
  timezone: string;
}

class NotificationScheduler {
  private static instance: NotificationScheduler;
  private scheduledNotifications: Map<string, string> = new Map(); // goalId -> notificationId

  private constructor() {}

  public static getInstance(): NotificationScheduler {
    if (!NotificationScheduler.instance) {
      NotificationScheduler.instance = new NotificationScheduler();
    }
    return NotificationScheduler.instance;
  }

  /**
   * Schedule daily check-in reminders for a goal
   */
  public async scheduleCheckInReminders(
    reminder: CheckInReminder
  ): Promise<void> {
    try {
      const notificationId = await this.scheduleDailyReminder({
        goalId: reminder.goalId,
        goalTitle: reminder.goalTitle,
        reminderTime: reminder.reminderTime,
        timezone: reminder.timezone,
        type: "checkin",
      });

      if (notificationId) {
        this.scheduledNotifications.set(reminder.goalId, notificationId);
        console.log(`Check-in reminder scheduled for goal ${reminder.goalId}`);
      }
    } catch (error) {
      console.error("Failed to schedule check-in reminder:", error);
    }
  }

  /**
   * Schedule AI motivation calls for a goal
   */
  public async scheduleMotivationCalls(reminder: GoalReminder): Promise<void> {
    try {
      for (const reminderTime of reminder.reminderTimes) {
        const notificationId = await this.scheduleDailyReminder({
          goalId: reminder.goalId,
          goalTitle: reminder.goalTitle,
          reminderTime,
          timezone: reminder.timezone,
          type: "motivation",
        });

        if (notificationId) {
          const key = `${reminder.goalId}-${reminderTime}`;
          this.scheduledNotifications.set(key, notificationId);
          console.log(
            `Motivation call scheduled for goal ${reminder.goalId} at ${reminderTime}`
          );
        }
      }
    } catch (error) {
      console.error("Failed to schedule motivation calls:", error);
    }
  }

  /**
   * Schedule a one-time achievement notification
   */
  public async scheduleAchievementNotification(
    goalId: string,
    achievement: string,
    delayMinutes: number = 0
  ): Promise<void> {
    try {
      const notification: ScheduledNotification = {
        id: `achievement-${goalId}-${Date.now()}`,
        title: "🎉 Achievement Unlocked!",
        body: achievement,
        data: {
          type: NotificationCategory.ACHIEVEMENT,
          goalId,
          deepLink: `/goals/${goalId}/achievements`,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: delayMinutes * 60,
        },
        category: NotificationCategory.ACHIEVEMENT,
      };

      const notificationId =
        await notificationService.scheduleLocalNotification(notification);
      if (notificationId) {
        console.log(`Achievement notification scheduled for goal ${goalId}`);
      }
    } catch (error) {
      console.error("Failed to schedule achievement notification:", error);
    }
  }

  /**
   * Schedule a re-engagement notification for inactive users
   */
  public async scheduleReengagementNotification(
    userId: string,
    delayHours: number = 24
  ): Promise<void> {
    try {
      const notification: ScheduledNotification = {
        id: `reengagement-${userId}-${Date.now()}`,
        title: "We miss you! 💪",
        body: "Your fitness goals are waiting for you. Let's get back on track!",
        data: {
          type: NotificationCategory.REENGAGEMENT,
          userId,
          deepLink: "/home",
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: delayHours * 60 * 60,
        },
        category: NotificationCategory.REENGAGEMENT,
      };

      const notificationId =
        await notificationService.scheduleLocalNotification(notification);
      if (notificationId) {
        console.log(`Re-engagement notification scheduled for user ${userId}`);
      }
    } catch (error) {
      console.error("Failed to schedule re-engagement notification:", error);
    }
  }

  /**
   * Cancel all notifications for a specific goal
   */
  public async cancelGoalNotifications(goalId: string): Promise<void> {
    try {
      // Cancel check-in reminder
      const checkInId = this.scheduledNotifications.get(goalId);
      if (checkInId) {
        await notificationService.cancelScheduledNotification(checkInId);
        this.scheduledNotifications.delete(goalId);
      }

      // Cancel motivation calls
      for (const [
        key,
        notificationId,
      ] of this.scheduledNotifications.entries()) {
        if (key.startsWith(`${goalId}-`)) {
          await notificationService.cancelScheduledNotification(notificationId);
          this.scheduledNotifications.delete(key);
        }
      }

      console.log(`All notifications cancelled for goal ${goalId}`);
    } catch (error) {
      console.error("Failed to cancel goal notifications:", error);
    }
  }

  /**
   * Cancel all scheduled notifications
   */
  public async cancelAllNotifications(): Promise<void> {
    try {
      await notificationService.cancelAllScheduledNotifications();
      this.scheduledNotifications.clear();
      console.log("All notifications cancelled");
    } catch (error) {
      console.error("Failed to cancel all notifications:", error);
    }
  }

  /**
   * Reschedule all notifications (useful after app restart)
   */
  public async rescheduleAllNotifications(
    goals: GoalReminder[]
  ): Promise<void> {
    try {
      // Clear existing notifications
      await this.cancelAllNotifications();

      // Reschedule all goals
      for (const goal of goals) {
        await this.scheduleCheckInReminders({
          goalId: goal.goalId,
          goalTitle: goal.goalTitle,
          reminderTime: goal.reminderTimes[0] || "09:00", // Use first reminder time for check-ins
          timezone: goal.timezone,
        });

        await this.scheduleMotivationCalls(goal);
      }

      console.log("All notifications rescheduled");
    } catch (error) {
      console.error("Failed to reschedule notifications:", error);
    }
  }

  /**
   * Get all scheduled notifications
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

  /**
   * Private method to schedule a daily reminder
   */
  private async scheduleDailyReminder(params: {
    goalId: string;
    goalTitle: string;
    reminderTime: string;
    timezone: string;
    type: "checkin" | "motivation";
  }): Promise<string | null> {
    const { goalId, goalTitle, reminderTime, timezone, type } = params;

    // Convert reminder time from user's timezone to device's local timezone
    const { hours, minutes } = convertTimeToDeviceTimezone(
      reminderTime,
      timezone
    );

    // Create trigger for daily notification using device local time
    const trigger = {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR as any,
      hour: hours,
      minute: minutes,
      repeats: true,
    };

    // Determine notification content based on type
    const isMotivation = type === "motivation";
    const title = isMotivation
      ? "🤖 Your AI Coach is calling!"
      : "⏰ Time for your check-in!";
    const body = isMotivation
      ? `Ready for your ${goalTitle} motivation?`
      : `How did your ${goalTitle} go today?`;

    const notification: ScheduledNotification = {
      id: `${type}-${goalId}-${reminderTime}`,
      title,
      body,
      data: {
        type: isMotivation
          ? NotificationCategory.AI_MOTIVATION
          : NotificationCategory.REMINDER,
        goalId,
        deepLink: isMotivation ? `/motivation/${goalId}` : `/checkin/${goalId}`,
        sound: true, // Always enabled
      },
      trigger,
      category: isMotivation
        ? NotificationCategory.AI_MOTIVATION
        : NotificationCategory.REMINDER,
    };

    return await notificationService.scheduleLocalNotification(notification);
  }
}

export const notificationScheduler = NotificationScheduler.getInstance();
