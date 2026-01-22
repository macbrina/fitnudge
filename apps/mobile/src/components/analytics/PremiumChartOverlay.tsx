/**
 * Premium Chart Overlay Component
 *
 * Displays a blur overlay with a crown icon and message
 * Used to preview premium chart features for free users
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { Crown } from "lucide-react-native";

interface PremiumChartOverlayProps {
  /** The chart content to show behind the blur */
  children: React.ReactNode;
  /** Optional custom unlock message */
  message?: string;
  /** Whether to show the overlay (false = premium user, show chart) */
  showOverlay?: boolean;
}

export function PremiumChartOverlay({
  children,
  message,
  showOverlay = true
}: PremiumChartOverlayProps) {
  const { colors, brandColors, isDark } = useTheme();
  const { t } = useTranslation();

  if (!showOverlay) {
    // Premium user - show chart directly
    return <>{children}</>;
  }

  return (
    <View style={styles.container}>
      {/* Chart content (blurred for free users) */}
      <View style={styles.chartContainer}>{children}</View>

      {/* Blur overlay - crown icon and message only */}
      <BlurView intensity={1} tint={isDark ? "dark" : "light"} style={styles.blurOverlay}>
        <View style={styles.lockContainer}>
          <Crown size={22} color={colors.feedback.warning} />
          <Text style={[styles.lockMessage, { color: colors.text.primary }]}>
            {message || t("analytics.unlock_charts") || "Unlock detailed analytics and insights"}
          </Text>
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    overflow: "hidden",
    borderRadius: toRN(tokens.borderRadius.lg)
  },
  chartContainer: {
    opacity: 0.4 // Dim the chart behind blur
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center"
  },
  lockContainer: {
    alignItems: "center",
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[3])
  },
  crownIcon: {
    marginBottom: toRN(tokens.spacing[2])
  },
  lockMessage: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    textAlign: "center"
  }
});

export default PremiumChartOverlay;
