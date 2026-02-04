/**
 * Notifications Service
 *
 * Handles notification history and preferences API calls
 */

import { BaseApiService, ApiResponse } from "./base";
import { ROUTES } from "@/lib/routes";
import { DeviceTokenInfo, NotificationPreferences } from "../notifications/notificationTypes";

/**
 * V2 Notification Types
 *
 * Core Types:
 * - reminder: Check-in prompts and follow-ups
 * - ai_motivation: AI-generated motivation messages
 * - subscription: Subscription-related notifications (always sent)
 * - reengagement: User reengagement notifications
 * - achievement: Achievement unlock notifications
 * - streak_milestone: Streak milestone celebrations (7, 14, 21, 30, 50, 100 days)
 * - weekly_recap: Weekly recap summaries
 * - adaptive_nudge: V2 adaptive nudging (crushing it, pattern suggestions, etc.)
 * - general: Fallback for generic notifications
 *
 * Social/Partner Types:
 * - partner_request: Partner request received
 * - partner_accepted: Partner request accepted
 * - partner_nudge: Nudge from partner
 * - partner_cheer: Cheer from partner
 * - partner_milestone: Partner achieved a milestone
 * - partner_inactive: Check on inactive partner
 */
export type NotificationType =
  // Core notification types
  | "reminder"
  | "ai_motivation"
  | "subscription"
  | "reengagement"
  | "achievement"
  | "streak_milestone"
  | "weekly_recap"
  | "adaptive_nudge"
  | "general"
  // Partner/Social notification types
  | "partner_request"
  | "partner_accepted"
  | "partner_nudge"
  | "partner_cheer"
  | "partner_milestone"
  | "partner_inactive";

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
  dismissed_at?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  created_at: string;
}

/** Admin broadcast and general modal notifications (in-app modal) */
export interface Broadcast {
  id: string;
  title: string;
  body: string;
  image_url?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  deeplink?: string | null;
  /** When false, hide image section (e.g. user_report). Default true. */
  showImage?: boolean;
}

class NotificationsService extends BaseApiService {
  /**
   * Get notification history with pagination
   */
  async getHistory(
    limit: number = 20,
    offset: number = 0,
    notificationType?: string
  ): Promise<ApiResponse<NotificationHistoryItem[]>> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());
    if (notificationType) {
      params.append("notification_type", notificationType);
    }

    return this.get<NotificationHistoryItem[]>(
      `${ROUTES.NOTIFICATIONS.HISTORY}?${params.toString()}`
    );
  }

  /**
   * Mark a notification as opened
   */
  async markOpened(notificationId: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.post<{ success: boolean }>(
      `${ROUTES.NOTIFICATIONS.HISTORY}/${notificationId}/opened`
    );
  }

  /**
   * Mark ALL unread notifications as opened (batch operation)
   * Single API call following SCALABILITY.md best practices
   */
  async markAllOpened(): Promise<ApiResponse<{ success: boolean; updated_count: number }>> {
    return this.post<{ success: boolean; updated_count: number }>(
      `${ROUTES.NOTIFICATIONS.HISTORY}/mark-all-opened`
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
    preferences: Partial<NotificationPreferences>
  ): Promise<ApiResponse<NotificationPreferences>> {
    return this.put<NotificationPreferences>(ROUTES.NOTIFICATIONS.PREFERENCES, preferences);
  }

  /**
   * Register device for push notifications
   */
  async registerDevice(deviceInfo: DeviceTokenInfo): Promise<RegisterDeviceResponse> {
    const response = await this.post(ROUTES.NOTIFICATIONS.REGISTER_DEVICE, {
      fcm_token: deviceInfo.fcmToken,
      device_type: deviceInfo.deviceType,
      device_id: deviceInfo.deviceId,
      timezone: deviceInfo.timezone,
      app_version: deviceInfo.appVersion,
      os_version: deviceInfo.osVersion
    });

    return response.data as RegisterDeviceResponse;
  }

  /**
   * Unregister device from push notifications
   */
  async unregisterDevice(fcmToken: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.delete<{ success: boolean }>(
      `${ROUTES.NOTIFICATIONS.UNREGISTER_DEVICE}?fcm_token=${encodeURIComponent(fcmToken)}`
    );
  }

  /**
   * List active admin broadcasts for current user (in-app modal).
   */
  async getActiveBroadcasts(): Promise<ApiResponse<Broadcast[]>> {
    return this.get<Broadcast[]>(ROUTES.NOTIFICATIONS.BROADCASTS_ACTIVE);
  }

  /**
   * Mark broadcast as seen/dismissed (fire-and-forget).
   */
  async markBroadcastSeen(
    broadcastId: string,
    dismissed: boolean = false
  ): Promise<ApiResponse<{ success: boolean }>> {
    return this.post<{ success: boolean }>(ROUTES.NOTIFICATIONS.BROADCAST_MARK_SEEN(broadcastId), {
      dismissed
    });
  }
}

export const notificationsService = new NotificationsService();
