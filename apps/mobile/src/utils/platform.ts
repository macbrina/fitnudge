/**
 * Platform Detection Utilities
 *
 * Provides simple helpers to detect the current platform (iOS/Android)
 * and utility functions for working with IAP product IDs from the database.
 */

import { Platform } from "react-native";

// Platform detection
export const isIOS = Platform.OS === "ios";
export const isAndroid = Platform.OS === "android";

export type PlanId = "starter" | "pro" | "elite";
export type BillingPeriod = "monthly" | "annual";

/**
 * Plan product IDs fetched from database
 * These come from the subscription_plans table
 */
export interface PlanProductIds {
  plan_id: string;
  product_id_ios_monthly: string | null;
  product_id_ios_annual: string | null;
  product_id_android_monthly: string | null;
  product_id_android_annual: string | null;
}

/**
 * Exit offer pricing from database
 */
export interface ExitOfferPricing {
  plan_id: string;
  exit_offer_enabled: boolean;
  exit_offer_monthly_price: number | null;
  exit_offer_annual_price: number | null;
}

/**
 * Get the product ID for a specific plan and period based on current platform
 * @param productIds - Product IDs object from database
 * @param period - Billing period (monthly or annual)
 */
export function getProductIdFromPlan(
  productIds: PlanProductIds,
  period: BillingPeriod
): string | null {
  if (isIOS) {
    return period === "monthly"
      ? productIds.product_id_ios_monthly
      : productIds.product_id_ios_annual;
  } else {
    return period === "monthly"
      ? productIds.product_id_android_monthly
      : productIds.product_id_android_annual;
  }
}

/**
 * Get all product IDs for the current platform from a list of plans
 * @param plans - Array of plan product IDs from database
 */
export function getAllProductIdsFromPlans(plans: PlanProductIds[]): string[] {
  const ids: string[] = [];

  plans.forEach((plan) => {
    const monthlyId = isIOS
      ? plan.product_id_ios_monthly
      : plan.product_id_android_monthly;
    const annualId = isIOS
      ? plan.product_id_ios_annual
      : plan.product_id_android_annual;

    if (monthlyId) ids.push(monthlyId);
    if (annualId) ids.push(annualId);
  });

  return ids;
}

/**
 * Find plan info from a store product ID
 * @param productId - Product ID from the store
 * @param plans - Array of plan product IDs from database
 */
export function getPlanFromProductId(
  productId: string,
  plans: PlanProductIds[]
): { planId: string; period: BillingPeriod } | null {
  for (const plan of plans) {
    // Check iOS product IDs
    if (plan.product_id_ios_monthly === productId) {
      return { planId: plan.plan_id, period: "monthly" };
    }
    if (plan.product_id_ios_annual === productId) {
      return { planId: plan.plan_id, period: "annual" };
    }
    // Check Android product IDs
    if (plan.product_id_android_monthly === productId) {
      return { planId: plan.plan_id, period: "monthly" };
    }
    if (plan.product_id_android_annual === productId) {
      return { planId: plan.plan_id, period: "annual" };
    }
  }
  return null;
}

/**
 * Platform display name
 */
export function getPlatformName(): "iOS" | "Android" {
  return isIOS ? "iOS" : "Android";
}

/**
 * Store display name
 */
export function getStoreName(): "App Store" | "Google Play" {
  return isIOS ? "App Store" : "Google Play";
}

/**
 * Calculate discount percentage between original and discounted price
 */
export function calculateDiscountPercent(
  originalPrice: number,
  discountedPrice: number
): number {
  if (originalPrice <= 0) return 0;
  return Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
}
