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

interface NameScreenProps {
  onContinue: (name: string) => void;
  onBack?: () => void;
  currentStep: number;
  totalSteps: number;
}

export default function NameScreen({
  onContinue,
  onBack,
  currentStep,
  totalSteps
}: NameScreenProps) {
  // Get initial value from store (persisted)
  const storedName = useOnboardingStore((state) => state.name);
  const [name, setName] = useState<string>(storedName);

  const { t } = useTranslation();
  const styles = useStyles(makeStyles);

  const handleContinue = () => {
    if (name.trim()) {
      onContinue(name.trim());
    }
  };

  return (
    <PersonalizationLayout
      currentStep={currentStep}
      totalSteps={totalSteps}
      onContinue={handleContinue}
      onBack={onBack}
      canContinue={name.trim().length >= 2}
      buttonText={t("onboarding.name.continue")}
    >
      <View style={styles.content}>
        <Text style={styles.title}>{t("onboarding.name.title")}</Text>
        <Text style={styles.subtitle}>{t("onboarding.name.subtitle")}</Text>

        <TextInput
          placeholder={t("onboarding.name.placeholder")}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoCorrect={false}
          autoFocus
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
      paddingTop: toRN(tokens.spacing[8])
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
      marginBottom: toRN(tokens.spacing[8]),
      fontFamily: fontFamily.groteskRegular,
      lineHeight: lineHeight(tokens.typography.fontSize.base, tokens.typography.lineHeight.relaxed)
    },
    inputContainer: {
      marginBottom: 0
    }
  };
};
