import React from "react";
import { View, Text } from "react-native";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";

interface EmptyStateProps {
  icon?: string;
  title: string;
  message: string;
  style?: any;
}

export function EmptyState({ icon, title, message, style }: EmptyStateProps) {
  const styles = useStyles(makeEmptyStateStyles);
  const { colors } = useTheme();

  return (
    <View style={[styles.container, style]}>
      {icon && <Text style={styles.icon}>{icon}</Text>}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const makeEmptyStateStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: toRN(tokens.spacing[8]),
    paddingHorizontal: toRN(tokens.spacing[4]),
  },
  icon: {
    fontSize: toRN(tokens.typography.fontSize["4xl"]),
    marginBottom: toRN(tokens.spacing[4]),
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[2]),
    textAlign: "center",
  },
  message: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: toRN(tokens.typography.fontSize.base) * 1.5,
  },
});
