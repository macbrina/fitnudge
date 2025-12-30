/**
 * UpgradePrompt Component
 *
 * A modal that prompts users to upgrade when they try to access
 * premium features or hit limits (like goal count).
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from "react-native";
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Rect,
} from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@/lib/i18n";
import { useTheme } from "@/themes";
import { toRN } from "@/lib/units";
import { tokens } from "@/themes/tokens";
import { fontFamily } from "@/lib/fonts";

// Circular Gradient Background for icon
interface CircleGradientProps {
  colors: string[];
  size: number;
  children?: React.ReactNode;
}

function CircleGradient({ colors, size, children }: CircleGradientProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient
            id="circleGrad"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <Stop offset="0%" stopColor={colors[0]} />
            <Stop offset="100%" stopColor={colors[1] || colors[0]} />
          </SvgLinearGradient>
        </Defs>
        <Rect
          x="0"
          y="0"
          width={size}
          height={size}
          fill="url(#circleGrad)"
          rx={size / 2}
          ry={size / 2}
        />
      </Svg>
      {children}
    </View>
  );
}

export type UpgradePromptType = "goal_limit" | "feature_locked" | "generic";

interface UpgradePromptProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when user wants to close the modal */
  onClose: () => void;
  /** Called when user taps upgrade */
  onUpgrade: () => void;
  /** Type of prompt to show */
  type?: UpgradePromptType;
  /** For feature_locked type: name of the locked feature */
  featureName?: string;
  /** Custom title override */
  title?: string;
  /** Custom subtitle override */
  subtitle?: string;
}

const BENEFITS = [
  { icon: "infinite-outline" as const, text: "Unlimited active goals" },
  { icon: "sparkles" as const, text: "AI-powered coaching" },
  { icon: "analytics-outline" as const, text: "Advanced analytics" },
  { icon: "trophy-outline" as const, text: "Weekly progress recaps" },
];

export function UpgradePrompt({
  visible,
  onClose,
  onUpgrade,
  type = "generic",
  featureName,
  title: customTitle,
  subtitle: customSubtitle,
}: UpgradePromptProps) {
  const { t } = useTranslation();
  const { brandColors, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get("window").height;

  // Animation values
  const opacity = useMemo(() => new Animated.Value(0), []);
  const translateY = useMemo(() => new Animated.Value(screenHeight), []);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 20,
          mass: 0.8,
          stiffness: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: screenHeight,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, opacity, translateY, screenHeight]);

  // Determine title and subtitle based on type
  const getContent = () => {
    if (customTitle && customSubtitle) {
      return { title: customTitle, subtitle: customSubtitle };
    }

    switch (type) {
      case "goal_limit":
        return {
          title: t("onboarding.subscription.upgrade_prompt.goal_limit_title"),
          subtitle: t(
            "onboarding.subscription.upgrade_prompt.goal_limit_subtitle",
          ),
        };
      case "feature_locked":
        return {
          title: t(
            "onboarding.subscription.upgrade_prompt.feature_locked_title",
          ),
          subtitle: t(
            "onboarding.subscription.upgrade_prompt.feature_locked_subtitle",
            { feature: featureName || "this feature" },
          ),
        };
      default:
        return {
          title: t("onboarding.subscription.upgrade_prompt.title"),
          subtitle: t("onboarding.subscription.upgrade_prompt.subtitle"),
        };
    }
  };

  const { title, subtitle } = getContent();

  return (
    <Modal
      transparent
      statusBarTranslucent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(0,0,0,0.5)", opacity },
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={onClose}
          />
        </Animated.View>

        {/* Modal Content */}
        <Animated.View
          style={[
            styles.modalContainer,
            {
              paddingBottom: insets.bottom + toRN(tokens.spacing[4]),
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Close button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={24} color={colors.text.secondary} />
          </TouchableOpacity>

          {/* Icon */}
          <View style={styles.iconContainer}>
            <CircleGradient
              colors={[brandColors.primary, brandColors.primaryHover]}
              size={toRN(tokens.spacing[16])}
            >
              <Ionicons
                name={type === "goal_limit" ? "add-circle" : "lock-closed"}
                size={32}
                color="white"
              />
            </CircleGradient>
          </View>

          {/* Title & Subtitle */}
          <Text style={[styles.title, { color: colors.text.primary }]}>
            {title}
          </Text>
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
            {subtitle}
          </Text>

          {/* Benefits list */}
          <View style={styles.benefitsList}>
            {BENEFITS.map((benefit, index) => (
              <View key={index} style={styles.benefitItem}>
                <View
                  style={[
                    styles.benefitIcon,
                    { backgroundColor: brandColors.primary + "20" },
                  ]}
                >
                  <Ionicons
                    name={benefit.icon}
                    size={18}
                    color={brandColors.primary}
                  />
                </View>
                <Text
                  style={[styles.benefitText, { color: colors.text.primary }]}
                >
                  {benefit.text}
                </Text>
              </View>
            ))}
          </View>

          {/* CTA Buttons */}
          <TouchableOpacity
            style={[
              styles.upgradeButton,
              { backgroundColor: brandColors.primary },
            ]}
            onPress={onUpgrade}
            activeOpacity={0.8}
          >
            <Text style={styles.upgradeButtonText}>
              {t("onboarding.subscription.upgrade_prompt.upgrade_cta")}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={20}
              color="white"
              style={styles.upgradeIcon}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.laterButton} onPress={onClose}>
            <Text style={[styles.laterText, { color: colors.text.secondary }]}>
              {t("onboarding.subscription.upgrade_prompt.continue_free")}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "white",
    borderTopLeftRadius: toRN(tokens.borderRadius["2xl"]),
    borderTopRightRadius: toRN(tokens.borderRadius["2xl"]),
    paddingHorizontal: toRN(tokens.spacing[6]),
    paddingTop: toRN(tokens.spacing[6]),
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: toRN(tokens.spacing[4]),
    right: toRN(tokens.spacing[4]),
    zIndex: 1,
    padding: toRN(tokens.spacing[1]),
  },
  iconContainer: {
    marginBottom: toRN(tokens.spacing[4]),
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontWeight: "700",
    fontFamily: fontFamily.groteskBold,
    textAlign: "center",
    marginBottom: toRN(tokens.spacing[2]),
  },
  subtitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    textAlign: "center",
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5,
    marginBottom: toRN(tokens.spacing[5]),
    paddingHorizontal: toRN(tokens.spacing[4]),
  },
  benefitsList: {
    width: "100%",
    marginBottom: toRN(tokens.spacing[5]),
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: toRN(tokens.spacing[3]),
  },
  benefitIcon: {
    width: toRN(tokens.spacing[8]),
    height: toRN(tokens.spacing[8]),
    borderRadius: toRN(tokens.borderRadius.lg),
    justifyContent: "center",
    alignItems: "center",
    marginRight: toRN(tokens.spacing[3]),
  },
  benefitText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskMedium,
    flex: 1,
  },
  upgradeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingVertical: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.xl),
    marginBottom: toRN(tokens.spacing[3]),
  },
  upgradeButtonText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontWeight: "600",
    fontFamily: fontFamily.groteskSemiBold,
    color: "white",
  },
  upgradeIcon: {
    marginLeft: toRN(tokens.spacing[2]),
  },
  laterButton: {
    paddingVertical: toRN(tokens.spacing[3]),
  },
  laterText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskMedium,
  },
});

export default UpgradePrompt;
