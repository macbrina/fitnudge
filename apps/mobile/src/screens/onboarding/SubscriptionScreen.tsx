import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import LinkText from "@/components/ui/LinkText";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { FaqPurchaseModal } from "@/components/modals/FaqPurchaseModal";
import { useExternalUrls } from "@/hooks/api/useAppConfig";
import { AlertOverlay, useAlertModal } from "@/contexts/AlertModalContext";
import { useRevenueCat } from "@/contexts/RevenueCatContext";
import { usePostHog } from "@/hooks/usePostHog";
import { usePricing } from "@/hooks/usePricing";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { MOBILE_ROUTES } from "@/lib/routes";
import { toRN } from "@/lib/units";
import { logger } from "@/services/logger";
import { useExitOfferStore } from "@/stores/exitOfferStore";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { useTheme } from "@/themes";
import { useStyles } from "@/themes/makeStyles";
import { tokens } from "@/themes/tokens";
import { isIOS } from "@/utils/platform";
import { STORAGE_KEYS, storageUtil } from "@/utils/storageUtil";
import { Ionicons } from "@expo/vector-icons";
import CheckmarkCircle from "@/components/ui/CheckmarkCircle";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Modal, Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type BillingPeriod = "monthly" | "annual";

interface SubscriptionScreenProps {
  visible?: boolean;
  onClose?: () => void;
}

