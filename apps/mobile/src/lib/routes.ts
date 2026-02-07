// Centralized route definitions for FitNudge
import Constants from "expo-constants";

export const ROUTES = {
  // Authentication routes
  AUTH: {
    SIGNUP: "/auth/signup",
    LOGIN: "/auth/login",
    LOGOUT: "/auth/logout",
    REFRESH: "/auth/refresh",
    FORGOT_PASSWORD: "/auth/forgot-password",
    RESET_PASSWORD: "/auth/reset-password",
    VALIDATE_RESET_TOKEN: "/auth/reset-password/validate",
    VERIFY_EMAIL: "/auth/verify-email",
    RESEND_VERIFICATION: "/auth/resend-verification",
    OAUTH: {
      APPLE: "/auth/oauth/apple",
      GOOGLE: "/auth/oauth/google"
    },
    LINK: {
      GOOGLE: "/auth/link/google",
      APPLE: "/auth/link/apple"
    },
    UNLINK: (provider: string) => `/auth/unlink/${provider}`,
    SET_PASSWORD: "/auth/set-password"
  },

  // Goals routes (V2 - simplified habits)
  GOALS: {
    BASE: "/goals",
    LIST: "/goals/",
    // Query params for filtering
    ACTIVE: "/goals/?active_only=true",
    ARCHIVED: "/goals/?active_only=false",
    // CRUD
    CREATE: "/goals/",
    GET: (id: string) => `/goals/${id}`,
    UPDATE: (id: string) => `/goals/${id}`,
    DELETE: (id: string) => `/goals/${id}`,
    // Status actions
    ACTIVATE: (id: string) => `/goals/${id}/activate`,
    DEACTIVATE: (id: string) => `/goals/${id}/deactivate`,
    ARCHIVE: (id: string) => `/goals/${id}/archive`,
    COMPLETE: (id: string) => `/goals/${id}/complete`,
    // Stats
    GET_STATS: (id: string) => `/goals/${id}/stats`,
    STATS_SUMMARY: "/goals/stats/summary",
    // Insights (Premium)
    GET_INSIGHTS: (id: string) => `/goals/${id}/insights`,
    REFRESH_INSIGHTS: (id: string) => `/goals/${id}/insights/refresh`
  },

  // Nudges routes (social motivation)
  NUDGES: {
    BASE: "/nudges",
    LIST: "/nudges",
    SENT: "/nudges/sent",
    UNREAD_COUNT: "/nudges/unread-count",
    SEND: "/nudges",
    MARK_READ: (id: string) => `/nudges/${id}/read`,
    MARK_ALL_READ: "/nudges/read-all",
    DELETE: (id: string) => `/nudges/${id}`
  },

  // Accountability Partners routes
  PARTNERS: {
    BASE: "/partners",
    LIST: "/partners",
    LIMITS: "/partners/limits",
    PENDING: "/partners/pending",
    SENT: "/partners/sent",
    BLOCKED: "/partners/blocked",
    REQUEST: "/partners/request",
    ACCEPT: (id: string) => `/partners/${id}/accept`,
    REJECT: (id: string) => `/partners/${id}/reject`,
    CANCEL: (id: string) => `/partners/${id}/cancel`,
    REMOVE: (id: string) => `/partners/${id}`,
    BLOCK: (id: string) => `/partners/${id}/block`,
    UNBLOCK: (id: string) => `/partners/${id}/unblock`,
    REPORT: (userId: string) => `/partners/report/${userId}`,
    SEARCH_USERS: "/partners/search",
    SUGGESTED_USERS: "/partners/suggested",
    DASHBOARD: (partnerUserId: string) => `/partners/${partnerUserId}/dashboard`
  },

  // Motivation routes
  MOTIVATION: {
    GENERATE: "/motivation/generate",
    SCHEDULE: "/motivation/schedule",
    LIST: "/motivation",
    GET: (id: string) => `/motivation/${id}`,
    SEND: (id: string) => `/motivation/${id}/send`,
    DELETE: (id: string) => `/motivation/${id}`
  },

  // Daily Motivations routes
  DAILY_MOTIVATIONS: {
    BASE: "/daily-motivations",
    TODAY: "/daily-motivations/today",
    LIST: "/daily-motivations",
    GET: (id: string) => `/daily-motivations/${id}`,
    SHARE: (id: string) => `/daily-motivations/${id}/share`,
    REGENERATE: "/daily-motivations/regenerate"
  },

  // Weekly Recaps routes
  RECAPS: {
    BASE: "/recaps",
    LIST: "/recaps/list",
    CURRENT: "/recaps/weekly",
    GET: (id: string) => `/recaps/${id}`
  },

  // Social routes
  SOCIAL: {
    FEED: "/social/feed",
    POSTS: {
      CREATE: "/social/posts",
      GET: (id: string) => `/social/posts/${id}`,
      DELETE: (id: string) => `/social/posts/${id}`,
      LIKE: (id: string) => `/social/posts/${id}/like`,
      UNLIKE: (id: string) => `/social/posts/${id}/like`,
      COMMENTS: (id: string) => `/social/posts/${id}/comments`,
      CREATE_COMMENT: (id: string) => `/social/posts/${id}/comments`
    },
    USERS: {
      FOLLOW: (id: string) => `/social/users/${id}/follow`,
      UNFOLLOW: (id: string) => `/social/users/${id}/follow`,
      FOLLOWERS: (id: string) => `/social/users/${id}/followers`,
      FOLLOWING: (id: string) => `/social/users/${id}/following`
    },
    SEARCH: {
      USERS: "/users/search",
      POSTS: "/posts/search"
    },
    TRENDING: {
      POSTS: "/posts/trending",
      HASHTAGS: "/hashtags/trending"
    },
    NOTIFICATIONS: "/notifications",
    NOTIFICATION_READ: (id: string) => `/notifications/${id}/read`,
    NOTIFICATION_READ_ALL: "/notifications/read-all"
  },

  // Subscription routes
  // Note: IAP verification/products handled by RevenueCat SDK, not our backend
  SUBSCRIPTIONS: {
    ME: "/subscriptions/me",
    FEATURES: "/subscriptions/features",
    SYNC: "/subscriptions/sync",
    HISTORY: "/subscriptions/history"
  },

  // Subscription Plans
  SUBSCRIPTION_PLANS: {
    PLANS: "/subscription-plans/plans",
    PLAN_BY_ID: "/subscription-plans/plans/:id"
  },

  // Blog routes
  BLOG: {
    POSTS: "/blog/posts",
    POST: (slug: string) => `/blog/posts/${slug}`,
    CATEGORIES: "/blog/categories",
    TRACK_VIEW: (id: string) => `/blog/posts/${id}/view`,
    ADMIN: {
      POSTS: "/blog/admin/posts",
      CREATE_POST: "/blog/admin/posts",
      UPDATE_POST: (id: string) => `/blog/admin/posts/${id}`,
      DELETE_POST: (id: string) => `/blog/admin/posts/${id}`,
      PUBLISH_POST: (id: string) => `/blog/admin/posts/${id}/publish`,
      CATEGORIES: "/blog/admin/categories",
      CREATE_CATEGORY: "/blog/admin/categories",
      ANALYTICS: "/blog/admin/analytics"
    }
  },

  // User routes
  USERS: {
    GET: (id: string) => `/users/${id}`,
    GET_PROFILE: (id: string) => `/users/${id}/profile`,
    STATS: (id: string) => `/users/${id}/stats`,
    ME_STATS: "/users/me/stats",
    BASE_STATS: "/stats",
    PROFILE: "/users/profile",
    UPDATE_PROFILE: "/users/profile",
    DELETE_ACCOUNT: "/users/delete",
    CHANGE_PASSWORD: "/users/change-password",
    PROFILE_PICTURE: "/users/profile-picture",
    NOTIFICATION_SETTINGS: "/users/notification-settings",
    REFERRAL_CODE: "/users/me/referral-code",
    REFERRALS: "/users/me/referrals"
  },

  // Data Export routes (GDPR compliance)
  DATA_EXPORT: {
    REQUEST: "/data-export/request",
    STATUS: (exportId: string) => `/data-export/status/${exportId}`
  },

  // App Config routes (public, no auth required)
  APP_CONFIG: {
    PUBLIC: "/app-config/public",
    BY_CATEGORY: (category: string) => `/app-config/public/${category}`
  },

  // Check-ins routes
  CHECKINS: {
    LIST: "/check-ins",
    GET: (id: string) => `/check-ins/${id}`,
    CREATE: "/check-ins",
    UPDATE: (id: string) => `/check-ins/${id}`,
    DELETE: (id: string) => `/check-ins/${id}`,
    STATS: "/check-ins/stats",
    STATS_BY_GOAL: (goalId: string) => `/check-ins/stats?goal_id=${goalId}`,
    CALENDAR: "/check-ins/calendar",
    BY_DATE_RANGE: "/check-ins/range",
    TODAY: "/check-ins/today",
    STREAK: "/check-ins/streak",
    STREAK_BY_GOAL: (goalId: string) => `/check-ins/streak?goal_id=${goalId}`,
    BULK_CREATE: "/check-ins/bulk",
    MOOD_TRENDS: "/check-ins/mood-trends"
  },

  // iOS Live Activities (ActivityKit)
  LIVE_ACTIVITY: {
    PUSH_TO_START_TOKEN: "/live-activity/push-to-start-token",
    ACTIVITY_PUSH_TOKEN: "/live-activity/activity-push-token",
    UNREGISTER: "/live-activity/unregister",
    DEBUG_REFRESH: "/live-activity/debug/refresh"
  },

  // Android Mode B: server-driven NextUp ongoing notification (FCM)
  NEXT_UP_PUSH: {
    FCM_TOKEN: "/next-up/fcm-token",
    DEBUG_REFRESH: "/next-up/debug/refresh"
  },

  // Media routes
  MEDIA: {
    UPLOAD: "/media/upload",
    DELETE: (id: string) => `/media/${id}`,
    DELETE_BY_URL: "/media/delete-by-url"
  },

  // Voice Notes routes (consolidated into media.py)
  VOICE_NOTES: {
    UPLOAD: "/media/upload", // Uses media.py with media_type=voice_note
    DELETE: (checkinId: string) => `/media/voice-note/${checkinId}`
  },

  // Analytics routes
  ANALYTICS: {
    DASHBOARD: "/analytics/dashboard",
    GOALS: "/analytics/goals",
    MOTIVATION: "/analytics/motivation",
    SOCIAL: "/analytics/social"
  },

  // Notification routes
  NOTIFICATIONS: {
    PREFERENCES: "/notifications/preferences",
    REGISTER_DEVICE: "/notifications/register-device",
    UNREGISTER_DEVICE: "/notifications/register-device",
    TEST: "/notifications/test",
    HISTORY: "/notifications/history",
    ANALYTICS: "/notifications/analytics",
    BROADCASTS_ACTIVE: "/notifications/broadcasts/active",
    BROADCAST_MARK_SEEN: (id: string) => `/notifications/broadcasts/${id}/mark-seen`
  },

  // Onboarding routes
  ONBOARDING: {
    COMPLETE: "/onboarding/complete"
  },

  // Achievements routes
  ACHIEVEMENTS: {
    TYPES: "/achievements/types",
    MY_ACHIEVEMENTS: "/achievements/me",
    CHECK: "/achievements/check",
    STATS: "/achievements/stats"
  },

  // AI Coach routes
  AI_COACH: {
    ACCESS: "/ai-coach/access",
    RATE_LIMIT: "/ai-coach/rate-limit",
    CHAT_ASYNC: "/ai-coach/chat/async",
    STREAM: (requestId: string, conversationId?: string) =>
      `/ai-coach/stream?request_id=${encodeURIComponent(requestId)}${
        conversationId ? `&conversation_id=${encodeURIComponent(conversationId)}` : ""
      }`,
    CONVERSATIONS: "/ai-coach/conversations",
    CONVERSATION: (id: string) => `/ai-coach/conversations/${id}`,
    MARK_MESSAGE_FAILED: (id: string) =>
      `/ai-coach/conversations/${id}/mark-message-failed`,
    CURRENT_CONVERSATION: "/ai-coach/conversations/current",
    NEW_CONVERSATION: "/ai-coach/conversations/new",
    UNLOCK_MESSAGE: "/ai-coach/unlock-message"
  }
} as const;

