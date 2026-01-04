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
  NotificationChannel
} from "./notificationTypes";
import { storageUtil } from "@/utils/storageUtil";
import { STORAGE_KEYS } from "@/utils/storageUtil";
import posthog from "@/lib/posthog";
import { notificationsService } from "@/services/api/notifications";
import { handleDeepLink as routeDeepLink } from "@/utils/deepLinkHandler";
import { queryClient } from "@/lib/queryClient";
import {
  actionablePlansQueryKeys,
  goalsQueryKeys,
  challengesQueryKeys
} from "@/hooks/api/queryKeys";

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true
  })
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
      // Core notification channels
      {
        id: NotificationCategory.AI_MOTIVATION,
        name: "AI Motivation",
        description: "Personalized AI motivation calls and messages",
        importance: "high",
        sound: true,
        vibration: true,
        lights: true
      },
      {
        id: NotificationCategory.REMINDER,
        name: "Workout Reminders",
        description: "Daily check-in and workout reminders",
        importance: "default",
        sound: true,
        vibration: true,
        lights: false
      },
      {
        id: NotificationCategory.SOCIAL,
        name: "Social Activity",
        description: "Likes, comments, and social interactions",
        importance: "low",
        sound: false,
        vibration: false,
        lights: false
      },
      {
        id: NotificationCategory.ACHIEVEMENT,
        name: "Achievements",
        description: "Goal completions and milestone celebrations",
        importance: "default",
        sound: true,
        vibration: true,
        lights: true
      },
      {
        id: NotificationCategory.REENGAGEMENT,
        name: "Re-engagement",
        description: "Motivational messages to bring you back",
        importance: "low",
        sound: false,
        vibration: false,
        lights: false
      },
      {
        id: NotificationCategory.PLAN_READY,
        name: "Plan Ready",
        description: "Notifications when your AI-generated plan is ready",
        importance: "high",
        sound: true,
        vibration: true,
        lights: true
      },
      {
        id: NotificationCategory.SUBSCRIPTION,
        name: "Subscription",
        description: "Subscription status updates and billing notifications",
        importance: "default",
        sound: true,
        vibration: false,
        lights: false
      },
      {
        id: NotificationCategory.GENERAL,
        name: "General",
        description: "General app notifications",
        importance: "default",
        sound: true,
        vibration: false,
        lights: false
      },

      // Partner notifications
      {
        id: NotificationCategory.PARTNER_REQUEST,
        name: "Partner Requests",
        description: "New accountability partner requests",
        importance: "high",
        sound: true,
        vibration: true,
        lights: true
      },
      {
        id: NotificationCategory.PARTNER_ACCEPTED,
        name: "Partner Accepted",
        description: "When someone accepts your partner request",
        importance: "default",
        sound: true,
        vibration: true,
        lights: false
      },
      {
        id: NotificationCategory.PARTNER_NUDGE,
        name: "Partner Nudges",
        description: "Nudges from your accountability partners",
        importance: "default",
        sound: true,
        vibration: true,
        lights: false
      },
      {
        id: NotificationCategory.PARTNER_CHEER,
        name: "Partner Cheers",
        description: "Cheers and encouragement from partners",
        importance: "low",
        sound: false,
        vibration: false,
        lights: false
      },
      {
        id: NotificationCategory.PARTNER_MILESTONE,
        name: "Partner Milestones",
        description: "When your partner reaches a milestone",
        importance: "low",
        sound: false,
        vibration: false,
        lights: false
      },
      {
        id: NotificationCategory.PARTNER_INACTIVE,
        name: "Partner Inactive",
        description: "When your partner has been inactive",
        importance: "low",
        sound: false,
        vibration: false,
        lights: false
      },

      // Challenge notifications
      {
        id: NotificationCategory.CHALLENGE,
        name: "Challenges",
        description: "General challenge notifications",
        importance: "default",
        sound: true,
        vibration: true,
        lights: false
      },
      {
        id: NotificationCategory.CHALLENGE_INVITE,
        name: "Challenge Invites",
        description: "Invitations to join challenges",
        importance: "high",
        sound: true,
        vibration: true,
        lights: true
      },
      {
        id: NotificationCategory.CHALLENGE_JOINED,
        name: "Challenge Joined",
        description: "When someone joins your challenge",
        importance: "default",
        sound: true,
        vibration: false,
        lights: false
      },
      {
        id: NotificationCategory.CHALLENGE_OVERTAKEN,
        name: "Challenge Overtaken",
        description: "When someone passes you on the leaderboard",
        importance: "default",
        sound: true,
        vibration: true,
        lights: false
      },
      {
        id: NotificationCategory.CHALLENGE_LEAD,
        name: "Challenge Lead",
        description: "When you take the lead in a challenge",
        importance: "default",
        sound: true,
        vibration: true,
        lights: true
      },
      {
        id: NotificationCategory.CHALLENGE_NUDGE,
        name: "Challenge Nudges",
        description: "Nudges from challenge participants",
        importance: "default",
        sound: true,
        vibration: true,
        lights: false
      },
      {
        id: NotificationCategory.CHALLENGE_STARTING,
        name: "Challenge Starting",
        description: "Reminders when a challenge is about to start",
        importance: "high",
        sound: true,
        vibration: true,
        lights: true
      },
      {
        id: NotificationCategory.CHALLENGE_ENDING,
        name: "Challenge Ending",
        description: "Reminders when a challenge is about to end",
        importance: "default",
        sound: true,
        vibration: true,
        lights: false
      },
      {
        id: NotificationCategory.CHALLENGE_ENDED,
        name: "Challenge Ended",
        description: "Notifications when a challenge has ended",
        importance: "default",
        sound: true,
        vibration: false,
        lights: false
      },

      // Other notifications
      {
        id: NotificationCategory.MOTIVATION_MESSAGE,
        name: "Motivation Messages",
        description: "Motivational messages and tips",
        importance: "low",
        sound: false,
        vibration: false,
        lights: false
      },
      {
        id: NotificationCategory.WEEKLY_RECAP,
        name: "Weekly Recap",
        description: "Your weekly progress summary",
        importance: "default",
        sound: true,
        vibration: false,
        lights: false
      },
      {
        id: NotificationCategory.STREAK_MILESTONE,
        name: "Streak Milestones",
        description: "Celebrations for streak achievements",
        importance: "default",
        sound: true,
        vibration: true,
        lights: true
      },
      {
        id: NotificationCategory.GOAL_COMPLETE,
        name: "Goal Complete",
        description: "Notifications when you complete a goal",
        importance: "high",
        sound: true,
        vibration: true,
        lights: true
      }
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
        lightColor: channel.lights ? "#2563EB" : undefined
      });
    }
  }

  private setupNotificationListeners(): void {
    // Handle notifications received while app is in foreground
    Notifications.addNotificationReceivedListener(this.handleNotificationReceived);

    // Handle notification taps
    Notifications.addNotificationResponseReceivedListener(this.handleNotificationResponse);
  }

  private handleNotificationReceived = (notification: Notifications.Notification) => {
    const data = notification.request.content.data as unknown as NotificationData;

    // 🔥 For plan_ready notifications received in foreground, invalidate queries
    // This updates the UI immediately if user is viewing the goal/challenge
    if (data?.type === NotificationCategory.PLAN_READY) {
      this.invalidatePlanQueries(data);
    }

    // Track notification received event
    // TODO: Add PostHog tracking
    // posthog.capture('notification_received', {
    //   type: notification.request.content.data?.type,
    //   category: notification.request.content.categoryIdentifier,
    // });
  };

  private handleNotificationResponse = (response: Notifications.NotificationResponse) => {
    console.log("Notification tapped:", response);

    const data = response.notification.request.content.data as unknown as NotificationData;

    // Track notification tap event
    // TODO: Add PostHog tracking
    // posthog.capture('notification_tapped', {
    //   type: data.type,
    //   category: response.notification.request.content.categoryIdentifier,
    // });

    // Handle deep linking based on notification type
    this.handleDeepLink(data);
  };

  /**
   * Update plan status immediately when a plan_ready notification is received.
   * Uses OPTIMISTIC updates for instant UI feedback, then invalidates for fresh data.
   */
  private invalidatePlanQueries(data: NotificationData): void {
    const goalId = data.goalId as string | undefined;
    const challengeId = data.challengeId as string | undefined;

    if (goalId) {
      // 🆕 OPTIMISTICALLY set status to "completed" immediately
      // The notification tells us plan is ready, so we update the cache instantly
      // This provides instant UI feedback without waiting for network
      queryClient.setQueryData(actionablePlansQueryKeys.planStatus(goalId), (old: any) => ({
        ...(old || {}),
        status: "completed" as const,
        goal_id: goalId
      }));

      // Also invalidate to get full fresh data in background (with plan details)
      queryClient.invalidateQueries({
        queryKey: actionablePlansQueryKeys.plan(goalId)
      });
      queryClient.invalidateQueries({
        queryKey: goalsQueryKeys.detail(goalId)
      });
      queryClient.invalidateQueries({
        queryKey: goalsQueryKeys.active()
      });
      console.log("📲 Set goal plan status to completed for:", goalId);
    }

    if (challengeId) {
      // 🆕 OPTIMISTICALLY set status to "completed" immediately
      queryClient.setQueryData(
        actionablePlansQueryKeys.challengePlanStatus(challengeId),
        (old: any) => ({
          ...(old || {}),
          status: "completed" as const,
          challenge_id: challengeId
        })
      );

      // Also invalidate to get full fresh data in background
      queryClient.invalidateQueries({
        queryKey: actionablePlansQueryKeys.challengePlan(challengeId)
      });
      queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.detail(challengeId)
      });
      console.log("📲 Set challenge plan status to completed for:", challengeId);
    }
  }

  private handleDeepLink(data: NotificationData): void {
    console.log("📲 Handling notification deep link:", data);

    // 🔥 For plan_ready notifications, invalidate queries BEFORE navigation
    // This ensures fresh data is fetched when the screen loads
    if (data.type === NotificationCategory.PLAN_READY) {
      this.invalidatePlanQueries(data);
    }

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
  }

  public async requestPermissionsWithSoftPrompt(): Promise<PermissionStatus> {
    try {
      // Check if we should show soft prompt
      const hasShownSoftPrompt = await storageUtil.getItem(
        STORAGE_KEYS.NOTIFICATION_SOFT_PROMPT_SHOWN
      );

      if (!hasShownSoftPrompt) {
        // Store that we've shown the soft prompt
        await storageUtil.setItem(STORAGE_KEYS.NOTIFICATION_SOFT_PROMPT_SHOWN, "true");

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
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true
          }
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
          projectId: Constants.expoConfig?.extra?.eas?.projectId
        })
      ).data;

      console.log(`[Notifications] Expo push token: ${token.substring(0, 30)}...`);
      this.fcmToken = token;

      // ALWAYS send token to backend to ensure it's registered and active
      // This handles cases where token was marked inactive or needs updating
      console.log("[Notifications] Registering device with backend...");
      await this.sendTokenToBackend(token);
      console.log("[Notifications] ✅ Device registered successfully");

      return token;
    } catch (error) {
      console.error("[Notifications] Failed to register for push notifications:", error);
      return null;
    }
  }

  private async sendTokenToBackend(token: string): Promise<void> {
    if (!token) {
      console.log("[Notifications] No token to register");
      return;
    }

    // Only register if user is authenticated
    const { isAuthenticated } = (await import("@/stores/authStore")).useAuthStore.getState();

    if (!isAuthenticated) {
      console.log("[Notifications] Skipping device registration: User not authenticated");
      return;
    }

    try {
      const deviceInfo: DeviceTokenInfo = {
        fcmToken: token,
        deviceType: Platform.OS as "ios" | "android",
        deviceId: await this.getDeviceId(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        appVersion: Constants.expoConfig?.version || "1.0.0",
        osVersion: Platform.Version.toString()
      };

      // ALWAYS register - backend will upsert and mark as active
      const response = await notificationsService.registerDevice(deviceInfo);
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
      const isEnabled = await this.isNotificationTypeEnabled(notification.data.type);
      if (!isEnabled) {
        console.log(`Notification type ${notification.data.type} is disabled for user`);
        return null;
      }

      // Prepare content - only include badge if it's defined
      const content: Notifications.NotificationContentInput = {
        title: notification.title,
        body: notification.body,
        data: notification.data,
        sound: "default", // Always play sound
        categoryIdentifier: notification.category
      };

      // Only add badge if it's defined and not null
      if (notification.data.badge !== undefined && notification.data.badge !== null) {
        content.badge = notification.data.badge;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content,
        trigger: notification.trigger
      });

      console.log("Notification scheduled:", notificationId);

      // Track notification scheduled
      // TODO: Add PostHog tracking
      posthog.capture("local_notification_scheduled", {
        type: notification.data.type,
        category: notification.category
      });

      return notificationId;
    } catch (error) {
      console.error("Failed to schedule notification:", error);
      return null;
    }
  }

  public async cancelScheduledNotification(notificationId: string): Promise<void> {
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

  public async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
      console.error("Failed to get scheduled notifications:", error);
      return [];
    }
  }

  public async updateNotificationPreferences(preferences: NotificationPreferences): Promise<void> {
    try {
      // Store locally first
      await storageUtil.setItem(STORAGE_KEYS.NOTIFICATION_PREFERENCES, JSON.stringify(preferences));

      // Sync preferences to backend
      await notificationsService.updatePreferences(preferences);

      console.log("Notification preferences updated:", preferences);
    } catch (error) {
      console.error("Failed to update notification preferences:", error);
    }
  }

  public async getNotificationPreferences(): Promise<NotificationPreferences> {
    try {
      // Try to get from backend first
      try {
        const response = await notificationsService.getPreferences();
        if (response.error || !response.data) {
          throw new Error(response.message || "Failed to get preferences");
        }
        const data = response.data;

        // Backend now returns the flat structure matching NotificationPreferences
        const preferences: NotificationPreferences = {
          enabled: data.enabled,
          push_notifications: data.push_notifications,
          email_notifications: data.email_notifications,
          ai_motivation: data.ai_motivation,
          reminders: data.reminders,
          social: data.social,
          achievements: data.achievements,
          reengagement: data.reengagement,
          quiet_hours_enabled: data.quiet_hours_enabled,
          quiet_hours_start: data.quiet_hours_start,
          quiet_hours_end: data.quiet_hours_end,
          social_partner_requests: data.social_partner_requests,
          social_partner_nudges: data.social_partner_nudges,
          social_partner_cheers: data.social_partner_cheers,
          social_partner_milestones: data.social_partner_milestones,
          social_challenge_invites: data.social_challenge_invites,
          social_challenge_leaderboard: data.social_challenge_leaderboard,
          social_challenge_nudges: data.social_challenge_nudges,
          social_challenge_reminders: data.social_challenge_reminders,
          social_motivation_messages: data.social_motivation_messages
        };

        // Store locally for offline access
        await storageUtil.setItem(STORAGE_KEYS.NOTIFICATION_PREFERENCES, preferences);

        return preferences;
      } catch (backendError) {
        console.log("Failed to get preferences from backend, using local storage:", backendError);

        // Fallback to local storage (getItem already parses JSON)
        const stored = await storageUtil.getItem<NotificationPreferences>(
          STORAGE_KEYS.NOTIFICATION_PREFERENCES
        );
        if (stored && typeof stored === "object") {
          return stored;
        }
      }

      // Return default preferences
      return this.getDefaultPreferences();
    } catch (error) {
      console.error("Failed to get notification preferences:", error);
      return this.getDefaultPreferences();
    }
  }

  private getDefaultPreferences(): NotificationPreferences {
    return {
      enabled: true,
      push_notifications: true,
      email_notifications: true,
      ai_motivation: true,
      reminders: true,
      social: true,
      achievements: true,
      reengagement: true,
      quiet_hours_enabled: false,
      quiet_hours_start: "22:00",
      quiet_hours_end: "08:00",
      social_partner_requests: true,
      social_partner_nudges: true,
      social_partner_cheers: true,
      social_partner_milestones: true,
      social_challenge_invites: true,
      social_challenge_leaderboard: true,
      social_challenge_nudges: true,
      social_challenge_reminders: true,
      social_motivation_messages: true
    };
  }

  public getPermissionStatus(): PermissionStatus {
    return this.permissionStatus;
  }

  public getFcmToken(): string | null {
    return this.fcmToken;
  }

  public async isNotificationTypeEnabled(notificationType: NotificationCategory): Promise<boolean> {
    try {
      const preferences = await this.getNotificationPreferences();

      // Check if notifications are globally enabled
      if (!preferences.enabled) {
        return false;
      }

      // Check specific notification type
      switch (notificationType) {
        // Core notification types
        case NotificationCategory.AI_MOTIVATION:
        case NotificationCategory.MOTIVATION_MESSAGE:
          return preferences.ai_motivation && preferences.social_motivation_messages;
        case NotificationCategory.REMINDER:
          return preferences.reminders;
        case NotificationCategory.SOCIAL:
          return preferences.social;
        case NotificationCategory.ACHIEVEMENT:
        case NotificationCategory.STREAK_MILESTONE:
        case NotificationCategory.GOAL_COMPLETE:
          return preferences.achievements;
        case NotificationCategory.REENGAGEMENT:
          return preferences.reengagement;

        // Always-enabled types
        case NotificationCategory.PLAN_READY:
        case NotificationCategory.SUBSCRIPTION:
        case NotificationCategory.GENERAL:
        case NotificationCategory.WEEKLY_RECAP:
          return true;

        // Partner notifications - check social + specific partner prefs
        case NotificationCategory.PARTNER_REQUEST:
        case NotificationCategory.PARTNER_ACCEPTED:
          return preferences.social && preferences.social_partner_requests;
        case NotificationCategory.PARTNER_NUDGE:
          return preferences.social && preferences.social_partner_nudges;
        case NotificationCategory.PARTNER_CHEER:
          return preferences.social && preferences.social_partner_cheers;
        case NotificationCategory.PARTNER_MILESTONE:
        case NotificationCategory.PARTNER_INACTIVE:
          return preferences.social && preferences.social_partner_milestones;

        // Challenge notifications - check social + specific challenge prefs
        case NotificationCategory.CHALLENGE:
        case NotificationCategory.CHALLENGE_STARTING:
        case NotificationCategory.CHALLENGE_ENDING:
        case NotificationCategory.CHALLENGE_ENDED:
          return preferences.social && preferences.social_challenge_reminders;
        case NotificationCategory.CHALLENGE_INVITE:
        case NotificationCategory.CHALLENGE_JOINED:
          return preferences.social && preferences.social_challenge_invites;
        case NotificationCategory.CHALLENGE_OVERTAKEN:
        case NotificationCategory.CHALLENGE_LEAD:
          return preferences.social && preferences.social_challenge_leaderboard;
        case NotificationCategory.CHALLENGE_NUDGE:
          return preferences.social && preferences.social_challenge_nudges;

        default:
          return true; // Default to enabled for unknown types
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
          await notificationsService.unregisterDevice(this.fcmToken);
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
          await notificationsService.unregisterDevice(this.fcmToken);
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
