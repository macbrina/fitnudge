import { useCallback } from "react";
import { notificationScheduler } from "@/services/notifications/notificationScheduler";
import { useNotificationPermissions } from "./useNotificationPermissions";

interface GoalData {
  id: string;
  title: string;
  reminderTimes: string[]; // Array of times in HH:MM format
  timezone: string;
}

export const useGoalNotifications = () => {
  const { isGranted } = useNotificationPermissions();

  const scheduleGoalNotifications = useCallback(
    async (goal: GoalData) => {
      if (!isGranted) {
        console.log(
          "Notifications not enabled, skipping goal notification scheduling"
        );
        return;
      }

      try {
        // Schedule check-in reminders (daily at first reminder time)
        if (goal.reminderTimes.length > 0) {
          await notificationScheduler.scheduleCheckInReminders({
            goalId: goal.id,
            goalTitle: goal.title,
            reminderTime: goal.reminderTimes[0],
            timezone: goal.timezone,
          });
        }

        // Schedule AI motivation calls for all reminder times
        await notificationScheduler.scheduleMotivationCalls({
          goalId: goal.id,
          goalTitle: goal.title,
          reminderTimes: goal.reminderTimes,
          timezone: goal.timezone,
        });

        console.log(`Notifications scheduled for goal: ${goal.title}`);
      } catch (error) {
        console.error("Failed to schedule goal notifications:", error);
      }
    },
    [isGranted]
  );

  const cancelGoalNotifications = useCallback(async (goalId: string) => {
    try {
      await notificationScheduler.cancelGoalNotifications(goalId);
      console.log(`Notifications cancelled for goal: ${goalId}`);
    } catch (error) {
      console.error("Failed to cancel goal notifications:", error);
    }
  }, []);

  const scheduleAchievementNotification = useCallback(
    async (goalId: string, achievement: string, delayMinutes: number = 0) => {
      if (!isGranted) {
        console.log(
          "Notifications not enabled, skipping achievement notification"
        );
        return;
      }

      try {
        await notificationScheduler.scheduleAchievementNotification(
          goalId,
          achievement,
          delayMinutes
        );
        console.log(`Achievement notification scheduled for goal: ${goalId}`);
      } catch (error) {
        console.error("Failed to schedule achievement notification:", error);
      }
    },
    [isGranted]
  );

  const scheduleReengagementNotification = useCallback(
    async (userId: string, delayHours: number = 24) => {
      if (!isGranted) {
        console.log(
          "Notifications not enabled, skipping re-engagement notification"
        );
        return;
      }

      try {
        await notificationScheduler.scheduleReengagementNotification(
          userId,
          delayHours
        );
        console.log(`Re-engagement notification scheduled for user: ${userId}`);
      } catch (error) {
        console.error("Failed to schedule re-engagement notification:", error);
      }
    },
    [isGranted]
  );

  const scheduleAllActiveGoals = useCallback(
    async (activeGoals: GoalData[]) => {
      if (!isGranted) {
        console.log(
          "Notifications not enabled, skipping goal notification scheduling"
        );
        return;
      }

      try {
        // Schedule notifications for all active goals
        for (const goal of activeGoals) {
          if (goal.reminderTimes && goal.reminderTimes.length > 0) {
            await scheduleGoalNotifications(goal);
          }
        }
        console.log(`Notifications scheduled for ${activeGoals.length} active goals`);
      } catch (error) {
        console.error("Failed to schedule notifications for active goals:", error);
      }
    },
    [isGranted, scheduleGoalNotifications]
  );

  return {
    scheduleGoalNotifications,
    cancelGoalNotifications,
    scheduleAllActiveGoals,
    scheduleAchievementNotification,
    scheduleReengagementNotification,
    isNotificationsEnabled: isGranted,
  };
};