// API Base URL
export const API_BASE_URL = Constants.expoConfig?.extra?.apiUrl || "http://localhost:8000/api/v1";

// Helper function to build full API URLs
export const buildApiUrl = (route: string): string => {
  return `${API_BASE_URL}${route}`;
};

// Helper function to build API URLs with parameters
export const buildApiUrlWithParams = (
  route: string,
  params: Record<string, string | number>
): string => {
  let url = route;
  Object.entries(params).forEach(([key, value]) => {
    url = url.replace(`{${key}}`, String(value));
  });
  return buildApiUrl(url);
};

// Mobile app routes (for Expo Router)
export const MOBILE_ROUTES = {
  // Auth stack
  AUTH: {
    MAIN: "/(auth)/auth",
    LOGIN: "/(auth)/login",
    SIGNUP: "/(auth)/signup",
    VERIFY_EMAIL: "/(auth)/verify-email",
    FORGOT_PASSWORD: "/(auth)/forgot-password",
    RESET_PASSWORD: "/(auth)/reset-password"
  },

  // Main tabs
  MAIN: {
    HOME: "/(user)/(tabs)",
    GOALS: "/(user)/(tabs)/goals",
    NOTIFICATIONS: "/(user)/(tabs)/notifications",
    PROFILE: "/(user)/(tabs)/profile",
    PROGRESS: "/(user)/(tabs)/progress"
  },

  // Goal screens
  GOALS: {
    LIST: "/(user)/(tabs)/goals",
    CREATE: "/(user)/(goals)/create",
    EDIT: "/(user)/(goals)/edit",
    DETAILS: "/(user)/(goals)/details",
    CHECKIN: "/(user)/(goals)/checkin",
    CHECKIN_HISTORY: "/(user)/(goals)/checkin-history",
    MEAL_HISTORY: (goalId: string) => `/(user)/(goals)/meal-history?goalId=${goalId}`,
    MEAL_DETAIL: (mealId: string) => `/(user)/(goals)/meal-detail?mealId=${mealId}`
  },

  // Notifications screens
  NOTIFICATIONS: {
    TAB: "/(user)/(tabs)/notifications"
  },

  // Profile screens
  PROFILE: {
    MAIN: "/(user)/(tabs)/profile",
    EDIT: "/(user)/profile/edit",
    SETTINGS: "/(user)/profile/settings",
    NOTIFICATION_SETTINGS: "/(user)/profile/notification-settings",
    // Account Settings (new structure)
    ACCOUNT_SETTINGS: "/(user)/profile/account-settings",
    SECURITY_SETTINGS: "/(user)/profile/security-settings",
    PROFILE_SETTINGS: "/(user)/profile/profile-settings",
    // Partners (moved from Social)
    PARTNERS: "/(user)/profile/partners",
    FIND_PARTNER: "/(user)/profile/find-partner",
    BLOCKED_PARTNERS: "/(user)/profile/blocked-partners",
    PARTNER_DETAIL: (partnerUserId: string, partnershipId: string) =>
      `/(user)/profile/partner/${partnerUserId}?partnershipId=${partnershipId}` as const,
    // Activity (nudges from partners)
    ACTIVITY: "/(user)/profile/activity",
    // Weekly Recaps
    WEEKLY_RECAPS: "/(user)/profile/weekly-recaps",
    RECAP_DETAIL: (recapId: string) => `/(user)/profile/weekly-recaps/${recapId}` as const,
    // Achievements (moved here for consistency)
    ACHIEVEMENTS: "/(user)/profile/achievements",
    // Linked Accounts
    LINKED_ACCOUNTS: "/(user)/profile/linked-accounts",
    // Personalization (Fitness Profile)
    PERSONALIZATION: "/(user)/profile/personalization",
    // Audio Settings
    AUDIO_SETTINGS: "/(user)/profile/audio-settings",
    // About / App Info
    ABOUT: "/(user)/profile/about",

    REFERRAL: "/(user)/profile/referral",
    // Contact & Support
    CONTACT: "/(user)/profile/contact",
    LIVE_CHAT: "/(user)/profile/live-chat",
    HELP_CENTER: "/(user)/profile/help-center",
    // Blog
    BLOG: "/(user)/profile/blog"
  },

  // Achievements (deprecated - use PROFILE.ACHIEVEMENTS)
  ACHIEVEMENTS: {
    LIST: "/(user)/profile/achievements"
  },

  // Onboarding
  ONBOARDING: {
    MAIN: "/(onboarding)",
    NOTIFICATION_PERMISSION: "/(user)/(onboarding)/notification-permission",
    PERSONALIZATION: "/(user)/(onboarding)/personalization"
  }
} as const;

