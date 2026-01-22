import React from "react";
import { Switch as RNSwitch, SwitchProps as RNSwitchProps, StyleSheet, View } from "react-native";
import { useTheme } from "@/themes";

type SwitchSize = "sm" | "md" | "lg";

interface SwitchProps extends Omit<RNSwitchProps, "style"> {
  /**
   * Size of the switch
   * - sm: 0.8 scale (smaller)
   * - md: 0.9 scale (default)
   * - lg: 1.0 scale (native size)
   */
  size?: SwitchSize;
}

const SCALE_MAP: Record<SwitchSize, number> = {
  sm: 0.8,
  md: 0.9,
  lg: 1.0
};

export function Switch({
  size = "md",
  value,
  onValueChange,
  disabled,
  trackColor,
  thumbColor,
  ios_backgroundColor,
  ...rest
}: SwitchProps) {
  const { colors, brandColors } = useTheme();
  const scale = SCALE_MAP[size];

  // Default track colors if not provided
  const defaultTrackColor = {
    false: colors.border.subtle,
    true: brandColors.primary
  };

  return (
    <View style={[styles.container, { transform: [{ scale }] }]}>
      <RNSwitch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={trackColor ?? defaultTrackColor}
        thumbColor={thumbColor}
        ios_backgroundColor={ios_backgroundColor}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Ensures the scaled switch doesn't affect layout spacing
    alignItems: "center",
    justifyContent: "center"
  }
});

export default Switch;
