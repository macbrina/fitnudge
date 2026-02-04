import { BaseApiService, ApiResponse } from "./base";
import { ROUTES } from "@/lib/routes";

// User Types - Aligned with V2 schema
export interface User {
  id: string;
  email: string;
  // password_hash is never returned to client, has_password is calculated server-side
  auth_provider: "email" | "google" | "apple";
  email_verified: boolean;

  // Profile
  username: string;
  name: string; // Display name
  profile_picture_url?: string;
  bio?: string;
  timezone: string;
  language: string; // Required, defaults to "en" if missing from API
  country?: string;

  // Status & Role
  status: "active" | "disabled" | "suspended";
  role?: "user" | "admin";

  // V2 Preferences
  motivation_style?: "supportive" | "tough_love" | "calm";
  morning_motivation_enabled?: boolean;
  morning_motivation_time?: string; // HH:MM format

  // Subscription
  plan: "free" | "premium";

  // Referral
  referral_code?: string;

  // Onboarding
  onboarding_completed_at?: string | null;

  // Metadata
  created_at: string;
  updated_at: string;
  last_login_at?: string;

  // Computed fields (from serialize_user in auth.py)
  linked_providers?: string[];
  has_password?: boolean; // Calculated from password_hash existence
}

/**
 * Backend API response type (may have fewer fields than User)
 * This matches UserProfileResponse from the backend
 */
export interface UserProfileResponse {
  id: string;
  email: string;
  name: string;
  username: string;
  profile_picture_url?: string;
  bio?: string;
  plan: string;
  timezone: string;
  language?: string;
  country?: string;
  email_verified: boolean;
  auth_provider: string;
  created_at: string;
  last_login_at?: string;
  linked_providers?: string[];
  has_password?: boolean;
  // These fields may be present but not in the response model
  status?: "active" | "disabled" | "suspended";
  role?: "user" | "admin";
  motivation_style?: "supportive" | "tough_love" | "calm";
  morning_motivation_enabled?: boolean;
  morning_motivation_time?: string;
  referral_code?: string;
  onboarding_completed_at?: string | null;
  updated_at?: string;
}

/**
 * Transform backend API response to frontend User type
 * Handles missing fields gracefully by providing defaults
 */
export function transformUserResponse(apiUser: UserProfileResponse): User {
  return {
    id: apiUser.id,
    email: apiUser.email,
    auth_provider: apiUser.auth_provider as "email" | "google" | "apple",
    email_verified: apiUser.email_verified,
    username: apiUser.username,
    name: apiUser.name,
    profile_picture_url: apiUser.profile_picture_url,
    bio: apiUser.bio,
    timezone: apiUser.timezone,
    language: apiUser.language || "en", // Default to "en" if missing
    country: apiUser.country,
    status: apiUser.status || "active", // Default to active if missing
    role: apiUser.role,
    motivation_style: apiUser.motivation_style,
    morning_motivation_enabled: apiUser.morning_motivation_enabled,
    morning_motivation_time: apiUser.morning_motivation_time,
    plan: apiUser.plan as "free" | "premium",
    referral_code: apiUser.referral_code,
    onboarding_completed_at: apiUser.onboarding_completed_at,
    created_at: apiUser.created_at,
    updated_at: apiUser.updated_at || apiUser.created_at, // Fallback to created_at if missing
    last_login_at: apiUser.last_login_at,
    linked_providers: apiUser.linked_providers,
    has_password: apiUser.has_password
  };
}

export interface UpdateUserRequest {
  name?: string;
  username?: string;
  bio?: string;
  timezone?: string;
  language?: string;
  country?: string;
  profile_picture_url?: string;
  motivation_style?: "supportive" | "tough_love" | "calm";
  morning_motivation_enabled?: boolean;
  morning_motivation_time?: string; // HH:MM format
}

export interface UserStats {
  total_goals: number;
  completed_goals: number;
  total_check_ins: number;
  current_streak: number;
  longest_streak: number;
}

