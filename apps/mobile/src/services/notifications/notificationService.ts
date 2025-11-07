import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import {
  NotificationCategory,
  NotificationData,
  NotificationPreferences,
  DeviceTokenInfo,
  ScheduledNotification,
  PermissionStatus,
  NotificationChannel,
} from "./notificationTypes";
import { storageUtil } from "@/utils/storageUtil";
import { STORAGE_KEYS } from "@/utils/storageUtil";
import posthog from "@/lib/posthog";
import { notificationApi } from "@/services/api/notifications";

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

class NotificationService {
  private static instance: NotificationService;
  private fcmToken: string | null = null;
  private permissionStatus: PermissionStatus = "undetermined";
  private notificationChannels: NotificationChannel[] = [];

  private constructor() {
    this.initializeChannels();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private initializeChannels(): void {
    this.notificationChannels = [
      {
        id: NotificationCategory.AI_MOTIVATION,
        name: "AI Motivation",
        description: "Personalized AI motivation calls and messages",
        importance: "high",
        sound: true,
        vibration: true,
        lights: true,
      },
      {
        id: NotificationCategory.REMINDER,
        name: "Workout Reminders",
        description: "Daily check-in and workout reminders",
        importance: "default",
        sound: true,
        vibration: true,
        lights: false,
      },
      {
        id: NotificationCategory.SOCIAL,
        name: "Social Activity",
        description: "Likes, comments, and social interactions",
        importance: "low",
        sound: false,
        vibration: false,
        lights: false,
      },
      {
        id: NotificationCategory.ACHIEVEMENT,
        name: "Achievements",
        description: "Goal completions and milestone celebrations",
        importance: "default",
        sound: true,
        vibration: true,
        lights: true,
      },
      {
        id: NotificationCategory.REENGAGEMENT,
        name: "Re-engagement",
        description: "Motivational messages to bring you back",
        importance: "low",
        sound: false,
        vibration: false,
        lights: false,
      },
    ];
  }

  public async initializeNotifications(): Promise<void> {
    try {
      // Set up notification channels for Android
      if (Platform.OS === "android") {
        await this.setupAndroidChannels();
      }

      // Set up notification listeners
      this.setupNotificationListeners();

      // Check current permission status
      const { status } = await Notifications.getPermissionsAsync();
      this.permissionStatus = status as PermissionStatus;

      // Register for push notifications if permissions are granted
      if (this.permissionStatus === "granted") {
        await this.registerForPushNotifications();
      }

      console.log("Notification service initialized successfully");
    } catch (error) {
      console.error("Failed to initialize notifications:", error);
    }
  }

  private async setupAndroidChannels(): Promise<void> {
    for (const channel of this.notificationChannels) {
      await Notifications.setNotificationChannelAsync(channel.id, {
        name: channel.name,
        description: channel.description,
        importance:
          Notifications.AndroidImportance[
            channel.importance.toUpperCase() as keyof typeof Notifications.AndroidImportance
          ],
        sound: channel.sound ? "default" : undefined,
        vibrationPattern: channel.vibration ? [0, 250, 250, 250] : undefined,
        lightColor: channel.lights ? "#2563EB" : undefined,
      });
    }
  }

  private setupNotificationListeners(): void {
    // Handle notifications received while app is in foreground
    Notifications.addNotificationReceivedListener(
      this.handleNotificationReceived
    );

    // Handle notification taps
    Notifications.addNotificationResponseReceivedListener(
      this.handleNotificationResponse
    );
  }

  private handleNotificationReceived = (
    notification: Notifications.Notification
  ) => {
    console.log("Notification received:", notification);

    // Track notification received event
    // TODO: Add PostHog tracking
    // posthog.capture('notification_received', {
    //   type: notification.request.content.data?.type,
    //   category: notification.request.content.categoryIdentifier,
    // });
  };

  private handleNotificationResponse = (
    response: Notifications.NotificationResponse
  ) => {
    console.log("Notification tapped:", response);

    const data = response.notification.request.content
      .data as unknown as NotificationData;

    // Track notification tap event
    // TODO: Add PostHog tracking
    // posthog.capture('notification_tapped', {
    //   type: data.type,
    //   category: response.notification.request.content.categoryIdentifier,
    // });

    // Handle deep linking based on notification type
    this.handleDeepLink(data);
  };

  private handleDeepLink(data: NotificationData): void {
    // TODO: Implement deep linking logic
    // This will be handled by the navigation system
    console.log("Deep link data:", data);
  }

  public async requestPermissionsWithSoftPrompt(): Promise<PermissionStatus> {
    try {
      // Check if we should show soft prompt
      const hasShownSoftPrompt = await storageUtil.getItem(
        STORAGE_KEYS.NOTIFICATION_SOFT_PROMPT_SHOWN
      );

      if (!hasShownSoftPrompt) {
        // Store that we've shown the soft prompt
        await storageUtil.setItem(
          STORAGE_KEYS.NOTIFICATION_SOFT_PROMPT_SHOWN,
          "true"
        );

        // Return a special status to indicate we should show soft prompt
        return "undetermined";
      }

      // Request permissions directly
      return await this.requestPermissions();
    } catch (error) {
      console.error("Failed to request permissions:", error);
      return "denied";
    }
  }

  public async requestPermissions(): Promise<PermissionStatus> {
    try {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
        finalStatus = status;
      }

      this.permissionStatus = finalStatus as PermissionStatus;

      if (finalStatus === "granted") {
        await this.registerForPushNotifications();

        // Track permission granted
        // TODO: Add PostHog tracking
        posthog.capture("notification_permission_granted");
      } else {
        // Track permission denied
        // TODO: Add PostHog tracking
        posthog.capture("notification_permission_denied");
      }

      return finalStatus as PermissionStatus;
    } catch (error) {
      console.error("Failed to request permissions:", error);
      return "denied";
    }
  }

