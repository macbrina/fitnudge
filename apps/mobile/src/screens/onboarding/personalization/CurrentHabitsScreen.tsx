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

interface CurrentHabitsScreenProps {
  onContinue: (currentFrequency: string) => void;
  onBack?: () => void;
}

const FREQUENCY_OPTIONS = [
  {
    id: "never",
    title: "onboarding.personalization.current_habits.never.title",
    description: "onboarding.personalization.current_habits.never.description",
    icon: "🚀",
  },
  {
    id: "1-2x_week",
    title: "onboarding.personalization.current_habits.1-2x_week.title",
    description:
      "onboarding.personalization.current_habits.1-2x_week.description",
    icon: "🌱",
  },
  {
    id: "3-4x_week",
    title: "onboarding.personalization.current_habits.3-4x_week.title",
    description:
      "onboarding.personalization.current_habits.3-4x_week.description",
    icon: "💪",
  },
  {
    id: "5+_week",
    title: "onboarding.personalization.current_habits.5+_week.title",
    description:
      "onboarding.personalization.current_habits.5+_week.description",
    icon: "🔥",
  },
  {
    id: "daily",
    title: "onboarding.personalization.current_habits.daily.title",
    description: "onboarding.personalization.current_habits.daily.description",
    icon: "🏆",
  },
];

export default function CurrentHabitsScreen({
  onContinue,
  onBack,
}: CurrentHabitsScreenProps) {
  const { current_frequency } = useOnboardingStore();
  const [selectedFrequency, setSelectedFrequency] = useState<string>(
    current_frequency || ""
  );
  const { t } = useTranslation();
  const styles = useStyles(makeCurrentHabitsScreenStyles);
  const { colors, brand } = useTheme();

  // Sync with store when component mounts or store value changes
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
      currentStep={4}
      totalSteps={8}
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
          {FREQUENCY_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.id}
              onPress={() => setSelectedFrequency(option.id)}
              style={[
                styles.optionCard,
                selectedFrequency === option.id && styles.optionCardSelected,
              ]}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.iconContainer,
                  selectedFrequency === option.id &&
                    styles.iconContainerSelected,
                ]}
              >
                <Text style={styles.optionIcon}>{option.icon}</Text>
              </View>
              <View style={styles.textContainer}>
                <Text
                  style={[
                    styles.optionTitle,
                    selectedFrequency === option.id &&
                      styles.optionTitleSelected,
                  ]}
                >
                  {t(option.title)}
                </Text>
                <Text
                  style={[
                    styles.optionDescription,
                    selectedFrequency === option.id &&
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

const makeCurrentHabitsScreenStyles = (
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
