/**
 * Notifications Service
 *
 * Handles notification history and preferences API calls
 */

import { BaseApiService, ApiResponse } from "./base";
import { ROUTES } from "@/lib/routes";
import {
  DeviceTokenInfo,
  NotificationPreferences,
} from "../notifications/notificationTypes";

export type NotificationType =
  | "reminder"
  | "ai_motivation"
  | "subscription"
  | "reengagement"
  | "achievement"
  | "social"
  | "nudge"
  | "general"
  | "partner_request"
  | "partner_accepted"
  | "partner_nudge"
  | "partner_cheer"
  | "partner_milestone"
  | "partner_inactive"
  | "challenge"
  | "challenge_invite"
  | "challenge_joined"
  | "challenge_overtaken"
  | "challenge_lead"
  | "challenge_nudge"
  | "challenge_starting"
  | "challenge_ending"
  | "challenge_ended"
  | "plan_ready"
  | "motivation_message"
  | "weekly_recap"
  | "streak_milestone"
  | "goal_complete";

export interface RegisterDeviceResponse {
  success: boolean;
  device_id: string;
}

export interface RegisterDeviceRequest {
  fcm_token: string;
  device_type: "ios" | "android";
  device_id: string;
  timezone: string;
  app_version: string;
  os_version: string;
}

export interface NotificationHistoryItem {
  id: string;
  notification_type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any> | null;
  sent_at: string;
  delivered_at?: string | null;
  opened_at?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  created_at: string;
}

class NotificationsService extends BaseApiService {
  /**
   * Get notification history with pagination
   */
  async getHistory(
    limit: number = 20,
    offset: number = 0,
    notificationType?: string,
  ): Promise<ApiResponse<NotificationHistoryItem[]>> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());
    if (notificationType) {
      params.append("notification_type", notificationType);
    }

    return this.get<NotificationHistoryItem[]>(
      `${ROUTES.NOTIFICATIONS.HISTORY}?${params.toString()}`,
    );
  }

  /**
   * Mark a notification as opened
   */
  async markOpened(
    notificationId: string,
  ): Promise<ApiResponse<{ success: boolean }>> {
    return this.post<{ success: boolean }>(
      `${ROUTES.NOTIFICATIONS.HISTORY}/${notificationId}/opened`,
    );
  }

  /**
   * Get notification preferences
   */
  async getPreferences(): Promise<ApiResponse<NotificationPreferences>> {
    return this.get<NotificationPreferences>(ROUTES.NOTIFICATIONS.PREFERENCES);
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(
    preferences: Partial<NotificationPreferences>,
  ): Promise<ApiResponse<NotificationPreferences>> {
    return this.put<NotificationPreferences>(
      ROUTES.NOTIFICATIONS.PREFERENCES,
      preferences,
    );
  }

  /**
   * Register device for push notifications
   */
  async registerDevice(
    deviceInfo: DeviceTokenInfo,
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
   * Unregister device from push notifications
   */
  async unregisterDevice(
    fcmToken: string,
  ): Promise<ApiResponse<{ success: boolean }>> {
    return this.delete<{ success: boolean }>(
      `${ROUTES.NOTIFICATIONS.UNREGISTER_DEVICE}?fcm_token=${encodeURIComponent(fcmToken)}`,
    );
  }
}

export const notificationsService = new NotificationsService();
