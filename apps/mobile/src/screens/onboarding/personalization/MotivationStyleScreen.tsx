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

interface MotivationStyleScreenProps {
  onContinue: (motivationStyle: string) => void;
  onBack?: () => void;
  isSubmitting: boolean;
}

const MOTIVATION_STYLES = [
  {
    id: "tough_love",
    title: "onboarding.personalization.motivation_style.tough_love.title",
    description:
      "onboarding.personalization.motivation_style.tough_love.description",
    icon: "🔥",
  },
  {
    id: "gentle_encouragement",
    title:
      "onboarding.personalization.motivation_style.gentle_encouragement.title",
    description:
      "onboarding.personalization.motivation_style.gentle_encouragement.description",
    icon: "🤗",
  },
  {
    id: "data_driven",
    title: "onboarding.personalization.motivation_style.data_driven.title",
    description:
      "onboarding.personalization.motivation_style.data_driven.description",
    icon: "📊",
  },
  {
    id: "accountability_buddy",
    title:
      "onboarding.personalization.motivation_style.accountability_buddy.title",
    description:
      "onboarding.personalization.motivation_style.accountability_buddy.description",
    icon: "👥",
  },
];

export default function MotivationStyleScreen({
  onContinue,
  onBack,
  isSubmitting,
}: MotivationStyleScreenProps) {
  const { motivation_style } = useOnboardingStore();
  const [selectedStyle, setSelectedStyle] = useState<string>(
    motivation_style || ""
  );
  const { t } = useTranslation();
  const styles = useStyles(makeMotivationStyleScreenStyles);
  const { colors, brand } = useTheme();

  // Sync with store when component mounts or store value changes
  useEffect(() => {
    setSelectedStyle(motivation_style || "");
  }, [motivation_style]);

  const handleContinue = () => {
    if (selectedStyle) {
      onContinue(selectedStyle);
    }
  };

  return (
    <PersonalizationLayout
      currentStep={8}
      totalSteps={8}
      onContinue={handleContinue}
      onBack={onBack}
      canContinue={!!selectedStyle}
      isLoading={isSubmitting}
      buttonText={
        isSubmitting
          ? t("onboarding.personalization.submitting")
          : t("onboarding.personalization.generate_goals")
      }
    >
      <View style={styles.content}>
        <Text style={styles.title}>
          {t("onboarding.personalization.motivation_style.title")}
        </Text>

        <Text style={styles.subtitle}>
          {t("onboarding.personalization.motivation_style.subtitle")}
        </Text>

        <View style={styles.optionsContainer}>
          {MOTIVATION_STYLES.map((motivationStyle) => (
            <TouchableOpacity
              key={motivationStyle.id}
              onPress={() => setSelectedStyle(motivationStyle.id)}
              style={[
                styles.optionCard,
                selectedStyle === motivationStyle.id &&
                  styles.optionCardSelected,
              ]}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.iconContainer,
                  selectedStyle === motivationStyle.id &&
                    styles.iconContainerSelected,
                ]}
              >
                <Text style={styles.optionIcon}>{motivationStyle.icon}</Text>
              </View>
              <View style={styles.textContainer}>
                <Text
                  style={[
                    styles.optionTitle,
                    selectedStyle === motivationStyle.id &&
                      styles.optionTitleSelected,
                  ]}
                >
                  {t(motivationStyle.title)}
                </Text>
                <Text
                  style={[
                    styles.optionDescription,
                    selectedStyle === motivationStyle.id &&
                      styles.optionDescriptionSelected,
                  ]}
                >
                  {t(motivationStyle.description)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </PersonalizationLayout>
  );
}

const makeMotivationStyleScreenStyles = (
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
