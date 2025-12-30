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

interface MotivationStyleScreenProps {
  onContinue: (motivationStyle: string) => void;
  onBack?: () => void;
  isSubmitting: boolean;
  hasExistingProfile?: boolean;
  currentStep: number;
  totalSteps: number;
}

const MOTIVATION_STYLES = [
  {
    id: "tough_love",
    label: "onboarding.personalization.motivation_style.tough_love.title",
  },
  {
    id: "gentle_encouragement",
    label:
      "onboarding.personalization.motivation_style.gentle_encouragement.title",
  },
  {
    id: "data_driven",
    label: "onboarding.personalization.motivation_style.data_driven.title",
  },
  {
    id: "accountability_buddy",
    label:
      "onboarding.personalization.motivation_style.accountability_buddy.title",
  },
];

export default function MotivationStyleScreen({
  onContinue,
  onBack,
  isSubmitting,
  hasExistingProfile = false,
  currentStep,
  totalSteps,
}: MotivationStyleScreenProps) {
  const { motivation_style } = useOnboardingStore();
  const [selectedStyle, setSelectedStyle] = useState<string>(
    motivation_style || "",
  );
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { brandColors } = useTheme();

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
      currentStep={currentStep}
      totalSteps={totalSteps}
      onContinue={handleContinue}
      onBack={onBack}
      canContinue={!!selectedStyle}
      isLoading={isSubmitting}
      buttonText={
        isSubmitting
          ? hasExistingProfile
            ? t("onboarding.personalization.updating")
            : t("onboarding.personalization.submitting")
          : hasExistingProfile
            ? t("onboarding.personalization.update_profile")
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
          {MOTIVATION_STYLES.map((motivationStyle) => {
            const isSelected = selectedStyle === motivationStyle.id;
            return (
              <TouchableOpacity
                key={motivationStyle.id}
                onPress={() => setSelectedStyle(motivationStyle.id)}
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
                  {t(motivationStyle.label)}
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
