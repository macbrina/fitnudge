/**
 * Centralized routes for the admin portal.
 * Use these constants instead of hardcoding paths.
 */

export const ROUTES = {
  // Page routes
  HOME: "/",
  LOGIN: "/login",
  DASHBOARD: "/dashboard",
  FORGOT_PASSWORD: "/forgot-password",
  RESET_PASSWORD: "/reset-password",

  // Dashboard sub-routes (from ADMIN_PORTAL.md)
  DASHBOARD_OVERVIEW: "/dashboard",
  USERS: "/dashboard/users",
  SUBSCRIPTIONS: "/dashboard/subscriptions",
  USER_REPORTS: "/dashboard/user-reports",
  REFERRALS: "/dashboard/referrals",
  DATA_EXPORT: "/dashboard/data-export",
  SUBSCRIPTION_PLANS: "/dashboard/subscription-plans",
  LEGAL_DOCUMENTS: "/dashboard/legal-documents",
  LEGAL_DOCUMENTS_NEW: "/dashboard/legal-documents/new",
  apiLegalDocumentEdit: (id: string) => `/dashboard/legal-documents/${id}` as const,
  BLOG: "/dashboard/blog",
  BLOG_POSTS: "/dashboard/blog",
  BLOG_CATEGORIES: "/dashboard/blog/categories",
  BLOG_TAGS: "/dashboard/blog/tags",
  BLOG_NEW: "/dashboard/blog/new",
  apiBlogPostEdit: (id: string) => `/dashboard/blog/${id}` as const,
  TASKS: "/dashboard/tasks",
  TASKS_OVERVIEW: "/dashboard/tasks",
  TASKS_WORKERS: "/dashboard/tasks/workers",
  TASKS_ACTIVE: "/dashboard/tasks/active",
  TASKS_SCHEDULED: "/dashboard/tasks/scheduled",
  TASKS_REGISTERED: "/dashboard/tasks/registered",
  TASKS_LOGS: "/dashboard/tasks/logs",
  TASKS_FAILURES: "/dashboard/tasks/failures",
  TASKS_BEAT_SCHEDULE: "/dashboard/tasks/beat-schedule",
  apiTaskDetail: (id: string) => `/dashboard/tasks/${id}` as const,
  ANALYTICS: "/dashboard/analytics",
  ANALYTICS_DASHBOARD: "/dashboard/analytics",
  ANALYTICS_USER_GROWTH: "/dashboard/analytics/user-growth",
  ANALYTICS_CHECKINS: "/dashboard/analytics/checkins",
  ANALYTICS_RETENTION: "/dashboard/analytics/retention",
  ANALYTICS_CHURN: "/dashboard/analytics/churn",
  APP_CONFIG: "/dashboard/app-config",
  APP_VERSIONS: "/dashboard/app-versions",
  DEACTIVATION_LOGS: "/dashboard/deactivation-logs",
  BROADCASTS: "/dashboard/broadcasts",
  MAINTENANCE: "/dashboard/maintenance",
  AUDIT_LOGS: "/dashboard/audit-logs",

  // API proxy routes (Next.js API routes that forward to Admin API)
  API_AUTH_LOGIN: "/api/auth/login",
  API_AUTH_LOGOUT: "/api/auth/logout",
  API_AUTH_ME: "/api/auth/me",
  API_AUTH_FORGOT_PASSWORD: "/api/auth/forgot-password",
  API_AUTH_RESET_PASSWORD: "/api/auth/reset-password",
  API_AUTH_RESET_PASSWORD_VALIDATE: "/api/auth/reset-password/validate",

  // Users API
  API_USERS: "/api/users",
  API_USERS_STATS: "/api/users/stats",
  apiUser: (id: string) => `/api/users/${id}` as const,
  apiUserGoals: (id: string) => `/api/users/${id}/goals` as const,
  apiUserActivity: (id: string) => `/api/users/${id}/activity` as const,

  // Subscriptions API
  API_SUBSCRIPTIONS: "/api/subscriptions",
  API_SUBSCRIPTIONS_STATS: "/api/subscriptions/stats",
  API_SUBSCRIPTIONS_GRANT: "/api/subscriptions/grant",
  apiSubscription: (id: string) => `/api/subscriptions/${id}` as const,
  apiSubscriptionCancel: (id: string) => `/api/subscriptions/${id}/cancel` as const,

  // User Reports API
  API_USER_REPORTS: "/api/user-reports",
  API_USER_REPORTS_STATS: "/api/user-reports/stats",
  apiUserReport: (id: string) => `/api/user-reports/${id}` as const,

  // Blog API
  API_BLOG_CATEGORIES: "/api/blog/categories",
  apiBlogCategory: (id: string) => `/api/blog/categories/${id}` as const,
  API_BLOG_TAGS: "/api/blog/tags",
  apiBlogTag: (id: string) => `/api/blog/tags/${id}` as const,
  API_BLOG_POSTS: "/api/blog/posts",
  apiBlogPost: (id: string) => `/api/blog/posts/${id}` as const,
  API_BLOG_UPLOAD_IMAGE: "/api/blog/upload-image",

  // Tasks API
  API_TASKS_OVERVIEW: "/api/tasks/overview",
  API_TASKS_RECENT: "/api/tasks/recent",
  API_TASKS_FAILURES: "/api/tasks/failures",
  apiTaskFailure: (id: string) => `/api/tasks/failures/${id}` as const,
  API_TASKS_WORKERS: "/api/tasks/workers",
  API_TASKS_ACTIVE: "/api/tasks/active",
  API_TASKS_SCHEDULED: "/api/tasks/scheduled",
  API_TASKS_BEAT_SCHEDULE: "/api/tasks/beat-schedule",
  API_TASKS_REGISTERED: "/api/tasks/registered/list",
  apiTask: (id: string) => `/api/tasks/${id}` as const,
  apiTaskRevoke: (id: string) => `/api/tasks/${id}/revoke` as const,
  API_TASKS_PURGE: "/api/tasks/purge",
  API_TASKS_CATCHUP: "/api/tasks/catchup-checkins",

  // Analytics API
  API_ANALYTICS_DASHBOARD: "/api/analytics/dashboard",
  API_ANALYTICS_USER_GROWTH: "/api/analytics/users/growth",
  API_ANALYTICS_CHECKINS: "/api/analytics/checkins/activity",
  API_ANALYTICS_RETENTION: "/api/analytics/retention",
  API_ANALYTICS_CACHE: "/api/analytics/cache",
  API_ANALYTICS_SUBS_PLATFORM: "/api/analytics/subscriptions/by-platform",
  API_ANALYTICS_MRR_TREND: "/api/analytics/subscriptions/mrr-trend",
  API_ANALYTICS_REFERRALS: "/api/analytics/referrals",
  API_ANALYTICS_CHURN: "/api/analytics/subscriptions/churn",
  API_ANALYTICS_ENGAGEMENT: "/api/analytics/engagement",
  API_ANALYTICS_BROADCASTS_ENGAGEMENT: "/api/analytics/broadcasts/engagement",

  // App Config API
  API_APP_CONFIG: "/api/app-config",
  apiAppConfigKey: (key: string) => `/api/app-config/${encodeURIComponent(key)}` as const,

  // App Versions API
  API_APP_VERSIONS: "/api/app-versions",
  apiAppVersion: (platform: string) => `/api/app-versions/${encodeURIComponent(platform)}` as const,

  // Deactivation Logs API
  API_DEACTIVATION_LOGS: "/api/subscription-deactivation-logs",

  // Referrals API
  API_REFERRALS: "/api/referrals",

  // Data Export API
  API_DATA_EXPORT: "/api/data-export",
  API_DATA_EXPORT_REQUEST: "/api/data-export/request",
  apiDataExport: (id: string) => `/api/data-export/${id}` as const,
  apiDataExportRetry: (id: string) => `/api/data-export/${id}/retry` as const,

  // Subscription Plans API
  API_SUBSCRIPTION_PLANS: "/api/subscription-plans",
  apiSubscriptionPlan: (id: string) => `/api/subscription-plans/${id}` as const,

  // Plan Features API
  API_PLAN_FEATURES: "/api/plan-features",
  apiPlanFeaturesByPlan: (planId: string) =>
    `/api/plan-features/by-plan/${planId}` as const,
  apiPlanFeature: (id: string) => `/api/plan-features/${id}` as const,

  // Legal Documents API
  API_LEGAL_DOCUMENTS: "/api/legal-documents",
  apiLegalDocument: (id: string) => `/api/legal-documents/${id}` as const,
  apiLegalDocumentSetCurrent: (id: string) =>
    `/api/legal-documents/${id}/set-current` as const,

  // Audit Logs API
  API_AUDIT_LOGS: "/api/audit-logs",

  // Broadcasts API
  API_BROADCASTS: "/api/broadcasts",
  apiBroadcast: (id: string) => `/api/broadcasts/${id}` as const,
} as const;

