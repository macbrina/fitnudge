// Export all services
export { BaseApiService, TokenManager, type ApiResponse } from "./base";
export {
  AuthService,
  authService,
  type LoginRequest,
  type LoginResponse,
  type SignupRequest,
} from "./auth";
export {
  UserService,
  userService,
  type User,
  type UpdateUserRequest,
  type UserStats,
} from "./user";
export {
  GoalsService,
  goalsService,
  type Goal,
  type CreateGoalRequest,
  type UpdateGoalRequest,
  type GoalTemplate,
  type GoalStats,
} from "./goals";
export {
  CheckInsService,
  checkInsService,
  type CheckIn,
  type CreateCheckInRequest,
  type UpdateCheckInRequest,
  type CheckInStats,
  type CheckInCalendar,
} from "./checkins";
export {
  SocialService,
  socialService,
  type Post,
  type CreatePostRequest,
  type Comment,
  type CreateCommentRequest,
  type UserProfile,
} from "./social";

// Legacy compatibility - re-export the main services as apiService
export { authService as apiService } from "./auth";
