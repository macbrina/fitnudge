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
import { handleDeepLink as routeDeepLink } from "@/utils/deepLinkHandler";

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
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
    // Dynamic import to avoid circular dependency
    const { useAuthStore } = await import("@/stores/authStore");
    const { isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated) {
      return;
    }

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
    console.log("📲 Handling notification deep link:", data);

    // Use the deepLink from notification data if available
    if (data.deepLink) {
      // Convert relative path to full URL for the handler
      const fullUrl = `fitnudge://app${data.deepLink}`;
      routeDeepLink(fullUrl);
      return;
    }

    // Handle url field from notification data (used by push notifications)
    if (data.url) {
      const urlPath = typeof data.url === "string" ? data.url : "";
      if (urlPath) {
        routeDeepLink(`fitnudge://app${urlPath.startsWith("/") ? urlPath : `/${urlPath}`}`);
        return;
      }
    }

    // Fallback: route based on notification type
    switch (data.type) {
      case "reminder":
        if (data.goalId) {
          routeDeepLink(`fitnudge://app/checkin/${data.goalId}`);
        }
        break;
      case "achievement":
        routeDeepLink("fitnudge://app/profile");
        break;
      case "social":
        routeDeepLink("fitnudge://app/notifications");
        break;
      case "plan_ready":
        // Navigate to goal detail screen
        if (data.goalId) {
          routeDeepLink(`fitnudge://app/goal?id=${data.goalId}`);
        }
        break;
      default:
        // No specific route, just open the app
        break;
    }
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

      console.log("[Notifications] Getting Expo push token...");
      const token = (
        await Notifications.getExpoPushTokenAsync({
          projectId: Constants.expoConfig?.extra?.eas?.projectId,
        })
      ).data;

      console.log(
        `[Notifications] Expo push token: ${token.substring(0, 30)}...`
      );
      this.fcmToken = token;

      // ALWAYS send token to backend to ensure it's registered and active
      // This handles cases where token was marked inactive or needs updating
      console.log("[Notifications] Registering device with backend...");
      await this.sendTokenToBackend(token);
      console.log("[Notifications] ✅ Device registered successfully");

      return token;
    } catch (error) {
      console.error(
        "[Notifications] Failed to register for push notifications:",
        error
      );
      return null;
    }
  }

  private async sendTokenToBackend(token: string): Promise<void> {
    if (!token) {
      console.log("[Notifications] No token to register");
      return;
    }

    // Only register if user is authenticated
    const { isAuthenticated } = (
      await import("@/stores/authStore")
    ).useAuthStore.getState();

    if (!isAuthenticated) {
      console.log(
        "[Notifications] Skipping device registration: User not authenticated"
      );
      return;
    }

    try {
      const deviceInfo: DeviceTokenInfo = {
        fcmToken: token,
        deviceType: Platform.OS as "ios" | "android",
        deviceId: await this.getDeviceId(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        appVersion: Constants.expoConfig?.version || "1.0.0",
        osVersion: Platform.Version.toString(),
      };

      // ALWAYS register - backend will upsert and mark as active
      const response = await notificationApi.registerDevice(deviceInfo);
    } catch (error) {
      // Silently handle - not critical if registration fails during logout
      if (__DEV__ && !(error as any)?.message?.includes("Not authenticated")) {
        console.warn("Failed to register device:", error);
      }
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

        // Transform backend response to NotificationPreferences format
        const preferences: NotificationPreferences = {
          enabled: response.enabled,
          aiMotivation: response.ai_motivation,
          reminders: response.reminders,
          social: response.social,
          achievements: response.achievements,
          reengagement: response.reengagement,
          quietHours: {
            enabled: response.quiet_hours_enabled,
            start: response.quiet_hours_start,
            end: response.quiet_hours_end,
          },
        };

        // Store locally for offline access
        await storageUtil.setItem(
          STORAGE_KEYS.NOTIFICATION_PREFERENCES,
          preferences
        );

        return preferences;
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

  /**
   * Unregister device on logout.
   * Does NOT cancel scheduled notifications (they're local and will be reused on re-login).
   * Does NOT clear user preferences (NOTIFICATION_PREFERENCES, NOTIFICATION_SOFT_PROMPT_SHOWN).
   * Device will automatically re-register on next app startup when user logs back in.
   */
  public async clearOnLogout(): Promise<void> {
    // Dynamic import to avoid circular dependency
    const { useAuthStore } = await import("@/stores/authStore");
    const { isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated) {
      return;
    }

    try {
      // Unregister device from backend to prevent push notifications while logged out
      if (this.fcmToken) {
        try {
          await notificationApi.unregisterDevice(this.fcmToken);
        } catch (error) {
          // silently ignore
        }
      }

      // Clear in-memory FCM token
      this.fcmToken = null;

      // Note: DO NOT reset permissionStatus - user still has granted permissions
      // Note: DO NOT cancel scheduled notifications - they're for user's goals and will be reused on re-login
      // Note: DO NOT clear notification preferences - they should persist across sessions
    } catch (error) {
      // silently ignore
    }
  }

  /**
   * Complete notification data wipe for account deletion/disabled/suspended.
   * Cancels ALL scheduled notifications, clears preferences, and unregisters device.
   * This is a complete reset - use only when user account is gone.
   */
  public async clearAllNotificationData(): Promise<void> {
    try {
      // Cancel all scheduled local notifications (user's goals are gone)
      await this.cancelAllScheduledNotifications();

      // Clear notification preferences (fresh start for potential new account)
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

      // Reset all in-memory state
      this.fcmToken = null;
      this.permissionStatus = "undetermined";
    } catch (error) {
      console.error("Failed to clear all notification data:", error);
    }
  }
}

export const notificationService = NotificationService.getInstance();
