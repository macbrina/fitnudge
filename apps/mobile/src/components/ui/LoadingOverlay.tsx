/**
 * LoadingOverlay Component
 *
 * A full-screen loading overlay with a centered spinner.
 * Used when processing purchases, restoring subscriptions, etc.
 */

import React from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { useTheme } from "@/themes";
import { useStyles } from "@/themes/makeStyles";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";

interface LoadingOverlayProps {
  /** Whether the overlay is visible */
  visible: boolean;
  /** Optional loading message to display */
  message?: string;
}

export function LoadingOverlay({ visible, message }: LoadingOverlayProps) {
  const { brandColors, colors } = useTheme();
  const styles = useStyles(makeLoadingOverlayStyles);

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <View style={styles.container}>
        <ActivityIndicator size="large" color={brandColors.primary} />
        {message && <Text style={styles.message}>{message}</Text>}
      </View>
    </View>
  );
}

const makeLoadingOverlayStyles = (tokens: any, colors: any, brand: any) => ({
  overlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg.overlayLight,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    zIndex: 999,
    elevation: 999, // For Android
  },
  container: {
    backgroundColor: colors.bg.canvas,
    borderRadius: toRN(tokens.borderRadius.xl),
    padding: toRN(tokens.spacing[8]),
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[4]),
    shadowColor: colors.shadow.md,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  message: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.primary,
  },
});

export default LoadingOverlay;
