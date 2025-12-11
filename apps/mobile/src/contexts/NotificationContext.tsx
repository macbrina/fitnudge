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
import { useAuthStore } from "@/stores/authStore";

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
  const { isAuthenticated, isVerifyingUser } = useAuthStore();

  useEffect(() => {
    // Only initialize notifications if user is authenticated and verified
    // All scheduled notifications (check-ins, AI motivations, achievements, re-engagement)
    // are now handled by the backend via Expo Push Notifications
    if (isAuthenticated && !isVerifyingUser) {
      notificationService.initializeNotifications();
    }
  }, [isAuthenticated, isVerifyingUser]);

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