// User Service
export class UserService extends BaseApiService {
  async getCurrentUser(): Promise<ApiResponse<User>> {
    const response = await this.get<UserProfileResponse>(ROUTES.USERS.PROFILE);
    // Transform the API response to match the User type
    if (response.data) {
      return {
        ...response,
        data: transformUserResponse(response.data)
      };
    }
    return response as ApiResponse<User>;
  }

  async getUserById(userId: string): Promise<ApiResponse<User>> {
    const response = await this.get<UserProfileResponse>(ROUTES.USERS.GET(userId));
    // Transform the API response to match the User type
    if (response.data) {
      return {
        ...response,
        data: transformUserResponse(response.data)
      };
    }
    return response as ApiResponse<User>;
  }

  async updateProfile(updates: UpdateUserRequest): Promise<ApiResponse<User>> {
    const response = await this.put<UserProfileResponse>(ROUTES.USERS.UPDATE_PROFILE, updates);
    // Transform the API response to match the User type
    if (response.data) {
      return {
        ...response,
        data: transformUserResponse(response.data)
      };
    }
    return response as ApiResponse<User>;
  }

  async deleteAccount(): Promise<ApiResponse> {
    return this.delete(ROUTES.USERS.DELETE_ACCOUNT);
  }

  async requestDataExport(): Promise<
    ApiResponse<{ success: boolean; message: string; export_id?: string }>
  > {
    return this.post<{ success: boolean; message: string; export_id?: string }>(
      ROUTES.DATA_EXPORT.REQUEST,
      {}
    );
  }

  async getDataExportStatus(exportId: string): Promise<
    ApiResponse<{
      id: string;
      status: string;
      created_at: string;
      completed_at?: string;
      download_url?: string;
      expires_at?: string;
    }>
  > {
    return this.get(ROUTES.DATA_EXPORT.STATUS(exportId));
  }

  async getUserStats(userId?: string): Promise<ApiResponse<UserStats>> {
    const endpoint = userId ? ROUTES.USERS.STATS(userId) : ROUTES.USERS.ME_STATS;
    return this.get<UserStats>(endpoint);
  }

  async updatePassword(currentPassword: string, newPassword: string): Promise<ApiResponse> {
    return this.post(ROUTES.USERS.CHANGE_PASSWORD, {
      current_password: currentPassword,
      new_password: newPassword
    });
  }

  async uploadProfilePicture(
    imageUri: string
  ): Promise<ApiResponse<{ profile_picture_url: string }>> {
    return this.post<{ profile_picture_url: string }>(ROUTES.USERS.PROFILE_PICTURE, {
      image_url: imageUri
    });
  }

  async deleteProfilePicture(): Promise<ApiResponse> {
    return this.delete(ROUTES.USERS.PROFILE_PICTURE);
  }

  async updateNotificationSettings(settings: {
    push_notifications?: boolean;
    motivation_reminders?: boolean;
    goal_reminders?: boolean;
  }): Promise<ApiResponse> {
    return this.put(ROUTES.USERS.NOTIFICATION_SETTINGS, settings);
  }

  async getNotificationSettings(): Promise<
    ApiResponse<{
      push_notifications: boolean;
      motivation_reminders: boolean;
      goal_reminders: boolean;
    }>
  > {
    return this.get(ROUTES.USERS.NOTIFICATION_SETTINGS);
  }

  /**
   * Get current user's referral code and link
   */
  async getReferralCode(): Promise<
    ApiResponse<{
      referral_code: string;
      referral_link: string;
    }>
  > {
    return this.get(ROUTES.USERS.REFERRAL_CODE);
  }

  /**
   * Get list of users referred by current user
   */
  async getMyReferrals(): Promise<
    ApiResponse<{
      referrals: Array<{
        id: string;
        username: string;
        name: string;
        profile_picture_url?: string | null;
        created_at: string;
        referral_bonus_granted_at?: string;
        bonus_days_referrer?: number;
        status?: "pending" | "subscribed" | "processing" | "rewarded" | "failed";
      }>;
      total_bonus_days_earned: number;
    }>
  > {
    return this.get(ROUTES.USERS.REFERRALS);
  }
}

// Export singleton instance
export const userService = new UserService();
