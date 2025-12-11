// Centralized route definitions for FitNudge
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
      GOOGLE: "/auth/oauth/google",
    },
  },

  // Goals routes
  GOALS: {
    BASE: "/goals",
    LIST: "/goals/",
    ARCHIVE: (id: string) => `/goals/${id}/archive`,
    UNARCHIVE: (id: string) => `/goals/${id}/unarchive`,
    ACTIVATE: (id: string) => `/goals/${id}/activate`,
    DEACTIVATE: (id: string) => `/goals/${id}/deactivate`,
    DUPLICATE_GOAL: (id: string) => `/goals/${id}/duplicate`,
    SHARE_AS_CHALLENGE: (id: string) => `/goals/${id}/share-as-challenge`,
    GET_GOALS_BY_CATEGORY: (category: string) => `/goals/?category=${category}`,
    GET_ACTIVE_GOALS: "/goals/?is_active=true",
    GET_COMPLETED_GOALS: "/goals/?is_active=false",
    CREATE: "/goals/",
    GET: (id: string) => `/goals/${id}`,
    UPDATE: (id: string) => `/goals/${id}`,
    DELETE: (id: string) => `/goals/${id}`,
    CHECKIN: (id: string) => `/goals/${id}/checkin`,
    CHECKINS: (id: string) => `/goals/${id}/checkins`,
    TEMPLATES: "/goals/templates/",
    GET_STATS: (id: string) => `/goals/${id}/stats`,
    STATS: "/goals/stats",
    PLAN_STATUS: (id: string) => `/goals/${id}/plan-status`,
    PLAN: (id: string) => `/goals/${id}/plan`,
    PLAN_RETRY: (id: string) => `/goals/${id}/plan/retry`,
  },

  // Challenges routes
  CHALLENGES: {
    BASE: "/challenges",
    LIST: "/challenges",
    GET: (id: string) => `/challenges/${id}`,
    CREATE: "/challenges",
    UPDATE: (id: string) => `/challenges/${id}`,
    DELETE: (id: string) => `/challenges/${id}`,
    JOIN: (id: string) => `/challenges/${id}/join`,
    LEAVE: (id: string) => `/challenges/${id}/leave`,
    CHECK_IN: (id: string) => `/challenges/${id}/check-in`,
    CHECK_INS: (id: string) => `/challenges/${id}/check-ins`,
    MY_CHECK_INS: (id: string) => `/challenges/${id}/my-check-ins`,
    LEADERBOARD: (id: string) => `/challenges/${id}/leaderboard`,
    PARTICIPANTS: (id: string) => `/challenges/${id}/participants`,
    PUBLIC: "/challenges/public",
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
    DELETE: (id: string) => `/nudges/${id}`,
  },

  // Accountability Partners routes
  PARTNERS: {
    BASE: "/partners",
    LIST: "/partners",
    PENDING: "/partners/pending",
    REQUEST: "/partners/request",
    ACCEPT: (id: string) => `/partners/${id}/accept`,
    REJECT: (id: string) => `/partners/${id}/reject`,
    REMOVE: (id: string) => `/partners/${id}`,
    SEARCH_USERS: "/partners/search",
  },

  // Motivation routes
  MOTIVATION: {
    GENERATE: "/motivation/generate",
    SCHEDULE: "/motivation/schedule",
    LIST: "/motivation",
    GET: (id: string) => `/motivation/${id}`,
    SEND: (id: string) => `/motivation/${id}/send`,
    DELETE: (id: string) => `/motivation/${id}`,
  },

  // Daily Motivations routes
  DAILY_MOTIVATIONS: {
    BASE: "/daily-motivations",
    TODAY: "/daily-motivations/today",
    LIST: "/daily-motivations",
    GET: (id: string) => `/daily-motivations/${id}`,
    SHARE: (id: string) => `/daily-motivations/${id}/share`,
    REGENERATE: "/daily-motivations/regenerate",
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
      CREATE_COMMENT: (id: string) => `/social/posts/${id}/comments`,
    },
    USERS: {
      FOLLOW: (id: string) => `/social/users/${id}/follow`,
      UNFOLLOW: (id: string) => `/social/users/${id}/follow`,
      FOLLOWERS: (id: string) => `/social/users/${id}/followers`,
      FOLLOWING: (id: string) => `/social/users/${id}/following`,
    },
    SEARCH: {
      USERS: "/users/search",
      POSTS: "/posts/search",
    },
    TRENDING: {
      POSTS: "/posts/trending",
      HASHTAGS: "/hashtags/trending",
    },
    NOTIFICATIONS: "/notifications",
    NOTIFICATION_READ: (id: string) => `/notifications/${id}/read`,
    NOTIFICATION_READ_ALL: "/notifications/read-all",
  },

  // Subscription routes
  SUBSCRIPTIONS: {
    ME: "/subscriptions/me",
    FEATURES: "/subscriptions/features",
    SYNC: "/subscriptions/sync",
    APPLE: {
      VERIFY_RECEIPT: "/subscriptions/iap/apple/verify-receipt",
      WEBHOOK: "/subscriptions/iap/apple/webhook",
      PRODUCTS: "/subscriptions/iap/apple/products",
      RESTORE: "/subscriptions/iap/apple/restore",
      VALIDATE_OFFER: "/subscriptions/iap/apple/validate-offer",
    },
    GOOGLE: {
      VERIFY_PURCHASE: "/subscriptions/iap/google/verify-purchase",
      WEBHOOK: "/subscriptions/iap/google/webhook",
      PRODUCTS: "/subscriptions/iap/google/products",
      ACKNOWLEDGE: "/subscriptions/iap/google/acknowledge",
      VALIDATE_PROMO: "/subscriptions/iap/google/validate-promo",
    },
  },

  // Subscription Plans
  SUBSCRIPTION_PLANS: {
    PLANS: "/subscription-plans/plans",
    PLAN_BY_ID: "/subscription-plans/plans/:id",
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
      ANALYTICS: "/blog/admin/analytics",
    },
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
    EXPORT_DATA: "/users/me/data",
    CHANGE_PASSWORD: "/users/change-password",
    PROFILE_PICTURE: "/users/profile-picture",
    NOTIFICATION_SETTINGS: "/users/notification-settings",
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
    MOOD_TRENDS: "/check-ins/mood-trends",
  },

  // Media routes
  MEDIA: {
    UPLOAD: "/media/upload",
    DELETE: (id: string) => `/media/${id}`,
    DELETE_BY_URL: "/media/delete-by-url",
  },

  // Analytics routes
  ANALYTICS: {
    DASHBOARD: "/analytics/dashboard",
    GOALS: "/analytics/goals",
    MOTIVATION: "/analytics/motivation",
    SOCIAL: "/analytics/social",
  },

  // Notification routes
  NOTIFICATIONS: {
    PREFERENCES: "/notifications/preferences",
    REGISTER_DEVICE: "/notifications/register-device",
    UNREGISTER_DEVICE: "/notifications/register-device",
    TEST: "/notifications/test",
    HISTORY: "/notifications/history",
    ANALYTICS: "/notifications/analytics",
  },

  // Onboarding routes
  ONBOARDING: {
    PROFILE: "/onboarding/profile",
    SUGGESTED_GOALS: "/onboarding/suggested-goals",
  },

  // Achievements routes
  ACHIEVEMENTS: {
    TYPES: "/achievements/types",
    MY_ACHIEVEMENTS: "/achievements/me",
    CHECK: "/achievements/check",
    STATS: "/achievements/stats",
  },
} as const;

