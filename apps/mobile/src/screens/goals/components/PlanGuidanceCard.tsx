import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Card } from "@/components/ui/Card";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/lib/i18n";

interface PlanGuidanceCardProps {
  guidance: {
    description: string;
    tips: string[];
  };
}

export function PlanGuidanceCard({ guidance }: PlanGuidanceCardProps) {
  const styles = useStyles(makePlanGuidanceCardStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const [showAllTips, setShowAllTips] = useState(false);

  const visibleTips = showAllTips ? guidance.tips : guidance.tips.slice(0, 3);

  return (
    <Card shadow="md" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="bulb" size={24} color={brandColors.primary} />
        </View>
        <Text style={styles.cardTitle}>{t("goals.plan.tips_guidance")}</Text>
      </View>

      <Text style={styles.description}>{guidance.description}</Text>

      <View style={styles.tipsSection}>
        <Text style={styles.tipsTitle}>{t("goals.plan.tips_title")}</Text>
        <View style={styles.tipsList}>
          {visibleTips.map((tip, index) => (
            <View key={index} style={styles.tipRow}>
              <View style={styles.tipBullet}>
                <Text style={styles.tipBulletText}>•</Text>
              </View>
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>

        {guidance.tips.length > 3 && (
          <TouchableOpacity
            style={styles.showMoreButton}
            onPress={() => setShowAllTips(!showAllTips)}
          >
            <Text style={styles.showMoreText}>
              {showAllTips
                ? t("common.show_less")
                : t("common.show_more", { count: guidance.tips.length - 3 })}
            </Text>
            <Ionicons
              name={showAllTips ? "chevron-up" : "chevron-down"}
              size={16}
              color={brandColors.primary}
            />
          </TouchableOpacity>
        )}
      </View>
    </Card>
  );
}

const makePlanGuidanceCardStyles = (tokens: any, colors: any, brand: any) => ({
  card: {
    marginBottom: toRN(tokens.spacing[4]),
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[3]),
  },
  iconContainer: {
    width: toRN(tokens.spacing[8]),
    height: toRN(tokens.spacing[8]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: brand.primary + "1A",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginRight: toRN(tokens.spacing[2]),
  },
  cardTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
  },
  description: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5,
    marginBottom: toRN(tokens.spacing[4]),
  },
  tipsSection: {
    paddingTop: toRN(tokens.spacing[3]),
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  tipsTitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[2]),
  },
  tipsList: {
    gap: toRN(tokens.spacing[2.5]),
  },
  tipRow: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: toRN(tokens.spacing[2]),
  },
  tipBullet: {
    width: toRN(tokens.spacing[4]),
    alignItems: "center" as const,
    paddingTop: toRN(tokens.spacing[0.25]),
  },
  tipBulletText: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    color: brand.primary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5,
  },
  tipText: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.primary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5,
  },
  showMoreButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[1]),
    paddingVertical: toRN(tokens.spacing[2]),
    marginTop: toRN(tokens.spacing[2]),
  },
  showMoreText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskMedium,
    color: brand.primary,
  },
});

