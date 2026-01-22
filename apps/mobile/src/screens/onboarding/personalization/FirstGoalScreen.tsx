import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTranslation } from "@/lib/i18n";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { useStyles } from "@/themes/makeStyles";
import { lineHeight } from "@/themes/tokens";
import { useTheme } from "@/themes";
import PersonalizationLayout from "./PersonalizationLayout";
import { useOnboardingStore } from "@/stores/onboardingStore";

type GoalType = "workout" | "read" | "meditate" | "hydration" | "journal" | "custom";

interface FirstGoalScreenProps {
  onContinue: (goalType: GoalType) => void;
  onBack?: () => void;
  currentStep: number;
  totalSteps: number;
}

const POPULAR_GOALS: Array<{ value: GoalType; key: string }> = [
  { value: "workout", key: "workout" },
  { value: "read", key: "read" },
  { value: "meditate", key: "meditate" },
  { value: "hydration", key: "hydration" },
  { value: "journal", key: "journal" },
  { value: "custom", key: "custom" }
];

export default function FirstGoalScreen({
  onContinue,
  onBack,
  currentStep,
  totalSteps
}: FirstGoalScreenProps) {
  // Get initial value from store (persisted)
  const storedGoalType = useOnboardingStore((state) => state.selected_goal_type);
  const [selectedGoal, setSelectedGoal] = useState<GoalType | "">(storedGoalType);

  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { brandColors } = useTheme();

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
      buttonText={t("onboarding.first_goal.continue")}
    >
      <View style={styles.content}>
        <Text style={styles.title}>{t("onboarding.first_goal.title")}</Text>

        <View style={styles.optionsContainer}>
          {/* <Text style={styles.subtitle}>{t("onboarding.first_goal.subtitle")}</Text> */}
          {POPULAR_GOALS.map((goal) => {
            const isSelected = selectedGoal === goal.value;
            return (
              <TouchableOpacity
                key={goal.value}
                onPress={() => setSelectedGoal(goal.value)}
                activeOpacity={0.7}
                style={[
                  styles.optionCard,
                  isSelected && [styles.optionCardSelected, { borderColor: brandColors.primary }]
                ]}
              >
                <Text style={[styles.optionLabel, isSelected && { color: brandColors.primary }]}>
                  {t(`onboarding.first_goal.goals.${goal.key}`)}
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
      paddingTop: toRN(tokens.spacing[4])
    },
    title: {
      fontSize: toRN(tokens.typography.fontSize["2xl"]),
      fontWeight: tokens.typography.fontWeight.bold,
      color: colors.text.primary,
      marginBottom: toRN(tokens.spacing[2]),
      fontFamily: fontFamily.groteskBold,
      lineHeight: lineHeight(tokens.typography.fontSize["2xl"], tokens.typography.lineHeight.tight)
    },
    subtitle: {
      fontSize: toRN(tokens.typography.fontSize.base),
      color: colors.text.secondary,
      marginTop: toRN(tokens.spacing[2]),
      fontFamily: fontFamily.groteskRegular,
      lineHeight: lineHeight(tokens.typography.fontSize.base, tokens.typography.lineHeight.relaxed)
    },
    optionsContainer: {
      gap: toRN(tokens.spacing[3])
    },
    optionCard: {
      backgroundColor: colors.bg.card,
      borderRadius: toRN(tokens.borderRadius.xl),
      paddingVertical: toRN(tokens.spacing[4]),
      paddingHorizontal: toRN(tokens.spacing[5]),
      borderWidth: 2,
      borderColor: colors.border.subtle
    },
    optionCardSelected: {
      backgroundColor: brand.primary + "08"
    },
    optionLabel: {
      fontSize: toRN(tokens.typography.fontSize.lg),
      fontWeight: tokens.typography.fontWeight.medium,
      color: colors.text.primary,
      fontFamily: fontFamily.groteskMedium
    }
  };
};