export type RouteKey = keyof typeof ROUTES;

/** Map pathname to translation key for page title in header */
export const PATH_TO_TITLE_KEY: Record<string, string> = {
  [ROUTES.DASHBOARD_OVERVIEW]: "admin.menu.overview",
  [ROUTES.USERS]: "admin.menu.users",
  [ROUTES.SUBSCRIPTIONS]: "admin.menu.subscriptions",
  [ROUTES.USER_REPORTS]: "admin.menu.user_reports",
  [ROUTES.BLOG]: "admin.menu.blog_posts",
  [ROUTES.BLOG_CATEGORIES]: "admin.menu.blog_categories",
  [ROUTES.BLOG_TAGS]: "admin.menu.blog_tags",
  [ROUTES.TASKS_OVERVIEW]: "admin.menu.tasks_overview",
  [ROUTES.TASKS_WORKERS]: "admin.menu.workers",
  [ROUTES.TASKS_ACTIVE]: "admin.menu.active",
  [ROUTES.TASKS_SCHEDULED]: "admin.menu.scheduled",
  [ROUTES.TASKS_LOGS]: "admin.menu.task_logs",
  [ROUTES.TASKS_FAILURES]: "admin.menu.task_failures",
  [ROUTES.TASKS_BEAT_SCHEDULE]: "admin.menu.beat_schedule",
  [ROUTES.TASKS_REGISTERED]: "admin.menu.registered",
  [ROUTES.ANALYTICS_DASHBOARD]: "admin.menu.analytics_dashboard",
  [ROUTES.ANALYTICS_USER_GROWTH]: "admin.menu.user_growth",
  [ROUTES.ANALYTICS_CHECKINS]: "admin.menu.checkin_activity",
  [ROUTES.ANALYTICS_RETENTION]: "admin.menu.retention",
  [ROUTES.ANALYTICS_CHURN]: "admin.menu.churn",
  [ROUTES.APP_CONFIG]: "admin.menu.app_config",
  [ROUTES.APP_VERSIONS]: "admin.menu.app_versions",
  [ROUTES.DEACTIVATION_LOGS]: "admin.menu.deactivation_logs",
  [ROUTES.REFERRALS]: "admin.menu.referrals",
  [ROUTES.DATA_EXPORT]: "admin.menu.data_export",
  [ROUTES.SUBSCRIPTION_PLANS]: "admin.menu.subscription_plans",
  [ROUTES.BROADCASTS]: "admin.menu.broadcasts",
  [ROUTES.MAINTENANCE]: "admin.menu.maintenance",
  [ROUTES.AUDIT_LOGS]: "admin.menu.audit_logs",
};

