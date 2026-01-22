import { BaseApiService } from "./base";
import { ROUTES } from "@/lib/routes";

export interface PlanFeature {
  id: string;
  feature_key: string;
  feature_name: string;
  feature_description: string | null;
  feature_value: number | null;
  is_enabled: boolean;
  sort_order: number;
  minimum_tier: number; // 0=free, 1=premium
}

export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  monthly_price: number;
  annual_price: number;
  active_goal_limit: number | null; // null means unlimited
  features: PlanFeature[];
  is_popular: boolean;
  has_trial: boolean;
  trial_days: number | null;
  is_active: boolean;
  sort_order: number;
  // IAP Product IDs (from database)
  product_id_ios_monthly: string | null;
  product_id_ios_annual: string | null;
  product_id_android_monthly: string | null;
  product_id_android_annual: string | null;
  // Exit-offer fields
  exit_offer_enabled: boolean;
  exit_offer_monthly_price: number | null;
  exit_offer_annual_price: number | null;
}

export interface SubscriptionPlansResponse {
  plans: PricingPlan[];
}

export class SubscriptionPlansApiService extends BaseApiService {
  /**
   * Get all active subscription plans
   */
  async getPlans(): Promise<PricingPlan[]> {
    const response = await this.get<SubscriptionPlansResponse>(ROUTES.SUBSCRIPTION_PLANS.PLANS);
    return response.data?.plans ?? [];
  }

  /**
   * Get a specific subscription plan by ID
   */
  async getPlan(planId: string): Promise<PricingPlan | null> {
    const response = await this.get<PricingPlan>(
      ROUTES.SUBSCRIPTION_PLANS.PLAN_BY_ID.replace(":id", planId)
    );

    return response.data ?? null;
  }
}

// Export singleton instance
export const subscriptionPlansApi = new SubscriptionPlansApiService();
