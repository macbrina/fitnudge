import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTranslation } from "@/lib/i18n";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { useStyles } from "@/themes/makeStyles";
import { lineHeight } from "@/themes/tokens";
import { useTheme } from "@/themes";
import PersonalizationLayout from "./PersonalizationLayout";
import { useOnboardingStore } from "@/stores/onboardingStore";

interface PrimaryGoalScreenProps {
  onContinue: (primaryGoal: string) => void;
  onBack?: () => void;
  currentStep: number;
  totalSteps: number;
}

const PRIMARY_GOALS = [
  {
    id: "lose_weight",
    label: "onboarding.personalization.primary_goal.lose_weight.title",
  },
  {
    id: "build_muscle",
    label: "onboarding.personalization.primary_goal.build_muscle.title",
  },
  {
    id: "stay_active",
    label: "onboarding.personalization.primary_goal.stay_active.title",
  },
  {
    id: "general_fitness",
    label: "onboarding.personalization.primary_goal.general_fitness.title",
  },
  {
    id: "sport_specific",
    label: "onboarding.personalization.primary_goal.sport_specific.title",
  },
];

export default function PrimaryGoalScreen({
  onContinue,
  onBack,
  currentStep,
  totalSteps,
}: PrimaryGoalScreenProps) {
  const { primary_goal } = useOnboardingStore();
  const [selectedGoal, setSelectedGoal] = useState<string>(primary_goal || "");
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { brandColors } = useTheme();

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
      currentStep={currentStep}
      totalSteps={totalSteps}
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
                activeOpacity={0.7}
                style={[
                  styles.optionCard,
                  isSelected && [
                    styles.optionCardSelected,
                    { borderColor: brandColors.primary },
                  ],
                ]}
              >
                <Text
                  style={[
                    styles.optionLabel,
                    isSelected && [
                      styles.optionLabelSelected,
                      { color: brandColors.primary },
                    ],
                  ]}
                >
                  {t(goal.label)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </PersonalizationLayout>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => {
  return {
    content: {
      flex: 1,
      paddingTop: toRN(tokens.spacing[2]),
    },
    title: {
      fontSize: toRN(tokens.typography.fontSize["2xl"]),
      fontWeight: tokens.typography.fontWeight.bold,
      color: colors.text.primary,
      marginBottom: toRN(tokens.spacing[2]),
      fontFamily: fontFamily.groteskBold,
      lineHeight: lineHeight(
        tokens.typography.fontSize["2xl"],
        tokens.typography.lineHeight.tight,
      ),
    },
    subtitle: {
      fontSize: toRN(tokens.typography.fontSize.base),
      color: colors.text.secondary,
      marginBottom: toRN(tokens.spacing[6]),
      fontFamily: fontFamily.groteskRegular,
      lineHeight: lineHeight(
        tokens.typography.fontSize.base,
        tokens.typography.lineHeight.relaxed,
      ),
    },
    optionsContainer: {
      gap: toRN(tokens.spacing[3]),
    },
    optionCard: {
      backgroundColor: colors.bg.muted,
      borderRadius: toRN(tokens.borderRadius.xl),
      paddingVertical: toRN(tokens.spacing[5]),
      paddingHorizontal: toRN(tokens.spacing[5]),
      borderWidth: 2,
      borderColor: colors.border.subtle,
    },
    optionCardSelected: {
      backgroundColor: brand.primary + "08",
    },
    optionLabel: {
      fontSize: toRN(tokens.typography.fontSize.lg),
      fontWeight: tokens.typography.fontWeight.semibold,
      color: colors.text.primary,
      fontFamily: fontFamily.groteskSemiBold,
    },
    optionLabelSelected: {},
  };
};
