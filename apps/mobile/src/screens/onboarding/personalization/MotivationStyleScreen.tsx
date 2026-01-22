import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/lib/i18n";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { useStyles } from "@/themes/makeStyles";
import { lineHeight } from "@/themes/tokens";
import { useTheme } from "@/themes";
import PersonalizationLayout from "./PersonalizationLayout";
import { useOnboardingStore } from "@/stores/onboardingStore";

interface MotivationStyleScreenProps {
  onContinue: (motivationStyle: "supportive" | "tough_love" | "calm") => void;
  onBack?: () => void;
  currentStep: number;
  totalSteps: number;
}

const MOTIVATION_OPTIONS: Array<{
  value: "supportive" | "tough_love" | "calm";
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { value: "supportive", key: "supportive", icon: "heart" },
  { value: "tough_love", key: "tough_love", icon: "flash" },
  { value: "calm", key: "calm", icon: "leaf" }
];

export default function MotivationStyleScreen({
  onContinue,
  onBack,
  currentStep,
  totalSteps
}: MotivationStyleScreenProps) {
  // Get initial value from store (persisted)
  const storedStyle = useOnboardingStore((state) => state.motivation_style);
  const [selectedStyle, setSelectedStyle] = useState<"supportive" | "tough_love" | "calm" | "">(
    storedStyle
  );

  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { brandColors } = useTheme();

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
      buttonText={t("onboarding.motivation_style.continue")}
    >
      <View style={styles.content}>
        <Text style={styles.title}>{t("onboarding.motivation_style.title")}</Text>
        <Text style={styles.subtitle}>{t("onboarding.motivation_style.subtitle")}</Text>

        <View style={styles.optionsContainer}>
          {MOTIVATION_OPTIONS.map((option) => {
            const isSelected = selectedStyle === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                onPress={() => setSelectedStyle(option.value)}
                activeOpacity={0.7}
                style={[
                  styles.optionCard,
                  isSelected && [styles.optionCardSelected, { borderColor: brandColors.primary }]
                ]}
              >
                <View
                  style={[
                    styles.iconContainer,
                    isSelected && { backgroundColor: brandColors.primary + "15" }
                  ]}
                >
                  <Ionicons
                    name={option.icon}
                    size={28}
                    color={isSelected ? brandColors.primary : styles.iconColor.color}
                  />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionTitle, isSelected && { color: brandColors.primary }]}>
                    {t(`onboarding.motivation_style.${option.key}.title`)}
                  </Text>
                  <Text style={styles.optionDescription}>
                    {t(`onboarding.motivation_style.${option.key}.description`)}
                  </Text>
                </View>
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
      paddingTop: toRN(tokens.spacing[4])
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
      backgroundColor: colors.bg.card,
      borderRadius: toRN(tokens.borderRadius.xl),
      padding: toRN(tokens.spacing[4]),
      borderWidth: 2,
      borderColor: colors.border.subtle,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: toRN(tokens.spacing[4])
    },
    optionCardSelected: {
      backgroundColor: brand.primary + "08"
    },
    iconContainer: {
      width: 52,
      height: 52,
      borderRadius: toRN(tokens.borderRadius.xl),
      backgroundColor: colors.bg.subtle,
      alignItems: "center" as const,
      justifyContent: "center" as const
    },
    iconColor: {
      color: colors.text.secondary
    },
    optionTextContainer: {
      flex: 1
    },
    optionTitle: {
      fontSize: toRN(tokens.typography.fontSize.lg),
      fontWeight: tokens.typography.fontWeight.semibold,
      color: colors.text.primary,
      fontFamily: fontFamily.groteskSemiBold,
      marginBottom: toRN(tokens.spacing[1])
    },
    optionDescription: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.text.secondary,
      fontFamily: fontFamily.groteskRegular,
      lineHeight: lineHeight(tokens.typography.fontSize.sm, tokens.typography.lineHeight.relaxed)
    }
  };
};
