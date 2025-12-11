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
  ReactNode,
} from "react";
import { Platform } from "react-native";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { useTranslation } from "@/lib/i18n";
import { useAuthStore } from "@/stores/authStore";
import { useExitOfferStore } from "@/stores/exitOfferStore";
import { usePricingStore } from "@/stores/pricingStore";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { isIOS } from "@/utils/platform";
import type { SubscriptionPlan } from "@/services/api/subscriptionPlans";
import type {
  IAPProduct,
  IAPOffering,
  IAPError,
  SubscriptionStatus,
  SubscriptionTier,
  BillingPeriod,
  PurchaseState,
  CustomerInfo,
} from "@/services/iap/types";

// Conditionally import RevenueCat
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Purchases: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let LOG_LEVEL: any = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RNPurchases = require("react-native-purchases");
  Purchases = RNPurchases.default;
  LOG_LEVEL = RNPurchases.LOG_LEVEL;
} catch (e) {
  console.warn(
    "[RevenueCat] react-native-purchases not installed. IAP features will be disabled."
  );
}

// RevenueCat API Keys - should be in environment variables
const REVENUECAT_API_KEY_IOS =
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS || "";
const REVENUECAT_API_KEY_ANDROID =
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID || "";

// Entitlement IDs configured in RevenueCat dashboard
const ENTITLEMENTS = {
  PRO: "pro_access",
  STARTER: "starter_access",
  ELITE: "elite_access",
} as const;

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
  managementUrl: null,
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
  const [currentOffering, setCurrentOffering] = useState<IAPOffering | null>(
    null
  );
  const [purchaseState, setPurchaseState] = useState<PurchaseState>("idle");
  const [error, setError] = useState<IAPError | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<SubscriptionStatus>(defaultSubscriptionStatus);

  // Refs
  const initializingRef = useRef(false);
  const customerInfoListenerRef = useRef<(() => void) | null>(null);

  // External stores
  const { user } = useAuthStore();
  const { plans, fetchPlans } = usePricingStore();
  const { refresh: refreshSubscription } = useSubscriptionStore();
  const { markAsSubscribed } = useExitOfferStore();

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
      const apiKey = isIOS
        ? REVENUECAT_API_KEY_IOS
        : REVENUECAT_API_KEY_ANDROID;

      if (!apiKey) {
        console.error("[RevenueCat] API key not configured");
        initializingRef.current = false;
        return;
      }

      // Enable debug logging in development
      if (__DEV__ && LOG_LEVEL) {
        Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }

      // Configure RevenueCat
      await Purchases.configure({
        apiKey,
        appUserID: user?.id || null,
      });

      // Set up customer info listener
      customerInfoListenerRef.current = Purchases.addCustomerInfoUpdateListener(
        (info: CustomerInfo) => {
          console.info("[RevenueCat] Customer info updated");
          setCustomerInfo(info);
          updateSubscriptionStatus(info);
          refreshSubscription();
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
      console.info("[RevenueCat] Initialized successfully", {
        userId: await Purchases.getAppUserID(),
        hasActiveSubscription: hasActiveEntitlement(info),
      });
    } catch (err) {
      console.error("[RevenueCat] Initialization failed", err);
      setError({
        code: "INIT_FAILED",
        message: "Failed to initialize purchases",
      });
    } finally {
      initializingRef.current = false;
    }
  }, [isReady, user, plans, fetchPlans, refreshSubscription]);

  // ====================
  // Helper Functions
  // ====================

  const loginUser = async (
    userId: string,
    email?: string | null,
    displayName?: string | null
  ) => {
    if (!Purchases) return;

    try {
      await Purchases.logIn(userId);

      if (email) {
        await Purchases.setEmail(email);
      }
      if (displayName) {
        await Purchases.setDisplayName(displayName);
      }

      console.info("[RevenueCat] User logged in", { userId });
    } catch (err) {
      console.error("[RevenueCat] Failed to login user", err);
    }
  };

  const logoutUser = async () => {
    if (!Purchases) return;

    try {
      await Purchases.logOut();
      console.info("[RevenueCat] User logged out");
    } catch (err) {
      console.error("[RevenueCat] Failed to logout user", err);
    }
  };

  const fetchOfferings = async () => {
    if (!Purchases) return;

    try {
      const rcOfferings = await Purchases.getOfferings();

      if (!rcOfferings.current) {
        console.warn("[RevenueCat] No current offering available");
        return;
      }

      // Convert to our format
      const convertedOfferings = Object.values(rcOfferings.all).map(
        (offering: any) => convertOffering(offering)
      );

      setOfferings(convertedOfferings);
      setCurrentOffering(convertOffering(rcOfferings.current));

      console.info("[RevenueCat] Offerings fetched", {
        count: convertedOfferings.length,
      });
    } catch (err) {
      console.error("[RevenueCat] Failed to fetch offerings", err);
    }
  };

  const convertOffering = (offering: any): IAPOffering => {
    const packages = offering.availablePackages.map((pkg: any) =>
      convertPackage(pkg)
    );

    return {
      identifier: offering.identifier,
      packages,
      monthlyPackage: packages.find((p: IAPProduct) => p.period === "monthly"),
      annualPackage: packages.find((p: IAPProduct) => p.period === "annual"),
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
            cycles: product.introPrice.cycles || 1,
          }
        : undefined,
      rcPackage: pkg,
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
    const entitlement = entitlementId
      ? info.entitlements?.active?.[entitlementId]
      : null;

    if (!entitlement) {
      setSubscriptionStatus(defaultSubscriptionStatus);
      return;
    }

    setSubscriptionStatus({
      isActive: true,
      tier,
      expiresAt: entitlement.expirationDate
        ? new Date(entitlement.expirationDate)
        : null,
      willRenew: entitlement.willRenew,
      platform: getPlatformFromStore(entitlement.store),
      isInTrial: entitlement.periodType === "TRIAL",
      isInGracePeriod: entitlement.periodType === "GRACE_PERIOD",
      managementUrl: info.managementURL || null,
    });
  };

  const getTierFromCustomerInfo = (info: CustomerInfo): SubscriptionTier => {
    const entitlements = info.entitlements?.active || {};

    if (entitlements[ENTITLEMENTS.ELITE]) return "elite";
    if (entitlements[ENTITLEMENTS.PRO]) return "pro";
    if (entitlements[ENTITLEMENTS.STARTER]) return "starter";

    return "free";
  };

  const getEntitlementIdForTier = (tier: SubscriptionTier): string | null => {
    switch (tier) {
      case "elite":
        return ENTITLEMENTS.ELITE;
      case "pro":
        return ENTITLEMENTS.PRO;
      case "starter":
        return ENTITLEMENTS.STARTER;
      default:
        return null;
    }
  };

  const getPlatformFromStore = (
    store: string
  ): "ios" | "android" | "stripe" | null => {
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

  const hasActiveEntitlement = (info: CustomerInfo | null): boolean => {
    if (!info) return false;

    // Check for active entitlements
    const hasEntitlements =
      info.entitlements?.active &&
      Object.keys(info.entitlements.active).length > 0;

    // Also check for active subscriptions (some setups have subscriptions without entitlements)
    const hasSubscriptions =
      info.activeSubscriptions && info.activeSubscriptions.length > 0;

    console.info("[RevenueCat] Checking active status:", {
      hasEntitlements,
      hasSubscriptions,
      entitlements: Object.keys(info.entitlements?.active || {}),
      subscriptions: info.activeSubscriptions,
    });

    return hasEntitlements || hasSubscriptions;
  };

  const findPackageByIdentifier = (packageId: string): IAPProduct | null => {
    for (const offering of offerings) {
      const pkg = offering.packages.find(
        (p) =>
          p.rcPackage?.identifier === packageId ||
          p.identifier.includes(packageId)
      );
      if (pkg) return pkg;
    }

    if (currentOffering) {
      const pkg = currentOffering.packages.find(
        (p) =>
          p.rcPackage?.identifier === packageId ||
          p.identifier.includes(packageId)
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
          message: "Purchases are not available yet",
        });
        showAlert({
          title: t("onboarding.subscription.not_ready_title"),
          message: t("onboarding.subscription.not_ready_message"),
          variant: "warning",
        });
        return false;
      }

      const product =
        period === "annual"
          ? currentOffering?.annualPackage
          : currentOffering?.monthlyPackage;

      if (!product) {
        setError({
          code: "PRODUCT_NOT_FOUND",
          message: `No ${period} product available`,
        });
        showAlert({
          title: t("onboarding.subscription.product_not_available_title"),
          message: t("onboarding.subscription.product_not_available_message"),
          variant: "error",
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
          message: "Purchases are not available yet",
        });
        showAlert({
          title: t("onboarding.subscription.not_ready_title"),
          message: t("onboarding.subscription.not_ready_message"),
          variant: "warning",
        });
        return false;
      }

      try {
        setPurchaseState("purchasing");
        setError(null);

        console.info("[RevenueCat] Starting purchase", {
          productId: product.identifier,
        });

        const { customerInfo: info } = await Purchases.purchasePackage(
          product.rcPackage
        );

        setCustomerInfo(info);
        updateSubscriptionStatus(info);
        setPurchaseState("success");

        console.info("[RevenueCat] Purchase successful", {
          productId: product.identifier,
        });

        // Mark user as subscribed so they don't see exit offers again
        await markAsSubscribed();

        // Show success message
        showAlert({
          title: t("onboarding.subscription.purchase_success_title"),
          message: t("onboarding.subscription.purchase_success_message"),
          variant: "success",
        });

        refreshSubscription();
        return true;
      } catch (err: any) {
        if (err.userCancelled) {
          setPurchaseState("cancelled");
          console.info("[RevenueCat] Purchase cancelled by user");
          showAlert({
            title: t("onboarding.subscription.purchase_cancelled_title"),
            message: t("onboarding.subscription.purchase_cancelled_message"),
            variant: "info",
          });
          return false;
        }

        setPurchaseState("error");
        setError({
          code: err.code || "PURCHASE_FAILED",
          message: err.message || "Purchase failed",
          userCancelled: false,
        });
        console.error("[RevenueCat] Purchase failed", err);
        showAlert({
          title: t("onboarding.subscription.purchase_error_title"),
          message: t("onboarding.subscription.purchase_error_message"),
          variant: "error",
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
        message: "Purchases are not available yet",
      });
      showAlert({
        title: t("onboarding.subscription.not_ready_title"),
        message: t("onboarding.subscription.not_ready_message"),
        variant: "warning",
      });
      return false;
    }

    try {
      setPurchaseState("purchasing");
      setError(null);

      // Find Pro Annual package
      const proAnnualPackage = findPackageByIdentifier("pro_annual");
      if (!proAnnualPackage) {
        // Fallback to annual package from current offering
        const fallbackPackage = currentOffering?.annualPackage;
        if (!fallbackPackage) {
          throw new Error("Pro Annual package not found");
        }
        return purchasePackage(fallbackPackage);
      }

      // Check if user is eligible for introductory offer
      // Introductory offers are for NEW subscribers who have never subscribed
      // RevenueCat automatically detects eligibility via product.introPrice
      const storeProduct = proAnnualPackage.rcPackage?.product;
      const hasIntroOffer = storeProduct?.introPrice != null;

      if (hasIntroOffer) {
        // User is eligible for intro offer - just purchase normally
        // The intro price is applied automatically by Apple/Google
        console.info(
          "[RevenueCat] User eligible for introductory offer:",
          storeProduct?.introPrice?.priceString
        );
        return purchasePackage(proAnnualPackage);
      }

      // User is NOT eligible for intro offer (already subscribed before)
      // Check if there's an exit_offer offering for lapsed subscribers (Android or iOS promo)
      const exitOffering = offerings.find((o) => o.identifier === "exit_offer");
      if (exitOffering?.annualPackage) {
        console.info("[RevenueCat] Using exit_offer offering for lapsed user");
        return purchasePackage(exitOffering.annualPackage);
      }

      // No discount available - user is not eligible
      // This happens if user previously subscribed and no win-back offer is configured
      console.warn(
        "[RevenueCat] User not eligible for intro offer (previously subscribed)"
      );
      setPurchaseState("error");
      showAlert({
        title: t("onboarding.subscription.promo_ineligible_title"),
        message: t("onboarding.subscription.promo_ineligible_message"),
        variant: "warning",
      });
      return false;
    } catch (err: any) {
      if (err.userCancelled) {
        setPurchaseState("cancelled");
        console.info("[RevenueCat] Exit offer purchase cancelled by user");
        showAlert({
          title: t("onboarding.subscription.purchase_cancelled_title"),
          message: t("onboarding.subscription.purchase_cancelled_message"),
          variant: "info",
        });
        return false;
      }

      setPurchaseState("error");
      setError({
        code: err.code || "EXIT_OFFER_FAILED",
        message: err.message || "Exit offer purchase failed",
      });
      console.error("[RevenueCat] Exit offer purchase failed", err);
      showAlert({
        title: t("onboarding.subscription.purchase_error_title"),
        message: t("onboarding.subscription.purchase_error_message"),
        variant: "error",
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
    t,
  ]);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    if (!Purchases || !isReady) {
      console.warn("[RevenueCat] Restore failed - not ready");
      setError({
        code: "NOT_READY",
        message: "Purchases are not available yet",
      });
      showAlert({
        title: t("onboarding.subscription.not_ready_title"),
        message: t("onboarding.subscription.not_ready_message"),
        variant: "warning",
      });
      return false;
    }

    try {
      setPurchaseState("restoring");
      setError(null);

      console.info("[RevenueCat] Restoring purchases");

      const info = await Purchases.restorePurchases();
      console.info("[RevenueCat] Restore response received");

      setCustomerInfo(info);
      updateSubscriptionStatus(info);

      const hasActive = hasActiveEntitlement(info);
      console.info("[RevenueCat] Has active subscription:", hasActive);

      if (hasActive) {
        setPurchaseState("success");
        console.info("[RevenueCat] Purchases restored successfully");

        // Show success message
        showAlert({
          title: t("onboarding.subscription.restore_success_title"),
          message: t("onboarding.subscription.restore_success_message"),
          variant: "success",
        });

        await markAsSubscribed();
        refreshSubscription();
        return true;
      } else {
        setPurchaseState("idle");
        console.info("[RevenueCat] No active purchases found");
        setError({
          code: "NO_PURCHASES",
          message: "No previous purchases found",
        });

        // Show info message
        showAlert({
          title: t("onboarding.subscription.restore_no_purchases_title"),
          message: t("onboarding.subscription.restore_no_purchases_message"),
          variant: "info",
        });
        return false;
      }
    } catch (err: any) {
      setPurchaseState("error");
      setError({
        code: err.code || "RESTORE_FAILED",
        message: err.message || "Failed to restore purchases",
      });
      console.error("[RevenueCat] Restore failed", err);

      // Show error message
      showAlert({
        title: t("onboarding.subscription.restore_error_title"),
        message: t("onboarding.subscription.restore_error_message"),
        variant: "error",
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
      console.error("[RevenueCat] Failed to refresh customer info", err);
    }
  }, []);

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

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

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

    // Getters
    getProduct,
    getCurrentTier,
    hasActiveSubscription,
    hasEntitlement,

    // Helpers
    clearError,
  };

  return (
    <RevenueCatContext.Provider value={value}>
      {children}
    </RevenueCatContext.Provider>
  );
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
