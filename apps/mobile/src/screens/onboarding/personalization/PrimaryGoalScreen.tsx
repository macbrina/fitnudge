import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTranslation } from "@/lib/i18n";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { useStyles } from "@/themes/makeStyles";
import { tokens, lineHeight } from "@/themes/tokens";
import { useTheme } from "@/themes";
import PersonalizationLayout from "./PersonalizationLayout";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { Card } from "@/components/ui/Card";

interface PrimaryGoalScreenProps {
  onContinue: (primaryGoal: string) => void;
  onBack?: () => void;
}

const PRIMARY_GOALS = [
  {
    id: "lose_weight",
    title: "onboarding.personalization.primary_goal.lose_weight.title",
    description:
      "onboarding.personalization.primary_goal.lose_weight.description",
    icon: "⚖️",
  },
  {
    id: "build_muscle",
    title: "onboarding.personalization.primary_goal.build_muscle.title",
    description:
      "onboarding.personalization.primary_goal.build_muscle.description",
    icon: "💪",
  },
  {
    id: "stay_active",
    title: "onboarding.personalization.primary_goal.stay_active.title",
    description:
      "onboarding.personalization.primary_goal.stay_active.description",
    icon: "🏃",
  },
  {
    id: "general_fitness",
    title: "onboarding.personalization.primary_goal.general_fitness.title",
    description:
      "onboarding.personalization.primary_goal.general_fitness.description",
    icon: "🌟",
  },
  {
    id: "sport_specific",
    title: "onboarding.personalization.primary_goal.sport_specific.title",
    description:
      "onboarding.personalization.primary_goal.sport_specific.description",
    icon: "🏅",
  },
];

export default function PrimaryGoalScreen({
  onContinue,
  onBack,
}: PrimaryGoalScreenProps) {
  const { primary_goal } = useOnboardingStore();
  const [selectedGoal, setSelectedGoal] = useState<string>(primary_goal || "");
  const { t } = useTranslation();
  const styles = useStyles(makePrimaryGoalScreenStyles);
  const { colors, brand } = useTheme();

  // Sync with store when component mounts or store value changes
  useEffect(() => {
    setSelectedGoal(primary_goal || "");
  }, [primary_goal]);

  const handleContinue = () => {
    if (selectedGoal) {
      onContinue(selectedGoal);
    }
  };

  return (
    <PersonalizationLayout
      currentStep={3}
      totalSteps={8}
      onContinue={handleContinue}
      onBack={onBack}
      canContinue={!!selectedGoal}
    >
      <View style={styles.content}>
        <Text style={styles.title}>
          {t("onboarding.personalization.primary_goal.title")}
        </Text>

        <Text style={styles.subtitle}>
          {t("onboarding.personalization.primary_goal.subtitle")}
        </Text>

        <View style={styles.optionsContainer}>
          {PRIMARY_GOALS.map((goal) => {
            const isSelected = selectedGoal === goal.id;
            return (
              <TouchableOpacity
                key={goal.id}
                onPress={() => setSelectedGoal(goal.id)}
                style={styles.optionCardTouchable}
                activeOpacity={0.7}
              >
                <Card
                  padded={false}
                  shadow={isSelected ? "xl" : "md"}
                  style={[
                    styles.optionCard,
                    isSelected && styles.optionCardSelected,
                  ]}
                >
                  <View
                    style={[
                      styles.iconContainer,
                      isSelected && styles.iconContainerSelected,
                    ]}
                  >
                    <Text style={styles.optionIcon}>{goal.icon}</Text>
                  </View>
                  <View style={styles.textContainer}>
                    <Text
                      style={[
                        styles.optionTitle,
                        isSelected && styles.optionTitleSelected,
                      ]}
                    >
                      {t(goal.title)}
                    </Text>
                    <Text
                      style={[
                        styles.optionDescription,
                        isSelected && styles.optionDescriptionSelected,
                      ]}
                    >
                      {t(goal.description)}
                    </Text>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </PersonalizationLayout>
  );
}

const makePrimaryGoalScreenStyles = (tokens: any, colors: any, brand: any) => {
  return {
    content: {
      flex: 1,
      paddingTop: toRN(tokens.spacing[4]),
    },
    title: {
      fontSize: toRN(tokens.typography.fontSize["3xl"]),
      fontWeight: tokens.typography.fontWeight.bold,
      color: colors.text.primary,
      textAlign: "center" as const,
      marginBottom: toRN(tokens.spacing[3]),
      fontFamily: fontFamily.groteskBold,
      lineHeight: lineHeight(
        tokens.typography.fontSize["3xl"],
        tokens.typography.lineHeight.tight
      ),
    },
    subtitle: {
      fontSize: toRN(tokens.typography.fontSize.base),
      color: colors.text.secondary,
      textAlign: "center" as const,
      marginBottom: toRN(tokens.spacing[10]),
      fontFamily: fontFamily.groteskRegular,
      lineHeight: lineHeight(
        tokens.typography.fontSize.base,
        tokens.typography.lineHeight.relaxed
      ),
      paddingHorizontal: toRN(tokens.spacing[4]),
    },
    optionsContainer: {
      gap: toRN(tokens.spacing[4]),
      marginBottom: toRN(tokens.spacing[6]),
    },
    optionCardTouchable: {
      borderRadius: toRN(tokens.borderRadius.xl),
    },
    optionCard: {
      padding: toRN(tokens.spacing[5]),
      flexDirection: "row" as const,
      alignItems: "center" as const,
    },
    optionCardSelected: {
      borderColor: brand.primary,
      backgroundColor: brand.primary + "08",
      borderWidth: 2,
      borderRadius: toRN(tokens.borderRadius.xl),
    },
    iconContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.bg.muted,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginRight: toRN(tokens.spacing[4]),
      flexShrink: 0,
    },
    iconContainerSelected: {
      backgroundColor: brand.primary + "15",
    },
    optionIcon: {
      fontSize: 32,
    },
    textContainer: {
      flex: 1,
      justifyContent: "center" as const,
    },
    optionTitle: {
      fontSize: toRN(tokens.typography.fontSize.lg),
      fontWeight: tokens.typography.fontWeight.semibold,
      color: colors.text.primary,
      marginBottom: toRN(tokens.spacing[1]),
      fontFamily: fontFamily.groteskSemiBold,
      lineHeight: lineHeight(
        tokens.typography.fontSize.lg,
        tokens.typography.lineHeight.normal
      ),
    },
    optionTitleSelected: {
      color: brand.primary,
    },
    optionDescription: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.text.secondary,
      fontFamily: fontFamily.groteskRegular,
      lineHeight: lineHeight(
        tokens.typography.fontSize.sm,
        tokens.typography.lineHeight.relaxed
      ),
    },
    optionDescriptionSelected: {
      color: brand.primary + "DD",
    },
  };
};
