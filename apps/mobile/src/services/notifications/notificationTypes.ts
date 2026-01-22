import * as Notifications from "expo-notifications";

/**
 * V2 Notification Categories
 *
 * Core Types:
 * - AI_MOTIVATION: AI-generated motivation messages
 * - REMINDER: Check-in prompts and follow-ups
 * - ACHIEVEMENT: Achievement unlock notifications
 * - REENGAGEMENT: User reengagement notifications
 * - SUBSCRIPTION: Subscription-related notifications
 * - STREAK_MILESTONE: Streak milestone celebrations
 * - WEEKLY_RECAP: Weekly recap summaries
 * - ADAPTIVE_NUDGE: V2 adaptive nudging
 * - GENERAL: Fallback for generic notifications
 *
 * Partner Types:
 * - PARTNER_REQUEST: Partner request received
 * - PARTNER_ACCEPTED: Partner request accepted
 * - PARTNER_NUDGE: Nudge from partner
 * - PARTNER_CHEER: Cheer from partner
 * - PARTNER_MILESTONE: Partner achieved a milestone
 * - PARTNER_INACTIVE: Check on inactive partner
 */
export enum NotificationCategory {
  // Core notification types
  AI_MOTIVATION = "ai_motivation",
  REMINDER = "reminder",
  ACHIEVEMENT = "achievement",
  REENGAGEMENT = "reengagement",
  SUBSCRIPTION = "subscription",
  STREAK_MILESTONE = "streak_milestone",
  WEEKLY_RECAP = "weekly_recap",
  ADAPTIVE_NUDGE = "adaptive_nudge",
  GENERAL = "general",

  // Partner notifications
  PARTNER_REQUEST = "partner_request",
  PARTNER_ACCEPTED = "partner_accepted",
  PARTNER_NUDGE = "partner_nudge",
  PARTNER_CHEER = "partner_cheer",
  PARTNER_MILESTONE = "partner_milestone",
  PARTNER_INACTIVE = "partner_inactive"
}

export interface NotificationData {
  type: NotificationCategory;
  goalId?: string;
  postId?: string;
  userId?: string;
  deepLink?: string;
  title?: string;
  body?: string;
  sound?: boolean;
  badge?: number;
  [key: string]: unknown;
}

/**
 * V2 Notification Preferences
 *
 * Core toggles control main notification categories.
 * Social toggles control partner-specific notifications.
 */
export interface NotificationPreferences {
  // Global settings
  enabled: boolean;
  push_notifications: boolean;
  email_notifications: boolean;

  // Core notification types
  ai_motivation: boolean;
  reminders: boolean;
  achievements: boolean;
  reengagement: boolean;
  weekly_recap: boolean;

  // Quiet hours
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;

  // Partner notifications (single toggle for all partner-related)
  partners: boolean;
}

export interface DeviceTokenInfo {
  fcmToken: string;
  deviceType: "ios" | "android";
  deviceId: string;
  timezone: string;
  appVersion: string;
  osVersion: string;
}

export interface ScheduledNotification {
  id: string;
  title: string;
  body: string;
  data: NotificationData;
  trigger: Notifications.NotificationTriggerInput;
  category: NotificationCategory;
}

export type PermissionStatus = "undetermined" | "denied" | "granted" | "provisional";

export interface NotificationChannel {
  id: string;
  name: string;
  description: string;
  importance: "min" | "low" | "default" | "high" | "max";
  sound: boolean;
  vibration: boolean;
  lights: boolean;
}
