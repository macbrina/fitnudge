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

interface FitnessLevelScreenProps {
  onContinue: (fitnessLevel: string) => void;
  onBack?: () => void;
  currentStep: number;
  totalSteps: number;
}

const FITNESS_LEVELS = [
  {
    id: "beginner",
    label: "onboarding.personalization.fitness_level.beginner.title",
  },
  {
    id: "intermediate",
    label: "onboarding.personalization.fitness_level.intermediate.title",
  },
  {
    id: "advanced",
    label: "onboarding.personalization.fitness_level.advanced.title",
  },
  {
    id: "athlete",
    label: "onboarding.personalization.fitness_level.athlete.title",
  },
];

export default function FitnessLevelScreen({
  onContinue,
  onBack,
  currentStep,
  totalSteps,
}: FitnessLevelScreenProps) {
  const { fitness_level } = useOnboardingStore();
  const [selectedLevel, setSelectedLevel] = useState<string>(
    fitness_level || "",
  );
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { brandColors } = useTheme();

  useEffect(() => {
    setSelectedLevel(fitness_level || "");
  }, [fitness_level]);

  const handleContinue = () => {
    if (selectedLevel) {
      onContinue(selectedLevel);
    }
  };

  return (
    <PersonalizationLayout
      currentStep={currentStep}
      totalSteps={totalSteps}
      onContinue={handleContinue}
      onBack={onBack}
      canContinue={!!selectedLevel}
    >
      <View style={styles.content}>
        <Text style={styles.title}>
          {t("onboarding.personalization.fitness_level.title")}
        </Text>

        <Text style={styles.subtitle}>
          {t("onboarding.personalization.fitness_level.subtitle")}
        </Text>

        <View style={styles.optionsContainer}>
          {FITNESS_LEVELS.map((level) => {
            const isSelected = selectedLevel === level.id;
            return (
              <TouchableOpacity
                key={level.id}
                onPress={() => setSelectedLevel(level.id)}
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
                  {t(level.label)}
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
