import { BaseApiService, ApiResponse } from "./base";
import { ROUTES } from "@/lib/routes";

export type PartnershipStatus = "pending" | "accepted" | "rejected";

export interface PartnerUserInfo {
  id: string;
  name?: string;
  username?: string;
  profile_picture_url?: string;
  has_social_accountability?: boolean;
  is_active?: boolean; // Whether partner's account is active
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
  has_active_items?: boolean; // Whether partner has active goals or challenges
}

// Partner Dashboard types (for viewing partner's goals and challenges)
export interface PartnerGoalSummary {
  id: string;
  title: string;
  category: string;
  tracking_type?: string;
  status: string;
  progress_percentage: number;
  current_streak: number;
  logged_today: boolean;
  frequency?: string;
}

export interface PartnerChallengeSummary {
  id: string;
  title: string;
  category?: string;
  tracking_type?: string;
  status: string;
  progress: number;
  target_value?: number;
  participants_count: number;
  logged_today: boolean;
}

export interface PartnerDashboard {
  partner: PartnerUserInfo;
  partnership_id: string;
  partnership_created_at: string;
  goals: PartnerGoalSummary[];
  challenges: PartnerChallengeSummary[];
  total_active_goals: number;
  total_active_challenges: number;
  overall_streak: number;
  logged_today: boolean;
  has_scheduled_today: boolean; // Whether partner has any goals/challenges scheduled for today
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
  is_partner?: boolean;
  has_pending_request?: boolean;
  request_status?: RequestStatus;
  partnership_id?: string;
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
   */
  async getPartners(): Promise<ApiResponse<Partner[]>> {
    return this.get<Partner[]>(ROUTES.PARTNERS.LIST);
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
   * Get partner's accountability dashboard (goals, challenges, progress)
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
