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
    VERIFY_EMAIL: "/auth/verify-email",
    OAUTH: {
      APPLE: "/auth/oauth/apple",
      GOOGLE: "/auth/oauth/google",
    },
  },

  // Goals routes
  GOALS: {
    LIST: "/goals",
    CREATE: "/goals",
    GET: (id: string) => `/goals/${id}`,
    UPDATE: (id: string) => `/goals/${id}`,
    DELETE: (id: string) => `/goals/${id}`,
    CHECKIN: (id: string) => `/goals/${id}/checkin`,
    CHECKINS: (id: string) => `/goals/${id}/checkins`,
    TEMPLATES: "/goals/templates",
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
  },

  // Subscription routes
  SUBSCRIPTIONS: {
    PLANS: "/subscriptions/plans",
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
    PROFILE: "/users/profile",
    UPDATE_PROFILE: "/users/profile",
    DELETE_ACCOUNT: "/users/delete",
    EXPORT_DATA: "/users/me/data",
  },

  // Media routes
  MEDIA: {
    UPLOAD: "/media/upload",
    DELETE: (id: string) => `/media/${id}`,
  },

  // Analytics routes
  ANALYTICS: {
    DASHBOARD: "/analytics/dashboard",
    GOALS: "/analytics/goals",
    MOTIVATION: "/analytics/motivation",
    SOCIAL: "/analytics/social",
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
    CREATE: "/(user)/goals/create",
    EDIT: "/(user)/goals/edit",
    DETAILS: "/(user)/goals/details",
    CHECKIN: "/(user)/goals/checkin",
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
  },

  // Onboarding
  ONBOARDING: "/(onboarding)",
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
