/**
 * RevenueCat Context Provider
 *
 * Wraps the app to provide RevenueCat functionality to all components.
 * Handles initialization, customer info updates, and user session management.
 *
 * Usage:
 * 1. Wrap your app with <RevenueCatProvider>
 * 2. Use useRevenueCat() hook in any component
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode
} from "react";
import { Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { partnersQueryKeys } from "@/hooks/api/queryKeys";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { useTranslation } from "@/lib/i18n";
import { useAuthStore } from "@/stores/authStore";
import { useExitOfferStore } from "@/stores/exitOfferStore";
import { usePricingStore } from "@/stores/pricingStore";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { isIOS } from "@/utils/platform";
import { subscriptionsService, SyncSubscriptionRequest } from "@/services/api/subscriptions";
import type { SubscriptionPlan } from "@/services/api/subscriptionPlans";
import type {
  IAPProduct,
  IAPOffering,
  IAPError,
  SubscriptionStatus,
  SubscriptionTier,
  BillingPeriod,
  PurchaseState,
  CustomerInfo
} from "@/services/iap/types";

// Conditionally import RevenueCat

let Purchases: any = null;

let LOG_LEVEL: any = null;

try {
  const RNPurchases = require("react-native-purchases");
  Purchases = RNPurchases.default;
  LOG_LEVEL = RNPurchases.LOG_LEVEL;
} catch (e) {
  // console.warn(
  //   "[RevenueCat] react-native-purchases not installed. IAP features will be disabled."
  // );
}

// RevenueCat API Keys - should be in environment variables
const REVENUECAT_API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS || "";
const REVENUECAT_API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID || "";

// Entitlement IDs configured in RevenueCat dashboard (2-tier system)
const ENTITLEMENTS = {
  PREMIUM: "premium_access"
} as const;

// Trial eligibility result per product ID
export type TrialEligibilityMap = Record<string, boolean>;

// Context value interface
interface RevenueCatContextValue {
  // State
  isReady: boolean;
  customerInfo: CustomerInfo | null;
  offerings: IAPOffering[];
  currentOffering: IAPOffering | null;
  purchaseState: PurchaseState;
  error: IAPError | null;
  subscriptionStatus: SubscriptionStatus;

  // Actions
  purchase: (period: BillingPeriod) => Promise<boolean>;
  purchasePackage: (product: IAPProduct) => Promise<boolean>;
  purchaseProExitOffer: () => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  refreshCustomerInfo: () => Promise<void>;
  syncWithBackend: () => Promise<void>;
  checkTrialEligibility: (productIds: string[]) => Promise<TrialEligibilityMap>;

  // Getters
  getProduct: (period: BillingPeriod) => IAPProduct | null;
  getCurrentTier: () => SubscriptionTier;
  hasActiveSubscription: () => boolean;
  hasEntitlement: (entitlementId: string) => boolean;

  // Helpers
  clearError: () => void;
}

const defaultSubscriptionStatus: SubscriptionStatus = {
  isActive: false,
  tier: "free",
  expiresAt: null,
  willRenew: false,
  platform: null,
  isInTrial: false,
  isInGracePeriod: false,
  managementUrl: null
};

const RevenueCatContext = createContext<RevenueCatContextValue | null>(null);

interface RevenueCatProviderProps {
  children: ReactNode;
}

export function RevenueCatProvider({ children }: RevenueCatProviderProps) {
  // State
  const [isReady, setIsReady] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<IAPOffering[]>([]);
  const [currentOffering, setCurrentOffering] = useState<IAPOffering | null>(null);
  const [purchaseState, setPurchaseState] = useState<PurchaseState>("idle");
  const [error, setError] = useState<IAPError | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<SubscriptionStatus>(defaultSubscriptionStatus);

  // Refs
  const initializingRef = useRef(false);
  const customerInfoListenerRef = useRef<(() => void) | null>(null);

  // External stores
  const { user, isAuthenticated, isVerifyingUser } = useAuthStore();
  const { plans, fetchPlans } = usePricingStore();
  const { refresh: refreshSubscription, setOptimisticPlan } = useSubscriptionStore();
  const { markAsSubscribed } = useExitOfferStore();

  // Query client for cache invalidation
  const queryClient = useQueryClient();

  // Alert modal for showing messages
  const { showAlert } = useAlertModal();
  const { t } = useTranslation();

  // ====================
  // Initialization
  // ====================

  const initialize = useCallback(async () => {
    if (!Purchases || initializingRef.current || isReady) return;
    initializingRef.current = true;

    try {
      const apiKey = isIOS ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;

      if (!apiKey) {
        // console.error("[RevenueCat] API key not configured");
        initializingRef.current = false;
        return;
      }

      // Disable verbose RevenueCat logging (set to WARN to reduce console noise)
      // if (LOG_LEVEL) {
      //   Purchases.setLogLevel(LOG_LEVEL.WARN);
      // }

      // Check if RevenueCat is already configured to avoid duplicate initialization
      const alreadyConfigured = await Purchases.isConfigured();
      if (!alreadyConfigured) {
        // Configure RevenueCat
        await Purchases.configure({
          apiKey,
          appUserID: user?.id || null
        });
      }

      // Set up customer info listener
      customerInfoListenerRef.current = Purchases.addCustomerInfoUpdateListener(
        async (info: CustomerInfo) => {
          // console.info("[RevenueCat] Customer info updated");
          setCustomerInfo(info);
          updateSubscriptionStatus(info);
          refreshSubscription();

          // Sync with backend in case webhook was missed
          // This runs in background after customer info update
          if (user?.id) {
            try {
              const tier = getTierFromCustomerInfo(info);
              const isActive = hasActiveEntitlement(info);
              const entitlementId = getEntitlementIdForTier(tier);
              const entitlement = entitlementId ? info.entitlements?.active?.[entitlementId] : null;

              const syncRequest: SyncSubscriptionRequest = {
                tier,
                is_active: isActive,
                expires_at: entitlement?.expirationDate || null,
                will_renew: entitlement?.willRenew || false,
                platform: getPlatformFromStore(entitlement?.store || "") || null,
                product_id: info.activeSubscriptions?.[0] || entitlement?.productIdentifier || null
              };

              // Only sync if there's a potential mismatch
              const currentPlan = user?.plan || "free";
              const needsSync =
                (isActive && tier !== "free" && currentPlan !== tier) ||
                (!isActive && currentPlan !== "free");

              if (needsSync) {
                // console.info("[RevenueCat] Detected mismatch, syncing...");
                await subscriptionsService.syncSubscription(syncRequest);
                refreshSubscription();
              }
            } catch (err) {
              // console.error("[RevenueCat] Background sync failed", err);
            }
          }
        }
      );

      // Fetch initial customer info
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      updateSubscriptionStatus(info);

      // Fetch plans from backend if needed
      if (plans.length === 0) {
        await fetchPlans();
      }

      // Fetch offerings
      await fetchOfferings();

      // Login if user is authenticated
      if (user?.id) {
        await loginUser(user.id, user.email, user.name);
      }

      setIsReady(true);
      // console.info("[RevenueCat] Initialized successfully", {
      //   userId: await Purchases.getAppUserID(),
      //   hasActiveSubscription: hasActiveEntitlement(info),
      // });

      // Sync with backend after initialization to catch any missed webhooks
      if (user?.id && info) {
        const tier = getTierFromCustomerInfo(info);
        const isActive = hasActiveEntitlement(info);
        const currentPlan = user?.plan || "free";
        const needsSync =
          (isActive && tier !== "free" && currentPlan !== tier) ||
          (!isActive && currentPlan !== "free");

        if (needsSync) {
          // console.info("[RevenueCat] Initial sync: detected mismatch", {
          //   revenuecatTier: tier,
          //   dbPlan: currentPlan,
          // });
          const entitlementId = getEntitlementIdForTier(tier);
          const entitlement = entitlementId ? info.entitlements?.active?.[entitlementId] : null;

          await subscriptionsService.syncSubscription({
            tier,
            is_active: isActive,
            expires_at: entitlement?.expirationDate || null,
            will_renew: entitlement?.willRenew || false,
            platform: getPlatformFromStore(entitlement?.store || "") || null,
            product_id: info.activeSubscriptions?.[0] || entitlement?.productIdentifier || null
          });
          refreshSubscription();
        }
      }
    } catch (err) {
      // console.error("[RevenueCat] Initialization failed", err);
      setError({
        code: "INIT_FAILED",
        message: "Failed to initialize purchases"
      });
    } finally {
      initializingRef.current = false;
    }
  }, [isReady, user, plans, fetchPlans, refreshSubscription]);

  // ====================
  // Helper Functions
  // ====================

  const loginUser = async (userId: string, email?: string | null, displayName?: string | null) => {
    if (!Purchases) return;

    try {
      await Purchases.logIn(userId);

      if (email) {
        await Purchases.setEmail(email);
      }
      if (displayName) {
        await Purchases.setDisplayName(displayName);
      }

      // console.info("[RevenueCat] User logged in", { userId });
    } catch (err) {
      // console.error("[RevenueCat] Failed to login user", err);
    }
  };

  const logoutUser = async () => {
    if (!Purchases) return;

    try {
      await Purchases.logOut();
      // console.info("[RevenueCat] User logged out");
    } catch (err) {
      // console.error("[RevenueCat] Failed to logout user", err);
    }
  };

  const fetchOfferings = async () => {
    if (!Purchases) return;

    try {
      const rcOfferings = await Purchases.getOfferings();

      if (!rcOfferings.current) {
        // console.warn("[RevenueCat] No current offering available");
        return;
      }

      // Convert to our format
      const convertedOfferings = Object.values(rcOfferings.all).map((offering: any) =>
        convertOffering(offering)
      );

      setOfferings(convertedOfferings);
      setCurrentOffering(convertOffering(rcOfferings.current));

      // console.info("[RevenueCat] Offerings fetched", {
      //   count: convertedOfferings.length,
      // });
    } catch (err) {
      // console.error("[RevenueCat] Failed to fetch offerings", err);
    }
  };

  const convertOffering = (offering: any): IAPOffering => {
    const packages = offering.availablePackages.map((pkg: any) => convertPackage(pkg));

    return {
      identifier: offering.identifier,
      packages,
      monthlyPackage: packages.find((p: IAPProduct) => p.period === "monthly"),
      annualPackage: packages.find((p: IAPProduct) => p.period === "annual")
    };
  };

  const convertPackage = (pkg: any): IAPProduct => {
    const product = pkg.product;
    const period = getPeriodFromPackageType(pkg.packageType);

    return {
      identifier: product.identifier,
      title: product.title,
      description: product.description,
      price: product.price,
      priceString: product.priceString,
      currencyCode: product.currencyCode,
      period,
      introPrice: product.introPrice
        ? {
            price: product.introPrice.price,
            priceString: product.introPrice.priceString,
            period: product.introPrice.periodNumberOfUnits?.toString() || "1",
            periodUnit: product.introPrice.periodUnit || "MONTH",
            cycles: product.introPrice.cycles || 1
          }
        : undefined,
      rcPackage: pkg
    };
  };

  const getPeriodFromPackageType = (packageType: string): BillingPeriod => {
    switch (packageType) {
      case "$rc_annual":
      case "ANNUAL":
        return "annual";
      case "$rc_monthly":
      case "MONTHLY":
      default:
        return "monthly";
    }
  };

  const updateSubscriptionStatus = (info: CustomerInfo | null) => {
    if (!info) {
      setSubscriptionStatus(defaultSubscriptionStatus);
      return;
    }

    const tier = getTierFromCustomerInfo(info);
    const entitlementId = getEntitlementIdForTier(tier);
    const entitlement = entitlementId ? info.entitlements?.active?.[entitlementId] : null;

    if (!entitlement) {
      setSubscriptionStatus(defaultSubscriptionStatus);
      return;
    }

    setSubscriptionStatus({
      isActive: true,
      tier,
      expiresAt: entitlement.expirationDate ? new Date(entitlement.expirationDate) : null,
      willRenew: entitlement.willRenew,
      platform: getPlatformFromStore(entitlement.store),
      isInTrial: entitlement.periodType === "TRIAL",
      isInGracePeriod: entitlement.periodType === "GRACE_PERIOD",
      managementUrl: info.managementURL || null
    });
  };

  const getTierFromCustomerInfo = (info: CustomerInfo): SubscriptionTier => {
    const entitlements = info.entitlements?.active || {};

    // 2-tier system: check for premium entitlement
    if (entitlements[ENTITLEMENTS.PREMIUM]) return "premium";

    return "free";
  };

  const getEntitlementIdForTier = (tier: SubscriptionTier): string | null => {
    switch (tier) {
      case "premium":
        return ENTITLEMENTS.PREMIUM;
      default:
        return null;
    }
  };

  const getPlatformFromStore = (store: string): "ios" | "android" | "stripe" | null => {
    switch (store) {
      case "APP_STORE":
      case "MAC_APP_STORE":
        return "ios";
      case "PLAY_STORE":
      case "AMAZON":
        return "android";
      case "STRIPE":
        return "stripe";
      default:
        return null;
    }
  };

  /**
   * Extract subscription tier from product identifier (2-tier system)
   * Product IDs follow pattern: com.fitnudge.premium.{period}
   * e.g., com.fitnudge.premium.monthly, com.fitnudge.premium.annual
   */
  const getTierFromProductId = (productId: string): SubscriptionTier => {
    const lowerProductId = productId.toLowerCase();

    // Any paid product is premium
    if (lowerProductId.includes("premium")) {
      return "premium";
    }

    return "free";
  };

  const hasActiveEntitlement = (info: CustomerInfo | null): boolean => {
    if (!info) return false;

    // Check for active entitlements
    const hasEntitlements =
      info.entitlements?.active && Object.keys(info.entitlements.active).length > 0;

    // Also check for active subscriptions (some setups have subscriptions without entitlements)
    const hasSubscriptions = info.activeSubscriptions && info.activeSubscriptions.length > 0;

    // console.info("[RevenueCat] Checking active status:", {
    //   hasEntitlements,
    //   hasSubscriptions,
    //   entitlements: Object.keys(info.entitlements?.active || {}),
    //   subscriptions: info.activeSubscriptions,
    // });

    return hasEntitlements || hasSubscriptions;
  };

  const findPackageByIdentifier = (packageId: string): IAPProduct | null => {
    for (const offering of offerings) {
      const pkg = offering.packages.find(
        (p) => p.rcPackage?.identifier === packageId || p.identifier.includes(packageId)
      );
      if (pkg) return pkg;
    }

    if (currentOffering) {
      const pkg = currentOffering.packages.find(
        (p) => p.rcPackage?.identifier === packageId || p.identifier.includes(packageId)
      );
      if (pkg) return pkg;
    }

    return null;
  };

  // ====================
  // Public Actions
  // ====================

  const purchase = useCallback(
    async (period: BillingPeriod): Promise<boolean> => {
      if (!Purchases || !isReady) {
        setError({
          code: "NOT_READY",
          message: "Purchases are not available yet"
        });
        showAlert({
          title: t("onboarding.subscription.not_ready_title"),
          message: t("onboarding.subscription.not_ready_message"),
          variant: "warning"
        });
        return false;
      }

      const product =
        period === "annual" ? currentOffering?.annualPackage : currentOffering?.monthlyPackage;

      if (!product) {
        setError({
          code: "PRODUCT_NOT_FOUND",
          message: `No ${period} product available`
        });
        showAlert({
          title: t("onboarding.subscription.product_not_available_title"),
          message: t("onboarding.subscription.product_not_available_message"),
          variant: "error"
        });
        return false;
      }

      return purchasePackage(product);
    },
    [isReady, currentOffering, showAlert, t]
  );

  const purchasePackage = useCallback(
    async (product: IAPProduct): Promise<boolean> => {
      if (!Purchases || !isReady) {
        setError({
          code: "NOT_READY",
          message: "Purchases are not available yet"
        });
        showAlert({
          title: t("onboarding.subscription.not_ready_title"),
          message: t("onboarding.subscription.not_ready_message"),
          variant: "warning"
        });
        return false;
      }

      try {
        setPurchaseState("purchasing");
        setError(null);

        // console.info("[RevenueCat] Starting purchase", {
        //   productId: product.identifier,
        // });

        const { customerInfo: info } = await Purchases.purchasePackage(product.rcPackage);

        setCustomerInfo(info);
        updateSubscriptionStatus(info);
        setPurchaseState("success");

        // console.info("[RevenueCat] Purchase successful", {
        //   productId: product.identifier,
        // });

        // 🆕 Optimistically update subscription store immediately
        // This provides instant UI feedback without waiting for API
        const purchasedTier = getTierFromProductId(product.identifier);
        if (purchasedTier && purchasedTier !== "free") {
          setOptimisticPlan(purchasedTier);
        }

        // Mark user as subscribed so they don't see exit offers again
        await markAsSubscribed();

        // Note: No success alert here - Apple/Google already show their own confirmation
        refreshSubscription();

        // Invalidate partner limits cache so new feature limits are reflected
        queryClient.invalidateQueries({ queryKey: partnersQueryKeys.limits() });

        return true;
      } catch (err: any) {
        if (err.userCancelled) {
          setPurchaseState("cancelled");
          // console.info("[RevenueCat] Purchase cancelled by user");
          showAlert({
            title: t("onboarding.subscription.purchase_cancelled_title"),
            message: t("onboarding.subscription.purchase_cancelled_message"),
            variant: "info"
          });
          return false;
        }

        setPurchaseState("error");
        setError({
          code: err.code || "PURCHASE_FAILED",
          message: err.message || "Purchase failed",
          userCancelled: false
        });
        // console.error("[RevenueCat] Purchase failed", err);
        showAlert({
          title: t("onboarding.subscription.purchase_error_title"),
          message: t("onboarding.subscription.purchase_error_message"),
          variant: "error"
        });
        return false;
      }
    },
    [isReady, refreshSubscription, markAsSubscribed, showAlert, t]
  );

  const purchaseProExitOffer = useCallback(async (): Promise<boolean> => {
    if (!Purchases || !isReady) {
      setError({
        code: "NOT_READY",
        message: "Purchases are not available yet"
      });
      showAlert({
        title: t("onboarding.subscription.not_ready_title"),
        message: t("onboarding.subscription.not_ready_message"),
        variant: "warning"
      });
      return false;
    }

    try {
      setPurchaseState("purchasing");
      setError(null);

      // Find Premium Annual package - use $rc_annual (RevenueCat's standard annual identifier)
      // or fall back to the current offering's annual package
      const premiumAnnualPackage =
        findPackageByIdentifier("$rc_annual") || currentOffering?.annualPackage;

      if (!premiumAnnualPackage) {
        throw new Error("Premium Annual package not found");
      }

      // Check if user is eligible for introductory offer
      // Introductory offers are for NEW subscribers who have never subscribed
      // RevenueCat automatically detects eligibility via product.introPrice
      const storeProduct = premiumAnnualPackage.rcPackage?.product;
      const hasIntroOffer = storeProduct?.introPrice != null;

      // After line 661, add:
      console.log("[RevenueCat] Store Product:", JSON.stringify(storeProduct, null, 2));
      console.log("[RevenueCat] introPrice:", storeProduct?.introPrice);
      console.log("[RevenueCat] All product data:", premiumAnnualPackage);

      if (hasIntroOffer) {
        // User is eligible for intro offer - just purchase normally
        // The intro price is applied automatically by Apple/Google
        // console.info(
        //   "[RevenueCat] User eligible for introductory offer:",
        //   storeProduct?.introPrice?.priceString
        // );
        return purchasePackage(premiumAnnualPackage);
      }

      // User is NOT eligible for intro offer (already subscribed before)
      // Check if there's an exit_offer offering for lapsed subscribers (Android or iOS promo)
      const exitOffering = offerings.find((o) => o.identifier === "exit_offer");
      if (exitOffering?.annualPackage) {
        // console.info("[RevenueCat] Using exit_offer offering for lapsed user");
        return purchasePackage(exitOffering.annualPackage);
      }

      // No discount available - user is not eligible
      // This happens if user previously subscribed and no win-back offer is configured
      // console.warn(
      //   "[RevenueCat] User not eligible for intro offer (previously subscribed)"
      // );
      setPurchaseState("error");
      showAlert({
        title: t("onboarding.subscription.promo_ineligible_title"),
        message: t("onboarding.subscription.promo_ineligible_message"),
        variant: "warning"
      });
      return false;
    } catch (err: any) {
      if (err.userCancelled) {
        setPurchaseState("cancelled");
        // console.info("[RevenueCat] Exit offer purchase cancelled by user");
        showAlert({
          title: t("onboarding.subscription.purchase_cancelled_title"),
          message: t("onboarding.subscription.purchase_cancelled_message"),
          variant: "info"
        });
        return false;
      }

      setPurchaseState("error");
      setError({
        code: err.code || "EXIT_OFFER_FAILED",
        message: err.message || "Exit offer purchase failed"
      });
      // console.error("[RevenueCat] Exit offer purchase failed", err);
      showAlert({
        title: t("onboarding.subscription.purchase_error_title"),
        message: t("onboarding.subscription.purchase_error_message"),
        variant: "error"
      });
      return false;
    }
  }, [
    isReady,
    offerings,
    currentOffering,
    purchasePackage,
    refreshSubscription,
    showAlert,
    markAsSubscribed,
    t
  ]);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    if (!Purchases || !isReady) {
      // console.warn("[RevenueCat] Restore failed - not ready");
      setError({
        code: "NOT_READY",
        message: "Purchases are not available yet"
      });
      showAlert({
        title: t("onboarding.subscription.not_ready_title"),
        message: t("onboarding.subscription.not_ready_message"),
        variant: "warning"
      });
      return false;
    }

    try {
      setPurchaseState("restoring");
      setError(null);

      // console.info("[RevenueCat] Restoring purchases");

      const info = await Purchases.restorePurchases();
      // console.info("[RevenueCat] Restore response received");

      setCustomerInfo(info);
      updateSubscriptionStatus(info);

      const hasActive = hasActiveEntitlement(info);
      // console.info("[RevenueCat] Has active subscription:", hasActive);

      if (hasActive) {
        setPurchaseState("success");
        // console.info("[RevenueCat] Purchases restored successfully");

        // 🆕 Optimistically update subscription store from restored customer info
        const restoredTier = getTierFromCustomerInfo(info);
        if (restoredTier && restoredTier !== "free") {
          setOptimisticPlan(restoredTier);
        }

        // Show success message
        showAlert({
          title: t("onboarding.subscription.restore_success_title"),
          message: t("onboarding.subscription.restore_success_message"),
          variant: "success"
        });

        await markAsSubscribed();
        refreshSubscription();

        // Invalidate partner limits cache so new feature limits are reflected
        queryClient.invalidateQueries({ queryKey: partnersQueryKeys.limits() });

        return true;
      } else {
        setPurchaseState("idle");
        // console.info("[RevenueCat] No active purchases found");
        setError({
          code: "NO_PURCHASES",
          message: "No previous purchases found"
        });

        // Show info message
        showAlert({
          title: t("onboarding.subscription.restore_no_purchases_title"),
          message: t("onboarding.subscription.restore_no_purchases_message"),
          variant: "info"
        });
        return false;
      }
    } catch (err: any) {
      setPurchaseState("error");
      setError({
        code: err.code || "RESTORE_FAILED",
        message: err.message || "Failed to restore purchases"
      });
      // console.error("[RevenueCat] Restore failed", err);

      // Show error message
      showAlert({
        title: t("onboarding.subscription.restore_error_title"),
        message: t("onboarding.subscription.restore_error_message"),
        variant: "error"
      });
      return false;
    }
  }, [isReady, refreshSubscription, showAlert, markAsSubscribed, t]);

  const refreshCustomerInfo = useCallback(async () => {
    if (!Purchases) return;

    try {
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      updateSubscriptionStatus(info);
    } catch (err) {
      // console.error("[RevenueCat] Failed to refresh customer info", err);
    }
  }, []);

  /**
   * Sync RevenueCat subscription status with backend database.
   * This is a fallback for missed webhooks.
   */
  const syncWithBackend = useCallback(async () => {
    if (!customerInfo || !user?.id) {
      // console.info("[RevenueCat] Skip sync - no customer info or user");
      return;
    }

    try {
      const tier = getTierFromCustomerInfo(customerInfo);
      const isActive = hasActiveEntitlement(customerInfo);
      const entitlementId = getEntitlementIdForTier(tier);
      const entitlement = entitlementId ? customerInfo.entitlements?.active?.[entitlementId] : null;

      // Get product ID from first active subscription
      const productId =
        customerInfo.activeSubscriptions?.[0] || entitlement?.productIdentifier || null;

      const syncRequest: SyncSubscriptionRequest = {
        tier,
        is_active: isActive,
        expires_at: entitlement?.expirationDate || null,
        will_renew: entitlement?.willRenew || false,
        platform: getPlatformFromStore(entitlement?.store || "") || null,
        product_id: productId
      };

      // console.info("[RevenueCat] Syncing with backend", {
      //   tier,
      //   isActive,
      //   userPlan: user.plan,
      // });

      // Only sync if there's a potential mismatch
      const needsSync =
        (isActive && tier !== "free" && user.plan !== tier) || (!isActive && user.plan !== "free");

      if (!needsSync) {
        // console.info("[RevenueCat] Already in sync, skipping");
        return;
      }

      const response = await subscriptionsService.syncSubscription(syncRequest);

      if (response.data?.synced) {
        // console.info("[RevenueCat] Backend synced", response.data);
        // Refresh subscription store to get updated data
        refreshSubscription();
      }
    } catch (err) {
      // console.error("[RevenueCat] Failed to sync with backend", err);
      // Don't throw - this is a background sync, shouldn't disrupt UX
    }
  }, [customerInfo, user, refreshSubscription]);

  /**
   * Check trial/introductory offer eligibility for given product IDs.
   * iOS: Uses RevenueCat's checkTrialOrIntroductoryEligibility method
   * Android: Falls back to checking if user has any previous purchases
   *
   * @param productIds Array of product identifiers to check
   * @returns Map of productId -> boolean (true if eligible for trial)
   */
  const checkTrialEligibility = useCallback(
    async (productIds: string[]): Promise<TrialEligibilityMap> => {
      if (!Purchases || !isReady || productIds.length === 0) {
        // Default to false for all products if not ready
        const result: TrialEligibilityMap = {};
        for (const id of productIds) {
          result[id] = false;
        }
        return result;
      }

      try {
        if (Platform.OS === "ios") {
          // iOS: Use RevenueCat's proper eligibility check
          const eligibilityResult =
            await Purchases.checkTrialOrIntroductoryPriceEligibility(productIds);

          const result: TrialEligibilityMap = {};
          for (const [productId, eligibility] of Object.entries(eligibilityResult)) {
            // INTRO_ELIGIBILITY_STATUS.ELIGIBLE = 2
            result[productId] =
              (eligibility as any)?.status === 2 ||
              (eligibility as any)?.status === "INTRO_ELIGIBILITY_STATUS_ELIGIBLE";
          }
          return result;
        } else {
          // Android: Check if user has ever had any subscription
          // If they have previous purchases, they're not eligible for trial
          const info = await Purchases.getCustomerInfo();
          const hasPreviousPurchases =
            info?.allPurchasedProductIdentifiers?.length > 0 ||
            Object.keys(info?.entitlements?.all || {}).length > 0;

          // If no previous purchases, all products are eligible for trial
          const result: TrialEligibilityMap = {};
          for (const id of productIds) {
            result[id] = !hasPreviousPurchases;
          }
          return result;
        }
      } catch (err) {
        console.error("[RevenueCat] Failed to check trial eligibility", err);
        // Default to false (not eligible) on error
        const result: TrialEligibilityMap = {};
        for (const id of productIds) {
          result[id] = false;
        }
        return result;
      }
    },
    [isReady]
  );

  // ====================
  // Getters
  // ====================

  const getProduct = useCallback(
    (period: BillingPeriod): IAPProduct | null => {
      if (!currentOffering) return null;
      return period === "annual"
        ? currentOffering.annualPackage || null
        : currentOffering.monthlyPackage || null;
    },
    [currentOffering]
  );

  const getCurrentTier = useCallback((): SubscriptionTier => {
    return subscriptionStatus.tier;
  }, [subscriptionStatus]);

  const hasActiveSubscription = useCallback((): boolean => {
    return subscriptionStatus.isActive;
  }, [subscriptionStatus]);

  const hasEntitlement = useCallback(
    (entitlementId: string): boolean => {
      if (!customerInfo?.entitlements?.active) return false;
      return !!customerInfo.entitlements.active[entitlementId];
    },
    [customerInfo]
  );

  const clearError = useCallback(() => {
    setError(null);
    if (purchaseState === "error") {
      setPurchaseState("idle");
    }
  }, [purchaseState]);

  // ====================
  // Effects
  // ====================

  // Initialize only after user verification is complete and authenticated
  useEffect(() => {
    if (!isVerifyingUser && isAuthenticated) {
      initialize();
    }
  }, [initialize, isVerifyingUser, isAuthenticated]);

  // Handle user changes (login/logout)
  useEffect(() => {
    if (!isReady) return;

    if (user?.id) {
      loginUser(user.id, user.email, user.name);
    } else {
      logoutUser();
    }
  }, [user, isReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (customerInfoListenerRef.current) {
        customerInfoListenerRef.current();
        customerInfoListenerRef.current = null;
      }
    };
  }, []);

  // ====================
  // Context Value
  // ====================

  const value: RevenueCatContextValue = {
    // State
    isReady,
    customerInfo,
    offerings,
    currentOffering,
    purchaseState,
    error,
    subscriptionStatus,

    // Actions
    purchase,
    purchasePackage,
    purchaseProExitOffer,
    restorePurchases,
    refreshCustomerInfo,
    syncWithBackend,
    checkTrialEligibility,

    // Getters
    getProduct,
    getCurrentTier,
    hasActiveSubscription,
    hasEntitlement,

    // Helpers
    clearError
  };

  return <RevenueCatContext.Provider value={value}>{children}</RevenueCatContext.Provider>;
}

// ====================
// Hook
// ====================

export function useRevenueCat(): RevenueCatContextValue {
  const context = useContext(RevenueCatContext);

  if (!context) {
    throw new Error("useRevenueCat must be used within a RevenueCatProvider");
  }

  return context;
}

// ====================
// Exports
// ====================

export type { RevenueCatContextValue };
