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
  current_period_start: string | null;
  current_period_end: string | null;
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

// Sync subscription request/response (2-tier system)
export interface SyncSubscriptionRequest {
  tier: "free" | "premium";
  is_active: boolean;
  expires_at?: string | null;
  will_renew: boolean;
  platform?: "ios" | "android" | "stripe" | "promo" | null;
  product_id?: string | null;
}

export interface SyncSubscriptionResponse {
  synced: boolean;
  message: string;
  previous_plan?: string;
  new_plan?: string;
  plan?: string;
}

// Subscription history response
export interface SubscriptionHistoryResponse {
  has_ever_subscribed: boolean;
  subscription_count: number;
  first_subscription_date: string | null;
  last_subscription_date: string | null;
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
    return this.post<VerifyPurchaseResponse>(`${ROUTES.SUBSCRIPTIONS.ME}/verify`, request);
  }

  /**
   * Restore purchases - fetches all purchases for this user
   */
  async restorePurchases(): Promise<ApiResponse<SubscriptionResponse>> {
    return this.post<SubscriptionResponse>(`${ROUTES.SUBSCRIPTIONS.ME}/restore`, {});
  }

  /**
   * Sync subscription from RevenueCat to backend database
   * Called when app detects potential mismatch between RevenueCat and backend
   */
  async syncSubscription(
    request: SyncSubscriptionRequest
  ): Promise<ApiResponse<SyncSubscriptionResponse>> {
    return this.post<SyncSubscriptionResponse>(ROUTES.SUBSCRIPTIONS.SYNC, request);
  }

  /**
   * Get subscription history to check if user has ever subscribed
   * Used for exit offer eligibility - users who have previously subscribed
   * should not see the exit offer discount
   */
  async getSubscriptionHistory(): Promise<ApiResponse<SubscriptionHistoryResponse>> {
    return this.get<SubscriptionHistoryResponse>(ROUTES.SUBSCRIPTIONS.HISTORY);
  }
}

// Export singleton instance
export const subscriptionsService = new SubscriptionsService();
