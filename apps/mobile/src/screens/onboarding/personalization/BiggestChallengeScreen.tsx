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
import { Card } from "@/components/ui/Card";

interface BiggestChallengeScreenProps {
  onContinue: (biggestChallenge: string) => void;
  onBack?: () => void;
}

const CHALLENGE_OPTIONS = [
  {
    id: "time_management",
    title: "onboarding.personalization.biggest_challenge.time_management.title",
    description:
      "onboarding.personalization.biggest_challenge.time_management.description",
    icon: "⏰",
  },
  {
    id: "lack_of_motivation",
    title:
      "onboarding.personalization.biggest_challenge.lack_of_motivation.title",
    description:
      "onboarding.personalization.biggest_challenge.lack_of_motivation.description",
    icon: "💭",
  },
  {
    id: "not_knowing_what_to_do",
    title:
      "onboarding.personalization.biggest_challenge.not_knowing_what_to_do.title",
    description:
      "onboarding.personalization.biggest_challenge.not_knowing_what_to_do.description",
    icon: "❓",
  },
  {
    id: "consistency",
    title: "onboarding.personalization.biggest_challenge.consistency.title",
    description:
      "onboarding.personalization.biggest_challenge.consistency.description",
    icon: "🔄",
  },
  {
    id: "accountability",
    title: "onboarding.personalization.biggest_challenge.accountability.title",
    description:
      "onboarding.personalization.biggest_challenge.accountability.description",
    icon: "👥",
  },
  {
    id: "injury_concerns",
    title: "onboarding.personalization.biggest_challenge.injury_concerns.title",
    description:
      "onboarding.personalization.biggest_challenge.injury_concerns.description",
    icon: "🛡️",
  },
];

export default function BiggestChallengeScreen({
  onContinue,
  onBack,
}: BiggestChallengeScreenProps) {
  const { biggest_challenge } = useOnboardingStore();
  const [selectedChallenge, setSelectedChallenge] = useState<string>(
    biggest_challenge || ""
  );
  const { t } = useTranslation();
  const styles = useStyles(makeBiggestChallengeScreenStyles);
  const { colors, brand } = useTheme();

  // Sync with store when component mounts or store value changes
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
      currentStep={7}
      totalSteps={8}
      onContinue={handleContinue}
      onBack={onBack}
      canContinue={!!selectedChallenge}
    >
      <View style={styles.content}>
        <Text style={styles.title}>
          {t("onboarding.personalization.biggest_challenge.title")}
        </Text>

        <Text style={styles.subtitle}>
          {t("onboarding.personalization.biggest_challenge.subtitle")}
        </Text>

        <View style={styles.optionsContainer}>
          {CHALLENGE_OPTIONS.map((challenge) => {
            const isSelected = selectedChallenge === challenge.id;
            return (
              <TouchableOpacity
                key={challenge.id}
                onPress={() => setSelectedChallenge(challenge.id)}
                style={styles.optionCardTouchable}
                activeOpacity={0.7}
              >
                <Card
                  padded={false}
                  shadow={isSelected ? "xl" : "md"}
                  style={[
                    styles.optionCard,
                    isSelected && styles.optionCardSelected,
                  ]}
                >
                  <View style={styles.optionRow}>
                    <View
                      style={[
                        styles.iconContainer,
                        isSelected && styles.iconContainerSelected,
                      ]}
                    >
                      <Text style={styles.optionIcon}>{challenge.icon}</Text>
                    </View>
                    <View style={styles.textContainer}>
                      <Text
                        style={[
                          styles.optionTitle,
                          isSelected && styles.optionTitleSelected,
                        ]}
                      >
                        {t(challenge.title)}
                      </Text>
                      <Text
                        style={[
                          styles.optionDescription,
                          isSelected && styles.optionDescriptionSelected,
                        ]}
                      >
                        {t(challenge.description)}
                      </Text>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </PersonalizationLayout>
  );
}

const makeBiggestChallengeScreenStyles = (
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
    optionCardTouchable: {
      borderRadius: toRN(tokens.borderRadius.xl),
    },
    optionCard: {
      padding: toRN(tokens.spacing[5]),
    },
    optionRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
    },
    optionCardSelected: {
      borderColor: brand.primary,
      backgroundColor: brand.primary + "08",
      borderWidth: 2,
      borderRadius: toRN(tokens.borderRadius.xl),
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
