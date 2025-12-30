/**
 * FloatingOfferButton Component
 *
 * A floating button that appears when there's an active exit offer countdown.
 * Clipped to the right edge of the screen with rounded left corners.
 * Shows the discount percentage and countdown timer.
 */

import React, { useEffect, useState, useRef } from "react";
import { View, Text, TouchableOpacity, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useStyles, useTheme } from "@/themes";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useExitOfferStore } from "@/stores/exitOfferStore";

interface FloatingOfferButtonProps {
  onPress: () => void;
  /** Discount percentage to display (e.g., 50 for "50% OFF") */
  discountPercent?: number;
}

// Format time remaining as MM:SS
const formatTimeRemaining = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

export function FloatingOfferButton({
  onPress,
  discountPercent = 50,
}: FloatingOfferButtonProps) {
  const styles = useStyles(makeFloatingOfferButtonStyles);
  const { brandColors } = useTheme();
  const { isActive, getTimeRemaining, clearExitOffer } = useExitOfferStore();
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const giftRotateAnim = useRef(new Animated.Value(0)).current;
  const giftBounceAnim = useRef(new Animated.Value(0)).current;

  // Pulse animation for container
  useEffect(() => {
    if (!isActive) return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.03,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();

    return () => pulse.stop();
  }, [isActive, pulseAnim]);

  // Gift icon wiggle + bounce animation
  useEffect(() => {
    if (!isActive) return;

    // Wiggle rotation
    const wiggle = Animated.loop(
      Animated.sequence([
        Animated.timing(giftRotateAnim, {
          toValue: 1,
          duration: 150,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(giftRotateAnim, {
          toValue: -1,
          duration: 150,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(giftRotateAnim, {
          toValue: 1,
          duration: 150,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(giftRotateAnim, {
          toValue: 0,
          duration: 150,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        // Pause between wiggles
        Animated.delay(2000),
      ]),
    );

    // Bounce animation
    const bounce = Animated.loop(
      Animated.sequence([
        Animated.timing(giftBounceAnim, {
          toValue: -3,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(giftBounceAnim, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(2000),
      ]),
    );

    wiggle.start();
    bounce.start();

    return () => {
      wiggle.stop();
      bounce.stop();
    };
  }, [isActive, giftRotateAnim, giftBounceAnim]);

  // Update time remaining every second
  useEffect(() => {
    if (!isActive) return;

    const updateTimer = () => {
      const remaining = getTimeRemaining();
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        clearExitOffer();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [isActive, getTimeRemaining, clearExitOffer]);

  // Don't render if no active offer
  if (!isActive || timeRemaining <= 0) {
    return null;
  }

  // Interpolate rotation
  const giftRotation = giftRotateAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["-15deg", "0deg", "15deg"],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ scale: pulseAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.button}
        onPress={onPress}
        activeOpacity={0.9}
      >
        {/* Animated Gift Icon */}
        <Animated.View
          style={[
            styles.iconContainer,
            {
              transform: [
                { rotate: giftRotation },
                { translateY: giftBounceAnim },
              ],
            },
          ]}
        >
          <Text style={styles.giftEmoji}>🎁</Text>
        </Animated.View>

        {/* Discount Badge */}
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>{discountPercent}%</Text>
          <Text style={styles.offText}>OFF</Text>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Timer */}
        <View style={styles.timerContainer}>
          <Ionicons name="time" size={16} color="rgba(255,255,255,0.9)" />
          <Text style={styles.timerText}>
            {formatTimeRemaining(timeRemaining)}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const makeFloatingOfferButtonStyles = (
  tokens: any,
  colors: any,
  brand: any,
) => ({
  container: {
    position: "absolute" as const,
    bottom: toRN(tokens.spacing[28]),
    right: 0, // Clipped to right edge
    zIndex: 100,
  },
  button: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[2.5]),
    paddingLeft: toRN(tokens.spacing[3]),
    paddingRight: toRN(tokens.spacing[4]),
    backgroundColor: brand.primary,
    // Only round the left corners
    borderTopLeftRadius: toRN(tokens.borderRadius.full),
    borderBottomLeftRadius: toRN(tokens.borderRadius.full),
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    // Shadow
    shadowColor: "#000",
    shadowOffset: { width: -4, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 12,
  },
  iconContainer: {
    marginRight: toRN(tokens.spacing[2]),
  },
  giftEmoji: {
    fontSize: 22,
  },
  discountBadge: {
    flexDirection: "row" as const,
    alignItems: "baseline" as const,
  },
  discountText: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontWeight: "800" as const,
    fontFamily: fontFamily.groteskBold,
    color: "#FFFFFF",
  },
  offText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontWeight: "700" as const,
    fontFamily: fontFamily.groteskBold,
    color: "rgba(255,255,255,0.9)",
    marginLeft: 2,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255,255,255,0.3)",
    marginHorizontal: toRN(tokens.spacing[3]),
  },
  timerContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
  },
  timerText: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontWeight: "700" as const,
    fontFamily: fontFamily.groteskBold,
    color: "#FFFFFF",
    letterSpacing: 1,
  },
});

export default FloatingOfferButton;
