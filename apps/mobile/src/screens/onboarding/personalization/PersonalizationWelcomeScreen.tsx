import { Ionicons } from "@expo/vector-icons";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { toRN } from "@/lib/units";
import { useStyles } from "@/themes/makeStyles";
import { lineHeight } from "@/themes/tokens";
import { useTheme } from "@/themes";
import { Image, Text, View } from "react-native";
import PersonalizationLayout from "./PersonalizationLayout";

interface PersonalizationWelcomeScreenProps {
  onContinue: () => void;
  currentStep: number;
  totalSteps: number;
}

const BENEFITS = [
  {
    icon: "flag-outline" as const,
    labelKey: "onboarding.personalization.welcome.benefit_goals"
  },
  {
    icon: "sparkles-outline" as const,
    labelKey: "onboarding.personalization.welcome.benefit_ai"
  },
  {
    icon: "trending-up-outline" as const,
    labelKey: "onboarding.personalization.welcome.benefit_tracking"
  }
];

export default function PersonalizationWelcomeScreen({
  onContinue,
  currentStep,
  totalSteps
}: PersonalizationWelcomeScreenProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { brandColors } = useTheme();

  return (
    <PersonalizationLayout
      currentStep={currentStep}
      totalSteps={totalSteps}
      onContinue={onContinue}
      canContinue={true}
      buttonText={t("onboarding.personalization.get_started")}
    >
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoWrapper}>
            <Image
              source={require("@assetsimages/favicon.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>{t("onboarding.personalization.welcome.title")}</Text>

        <Text style={styles.subtitle}>{t("onboarding.personalization.welcome.subtitle")}</Text>

        {/* Benefits */}
        <View style={styles.benefitsContainer}>
          {BENEFITS.map((benefit, index) => (
            <View key={index} style={styles.benefitRow}>
              <View style={styles.benefitIconContainer}>
                <Ionicons name={benefit.icon} size={24} color={brandColors.primary} />
              </View>
              <Text style={styles.benefitText}>{t(benefit.labelKey)}</Text>
            </View>
          ))}
        </View>
      </View>
    </PersonalizationLayout>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => {
  return {
    content: {
      flex: 1,
      alignItems: "center" as const,
      paddingTop: toRN(tokens.spacing[8])
    },
    logoContainer: {
      marginBottom: toRN(tokens.spacing[8])
    },
    logoWrapper: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.bg.surface,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      shadowColor: colors.shadow.default,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4
    },
    logo: {
      width: 64,
      height: 64
    },
    title: {
      fontSize: toRN(tokens.typography.fontSize["3xl"]),
      fontWeight: tokens.typography.fontWeight.bold,
      color: colors.text.primary,
      textAlign: "center" as const,
      marginBottom: toRN(tokens.spacing[3]),
      fontFamily: fontFamily.groteskBold,
      lineHeight: lineHeight(tokens.typography.fontSize["3xl"], tokens.typography.lineHeight.tight)
    },
    subtitle: {
      fontSize: toRN(tokens.typography.fontSize.base),
      color: colors.text.secondary,
      textAlign: "center" as const,
      marginBottom: toRN(tokens.spacing[8]),
      fontFamily: fontFamily.groteskRegular,
      lineHeight: lineHeight(tokens.typography.fontSize.base, tokens.typography.lineHeight.relaxed),
      paddingHorizontal: toRN(tokens.spacing[4])
    },
    benefitsContainer: {
      width: "100%",
      gap: toRN(tokens.spacing[4])
    },
    benefitRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: colors.bg.surface,
      borderRadius: toRN(tokens.borderRadius.xl),
      paddingVertical: toRN(tokens.spacing[4]),
      paddingHorizontal: toRN(tokens.spacing[4])
    },
    benefitIconContainer: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: brand.primary + "10",
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginRight: toRN(tokens.spacing[3])
    },
    benefitText: {
      flex: 1,
      fontSize: toRN(tokens.typography.fontSize.base),
      color: colors.text.primary,
      fontFamily: fontFamily.groteskMedium,
      lineHeight: lineHeight(tokens.typography.fontSize.base, tokens.typography.lineHeight.relaxed)
    }
  };
};