import Constants from "expo-constants";

// API Base URL
export const API_BASE_URL =
  Constants.expoConfig?.extra?.apiUrl || "http://localhost:8000/api/v1";

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
    RESET_PASSWORD: "/(auth)/reset-password",
    CHANGE_PASSWORD: "/(auth)/change-password",
  },

  // Main tabs
  MAIN: {
    HOME: "/(user)/(tabs)",
    GOALS: "/(user)/(tabs)/goals",
    FEED: "/(user)/(tabs)/feed",
    PROFILE: "/(user)/(tabs)/profile",
  },

  // Goal screens
  GOALS: {
    LIST: "/(user)/(tabs)/goals",
    CREATE: "/(user)/(goals)/create",
    EDIT: "/(user)/(goals)/edit",
    DETAILS: "/(user)/(goals)/details",
    CHECKIN: "/(user)/(goals)/checkin",
  },

  // Social screens
  SOCIAL: {
    FEED: "/(user)/(tabs)/feed",
    CREATE_POST: "/(user)/social/create",
    POST_DETAILS: "/(user)/social/post",
    USER_PROFILE: "/(user)/social/profile",
  },

  // Profile screens
  PROFILE: {
    MAIN: "/(user)/(tabs)/profile",
    EDIT: "/(user)/profile/edit",
    SETTINGS: "/(user)/profile/settings",
    NOTIFICATIONS: "/(user)/profile/notifications",
    SUBSCRIPTION: "/(user)/profile/subscription",
    CHANGE_PASSWORD: "/(user)/profile/change-password",
  },

  // Onboarding
  ONBOARDING: {
    MAIN: "/(onboarding)",
    NOTIFICATION_PERMISSION: "/(user)/(onboarding)/notification-permission",
    PERSONALIZATION: "/(user)/(onboarding)/personalization",
    SUGGESTED_GOALS: "/(user)/(onboarding)/suggested-goals",
    SUBSCRIPTION: "/(user)/(onboarding)/subscription",
  },

  // Challenges
  CHALLENGES: {
    LIST: "/(user)/challenges",
    DETAILS: (id: string) => `/(user)/challenges/${id}` as const,
    CREATE: "/(user)/challenges/create",
  },
} as const;

