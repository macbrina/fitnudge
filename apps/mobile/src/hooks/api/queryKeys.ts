/**
 * Shared Query Keys
 *
 * Centralized query keys to avoid circular dependencies between hooks.
 * These keys are used by useGoals and useActionablePlans which have cross-dependencies.
 */

// Goals Query Keys
export const goalsQueryKeys = {
  all: ["goals"] as const,
  list: () => [...goalsQueryKeys.all, "list"] as const,
  detail: (id: string) => [...goalsQueryKeys.all, "detail", id] as const,
  templates: () => [...goalsQueryKeys.all, "templates"] as const,
  stats: (id?: string) => [...goalsQueryKeys.all, "stats", id] as const,
  byCategory: (category: string) =>
    [...goalsQueryKeys.all, "category", category] as const,
  active: () => [...goalsQueryKeys.all, "active"] as const,
  completed: () => [...goalsQueryKeys.all, "completed"] as const,
} as const;

// Actionable Plans Query Keys
export const actionablePlansQueryKeys = {
  all: ["actionable-plans"] as const,
  planStatus: (goalId: string) =>
    ["actionable-plans", "status", goalId] as const,
  plan: (goalId: string) => ["actionable-plans", "plan", goalId] as const,
} as const;

// User Query Keys (matches useUser.ts)
export const userQueryKeys = {
  currentUser: ["user", "current"] as const,
  userById: (id: string) => ["user", id] as const,
  userStats: (id?: string) => ["user", "stats", id] as const,
  notificationSettings: ["user", "notification-settings"] as const,
} as const;

// Check-ins Query Keys (matches useCheckIns.ts)
export const checkInsQueryKeys = {
  all: ["checkIns"] as const,
  list: (goalId?: string) =>
    [...checkInsQueryKeys.all, "list", goalId] as const,
  detail: (id: string) => [...checkInsQueryKeys.all, "detail", id] as const,
  stats: (goalId?: string) =>
    [...checkInsQueryKeys.all, "stats", goalId] as const,
  calendar: (year: number, month: number, goalId?: string) =>
    [...checkInsQueryKeys.all, "calendar", year, month, goalId] as const,
  today: () => [...checkInsQueryKeys.all, "today"] as const,
  streak: (goalId?: string) =>
    [...checkInsQueryKeys.all, "streak", goalId] as const,
  moodTrends: (goalId?: string, days?: number) =>
    [...checkInsQueryKeys.all, "moodTrends", goalId, days] as const,
} as const;

// Challenges Query Keys (matches useChallenges.ts)
export const challengesQueryKeys = {
  all: ["challenges"] as const,
  list: () => [...challengesQueryKeys.all, "list"] as const,
  public: () => [...challengesQueryKeys.all, "public"] as const,
  detail: (id: string) => [...challengesQueryKeys.all, "detail", id] as const,
  leaderboard: (id: string) =>
    [...challengesQueryKeys.all, "leaderboard", id] as const,
  participants: (id: string) =>
    [...challengesQueryKeys.all, "participants", id] as const,
  checkIns: (id: string) =>
    [...challengesQueryKeys.all, "check-ins", id] as const,
  myCheckIns: (id: string) =>
    [...challengesQueryKeys.all, "my-check-ins", id] as const,
} as const;

// Nudges Query Keys (matches useNudges.ts)
export const nudgesQueryKeys = {
  all: ["nudges"] as const,
  list: () => [...nudgesQueryKeys.all, "list"] as const,
  listFiltered: (unreadOnly: boolean) =>
    [...nudgesQueryKeys.list(), { unreadOnly }] as const,
  sent: () => [...nudgesQueryKeys.all, "sent"] as const,
  unreadCount: () => [...nudgesQueryKeys.all, "unread-count"] as const,
} as const;

// Partners Query Keys (matches usePartners.ts)
export const partnersQueryKeys = {
  all: ["partners"] as const,
  list: () => [...partnersQueryKeys.all, "list"] as const,
  pending: () => [...partnersQueryKeys.all, "pending"] as const,
  sent: () => [...partnersQueryKeys.all, "sent"] as const,
  search: (query: string) =>
    [...partnersQueryKeys.all, "search", query] as const,
  searchInfinite: (query: string) =>
    [...partnersQueryKeys.all, "search-infinite", query] as const,
  suggested: () => [...partnersQueryKeys.all, "suggested"] as const,
  suggestedInfinite: () =>
    [...partnersQueryKeys.all, "suggested-infinite"] as const,
} as const;

// Challenge Invites Query Keys
export const challengeInvitesQueryKeys = {
  all: ["challenge-invites"] as const,
  received: () => [...challengeInvitesQueryKeys.all, "received"] as const,
  sent: () => [...challengeInvitesQueryKeys.all, "sent"] as const,
} as const;
