import React from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { Card } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useStyles, useTheme } from "@/themes";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { MOBILE_ROUTES } from "@/lib/routes";
import { Target, Coffee } from "lucide-react-native";

interface GoalsEmptyStateProps {
  /** Whether user has any active goals at all (regardless of schedule) */
  hasActiveGoals: boolean;
}

export function GoalsEmptyState({ hasActiveGoals }: GoalsEmptyStateProps) {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const handleCreateGoal = () => {
    router.push(MOBILE_ROUTES.GOALS.CREATE);
  };

  const handleViewAllGoals = () => {
    router.push(MOBILE_ROUTES.MAIN.GOALS);
  };

  // User has goals but none scheduled for today - rest day
  if (hasActiveGoals) {
    return (
      <Card shadow="md" style={styles.container}>
        <View style={styles.content}>
          {/* Illustration */}
          <View style={styles.illustration}>
            <View style={[styles.iconCircle, { backgroundColor: `${colors.feedback.success}15` }]}>
              <Coffee size={32} color={colors.feedback.success} />
            </View>
          </View>

          {/* Text Content */}
          <View style={styles.textContent}>
            <Text style={styles.title}>{t("home.rest_day_title")}</Text>
            <Text style={styles.description}>{t("home.rest_day_description")}</Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              title={t("home.view_all_goals")}
              onPress={handleViewAllGoals}
              variant="outline"
              size="sm"
              fullWidth
            />
          </View>
        </View>
      </Card>
    );
  }

  // User has no active goals at all
  return (
    <Card shadow="md" style={styles.container}>
      <View style={styles.content}>
        {/* Illustration */}
        <View style={styles.illustration}>
          <View style={styles.iconCircle}>
            <Target size={32} color={brandColors.primary} />
          </View>
        </View>

        {/* Text Content */}
        <View style={styles.textContent}>
          <Text style={styles.title}>{t("home.no_goals_title")}</Text>
          <Text style={styles.description}>{t("home.no_goals_description")}</Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title={t("home.create_first_goal")}
            onPress={handleCreateGoal}
            variant="primary"
            size="sm"
            leftIcon="add"
            fullWidth
          />
        </View>
      </View>
    </Card>
  );
}

const makeStyles = (tokens: any, colors: any, brandColors: any) => ({
  container: {
    marginBottom: toRN(tokens.spacing[4])
  },
  content: {
    // paddingHorizontal: toRN(tokens.spacing[5]),
    alignItems: "center" as const
  },
  illustration: {
    marginBottom: toRN(tokens.spacing[3])
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${brandColors.primary}15`,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  textContent: {
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[4])
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[1]),
    textAlign: "center" as const
  },
  description: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5,
    maxWidth: 260
  },
  actions: {
    width: "100%" as const
  }
});

export default GoalsEmptyState;
