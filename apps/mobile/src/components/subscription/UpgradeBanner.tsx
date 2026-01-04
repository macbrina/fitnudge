/**
 * UpgradeBanner Component
 *
 * A dismissible banner that encourages free users to upgrade.
 * Shows on key screens like Home, Goals list.
 * Can be dismissed for the session.
 */

import React, { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/lib/i18n";
import { useStyles, useTheme } from "@/themes";
import { toRN } from "@/lib/units";
import { tokens } from "@/themes/tokens";
import { fontFamily } from "@/lib/fonts";
import { useSubscriptionStore } from "@/stores/subscriptionStore";

// Gradient Background component using react-native-svg
interface GradientBackgroundProps {
  colors: string[];
  style?: any;
  children?: React.ReactNode;
}

function GradientBackground({ colors, style, children }: GradientBackgroundProps) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  return (
    <View
      style={style}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setDimensions({ width, height });
      }}
    >
      {dimensions.width > 0 && dimensions.height > 0 && (
        <Svg width={dimensions.width} height={dimensions.height} style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgLinearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={colors[0]} />
              <Stop offset="100%" stopColor={colors[1] || colors[0]} />
            </SvgLinearGradient>
          </Defs>
          <Rect
            x="0"
            y="0"
            width={dimensions.width}
            height={dimensions.height}
            fill="url(#grad)"
            rx={toRN(tokens.borderRadius.xl)}
            ry={toRN(tokens.borderRadius.xl)}
          />
        </Svg>
      )}
      {children}
    </View>
  );
}

interface UpgradeBannerProps {
  /** Called when user taps the upgrade button */
  onUpgrade: () => void;
  /** Optional: Make the banner compact (less padding) */
  compact?: boolean;
  /** Optional: Custom style */
  style?: any;
}

export function UpgradeBanner({ onUpgrade, compact = false, style }: UpgradeBannerProps) {
  const { t } = useTranslation();
  const { brandColors, colors } = useTheme();
  const styles = useStyles(bannerStyles);
  const [isDismissed, setIsDismissed] = useState(false);
  const fadeAnim = useState(new Animated.Value(1))[0];

  const { getPlan } = useSubscriptionStore();
  const plan = getPlan();

  // Define all hooks BEFORE any early returns (React rules of hooks)
  const handleDismiss = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true
    }).start(() => {
      setIsDismissed(true);
    });
  }, [fadeAnim]);

  // Don't show for paid users
  if (plan !== "free" || isDismissed) {
    return null;
  }

  return (
    <Animated.View style={[{ opacity: fadeAnim }, style]}>
      <GradientBackground
        colors={[brandColors.primary, brandColors.primaryHover]}
        style={[styles.container, compact && styles.containerCompact]}
      >
        {/* Dismiss button */}
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={handleDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={18} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>

        {/* Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="sparkles" size={24} color="white" />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title}>{t("onboarding.subscription.upgrade_banner.title")}</Text>
          <Text style={styles.subtitle}>
            {t("onboarding.subscription.upgrade_banner.subtitle")}
          </Text>
        </View>

        {/* CTA Button */}
        <TouchableOpacity style={styles.ctaButton} onPress={onUpgrade} activeOpacity={0.8}>
          <Text style={styles.ctaText}>{t("onboarding.subscription.upgrade_banner.cta")}</Text>
          <Ionicons
            name="arrow-forward"
            size={16}
            color={brandColors.primary}
            style={styles.ctaIcon}
          />
        </TouchableOpacity>
      </GradientBackground>
    </Animated.View>
  );
}

const bannerStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: toRN(tokens.spacing[4]),
    paddingTop: toRN(tokens.spacing[5]), // Extra top padding for dismiss button
    borderRadius: toRN(tokens.borderRadius.xl),
    marginHorizontal: toRN(tokens.spacing[4]),
    marginVertical: toRN(tokens.spacing[2]),
    position: "relative"
  },
  containerCompact: {
    padding: toRN(tokens.spacing[3]),
    paddingTop: toRN(tokens.spacing[4])
  },
  dismissButton: {
    position: "absolute",
    top: toRN(tokens.spacing[1]),
    right: toRN(tokens.spacing[1]),
    zIndex: 1,
    padding: toRN(tokens.spacing[1]),
    backgroundColor: "rgba(0,0,0,0.15)",
    borderRadius: toRN(tokens.borderRadius.full)
  },
  iconContainer: {
    width: toRN(tokens.spacing[10]),
    height: toRN(tokens.spacing[10]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: toRN(tokens.spacing[3])
  },
  content: {
    flex: 1,
    paddingRight: toRN(tokens.spacing[2])
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontWeight: "700",
    fontFamily: fontFamily.groteskBold,
    color: "white",
    marginBottom: toRN(tokens.spacing[1])
  },
  subtitle: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskRegular,
    color: "rgba(255,255,255,0.9)",
    lineHeight: toRN(tokens.typography.fontSize.xs) * 1.4
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.lg),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3
  },
  ctaText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontWeight: "600",
    fontFamily: fontFamily.semiBold,
    color: brand.primary
  },
  ctaIcon: {
    marginLeft: toRN(tokens.spacing[1])
  }
});

export default UpgradeBanner;
