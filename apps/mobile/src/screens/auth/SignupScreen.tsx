import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Linking,
} from "react-native";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/lib/i18n";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { useStyles } from "@/themes/makeStyles";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Button from "@/components/ui/Button";
import TextInput from "@/components/ui/TextInput";
import SocialSignInContainer from "@/components/ui/SocialSignInContainer";
import BackButton from "@/components/ui/BackButton";
import { router } from "expo-router";
import { tokens } from "@/themes/tokens";
import { useTheme } from "@/themes";
import { MOBILE_ROUTES } from "@/lib/routes";

export default function SignupScreen() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, setLoading, isLoading } = useAuthStore();
  const { t } = useTranslation();
  const styles = useStyles(makeSignupScreenStyles);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const handleSignup = async () => {
    if (!username || !email || !password) {
      Alert.alert(t("common.error"), t("errors.validation_error"));
      return;
    }

    setLoading(true);
    try {
      // TODO: Implement actual API call
      // For now, simulate signup
      const mockUser = {
        id: "1",
        email,
        name: username, // Use username as name for now
        username,
        plan: "free",
        email_verified: false,
        auth_provider: "email",
        created_at: new Date().toISOString(),
      };

      const mockTokens = {
        accessToken: "mock-access-token",
        refreshToken: "mock-refresh-token",
      };

      login(mockUser, mockTokens.accessToken, mockTokens.refreshToken);
    } catch (error) {
      Alert.alert(t("common.error"), t("errors.registration_error"));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    // TODO: Implement Google sign-in
    console.log("Google sign-in pressed");
  };

  const handleAppleSignIn = () => {
    // TODO: Implement Apple sign-in
    console.log("Apple sign-in pressed");
  };

  const handleTermsPress = () => {
    Linking.openURL("https://fitnudge.app/terms-of-service");
  };

  const handlePrivacyPress = () => {
    Linking.openURL("https://fitnudge.com/privacy-policy");
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header with back button */}
          <BackButton onPress={() => router.back()} />

          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image
              source={require("@assetsimages/favicon.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          {/* Title and Subtitle */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Create your Account</Text>
            <Text style={styles.subtitle}>
              Join FitNudge and start your fitness journey with personalized AI
              coaching
            </Text>
          </View>

          {/* Social Sign In Buttons */}
          <SocialSignInContainer
            onGooglePress={handleGoogleSignIn}
            onApplePress={handleAppleSignIn}
          />

          {/* Form */}
          <View style={styles.form}>
            <TextInput
              label="Username"
              placeholder="Enter your username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              label="Email"
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              showPasswordToggle
              autoCapitalize="none"
            />

            {/* Sign Up Button */}
            <Button
              title={isLoading ? "Creating account..." : "Create account"}
              onPress={handleSignup}
              disabled={isLoading}
            />

            {/* Terms */}
            <View style={styles.termsContainer}>
              <Text style={styles.termsText}>
                By creating an account you acknowledge and agree to FitNudge{" "}
                <Text style={styles.linkText} onPress={handleTermsPress}>
                  Terms of Use
                </Text>
                {" and "}
                <Text style={styles.linkText} onPress={handlePrivacyPress}>
                  Privacy Policy
                </Text>
              </Text>
            </View>

            {/* Login Link */}
            <Button
              title="Already have an account? Sign in"
              onPress={() => router.push(MOBILE_ROUTES.AUTH.LOGIN)}
              variant="text"
              size="sm"
              style={{
                ...styles.loginLinkContainer,
                paddingBottom: insets.bottom + 20,
              }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeSignupScreenStyles = (tokens: any, colors: any, brand: any) => {
  return {
    container: {
      flex: 1,
      backgroundColor: colors.bg.canvas,
    },
    logoContainer: {
      alignItems: "center" as const,
      marginBottom: toRN(tokens.spacing[8]),
    },
    logoImage: {
      width: 100,
      height: 100,
    },
    titleContainer: {
      alignItems: "center" as const,
      marginBottom: toRN(tokens.spacing[8]),
      paddingHorizontal: toRN(tokens.spacing[6]),
    },
    title: {
      fontSize: toRN(tokens.typography.fontSize["3xl"]),
      fontWeight: tokens.typography.fontWeight.bold,
      color: colors.text.primary,
      textAlign: "center" as const,
      marginBottom: toRN(tokens.spacing[3]),
      fontFamily: fontFamily.groteskBold,
    },
    subtitle: {
      fontSize: toRN(tokens.typography.fontSize.base),
      color: colors.text.secondary,
      textAlign: "center" as const,
      lineHeight: toRN(tokens.typography.lineHeight.relaxed),
      fontFamily: fontFamily.groteskRegular,
    },
    form: {
      paddingHorizontal: toRN(tokens.spacing[6]),
      flex: 1,
    },
    signUpButton: {
      backgroundColor: brand.primary,
      borderRadius: toRN(tokens.borderRadius.lg),
      paddingVertical: toRN(tokens.spacing[4]),
      marginBottom: toRN(tokens.spacing[6]),
    },
    loginLinkContainer: {
      alignItems: "center" as const,
      marginBottom: toRN(tokens.spacing[2]),
      marginTop: toRN(tokens.spacing[4]),
    },
    loginLinkText: {
      fontSize: toRN(tokens.typography.fontSize.base),
      color: colors.text.secondary,
      fontFamily: fontFamily.groteskRegular,
    },
    loginLink: {
      color: brand.primary,
      fontFamily: fontFamily.groteskMedium,
    },
    termsContainer: {
      alignItems: "center" as const,
      marginTop: toRN(tokens.spacing[4]),
      paddingHorizontal: toRN(tokens.spacing[4]),
    },
    termsText: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.text.secondary,
      textAlign: "center" as const,
      fontFamily: fontFamily.groteskRegular,
      // lineHeight: toRN(tokens.typography.lineHeight.relaxed),
    },
    linkText: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: brand.primary,
      fontFamily: fontFamily.groteskMedium,
      textDecorationLine: "underline" as const,
    },
  };
};
