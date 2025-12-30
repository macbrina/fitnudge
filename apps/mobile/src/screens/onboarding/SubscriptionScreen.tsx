import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import LinkText from "@/components/ui/LinkText";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { SkeletonCard } from "@/components/ui/SkeletonBox";
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
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Linking,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type BillingPeriod = "monthly" | "annual";

interface SubscriptionScreenProps {
  visible?: boolean;
  onClose?: () => void;
}

export default function SubscriptionScreen({
  visible: visibleProp = true,
  onClose,
}: SubscriptionScreenProps = {}) {
  // When used as a standalone screen (no onClose), manage visibility internally
  const [internalVisible, setInternalVisible] = useState(true);
  const visible = onClose ? visibleProp : internalVisible;

  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("annual");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [planCardHeight, setPlanCardHeight] = useState<number | null>(null);
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const [canShowExitOffer, setCanShowExitOffer] = useState(false);
  const [trialEligibility, setTrialEligibility] = useState<
    Record<string, boolean>
  >({});

  const { t } = useTranslation();
  const styles = useStyles(makeSubscriptionScreenStyles);
  const insets = useSafeAreaInsets();
  const { colors, brandColors } = useTheme();
  const { capture } = usePostHog();
  const { plans, isLoading: plansLoading } = usePricing();
  const { showAlert } = useAlertModal();
  const { getPlan } = useSubscriptionStore();
  const currentPlan = getPlan();

  // Plan tier hierarchy: free=0, starter=1, pro=2, elite=3
  type PlanId = "free" | "starter" | "pro" | "elite";
  const PLAN_TIERS: Record<PlanId, number> = {
    free: 0,
    starter: 1,
    pro: 2,
    elite: 3,
  };

  const currentTier = PLAN_TIERS[currentPlan as PlanId] || 0;
  const isOnHighestPlan = currentPlan === "elite";
  const hasActiveSubscription = currentPlan !== "free";
  const {
    setExitOffer,
    markAsSubscribed,
    showExitIntentModal,
    openExitIntentModal,
  } = useExitOfferStore();
  const {
    purchase,
    purchasePackage,
    restorePurchases,
    offerings,
    currentOffering,
    checkTrialEligibility: checkTrialEligibilityApi,
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
        // Get show count - read raw value first
        const rawShowCount = await storageUtil.getItem<number>(
          STORAGE_KEYS.EXIT_OFFER_SHOW_COUNT,
        );
        const showCount = rawShowCount || 0;

        // SubscriptionScreen only triggers exit offer if it has NEVER been shown
        // After first show, FloatingOfferButton on HomeScreen handles proactive shows
        if (showCount > 0) {
          setCanShowExitOffer(false);
          return;
        }

        // First time - SubscriptionScreen can show exit offer
        setCanShowExitOffer(true);
      } catch (error) {
        setCanShowExitOffer(false);
      }
    };

    checkExitOfferEligibility();
  }, [visible]); // Re-check when modal becomes visible

  useEffect(() => {
    capture("subscription_screen_shown", {
      billing_period: billingPeriod,
      source: "onboarding",
    });
  }, []);

  // Filter to only show plans higher than current (upgrade options only)
  const activePlans = useMemo(() => {
    const allActive = (plans ?? [])
      .filter((plan) => plan.is_active && plan.id !== "free")
      .sort((a, b) => a.sort_order - b.sort_order);

    // If user has a subscription, only show plans that are upgrades
    if (hasActiveSubscription) {
      return allActive.filter((plan) => {
        const planTier = PLAN_TIERS[plan.id as PlanId] ?? 0;
        return planTier > currentTier;
      });
    }

    return allActive;
  }, [plans, hasActiveSubscription, currentTier]);

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
    [activePlans, selectedPlanId],
  );

  const selectedPlanIndex = useMemo(() => {
    if (!selectedPlan) return -1;
    return activePlans.findIndex((plan) => plan.id === selectedPlan.id);
  }, [activePlans, selectedPlan]);

  const previousPlanName =
    selectedPlanIndex > 0
      ? (activePlans[selectedPlanIndex - 1]?.name ?? null)
      : null;

  const getNumericPrice = (value: any) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const maxAnnualSavingsPercent = useMemo(() => {
    if (!activePlans.length || billingPeriod !== "annual") return 0;
    return activePlans.reduce((max, plan) => {
      const monthly = getNumericPrice(plan.monthly_price);
      const annual = getNumericPrice(plan.annual_price);
      if (monthly > 0 && annual > 0) {
        const monthlyTotal = monthly * 12;
        const pct = Math.max(
          0,
          Math.round(((monthlyTotal - annual) / monthlyTotal) * 100),
        );
        return Math.max(max, pct);
      }
      return max;
    }, 0);
  }, [activePlans, billingPeriod]);

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
        for (const [productId, isEligible] of Object.entries(
          eligibilityResult,
        )) {
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
    [trialEligibility],
  );

  // Memoized eligibility check for the currently selected plan
  const isUserEligibleForTrial = useMemo(() => {
    return checkTrialEligibility(selectedPlan);
  }, [checkTrialEligibility, selectedPlan]);

  const handleBillingToggle = (period: BillingPeriod) => {
    setBillingPeriod(period);
    capture("subscription_billing_period_changed", {
      billing_period: period,
      source: "onboarding",
    });
  };

  const handlePlanSelect = (planId: string) => {
    setSelectedPlanId(planId);
    capture("subscription_plan_selected", {
      plan: planId,
      billing_period: billingPeriod,
      source: "onboarding",
    });
  };

  const getDisplayedPrice = (plan: any) =>
    billingPeriod === "annual"
      ? getNumericPrice(plan.annual_price)
      : getNumericPrice(plan.monthly_price);

  const getComparePrice = (plan: any) => {
    if (billingPeriod !== "annual") return null;
    const annualPrice = getNumericPrice(plan.annual_price);
    if (annualPrice <= 0) return null;
    return annualPrice / 12;
  };

  const handleContinue = async () => {
    if (!selectedPlan) {
      await showAlert({
        title: t("onboarding.subscription.no_plan_title"),
        variant: "warning",
      });
      return;
    }

    setIsProcessing(true);
    capture("subscription_cta_pressed", {
      plan: selectedPlan.id,
      billing_period: billingPeriod,
      has_trial: selectedPlan.has_trial,
      trial_days: selectedPlan.trial_days,
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
        throw new Error(
          `No product ID found for ${selectedPlan.id} ${billingPeriod}`,
        );
      }

      // Find the package in offerings that matches this product ID
      let targetPackage = null;

      // Search through all offerings to find the matching package
      const allOfferings = currentOffering
        ? [
            currentOffering,
            ...offerings.filter(
              (o) => o.identifier !== currentOffering.identifier,
            ),
          ]
        : offerings;

      for (const offering of allOfferings) {
        const pkg = offering.packages.find(
          (p) => p.identifier === productId || p.identifier.includes(productId),
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
          await markAsSubscribed();
          capture("subscription_purchase_success", {
            plan: selectedPlan.id,
            billing_period: billingPeriod,
          });
          handleClose();
        }
        return;
      }

      // Purchase the specific package
      const success = await purchasePackage(targetPackage);

      if (success) {
        // Mark user as subscribed
        await markAsSubscribed();

        capture("subscription_purchase_success", {
          plan: selectedPlan.id,
          billing_period: billingPeriod,
        });

        // Close the subscription screen
        handleClose();
      } else {
        // Purchase was cancelled or failed
      }
    } catch (error) {
      logger.error("Failed to complete subscription purchase", {
        error: error instanceof Error ? error.message : String(error),
      });
      capture("subscription_purchase_error", {
        plan: selectedPlan.id,
        billing_period: billingPeriod,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      await showAlert({
        title: t("onboarding.subscription.error_title"),
        message: t("onboarding.subscription.error_message"),
        variant: "error",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = useCallback(async () => {
    // Check eligibility at the moment of close (not from cached state)
    // This avoids race conditions with resetForTesting
    const rawShowCount = await storageUtil.getItem<number>(
      STORAGE_KEYS.EXIT_OFFER_SHOW_COUNT,
    );
    const currentCount = rawShowCount || 0;
    const canShowNow = currentCount === 0 && !showExitIntentModal;

    // Show exit intent if eligible and not already showing
    // Check BOTH cached state AND fresh storage value
    if (canShowNow) {
      await storageUtil.setItem(
        STORAGE_KEYS.EXIT_OFFER_SHOW_COUNT,
        currentCount + 1,
      );
      await storageUtil.setItem(
        STORAGE_KEYS.EXIT_OFFER_LAST_SHOWN,
        new Date().toISOString(),
      );

      // Set expiry time for countdown
      const expiry = new Date(
        Date.now() + EXIT_OFFER_COUNTDOWN_MINUTES * 60 * 1000,
      );

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
      openExitIntentModal();
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
    openExitIntentModal,
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
        await Linking.openURL(
          "https://play.google.com/store/account/subscriptions",
        );
      }
    } catch (error) {
      logger.error("Failed to open subscription management", { error });
      await showAlert({
        title: t("onboarding.subscription.manage_error_title"),
        message: t("onboarding.subscription.manage_error_message"),
        variant: "error",
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
        // Mark as subscribed and close after alert is dismissed
        await markAsSubscribed();
        handleClose();
      } else {
        capture("subscription_restore_no_purchases");
      }
    } catch (error) {
      capture("subscription_restore_error", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsRestoring(false);
    }
  }, [capture, restorePurchases, markAsSubscribed, handleClose]);

  const ctaLabel =
    selectedPlan && selectedPlan.has_trial && isUserEligibleForTrial
      ? t("onboarding.subscription.cta_trial", {
          days: selectedPlan.trial_days ?? 0,
        })
      : t("onboarding.subscription.cta_subscribe");

  const planCardWidth =
    (styles.planCard && "width" in styles.planCard && styles.planCard.width) ||
    toRN(tokens.spacing[64]) + toRN(tokens.spacing[1]); // 16.25rem = 260px
  const defaultPlanCardHeight = toRN(tokens.spacing[12]) * 5; // 15rem = 240px
  const skeletonCardHeight = planCardHeight ?? defaultPlanCardHeight;

  const handlePlanCardLayout = useCallback((event: any) => {
    const { height } = event.nativeEvent.layout;
    setPlanCardHeight((prev) => {
      if (prev === null || Math.abs(prev - height) > 1) {
        return height;
      }
      return prev;
    });
  }, []);

  const renderPlanCard = (plan: any, index?: number) => {
    const price = getDisplayedPrice(plan);
    const comparePrice = getComparePrice(plan);
    const isSelected = selectedPlanId === plan.id;
    const isPlanEligibleForTrial = checkTrialEligibility(plan);

    const isLast =
      typeof index === "number" ? index === activePlans.length - 1 : false;

    return (
      <TouchableOpacity
        key={plan.id}
        onPress={() => handlePlanSelect(plan.id)}
        onLayout={index === 0 ? handlePlanCardLayout : undefined}
        style={styles.planCardTouchable}
        accessibilityRole="button"
        accessibilityLabel={`${plan.name}, ${price.toFixed(2)} ${
          billingPeriod === "annual"
            ? t("onboarding.subscription.toggle_annual")
            : t("onboarding.subscription.toggle_monthly")
        }`}
      >
        <Card
          padded={false}
          shadow="xl"
          style={[
            styles.planCard,
            isSelected && styles.planCardSelected,
            !isLast && styles.planCardSpacing,
          ]}
        >
          <View style={styles.planHeader}>
            <Text
              style={[styles.planName, isSelected && styles.planNameSelected]}
            >
              {plan.name}
            </Text>
            {plan.is_popular && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularText}>
                  {t("onboarding.subscription.popular_badge")}
                </Text>
              </View>
            )}
          </View>

          <View>
            <View style={styles.priceContainer}>
              <Text style={[styles.price, isSelected && styles.priceSelected]}>
                ${price.toFixed(2)}
                {billingPeriod === "annual" ? "/year" : "/month"}
              </Text>
              {plan.has_trial && plan.trial_days && isPlanEligibleForTrial ? (
                <Text style={styles.trialPillText}>
                  {t("onboarding.subscription.trial_pill", {
                    days: plan.trial_days,
                  })}
                </Text>
              ) : null}
            </View>
            {comparePrice !== null && (
              <Text style={styles.priceCompare}>
                {t("onboarding.subscription.price_compare", {
                  value: comparePrice.toFixed(2),
                })}
              </Text>
            )}
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  const modalContent = (
    <View style={styles.modalContent}>
      <TouchableOpacity
        style={[
          styles.closeButton,
          { top: insets.top + toRN(tokens.spacing[4]) },
        ]}
        onPress={handleClose}
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
            <Ionicons
              name={isOnHighestPlan ? "trophy" : "rocket"}
              size={32}
              color={brandColors.primary}
            />
          </View>

          <Text style={styles.heroTitle}>
            {isOnHighestPlan
              ? t("onboarding.subscription.on_highest_plan_title")
              : hasActiveSubscription
                ? t("onboarding.subscription.upgrade_title")
                : t("onboarding.subscription.hero_title")}
          </Text>
          <Text style={styles.heroSubtitle}>
            {isOnHighestPlan
              ? t("onboarding.subscription.on_highest_plan_subtitle")
              : hasActiveSubscription
                ? t("onboarding.subscription.upgrade_subtitle", {
                    plan: currentPlan,
                  })
                : t("onboarding.subscription.hero_subtitle")}
          </Text>

          {/* Trust badges */}
          <View style={styles.trustBadges}>
            <View style={styles.trustBadge}>
              <Ionicons
                name="lock-closed"
                size={14}
                color={brandColors.primary}
              />
              <Text style={styles.trustBadgeText}>
                {t("onboarding.subscription.cancel_anytime")}
              </Text>
            </View>
            <View style={styles.trustBadgeDivider} />
            <View style={styles.trustBadge}>
              <Ionicons name="star" size={14} color="#F59E0B" />
              <Text style={styles.trustBadgeText}>
                {t("onboarding.subscription.rating_badge")}
              </Text>
            </View>
          </View>
        </View>

        {/* Only show billing toggle and plans if not on highest plan */}
        {!isOnHighestPlan && (
          <>
            <View style={styles.billingToggle}>
              <TouchableOpacity
                onPress={() => handleBillingToggle("monthly")}
                style={[
                  styles.toggleOption,
                  billingPeriod === "monthly" && styles.toggleOptionSelected,
                ]}
              >
                <Text
                  style={[
                    styles.toggleText,
                    billingPeriod === "monthly" && styles.toggleTextSelected,
                  ]}
                >
                  {t("onboarding.subscription.toggle_monthly")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleBillingToggle("annual")}
                style={[
                  styles.toggleOption,
                  billingPeriod === "annual" && styles.toggleOptionSelected,
                ]}
              >
                <Text
                  style={[
                    styles.toggleText,
                    billingPeriod === "annual" && styles.toggleTextSelected,
                  ]}
                >
                  {maxAnnualSavingsPercent > 0
                    ? t("onboarding.subscription.toggle_annual_savings", {
                        percent: maxAnnualSavingsPercent,
                      })
                    : t("onboarding.subscription.toggle_annual")}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.planCarousel}>
              {plansLoading ? (
                <View style={styles.skeletonContainer}>
                  {Array.from({ length: 2 }).map((_, index) => (
                    <View key={index} style={styles.skeletonCardWrapper}>
                      <SkeletonCard
                        width={planCardWidth}
                        height={skeletonCardHeight}
                      />
                    </View>
                  ))}
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.planList}
                >
                  {activePlans.map(renderPlanCard)}
                </ScrollView>
              )}
            </View>
          </>
        )}

        {selectedPlan && !isOnHighestPlan && (
          <View style={styles.selectedFeaturesWrapper}>
            <Card shadow="xl" style={styles.selectedFeaturesCard}>
              {previousPlanName ? (
                <Text style={styles.sectionHeading}>
                  {t("onboarding.subscription.features_title", {
                    plan: previousPlanName,
                  })}
                </Text>
              ) : (
                <Text style={styles.sectionHeading}>
                  {t("onboarding.subscription.premium_features")}
                </Text>
              )}
              {(() => {
                // Filter features to only show NEW features for this tier
                // minimum_tier is a number: 0=free, 1=starter, 2=pro, 3=elite
                // - Starter (tier 1): show all features
                // - Pro (tier 2): only show features with minimum_tier >= 2
                // - Elite (tier 3): only show features with minimum_tier >= 3
                const planId = selectedPlan.id.toLowerCase();
                const filteredFeatures = selectedPlan.features
                  .filter((feature: any) => {
                    const minTier =
                      typeof feature.minimum_tier === "number"
                        ? feature.minimum_tier
                        : 0;
                    if (planId === "starter" || planId === "free") {
                      return true; // Show all features for starter
                    }
                    if (planId === "pro") {
                      // Only show pro+ features (minimum_tier >= 2)
                      return minTier >= 2;
                    }
                    if (planId === "elite") {
                      // Only show elite-exclusive features (minimum_tier >= 3)
                      return minTier >= 3;
                    }
                    return true;
                  })
                  .sort((a: any, b: any) => {
                    const sortA =
                      typeof a.sort_order === "number" ? a.sort_order : 999;
                    const sortB =
                      typeof b.sort_order === "number" ? b.sort_order : 999;
                    return sortA - sortB;
                  });

                const displayedFeatures = showAllFeatures
                  ? filteredFeatures
                  : filteredFeatures.slice(0, 4);

                return (
                  <>
                    {displayedFeatures.map((feature: any, index: number) => {
                      let title = feature.feature_name;
                      const featureValue = feature.feature_value;

                      // If feature_value is a positive number, prepend it to the name
                      // e.g., "3 Challenges Limit" instead of just "Challenges Limit"
                      if (
                        typeof featureValue === "number" &&
                        featureValue > 0
                      ) {
                        title = `${featureValue} ${feature.feature_name}`;
                      }

                      return (
                        <View
                          key={feature.id || index}
                          style={styles.detailItem}
                        >
                          <View style={styles.detailIconWrapper}>
                            <Ionicons
                              name="checkmark-circle"
                              size={18}
                              color={brandColors.primary}
                            />
                          </View>
                          <View style={styles.detailCopy}>
                            <Text style={styles.detailTitle}>{title}</Text>
                            {feature.feature_description ? (
                              <Text style={styles.detailSubtitle}>
                                {feature.feature_description}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                    {filteredFeatures.length > 4 && (
                      <TouchableOpacity
                        onPress={() => setShowAllFeatures((prev) => !prev)}
                        style={styles.featuresToggle}
                      >
                        <Text style={styles.featuresToggleText}>
                          {showAllFeatures
                            ? t("onboarding.subscription.view_less")
                            : t("onboarding.subscription.view_all", {
                                count: filteredFeatures.length - 4,
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
              <TouchableOpacity
                style={styles.linkRow}
                onPress={handleManageSubscription}
              >
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
              <Text style={styles.linkText}>
                {t("onboarding.subscription.restore_purchase")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkRow}>
              <Text style={styles.linkText}>
                {t("onboarding.subscription.faq")}
              </Text>
            </TouchableOpacity>
            <LinkText
              url="https://fitnudge.app/terms-of-service"
              title={t("onboarding.subscription.terms")}
              style={[styles.linkText, styles.linkPadding]}
              underline={false}
            >
              {t("onboarding.subscription.terms")}
            </LinkText>
            <LinkText
              url="https://fitnudge.app/privacy-policy"
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
            <Text style={styles.disclaimerText}>
              {t("onboarding.subscription.legal_copy")}
            </Text>
          </Card>
        </View>
      </ScrollView>

      <View style={styles.ctaBar}>
        {isOnHighestPlan ? (
          <>
            <Button
              title={t("onboarding.subscription.manage_subscription")}
              onPress={handleManageSubscription}
              variant="secondary"
            />
            <View style={styles.offerPill}>
              <Text style={styles.offerText}>
                {t("onboarding.subscription.on_highest_plan_note")}
              </Text>
            </View>
          </>
        ) : (
          <>
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
          </>
        )}
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
      </View>
    </Modal>
  );
}

const makeSubscriptionScreenStyles = (tokens: any, colors: any, brand: any) => {
  return {
    modalContainer: {
      flex: 1,
      backgroundColor: colors.bg.canvas,
    },
    modalContent: {
      flex: 1,
      backgroundColor: colors.bg.canvas,
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
      elevation: 3,
    },
    container: {
      flex: 1,
      backgroundColor: colors.bg.canvas,
    },
    scrollView: {
      flexGrow: 1,
      flexShrink: 1,
    },
    scrollContent: {
      paddingBottom: toRN(tokens.spacing[6]),
    },
    hero: {
      alignItems: "center" as const,
      paddingHorizontal: toRN(tokens.spacing[6]),
      paddingTop: toRN(tokens.spacing[16]), // Space for close button
      paddingBottom: toRN(tokens.spacing[5]),
      backgroundColor: brand.primary + "12", // ~7% opacity - subtle
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
      elevation: 4,
    },
    heroTitle: {
      fontSize: toRN(tokens.typography.fontSize["2xl"]),
      fontWeight: tokens.typography.fontWeight.bold,
      fontFamily: fontFamily.groteskBold,
      color: colors.text.primary,
      marginBottom: toRN(tokens.spacing[1]),
      letterSpacing: -0.5,
      textAlign: "center" as const,
    },
    heroSubtitle: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.text.secondary,
      fontFamily: fontFamily.groteskRegular,
      textAlign: "center" as const,
      marginBottom: toRN(tokens.spacing[4]),
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
      elevation: 2,
    },
    trustBadge: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: toRN(tokens.spacing[1.5]),
    },
    trustBadgeDivider: {
      width: 1,
      height: 16,
      backgroundColor: colors.border.default,
      marginHorizontal: toRN(tokens.spacing[3]),
    },
    trustBadgeText: {
      fontSize: toRN(tokens.typography.fontSize.xs),
      color: colors.text.secondary,
      fontFamily: fontFamily.groteskMedium,
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
      elevation: 8,
    },
    toggleOption: {
      flex: 1,
      paddingVertical: toRN(tokens.spacing[3]),
      alignItems: "center" as const,
      borderRadius: toRN(tokens.borderRadius.md),
    },
    toggleOptionSelected: {
      backgroundColor: brand.primary,
      shadowColor: brand.primary,
      shadowOffset: { width: 0, height: toRN(tokens.spacing[1]) },
      shadowOpacity: 0.25,
      shadowRadius: toRN(tokens.spacing[2]),
    },
    toggleText: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      fontWeight: tokens.typography.fontWeight.medium,
      color: colors.text.secondary,
      fontFamily: fontFamily.groteskMedium,
    },
    toggleTextSelected: {
      color: brand.onPrimary,
    },
    planList: {
      paddingHorizontal: toRN(tokens.spacing[6]),
      paddingRight: toRN(tokens.spacing[5]),
      flexDirection: "row" as const,
      alignItems: "stretch" as const,
    },
    planCarousel: {
      marginBottom: toRN(tokens.spacing[6]),
    },
    planCardTouchable: {
      flexShrink: 0,
    },
    planCard: {
      backgroundColor: colors.bg.card,
      borderRadius: toRN(tokens.borderRadius.lg),
      padding: toRN(tokens.spacing[4]),
      borderWidth: toRN(tokens.spacing[0.5]),
      borderColor: "transparent",
      position: "relative" as const,
      width: toRN(tokens.spacing[64]) + toRN(tokens.spacing[1]), // 16.25rem = 260px
    },
    planCardSelected: {
      borderColor: brand.primary,
      backgroundColor: brand.primary + "1A", // ~10% opacity in hex
    },
    planCardSpacing: {
      marginRight: toRN(tokens.spacing[4]),
    },
    popularBadge: {
      backgroundColor: brand.primary + "33", // ~20% opacity in hex
      borderRadius: toRN(tokens.borderRadius.full),
      paddingHorizontal: toRN(tokens.spacing[2]),
      paddingVertical: toRN(tokens.spacing[0.5]),
    },
    popularText: {
      fontSize: toRN(tokens.typography.fontSize.xs),
      color: brand.primary,
      fontFamily: fontFamily.groteskBold,
    },
    planHeader: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      marginBottom: toRN(tokens.spacing[2]),
    },
    planName: {
      fontSize: toRN(tokens.typography.fontSize.xl),
      fontWeight: tokens.typography.fontWeight.bold,
      color: colors.text.primary,
      fontFamily: fontFamily.groteskBold,
    },
    planNameSelected: {
      color: brand.primary,
    },
    trialPillText: {
      fontSize: toRN(tokens.typography.fontSize.xs),
      fontWeight: tokens.typography.fontWeight.semibold,
      color: brand.primary,
      fontFamily: fontFamily.groteskSemiBold,
    },
    price: {
      fontSize: toRN(tokens.typography.fontSize.lg),
      fontWeight: tokens.typography.fontWeight.bold,
      color: colors.text.primary,
      fontFamily: fontFamily.groteskBold,
    },
    priceSelected: {
      color: brand.primary,
    },
    priceCompare: {
      fontSize: toRN(tokens.typography.fontSize.xs),
      color: colors.text.tertiary,
      marginTop: toRN(tokens.spacing[1]),
      fontFamily: fontFamily.groteskRegular,
    },
    priceContainer: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
    },
    selectedFeaturesWrapper: {
      marginTop: toRN(tokens.spacing[2]),
      paddingHorizontal: toRN(tokens.spacing[6]),
    },
    selectedFeaturesCard: {
      paddingVertical: toRN(tokens.spacing[5]),
      paddingHorizontal: toRN(tokens.spacing[5]),
    },
    sectionHeading: {
      fontSize: toRN(tokens.typography.fontSize.lg),
      fontWeight: tokens.typography.fontWeight.semibold,
      fontFamily: fontFamily.groteskSemiBold,
      color: colors.text.primary,
      marginBottom: toRN(tokens.spacing[3]),
    },
    detailItem: {
      flexDirection: "row" as const,
      alignItems: "flex-start" as const,
      marginBottom: toRN(tokens.spacing[3]),
    },
    detailIconWrapper: {
      width: toRN(tokens.spacing[5]),
      alignItems: "center" as const,
      paddingTop: toRN(tokens.spacing[0.5]),
    },
    detailCopy: {
      flex: 1,
      marginLeft: toRN(tokens.spacing[2]),
    },
    detailTitle: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.text.primary,
      fontFamily: fontFamily.groteskMedium,
    },
    detailSubtitle: {
      marginTop: toRN(tokens.spacing[1]),
      fontSize: toRN(tokens.typography.fontSize.xs),
      color: colors.text.secondary,
      fontFamily: fontFamily.groteskRegular,
      lineHeight: toRN(tokens.typography.fontSize.xs * 1.4),
    },
    lowerTierNote: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.text.secondary,
      fontFamily: fontFamily.groteskRegular,
      marginBottom: toRN(tokens.spacing[2]),
    },
    featuresToggle: {
      marginTop: toRN(tokens.spacing[2]),
      alignSelf: "flex-start" as const,
    },
    featuresToggleText: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: brand.primary,
      fontFamily: fontFamily.groteskMedium,
    },
    linksSectionWrapper: {
      marginTop: toRN(tokens.spacing[6]),
      paddingHorizontal: toRN(tokens.spacing[6]),
    },
    linksSection: {
      paddingHorizontal: toRN(tokens.spacing[5]),
      paddingVertical: toRN(tokens.spacing[4]),
      gap: toRN(tokens.spacing[1]),
    },
    linkRow: {
      paddingVertical: toRN(tokens.spacing[2]),
    },
    linkPadding: {
      paddingVertical: toRN(tokens.spacing[2]),
    },
    linkText: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.text.primary,
      fontFamily: fontFamily.groteskMedium,
    },
    disclaimerWrapper: {
      marginTop: toRN(tokens.spacing[6]),
      paddingHorizontal: toRN(tokens.spacing[6]),
    },
    disclaimerCard: {
      paddingHorizontal: toRN(tokens.spacing[5]),
      paddingVertical: toRN(tokens.spacing[4]),
    },
    disclaimerText: {
      fontSize: toRN(tokens.typography.fontSize.xs),
      color: colors.text.tertiary,
      fontFamily: fontFamily.groteskRegular,
      lineHeight: toRN(tokens.typography.fontSize.xs * 1.4),
    },
    skeletonContainer: {
      paddingHorizontal: toRN(tokens.spacing[6]),
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: toRN(tokens.spacing[4]),
    },
    skeletonCardWrapper: {
      marginBottom: toRN(tokens.spacing[4]),
    },
    ctaBar: {
      paddingHorizontal: toRN(tokens.spacing[6]),
      paddingTop: toRN(tokens.spacing[4]),
      paddingBottom: toRN(tokens.spacing[4]),
      backgroundColor: colors.bg.canvas,
      borderTopWidth: toRN(tokens.spacing[0.25]),
      borderTopColor: colors.border.default,
    },

    offerPill: {
      marginTop: toRN(tokens.spacing[3]),
      alignSelf: "center",
      backgroundColor: brand.primary + "1F", // ~12% opacity in hex
      borderRadius: toRN(tokens.borderRadius.full),
      paddingHorizontal: toRN(tokens.spacing[3]),
      paddingVertical: toRN(tokens.spacing[1.5]),
    },
    offerText: {
      fontSize: toRN(tokens.typography.fontSize.xs),
      color: brand.primary,
      fontFamily: fontFamily.groteskMedium,
    },
  };
};
