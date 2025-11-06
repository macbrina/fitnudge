import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { notificationService } from "@/services/notifications/notificationService";
import { NotificationToast } from "@/components/notifications/NotificationToast";
import { NotificationData } from "@/services/notifications/notificationTypes";
import { useGoalNotifications } from "@/hooks/notifications/useGoalNotifications";
import { useActiveGoals } from "@/hooks/api/useGoals";
import { useAuthStore } from "@/stores/authStore";
import { useUserTimezone } from "@/hooks/useUserTimezone";

interface NotificationContextType {
  showToast: (title: string, body: string, data?: NotificationData) => void;
  hideToast: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
}) => {
  const [toastVisible, setToastVisible] = useState(false);
  const [toastTitle, setToastTitle] = useState("");
  const [toastBody, setToastBody] = useState("");
  const [toastData, setToastData] = useState<NotificationData | undefined>();
  const { isAuthenticated } = useAuthStore();
  const { data: activeGoalsResponse } = useActiveGoals();
  const { scheduleAllActiveGoals, isNotificationsEnabled } =
    useGoalNotifications();
  const userTimezone = useUserTimezone();

  useEffect(() => {
    // Initialize notification service
    notificationService.initializeNotifications();
  }, []);

  // Reschedule reminders for all active goals on app startup
  useEffect(() => {
    const rescheduleReminders = async () => {
      if (!isAuthenticated || !isNotificationsEnabled) {
        return;
      }

      if (
        activeGoalsResponse?.data &&
        Array.isArray(activeGoalsResponse.data)
      ) {
        const activeGoals = activeGoalsResponse.data.filter(
          (goal) =>
            goal.is_active &&
            goal.reminder_times &&
            goal.reminder_times.length > 0
        );

        if (activeGoals.length > 0) {
          const goalsWithReminders = activeGoals.map((goal) => ({
            id: goal.id,
            title: goal.title,
            reminderTimes: goal.reminder_times,
            timezone: userTimezone,
          }));

          await scheduleAllActiveGoals(goalsWithReminders);
        }
      }
    };

    // Only reschedule if we have active goals data
    if (activeGoalsResponse?.data !== undefined) {
      rescheduleReminders();
    }
  }, [
    isAuthenticated,
    isNotificationsEnabled,
    activeGoalsResponse?.data,
    scheduleAllActiveGoals,
  ]);

  const showToast = (title: string, body: string, data?: NotificationData) => {
    setToastTitle(title);
    setToastBody(body);
    setToastData(data);
    setToastVisible(true);
  };

  const hideToast = () => {
    setToastVisible(false);
  };

  const handleToastPress = () => {
    // TODO: Implement deep linking based on toastData
    console.log("Toast pressed:", toastData);
  };

  const value: NotificationContextType = {
    showToast,
    hideToast,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationToast
        visible={toastVisible}
        title={toastTitle}
        body={toastBody}
        data={toastData}
        onPress={handleToastPress}
        onDismiss={hideToast}
      />
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      "useNotification must be used within a NotificationProvider"
    );
  }
  return context;
};
