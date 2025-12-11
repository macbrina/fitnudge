import { BaseApiService, ApiResponse } from "./base";
import { ROUTES } from "@/lib/routes";

// Subscription Types
export interface SubscriptionResponse {
  id: string | null; // None for free users
  user_id: string;
  plan: string;
  status: string;
  platform: string | null; // None for free users
  product_id: string | null; // None for free users
  purchase_date: string | null; // None or user.created_at for free users
  expires_date: string | null;
  auto_renew: boolean;
  created_at: string | null; // None for free users
  updated_at: string | null; // None for free users
}

// Purchase verification types
export interface VerifyPurchaseRequest {
  platform: "ios" | "android";
  product_id: string;
  transaction_id: string;
  receipt: string;
  original_transaction_id?: string;
}

export interface VerifyPurchaseResponse {
  success: boolean;
  subscription_id?: string;
  plan?: string;
  expires_at?: string;
  error?: string;
}

export interface PlanFeature {
  id: string;
  feature_key: string;
  feature_name: string;
  feature_description: string | null;
  feature_value: number | null;
  is_enabled: boolean;
  sort_order: number;
  minimum_tier: number;
}

export interface FeaturesResponse {
  plan: string;
  tier: number;
  features: Record<string, any>; // Feature key -> value/enabled mapping
  features_list: PlanFeature[]; // Full feature objects with metadata
}

// Subscriptions Service
export class SubscriptionsService extends BaseApiService {
  /**
   * Get current user's subscription (or free plan info)
   */
  async getMySubscription(): Promise<ApiResponse<SubscriptionResponse>> {
    return this.get<SubscriptionResponse>(ROUTES.SUBSCRIPTIONS.ME);
  }

  /**
   * Get features available for current user's plan using tier-based system
   */
  async getAvailableFeatures(): Promise<ApiResponse<FeaturesResponse>> {
    return this.get<FeaturesResponse>(ROUTES.SUBSCRIPTIONS.FEATURES);
  }

  /**
   * Verify an in-app purchase with the backend
   * Backend will validate with Apple/Google and update subscription
   */
  async verifyPurchase(
    request: VerifyPurchaseRequest
  ): Promise<ApiResponse<VerifyPurchaseResponse>> {
    return this.post<VerifyPurchaseResponse>(
      `${ROUTES.SUBSCRIPTIONS.ME}/verify`,
      request
    );
  }

  /**
   * Restore purchases - fetches all purchases for this user
   */
  async restorePurchases(): Promise<ApiResponse<SubscriptionResponse>> {
    return this.post<SubscriptionResponse>(
      `${ROUTES.SUBSCRIPTIONS.ME}/restore`,
      {}
    );
  }
}

// Export singleton instance
export const subscriptionsService = new SubscriptionsService();
