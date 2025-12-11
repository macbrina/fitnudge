import { BaseApiService } from "./base";
import { ROUTES } from "@/lib/routes";
import {
  DeviceTokenInfo,
  NotificationPreferences,
} from "../notifications/notificationTypes";

export interface RegisterDeviceRequest {
  fcm_token: string;
  device_type: "ios" | "android";
  device_id: string;
  timezone: string;
  app_version: string;
  os_version: string;
}

export interface RegisterDeviceResponse {
  success: boolean;
  device_id: string;
}

export interface NotificationPreferencesResponse {
  enabled: boolean;
  push_notifications: boolean;
  email_notifications: boolean;
  ai_motivation: boolean;
  reminders: boolean;
  social: boolean;
  achievements: boolean;
  reengagement: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

export interface ScheduledNotificationsResponse {
  notifications: Array<{
    id: string;
    title: string;
    body: string;
    scheduled_for: string;
    category: string;
  }>;
}

class NotificationApiService extends BaseApiService {
  /**
   * Register device for push notifications
   */
  async registerDevice(
    deviceInfo: DeviceTokenInfo
  ): Promise<RegisterDeviceResponse> {
    const response = await this.post(ROUTES.NOTIFICATIONS.REGISTER_DEVICE, {
      fcm_token: deviceInfo.fcmToken,
      device_type: deviceInfo.deviceType,
      device_id: deviceInfo.deviceId,
      timezone: deviceInfo.timezone,
      app_version: deviceInfo.appVersion,
      os_version: deviceInfo.osVersion,
    });

    return response.data as RegisterDeviceResponse;
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(
    preferences: NotificationPreferences
  ): Promise<NotificationPreferencesResponse> {
    const response = await this.put(ROUTES.NOTIFICATIONS.PREFERENCES, {
      preferences,
    });

    return response.data as NotificationPreferencesResponse;
  }

  /**
   * Get notification preferences
   */
  async getNotificationPreferences(): Promise<NotificationPreferencesResponse> {
    const response = await this.get(ROUTES.NOTIFICATIONS.PREFERENCES);
    return response.data as NotificationPreferencesResponse;
  }

  /**
   * Get scheduled notifications from backend
   */
  async getScheduledNotifications(): Promise<ScheduledNotificationsResponse> {
    const response = await this.get(ROUTES.NOTIFICATIONS.HISTORY);
    return response.data as ScheduledNotificationsResponse;
  }

  /**
   * Unregister device from push notifications
   */
  async unregisterDevice(fcmToken: string): Promise<{ success: boolean }> {
    const response = await this.delete(
      `${ROUTES.NOTIFICATIONS.UNREGISTER_DEVICE}?fcm_token=${encodeURIComponent(
        fcmToken
      )}`
    );

    return response.data as { success: boolean };
  }

  /**
   * Test notification (for development)
   */
  async sendTestNotification(
    type:
      | "ai_motivation"
      | "reminder"
      | "achievement"
      | "social"
      | "reengagement",
    data?: Record<string, any>
  ): Promise<{ success: boolean; message_id: string }> {
    const response = await this.post(ROUTES.NOTIFICATIONS.TEST, {
      type,
      data,
    });

    return response.data as { success: boolean; message_id: string };
  }

  /**
   * Get notification analytics
   */
  async getNotificationAnalytics(): Promise<{
    total_sent: number;
    total_opened: number;
    open_rate: number;
    by_category: Record<string, { sent: number; opened: number; rate: number }>;
  }> {
    const response = await this.get(ROUTES.NOTIFICATIONS.ANALYTICS);
    return response.data as {
      total_sent: number;
      total_opened: number;
      open_rate: number;
      by_category: Record<
        string,
        { sent: number; opened: number; rate: number }
      >;
    };
  }
}

export const notificationApi = new NotificationApiService();
