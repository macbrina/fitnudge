/**
 * ExitIntentModal Component
 *
 * Apple-style exit offer modal shown when users try to close the subscription screen.
 * Shows a limited-time discount offer with a clean, focused design and countdown timer.
 *
 * Strategy: PRO PLAN ONLY
 * - Pro has AI Chat Motivation (the killer feature that creates stickiness)
 * - One clear choice = higher conversion vs multiple options
 * - Users who experience AI coaching are more likely to renew
 * - Discount percentage is calculated dynamically from database prices
 *
 * Offer visibility:
 * - Once per 7 days
 * - Maximum 5 times total (~5 weeks)
 * - Only for users who have NEVER subscribed
 */

import React, { useEffect, useState, useCallback } from "react";
import { View, Text, Modal, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@/lib/i18n";
import { useTheme } from "@/themes";
import { useStyles } from "@/themes";
import { toRN } from "@/lib/units";
import { tokens } from "@/themes/tokens";
import { fontFamily } from "@/lib/fonts";
import Button from "@/components/ui/Button";

interface Plan {
  id: string;
  name: string;
  monthly_price: number;
  annual_price: number;
  has_trial?: boolean;
  trial_days?: number;
  // Exit offer pricing from database
  exit_offer_enabled?: boolean;
  exit_offer_monthly_price?: number | null;
  exit_offer_annual_price?: number | null;
}

export interface ExitIntentModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when user wants to close and continue free */
  onContinueFree: () => void;
  /** Called when user selects a discounted plan */
  onSelectPlan: (planId: string, billingPeriod: "monthly" | "annual") => void;
  /** Available plans to show with discounts */
  plans: Plan[];
  /** Expiry time for the countdown (optional) */
  expiryTime?: Date | null;
}

// Format time remaining as MM:SS
const formatTimeRemaining = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

