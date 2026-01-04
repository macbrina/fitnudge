import React from "react";
import { View, Text } from "react-native";
import { Card } from "@/components/ui/Card";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/lib/i18n";

interface AccountabilityPlanCardProps {
  plan: any; // Full structured_data from actionable_plans
}

export function AccountabilityPlanCard({ plan }: AccountabilityPlanCardProps) {
  const styles = useStyles(makeAccountabilityPlanCardStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();

  const structure = plan.structure || {};
  const tracking = structure.tracking || {};

  return (
    <Card shadow="lg" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="checkmark-circle" size={28} color={brandColors.primary} />
        </View>
        <Text style={styles.cardTitle}>{t("goals.plan.accountability_title")}</Text>
      </View>

      <View style={styles.trackingCard}>
        <View style={styles.trackingRow}>
          <Ionicons name="calendar-outline" size={20} color={colors.text.secondary} />
          <Text style={styles.trackingLabel}>{t("goals.plan.frequency")}:</Text>
          <Text style={styles.trackingValue}>
            {tracking.frequency === "daily" ? t("goals.plan.daily") : t("goals.plan.weekly")}
          </Text>
        </View>

        {tracking.target_days_per_week && (
          <View style={styles.trackingRow}>
            <Ionicons name="flag-outline" size={20} color={colors.text.secondary} />
            <Text style={styles.trackingLabel}>{t("goals.plan.target")}:</Text>
            <Text style={styles.trackingValue}>
              {tracking.target_days_per_week} {t("goals.plan.days_per_week")}
            </Text>
          </View>
        )}

        <View style={styles.trackingRow}>
          <Ionicons name="checkbox-outline" size={20} color={colors.text.secondary} />
          <Text style={styles.trackingLabel}>{t("goals.plan.method")}:</Text>
          <Text style={styles.trackingValue}>{t("goals.plan.daily_checkins")}</Text>
        </View>
      </View>
    </Card>
  );
}

const makeAccountabilityPlanCardStyles = (tokens: any, colors: any, brand: any) => ({
  card: {
    marginBottom: toRN(tokens.spacing[4])
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[3]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default
  },
  iconContainer: {
    width: toRN(tokens.spacing[10]),
    height: toRN(tokens.spacing[10]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: brand.primary + "1A",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginRight: toRN(tokens.spacing[3])
  },
  cardTitle: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary
  },
  trackingCard: {
    gap: toRN(tokens.spacing[3]),
    padding: toRN(tokens.spacing[4]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.lg)
  },
  trackingRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2])
  },
  trackingLabel: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.secondary
  },
  trackingValue: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary
  }
});