// Web routes (for Next.js)
export const WEB_ROUTES = {
  HOME: "/",
  BLOG: "/blog",
  BLOG_POST: (slug: string) => `/blog/${slug}`,
  PRIVACY: "/privacy",
  TERMS: "/terms",
  CONTACT: "/contact",
  HELP: "/help",
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
    goToFeed: () => MOBILE_ROUTES.MAIN.FEED,
    goToProfile: () => MOBILE_ROUTES.MAIN.PROFILE,
    goToCreateGoal: () => MOBILE_ROUTES.GOALS.CREATE,
    goToEditGoal: (id: string) => MOBILE_ROUTES.GOALS.EDIT,
    goToGoalDetails: (id: string) => MOBILE_ROUTES.GOALS.DETAILS,
    goToCheckIn: (id: string) => MOBILE_ROUTES.GOALS.CHECKIN,
    goToCreatePost: () => MOBILE_ROUTES.SOCIAL.CREATE_POST,
    goToPostDetails: (id: string) => MOBILE_ROUTES.SOCIAL.POST_DETAILS,
    goToUserProfile: (id: string) => MOBILE_ROUTES.SOCIAL.USER_PROFILE,
    goToEditProfile: () => MOBILE_ROUTES.PROFILE.EDIT,
    goToSettings: () => MOBILE_ROUTES.PROFILE.SETTINGS,
    goToSubscription: () => MOBILE_ROUTES.PROFILE.SUBSCRIPTION,
  },

  // Web navigation
  web: {
    goToHome: () => WEB_ROUTES.HOME,
    goToBlog: () => WEB_ROUTES.BLOG,
    goToBlogPost: (slug: string) => WEB_ROUTES.BLOG_POST(slug),
    goToPrivacy: () => WEB_ROUTES.PRIVACY,
    goToTerms: () => WEB_ROUTES.TERMS,
    goToContact: () => WEB_ROUTES.CONTACT,
    goToHelp: () => WEB_ROUTES.HELP,
  },
};
