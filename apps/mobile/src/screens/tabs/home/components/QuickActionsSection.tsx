import React from "react";
import { View, TouchableOpacity, Text } from "react-native";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { useRouter } from "expo-router";
import { MOBILE_ROUTES } from "@/lib/routes";
import { SkeletonBox } from "@/components/ui/SkeletonBox";

interface QuickActionsSectionProps {
  hasActiveGoals: boolean;
  isLoading: boolean;
}

export function QuickActionsSection({ hasActiveGoals, isLoading }: QuickActionsSectionProps) {
  const styles = useStyles(makeQuickActionsSectionStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const handleCreateGoal = () => {
    router.push(MOBILE_ROUTES.GOALS.CREATE);
  };

  const handleViewAllGoals = () => {
    router.push(MOBILE_ROUTES.GOALS.LIST);
  };

  const handleViewProgress = () => {
    // Navigate to progress/stats screen when available
    // For now, navigate to goals list
    router.push(MOBILE_ROUTES.GOALS.LIST);
  };

  if (isLoading) {
    // Calculate button height: paddingVertical (spacing[3]) * 2 + text height (~20px)
    const buttonHeight = toRN(tokens.spacing[3]) * 2 + 20;

    return (
      <View style={styles.container}>
        {/* Primary button skeleton (if hasActiveGoals would be true) */}
        <SkeletonBox
          width="100%"
          height={buttonHeight}
          borderRadius={toRN(tokens.borderRadius.full)}
          style={{ marginBottom: toRN(tokens.spacing[3]) }}
        />
        <View style={styles.secondaryButtons}>
          <SkeletonBox
            width="48%"
            height={buttonHeight}
            borderRadius={toRN(tokens.borderRadius.full)}
            style={{ marginRight: toRN(tokens.spacing[2]) }}
          />
          <SkeletonBox
            width="48%"
            height={buttonHeight}
            borderRadius={toRN(tokens.borderRadius.full)}
            style={{ marginLeft: toRN(tokens.spacing[2]) }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {hasActiveGoals && (
        <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={handleCreateGoal}>
          <Text style={styles.primaryButtonText}>{t("home.create_goal")}</Text>
        </TouchableOpacity>
      )}
      <View style={styles.secondaryButtons}>
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleViewAllGoals}
        >
          <Text style={styles.secondaryButtonText}>{t("home.view_all_goals")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleViewProgress}
        >
          <Text style={styles.secondaryButtonText}>{t("home.view_progress")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeQuickActionsSectionStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    marginBottom: toRN(tokens.spacing[6]),
    paddingHorizontal: toRN(tokens.spacing[4])
  },
  button: {
    borderRadius: toRN(tokens.borderRadius.full),
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[6]),
    alignItems: "center",
    justifyContent: "center"
  },
  primaryButton: {
    backgroundColor: brand.primary,
    marginBottom: toRN(tokens.spacing[3]),
    shadowColor: colors.shadow?.md || "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    shadowOpacity: 0.12,
    elevation: 4
  },
  primaryButtonText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.onPrimary
  },
  secondaryButtons: {
    flexDirection: "row",
    gap: toRN(tokens.spacing[3])
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default
  },
  secondaryButtonText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.primary
  }
});
