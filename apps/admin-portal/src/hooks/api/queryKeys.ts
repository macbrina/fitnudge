/**
 * Centralized query keys for TanStack React Query.
 * Use these for cache invalidation and consistent keys across the app.
 */

export const queryKeys = {
  auth: {
    all: ["auth"] as const,
    me: () => [...queryKeys.auth.all, "me"] as const,
  },
  users: {
    all: ["users"] as const,
    lists: () => [...queryKeys.users.all, "list"] as const,
    list: (params?: Record<string, unknown>) =>
      [...queryKeys.users.lists(), params ?? {}] as const,
    stats: () => [...queryKeys.users.all, "stats"] as const,
    details: () => [...queryKeys.users.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.users.details(), id] as const,
    goals: (id: string) => [...queryKeys.users.detail(id), "goals"] as const,
    activity: (id: string, limit?: number) =>
      [...queryKeys.users.detail(id), "activity", limit] as const,
  },
  subscriptions: {
    all: ["subscriptions"] as const,
    lists: () => [...queryKeys.subscriptions.all, "list"] as const,
    list: (params?: Record<string, unknown>) =>
      [...queryKeys.subscriptions.lists(), params ?? {}] as const,
    stats: () => [...queryKeys.subscriptions.all, "stats"] as const,
    details: () => [...queryKeys.subscriptions.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.subscriptions.details(), id] as const,
  },
  userReports: {
    all: ["userReports"] as const,
    lists: () => [...queryKeys.userReports.all, "list"] as const,
    list: (params?: Record<string, unknown>) =>
      [...queryKeys.userReports.lists(), params ?? {}] as const,
    stats: () => [...queryKeys.userReports.all, "stats"] as const,
    details: () => [...queryKeys.userReports.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.userReports.details(), id] as const,
  },
  tasks: {
    all: ["tasks"] as const,
    overview: () => [...queryKeys.tasks.all, "overview"] as const,
    recent: (limit?: number) => [...queryKeys.tasks.all, "recent", limit] as const,
    failures: (params?: { limit?: number; task_name?: string }) =>
      [...queryKeys.tasks.all, "failures", params] as const,
    workers: () => [...queryKeys.tasks.all, "workers"] as const,
    active: () => [...queryKeys.tasks.all, "active"] as const,
    scheduled: () => [...queryKeys.tasks.all, "scheduled"] as const,
    beatSchedule: () => [...queryKeys.tasks.all, "beatSchedule"] as const,
    registered: () => [...queryKeys.tasks.all, "registered"] as const,
    detail: (id: string) => [...queryKeys.tasks.all, "detail", id] as const,
  },
  analytics: {
    all: ["analytics"] as const,
    dashboard: () => [...queryKeys.analytics.all, "dashboard"] as const,
    userGrowth: (days: number) =>
      [...queryKeys.analytics.all, "userGrowth", days] as const,
    checkinActivity: (days: number) =>
      [...queryKeys.analytics.all, "checkinActivity", days] as const,
    retention: () => [...queryKeys.analytics.all, "retention"] as const,
    subscriptionByPlatform: () =>
      [...queryKeys.analytics.all, "subscriptionByPlatform"] as const,
    mrrTrend: (days: number) =>
      [...queryKeys.analytics.all, "mrrTrend", days] as const,
    referrals: () => [...queryKeys.analytics.all, "referrals"] as const,
    churn: (days: number) =>
      [...queryKeys.analytics.all, "churn", days] as const,
    engagement: () => [...queryKeys.analytics.all, "engagement"] as const,
    broadcastEngagement: () =>
      [...queryKeys.analytics.all, "broadcastEngagement"] as const,
  },
  auditLogs: {
    all: ["auditLogs"] as const,
    list: (params?: Record<string, unknown>) =>
      [...queryKeys.auditLogs.all, "list", params ?? {}] as const,
  },
  broadcasts: {
    all: ["broadcasts"] as const,
    lists: () => [...queryKeys.broadcasts.all, "list"] as const,
    list: (params?: Record<string, unknown>) =>
      [...queryKeys.broadcasts.lists(), params ?? {}] as const,
    details: () => [...queryKeys.broadcasts.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.broadcasts.details(), id] as const,
  },
  appConfig: {
    all: ["appConfig"] as const,
    list: () => [...queryKeys.appConfig.all, "list"] as const,
    detail: (key: string) => [...queryKeys.appConfig.all, "detail", key] as const,
  },
  appVersions: {
    all: ["appVersions"] as const,
    list: () => [...queryKeys.appVersions.all, "list"] as const,
    detail: (platform: string) =>
      [...queryKeys.appVersions.all, "detail", platform] as const,
  },
  deactivationLogs: {
    all: ["deactivationLogs"] as const,
    list: (params?: Record<string, unknown>) =>
      [...queryKeys.deactivationLogs.all, "list", params ?? {}] as const,
  },
  referrals: {
    all: ["referrals"] as const,
    list: (params?: Record<string, unknown>) =>
      [...queryKeys.referrals.all, "list", params ?? {}] as const,
  },
  dataExport: {
    all: ["dataExport"] as const,
    list: (params?: Record<string, unknown>) =>
      [...queryKeys.dataExport.all, "list", params ?? {}] as const,
    detail: (id: string) =>
      [...queryKeys.dataExport.all, "detail", id] as const,
  },
  subscriptionPlans: {
    all: ["subscriptionPlans"] as const,
    list: () => [...queryKeys.subscriptionPlans.all, "list"] as const,
    detail: (id: string) =>
      [...queryKeys.subscriptionPlans.all, "detail", id] as const,
  },
  planFeatures: {
    all: ["planFeatures"] as const,
    listByPlan: (planId: string) =>
      [...queryKeys.planFeatures.all, "list", planId] as const,
  },
  legalDocuments: {
    all: ["legalDocuments"] as const,
    list: (params?: Record<string, unknown>) =>
      [...queryKeys.legalDocuments.all, "list", params ?? {}] as const,
    detail: (id: string) =>
      [...queryKeys.legalDocuments.all, "detail", id] as const,
  },
  blog: {
    all: ["blog"] as const,
    categories: () => [...queryKeys.blog.all, "categories"] as const,
    tags: () => [...queryKeys.blog.all, "tags"] as const,
    posts: {
      lists: () => [...queryKeys.blog.all, "posts", "list"] as const,
      list: (params?: Record<string, unknown>) =>
        [...queryKeys.blog.posts.lists(), params ?? {}] as const,
      details: () => [...queryKeys.blog.all, "posts", "detail"] as const,
      detail: (id: string) => [...queryKeys.blog.posts.details(), id] as const,
    },
  },
} as const;