  public async registerForPushNotifications(): Promise<string | null> {
    try {
      if (!Device.isDevice) {
        console.log("Must use physical device for push notifications");
        return null;
      }

      const token = (
        await Notifications.getExpoPushTokenAsync({
          projectId: Constants.expoConfig?.extra?.eas?.projectId,
        })
      ).data;

      this.fcmToken = token;

      // Send token to backend in background (fire-and-forget)
      this.sendTokenToBackend(token).catch((error) => {
        console.error("Background token registration failed:", error);
      });

      return token;
    } catch (error) {
      console.error("Failed to register for push notifications:", error);
      return null;
    }
  }

  private async sendTokenToBackend(token: string): Promise<void> {
    try {
      const deviceInfo: DeviceTokenInfo = {
        fcmToken: token,
        deviceType: Platform.OS as "ios" | "android",
        deviceId: await this.getDeviceId(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        appVersion: Constants.expoConfig?.version || "1.0.0",
        osVersion: Platform.Version.toString(),
      };

      // Register device with backend
      await notificationApi.registerDevice(deviceInfo);

      console.log("Device token registered:", deviceInfo);
    } catch (error) {
      console.error("Failed to send token to backend:", error);
    }
  }

  private async getDeviceId(): Promise<string> {
    // Use a combination of device info to create a unique device ID
    const deviceName = Device.deviceName || "unknown";
    const osVersion = Platform.Version.toString();
    return `${deviceName}-${osVersion}-${Date.now()}`;
  }

  public async scheduleLocalNotification(
    notification: ScheduledNotification
  ): Promise<string | null> {
    try {
      if (this.permissionStatus !== "granted") {
        console.log("Cannot schedule notification: permissions not granted");
        return null;
      }

      // Check if this notification type is enabled for the user
      const isEnabled = await this.isNotificationTypeEnabled(
        notification.data.type
      );
      if (!isEnabled) {
        console.log(
          `Notification type ${notification.data.type} is disabled for user`
        );
        return null;
      }

      // Prepare content - only include badge if it's defined
      const content: Notifications.NotificationContentInput = {
        title: notification.title,
        body: notification.body,
        data: notification.data,
        sound: "default", // Always play sound
        categoryIdentifier: notification.category,
      };

      // Only add badge if it's defined and not null
      if (
        notification.data.badge !== undefined &&
        notification.data.badge !== null
      ) {
        content.badge = notification.data.badge;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content,
        trigger: notification.trigger,
      });

      console.log("Notification scheduled:", notificationId);

      // Track notification scheduled
      // TODO: Add PostHog tracking
      posthog.capture("local_notification_scheduled", {
        type: notification.data.type,
        category: notification.category,
      });

      return notificationId;
    } catch (error) {
      console.error("Failed to schedule notification:", error);
      return null;
    }
  }

