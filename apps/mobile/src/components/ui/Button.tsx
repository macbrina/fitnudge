import React from "react";
import {
  TouchableOpacity,
  Text,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useStyles, useTheme } from "@/themes";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "success"
  | "text";

export type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl";

export type ButtonBorderRadius = "none" | "sm" | "md" | "lg" | "xl" | "full";

export interface ButtonProps {
  // Content
  title: string;
  onPress: () => void;

  // Variants & Styling
  variant?: ButtonVariant;
  size?: ButtonSize;
  borderRadius?: ButtonBorderRadius;

  // States
  disabled?: boolean;
  loading?: boolean;

  // Icons
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  iconOnly?: boolean;
  icon?: keyof typeof Ionicons.glyphMap; // New icon prop for simple icon buttons

  // Customization
  fullWidth?: boolean;
  flex?: boolean;

  // Styling overrides
  style?: ViewStyle;
  textStyle?: TextStyle;

  // Accessibility
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

// Create makeStyles function for theme-aware styling
const makeStyles = (tokens: any, colors: any, brand: any) => ({
  // Base styles
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  // Shadow styles for solid background variants
  shadow: {
    shadowColor: colors.text.primary,
    shadowOffset: { width: 0, height: toRN(2) },
    shadowOpacity: 0.1,
    shadowRadius: toRN(4),
    elevation: 2,
  },

  // No shadow styles for transparent variants
  noShadow: {
    shadowOpacity: 0,
    elevation: 0,
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 0,
  },

  // Variant styles
  primary: {
    backgroundColor: brand.primary,
    borderWidth: 0,
  },
  secondary: {
    backgroundColor: colors.bg.muted,
    borderWidth: 0,
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: brand.primary,
  },
  ghost: {
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  danger: {
    backgroundColor: colors.feedback.error,
    borderWidth: 0,
  },
  success: {
    backgroundColor: colors.feedback.success,
    borderWidth: 0,
  },

  // Size styles
  xs: {
    paddingHorizontal: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[2]),
    minHeight: toRN(28),
  },
  sm: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[2]),
    minHeight: toRN(36),
  },
  md: {
    paddingHorizontal: toRN(tokens.spacing[5]),
    paddingVertical: toRN(tokens.spacing[3]),
    minHeight: toRN(44),
  },
  lg: {
    paddingHorizontal: toRN(tokens.spacing[6]),
    paddingVertical: toRN(tokens.spacing[4]),
    minHeight: toRN(52),
  },
  xl: {
    paddingHorizontal: toRN(tokens.spacing[7]),
    paddingVertical: toRN(tokens.spacing[5]),
    minHeight: toRN(60),
  },

  // Text styles
  text: {
    fontFamily: fontFamily.groteskMedium,
    textAlign: "center",
  },

  // Variant text styles
  primaryText: {
    color: brand.onPrimary,
  },
  secondaryText: {
    color: brand.onPrimary,
  },
  outlineText: {
    color: brand.primary,
  },
  ghostText: {
    color: brand.primary,
    fontFamily: fontFamily.groteskBold,
  },
  dangerText: {
    color: brand.onPrimary,
  },
  successText: {
    color: brand.onPrimary,
  },
  textText: {
    color: brand.primary,
    textDecorationLine: "underline",
    fontFamily: fontFamily.groteskRegular,
  },

  // Size text styles
  xsText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
  },
  smText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
  },
  mdText: {
    fontSize: toRN(tokens.typography.fontSize.base),
  },
  lgText: {
    fontSize: toRN(tokens.typography.fontSize.lg),
  },
  xlText: {
    fontSize: toRN(tokens.typography.fontSize.xl),
  },

  // State styles
  disabled: {
    opacity: 0.6,
    shadowOpacity: 0.05,
    elevation: 1,
  },
  disabledText: {
    color: brand.onPrimary,
  },
  // Disabled text styles for specific variants
  outlineDisabledText: {
    color: brand.primary,
  },
  ghostDisabledText: {
    color: brand.primary,
  },
  textDisabledText: {
    color: colors.text.secondary,
    textDecorationLine: "none",
  },

  // Border radius styles
  borderRadiusNone: {
    borderRadius: 0,
  },
  borderRadiusSm: {
    borderRadius: toRN(tokens.borderRadius.sm),
  },
  borderRadiusMd: {
    borderRadius: toRN(tokens.borderRadius.md),
  },
  borderRadiusLg: {
    borderRadius: toRN(tokens.borderRadius.lg),
  },
  borderRadiusXl: {
    borderRadius: toRN(tokens.borderRadius.xl),
  },
  borderRadiusFull: {
    borderRadius: toRN(tokens.borderRadius.full),
  },

  // Layout styles
  fullWidth: {
    width: "100%",
  },

  // Minimal padding for text and ghost variants
  minimalPadding: {
    paddingHorizontal: toRN(tokens.spacing[1]),
    paddingVertical: toRN(tokens.spacing[1]),
    minHeight: "auto",
  },

  // Content styles
  contentContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  leftIcon: {
    marginRight: toRN(tokens.spacing[2]),
  },
  rightIcon: {
    marginLeft: toRN(tokens.spacing[2]),
  },

  // Loading styles
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginLeft: toRN(tokens.spacing[2]),
  },
  disabledSpinner: {
    marginLeft: toRN(tokens.spacing[2]),
  },

  // Action button small style
  actionButtonSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    minHeight: 36,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  flex: {
    flex: 1,
  },
});

