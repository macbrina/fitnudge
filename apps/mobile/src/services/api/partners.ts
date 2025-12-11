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

export interface SearchUserResult {
  id: string;
  name: string;
  username?: string;
  profile_picture_url?: string;
  is_partner?: boolean;
  has_pending_request?: boolean;
}

class PartnersService extends BaseApiService {
  /**
   * Get list of accepted accountability partners
   */
  async getPartners(): Promise<ApiResponse<Partner[]>> {
    return this.get<Partner[]>(ROUTES.PARTNERS.LIST);
  }

  /**
   * Get pending partner requests (both sent and received)
   */
  async getPendingRequests(): Promise<ApiResponse<Partner[]>> {
    return this.get<Partner[]>(ROUTES.PARTNERS.PENDING);
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
   * Reject a partner request
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
   * Search for users to add as partners
   */
  async searchUsers(
    query: string,
    limit: number = 20
  ): Promise<ApiResponse<SearchUserResult[]>> {
    const params = new URLSearchParams();
    params.append("q", query);
    params.append("limit", limit.toString());

    return this.get<SearchUserResult[]>(
      `${ROUTES.PARTNERS.SEARCH_USERS}?${params.toString()}`
    );
  }
}

export const partnersService = new PartnersService();
