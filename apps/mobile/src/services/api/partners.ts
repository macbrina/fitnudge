import { BaseApiService, ApiResponse } from "./base";
import { ROUTES } from "@/lib/routes";

export type PartnershipStatus = "pending" | "accepted" | "rejected";

export interface Partner {
  id: string;
  user_id: string;
  partner_user_id: string;
  status: PartnershipStatus;
  initiated_by_user_id: string;
  created_at: string;
  accepted_at?: string;
  partner?: {
    id: string;
    name: string;
    username?: string;
    profile_picture_url?: string;
  };
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
  async rejectRequest(
    partnershipId: string
  ): Promise<ApiResponse<{ message: string }>> {
    return this.post<{ message: string }>(
      ROUTES.PARTNERS.REJECT(partnershipId),
      {}
    );
  }

  /**
   * Cancel a partner request that you initiated
   */
  async cancelRequest(
    partnershipId: string
  ): Promise<ApiResponse<{ message: string }>> {
    return this.post<{ message: string }>(
      ROUTES.PARTNERS.CANCEL(partnershipId),
      {}
    );
  }

  /**
   * Remove an existing partner
   */
  async removePartner(
    partnershipId: string
  ): Promise<ApiResponse<{ message: string }>> {
    return this.delete<{ message: string }>(
      ROUTES.PARTNERS.REMOVE(partnershipId)
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
}

export const partnersService = new PartnersService();