export default function SubscriptionScreen({
  visible: visibleProp = true,
  onClose
}: SubscriptionScreenProps = {}) {
  // When used as a standalone screen (no onClose), manage visibility internally
  const [internalVisible, setInternalVisible] = useState(true);
  const visible = onClose ? visibleProp : internalVisible;

  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("annual");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const [canShowExitOffer, setCanShowExitOffer] = useState(false);
  const [trialEligibility, setTrialEligibility] = useState<Record<string, boolean>>({});
  const [showFaqModal, setShowFaqModal] = useState(false);

  const { t } = useTranslation();
  const styles = useStyles(makeSubscriptionScreenStyles);
  const insets = useSafeAreaInsets();
  const { colors, brandColors } = useTheme();
  const { capture } = usePostHog();
  const { plans, isLoading: plansLoading, fetchPlans } = usePricing();
  const { showAlert } = useAlertModal();
  const { getPlan } = useSubscriptionStore();
  const currentPlan = getPlan();
  const externalUrls = useExternalUrls();

  // sometimes plans are not loaded yet, so fetch them if not loaded
  // useEffect(() => {
  //   if (!plansLoading && plans.length === 0) {
  //     fetchPlans();
  //   }
  // }, [plansLoading, plans]);

  const hasActiveSubscription = currentPlan !== "free";
  const { setExitOffer, markAsSubscribed, showExitIntentModal, openExitIntentModal } =
    useExitOfferStore();
  const {
    purchase,
    purchasePackage,
    restorePurchases,
    offerings,
    currentOffering,
    checkTrialEligibility: checkTrialEligibilityApi
  } = useRevenueCat();

  // Exit Offer Configuration
  const EXIT_OFFER_COUNTDOWN_MINUTES = 15; // 15 minute countdown

  // Check if exit offer can be shown from SubscriptionScreen
  // IMPORTANT: SubscriptionScreen only triggers exit offer on FIRST TIME
  // Subsequent shows (2-5) are handled proactively by HomeScreen/FloatingOfferButton
  // Re-check whenever modal becomes visible (in case storage was reset for testing)
  useEffect(() => {
    const checkExitOfferEligibility = async () => {
      // Only check when modal is visible
      if (!visible) {
        return;
      }

      try {
        // 1. Check if user has ever subscribed from backend (survives app reinstall)
        const hasEverSubscribedBackend = useSubscriptionStore.getState().hasEverSubscribed();
        if (hasEverSubscribedBackend) {
          // Mark in local storage so we don't need to check again
          await storageUtil.setItem(STORAGE_KEYS.HAS_EVER_SUBSCRIBED, "true");
          setCanShowExitOffer(false);
          return;
        }

        // 2. Check local storage as fallback
        const localHasSubscribed = await storageUtil.getItem(STORAGE_KEYS.HAS_EVER_SUBSCRIBED);
        if (localHasSubscribed === "true") {
          setCanShowExitOffer(false);
          return;
        }

        // 3. Get show count - if already shown, don't show again from SubscriptionScreen
        const rawShowCount = await storageUtil.getItem<number>(STORAGE_KEYS.EXIT_OFFER_SHOW_COUNT);
        const showCount = rawShowCount || 0;

        // SubscriptionScreen only triggers exit offer if it has NEVER been shown
        // After first show, FloatingOfferButton on HomeScreen handles proactive shows
        if (showCount > 0) {
          setCanShowExitOffer(false);
          return;
        }

        // 4. Check trial eligibility from API - if not eligible for any trial,
        // it means they've used a trial before (on this or another device)
        const availablePlans = (plans ?? []).filter((plan) => plan.is_active && plan.id !== "free");
        if (availablePlans.length > 0) {
          const productIds = availablePlans
            .map((plan) => {
              // Check annual first, then monthly (use iOS or Android based on platform)
              const isIOS = Platform.OS === "ios";
              return isIOS
                ? plan.product_id_ios_annual || plan.product_id_ios_monthly
                : plan.product_id_android_annual || plan.product_id_android_monthly;
            })
            .filter(Boolean) as string[];

          if (productIds.length > 0) {
            try {
              const eligibilityResult = await checkTrialEligibilityApi(productIds);
              const isEligibleForAnyTrial = Object.values(eligibilityResult).some(
                (isEligible) => isEligible
              );

              if (!isEligibleForAnyTrial) {
                // User has used a trial before - mark as subscribed and set exit offer keys
                console.log(
                  "[SubscriptionScreen] User not eligible for any trial - marking as subscribed"
                );
                await storageUtil.setItem(STORAGE_KEYS.HAS_EVER_SUBSCRIBED, "true");
                // Set max show count to prevent exit offer from ever showing
                await storageUtil.setItem(STORAGE_KEYS.EXIT_OFFER_SHOW_COUNT, 5);
                setCanShowExitOffer(false);
                return;
              }
            } catch (trialError) {
              // If API check fails, continue with other checks
              console.warn("[SubscriptionScreen] Failed to check trial eligibility:", trialError);
            }
          }
        }

        // First time and eligible - SubscriptionScreen can show exit offer
        setCanShowExitOffer(true);
      } catch (error) {
        setCanShowExitOffer(false);
      }
    };

    checkExitOfferEligibility();
  }, [visible, plans, checkTrialEligibilityApi]); // Re-check when modal becomes visible or plans change

  // Filter to only show plans higher than current (upgrade options only)
  const activePlans = useMemo(() => {
    const allActive = (plans ?? [])
      .filter((plan) => plan.is_active && plan.id !== "free")
      .sort((a, b) => a.sort_order - b.sort_order);

    return allActive;
  }, [plans]);

  useEffect(() => {
    if (!selectedPlanId && activePlans.length > 0) {
      setSelectedPlanId(activePlans[0].id);
    }
  }, [activePlans, selectedPlanId]);

  useEffect(() => {
    setShowAllFeatures(false);
  }, [selectedPlanId]);

  const selectedPlan = useMemo(
    () => activePlans.find((plan) => plan.id === selectedPlanId) ?? null,
    [activePlans, selectedPlanId]
  );

  const getNumericPrice = (value: any) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  // Check trial eligibility using RevenueCat context API
  useEffect(() => {
    const checkAllTrialEligibility = async () => {
      if (!activePlans.length) return;

      try {
        // Collect all product IDs for current billing period
        const productIds: string[] = [];
        const productToPlanMap: Record<string, string> = {};

        for (const plan of activePlans) {
          const productId = isIOS
            ? billingPeriod === "annual"
              ? plan.product_id_ios_annual
              : plan.product_id_ios_monthly
            : billingPeriod === "annual"
              ? plan.product_id_android_annual
              : plan.product_id_android_monthly;

          if (productId) {
            productIds.push(productId);
            productToPlanMap[productId] = plan.id;
          }
        }

        if (productIds.length === 0) return;

        // Use the context API to check eligibility
        const eligibilityResult = await checkTrialEligibilityApi(productIds);

        // Map product eligibility back to plan IDs
        const newEligibility: Record<string, boolean> = {};
        for (const [productId, isEligible] of Object.entries(eligibilityResult)) {
          const planId = productToPlanMap[productId];
          if (planId) {
            newEligibility[planId] = isEligible;
          }
        }
        setTrialEligibility(newEligibility);
      } catch (error) {
        logger.error("Failed to check trial eligibility", { error });
        // Default to false (not eligible) on error
        const newEligibility: Record<string, boolean> = {};
        for (const plan of activePlans) {
          newEligibility[plan.id] = false;
        }
        setTrialEligibility(newEligibility);
      }
    };

    checkAllTrialEligibility();
  }, [activePlans, billingPeriod, checkTrialEligibilityApi]);

  // Helper to check eligibility for a specific plan
  const checkTrialEligibility = useCallback(
    (plan: any): boolean => {
      if (!plan) return false;
      return trialEligibility[plan.id] ?? false;
    },
    [trialEligibility]
  );

  // Memoized eligibility check for the currently selected plan
  const isUserEligibleForTrial = useMemo(() => {
    return checkTrialEligibility(selectedPlan);
  }, [checkTrialEligibility, selectedPlan]);

  const handleBillingToggle = (period: BillingPeriod) => {
    setBillingPeriod(period);
    capture("subscription_billing_period_changed", {
      billing_period: period,
      source: "onboarding"
    });
  };

  const getDisplayedPrice = (plan: any) =>
    billingPeriod === "annual"
      ? getNumericPrice(plan.annual_price)
      : getNumericPrice(plan.monthly_price);

  const handleContinue = async () => {
    if (!selectedPlan) {
      await showAlert({
        title: t("onboarding.subscription.no_plan_title"),
        variant: "warning"
      });
      return;
    }

    setIsProcessing(true);
    capture("subscription_cta_pressed", {
      plan: selectedPlan.id,
      billing_period: billingPeriod,
      has_trial: selectedPlan.has_trial,
      trial_days: selectedPlan.trial_days
    });

    try {
      // Get the correct product ID based on platform and billing period
      const productId = isIOS
        ? billingPeriod === "annual"
          ? selectedPlan.product_id_ios_annual
          : selectedPlan.product_id_ios_monthly
        : billingPeriod === "annual"
          ? selectedPlan.product_id_android_annual
          : selectedPlan.product_id_android_monthly;

      if (!productId) {
        throw new Error(`No product ID found for ${selectedPlan.id} ${billingPeriod}`);
      }

      // Find the package in offerings that matches this product ID
      let targetPackage = null;

      // Search through all offerings to find the matching package
      const allOfferings = currentOffering
        ? [currentOffering, ...offerings.filter((o) => o.identifier !== currentOffering.identifier)]
        : offerings;

      for (const offering of allOfferings) {
        const pkg = offering.packages.find(
          (p) => p.identifier === productId || p.identifier.includes(productId)
        );
        if (pkg) {
          targetPackage = pkg;
          break;
        }
      }

      if (!targetPackage) {
        // Fallback: use the generic purchase function with just the period
        const success = await purchase(billingPeriod);
        if (success) {
          capture("subscription_purchase_success", {
            plan: selectedPlan.id,
            billing_period: billingPeriod
          });
          // Close modal FIRST to avoid UI flash, then update subscription state
          handleClose();
          await markAsSubscribed();
        }
        return;
      }

      // Purchase the specific package
      const success = await purchasePackage(targetPackage);

      if (success) {
        capture("subscription_purchase_success", {
          plan: selectedPlan.id,
          billing_period: billingPeriod
        });

        // Close modal FIRST to avoid UI flash, then update subscription state
        handleClose();
        await markAsSubscribed();
      } else {
        // Purchase was cancelled or failed
      }
    } catch (error) {
      logger.error("Failed to complete subscription purchase", {
        error: error instanceof Error ? error.message : String(error)
      });
      capture("subscription_purchase_error", {
        plan: selectedPlan.id,
        billing_period: billingPeriod,
        error: error instanceof Error ? error.message : "Unknown error"
      });
      await showAlert({
        title: t("onboarding.subscription.error_title"),
        message: t("onboarding.subscription.error_message"),
        variant: "error"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = useCallback(async () => {
    // Check eligibility at the moment of close (not from cached state)
    // This avoids race conditions with resetForTesting
    const rawShowCount = await storageUtil.getItem<number>(STORAGE_KEYS.EXIT_OFFER_SHOW_COUNT);
    const currentCount = rawShowCount || 0;

    // Check if user has EVER subscribed from the backend (survives app reinstall)
    // Users who subscribed before (even if expired) should pay full price
    const { useSubscriptionStore } = await import("@/stores/subscriptionStore");
    const hasEverSubscribedBackend = useSubscriptionStore.getState().hasEverSubscribed();

    // Also check local storage as fallback (in case backend hasn't loaded yet)
    const localHasSubscribed = await storageUtil.getItem(STORAGE_KEYS.HAS_EVER_SUBSCRIBED);
    const neverSubscribed = !hasEverSubscribedBackend && localHasSubscribed !== "true";

    // Only show exit offer if:
    // 1. First time (count === 0)
    // 2. Not already showing
    // 3. User has NEVER subscribed before (expired users pay full price)
    const canShowNow = currentCount === 0 && !showExitIntentModal && neverSubscribed;

    // Show exit intent if eligible and not already showing
    // Check BOTH cached state AND fresh storage value
    if (canShowNow) {
      await storageUtil.setItem(STORAGE_KEYS.EXIT_OFFER_SHOW_COUNT, currentCount + 1);
      await storageUtil.setItem(STORAGE_KEYS.EXIT_OFFER_LAST_SHOWN, new Date().toISOString());

      // Set expiry time for countdown
      const expiry = new Date(Date.now() + EXIT_OFFER_COUNTDOWN_MINUTES * 60 * 1000);

      // Also set in global store for floating button on other screens
      setExitOffer(expiry);

      // Prevent showing again this session
      setCanShowExitOffer(false);

      // Close subscription modal AND show exit intent modal
      if (onClose) {
        onClose();
      } else {
        setInternalVisible(false);
      }
      await openExitIntentModal();
      return;
    }

    if (onClose) {
      onClose();
    } else {
      // Close modal and navigate
      setInternalVisible(false);
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace(MOBILE_ROUTES.MAIN.HOME);
      }
    }
  }, [
    onClose,
    canShowExitOffer,
    showExitIntentModal,
    billingPeriod,
    selectedPlanId,
    capture,
    setExitOffer,
    openExitIntentModal
  ]);

  // Open platform subscription management (iOS/Android)
  const handleManageSubscription = useCallback(async () => {
    capture("subscription_manage_pressed", { current_plan: currentPlan });

    try {
      if (isIOS) {
        // iOS: Opens Settings > Apple ID > Subscriptions
        await Linking.openURL("https://apps.apple.com/account/subscriptions");
      } else {
        // Android: Opens Google Play subscription management
        await Linking.openURL("https://play.google.com/store/account/subscriptions");
      }
    } catch (error) {
      logger.error("Failed to open subscription management", { error });
      await showAlert({
        title: t("onboarding.subscription.manage_error_title"),
        message: t("onboarding.subscription.manage_error_message"),
        variant: "error"
      });
    }
  }, [capture, currentPlan, showAlert, t]);

  // Handle restore purchases
  // Note: Alerts are shown by RevenueCatContext
  const handleRestorePurchases = useCallback(async () => {
    setIsRestoring(true);
    capture("subscription_restore_initiated");

    try {
      const success = await restorePurchases();

      if (success) {
        capture("subscription_restore_success");
        // Close modal FIRST to avoid UI flash, then update subscription state
        handleClose();
        await markAsSubscribed();
      } else {
        capture("subscription_restore_no_purchases");
      }
    } catch (error) {
      capture("subscription_restore_error", {
        error: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setIsRestoring(false);
    }
  }, [capture, restorePurchases, markAsSubscribed, handleClose]);

  const ctaLabel =
    selectedPlan && selectedPlan.has_trial && isUserEligibleForTrial && billingPeriod === "annual"
      ? t("onboarding.subscription.cta_trial", {
          days: selectedPlan.trial_days ?? 0
        })
      : t("onboarding.subscription.cta_subscribe");

  // Calculate savings percentage for display
  const savingsPercent = useMemo(() => {
    if (!selectedPlan) return 0;
    const monthly = getNumericPrice(selectedPlan.monthly_price);
    const annual = getNumericPrice(selectedPlan.annual_price);
    if (monthly > 0 && annual > 0) {
      const monthlyTotal = monthly * 12;
      return Math.max(0, Math.round(((monthlyTotal - annual) / monthlyTotal) * 100));
    }
    return 0;
  }, [selectedPlan]);

  const modalContent = (
    <View style={styles.modalContent}>
      <TouchableOpacity
        style={[styles.closeButton, { top: insets.top + toRN(tokens.spacing[4]) }]}
        onPress={handleClose}
        testID="subscription-close"
        accessibilityLabel={t("common.close")}
        accessibilityRole="button"
      >
        <Ionicons
          name="close"
          size={toRN(tokens.typography.fontSize.xl)}
          color={colors.text.primary}
        />
      </TouchableOpacity>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          {/* Compact icon instead of large image */}
          <View style={styles.heroIconContainer}>
            <Ionicons name="rocket" size={32} color={brandColors.primary} />
          </View>

          <Text style={styles.heroTitle}>
            {hasActiveSubscription
              ? t("onboarding.subscription.upgrade_title")
              : t("onboarding.subscription.hero_title")}
          </Text>
          <Text style={styles.heroSubtitle}>
            {hasActiveSubscription
              ? t("onboarding.subscription.upgrade_subtitle", {
                  plan: currentPlan
                })
              : t("onboarding.subscription.hero_subtitle")}
          </Text>

          {/* Trust badges */}
          <View style={styles.trustBadges}>
            <View style={styles.trustBadge}>
              <Ionicons name="lock-closed" size={14} color={brandColors.primary} />
              <Text style={styles.trustBadgeText}>
                {t("onboarding.subscription.cancel_anytime")}
              </Text>
            </View>
            <View style={styles.trustBadgeDivider} />
            <View style={styles.trustBadge}>
              <Ionicons name="star" size={14} color="#F59E0B" />
              <Text style={styles.trustBadgeText}>{t("onboarding.subscription.rating_badge")}</Text>
            </View>
          </View>
        </View>

        {/* Billing Toggle */}
        <View style={styles.billingToggle}>
          <TouchableOpacity
            onPress={() => handleBillingToggle("monthly")}
            style={[
              styles.toggleOption,
              billingPeriod === "monthly" && styles.toggleOptionSelected
            ]}
          >
            <Text
              style={[styles.toggleText, billingPeriod === "monthly" && styles.toggleTextSelected]}
            >
              {t("onboarding.subscription.toggle_monthly")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleBillingToggle("annual")}
            style={[styles.toggleOption, billingPeriod === "annual" && styles.toggleOptionSelected]}
          >
            <View style={styles.toggleContent}>
              <Text
                style={[styles.toggleText, billingPeriod === "annual" && styles.toggleTextSelected]}
              >
                {t("onboarding.subscription.toggle_annual")}
              </Text>
              {savingsPercent > 0 && (
                <View
                  style={[
                    styles.savingsBadge,
                    billingPeriod === "annual" && styles.savingsBadgeSelected
                  ]}
                >
                  <Text
                    style={[
                      styles.savingsBadgeText,
                      billingPeriod === "annual" && styles.savingsBadgeTextSelected
                    ]}
                  >
                    -{savingsPercent}%
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Full-Width Pricing Display */}
        <View style={styles.pricingSection}>
          {plansLoading ? (
            <View style={styles.pricingSkeletonContainer}>
              <SkeletonBox width="100%" height={120} />
            </View>
          ) : selectedPlan ? (
            <Card shadow="xl" style={styles.pricingCard}>
              {/* Plan Name with Trial Badge inline */}
              <View style={styles.planHeaderRow}>
                <Text style={styles.planName}>{selectedPlan.name}</Text>
                {selectedPlan.has_trial &&
                  selectedPlan.trial_days &&
                  isUserEligibleForTrial &&
                  billingPeriod === "annual" && (
                    <View style={styles.trialBadgeInline}>
                      <Ionicons name="gift" size={12} color={brandColors.primary} />
                      <Text style={styles.trialBadgeTextInline}>
                        {t("onboarding.subscription.trial_badge", {
                          days: selectedPlan.trial_days
                        })}
                      </Text>
                    </View>
                  )}
              </View>

              {/* Price Display */}
              <View style={styles.priceRow}>
                {billingPeriod === "annual" ? (
                  <>
                    {/* Show monthly equivalent prominently for annual */}
                    <View style={styles.priceDisplay}>
                      <Text style={styles.priceMain}>
                        ${(getNumericPrice(selectedPlan.annual_price) / 12).toFixed(2)}
                      </Text>
                      <Text style={styles.pricePeriod}>
                        {t("onboarding.subscription.per_month")}
                      </Text>
                    </View>
                    <View style={styles.billedAnnuallyRow}>
                      <Text style={styles.strikethroughPrice}>
                        ${getNumericPrice(selectedPlan.monthly_price).toFixed(2)}
                        {t("onboarding.subscription.per_mo")}
                      </Text>
                      <Text style={styles.billedAnnuallyText}>
                        {t("onboarding.subscription.billed_annually", {
                          price: getNumericPrice(selectedPlan.annual_price).toFixed(2)
                        })}
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.priceDisplay}>
                      <Text style={styles.priceMain}>
                        ${getDisplayedPrice(selectedPlan).toFixed(2)}
                      </Text>
                      <Text style={styles.pricePeriod}>
                        {t("onboarding.subscription.per_month")}
                      </Text>
                    </View>
                    <Text style={styles.billedMonthlyText}>
                      {t("onboarding.subscription.billed_monthly")}
                    </Text>
                  </>
                )}
              </View>
            </Card>
          ) : null}
        </View>

        {selectedPlan && (
          <View style={styles.selectedFeaturesWrapper}>
            <Card shadow="xl" style={styles.selectedFeaturesCard}>
              <Text style={styles.sectionHeading}>
                {t("onboarding.subscription.premium_features")}
              </Text>
              {(() => {
                // V2: Each plan has its own features directly attached
                // Filter out technical features that shouldn't be shown to users
                const HIDDEN_FEATURES = ["voice_note_max_duration", "voice_note_max_file_size"];

                const sortedFeatures = [...(selectedPlan.features || [])]
                  .filter((f: any) => !HIDDEN_FEATURES.includes(f.feature_key))
                  .sort((a: any, b: any) => {
                    const sortA = typeof a.sort_order === "number" ? a.sort_order : 999;
                    const sortB = typeof b.sort_order === "number" ? b.sort_order : 999;
                    return sortA - sortB;
                  });

                const displayedFeatures = showAllFeatures
                  ? sortedFeatures
                  : sortedFeatures.slice(0, 5);

                return (
                  <>
                    {displayedFeatures.map((feature: any, index: number) => (
                      <View key={feature.id || index} style={styles.detailItem}>
                        <View style={styles.detailIconWrapper}>
                          <CheckmarkCircle size={14} />
                        </View>
                        <View style={styles.detailCopy}>
                          <Text style={styles.detailTitle}>{feature.feature_name}</Text>
                          {feature.feature_description ? (
                            <Text style={styles.detailSubtitle}>{feature.feature_description}</Text>
                          ) : null}
                        </View>
                      </View>
                    ))}
                    {sortedFeatures.length > 5 && (
                      <TouchableOpacity
                        onPress={() => setShowAllFeatures((prev) => !prev)}
                        style={styles.featuresToggle}
                      >
                        <Text style={styles.featuresToggleText}>
                          {showAllFeatures
                            ? t("onboarding.subscription.view_less")
                            : t("onboarding.subscription.view_all", {
                                count: sortedFeatures.length - 5
                              })}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                );
              })()}
            </Card>
          </View>
        )}

        <View style={styles.linksSectionWrapper}>
          <Card shadow="xl" style={styles.linksSection}>
            {/* Show Manage Subscription for existing subscribers */}
            {hasActiveSubscription && (
              <TouchableOpacity style={styles.linkRow} onPress={handleManageSubscription}>
                <Text style={styles.linkText}>
                  {t("onboarding.subscription.manage_subscription")}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.linkRow}
              onPress={handleRestorePurchases}
              disabled={isRestoring || isProcessing}
            >
              <Text style={styles.linkText}>{t("onboarding.subscription.restore_purchase")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkRow} onPress={() => setShowFaqModal(true)}>
              <Text style={styles.linkText}>{t("onboarding.subscription.faq")}</Text>
            </TouchableOpacity>
            <LinkText
              url={externalUrls.termsOfService}
              title={t("onboarding.subscription.terms")}
              style={[styles.linkText, styles.linkPadding]}
              underline={false}
            >
              {t("onboarding.subscription.terms")}
            </LinkText>
            <LinkText
              url={externalUrls.privacyPolicy}
              title={t("onboarding.subscription.privacy")}
              style={[styles.linkText, styles.linkPadding]}
              underline={false}
            >
              {t("onboarding.subscription.privacy")}
            </LinkText>
          </Card>
        </View>

        <View style={styles.disclaimerWrapper}>
          <Card shadow="xl" style={styles.disclaimerCard}>
            <Text style={styles.disclaimerText}>{t("onboarding.subscription.legal_copy")}</Text>
          </Card>
        </View>
      </ScrollView>

      <View style={styles.ctaBar}>
        <Button
          title={isProcessing ? t("common.loading") : ctaLabel}
          onPress={handleContinue}
          disabled={isProcessing || !selectedPlan}
        />
        <View style={styles.offerPill}>
          <Text style={styles.offerText}>
            {selectedPlan?.has_trial && isUserEligibleForTrial
              ? t("onboarding.subscription.trial_pill_note")
              : t("onboarding.subscription.offer_note")}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <Modal
      statusBarTranslucent
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalContainer}>
        {modalContent}

        {/* Loading Overlay */}
        <LoadingOverlay visible={isRestoring || isProcessing} />

        {/* Alert Overlay - renders alerts on top of this modal */}
        <AlertOverlay />

        {/* FAQ Modal */}
        <FaqPurchaseModal visible={showFaqModal} onClose={() => setShowFaqModal(false)} />
      </View>
    </Modal>
  );
}

const makeSubscriptionScreenStyles = (tokens: any, colors: any, brand: any) => {
  return {
    modalContainer: {
      flex: 1,
      backgroundColor: colors.bg.canvas
    },
    modalContent: {
      flex: 1,
      backgroundColor: colors.bg.canvas
    },
    closeButton: {
      position: "absolute" as const,
      right: toRN(tokens.spacing[4]),
      zIndex: 10,
      width: toRN(tokens.spacing[10]),
      height: toRN(tokens.spacing[10]),
      borderRadius: toRN(tokens.borderRadius.full),
      backgroundColor: colors.bg.muted,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      shadowColor: colors.shadow.md,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3
    },
    container: {
      flex: 1,
      backgroundColor: colors.bg.canvas
    },
    scrollView: {
      flexGrow: 1,
      flexShrink: 1
    },
    scrollContent: {
      paddingBottom: toRN(tokens.spacing[6])
    },
    hero: {
      alignItems: "center" as const,
      paddingHorizontal: toRN(tokens.spacing[6]),
      paddingTop: toRN(tokens.spacing[16]), // Space for close button
      paddingBottom: toRN(tokens.spacing[5]),
      backgroundColor: brand.primary + "12" // ~7% opacity - subtle
    },
    heroIconContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: brand.primary + "20",
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginBottom: toRN(tokens.spacing[3]),
      // Subtle shadow
      shadowColor: brand.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4
    },
    heroTitle: {
      fontSize: toRN(tokens.typography.fontSize["2xl"]),
      fontWeight: tokens.typography.fontWeight.bold,
      fontFamily: fontFamily.groteskBold,
      color: colors.text.primary,
      marginBottom: toRN(tokens.spacing[1]),
      letterSpacing: -0.5,
      textAlign: "center" as const
    },
    heroSubtitle: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.text.secondary,
      fontFamily: fontFamily.groteskRegular,
      textAlign: "center" as const,
      marginBottom: toRN(tokens.spacing[4])
    },
    trustBadges: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: colors.bg.card,
      paddingVertical: toRN(tokens.spacing[2]),
      paddingHorizontal: toRN(tokens.spacing[4]),
      borderRadius: toRN(tokens.borderRadius.full),
      shadowColor: colors.shadow.md,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2
    },
    trustBadge: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: toRN(tokens.spacing[1.5])
    },
    trustBadgeDivider: {
      width: 1,
      height: 16,
      backgroundColor: colors.border.default,
      marginHorizontal: toRN(tokens.spacing[3])
    },
    trustBadgeText: {
      fontSize: toRN(tokens.typography.fontSize.xs),
      color: colors.text.secondary,
      fontFamily: fontFamily.groteskMedium
    },
    billingToggle: {
      flexDirection: "row" as const,
      backgroundColor: colors.bg.card,
      borderRadius: toRN(tokens.borderRadius.lg),
      marginHorizontal: toRN(tokens.spacing[6]),
      marginBottom: toRN(tokens.spacing[5]),
      marginTop: toRN(tokens.spacing[5]),
      padding: toRN(tokens.spacing[1]),
      shadowColor: colors.shadow.xl,
      shadowOffset: { width: 0, height: toRN(tokens.spacing[3]) },
      shadowOpacity: 0.18,
      shadowRadius: toRN(tokens.spacing[6]),
      elevation: 8
    },
    toggleOption: {
      flex: 1,
      paddingVertical: toRN(tokens.spacing[3]),
      alignItems: "center" as const,
      borderRadius: toRN(tokens.borderRadius.md)
    },
    toggleOptionSelected: {
      backgroundColor: brand.primary,
      shadowColor: brand.primary,
      shadowOffset: { width: 0, height: toRN(tokens.spacing[1]) },
      shadowOpacity: 0.25,
      shadowRadius: toRN(tokens.spacing[2])
    },
    toggleText: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      fontWeight: tokens.typography.fontWeight.medium,
      color: colors.text.secondary,
      fontFamily: fontFamily.groteskMedium
    },
    toggleTextSelected: {
      color: brand.onPrimary
    },
    toggleContent: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: toRN(tokens.spacing[2])
    },
    savingsBadge: {
      backgroundColor: brand.primary + "20",
      borderRadius: toRN(tokens.borderRadius.sm),
      paddingHorizontal: toRN(tokens.spacing[1.5]),
      paddingVertical: toRN(tokens.spacing[0.5])
    },
    savingsBadgeSelected: {
      backgroundColor: brand.onPrimary + "30"
    },
    savingsBadgeText: {
      fontSize: toRN(tokens.typography.fontSize.xs),
      fontWeight: tokens.typography.fontWeight.bold,
      color: brand.primary,
      fontFamily: fontFamily.groteskBold
    },
    savingsBadgeTextSelected: {
      color: brand.onPrimary
    },
    // Full-width Pricing Section
    pricingSection: {
      paddingHorizontal: toRN(tokens.spacing[6]),
      marginBottom: toRN(tokens.spacing[4])
    },
    pricingSkeletonContainer: {
      width: "100%"
    },
    pricingCard: {
      paddingVertical: toRN(tokens.spacing[5]),
      paddingHorizontal: toRN(tokens.spacing[5]),
      borderWidth: 1,
      borderColor: brand.primary + "12",
      backgroundColor: brand.primary + "06"
    },
    planHeaderRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      marginBottom: toRN(tokens.spacing[3])
    },
    planName: {
      fontSize: toRN(tokens.typography.fontSize.base),
      fontWeight: tokens.typography.fontWeight.semibold,
      color: brand.primary,
      fontFamily: fontFamily.groteskSemiBold,
      textTransform: "uppercase" as const,
      letterSpacing: 1
    },
    trialBadgeInline: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: toRN(tokens.spacing[1]),
      backgroundColor: brand.primary + "15",
      paddingHorizontal: toRN(tokens.spacing[2]),
      paddingVertical: toRN(tokens.spacing[1]),
      borderRadius: toRN(tokens.borderRadius.full)
    },
    trialBadgeTextInline: {
      fontSize: toRN(tokens.typography.fontSize.xs),
      fontWeight: tokens.typography.fontWeight.medium,
      color: brand.primary,
      fontFamily: fontFamily.groteskMedium
    },
    priceRow: {
      alignItems: "flex-start" as const
    },
    priceDisplay: {
      flexDirection: "row" as const,
      alignItems: "baseline" as const
    },
    priceMain: {
      fontSize: toRN(tokens.typography.fontSize["3xl"]),
      fontWeight: tokens.typography.fontWeight.bold,
      color: colors.text.primary,
      fontFamily: fontFamily.groteskBold,
      letterSpacing: -0.5
    },
    pricePeriod: {
      fontSize: toRN(tokens.typography.fontSize.base),
      color: colors.text.secondary,
      fontFamily: fontFamily.groteskMedium,
      marginLeft: toRN(tokens.spacing[0.5])
    },
    billedAnnuallyRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: toRN(tokens.spacing[2]),
      marginTop: toRN(tokens.spacing[1])
    },
    strikethroughPrice: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.text.tertiary,
      fontFamily: fontFamily.groteskRegular,
      textDecorationLine: "line-through" as const
    },
    billedAnnuallyText: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.text.secondary,
      fontFamily: fontFamily.groteskRegular
    },
    billedMonthlyText: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.text.secondary,
      fontFamily: fontFamily.groteskRegular,
      marginTop: toRN(tokens.spacing[1])
    },
    selectedFeaturesWrapper: {
      marginTop: toRN(tokens.spacing[2]),
      paddingHorizontal: toRN(tokens.spacing[6])
    },
    selectedFeaturesCard: {
      paddingVertical: toRN(tokens.spacing[5]),
      paddingHorizontal: toRN(tokens.spacing[5])
    },
    sectionHeading: {
      fontSize: toRN(tokens.typography.fontSize.lg),
      fontWeight: tokens.typography.fontWeight.semibold,
      fontFamily: fontFamily.groteskSemiBold,
      color: colors.text.primary,
      marginBottom: toRN(tokens.spacing[3])
    },
    detailItem: {
      flexDirection: "row" as const,
      alignItems: "flex-start" as const,
      marginBottom: toRN(tokens.spacing[4])
    },
    detailIconWrapper: {
      width: toRN(tokens.spacing[6]),
      height: toRN(tokens.spacing[6]),
      borderRadius: toRN(tokens.spacing[4]),
      backgroundColor: brand.primary + "15",
      alignItems: "center" as const,
      justifyContent: "center" as const
    },
    detailCopy: {
      flex: 1,
      marginLeft: toRN(tokens.spacing[3]),
      justifyContent: "center" as const
    },
    detailTitle: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.text.primary,
      fontFamily: fontFamily.groteskMedium
    },
    detailSubtitle: {
      marginTop: toRN(tokens.spacing[1]),
      fontSize: toRN(tokens.typography.fontSize.xs),
      color: colors.text.secondary,
      fontFamily: fontFamily.groteskRegular,
      lineHeight: toRN(tokens.typography.fontSize.xs * 1.4)
    },
    lowerTierNote: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.text.secondary,
      fontFamily: fontFamily.groteskRegular,
      marginBottom: toRN(tokens.spacing[2])
    },
    featuresToggle: {
      marginTop: toRN(tokens.spacing[2]),
      alignSelf: "flex-start" as const
    },
    featuresToggleText: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: brand.primary,
      fontFamily: fontFamily.groteskMedium
    },
    linksSectionWrapper: {
      marginTop: toRN(tokens.spacing[6]),
      paddingHorizontal: toRN(tokens.spacing[6])
    },
    linksSection: {
      paddingHorizontal: toRN(tokens.spacing[5]),
      paddingVertical: toRN(tokens.spacing[4]),
      gap: toRN(tokens.spacing[1])
    },
    linkRow: {
      paddingVertical: toRN(tokens.spacing[2])
    },
    linkPadding: {
      paddingVertical: toRN(tokens.spacing[2])
    },
    linkText: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.text.primary,
      fontFamily: fontFamily.groteskMedium
    },
    disclaimerWrapper: {
      marginTop: toRN(tokens.spacing[6]),
      paddingHorizontal: toRN(tokens.spacing[6])
    },
    disclaimerCard: {
      paddingHorizontal: toRN(tokens.spacing[5]),
      paddingVertical: toRN(tokens.spacing[4])
    },
    disclaimerText: {
      fontSize: toRN(tokens.typography.fontSize.xs),
      color: colors.text.tertiary,
      fontFamily: fontFamily.groteskRegular,
      lineHeight: toRN(tokens.typography.fontSize.xs * 1.4)
    },
    ctaBar: {
      paddingHorizontal: toRN(tokens.spacing[6]),
      paddingTop: toRN(tokens.spacing[4]),
      paddingBottom: toRN(tokens.spacing[4]),
      backgroundColor: colors.bg.canvas,
      borderTopWidth: toRN(tokens.spacing[0.25]),
      borderTopColor: colors.border.default
    },

    offerPill: {
      marginTop: toRN(tokens.spacing[3]),
      alignSelf: "center",
      backgroundColor: brand.primary + "1F", // ~12% opacity in hex
      borderRadius: toRN(tokens.borderRadius.full),
      paddingHorizontal: toRN(tokens.spacing[3]),
      paddingVertical: toRN(tokens.spacing[1.5])
    },
    offerText: {
      fontSize: toRN(tokens.typography.fontSize.xs),
      color: brand.primary,
      fontFamily: fontFamily.groteskMedium
    }
  };
};
