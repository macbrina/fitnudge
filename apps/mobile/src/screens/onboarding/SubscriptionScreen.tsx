import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
} from "react-native";
import { useTranslation } from "@/lib/i18n";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { useStyles } from "@/themes/makeStyles";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens } from "@/themes/tokens";
import { useTheme } from "@/themes";
import { usePostHog } from "@/hooks/usePostHog";
import { logger } from "@/services/logger";
import { router } from "expo-router";
import { MOBILE_ROUTES } from "@/lib/routes";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePricing } from "@/hooks/usePricing";
import {
  SkeletonCard,
  SkeletonButton,
  SkeletonText,
} from "@/components/ui/SkeletonBox";
import { storageUtil, STORAGE_KEYS } from "@/utils/storageUtil";

type BillingPeriod = "monthly" | "annual";

const EXIT_OFFER_KEY = "subscription_exit_offer_shown";

export default function SubscriptionScreen() {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("annual");
  const [selectedPlan, setSelectedPlan] = useState<string>("free");
  const [showExitOffer, setShowExitOffer] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const { t } = useTranslation();
  const styles = useStyles(makeSubscriptionScreenStyles);
  const insets = useSafeAreaInsets();
  const { colors, brand } = useTheme();
  const { capture } = usePostHog();
  const { plans, isLoading: plansLoading } = usePricing();

  const maxAnnualSavingsPercent = useMemo(() => {
    if (!plans || plans.length === 0) return 0;
    let maxPct = 0;
    for (const p of plans) {
      if (!p || p.id === "free") continue;
      const monthly = Number(p.monthly_price);
      const annual = Number(p.annual_price);
      if (monthly > 0 && annual > 0) {
        const monthlyTotal = monthly * 12;
        const pct = Math.max(
          0,
          Math.round(((monthlyTotal - annual) / monthlyTotal) * 100)
        );
        if (pct > maxPct) maxPct = pct;
      }
    }
    return maxPct;
  }, [plans]);

  useEffect(() => {
    // Track screen view
    capture("subscription_screen_shown", {
      billing_period: billingPeriod,
      source: "onboarding",
    });
  }, []);

  const handleBillingToggle = (period: BillingPeriod) => {
    setBillingPeriod(period);

    // Track billing period change
    capture("subscription_billing_period_changed", {
      billing_period: period,
      source: "onboarding",
    });
  };

  const handlePlanSelect = (planId: string) => {
    setSelectedPlan(planId);

    // Track plan selection
    capture("subscription_plan_selected", {
      plan: planId,
      billing_period: billingPeriod,
      source: "onboarding",
    });
  };

  const handleContinueWithFree = async () => {
    try {
      setIsProcessing(true);
      // Check if we should show exit offer
      const hasSeenOffer = await AsyncStorage.getItem(EXIT_OFFER_KEY);

      if (!hasSeenOffer) {
        setShowExitOffer(true);
        await AsyncStorage.setItem(EXIT_OFFER_KEY, "true");

        // Track exit offer shown
        capture("subscription_exit_offer_shown", {
          source: "onboarding",
        });
      } else {
        // Go directly to home
        await navigateToHome();
      }
    } catch (error) {
      logger.error("Error checking exit offer status", {
        error: error instanceof Error ? error.message : String(error),
      });
      await navigateToHome();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExitOfferAccept = async () => {
    setShowExitOffer(false);
    setIsProcessing(true);

    // Track acceptance
    capture("subscription_exit_offer_accepted", {
      source: "onboarding",
    });

    // For now, just navigate to home
    // In a real implementation, you'd show the plan picker
    try {
      await navigateToHome();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExitOfferDecline = async () => {
    setShowExitOffer(false);
    setIsProcessing(true);

    // Track decline
    capture("subscription_exit_offer_declined", {
      source: "onboarding",
    });

    try {
      await navigateToHome();
    } finally {
      setIsProcessing(false);
    }
  };

  const navigateToHome = async () => {
    // Track completion
    capture("onboarding_completed", {
      selected_plan: selectedPlan,
      billing_period: billingPeriod,
      source: "subscription_screen",
    });

    // Onboarding completed - tracked via PostHog above

    // Mark subscription step as seen
    await storageUtil.setItem(STORAGE_KEYS.HAS_SEEN_SUBSCRIPTION, true);

    // Navigate to home
    router.replace(MOBILE_ROUTES.MAIN.HOME);
  };

  const getPrice = (plan: any) => {
    return billingPeriod === "annual" ? plan.annual_price : plan.monthly_price;
  };

  const getSavings = (plan: any) => {
    if (billingPeriod === "annual" && plan.monthly_price > 0) {
      const monthlyTotal = plan.monthly_price * 12;
      const savings = monthlyTotal - plan.annual_price;
      return Math.round(savings);
    }
    return 0;
  };

  const renderPlanCard = (plan: any) => {
    const price = getPrice(plan);
    const savings = getSavings(plan);
    const isSelected = selectedPlan === plan.id;
    const isCurrent = plan.id === "free";

    return (
      <TouchableOpacity
        key={plan.id}
        onPress={() => handlePlanSelect(plan.id)}
        style={[
          styles.planCard,
          isSelected && styles.planCardSelected,
          plan.is_popular && styles.planCardPopular,
        ]}
      >
        {plan.is_popular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularText}>MOST POPULAR</Text>
          </View>
        )}

        <View style={styles.planHeader}>
          <Text
            style={[styles.planName, isSelected && styles.planNameSelected]}
          >
            {plan.name}
          </Text>
          {isCurrent && <Text style={styles.currentText}>(Current)</Text>}
        </View>

        <View style={styles.priceContainer}>
          <Text style={[styles.price, isSelected && styles.priceSelected]}>
            ${price}
            {billingPeriod === "annual" ? "/year" : "/month"}
          </Text>
          {savings > 0 && (
            <Text style={styles.savingsText}>Save ${savings} vs monthly</Text>
          )}
        </View>

        {plan.has_trial && (
          <View style={styles.trialBadge}>
            <Text style={styles.trialText}>
              ⭐ {plan.trial_days}-DAY FREE TRIAL ⭐
            </Text>
          </View>
        )}

        <View style={styles.featuresContainer}>
          {plan.features.map((feature: any, index: number) => (
            <View key={feature.id || index} style={styles.featureItem}>
              <Text style={styles.featureIcon}>✓</Text>
              <Text
                style={[
                  styles.featureText,
                  isSelected && styles.featureTextSelected,
                ]}
              >
                {feature.feature_name}
                {feature.feature_value && ` (${feature.feature_value})`}
              </Text>
            </View>
          ))}
        </View>

        {!isCurrent && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.selectButton,
                isSelected && styles.selectButtonSelected,
              ]}
              disabled={isProcessing}
            >
              <Text
                style={[
                  styles.selectButtonText,
                  isSelected && styles.selectButtonTextSelected,
                ]}
              >
                {plan.has_trial ? "Start Free Trial" : "Subscribe"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.title}>{t("onboarding.subscription.title")}</Text>
        <Text style={styles.subtitle}>
          {t("onboarding.subscription.subtitle")}
        </Text>
      </View>

      {/* Billing Toggle */}
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
            Monthly
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
              ? `Annual - Save up to ${maxAnnualSavingsPercent}%!`
              : "Annual"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Plans */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {plansLoading ? (
          <View style={styles.skeletonContainer}>
            {Array.from({ length: 4 }).map((_, index) => (
              <View
                key={index}
                style={{ marginBottom: toRN(tokens.spacing[4]) }}
              >
                <SkeletonCard width="100%" height={200} />
              </View>
            ))}
          </View>
        ) : (
          plans.map(renderPlanCard)
        )}
      </ScrollView>

      {/* Actions */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          onPress={handleContinueWithFree}
          style={styles.continueButton}
          disabled={isProcessing}
        >
          <Text style={styles.continueButtonText}>
            {t("onboarding.subscription.continue_free")}
          </Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          {t("onboarding.subscription.disclaimer")}
        </Text>
      </View>

      {/* Exit Offer Modal */}
      <Modal
        visible={showExitOffer}
        transparent
        animationType="fade"
        onRequestClose={handleExitOfferDecline}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {t("onboarding.subscription.exit_offer.title")}
            </Text>

            <Text style={styles.modalSubtitle}>
              {t("onboarding.subscription.exit_offer.subtitle")}
            </Text>

            <View style={styles.modalPlans}>
              {plansLoading ? (
                <SkeletonText width={220} height={16} />
              ) : (
                plans
                  .filter(
                    (p: any) =>
                      p.id !== "free" &&
                      (p.exit_offer_enabled === true ||
                        p.exit_offer_enabled === 1) &&
                      p.exit_offer_annual_price != null
                  )
                  .map((p: any) => {
                    const trialSuffix =
                      p.has_trial && p.trial_days
                        ? ` + ${p.trial_days}-day trial`
                        : "";
                    return (
                      <Text key={p.id} style={styles.modalPlanText}>
                        {`• ${p.name}: $${Number(p.exit_offer_annual_price).toFixed(2)}/year (was $${Number(p.annual_price).toFixed(2)})${trialSuffix}`}
                      </Text>
                    );
                  })
              )}
            </View>

            <Text style={styles.modalDisclaimer}>
              {t("onboarding.subscription.exit_offer.disclaimer")}
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={handleExitOfferAccept}
                style={styles.modalAcceptButton}
              >
                <Text style={styles.modalAcceptButtonText}>
                  {t("onboarding.subscription.exit_offer.select_plan")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleExitOfferDecline}
                style={styles.modalDeclineButton}
              >
                <Text style={styles.modalDeclineButtonText}>
                  {t("onboarding.subscription.exit_offer.continue_free")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeSubscriptionScreenStyles = (tokens: any, colors: any, brand: any) => {
  return {
    container: {
      flex: 1,
      backgroundColor: colors.bg.canvas,
    },
    header: {
      paddingHorizontal: toRN(tokens.spacing[6]),
      paddingBottom: toRN(tokens.spacing[6]),
    },
    title: {
      fontSize: toRN(tokens.typography.fontSize["2xl"]),
      fontWeight: tokens.typography.fontWeight.bold,
      color: colors.text.primary,
      textAlign: "center" as const,
      marginBottom: toRN(tokens.spacing[3]),
      fontFamily: fontFamily.groteskBold,
    },
    subtitle: {
      fontSize: toRN(tokens.typography.fontSize.base),
      color: colors.text.secondary,
      textAlign: "center" as const,
      fontFamily: fontFamily.groteskRegular,
    },
    billingToggle: {
      flexDirection: "row" as const,
      backgroundColor: colors.bg.surface,
      borderRadius: toRN(tokens.borderRadius.lg),
      marginHorizontal: toRN(tokens.spacing[6]),
      marginBottom: toRN(tokens.spacing[6]),
      padding: 4,
    },
    toggleOption: {
      flex: 1,
      paddingVertical: toRN(tokens.spacing[3]),
      alignItems: "center" as const,
      borderRadius: toRN(tokens.borderRadius.md),
    },
    toggleOptionSelected: {
      backgroundColor: brand.primary,
    },
    toggleText: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      fontWeight: tokens.typography.fontWeight.medium,
      color: colors.text.secondary,
      fontFamily: fontFamily.groteskMedium,
    },
    toggleTextSelected: {
      color: colors.text.inverse,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: toRN(tokens.spacing[6]),
      paddingBottom: toRN(tokens.spacing[6]),
    },
    planCard: {
      backgroundColor: colors.bg.surface,
      borderRadius: toRN(tokens.borderRadius.lg),
      padding: toRN(tokens.spacing[6]),
      marginBottom: toRN(tokens.spacing[4]),
      borderWidth: 2,
      borderColor: "transparent",
      position: "relative" as const,
    },
    planCardSelected: {
      borderColor: brand.primary,
      backgroundColor: brand.primary + "10",
    },
    planCardPopular: {
      borderColor: brand.primary,
    },
    popularBadge: {
      position: "absolute" as const,
      top: -8,
      left: "50%",
      transform: [{ translateX: -50 }],
      backgroundColor: brand.primary,
      borderRadius: toRN(tokens.borderRadius.sm),
      paddingHorizontal: toRN(tokens.spacing[3]),
      paddingVertical: toRN(tokens.spacing[1]),
    },
    popularText: {
      fontSize: toRN(tokens.typography.fontSize.xs),
      fontWeight: tokens.typography.fontWeight.bold,
      color: colors.text.inverse,
      fontFamily: fontFamily.groteskBold,
    },
    planHeader: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      marginBottom: toRN(tokens.spacing[3]),
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
    currentText: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.text.secondary,
      fontFamily: fontFamily.groteskRegular,
    },
    priceContainer: {
      marginBottom: toRN(tokens.spacing[3]),
    },
    price: {
      fontSize: toRN(tokens.typography.fontSize["2xl"]),
      fontWeight: tokens.typography.fontWeight.bold,
      color: colors.text.primary,
      fontFamily: fontFamily.groteskBold,
    },
    priceSelected: {
      color: brand.primary,
    },
    savingsText: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: brand.primary,
      fontFamily: fontFamily.groteskMedium,
    },
    trialBadge: {
      backgroundColor: brand.primary + "20",
      borderRadius: toRN(tokens.borderRadius.md),
      padding: toRN(tokens.spacing[2]),
      marginBottom: toRN(tokens.spacing[4]),
      alignItems: "center" as const,
    },
    trialText: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      fontWeight: tokens.typography.fontWeight.bold,
      color: brand.primary,
      fontFamily: fontFamily.groteskBold,
    },
    featuresContainer: {
      marginBottom: toRN(tokens.spacing[4]),
    },
    featureItem: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      marginBottom: toRN(tokens.spacing[2]),
    },
    featureIcon: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: brand.primary,
      marginRight: toRN(tokens.spacing[2]),
      fontWeight: tokens.typography.fontWeight.bold,
    },
    featureText: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.text.primary,
      flex: 1,
      fontFamily: fontFamily.groteskRegular,
    },
    featureTextSelected: {
      color: brand.primary,
    },
    buttonContainer: {
      alignItems: "center" as const,
    },
    selectButton: {
      backgroundColor: colors.bg.surface,
      borderRadius: toRN(tokens.borderRadius.lg),
      paddingVertical: toRN(tokens.spacing[3]),
      paddingHorizontal: toRN(tokens.spacing[6]),
      borderWidth: 2,
      borderColor: brand.primary,
    },
    selectButtonSelected: {
      backgroundColor: brand.primary,
    },
    selectButtonText: {
      fontSize: toRN(tokens.typography.fontSize.base),
      fontWeight: tokens.typography.fontWeight.semibold,
      color: brand.primary,
      fontFamily: fontFamily.groteskSemiBold,
    },
    selectButtonTextSelected: {
      color: colors.text.inverse,
    },
    actions: {
      paddingHorizontal: toRN(tokens.spacing[6]),
    },
    continueButton: {
      alignItems: "center" as const,
      marginBottom: toRN(tokens.spacing[4]),
    },
    continueButtonText: {
      fontSize: toRN(tokens.typography.fontSize.base),
      color: colors.text.secondary,
      fontFamily: fontFamily.groteskMedium,
    },
    disclaimer: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.text.tertiary,
      textAlign: "center" as const,
      fontFamily: fontFamily.groteskRegular,
    },
    loadingContainer: {
      flex: 1,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingVertical: toRN(tokens.spacing[12]),
    },
    loadingText: {
      fontSize: toRN(tokens.typography.fontSize.base),
      color: colors.text.secondary,
      fontFamily: fontFamily.groteskRegular,
    },
    skeletonContainer: {
      paddingHorizontal: toRN(tokens.spacing[6]),
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingHorizontal: toRN(tokens.spacing[6]),
    },
    modalContent: {
      backgroundColor: colors.bg.surface,
      borderRadius: toRN(tokens.borderRadius.xl),
      padding: toRN(tokens.spacing[6]),
      width: "100%",
      maxWidth: 400,
    },
    modalTitle: {
      fontSize: toRN(tokens.typography.fontSize.xl),
      fontWeight: tokens.typography.fontWeight.bold,
      color: colors.text.primary,
      textAlign: "center" as const,
      marginBottom: toRN(tokens.spacing[3]),
      fontFamily: fontFamily.groteskBold,
    },
    modalSubtitle: {
      fontSize: toRN(tokens.typography.fontSize.base),
      color: colors.text.secondary,
      textAlign: "center" as const,
      marginBottom: toRN(tokens.spacing[4]),
      fontFamily: fontFamily.groteskRegular,
    },
    modalPlans: {
      marginBottom: toRN(tokens.spacing[4]),
    },
    modalPlanText: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.text.primary,
      marginBottom: toRN(tokens.spacing[1]),
      fontFamily: fontFamily.groteskRegular,
    },
    modalDisclaimer: {
      fontSize: toRN(tokens.typography.fontSize.xs),
      color: colors.text.tertiary,
      textAlign: "center" as const,
      marginBottom: toRN(tokens.spacing[6]),
      fontFamily: fontFamily.groteskRegular,
    },
    modalActions: {
      gap: toRN(tokens.spacing[3]),
    },
    modalAcceptButton: {
      backgroundColor: brand.primary,
      borderRadius: toRN(tokens.borderRadius.lg),
      paddingVertical: toRN(tokens.spacing[4]),
      alignItems: "center" as const,
    },
    modalAcceptButtonText: {
      fontSize: toRN(tokens.typography.fontSize.base),
      fontWeight: tokens.typography.fontWeight.semibold,
      color: colors.text.inverse,
      fontFamily: fontFamily.groteskSemiBold,
    },
    modalDeclineButton: {
      alignItems: "center" as const,
      paddingVertical: toRN(tokens.spacing[2]),
    },
    modalDeclineButtonText: {
      fontSize: toRN(tokens.typography.fontSize.base),
      color: colors.text.secondary,
      fontFamily: fontFamily.groteskMedium,
    },
  };
};
