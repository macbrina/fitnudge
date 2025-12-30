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

interface WorkoutSettingScreenProps {
  onContinue: (preferredLocation: string) => void;
  onBack?: () => void;
  currentStep: number;
  totalSteps: number;
}

const LOCATION_OPTIONS = [
  { id: "gym", label: "onboarding.personalization.workout_setting.gym.title" },
  {
    id: "home",
    label: "onboarding.personalization.workout_setting.home.title",
  },
  {
    id: "outdoor",
    label: "onboarding.personalization.workout_setting.outdoor.title",
  },
  { id: "mix", label: "onboarding.personalization.workout_setting.mix.title" },
  {
    id: "dont_know",
    label: "onboarding.personalization.workout_setting.dont_know.title",
  },
];

export default function WorkoutSettingScreen({
  onContinue,
  onBack,
  currentStep,
  totalSteps,
}: WorkoutSettingScreenProps) {
  const { preferred_location } = useOnboardingStore();
  const [selectedLocation, setSelectedLocation] = useState<string>(
    preferred_location || "",
  );
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { brandColors } = useTheme();

  useEffect(() => {
    setSelectedLocation(preferred_location || "");
  }, [preferred_location]);

  const handleContinue = () => {
    if (selectedLocation) {
      onContinue(selectedLocation);
    }
  };

  return (
    <PersonalizationLayout
      currentStep={currentStep}
      totalSteps={totalSteps}
      onContinue={handleContinue}
      onBack={onBack}
      canContinue={!!selectedLocation}
    >
      <View style={styles.content}>
        <Text style={styles.title}>
          {t("onboarding.personalization.workout_setting.title")}
        </Text>

        <Text style={styles.subtitle}>
          {t("onboarding.personalization.workout_setting.subtitle")}
        </Text>

        <View style={styles.optionsContainer}>
          {LOCATION_OPTIONS.map((option) => {
            const isSelected = selectedLocation === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                onPress={() => setSelectedLocation(option.id)}
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
