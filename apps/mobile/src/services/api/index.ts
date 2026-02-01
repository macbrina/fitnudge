// Export all services
export { BaseApiService, TokenManager, type ApiResponse } from "./base";
export {
  AuthService,
  authService,
  type LoginRequest,
  type LoginResponse,
  type SignupRequest
} from "./auth";
export {
  UserService,
  userService,
  type User,
  type UpdateUserRequest,
  type UserStats
} from "./user";
export {
  GoalsService,
  goalsService,
  type Goal,
  type CreateGoalRequest,
  type UpdateGoalRequest,
  type GoalTemplate,
  type GoalStatus
} from "./goals";
export {
  CheckInsService,
  checkInsService,
  type CheckIn,
  type CreateCheckInRequest,
  type UpdateCheckInRequest,
  type CheckInStats
} from "./checkins";
export {
  DailyMotivationService,
  dailyMotivationService,
  type DailyMotivation
} from "./dailyMotivations";
export {
  SubscriptionsService,
  subscriptionsService,
  type SubscriptionResponse,
  type FeaturesResponse,
  type PlanFeature
} from "./subscriptions";
export { MediaService, mediaService, type MediaUploadResponse } from "./media";
export {
  achievementsService,
  type AchievementType,
  type UserAchievement,
  type AchievementStats,
  type AchievementRarity,
  type AchievementCategory
} from "./achievements";
export {
  nudgesService,
  type Nudge,
  type NudgeType,
  type SendNudgeRequest,
  type UnreadCountResponse
} from "./nudges";
export {
  partnersService,
  type Partner,
  type PartnershipStatus,
  type PartnerRequest,
  type SearchUserResult
} from "./partners";
export { homeService, type PendingCheckIn, type HomeDashboardResponse } from "./home";

// Live Activities (iOS ActivityKit)
export {
  liveActivityService,
  type RegisterPushToStartTokenRequest,
  type RegisterActivityPushTokenRequest
} from "./liveActivity";

// Android Mode B (FCM → ongoing NextUp)
export { nextUpPushService, type RegisterFcmTokenRequest } from "./nextUpPush";

// Notifications
export {
  notificationsService,
  type NotificationHistoryItem,
  type NotificationType
} from "./notifications";

// Weekly Recaps
export {
  recapsService,
  type WeeklyRecap,
  type WeeklyRecapsListResponse,
  type WeeklyRecapStats,
  type GoalBreakdown,
  type CompletionRateTrend,
  type AchievementUnlocked,
  type PartnerContext
} from "./recaps";

// AI Coach
export {
  aiCoachService,
  type ConversationSummary,
  type ConversationDetail,
  type ConversationMessage,
  type RateLimitStatus,
  type FeatureAccessResponse,
  type StreamEvent
} from "./aiCoach";

// Analytics
export {
  analyticsService,
  type AnalyticsDashboard,
  type WeeklyConsistencyItem,
  type StreakHistoryItem,
  type MonthlyTrendItem,
  type SkipReasonItem
} from "./analytics";

// App Config (public, no auth required)
export {
  appConfigService,
  type AppConfigResponse,
  type AppConfigItem,
  type AppConfigKey,
  type AppConfigCategory
} from "./appConfig";

// Legacy compatibility - re-export the main services as apiService
export { authService as apiService } from "./auth";
