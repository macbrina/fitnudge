/**
 * Shared Query Keys
 *
 * Centralized query keys to avoid circular dependencies between hooks.
 * These keys are used by useGoals and useActionablePlans which have cross-dependencies.
 */

// Goals Query Keys (V2 - simplified)
export const goalsQueryKeys = {
  all: ["goals"] as const,
  // Main list (all goals including archived)
  list: () => [...goalsQueryKeys.all, "list"] as const,
  // Active goals only
  active: () => [...goalsQueryKeys.all, "active"] as const,
  // Archived goals only
  archived: () => [...goalsQueryKeys.all, "archived"] as const,
  // Completed goals only
  completed: () => [...goalsQueryKeys.all, "completed"] as const,
  // Single goal detail
  detail: (id: string) => [...goalsQueryKeys.all, "detail", id] as const,
  // Goal stats (single goal)
  stats: (id: string) => [...goalsQueryKeys.all, "stats", id] as const,
  // Summary stats (all goals)
  summary: () => [...goalsQueryKeys.all, "summary"] as const,
  // Pattern insights for a goal (Premium)
  insights: (id: string) => [...goalsQueryKeys.all, "insights", id] as const
} as const;

// User Query Keys (matches useUser.ts)
export const userQueryKeys = {
  currentUser: ["user", "current"] as const,
  userById: (id: string) => ["user", id] as const,
  userStats: (id?: string) => ["user", "stats", id] as const,
  notificationSettings: ["user", "notification-settings"] as const
} as const;

// Check-ins Query Keys (matches useCheckIns.ts)
export const checkInsQueryKeys = {
  all: ["checkIns"] as const,
  list: (goalId?: string) => [...checkInsQueryKeys.all, "list", goalId] as const,
  detail: (id: string) => [...checkInsQueryKeys.all, "detail", id] as const,
  stats: (goalId?: string) => [...checkInsQueryKeys.all, "stats", goalId] as const,
  calendar: (year: number, month: number, goalId?: string) =>
    [...checkInsQueryKeys.all, "calendar", year, month, goalId] as const,
  today: () => [...checkInsQueryKeys.all, "today"] as const,
  streak: (goalId?: string) => [...checkInsQueryKeys.all, "streak", goalId] as const,
  moodTrends: (goalId?: string, days?: number) =>
    [...checkInsQueryKeys.all, "moodTrends", goalId, days] as const
} as const;

// Nudges Query Keys (matches useNudges.ts)
export const nudgesQueryKeys = {
  all: ["nudges"] as const,
  list: () => [...nudgesQueryKeys.all, "list"] as const,
  listFiltered: (unreadOnly: boolean) => [...nudgesQueryKeys.list(), { unreadOnly }] as const,
  sent: () => [...nudgesQueryKeys.all, "sent"] as const,
  unreadCount: () => [...nudgesQueryKeys.all, "unread-count"] as const
} as const;

// Partners Query Keys (matches usePartners.ts)
export const partnersQueryKeys = {
  all: ["partners"] as const,
  list: () => [...partnersQueryKeys.all, "list"] as const,
  listWithGoals: () => [...partnersQueryKeys.all, "list-with-goals"] as const,
  blocked: () => [...partnersQueryKeys.all, "blocked"] as const,
  limits: () => [...partnersQueryKeys.all, "limits"] as const,
  pending: () => [...partnersQueryKeys.all, "pending"] as const,
  sent: () => [...partnersQueryKeys.all, "sent"] as const,
  search: (query: string) => [...partnersQueryKeys.all, "search", query] as const,
  searchInfinite: (query: string) => [...partnersQueryKeys.all, "search-infinite", query] as const,
  suggested: () => [...partnersQueryKeys.all, "suggested"] as const,
  suggestedInfinite: () => [...partnersQueryKeys.all, "suggested-infinite"] as const,
  dashboard: (partnerUserId: string) =>
    [...partnersQueryKeys.all, "dashboard", partnerUserId] as const
} as const;

// Weekly Recaps Query Keys
export const weeklyRecapsQueryKeys = {
  all: ["weeklyRecaps"] as const,
  list: (limit?: number, offset?: number) =>
    [...weeklyRecapsQueryKeys.all, "list", limit, offset] as const,
  current: () => [...weeklyRecapsQueryKeys.all, "current"] as const,
  detail: (id: string) => [...weeklyRecapsQueryKeys.all, "detail", id] as const
} as const;

// AI Coach Query Keys
export const aiCoachQueryKeys = {
  all: ["aiCoach"] as const,
  access: () => [...aiCoachQueryKeys.all, "access"] as const,
  rateLimit: () => [...aiCoachQueryKeys.all, "rateLimit"] as const,
  conversations: () => [...aiCoachQueryKeys.all, "conversations"] as const,
  conversation: (id: string) => [...aiCoachQueryKeys.all, "conversation", id] as const,
  currentConversation: () => [...aiCoachQueryKeys.all, "currentConversation"] as const
} as const;

// Blog Query Keys
export const blogQueryKeys = {
  all: ["blog"] as const,
  posts: () => [...blogQueryKeys.all, "posts"] as const,
  postsPaginated: (page: number, limit: number, category?: string) =>
    [...blogQueryKeys.posts(), { page, limit, category }] as const,
  featured: (limit: number) => [...blogQueryKeys.all, "featured", limit] as const,
  categories: () => [...blogQueryKeys.all, "categories"] as const
} as const;

// Home Dashboard Query Keys (used by useHomeDashboard, deepLinkHandler)
export const homeDashboardQueryKeys = {
  all: ["home"] as const,
  dashboard: () => [...homeDashboardQueryKeys.all, "dashboard"] as const
} as const;

// Achievements Query Keys (used by useAchievements, deepLinkHandler)
export const achievementsQueryKeys = {
  all: ["achievements"] as const,
  types: () => [...achievementsQueryKeys.all, "types"] as const,
  myAchievements: () => [...achievementsQueryKeys.all, "my"] as const,
  stats: () => [...achievementsQueryKeys.all, "stats"] as const
} as const;

// Notification History Query Keys (used by useNotificationHistory, deepLinkHandler)
export const notificationHistoryQueryKeys = {
  all: ["notificationHistory"] as const,
  list: (type?: string) =>
    type
      ? ([...notificationHistoryQueryKeys.all, "list", type] as const)
      : ([...notificationHistoryQueryKeys.all, "list"] as const),
  unreadCount: () => [...notificationHistoryQueryKeys.all, "unreadCount"] as const
} as const;
