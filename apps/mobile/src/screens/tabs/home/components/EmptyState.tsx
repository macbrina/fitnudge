import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";

interface EmptyStateProps {
  /** Ionicons icon name */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Optional custom icon color (defaults to brand primary with opacity) */
  iconColor?: string;
  title: string;
  message: string;
  style?: any;
}

export function EmptyState({ icon, iconColor, title, message, style }: EmptyStateProps) {
  const styles = useStyles(makeEmptyStateStyles);
  const { colors, brandColors } = useTheme();

  return (
    <View style={[styles.container, style]}>
      {icon && (
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: `${iconColor || brandColors.primary}15` }
          ]}
        >
          <Ionicons name={icon} size={24} color={iconColor || brandColors.primary} />
        </View>
      )}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const makeEmptyStateStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: toRN(tokens.spacing[8]),
    paddingHorizontal: toRN(tokens.spacing[4])
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[4])
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[2]),
    textAlign: "center" as const
  },
  message: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    lineHeight: toRN(tokens.typography.fontSize.base) * 1.5
  }
});
