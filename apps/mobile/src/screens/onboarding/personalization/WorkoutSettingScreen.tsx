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

interface WorkoutSettingScreenProps {
  onContinue: (preferredLocation: string) => void;
  onBack?: () => void;
}

const LOCATION_OPTIONS = [
  {
    id: "gym",
    title: "onboarding.personalization.workout_setting.gym.title",
    description: "onboarding.personalization.workout_setting.gym.description",
    icon: "🏋️",
  },
  {
    id: "home",
    title: "onboarding.personalization.workout_setting.home.title",
    description: "onboarding.personalization.workout_setting.home.description",
    icon: "🏠",
  },
  {
    id: "outdoor",
    title: "onboarding.personalization.workout_setting.outdoor.title",
    description:
      "onboarding.personalization.workout_setting.outdoor.description",
    icon: "🌳",
  },
  {
    id: "mix",
    title: "onboarding.personalization.workout_setting.mix.title",
    description: "onboarding.personalization.workout_setting.mix.description",
    icon: "🔄",
  },
  {
    id: "dont_know",
    title: "onboarding.personalization.workout_setting.dont_know.title",
    description:
      "onboarding.personalization.workout_setting.dont_know.description",
    icon: "❓",
  },
];

export default function WorkoutSettingScreen({
  onContinue,
  onBack,
}: WorkoutSettingScreenProps) {
  const { preferred_location } = useOnboardingStore();
  const [selectedLocation, setSelectedLocation] = useState<string>(
    preferred_location || ""
  );
  const { t } = useTranslation();
  const styles = useStyles(makeWorkoutSettingScreenStyles);
  const { colors, brand } = useTheme();

  // Sync with store when component mounts or store value changes
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
      currentStep={5}
      totalSteps={8}
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
          {LOCATION_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.id}
              onPress={() => setSelectedLocation(option.id)}
              style={[
                styles.optionCard,
                selectedLocation === option.id && styles.optionCardSelected,
              ]}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.iconContainer,
                  selectedLocation === option.id &&
                    styles.iconContainerSelected,
                ]}
              >
                <Text style={styles.optionIcon}>{option.icon}</Text>
              </View>
              <View style={styles.textContainer}>
                <Text
                  style={[
                    styles.optionTitle,
                    selectedLocation === option.id &&
                      styles.optionTitleSelected,
                  ]}
                >
                  {t(option.title)}
                </Text>
                <Text
                  style={[
                    styles.optionDescription,
                    selectedLocation === option.id &&
                      styles.optionDescriptionSelected,
                  ]}
                >
                  {t(option.description)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </PersonalizationLayout>
  );
}

const makeWorkoutSettingScreenStyles = (
  tokens: any,
  colors: any,
  brand: any
) => {
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
    optionCard: {
      backgroundColor: colors.bg.surface,
      borderRadius: toRN(tokens.borderRadius.xl),
      padding: toRN(tokens.spacing[5]),
      flexDirection: "row" as const,
      alignItems: "center" as const,
      borderWidth: 2,
      borderColor: colors.border.default,
      shadowColor: colors.shadow.default,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    optionCardSelected: {
      borderColor: brand.primary,
      backgroundColor: brand.primary + "08",
      shadowColor: brand.primary,
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 4,
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
