import { DumbellIcon } from "@/components/icons/dumbell-icon";
import { EmailIcon } from "@/components/icons/email-icon";
import { FemaleIcon } from "@/components/icons/female-icon";
import { ShoeIcon } from "@/components/icons/shoe-icon";
import { TabsIcon } from "@/components/icons/tabs-icon";
import { UserPlusIcon } from "@/components/icons/user-plus-icon";
import { WeightIcon } from "@/components/icons/weight-icon";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { MOBILE_ROUTES } from "@/lib/routes";
import { toRN } from "@/lib/units";
import { useStyles } from "@/themes/makeStyles";
import { tokens } from "@/themes/tokens";
import { router } from "expo-router";
import React from "react";
import {
  Dimensions,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const makeAuthScreenStyles = (tokens: any, colors: any, brandColors: any) => {
  return {
    container: {
      flex: 1,
      backgroundColor: brandColors.primary,
    },
    header: {
      flexDirection: "row" as const,
      justifyContent: "space-between",
      alignItems: "center" as const,
      paddingHorizontal: toRN(tokens.spacing[6]),
      paddingTop: toRN(tokens.spacing[4]),
    },
    imageGrid: {
      paddingHorizontal: toRN(tokens.spacing[4]),
      paddingTop: toRN(tokens.spacing[8]),
      paddingBottom: toRN(tokens.spacing[8]),
    },
    imageRow: {
      flexDirection: "row" as const,
      justifyContent: "space-between",
      marginBottom: toRN(tokens.spacing[3]),
    },
    imageContainer: {
      width:
        (screenWidth - toRN(tokens.spacing[8]) - toRN(tokens.spacing[4])) / 3,
      height:
        (screenWidth - toRN(tokens.spacing[8]) - toRN(tokens.spacing[4])) / 3,
      borderRadius: toRN(tokens.borderRadius.lg),
      backgroundColor: "rgba(255, 255, 255, 0.1)",
      justifyContent: "center" as const,
      alignItems: "center" as const,
      overflow: "hidden" as const,
    },
    imagePlaceholder: {
      width: "100%",
      height: "100%",
      backgroundColor: "rgba(255, 255, 255, 0.1)",
    },
    brandingSection: {
      paddingHorizontal: toRN(tokens.spacing[6]),
      paddingVertical: toRN(tokens.spacing[8]),
      alignItems: "center" as const,
    },
    appName: {
      fontSize: toRN(tokens.typography.fontSize["4xl"]),
      fontWeight: tokens.typography.fontWeight.bold,
      color: "#ffffff",
      fontFamily: fontFamily.groteskBold,
      textAlign: "center" as const,
      marginBottom: toRN(tokens.spacing[2]),
    },
    tagline: {
      fontSize: toRN(tokens.typography.fontSize.lg),
      color: "#ffffff",
      fontFamily: fontFamily.groteskRegular,
      textAlign: "center" as const,
      opacity: 0.9,
    },
    buttonsSection: {
      paddingHorizontal: toRN(tokens.spacing[6]),
      paddingBottom: toRN(tokens.spacing[8]),
    },
    button: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingVertical: toRN(tokens.spacing[4]),
      paddingHorizontal: toRN(tokens.spacing[6]),
      borderRadius: toRN(tokens.borderRadius.full),
      marginBottom: toRN(tokens.spacing[4]),
      minHeight: toRN(56),
    },
    emailButton: {
      backgroundColor: "#ffffff",
    },
    signupButton: {
      backgroundColor: "#000000",
      borderWidth: 1,
      borderColor: "#000000",
    },
    buttonText: {
      fontSize: toRN(tokens.typography.fontSize.lg),
      fontWeight: tokens.typography.fontWeight.bold,
      fontFamily: fontFamily.groteskBold,
      marginLeft: toRN(tokens.spacing[3]),
    },
    emailButtonText: {
      color: brandColors.primary,
    },
    signupButtonText: {
      color: "#ffffff",
    },
    iconContainer: {
      width: 24,
      height: 24,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
  };
};

export const AuthScreen: React.FC = () => {
  const { t } = useTranslation();
  const styles = useStyles(makeAuthScreenStyles);
  const insets = useSafeAreaInsets();

  // Define SVG components - set to null for placeholders, or provide SVG components
  const imageSources = [
    DumbellIcon, // SVG Icon
    null, // Placeholder
    ShoeIcon, // SVG Icon
    null, // Placeholder
    WeightIcon, // SVG Icon
    null, // Placeholder
    FemaleIcon, // SVG Icon
    null, // Placeholder
    TabsIcon, // SVG Icon
  ];

  const handleEmailLogin = () => {
    // Navigate to email login
    router.push(MOBILE_ROUTES.AUTH.LOGIN);
  };

  const handleSignup = () => {
    // Navigate to signup
    router.push(MOBILE_ROUTES.AUTH.SIGNUP);
  };

  const renderImagePlaceholder = (
    key: number,
    SvgComponent?: React.ComponentType<any> | null
  ) => (
    <View key={key} style={styles.imageContainer}>
      {SvgComponent ? (
        <SvgComponent
          size={80}
          color="#ffffff"
          style={styles.imagePlaceholder}
        />
      ) : (
        <View style={styles.imagePlaceholder} />
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with top safe area */}
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + toRN(tokens.spacing[4]) },
          ]}
        >
          <View />
        </View>

        {/* Image Grid */}
        <View style={styles.imageGrid}>
          <View style={styles.imageRow}>
            {renderImagePlaceholder(1, imageSources[0])}
            {renderImagePlaceholder(2, imageSources[1])}
            {renderImagePlaceholder(3, imageSources[2])}
          </View>
          <View style={styles.imageRow}>
            {renderImagePlaceholder(4, imageSources[3])}
            {renderImagePlaceholder(5, imageSources[4])}
            {renderImagePlaceholder(6, imageSources[5])}
          </View>
          <View style={styles.imageRow}>
            {renderImagePlaceholder(7, imageSources[6])}
            {renderImagePlaceholder(8, imageSources[7])}
            {renderImagePlaceholder(9, imageSources[8])}
          </View>
        </View>

        {/* Branding Section */}
        <View style={styles.brandingSection}>
          <Text style={styles.appName}>{t("common.app_name")}</Text>
          <Text style={styles.tagline}>{t("auth.main.tagline")}</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonsSection}>
          {/* Email Login Button */}
          <TouchableOpacity
            style={[styles.button, styles.emailButton]}
            onPress={handleEmailLogin}
          >
            <View style={styles.iconContainer}>
              <EmailIcon size={24} color={styles.emailButtonText.color} />
            </View>
            <Text style={[styles.buttonText, styles.emailButtonText]}>
              {t("auth.main.sign_in_now")}
            </Text>
          </TouchableOpacity>

          {/* Sign Up Button */}
          <TouchableOpacity
            style={[styles.button, styles.signupButton]}
            onPress={handleSignup}
          >
            <View style={styles.iconContainer}>
              <UserPlusIcon size={24} color="#ffffff" />
            </View>
            <Text style={[styles.buttonText, styles.signupButtonText]}>
              {t("auth.main.sign_up_now")}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default AuthScreen;
