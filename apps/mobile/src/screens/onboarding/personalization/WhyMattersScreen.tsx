import React, { useState } from "react";
import { View, Text } from "react-native";
import { useTranslation } from "@/lib/i18n";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { useStyles } from "@/themes/makeStyles";
import { lineHeight } from "@/themes/tokens";
import PersonalizationLayout from "./PersonalizationLayout";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { TextInput } from "@/components/ui/TextInput";

interface WhyMattersScreenProps {
  onContinue: (why: string) => void;
  onSkip: () => void;
  onBack?: () => void;
  currentStep: number;
  totalSteps: number;
  isLoading?: boolean;
}

export default function WhyMattersScreen({
  onContinue,
  onSkip,
  onBack,
  currentStep,
  totalSteps,
  isLoading = false
}: WhyMattersScreenProps) {
  // Get initial value from store (persisted)
  const storedWhy = useOnboardingStore((state) => state.goal_why);
  const [why, setWhy] = useState<string>(storedWhy);

  const { t } = useTranslation();
  const styles = useStyles(makeStyles);

  const hasInput = why.trim().length > 0;

  const handleContinue = () => {
    if (hasInput) {
      onContinue(why.trim());
    } else {
      onSkip();
    }
  };

  return (
    <PersonalizationLayout
      currentStep={currentStep}
      totalSteps={totalSteps}
      onContinue={handleContinue}
      onBack={onBack}
      canContinue={true}
      isLoading={isLoading}
      buttonText={hasInput ? t("common.continue") : t("onboarding.why_matters.skip")}
    >
      <View style={styles.content}>
        <Text style={styles.title}>{t("onboarding.why_matters.title")}</Text>
        <Text style={styles.subtitle}>{t("onboarding.why_matters.subtitle")}</Text>

        <TextInput
          placeholder={t("onboarding.why_matters.placeholder")}
          value={why}
          onChangeText={setWhy}
          multiline
          numberOfLines={4}
          autoCapitalize="sentences"
          containerStyle={styles.inputContainer}
        />
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
    inputContainer: {
      marginBottom: 0
    }
  };
};
