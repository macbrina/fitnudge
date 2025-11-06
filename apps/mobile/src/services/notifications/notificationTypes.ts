import * as Notifications from "expo-notifications";

export enum NotificationCategory {
  AI_MOTIVATION = "ai_motivation",
  REMINDER = "reminder",
  SOCIAL = "social",
  ACHIEVEMENT = "achievement",
  REENGAGEMENT = "reengagement",
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

export interface NotificationPreferences {
  enabled: boolean;
  aiMotivation: boolean;
  reminders: boolean;
  social: boolean;
  achievements: boolean;
  reengagement: boolean;
  quietHours: {
    enabled: boolean;
    start: string; // HH:MM format
    end: string; // HH:MM format
  };
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

export type PermissionStatus =
  | "undetermined"
  | "denied"
  | "granted"
  | "provisional";

export interface NotificationChannel {
  id: string;
  name: string;
  description: string;
  importance: "min" | "low" | "default" | "high" | "max";
  sound: boolean;
  vibration: boolean;
  lights: boolean;
}
