import React from "react";
import { View, Text } from "react-native";
import { Card } from "@/components/ui/Card";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: string;
  style?: any;
}

export function StatCard({ label, value, icon, style }: StatCardProps) {
  const styles = useStyles(makeStatCardStyles);
  const { colors, brandColors } = useTheme();

  return (
    <Card shadow="md" style={[styles.card, style]}>
      <View style={styles.content}>
        {icon && <Text style={styles.icon}>{icon}</Text>}
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>
    </Card>
  );
}

const makeStatCardStyles = (tokens: any, colors: any, brand: any) => ({
  card: {
    flex: 1,
    minWidth: "45%",
    padding: toRN(tokens.spacing[4]),
  },
  content: {
    alignItems: "center",
  },
  icon: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    marginBottom: toRN(tokens.spacing[2]),
  },
  value: {
    fontSize: toRN(tokens.typography.fontSize["3xl"]),
    fontFamily: fontFamily.bold,
    color: brand.primary,
    marginBottom: toRN(tokens.spacing[1]),
  },
  label: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
    textAlign: "center",
  },
});
