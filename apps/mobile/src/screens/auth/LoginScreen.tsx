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
} from "react-native";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/lib/i18n";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { useStyles } from "@/themes/makeStyles";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Button from "@/components/ui/Button";
import TextInput from "@/components/ui/TextInput";
import Checkbox from "@/components/ui/Checkbox";
import SocialSignInContainer from "@/components/ui/SocialSignInContainer";
import BackButton from "@/components/ui/BackButton";
import { router } from "expo-router";
import { tokens } from "@/themes/tokens";
import { useTheme } from "@/themes";
import { MOBILE_ROUTES } from "@/lib/routes";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const { login, setLoading, isLoading } = useAuthStore();
  const { t } = useTranslation();
  const styles = useStyles(makeLoginScreenStyles);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t("common.error"), t("errors.validation_error"));
      return;
    }

    setLoading(true);
    try {
      // TODO: Implement actual API call
      // For now, simulate login
      const mockUser = {
        id: "1",
        email,
        name: "John Doe",
        username: "johndoe",
        plan: "free",
        email_verified: true,
        auth_provider: "email",
        created_at: new Date().toISOString(),
      };

      const mockTokens = {
        accessToken: "mock-access-token",
        refreshToken: "mock-refresh-token",
      };

      login(mockUser, mockTokens.accessToken, mockTokens.refreshToken);
    } catch (error) {
      Alert.alert(t("common.error"), t("errors.authentication_error"));
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
            <Text style={styles.title}>Sign in your Account</Text>
            <Text style={styles.subtitle}>
              One app for every step: browse, compare, buy, track, and repeat
              with ease.
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

            {/* Remember me and Forgot password */}
            <View style={styles.optionsContainer}>
              <View style={styles.rememberMeContainer}>
                <Checkbox
                  checked={rememberMe}
                  onPress={() => setRememberMe(!rememberMe)}
                  label="Remember me"
                />
              </View>
              <Button
                title="Forgot password?"
                onPress={() => {}}
                variant="text"
                size="sm"
                style={styles.forgotPasswordContainer}
              />
            </View>

            {/* Sign In Button */}
            <Button
              title={isLoading ? "Signing in..." : "Sign in"}
              onPress={handleLogin}
              size="lg"
              disabled={isLoading}
              // style={styles.signInButton}
            />

            {/* Sign Up Link */}
            <View style={styles.signupContainer}>
              <Button
                title="Don't have an account? Sign up"
                onPress={() => router.push(MOBILE_ROUTES.AUTH.SIGNUP)}
                variant="text"
                size="sm"
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
const makeLoginScreenStyles = (tokens: any, colors: any, brand: any) => {
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
    optionsContainer: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      marginBottom: toRN(tokens.spacing[6]),
      paddingHorizontal: toRN(tokens.spacing[2]),
    },
    rememberMeContainer: {
      flex: 1,
      flexShrink: 1,
    },
    forgotPasswordContainer: {
      flexShrink: 0,
      paddingLeft: toRN(tokens.spacing[2]),
    },
    signInButton: {
      backgroundColor: brand.primary,
      borderRadius: toRN(tokens.borderRadius.lg),
      paddingVertical: toRN(tokens.spacing[4]),
      marginBottom: toRN(tokens.spacing[8]),
    },
    signupContainer: {
      alignItems: "center" as const,
      marginBottom: toRN(tokens.spacing[8]),
      marginTop: toRN(tokens.spacing[4]),
    },
  };
};
