import * as Notifications from "expo-notifications";

export enum NotificationCategory {
  // Core notification types
  AI_MOTIVATION = "ai_motivation",
  REMINDER = "reminder",
  SOCIAL = "social",
  ACHIEVEMENT = "achievement",
  REENGAGEMENT = "reengagement",
  PLAN_READY = "plan_ready",
  SUBSCRIPTION = "subscription",
  GENERAL = "general",

  // Partner notifications
  PARTNER_REQUEST = "partner_request",
  PARTNER_ACCEPTED = "partner_accepted",
  PARTNER_NUDGE = "partner_nudge",
  PARTNER_CHEER = "partner_cheer",
  PARTNER_MILESTONE = "partner_milestone",
  PARTNER_INACTIVE = "partner_inactive",

  // Challenge notifications
  CHALLENGE = "challenge",
  CHALLENGE_INVITE = "challenge_invite",
  CHALLENGE_JOINED = "challenge_joined",
  CHALLENGE_OVERTAKEN = "challenge_overtaken",
  CHALLENGE_LEAD = "challenge_lead",
  CHALLENGE_NUDGE = "challenge_nudge",
  CHALLENGE_STARTING = "challenge_starting",
  CHALLENGE_ENDING = "challenge_ending",
  CHALLENGE_ENDED = "challenge_ended",

  // Other notifications
  MOTIVATION_MESSAGE = "motivation_message",
  WEEKLY_RECAP = "weekly_recap",
  STREAK_MILESTONE = "streak_milestone",
  GOAL_COMPLETE = "goal_complete",
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
  // Global settings
  enabled: boolean;
  push_notifications: boolean;
  email_notifications: boolean;

  // Core notification types
  ai_motivation: boolean;
  reminders: boolean;
  social: boolean;
  achievements: boolean;
  reengagement: boolean;

  // Quiet hours
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;

  // Social - Partner notifications
  social_partner_requests: boolean;
  social_partner_nudges: boolean;
  social_partner_cheers: boolean;
  social_partner_milestones: boolean;

  // Social - Challenge notifications
  social_challenge_invites: boolean;
  social_challenge_leaderboard: boolean;
  social_challenge_nudges: boolean;
  social_challenge_reminders: boolean;

  // AI/Motivation messages
  social_motivation_messages: boolean;
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