export default function Button({
  // Content
  title,
  onPress,

  // Variants & Styling
  variant = "primary",
  size = "md",
  borderRadius = "full",

  // States
  disabled = false,
  loading = false,

  // Icons
  leftIcon,
  rightIcon,
  iconOnly = false,
  icon,

  // Customization
  fullWidth = false,
  flex = false,
  // Styling overrides
  style,
  textStyle,

  // Accessibility
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  // Get theme and styles
  const { colors, brandColors } = useTheme();
  const styles = useStyles(makeStyles);

  // Determine if button should be disabled
  const isDisabled = disabled || loading;

  // Determine if variant should have shadow (only solid background variants)
  const hasShadow = ["primary", "secondary", "danger", "success"].includes(
    variant
  );

  // Determine if variant should explicitly have no shadow (transparent variants)
  const hasNoShadow = ["outline", "ghost", "text"].includes(variant);

  // Determine if variant should have minimal padding
  const hasMinimalPadding = ["ghost", "text"].includes(variant);

  // Get styles based on variant, size, and state
  const buttonStyle = [
    styles.base,
    styles[variant],
    !hasMinimalPadding && styles[size], // Skip size padding for minimal variants
    hasMinimalPadding && styles.minimalPadding, // Use minimal padding instead
    styles[
      `borderRadius${borderRadius.charAt(0).toUpperCase() + borderRadius.slice(1)}`
    ],
    hasShadow && styles.shadow,
    hasNoShadow && styles.noShadow,
    fullWidth && styles.fullWidth,
    flex && styles.flex,
    isDisabled && styles.disabled,
    icon && styles.actionButtonSmall, // Apply actionButtonSmall style when icon prop is used
    style,
  ];

  const buttonTextStyle = [
    styles.text,
    styles[`${variant}Text`],
    styles[`${size}Text`],
    isDisabled &&
      (variant === "outline"
        ? styles.outlineDisabledText
        : variant === "ghost"
          ? styles.ghostDisabledText
          : variant === "text"
            ? styles.textDisabledText
            : styles.disabledText),
    textStyle,
  ];

  // Get icon size based on button size
  const iconSize = getIconSize(size);

  // Get icon color based on variant
  const iconColor = getIconColor(variant, isDisabled, colors, brandColors);

  // Handle press with loading state
  const handlePress = () => {
    if (!isDisabled) {
      onPress();
    }
  };

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={handlePress}
      disabled={isDisabled}
      activeOpacity={0.8}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
    >
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size={iconSize} color={iconColor} />
          {!iconOnly && (
            <Text style={[buttonTextStyle, styles.loadingText]}>
              Loading...
            </Text>
          )}
        </View>
      ) : (
        <View style={styles.contentContainer}>
          {/* Simple Icon (new icon prop) */}
          {icon && <Ionicons name={icon} size={iconSize} color={iconColor} />}

          {/* Left Icon */}
          {leftIcon && !iconOnly && !icon && (
            <Ionicons
              name={leftIcon}
              size={iconSize}
              color={iconColor}
              style={styles.leftIcon}
            />
          )}

          {/* Icon Only */}
          {iconOnly && !icon && (leftIcon || rightIcon) && (
            <Ionicons
              name={leftIcon || rightIcon!}
              size={iconSize}
              color={iconColor}
            />
          )}

          {/* Text (if not icon only and not using simple icon) */}
          {!iconOnly && !icon && <Text style={buttonTextStyle}>{title}</Text>}

          {/* Right Icon */}
          {rightIcon && !iconOnly && !icon && (
            <Ionicons
              name={rightIcon}
              size={iconSize}
              color={iconColor}
              style={styles.rightIcon}
            />
          )}

          {/* Disabled spinner indicator */}
          {!iconOnly && !icon && isDisabled && (
            <ActivityIndicator
              size={iconSize}
              color={iconColor}
              style={styles.disabledSpinner}
            />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// Helper functions
function getIconSize(size: ButtonSize): number {
  switch (size) {
    case "xs":
      return 14;
    case "sm":
      return 16;
    case "md":
      return 18;
    case "lg":
      return 20;
    case "xl":
      return 24;
    default:
      return 18;
  }
}

function getIconColor(
  variant: ButtonVariant,
  isDisabled: boolean,
  colors: any,
  brandColors: any
): string {
  if (
    isDisabled &&
    variant !== "outline" &&
    variant !== "ghost" &&
    variant !== "text"
  )
    return brandColors.onPrimary;

  switch (variant) {
    case "primary":
      return brandColors.onPrimary;
    case "secondary":
    case "danger":
    case "success":
      return brandColors.onPrimary;
    case "outline":
    case "ghost":
    case "text":
      return brandColors.primary;
    default:
      return brandColors.onPrimary;
  }
}
