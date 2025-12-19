import React, { forwardRef, PropsWithChildren } from "react";
import { View, ViewProps, ViewStyle, StyleProp } from "react-native";
import { useTheme } from "@/themes";
import { toRN } from "@/lib/units";
import { tokens } from "@/themes/tokens";

type CardShadow = "none" | "sm" | "md" | "lg" | "xl";

type CardProps = PropsWithChildren<
  ViewProps & {
    /**
     * Apply the default horizontal and vertical padding inside the card.
     * Disable when you need custom padding via the style prop.
     */
    padded?: boolean;
    /**
     * Disable the card from being interacted with.
     */
    disabled?: boolean;
    /**
     * Shadow intensity preset.
     * Mirrors the shadcn/ui card elevation levels.
     */
    shadow?: CardShadow;
    /**
     * Optional background color override. Defaults to the themed card surface.
     */
    backgroundColor?: string;
    style?: StyleProp<ViewStyle>;
  }
>;

const SHADOW_PRESETS: Record<
  Exclude<CardShadow, "none">,
  {
    offset: { width: number; height: number };
    radius: number;
    elevation: number;
    opacity: number;
  }
> = {
  sm: {
    offset: { width: 0, height: 2 },
    radius: 6,
    elevation: 2,
    opacity: 0.08,
  },
  md: {
    offset: { width: 0, height: 6 },
    radius: 12,
    elevation: 4,
    opacity: 0.12,
  },
  lg: {
    offset: { width: 0, height: 12 },
    radius: 18,
    elevation: 6,
    opacity: 0.16,
  },
  xl: {
    offset: { width: 0, height: 18 },
    radius: 28,
    elevation: 9,
    opacity: 0.24,
  },
};

const Card = forwardRef<View, CardProps>(function Card(
  {
    children,
    style,
    padded = true,
    shadow = "lg",
    backgroundColor,
    disabled = false,
    ...rest
  },
  ref
) {
  const { colors } = useTheme();

  const baseStyle: ViewStyle = {
    backgroundColor: backgroundColor ?? colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.xl),
    borderWidth: 1,
    borderColor: colors.border.subtle,
  };

  if (padded) {
    baseStyle.paddingHorizontal = toRN(tokens.spacing[5]);
    baseStyle.paddingVertical = toRN(tokens.spacing[4]);
  }

  if (shadow !== "none") {
    const preset = SHADOW_PRESETS[shadow ?? "lg"] ?? SHADOW_PRESETS.lg;
    baseStyle.shadowColor = colors.shadow[shadow] ?? colors.shadow.lg;
    baseStyle.shadowOffset = preset.offset;
    baseStyle.shadowRadius = preset.radius;
    baseStyle.shadowOpacity = preset.opacity;
    baseStyle.elevation = preset.elevation;
  }

  if (disabled) {
    baseStyle.opacity = 1.0;
  }

  return (
    <View ref={ref} style={[baseStyle, style]} {...rest}>
      <View style={disabled ? { opacity: 0.9 } : {}}>{children}</View>
    </View>
  );
});

export { Card };