const TASKS_INNER_PATHS = [
  ROUTES.TASKS_OVERVIEW,
  ROUTES.TASKS_LOGS,
  ROUTES.TASKS_FAILURES,
  ROUTES.TASKS_BEAT_SCHEDULE,
  ROUTES.TASKS_WORKERS,
  ROUTES.TASKS_ACTIVE,
  ROUTES.TASKS_SCHEDULED,
  ROUTES.TASKS_REGISTERED,
];

/** Get page title translation key for a given pathname */
export function getPageTitleKey(pathname: string): string {
  if (PATH_TO_TITLE_KEY[pathname]) return PATH_TO_TITLE_KEY[pathname];
  if (pathname.startsWith(ROUTES.USERS + "/")) return "admin.menu.users";
  if (pathname.startsWith(ROUTES.SUBSCRIPTIONS + "/")) return "admin.menu.subscriptions";
  if (pathname.startsWith(ROUTES.USER_REPORTS + "/")) return "admin.menu.user_reports";
  if (pathname.startsWith(ROUTES.DEACTIVATION_LOGS)) return "admin.menu.deactivation_logs";
  if (pathname.startsWith(ROUTES.REFERRALS)) return "admin.menu.referrals";
  if (pathname.startsWith(ROUTES.DATA_EXPORT)) return "admin.menu.data_export";
  if (pathname.startsWith(ROUTES.SUBSCRIPTION_PLANS)) return "admin.menu.subscription_plans";
  if (pathname.startsWith(ROUTES.LEGAL_DOCUMENTS)) return "admin.menu.legal_documents";
  if (pathname.startsWith(ROUTES.BLOG + "/") && pathname !== ROUTES.BLOG_CATEGORIES && pathname !== ROUTES.BLOG_TAGS) return "admin.menu.blog_posts";
  if (pathname.startsWith(ROUTES.TASKS + "/") && !TASKS_INNER_PATHS.includes(pathname as (typeof TASKS_INNER_PATHS)[number])) return "admin.menu.task_detail";
  return "admin.title";
}

/**
 * Reset password path - used when building reset URLs (e.g. admin-api email).
 * Keep in sync with admin-api ADMIN_RESET_PASSWORD_PATH env var.
 */
export const RESET_PASSWORD_PATH = "/reset-password";
