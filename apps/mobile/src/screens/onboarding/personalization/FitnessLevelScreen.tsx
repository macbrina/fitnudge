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

interface FitnessLevelScreenProps {
  onContinue: (fitnessLevel: string) => void;
  onBack?: () => void;
}

const FITNESS_LEVELS = [
  {
    id: "beginner",
    title: "onboarding.personalization.fitness_level.beginner.title",
    description:
      "onboarding.personalization.fitness_level.beginner.description",
    icon: "🌱",
  },
  {
    id: "intermediate",
    title: "onboarding.personalization.fitness_level.intermediate.title",
    description:
      "onboarding.personalization.fitness_level.intermediate.description",
    icon: "💪",
  },
  {
    id: "advanced",
    title: "onboarding.personalization.fitness_level.advanced.title",
    description:
      "onboarding.personalization.fitness_level.advanced.description",
    icon: "🔥",
  },
  {
    id: "athlete",
    title: "onboarding.personalization.fitness_level.athlete.title",
    description: "onboarding.personalization.fitness_level.athlete.description",
    icon: "🏆",
  },
];

export default function FitnessLevelScreen({
  onContinue,
  onBack,
}: FitnessLevelScreenProps) {
  const { fitness_level } = useOnboardingStore();
  const [selectedLevel, setSelectedLevel] = useState<string>(
    fitness_level || ""
  );
  const { t } = useTranslation();
  const styles = useStyles(makeFitnessLevelScreenStyles);
  const { colors, brand } = useTheme();

  // Sync with store when component mounts or store value changes
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
      currentStep={2}
      totalSteps={8}
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
                  <View
                    style={[
                      styles.iconContainer,
                      isSelected && styles.iconContainerSelected,
                    ]}
                  >
                    <Text style={styles.optionIcon}>{level.icon}</Text>
                  </View>
                  <View style={styles.textContainer}>
                    <Text
                      style={[
                        styles.optionTitle,
                        isSelected && styles.optionTitleSelected,
                      ]}
                    >
                      {t(level.title)}
                    </Text>
                    <Text
                      style={[
                        styles.optionDescription,
                        isSelected && styles.optionDescriptionSelected,
                      ]}
                    >
                      {t(level.description)}
                    </Text>
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

const makeFitnessLevelScreenStyles = (tokens: any, colors: any, brand: any) => {
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
