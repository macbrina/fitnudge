import { BaseApiService, ApiResponse } from "./base";
import { ROUTES } from "@/lib/routes";

export type ChallengeType =
  | "duration"
  | "target"
  | "checkin_count"
  | "streak"
  | "community"
  | "custom";
export type ChallengeStatus = "upcoming" | "active" | "completed" | "cancelled";

export interface ChallengeCreator {
  id: string;
  name?: string;
  username?: string;
  profile_picture_url?: string;
}

export interface ChallengeGoalTemplate {
  goal_type?: string;
  category?: string;
  frequency?: string;
  target_days?: number;
  days_of_week?: number[];
  target_checkins?: number;
  duration_days?: number;
  reminder_times?: string[];
  actionable_plan?: {
    status?: string;
    plan_type?: string;
    structured_data?: Record<string, unknown>;
    error_message?: string | null;
  } | null;
}

export interface Challenge {
  id: string;
  creator_id: string;
  created_by?: string; // Alternative field name from backend
  title: string;
  description?: string;
  challenge_type: ChallengeType;
  start_date: string;
  end_date?: string;
  join_deadline?: string;
  target_value?: number;
  is_public: boolean;
  is_active?: boolean;
  max_participants?: number;
  status: ChallengeStatus;
  goal_template?: ChallengeGoalTemplate;
  created_at: string;
  updated_at: string;
  // Creator info (from GET /challenges/:id)
  creator?: ChallengeCreator;
  // Participation info (from /challenges/my)
  participants_count?: number;
  my_rank?: number;
  my_progress?: number;
  is_creator?: boolean;
  is_participant?: boolean;
}

export interface ChallengeParticipant {
  id: string;
  challenge_id: string;
  user_id: string;
  joined_at: string;
  points: number;
  rank?: number | null;
  progress_data?: Record<string, unknown>;
  user?: {
    id: string;
    name: string;
    username?: string;
    profile_picture_url?: string;
  };
}

export interface ChallengeCheckIn {
  id: string;
  challenge_id: string;
  user_id: string;
  check_in_date: string;
  completed?: boolean;
  is_checked_in?: boolean;
  notes?: string;
  mood?: string;
  photo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface ChallengeCheckInRequest {
  check_in_date?: string;
  notes?: string;
  mood?: string;
  photo_url?: string;
}

export interface ChallengeCheckInResponse extends ChallengeCheckIn {
  points_earned: number;
  new_total_points: number;
  new_rank?: number;
}

export interface LeaderboardEntry {
  user_id: string;
  rank: number;
  points: number;
  total_check_ins: number;
  user?: {
    id: string;
    name: string;
    username?: string;
    profile_picture_url?: string;
  };
}

export interface ShareAsChallengeRequest {
  title?: string;
  description?: string;
  start_date: string; // Format: YYYY-MM-DD
  join_deadline?: string; // Format: YYYY-MM-DD
  max_participants?: number;
  is_public: boolean;
  archive_original_goal?: boolean; // Default: true
}

export interface ShareAsChallengeResponse {
  challenge_id: string;
  goal_id: string;
  title: string;
  start_date: string;
  end_date?: string;
  join_deadline?: string;
  is_public: boolean;
  message: string;
}

class ChallengesService extends BaseApiService {
  /**
   * Get list of all challenges (legacy - may return all public challenges)
   */
  async getChallenges(): Promise<ApiResponse<Challenge[]>> {
    return this.get<Challenge[]>(ROUTES.CHALLENGES.LIST);
  }

  /**
   * Get user's challenges (created or joined) - for GoalsScreen
   */
  async getMyChallenges(status?: string): Promise<ApiResponse<Challenge[]>> {
    const params = status ? `?status=${status}` : "";
    return this.get<Challenge[]>(`${ROUTES.CHALLENGES.MY}${params}`);
  }

  /**
   * Get public challenges for discovery - for SocialScreen
   */
  async getPublicChallenges(): Promise<ApiResponse<Challenge[]>> {
    return this.get<Challenge[]>(ROUTES.CHALLENGES.PUBLIC);
  }

  /**
   * Get a specific challenge
   */
  async getChallenge(id: string): Promise<ApiResponse<Challenge>> {
    return this.get<Challenge>(ROUTES.CHALLENGES.GET(id));
  }

  /**
   * Join a challenge
   */
  async joinChallenge(id: string): Promise<ApiResponse<ChallengeParticipant>> {
    return this.post<ChallengeParticipant>(ROUTES.CHALLENGES.JOIN(id), {});
  }

  /**
   * Leave a challenge
   */
  async leaveChallenge(id: string): Promise<ApiResponse<{ message: string }>> {
    return this.post<{ message: string }>(ROUTES.CHALLENGES.LEAVE(id), {});
  }

  /**
   * Check into a challenge
   */
  async checkIn(
    challengeId: string,
    data: ChallengeCheckInRequest = {}
  ): Promise<ApiResponse<ChallengeCheckInResponse>> {
    return this.post<ChallengeCheckInResponse>(
      ROUTES.CHALLENGES.CHECK_IN(challengeId),
      data
    );
  }

  /**
   * Get all check-ins for a challenge
   */
  async getCheckIns(
    challengeId: string
  ): Promise<ApiResponse<ChallengeCheckIn[]>> {
    return this.get<ChallengeCheckIn[]>(
      ROUTES.CHALLENGES.CHECK_INS(challengeId)
    );
  }

