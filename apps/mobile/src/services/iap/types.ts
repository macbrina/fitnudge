/**
 * In-App Purchase Types (RevenueCat)
 *
 * Type definitions for RevenueCat-based IAP.
 */

// RevenueCat types - these will be properly typed when package is installed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CustomerInfo = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PurchasesPackage = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PurchasesOffering = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PurchasesStoreProduct = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PurchasesPromotionalOffer = any;

// Our app's subscription tiers
export type SubscriptionTier = "free" | "starter" | "pro" | "elite";
export type BillingPeriod = "monthly" | "annual";

// Entitlement identifiers in RevenueCat dashboard
export const ENTITLEMENT_IDS = {
  PRO: "pro_access",
  STARTER: "starter_access",
  COACH_PLUS: "elite_access",
} as const;

// Package type identifiers
export type PackageType = "$rc_monthly" | "$rc_annual" | "monthly" | "annual";

// Simplified product info for UI
export interface IAPProduct {
  identifier: string;
  title: string;
  description: string;
  price: number;
  priceString: string;
  currencyCode: string;
  period: BillingPeriod;
  introPrice?: {
    price: number;
    priceString: string;
    period: string;
    periodUnit: string;
    cycles: number;
  };
  // Original RevenueCat package for purchasing
  rcPackage: PurchasesPackage;
}

// Offering with packages
export interface IAPOffering {
  identifier: string;
  packages: IAPProduct[];
  monthlyPackage?: IAPProduct;
  annualPackage?: IAPProduct;
}

// Purchase state
export type PurchaseState =
  | "idle"
  | "loading"
  | "purchasing"
  | "restoring"
  | "success"
  | "error"
  | "cancelled";

// Error types
export interface IAPError {
  code: string;
  message: string;
  underlyingError?: Error;
  userCancelled?: boolean;
}

// Subscription status derived from CustomerInfo
export interface SubscriptionStatus {
  isActive: boolean;
  tier: SubscriptionTier;
  expiresAt: Date | null;
  willRenew: boolean;
  platform: "ios" | "android" | "stripe" | null;
  isInTrial: boolean;
  isInGracePeriod: boolean;
  managementUrl: string | null;
}

// Verification request to send to backend (for additional server-side processing)
export interface VerifyPurchaseRequest {
  platform: "ios" | "android";
  userId: string;
  revenueCatUserId: string;
  productId: string;
  transactionId: string;
}

// Verification response from backend
export interface VerifyPurchaseResponse {
  success: boolean;
  subscription_id?: string;
  plan?: string;
  expires_at?: string;
  error?: string;
}

// RevenueCat configuration
export interface RevenueCatConfig {
  apiKeyIOS: string;
  apiKeyAndroid: string;
  entitlementIdentifiers: string[];
  useAmazon?: boolean;
}

// Promotional offer identifiers
export const PROMO_OFFER_IDS = {
  PRO_EXIT_50: "pro_exit_50", // 50% off Pro Annual (exit intent)
} as const;

// Promotional offer info for UI
export interface PromotionalOfferInfo {
  identifier: string;
  productIdentifier: string;
  discountPercent: number;
  discountedPrice: number;
  discountedPriceString: string;
  originalPrice: number;
  originalPriceString: string;
  // Original RevenueCat promotional offer for purchasing
  rcPromoOffer: PurchasesPromotionalOffer;
}