// Web routes (for Next.js)
export const WEB_ROUTES = {
  HOME: "/",
  BLOG: "/blog",
  BLOG_POST: (slug: string) => `/blog/${slug}`,
  PRIVACY: "/privacy",
  TERMS: "/terms",
  CONTACT: "/contact",
  HELP: "/help"
} as const;

// Route parameter types
export type RouteParams = {
  id: string;
  slug: string;
  userId: string;
  postId: string;
  goalId: string;
  motivationId: string;
};

// Navigation helper functions
export const navigation = {
  // Mobile navigation
  mobile: {
    goToAuth: () => MOBILE_ROUTES.AUTH.MAIN,
    goToLogin: () => MOBILE_ROUTES.AUTH.LOGIN,
    goToSignup: () => MOBILE_ROUTES.AUTH.SIGNUP,
    goToHome: () => MOBILE_ROUTES.MAIN.HOME,
    goToGoals: () => MOBILE_ROUTES.MAIN.GOALS,
    goToProfile: () => MOBILE_ROUTES.MAIN.PROFILE,
    goToCreateGoal: () => MOBILE_ROUTES.GOALS.CREATE,
    goToEditGoal: (id: string) => MOBILE_ROUTES.GOALS.EDIT,
    goToGoalDetails: (id: string) => MOBILE_ROUTES.GOALS.DETAILS,
    goToCheckIn: (id: string) => MOBILE_ROUTES.GOALS.CHECKIN,
    goToEditProfile: () => MOBILE_ROUTES.PROFILE.EDIT,
    goToSettings: () => MOBILE_ROUTES.PROFILE.SETTINGS
  },

  // Web navigation
  web: {
    goToHome: () => WEB_ROUTES.HOME,
    goToBlog: () => WEB_ROUTES.BLOG,
    goToBlogPost: (slug: string) => WEB_ROUTES.BLOG_POST(slug),
    goToPrivacy: () => WEB_ROUTES.PRIVACY,
    goToTerms: () => WEB_ROUTES.TERMS,
    goToContact: () => WEB_ROUTES.CONTACT,
    goToHelp: () => WEB_ROUTES.HELP
  }
};
