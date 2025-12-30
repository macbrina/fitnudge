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

interface CurrentHabitsScreenProps {
  onContinue: (currentFrequency: string) => void;
  onBack?: () => void;
  currentStep: number;
  totalSteps: number;
}

const FREQUENCY_OPTIONS = [
  {
    id: "never",
    label: "onboarding.personalization.current_habits.never.title",
  },
  {
    id: "1-2x_week",
    label: "onboarding.personalization.current_habits.1-2x_week.title",
  },
  {
    id: "3-4x_week",
    label: "onboarding.personalization.current_habits.3-4x_week.title",
  },
  {
    id: "5+_week",
    label: "onboarding.personalization.current_habits.5+_week.title",
  },
  {
    id: "daily",
    label: "onboarding.personalization.current_habits.daily.title",
  },
];

export default function CurrentHabitsScreen({
  onContinue,
  onBack,
  currentStep,
  totalSteps,
}: CurrentHabitsScreenProps) {
  const { current_frequency } = useOnboardingStore();
  const [selectedFrequency, setSelectedFrequency] = useState<string>(
    current_frequency || "",
  );
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { brandColors } = useTheme();

  useEffect(() => {
    setSelectedFrequency(current_frequency || "");
  }, [current_frequency]);

  const handleContinue = () => {
    if (selectedFrequency) {
      onContinue(selectedFrequency);
    }
  };

  return (
    <PersonalizationLayout
      currentStep={currentStep}
      totalSteps={totalSteps}
      onContinue={handleContinue}
      onBack={onBack}
      canContinue={!!selectedFrequency}
    >
      <View style={styles.content}>
        <Text style={styles.title}>
          {t("onboarding.personalization.current_habits.title")}
        </Text>

        <Text style={styles.subtitle}>
          {t("onboarding.personalization.current_habits.subtitle")}
        </Text>

        <View style={styles.optionsContainer}>
          {FREQUENCY_OPTIONS.map((option) => {
            const isSelected = selectedFrequency === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                onPress={() => setSelectedFrequency(option.id)}
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
                  {t(option.label)}
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
