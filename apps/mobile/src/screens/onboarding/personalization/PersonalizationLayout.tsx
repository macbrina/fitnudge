import { ArrowBackIcon } from "@/components/icons/arrow-back-icon";
import Button from "@/components/ui/Button";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { MOBILE_ROUTES } from "@/lib/routes";
import { toRN } from "@/lib/units";
import { useTheme } from "@/themes";
import { useStyles } from "@/themes/makeStyles";
import { router } from "expo-router";
import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface PersonalizationLayoutProps {
  children: React.ReactNode;
  currentStep: number;
  totalSteps: number;
  onContinue: () => void;
  onBack?: () => void;
  canContinue: boolean;
  isLoading?: boolean;
  buttonText?: string;
}

export default function PersonalizationLayout({
  children,
  currentStep,
  totalSteps,
  onContinue,
  onBack,
  canContinue,
  isLoading = false,
  buttonText,
}: PersonalizationLayoutProps) {
  const { t } = useTranslation();
  const styles = useStyles(makePersonalizationLayoutStyles);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const progressPercentage = (currentStep / totalSteps) * 100;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {currentStep > 1 && onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <ArrowBackIcon size={24} color={colors.text.primary} />
          </TouchableOpacity>
        )}

        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            {t("onboarding.personalization.step", {
              current: currentStep,
              total: totalSteps,
            })}
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${progressPercentage}%` }]}
            />
          </View>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          title={
            isLoading
              ? t("onboarding.personalization.submitting")
              : buttonText || t("onboarding.personalization.continue")
          }
          onPress={onContinue}
          disabled={!canContinue || isLoading}
          loading={isLoading}
        />
      </View>
    </View>
  );
}

const makePersonalizationLayoutStyles = (
  tokens: any,
  colors: any,
  brand: any
) => {
  return {
    container: {
      flex: 1,
      backgroundColor: colors.bg.canvas,
    },
    header: {
      paddingHorizontal: toRN(tokens.spacing[6]),
      paddingBottom: toRN(tokens.spacing[5]),
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.bg.muted,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginBottom: toRN(tokens.spacing[4]),
    },
    progressContainer: {
      alignItems: "center" as const,
      width: "100%",
    },
    progressText: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.text.secondary,
      marginBottom: toRN(tokens.spacing[3]),
      fontFamily: fontFamily.groteskMedium,
      letterSpacing: 0.3,
    },
    progressBar: {
      width: "100%",
      height: 6,
      backgroundColor: colors.bg.secondary,
      borderRadius: 3,
      overflow: "hidden" as const,
      shadowColor: colors.shadow.default,
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    progressFill: {
      height: "100%",
      backgroundColor: brand.primary,
      borderRadius: 3,
      shadowColor: brand.primary,
      shadowOffset: {
        width: 0,
        height: 0,
      },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 2,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      flexGrow: 1,
      paddingHorizontal: toRN(tokens.spacing[6]),
    },
    footer: {
      paddingHorizontal: toRN(tokens.spacing[6]),
    },
    continueButton: {
      backgroundColor: brand.primary,
      borderRadius: toRN(tokens.borderRadius.lg),
      paddingVertical: toRN(tokens.spacing[4]),
      alignItems: "center" as const,
    },
    continueButtonDisabled: {
      backgroundColor: colors.bg.muted,
    },
    continueButtonText: {
      fontSize: toRN(tokens.typography.fontSize.lg),
      fontWeight: tokens.typography.fontWeight.semibold,
      color: colors.text.inverse,
      fontFamily: fontFamily.groteskSemiBold,
    },
    continueButtonTextDisabled: {
      color: colors.text.tertiary,
    },
  };
};
