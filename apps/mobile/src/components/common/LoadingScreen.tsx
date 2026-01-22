import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useStyles, useTheme } from "@/themes";
import { BackButton } from "@/components/ui/BackButton";
import { useRouter } from "expo-router";

interface LoadingScreenProps {
  /**
   * Whether to show a back button at the top
   * @default false
   */
  showBackButton?: boolean;
  /**
   * Title for the back button header
   */
  title?: string;
  /**
   * Size of the ActivityIndicator
   * @default "large"
   */
  size?: "small" | "large";
}

/**
 * A simple full-screen loading component with centered ActivityIndicator.
 * Use this for screen-level loading states (e.g., when fetching data).
 */
export function LoadingScreen({
  showBackButton = false,
  title,
  size = "large"
}: LoadingScreenProps) {
  const { colors, brandColors } = useTheme();
  const router = useRouter();
  const styles = useStyles(makeStyles);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
      {showBackButton && <BackButton title={title} onPress={router.back} />}
      <View style={styles.content}>
        <ActivityIndicator size={size} color={brandColors.primary} />
      </View>
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  }
});

export default LoadingScreen;