  public async cancelScheduledNotification(
    notificationId: string
  ): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log("Notification cancelled:", notificationId);
    } catch (error) {
      console.error("Failed to cancel notification:", error);
    }
  }

  public async cancelAllScheduledNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log("All notifications cancelled");
    } catch (error) {
      console.error("Failed to cancel all notifications:", error);
    }
  }

  public async getScheduledNotifications(): Promise<
    Notifications.NotificationRequest[]
  > {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
      console.error("Failed to get scheduled notifications:", error);
      return [];
    }
  }

  public async updateNotificationPreferences(
    preferences: NotificationPreferences
  ): Promise<void> {
    try {
      // Store locally first
      await storageUtil.setItem(
        STORAGE_KEYS.NOTIFICATION_PREFERENCES,
        JSON.stringify(preferences)
      );

      // Sync preferences to backend
      await notificationApi.updateNotificationPreferences(preferences);

      console.log("Notification preferences updated:", preferences);
    } catch (error) {
      console.error("Failed to update notification preferences:", error);
    }
  }

  public async getNotificationPreferences(): Promise<NotificationPreferences> {
    try {
      // Try to get from backend first
      try {
        const response = await notificationApi.getNotificationPreferences();

        // Store locally for offline access (setItem already stringifies)
        if (response.preferences) {
          await storageUtil.setItem(
            STORAGE_KEYS.NOTIFICATION_PREFERENCES,
            response.preferences
          );
        }

        return response.preferences;
      } catch (backendError) {
        console.log(
          "Failed to get preferences from backend, using local storage:",
          backendError
        );

        // Fallback to local storage (getItem already parses JSON)
        const stored = await storageUtil.getItem<NotificationPreferences>(
          STORAGE_KEYS.NOTIFICATION_PREFERENCES
        );
        if (stored && typeof stored === "object") {
          return stored;
        }
      }

      // Return default preferences
      return {
        enabled: true,
        aiMotivation: true,
        reminders: true,
        social: true,
        achievements: true,
        reengagement: true,
        quietHours: {
          enabled: false,
          start: "22:00",
          end: "08:00",
        },
      };
    } catch (error) {
      console.error("Failed to get notification preferences:", error);
      return {
        enabled: true,
        aiMotivation: true,
        reminders: true,
        social: true,
        achievements: true,
        reengagement: true,
        quietHours: {
          enabled: false,
          start: "22:00",
          end: "08:00",
        },
      };
    }
  }

  public getPermissionStatus(): PermissionStatus {
    return this.permissionStatus;
  }

  public getFcmToken(): string | null {
    return this.fcmToken;
  }

  public async isNotificationTypeEnabled(
    notificationType: NotificationCategory
  ): Promise<boolean> {
    try {
      const preferences = await this.getNotificationPreferences();

      // Check if notifications are globally enabled
      if (!preferences.enabled) {
        return false;
      }

      // Check specific notification type
      switch (notificationType) {
        case NotificationCategory.AI_MOTIVATION:
          return preferences.aiMotivation;
        case NotificationCategory.REMINDER:
          return preferences.reminders;
        case NotificationCategory.SOCIAL:
          return preferences.social;
        case NotificationCategory.ACHIEVEMENT:
          return preferences.achievements;
        case NotificationCategory.REENGAGEMENT:
          return preferences.reengagement;
        default:
          return false;
      }
    } catch (error) {
      console.error("Failed to check notification type enabled:", error);
      return false;
    }
  }

  public async clearAllData(): Promise<void> {
    try {
      await this.cancelAllScheduledNotifications();
      await storageUtil.removeItem(STORAGE_KEYS.NOTIFICATION_PREFERENCES);
      await storageUtil.removeItem(STORAGE_KEYS.NOTIFICATION_SOFT_PROMPT_SHOWN);

      // Unregister device from backend
      if (this.fcmToken) {
        try {
          await notificationApi.unregisterDevice(this.fcmToken);
        } catch (error) {
          console.error("Failed to unregister device from backend:", error);
        }
      }

      this.fcmToken = null;
      this.permissionStatus = "undetermined";

      console.log("Notification data cleared");
    } catch (error) {
      console.error("Failed to clear notification data:", error);
    }
  }
}

export const notificationService = NotificationService.getInstance();
