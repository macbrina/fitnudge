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
import { BIGGEST_CHALLENGES } from "@/constants/personalization";

interface BiggestChallengeScreenProps {
  onContinue: (biggestChallenge: string) => void;
  onBack?: () => void;
  currentStep: number;
  totalSteps: number;
}

export default function BiggestChallengeScreen({
  onContinue,
  onBack,
  currentStep,
  totalSteps
}: BiggestChallengeScreenProps) {
  const { biggest_challenge } = useOnboardingStore();
  const [selectedChallenge, setSelectedChallenge] = useState<string>(biggest_challenge || "");
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { brandColors } = useTheme();

  useEffect(() => {
    setSelectedChallenge(biggest_challenge || "");
  }, [biggest_challenge]);

  const handleContinue = () => {
    if (selectedChallenge) {
      onContinue(selectedChallenge);
    }
  };

  return (
    <PersonalizationLayout
      currentStep={currentStep}
      totalSteps={totalSteps}
      onContinue={handleContinue}
      onBack={onBack}
      canContinue={!!selectedChallenge}
    >
      <View style={styles.content}>
        <Text style={styles.title}>{t("onboarding.personalization.biggest_challenge.title")}</Text>

        <Text style={styles.subtitle}>
          {t("onboarding.personalization.biggest_challenge.subtitle")}
        </Text>

        <View style={styles.optionsContainer}>
          {BIGGEST_CHALLENGES.map((challenge) => {
            const isSelected = selectedChallenge === challenge.value;
            return (
              <TouchableOpacity
                key={challenge.value}
                onPress={() => setSelectedChallenge(challenge.value)}
                activeOpacity={0.7}
                style={[
                  styles.optionCard,
                  isSelected && [styles.optionCardSelected, { borderColor: brandColors.primary }]
                ]}
              >
                <Text
                  style={[
                    styles.optionLabel,
                    isSelected && [styles.optionLabelSelected, { color: brandColors.primary }]
                  ]}
                >
                  {t(challenge.onboardingLabelKey)}
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
      paddingTop: toRN(tokens.spacing[2])
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
      marginBottom: toRN(tokens.spacing[6]),
      fontFamily: fontFamily.groteskRegular,
      lineHeight: lineHeight(tokens.typography.fontSize.base, tokens.typography.lineHeight.relaxed)
    },
    optionsContainer: {
      gap: toRN(tokens.spacing[3])
    },
    optionCard: {
      backgroundColor: colors.bg.muted,
      borderRadius: toRN(tokens.borderRadius.xl),
      paddingVertical: toRN(tokens.spacing[5]),
      paddingHorizontal: toRN(tokens.spacing[5]),
      borderWidth: 2,
      borderColor: colors.border.subtle
    },
    optionCardSelected: {
      backgroundColor: brand.primary + "08"
    },
    optionLabel: {
      fontSize: toRN(tokens.typography.fontSize.lg),
      fontWeight: tokens.typography.fontWeight.semibold,
      color: colors.text.primary,
      fontFamily: fontFamily.groteskSemiBold
    },
    optionLabelSelected: {}
  };
};
