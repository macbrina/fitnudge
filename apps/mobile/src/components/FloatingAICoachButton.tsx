/**
 * Floating AI Coach Button
 *
 * A floating action button that appears across all screens.
 * Opens the AI Coach chat modal when pressed.
 * Premium gate is handled inside the AI Coach screen itself.
 *
 * Positioned above FloatingOfferButton to avoid collision.
 */

import React, { useState, useEffect } from "react";
import { TouchableOpacity, Animated, Easing, StyleSheet } from "react-native";
import { BotIcon } from "@/components/icons/bot-icon";
import { toRN } from "@/lib/units";
import { tokens } from "@/themes/tokens";

interface FloatingAICoachButtonProps {
  onPress: () => void;
  // Whether FloatingOfferButton is also visible (for positioning)
  hasOfferButtonBelow?: boolean;
}

export function FloatingAICoachButton({
  onPress,
  hasOfferButtonBelow = false
}: FloatingAICoachButtonProps) {
  // Animation for subtle pulse effect
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    // Subtle pulse animation
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        })
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [pulseAnim]);

  // Position: above FloatingOfferButton if both are visible, otherwise at same level
  // FloatingOfferButton is at bottom: spacing[22] (~5.5rem / 88px)
  // When offer button is visible, position this at spacing[24] (~6rem / 96px)
  // When offer button is not visible, use spacing[22] (~5.5rem / 88px)
  const bottomPosition = hasOfferButtonBelow
    ? toRN(tokens.spacing[28]) + 20 // Above the offer button
    : toRN(tokens.spacing[22]); // Default position (same as offer button would be)

  return (
    <Animated.View
      style={[
        styles.container,
        {
          bottom: bottomPosition,
          transform: [{ scale: pulseAnim }]
        }
      ]}
    >
      <TouchableOpacity
        style={styles.button}
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityLabel="Open AI Coach"
        accessibilityRole="button"
      >
        <BotIcon size={32} color="#FFFFFF" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: toRN(tokens.spacing[4]),
    zIndex: 1001 // Above FloatingOfferButton (zIndex: 100)
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#58c8dd", // Matches the bot icon gradient
    justifyContent: "center",
    alignItems: "center",
    // Shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8
  }
});

export default FloatingAICoachButton;