  /**
   * Get my check-ins for a challenge
   */
  async getMyCheckIns(
    challengeId: string
  ): Promise<ApiResponse<ChallengeCheckIn[]>> {
    return this.get<ChallengeCheckIn[]>(
      ROUTES.CHALLENGES.MY_CHECK_INS(challengeId)
    );
  }

  /**
   * Update a challenge check-in
   */
  async updateCheckIn(
    challengeId: string,
    checkInId: string,
    data: { notes?: string; mood?: string; photo_url?: string }
  ): Promise<ApiResponse<ChallengeCheckIn>> {
    return this.put<ChallengeCheckIn>(
      ROUTES.CHALLENGES.UPDATE_CHECK_IN(challengeId, checkInId),
      data
    );
  }

  /**
   * Delete a challenge check-in
   */
  async deleteCheckIn(
    challengeId: string,
    checkInId: string
  ): Promise<
    ApiResponse<{
      message: string;
      check_in_id: string;
      points_deducted: number;
      remaining_check_ins: number;
    }>
  > {
    return this.delete(
      ROUTES.CHALLENGES.DELETE_CHECK_IN(challengeId, checkInId)
    );
  }

  /**
   * Get challenge leaderboard
   */
  async getLeaderboard(
    challengeId: string
  ): Promise<ApiResponse<LeaderboardEntry[]>> {
    return this.get<LeaderboardEntry[]>(
      ROUTES.CHALLENGES.LEADERBOARD(challengeId)
    );
  }

  /**
   * Get challenge participants
   */
  async getParticipants(
    challengeId: string
  ): Promise<ApiResponse<ChallengeParticipant[]>> {
    return this.get<ChallengeParticipant[]>(
      ROUTES.CHALLENGES.PARTICIPANTS(challengeId)
    );
  }

  /**
   * Share a goal as a challenge
   */
  async shareGoalAsChallenge(
    goalId: string,
    data: ShareAsChallengeRequest
  ): Promise<ApiResponse<ShareAsChallengeResponse>> {
    return this.post<ShareAsChallengeResponse>(
      ROUTES.GOALS.SHARE_AS_CHALLENGE(goalId),
      data
    );
  }

  /**
   * Join a challenge via invite code
   */
  async joinViaInviteCode(
    inviteCode: string
  ): Promise<
    ApiResponse<{ message: string; challenge: { id: string; title: string } }>
  > {
    return this.post<{
      message: string;
      challenge: { id: string; title: string };
    }>(ROUTES.CHALLENGES.JOIN_VIA_INVITE(inviteCode), {});
  }

  /**
   * Send an in-app invite to a user
   */
  async sendInvite(
    challengeId: string,
    userId: string
  ): Promise<ApiResponse<{ message: string; invite_id: string }>> {
    return this.post<{ message: string; invite_id: string }>(
      ROUTES.CHALLENGES.INVITE(challengeId),
      { user_id: userId }
    );
  }

  /**
   * Generate a shareable invite link
   */
  async generateInviteLink(challengeId: string): Promise<
    ApiResponse<{
      invite_code: string;
      invite_link: string;
      expires_in_days: number;
    }>
  > {
    return this.post<{
      invite_code: string;
      invite_link: string;
      expires_in_days: number;
    }>(ROUTES.CHALLENGES.INVITE_LINK(challengeId), {});
  }

  /**
   * Get received challenge invites (invites where current user is the invitee)
   */
  async getReceivedInvites(): Promise<ApiResponse<ChallengeInvite[]>> {
    return this.get<ChallengeInvite[]>(ROUTES.CHALLENGES.INVITES_RECEIVED);
  }

  /**
   * Get sent challenge invites (invites where current user is the inviter)
   */
  async getSentInvites(): Promise<ApiResponse<ChallengeInvite[]>> {
    return this.get<ChallengeInvite[]>(ROUTES.CHALLENGES.INVITES_SENT);
  }

  /**
   * Accept a challenge invite
   */
  async acceptInvite(
    inviteId: string
  ): Promise<
    ApiResponse<{ message: string; challenge: { id: string; title: string } }>
  > {
    return this.post<{
      message: string;
      challenge: { id: string; title: string };
    }>(ROUTES.CHALLENGES.INVITE_ACCEPT(inviteId), {});
  }

  /**
   * Decline a challenge invite
   */
  async declineInvite(
    inviteId: string
  ): Promise<ApiResponse<{ message: string }>> {
    return this.post<{ message: string }>(
      ROUTES.CHALLENGES.INVITE_DECLINE(inviteId),
      {}
    );
  }

  /**
   * Cancel a challenge invite that the current user sent
   */
  async cancelInvite(
    inviteId: string
  ): Promise<ApiResponse<{ message: string }>> {
    return this.delete<{ message: string }>(
      ROUTES.CHALLENGES.INVITE_CANCEL(inviteId)
    );
  }
}

export interface ChallengeInvite {
  id: string;
  challenge_id: string;
  invited_by_user_id: string;
  invited_user_id?: string;
  invite_code?: string;
  status: "pending" | "accepted" | "declined" | "expired";
  created_at: string;
  expires_at?: string;
  accepted_at?: string;
  challenge?: {
    id: string;
    title: string;
    description?: string;
    start_date: string;
    end_date?: string;
    is_public?: boolean;
    challenge_type?: string;
  };
  inviter?: {
    id: string;
    name?: string;
    username?: string;
    profile_picture_url?: string;
  };
  invitee?: {
    id: string;
    name?: string;
    username?: string;
    profile_picture_url?: string;
  };
}

export const challengesService = new ChallengesService();