export function ExitIntentModal({
  visible,
  onContinueFree,
  onSelectPlan,
  plans,
  expiryTime
}: ExitIntentModalProps) {
  const { t } = useTranslation();
  const { brandColors, colors } = useTheme();
  const styles = useStyles(makeExitIntentModalStyles);
  const insets = useSafeAreaInsets();

  // Countdown timer state
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Calculate and update time remaining
  useEffect(() => {
    if (!expiryTime || !visible) {
      setTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiryTime.getTime() - now) / 1000));
      setTimeRemaining(remaining);

      // Auto-close when expired
      if (remaining <= 0) {
        onContinueFree();
      }
    };

    // Update immediately
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [expiryTime, visible, onContinueFree]);

  // Get exit offer price from database, or calculate discount if not set
  const getExitOfferPrice = (plan: Plan): number => {
    if (plan.exit_offer_annual_price != null) {
      return plan.exit_offer_annual_price;
    }
    // Fallback: calculate 50% off annual price
    return plan.annual_price * 0.5;
  };

  // Calculate discount percentage dynamically from database prices
  const getDiscountPercent = (original: number, discounted: number): number => {
    if (original <= 0) return 0;
    return Math.round(((original - discounted) / original) * 100);
  };

  // PREMIUM-ONLY STRATEGY (2-tier system)
  // - One clear choice = higher conversion
  // - Users who experience premium features are more likely to renew
  const premiumPlan = plans.find((p) => p.id === "premium" && (p.exit_offer_enabled ?? true));

  // Only show modal if Premium plan exists and has exit offer enabled
  if (!premiumPlan) {
    return null;
  }

  const bestPlan = premiumPlan;

  const originalPrice = bestPlan.annual_price;
  const discountedPrice = getExitOfferPrice(bestPlan);
  const discountPercent = getDiscountPercent(originalPrice, discountedPrice);
  const monthlyEquivalent = discountedPrice / 12;
  const savings = originalPrice - discountedPrice;

  return (
    <Modal
      transparent
      statusBarTranslucent
      visible={visible}
      animationType="fade"
      onRequestClose={onContinueFree}
    >
      <View style={styles.overlay}>
        {/* Backdrop */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onContinueFree} />

        {/* Modal Content - Apple-style centered card */}
        <View
          style={[
            styles.modalContainer,
            { paddingBottom: Math.max(insets.bottom, toRN(tokens.spacing[6])) }
          ]}
        >
          {/* Close button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onContinueFree}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={24} color={colors.text.tertiary} />
          </TouchableOpacity>

          {/* Discount Badge */}
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{discountPercent}% OFF</Text>
          </View>

          {/* Emoji/Icon */}
          <View style={styles.iconContainer}>
            <Text style={styles.emoji}>🎁</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>{t("onboarding.subscription.exit_offer.title")}</Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>{t("onboarding.subscription.exit_offer.subtitle")}</Text>

          {/* Price Card - Featured Offer */}
          <View style={[styles.offerCard, { borderColor: brandColors.primary }]}>
            {/* Plan Name & Badge */}
            <View style={styles.offerHeader}>
              <Text style={styles.planName}>{bestPlan.name}</Text>
              <View style={[styles.bestValueBadge, { backgroundColor: brandColors.primary }]}>
                <Text style={styles.bestValueText}>BEST VALUE</Text>
              </View>
            </View>

            {/* Price Display */}
            <View style={styles.priceContainer}>
              <Text style={styles.originalPrice}>${originalPrice.toFixed(2)}</Text>
              <Text style={[styles.discountedPrice, { color: brandColors.primary }]}>
                ${discountedPrice.toFixed(2)}
              </Text>
              <Text style={styles.perYear}>/year</Text>
            </View>

            {/* Monthly breakdown */}
            <Text style={styles.monthlyBreakdown}>
              Just ${monthlyEquivalent.toFixed(2)}/month • Save ${savings.toFixed(0)}
            </Text>

            {/* Features preview - AI Chat is the key hook */}
            <View style={styles.featuresPreview}>
              <View style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={18} color={brandColors.primary} />
                <Text style={[styles.featureText, styles.featureHighlight]}>
                  AI Chat Motivation
                </Text>
              </View>
              <View style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={18} color={brandColors.primary} />
                <Text style={styles.featureText}>Unlimited goals</Text>
              </View>
              <View style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={18} color={brandColors.primary} />
                <Text style={styles.featureText}>Advanced analytics</Text>
              </View>
            </View>
          </View>

          {/* CTA Button */}
          <View style={styles.ctaContainer}>
            <Button
              title={t("onboarding.subscription.exit_offer.claim_offer")}
              onPress={() => onSelectPlan(bestPlan.id, "annual")}
            />
          </View>

          {/* Countdown Timer */}
          {timeRemaining !== null && timeRemaining > 0 && (
            <View style={[styles.countdownContainer, { backgroundColor: colors.bg.warning }]}>
              <Ionicons name="alarm-outline" size={18} color={colors.text.onWarning} />
              <Text style={[styles.countdownText, { color: colors.text.onWarning }]}>
                Offer expires in {formatTimeRemaining(timeRemaining)}
              </Text>
            </View>
          )}

          {/* No thanks link */}
          <TouchableOpacity style={styles.noThanksButton} onPress={onContinueFree}>
            <Text style={styles.noThanksText}>
              {t("onboarding.subscription.exit_offer.continue_free")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const makeExitIntentModalStyles = (tokens: any, colors: any, brand: any) => ({
  overlay: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  backdrop: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg.overlay
  },
  modalContainer: {
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius["2xl"]),
    paddingHorizontal: toRN(tokens.spacing[6]),
    paddingTop: toRN(tokens.spacing[6]),
    marginHorizontal: toRN(tokens.spacing[4]),
    width: "100%",
    maxWidth: 380,
    alignItems: "center" as const,
    shadowColor: colors.shadow.xl,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 20
  },
  closeButton: {
    position: "absolute" as const,
    top: toRN(tokens.spacing[4]),
    right: toRN(tokens.spacing[4]),
    width: toRN(tokens.spacing[8]),
    height: toRN(tokens.spacing[8]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: colors.bg.muted,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  discountBadge: {
    position: "absolute" as const,
    top: -toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.success,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[1.5]),
    borderRadius: toRN(tokens.borderRadius.full)
  },
  discountText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontWeight: "700" as const,
    fontFamily: fontFamily.groteskBold,
    color: colors.text.onSuccess,
    letterSpacing: 0.5
  },
  iconContainer: {
    marginTop: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[3])
  },
  emoji: {
    fontSize: 48
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontWeight: "700" as const,
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[2])
  },
  subtitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    lineHeight: toRN(tokens.typography.fontSize.base) * 1.5,
    marginBottom: toRN(tokens.spacing[5]),
    paddingHorizontal: toRN(tokens.spacing[2])
  },
  offerCard: {
    width: "100%",
    padding: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.xl),
    borderWidth: 2,
    backgroundColor: colors.bg.surface,
    marginBottom: toRN(tokens.spacing[4])
  },
  offerHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[3])
  },
  planName: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontWeight: "600" as const,
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary
  },
  bestValueBadge: {
    paddingHorizontal: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[0.5]),
    borderRadius: toRN(tokens.borderRadius.md)
  },
  bestValueText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontWeight: "700" as const,
    fontFamily: fontFamily.groteskBold,
    color: colors.text.onPrimary,
    letterSpacing: 0.5
  },
  priceContainer: {
    flexDirection: "row" as const,
    alignItems: "baseline" as const,
    marginBottom: toRN(tokens.spacing[1])
  },
  originalPrice: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.tertiary,
    textDecorationLine: "line-through" as const,
    marginRight: toRN(tokens.spacing[2])
  },
  discountedPrice: {
    fontSize: toRN(tokens.typography.fontSize["3xl"]),
    fontWeight: "700" as const,
    fontFamily: fontFamily.groteskBold
  },
  perYear: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.secondary,
    marginLeft: toRN(tokens.spacing[0.5])
  },
  monthlyBreakdown: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.secondary,
    marginBottom: toRN(tokens.spacing[3])
  },
  featuresPreview: {
    gap: toRN(tokens.spacing[2])
  },
  featureRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2])
  },
  featureText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.primary
  },
  featureHighlight: {
    fontFamily: fontFamily.groteskSemiBold,
    fontWeight: "600" as const
  },
  ctaContainer: {
    width: "100%",
    marginBottom: toRN(tokens.spacing[3])
  },
  countdownContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[2.5]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.lg),
    marginBottom: toRN(tokens.spacing[3]),
    width: "100%"
  },
  countdownText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontWeight: "600" as const,
    fontFamily: fontFamily.groteskSemiBold
  },
  noThanksButton: {
    paddingVertical: toRN(tokens.spacing[2])
  },
  noThanksText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.tertiary
  }
});

export default ExitIntentModal;
