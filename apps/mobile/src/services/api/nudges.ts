import { BaseApiService, ApiResponse } from "./base";
import { ROUTES } from "@/lib/routes";

export type NudgeType = "nudge" | "cheer" | "milestone" | "competitive" | "custom";

export interface Nudge {
  id: string;
  sender_id: string;
  recipient_id: string;
  nudge_type: NudgeType;
  message?: string;
  emoji?: string;
  goal_id?: string;
  challenge_id?: string;
  partnership_id?: string;
  is_ai_generated: boolean;
  is_read: boolean;
  created_at: string;
  sender?: {
    id: string;
    name: string;
    username?: string;
    profile_picture_url?: string;
  };
}

export interface SendNudgeRequest {
  recipient_id: string;
  nudge_type: NudgeType;
  message?: string;
  emoji?: string;
  goal_id?: string;
  challenge_id?: string;
  partnership_id?: string;
}

export interface UnreadCountResponse {
  unread_count: number;
}

class NudgesService extends BaseApiService {
  /**
   * Get nudges received by the current user
   */
  async getNudges(
    unreadOnly: boolean = false,
    limit: number = 50,
    offset: number = 0
  ): Promise<ApiResponse<Nudge[]>> {
    const params = new URLSearchParams();
    if (unreadOnly) params.append("unread_only", "true");
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    return this.get<Nudge[]>(`${ROUTES.NUDGES.LIST}?${params.toString()}`);
  }

  /**
   * Get nudges sent by the current user
   */
  async getSentNudges(limit: number = 50, offset: number = 0): Promise<ApiResponse<Nudge[]>> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    return this.get<Nudge[]>(`${ROUTES.NUDGES.SENT}?${params.toString()}`);
  }

  /**
   * Get unread nudge count
   */
  async getUnreadCount(): Promise<ApiResponse<UnreadCountResponse>> {
    return this.get<UnreadCountResponse>(ROUTES.NUDGES.UNREAD_COUNT);
  }

  /**
   * Send a nudge to another user
   */
  async sendNudge(data: SendNudgeRequest): Promise<ApiResponse<Nudge>> {
    return this.post<Nudge>(ROUTES.NUDGES.SEND, data);
  }

  /**
   * Mark a nudge as read
   */
  async markAsRead(nudgeId: string): Promise<ApiResponse<{ message: string }>> {
    return this.patch<{ message: string }>(ROUTES.NUDGES.MARK_READ(nudgeId), {});
  }

  /**
   * Mark all nudges as read
   */
  async markAllAsRead(): Promise<ApiResponse<{ message: string; count: number }>> {
    return this.patch<{ message: string; count: number }>(ROUTES.NUDGES.MARK_ALL_READ, {});
  }

  /**
   * Delete a nudge (only allowed by sender)
   */
  async deleteNudge(nudgeId: string): Promise<ApiResponse<{ message: string }>> {
    return this.delete<{ message: string }>(ROUTES.NUDGES.DELETE(nudgeId));
  }
}

export const nudgesService = new NudgesService();
