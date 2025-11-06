import React, { useState } from "react";
import {
  View,
  Text,
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
import SocialSignInContainer from "@/components/ui/SocialSignInContainer";
import BackButton from "@/components/ui/BackButton";
import LinkText from "@/components/ui/LinkText";
import { router } from "expo-router";
import { tokens, lineHeight } from "@/themes/tokens";
import { useTheme } from "@/themes";
import { MOBILE_ROUTES } from "@/lib/routes";
import { useSignup } from "@/hooks/api/useAuth";

export default function SignupScreen() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{
    username?: string;
    email?: string;
    password?: string;
  }>({});

  const { login } = useAuthStore();
  const { t } = useTranslation();
  const styles = useStyles(makeSignupScreenStyles);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  // Use the signup mutation hook
  const signupMutation = useSignup();

  // Validation functions
  const validateForm = () => {
    const newErrors: typeof errors = {};

    // Username validation
    if (!username.trim()) {
      newErrors.username = t("errors.username_required");
    } else if (username.length < 3) {
      newErrors.username = t("errors.username_too_short");
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      newErrors.username = t("errors.username_invalid");
    }

    // Email validation
    if (!email.trim()) {
      newErrors.email = t("errors.email_required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = t("errors.email_invalid");
    }

    // Password validation
    if (!password) {
      newErrors.password = t("errors.password_required");
    } else if (password.length < 8) {
      newErrors.password = t("errors.password_too_short");
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      newErrors.password = t("errors.password_weak");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async () => {
    // Clear previous errors
    setErrors({});

    // Validate form
    if (!validateForm()) {
      return;
    }

    // Call the API
    signupMutation.mutate(
      {
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password,
      },
      {
        onSuccess: async (response) => {
          console.log("Signup success:", response);
          if (response.data) {
            // Login the user with the returned data
            await login(
              response.data.user,
              response.data.access_token,
              response.data.refresh_token
            );

            // Check if email verification is required
            const user = response.data.user;
            if (
              user &&
              !user.email_verified &&
              user.auth_provider === "email"
            ) {
              // Redirect to email verification screen
              router.replace(MOBILE_ROUTES.AUTH.VERIFY_EMAIL);
            } else {
              // Navigate to onboarding flow
              router.replace(MOBILE_ROUTES.ONBOARDING.NOTIFICATION_PERMISSION);
            }
          }
        },
        onError: (error: any) => {
          console.error("Signup error:", error);

          // Handle specific error cases
          if (error?.response?.status === 400) {
            const errorData = error.response.data;
            if (errorData?.detail?.includes("email")) {
              setErrors({ email: t("errors.email_already_exists") });
            } else if (errorData?.detail?.includes("username")) {
              setErrors({ username: t("errors.username_already_taken") });
            } else {
              Alert.alert(
                t("common.error"),
                errorData?.detail || t("errors.registration_error")
              );
            }
          } else {
            Alert.alert(t("common.error"), t("errors.registration_error"));
          }
        },
      }
    );
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
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header with back button */}
          {/* <BackButton onPress={() => router.back()} /> */}

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
            <Text style={styles.title}>{t("auth.signup.title")}</Text>
            <Text style={styles.subtitle}>{t("auth.signup.subtitle")}</Text>
          </View>

          {/* Social Sign In Buttons */}
          <SocialSignInContainer
            onGooglePress={handleGoogleSignIn}
            onApplePress={handleAppleSignIn}
          />

          {/* Form */}
          <View style={styles.form}>
            <TextInput
              label={t("auth.signup.username_label")}
              placeholder={t("auth.signup.username_placeholder")}
              value={username}
              onChangeText={(text) => {
                setUsername(text);
                if (errors.username) {
                  setErrors((prev) => ({ ...prev, username: undefined }));
                }
              }}
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.username}
            />

            <TextInput
              label={t("auth.signup.email_label")}
              placeholder={t("auth.signup.email_placeholder")}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) {
                  setErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.email}
            />

            <TextInput
              label={t("auth.signup.password_label")}
              placeholder={t("auth.signup.password_placeholder")}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password) {
                  setErrors((prev) => ({ ...prev, password: undefined }));
                }
              }}
              secureTextEntry
              showPasswordToggle
              autoCapitalize="none"
              error={errors.password}
            />

            {/* Sign Up Button */}
            <Button
              title={
                signupMutation.isPending
                  ? t("auth.signup.creating_account")
                  : t("auth.signup.create_account")
              }
              onPress={handleSignup}
              disabled={signupMutation.isPending}
            />

            {/* Terms */}
            <View style={styles.termsContainer}>
              <Text style={styles.termsText}>
                {t("auth.signup.terms_text")}{" "}
                <LinkText
                  url="https://fitnudge.app/terms-of-service"
                  title={t("auth.signup.terms_of_use")}
                  style={styles.linkText}
                >
                  {t("auth.signup.terms_of_use")}
                </LinkText>
                {" and "}
                <LinkText
                  url="https://fitnudge.com/privacy-policy"
                  title={t("auth.signup.privacy_policy")}
                  style={styles.linkText}
                >
                  {t("auth.signup.privacy_policy")}
                </LinkText>
              </Text>
            </View>

            {/* Login Link */}
            <Button
              title={t("auth.signup.already_have_account")}
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
      lineHeight: lineHeight(
        tokens.typography.fontSize.base,
        tokens.typography.lineHeight.relaxed
      ),
      fontFamily: fontFamily.groteskRegular,
    },
    form: {
      paddingHorizontal: toRN(tokens.spacing[6]),
      flex: 1,
    },

    loginLinkContainer: {
      alignItems: "center" as const,
      // marginBottom: toRN(tokens.spacing[2]),
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
      lineHeight: lineHeight(
        tokens.typography.fontSize.sm,
        tokens.typography.lineHeight.relaxed
      ),
    },
    linkText: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: brand.primary,
      fontFamily: fontFamily.groteskMedium,
      textDecorationLine: "underline" as const,
    },
  };
};
