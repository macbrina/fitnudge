import { ArrowBackIcon } from "@/components/icons/arrow-back-icon";
import Button from "@/components/ui/Button";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { toRN } from "@/lib/units";
import { useTheme } from "@/themes";
import { useStyles } from "@/themes/makeStyles";
import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

interface PersonalizationLayoutProps {
  children: React.ReactNode;
  currentStep: number;
  totalSteps: number;
  onContinue: () => void;
  onBack?: () => void;
  canContinue: boolean;
  isLoading?: boolean;
  buttonText?: string;
  title?: string;
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
  title
}: PersonalizationLayoutProps) {
  const { t } = useTranslation();
  const styles = useStyles(makePersonalizationLayoutStyles);
  const { colors, brandColors } = useTheme();

  // Generate segments for progress bar
  const segments = Array.from({ length: totalSteps }, (_, i) => i + 1);

  return (
    <View style={styles.container}>
      {/* Header with title and segmented progress */}
      <View style={styles.header}>
        {title && <Text style={styles.headerTitle}>{title}</Text>}

        {/* Segmented Progress Bar */}
        <View style={styles.progressContainer}>
          {segments.map((step, index) => (
            <View
              key={step}
              style={[
                styles.progressSegment,
                step <= currentStep && styles.progressSegmentActive,
                index === 0 && styles.progressSegmentFirst,
                index === segments.length - 1 && styles.progressSegmentLast
              ]}
            />
          ))}
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

      {/* Footer with back button and continue button */}
      <View style={styles.footer}>
        {currentStep > 1 && onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <ArrowBackIcon size={20} color={brandColors.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backButtonPlaceholder} />
        )}

        <View style={styles.continueButtonContainer}>
          <Button
            title={buttonText || t("onboarding.personalization.continue")}
            onPress={onContinue}
            disabled={!canContinue || isLoading}
            loading={isLoading}
          />
        </View>
      </View>
    </View>
  );
}

const makePersonalizationLayoutStyles = (tokens: any, colors: any, brand: any) => {
  return {
    container: {
      flex: 1,
      backgroundColor: colors.bg.canvas
    },
    header: {
      paddingHorizontal: toRN(tokens.spacing[6]),
      paddingTop: toRN(tokens.spacing[2]),
      paddingBottom: toRN(tokens.spacing[4])
    },
    headerTitle: {
      fontSize: toRN(tokens.typography.fontSize.base),
      color: colors.text.secondary,
      fontFamily: fontFamily.groteskMedium,
      textAlign: "center" as const,
      marginBottom: toRN(tokens.spacing[3])
    },
    progressContainer: {
      flexDirection: "row" as const,
      gap: toRN(tokens.spacing[1]),
      width: "100%"
    },
    progressSegment: {
      flex: 1,
      height: 4,
      backgroundColor: colors.bg.secondary
    },
    progressSegmentActive: {
      backgroundColor: brand.primary
    },
    progressSegmentFirst: {
      borderTopLeftRadius: 2,
      borderBottomLeftRadius: 2
    },
    progressSegmentLast: {
      borderTopRightRadius: 2,
      borderBottomRightRadius: 2
    },
    content: {
      flex: 1
    },
    contentContainer: {
      flexGrow: 1,
      paddingHorizontal: toRN(tokens.spacing[6])
    },
    footer: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingHorizontal: toRN(tokens.spacing[6]),
      paddingBottom: toRN(tokens.spacing[4]),
      gap: toRN(tokens.spacing[3])
    },
    backButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.bg.muted,
      alignItems: "center" as const,
      justifyContent: "center" as const
    },
    backButtonPlaceholder: {
      width: 0
    },
    continueButtonContainer: {
      flex: 1
    }
  };
};
