import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { Ionicons } from "@expo/vector-icons";
import { View, ViewStyle } from "react-native";

// Spacing token type matching tokens.spacing keys
type SpacingToken = keyof typeof tokens.spacing;

interface CheckmarkCircleProps {
  /**
   * Size of the circle (checkmark will be proportionally sized)
   * @default 22
   */
  size?: number;
  /**
   * Background color of the circle
   * @default brandColors.primary
   */
  color?: string;
  /**
   * Color of the checkmark icon
   * @default brandColors.onPrimary (white)
   */
  checkColor?: string;
  /**
   * Margin right using spacing token (0-12)
   */
  mr?: SpacingToken;
  /**
   * Margin left using spacing token (0-12)
   */
  ml?: SpacingToken;
  /**
   * Margin top using spacing token (0-12)
   */
  mt?: SpacingToken;
  /**
   * Margin bottom using spacing token (0-12)
   */
  mb?: SpacingToken;
  /**
   * Additional styles for the container
   */
  style?: ViewStyle;
}

/**
 * A circular checkmark icon with customizable colors.
 * Use this instead of Ionicons "checkmark-circle" for proper color control.
 *
 * @example
 * // Default (blue circle, white checkmark)
 * <CheckmarkCircle />
 *
 * // Custom size with margin
 * <CheckmarkCircle size={24} mr={3} />
 *
 * // Success variant
 * <CheckmarkCircle color={colors.feedback.success} />
 */
export default function CheckmarkCircle({
  size = 22,
  color,
  checkColor,
  mr,
  ml,
  mt,
  mb,
  style
}: CheckmarkCircleProps) {
  const { brandColors } = useTheme();

  const circleColor = color ?? brandColors.primary;
  const iconColor = checkColor ?? brandColors.onPrimary;
  const iconSize = Math.round(size * 0.64); // Checkmark is ~64% of circle size

  // Build margin styles from spacing tokens
  const marginStyles: ViewStyle = {};
  if (mr !== undefined) marginStyles.marginRight = toRN(tokens.spacing[mr]);
  if (ml !== undefined) marginStyles.marginLeft = toRN(tokens.spacing[ml]);
  if (mt !== undefined) marginStyles.marginTop = toRN(tokens.spacing[mt]);
  if (mb !== undefined) marginStyles.marginBottom = toRN(tokens.spacing[mb]);

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: circleColor,
          alignItems: "center",
          justifyContent: "center"
        },
        marginStyles,
        style
      ]}
    >
      <Ionicons name="checkmark" size={iconSize} color={iconColor} />
    </View>
  );
}
