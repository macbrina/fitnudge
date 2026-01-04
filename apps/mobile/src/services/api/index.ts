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
  type GoalStats
} from "./goals";
export {
  CheckInsService,
  checkInsService,
  type CheckIn,
  type CreateCheckInRequest,
  type UpdateCheckInRequest,
  type CheckInStats,
  type CheckInCalendar
} from "./checkins";
export {
  SocialService,
  socialService,
  type Post,
  type CreatePostRequest,
  type Comment,
  type CreateCommentRequest,
  type UserProfile
} from "./social";
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
  actionablePlansService,
  type PlanStatus,
  type PlanStatusResponse,
  type ActionablePlan,
  type GoalPlanResponse
} from "./actionablePlans";
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
  challengesService,
  type Challenge,
  type ChallengeType,
  type ChallengeStatus,
  type ChallengeParticipant,
  type ChallengeCheckIn,
  type ChallengeCheckInRequest,
  type ChallengeCheckInResponse,
  type LeaderboardEntry,
  type ShareAsChallengeRequest,
  type ShareAsChallengeResponse
} from "./challenges";
export {
  partnersService,
  type Partner,
  type PartnershipStatus,
  type PartnerRequest,
  type SearchUserResult
} from "./partners";
export {
  homeService,
  type ActiveItem,
  type PendingCheckIn,
  type DashboardStats,
  type HomeDashboardResponse
} from "./home";

// Tracking Stats
export {
  trackingStatsService,
  type TrackingStatsResponse,
  type TrackingType,
  type WorkoutStats,
  type MealStats,
  type HydrationStats,
  type CheckinStats
} from "./trackingStats";

// Notifications
export {
  notificationsService,
  type NotificationHistoryItem,
  type NotificationType
} from "./notifications";

// Legacy compatibility - re-export the main services as apiService
export { authService as apiService } from "./auth";
