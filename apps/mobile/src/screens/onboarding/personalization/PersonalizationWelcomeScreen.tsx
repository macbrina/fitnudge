import React from "react";
import { View, Text, Image } from "react-native";
import { useTranslation } from "@/lib/i18n";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { useStyles } from "@/themes/makeStyles";
import { tokens, lineHeight } from "@/themes/tokens";
import { useTheme } from "@/themes";
import PersonalizationLayout from "./PersonalizationLayout";

interface PersonalizationWelcomeScreenProps {
  onContinue: () => void;
}

export default function PersonalizationWelcomeScreen({
  onContinue,
}: PersonalizationWelcomeScreenProps) {
  const { t } = useTranslation();
  const styles = useStyles(makePersonalizationWelcomeScreenStyles);
  const { colors } = useTheme();

  return (
    <PersonalizationLayout
      currentStep={1}
      totalSteps={8}
      onContinue={onContinue}
      canContinue={true}
    >
      <View style={styles.content}>
        {/* Hero Icon with Gradient Background */}
        <View style={styles.iconContainer}>
          <View style={styles.iconWrapper}>
            <Image
              source={require("@assetsimages/favicon.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>
            {t("onboarding.personalization.welcome.title")}
          </Text>

          <Text style={styles.subtitle}>
            {t("onboarding.personalization.welcome.subtitle")}
          </Text>
        </View>

        {/* Benefits Cards */}
        <View style={styles.benefitsContainer}>
          <View style={styles.benefitCard}>
            <View style={styles.benefitIconContainer}>
              <Text style={styles.benefitIcon}>🎯</Text>
            </View>
            <Text style={styles.benefitText}>
              {t("onboarding.personalization.welcome.benefit_goals")}
            </Text>
          </View>
          <View style={styles.benefitCard}>
            <View style={styles.benefitIconContainer}>
              <Text style={styles.benefitIcon}>🤖</Text>
            </View>
            <Text style={styles.benefitText}>
              {t("onboarding.personalization.welcome.benefit_ai")}
            </Text>
          </View>
          <View style={styles.benefitCard}>
            <View style={styles.benefitIconContainer}>
              <Text style={styles.benefitIcon}>📊</Text>
            </View>
            <Text style={styles.benefitText}>
              {t("onboarding.personalization.welcome.benefit_tracking")}
            </Text>
          </View>
        </View>
      </View>
    </PersonalizationLayout>
  );
}

const makePersonalizationWelcomeScreenStyles = (
  tokens: any,
  colors: any,
  brand: any
) => {
  return {
    content: {
      flex: 1,
      alignItems: "center" as const,
      justifyContent: "flex-start" as const,
      paddingTop: toRN(tokens.spacing[8]),
      paddingBottom: toRN(tokens.spacing[6]),
    },
    iconContainer: {
      marginBottom: toRN(tokens.spacing[10]),
      alignItems: "center" as const,
    },
    iconWrapper: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.bg.surface,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      shadowColor: colors.shadow.default,
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
    },
    logo: {
      width: 80,
      height: 80,
    },
    titleSection: {
      alignItems: "center" as const,
      marginBottom: toRN(tokens.spacing[10]),
      paddingHorizontal: toRN(tokens.spacing[4]),
    },
    title: {
      fontSize: toRN(tokens.typography.fontSize["4xl"]),
      fontWeight: tokens.typography.fontWeight.bold,
      color: colors.text.primary,
      textAlign: "center" as const,
      marginBottom: toRN(tokens.spacing[4]),
      fontFamily: fontFamily.groteskBold,
      lineHeight: lineHeight(
        tokens.typography.fontSize["4xl"],
        tokens.typography.lineHeight.tight
      ),
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: toRN(tokens.typography.fontSize.base),
      color: colors.text.secondary,
      textAlign: "center" as const,
      fontFamily: fontFamily.groteskRegular,
      lineHeight: lineHeight(
        tokens.typography.fontSize.base,
        tokens.typography.lineHeight.relaxed
      ),
      paddingHorizontal: toRN(tokens.spacing[2]),
    },
    benefitsContainer: {
      width: "100%",
      // maxWidth: 340,
      gap: toRN(tokens.spacing[4]),
    },
    benefitCard: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: colors.bg.surface,
      // paddingVertical: toRN(tokens.spacing[4]),
      paddingHorizontal: toRN(tokens.spacing[5]),
      borderRadius: toRN(tokens.borderRadius.lg),
      shadowColor: colors.shadow.default,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
      // borderWidth: 1,
      // borderColor: colors.border.default,
    },
    benefitIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.bg.muted,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginRight: toRN(tokens.spacing[4]),
    },
    benefitIcon: {
      fontSize: 24,
    },
    benefitText: {
      fontSize: toRN(tokens.typography.fontSize.base),
      color: colors.text.primary,
      flex: 1,
      fontFamily: fontFamily.groteskMedium,
      lineHeight: lineHeight(
        tokens.typography.fontSize.base,
        tokens.typography.lineHeight.relaxed
      ),
    },
  };
};
