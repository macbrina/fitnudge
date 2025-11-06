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

interface AvailableTimeScreenProps {
  onContinue: (availableTime: string) => void;
  onBack?: () => void;
}

const TIME_OPTIONS = [
  {
    id: "less_30min",
    title: "onboarding.personalization.available_time.less_30min.title",
    description:
      "onboarding.personalization.available_time.less_30min.description",
    icon: "⚡",
  },
  {
    id: "30-60min",
    title: "onboarding.personalization.available_time.30-60min.title",
    description:
      "onboarding.personalization.available_time.30-60min.description",
    icon: "⏰",
  },
  {
    id: "1-2hrs",
    title: "onboarding.personalization.available_time.1-2hrs.title",
    description: "onboarding.personalization.available_time.1-2hrs.description",
    icon: "💪",
  },
  {
    id: "flexible",
    title: "onboarding.personalization.available_time.flexible.title",
    description:
      "onboarding.personalization.available_time.flexible.description",
    icon: "🔄",
  },
];

export default function AvailableTimeScreen({
  onContinue,
  onBack,
}: AvailableTimeScreenProps) {
  const { available_time } = useOnboardingStore();
  const [selectedTime, setSelectedTime] = useState<string>(
    available_time || ""
  );
  const { t } = useTranslation();
  const styles = useStyles(makeAvailableTimeScreenStyles);
  const { colors, brand } = useTheme();

  // Sync with store when component mounts or store value changes
  useEffect(() => {
    setSelectedTime(available_time || "");
  }, [available_time]);

  const handleContinue = () => {
    if (selectedTime) {
      onContinue(selectedTime);
    }
  };

  return (
    <PersonalizationLayout
      currentStep={6}
      totalSteps={8}
      onContinue={handleContinue}
      onBack={onBack}
      canContinue={!!selectedTime}
    >
      <View style={styles.content}>
        <Text style={styles.title}>
          {t("onboarding.personalization.available_time.title")}
        </Text>

        <Text style={styles.subtitle}>
          {t("onboarding.personalization.available_time.subtitle")}
        </Text>

        <View style={styles.optionsContainer}>
          {TIME_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.id}
              onPress={() => setSelectedTime(option.id)}
              style={[
                styles.optionCard,
                selectedTime === option.id && styles.optionCardSelected,
              ]}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.iconContainer,
                  selectedTime === option.id && styles.iconContainerSelected,
                ]}
              >
                <Text style={styles.optionIcon}>{option.icon}</Text>
              </View>
              <View style={styles.textContainer}>
                <Text
                  style={[
                    styles.optionTitle,
                    selectedTime === option.id && styles.optionTitleSelected,
                  ]}
                >
                  {t(option.title)}
                </Text>
                <Text
                  style={[
                    styles.optionDescription,
                    selectedTime === option.id &&
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

const makeAvailableTimeScreenStyles = (
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
