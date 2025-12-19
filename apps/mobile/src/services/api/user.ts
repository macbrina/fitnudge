import { BaseApiService, ApiResponse } from "./base";
import { ROUTES } from "@/lib/routes";

// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  username: string;
  plan: string;
  email_verified: boolean;
  auth_provider: string;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
  is_active: boolean;
  profile_picture_url?: string;
  bio?: string;
  timezone: string;
  language: string;
}

export interface UpdateUserRequest {
  name?: string;
  username?: string;
  bio?: string;
  timezone?: string;
  language?: string;
  profile_picture_url?: string;
}

export interface UserStats {
  total_goals: number;
  completed_goals: number;
  total_check_ins: number;
  current_streak: number;
  longest_streak: number;
  followers_count: number;
  following_count: number;
  posts_count: number;
}

// User Service
export class UserService extends BaseApiService {
  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.get<User>(ROUTES.USERS.PROFILE);
  }

  async getUserById(userId: string): Promise<ApiResponse<User>> {
    return this.get<User>(ROUTES.USERS.GET(userId));
  }

  async updateProfile(updates: UpdateUserRequest): Promise<ApiResponse<User>> {
    return this.put<User>(ROUTES.USERS.UPDATE_PROFILE, updates);
  }

  async deleteAccount(): Promise<ApiResponse> {
    return this.delete(ROUTES.USERS.DELETE_ACCOUNT);
  }

  async exportData(): Promise<ApiResponse<{ download_url: string }>> {
    return this.get<{ download_url: string }>(ROUTES.USERS.EXPORT_DATA);
  }

  async getUserStats(userId?: string): Promise<ApiResponse<UserStats>> {
    const endpoint = userId
      ? ROUTES.USERS.STATS(userId)
      : ROUTES.USERS.ME_STATS;
    return this.get<UserStats>(endpoint);
  }

  async updatePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<ApiResponse> {
    return this.post(ROUTES.USERS.CHANGE_PASSWORD, {
      current_password: currentPassword,
      new_password: newPassword,
    });
  }

  async uploadProfilePicture(
    imageUri: string
  ): Promise<ApiResponse<{ profile_picture_url: string }>> {
    // This would typically upload to your media service first
    // For now, we'll assume the imageUri is already uploaded
    return this.post<{ profile_picture_url: string }>(
      ROUTES.USERS.PROFILE_PICTURE,
      {
        image_url: imageUri,
      }
    );
  }

  async deleteProfilePicture(): Promise<ApiResponse> {
    return this.delete(ROUTES.USERS.PROFILE_PICTURE);
  }

  async updateNotificationSettings(settings: {
    email_notifications?: boolean;
    push_notifications?: boolean;
    motivation_reminders?: boolean;
    goal_reminders?: boolean;
    social_notifications?: boolean;
  }): Promise<ApiResponse> {
    return this.put(ROUTES.USERS.NOTIFICATION_SETTINGS, settings);
  }

  async getNotificationSettings(): Promise<
    ApiResponse<{
      email_notifications: boolean;
      push_notifications: boolean;
      motivation_reminders: boolean;
      goal_reminders: boolean;
      social_notifications: boolean;
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
    ApiResponse<
      Array<{
        id: string;
        username: string;
        name: string;
        created_at: string;
        referral_bonus_granted_at?: string;
      }>
    >
  > {
    return this.get(ROUTES.USERS.REFERRALS);
  }
}

// Export singleton instance
export const userService = new UserService();
