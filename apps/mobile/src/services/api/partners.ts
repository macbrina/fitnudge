import { BaseApiService, ApiResponse } from "./base";
import { ROUTES } from "@/lib/routes";

export type PartnershipStatus = "pending" | "accepted" | "rejected";

export interface PartnerUserInfo {
  id: string;
  name?: string;
  username?: string;
  profile_picture_url?: string;
  has_partner_feature?: boolean; // Whether partner has accountability_partner_limit feature
  is_active?: boolean; // Whether partner's account is active
}

export interface PartnerTodayGoal {
  id: string;
  title: string;
  logged_today: boolean;
  is_scheduled_today: boolean;
}

export interface Partner {
  id: string;
  user_id: string;
  partner_user_id: string;
  status: PartnershipStatus;
  initiated_by_user_id: string;
  created_at: string;
  accepted_at?: string;
  partner?: PartnerUserInfo;
  has_active_items?: boolean; // Whether partner has active goals
  // Extended fields (when include_today_goals=true)
  overall_streak?: number;
  today_goals?: PartnerTodayGoal[];
  logged_today?: boolean;
}

// Partner Dashboard types (for viewing partner's goals)
// V2: Only exposes what accountability partners need to see
export interface PartnerGoalSummary {
  id: string;
  title: string;
  status: string;
  frequency_type: "daily" | "weekly";
  current_streak: number;
  logged_today: boolean;
}

export interface PartnerDashboard {
  partner: PartnerUserInfo;
  partnership_id: string;
  partnership_created_at: string;
  goals: PartnerGoalSummary[];
  total_active_goals: number;
  overall_streak: number;
  logged_today: boolean;
  has_scheduled_today: boolean; // Whether partner has any goals scheduled for today
}

export interface PartnerLimits {
  has_feature: boolean;
  limit: number | null; // null = unlimited
  accepted_count: number;
  pending_sent_count: number;
  total_toward_limit: number;
  can_send_request: boolean;
}

export interface PartnerRequest {
  partner_user_id: string;
  message?: string;
}

export type RequestStatus = "none" | "sent" | "received" | "accepted";

export interface SearchUserResult {
  id: string;
  name: string;
  username?: string;
  profile_picture_url?: string;
  last_active_at?: string; // ISO timestamp for activity indicator
  is_partner?: boolean;
  has_pending_request?: boolean;
  request_status?: RequestStatus;
  partnership_id?: string;
  // V2 Smart Matching fields
  match_score?: number; // 0-100 match percentage
  match_reasons?: string[]; // ["Similar goals", "Same timezone"]
  matched_goals?: string[]; // Goal titles they share
}

export interface PaginatedSearchResponse {
  users: SearchUserResult[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

class PartnersService extends BaseApiService {
  /**
   * Get list of accepted accountability partners
   * @param includeTodayGoals - If true, includes today's goals with check-in status
   */
  async getPartners(includeTodayGoals: boolean = false): Promise<ApiResponse<Partner[]>> {
    const params = includeTodayGoals ? "?include_today_goals=true" : "";
    return this.get<Partner[]>(`${ROUTES.PARTNERS.LIST}${params}`);
  }

  /**
   * Get pending partner requests received by current user
   */
  async getPendingRequests(): Promise<ApiResponse<Partner[]>> {
    return this.get<Partner[]>(ROUTES.PARTNERS.PENDING);
  }

  /**
   * Get partner requests sent by current user (outgoing requests)
   */
  async getSentRequests(): Promise<ApiResponse<Partner[]>> {
    return this.get<Partner[]>(ROUTES.PARTNERS.SENT);
  }

  /**
   * Get blocked partners
   */
  async getBlockedPartners(): Promise<ApiResponse<Partner[]>> {
    return this.get<Partner[]>(ROUTES.PARTNERS.BLOCKED);
  }

  /**
   * Send a partner request to another user
   */
  async sendRequest(data: PartnerRequest): Promise<ApiResponse<Partner>> {
    return this.post<Partner>(ROUTES.PARTNERS.REQUEST, data);
  }

  /**
   * Accept a partner request
   */
  async acceptRequest(partnershipId: string): Promise<ApiResponse<Partner>> {
    return this.post<Partner>(ROUTES.PARTNERS.ACCEPT(partnershipId), {});
  }

  /**
   * Reject a partner request (when someone sent you a request)
   */
  async rejectRequest(partnershipId: string): Promise<ApiResponse<{ message: string }>> {
    return this.post<{ message: string }>(ROUTES.PARTNERS.REJECT(partnershipId), {});
  }

  /**
   * Cancel a partner request that you initiated
   */
  async cancelRequest(partnershipId: string): Promise<ApiResponse<{ message: string }>> {
    return this.post<{ message: string }>(ROUTES.PARTNERS.CANCEL(partnershipId), {});
  }

  /**
   * Remove an existing partner
   */
  async removePartner(partnershipId: string): Promise<ApiResponse<{ message: string }>> {
    return this.delete<{ message: string }>(ROUTES.PARTNERS.REMOVE(partnershipId));
  }

  /**
   * Block a partner - prevents future matching
   */
  async blockPartner(partnershipId: string): Promise<ApiResponse<{ message: string }>> {
    return this.post<{ message: string }>(ROUTES.PARTNERS.BLOCK(partnershipId), {});
  }

  /**
   * Unblock a partner
   */
  async unblockPartner(partnershipId: string): Promise<ApiResponse<{ message: string }>> {
    return this.post<{ message: string }>(ROUTES.PARTNERS.UNBLOCK(partnershipId), {});
  }

  /**
   * Report a user for inappropriate username or behavior
   */
  async reportUser(
    userId: string,
    reason: "inappropriate_username" | "harassment" | "spam" | "other",
    details?: string,
    blockPartner?: boolean
  ): Promise<ApiResponse<{ message: string; report_id?: string; blocked?: boolean }>> {
    return this.post<{ message: string; report_id?: string; blocked?: boolean }>(
      ROUTES.PARTNERS.REPORT(userId),
      {
        reason,
        details,
        block_partner: blockPartner ?? false
      }
    );
  }

  /**
   * Search for users to add as partners (with pagination)
   */
  async searchUsers(
    query: string,
    page: number = 1,
    limit: number = 20
  ): Promise<ApiResponse<PaginatedSearchResponse>> {
    const params = new URLSearchParams();
    params.append("query", query);
    params.append("page", page.toString());
    params.append("limit", limit.toString());

    return this.get<PaginatedSearchResponse>(
      `${ROUTES.PARTNERS.SEARCH_USERS}?${params.toString()}`
    );
  }

  /**
   * Get suggested users to add as partners (with pagination)
   */
  async getSuggestedUsers(
    page: number = 1,
    limit: number = 20
  ): Promise<ApiResponse<PaginatedSearchResponse>> {
    const params = new URLSearchParams();
    params.append("page", page.toString());
    params.append("limit", limit.toString());

    return this.get<PaginatedSearchResponse>(
      `${ROUTES.PARTNERS.SUGGESTED_USERS}?${params.toString()}`
    );
  }

  /**
   * Get partner's accountability dashboard (goals, progress)
   */
  async getPartnerDashboard(partnerUserId: string): Promise<ApiResponse<PartnerDashboard>> {
    return this.get<PartnerDashboard>(ROUTES.PARTNERS.DASHBOARD(partnerUserId));
  }

  /**
   * Get current user's partner limits and counts
   */
  async getPartnerLimits(): Promise<ApiResponse<PartnerLimits>> {
    return this.get<PartnerLimits>(ROUTES.PARTNERS.LIMITS);
  }
}

export const partnersService = new PartnersService();
