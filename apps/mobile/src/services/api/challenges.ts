import { BaseApiService, ApiResponse } from "./base";
import { ROUTES } from "@/lib/routes";

export type ChallengeType = "duration" | "target";
export type ChallengeStatus = "upcoming" | "active" | "completed" | "cancelled";

export interface Challenge {
  id: string;
  creator_id: string;
  title: string;
  description?: string;
  challenge_type: ChallengeType;
  start_date: string;
  end_date?: string;
  join_deadline?: string;
  target_value?: number;
  is_public: boolean;
  max_participants?: number;
  status: ChallengeStatus;
  goal_template?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  participants_count?: number;
  my_rank?: number;
  my_progress?: number;
}

export interface ChallengeParticipant {
  id: string;
  challenge_id: string;
  user_id: string;
  joined_at: string;
  points: number;
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
  start_date: string;
  join_deadline?: string;
  max_participants?: number;
  is_public: boolean;
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
   * Get list of challenges
   */
  async getChallenges(): Promise<ApiResponse<Challenge[]>> {
    return this.get<Challenge[]>(ROUTES.CHALLENGES.LIST);
  }

  /**
   * Get public challenges
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
}

export const challengesService = new ChallengesService();
