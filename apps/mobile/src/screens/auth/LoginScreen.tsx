import React, { useState, useEffect } from "react";
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
import Checkbox from "@/components/ui/Checkbox";
import SocialSignInContainer from "@/components/ui/SocialSignInContainer";
import BackButton from "@/components/ui/BackButton";
import { router } from "expo-router";
import { tokens, lineHeight } from "@/themes/tokens";
import { useTheme } from "@/themes";
import { MOBILE_ROUTES } from "@/lib/routes";
import { useLogin } from "@/hooks/api/useAuth";
import { authService } from "@/services/api";
import { usePostHog } from "@/hooks/usePostHog";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  const { login } = useAuthStore();
  const { t } = useTranslation();
  const styles = useStyles(makeLoginScreenStyles);
  const insets = useSafeAreaInsets();
  const { capture } = usePostHog();

  // Use the login mutation hook
  const loginMutation = useLogin();

  // Load remember me preferences on component mount
  useEffect(() => {
    const loadRememberMePreference = async () => {
      try {
        const preference = await authService.getRememberMePreference();
        if (preference?.enabled && preference?.email) {
          setEmail(preference.email);
          setRememberMe(true);
        }
      } catch (error) {
        console.log("Could not load remember me preference:", error);
      }
    };

    loadRememberMePreference();
  }, []);

  // Validation functions
  const validateForm = () => {
    const newErrors: typeof errors = {};

    // Email validation
    if (!email.trim()) {
      newErrors.email = t("errors.email_required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = t("errors.email_invalid");
    }

    // Password validation
    if (!password) {
      newErrors.password = t("errors.password_required");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    // Clear previous errors
    setErrors({});

    // Validate form
    if (!validateForm()) {
      return;
    }

    // Call the API
    loginMutation.mutate(
      {
        email: email.trim().toLowerCase(),
        password,
        remember_me: rememberMe,
      },
      {
        onSuccess: async (response) => {
          if (response.data) {
            // Login the user with the returned data
            await login(
              response.data.user,
              response.data.access_token,
              response.data.refresh_token
            );

            // Handle remember me functionality
            if (rememberMe) {
              // Store remember me preference for future logins
              await authService.setRememberMePreference(
                response.data.user.email,
                true
              );
              console.log(
                "Remember me enabled for user:",
                response.data.user.email
              );
            } else {
              // Clear remember me preference if unchecked
              await authService.setRememberMePreference(
                response.data.user.email,
                false
              );
            }

            // Track successful login
            capture("user_logged_in", {
              method: "email",
              remember_me: rememberMe,
              user_id: response.data.user.id,
            });

            // Navigate to main app
            router.replace(MOBILE_ROUTES.MAIN.HOME);
          }
        },
        onError: (error: any) => {
          console.error("Login error:", error);

          const errorStatus = error?.response?.status;
          const errorData = error?.response?.data || error?.data || {};
          const statusDetail = errorData.detail || errorData;
          const userStatus = statusDetail?.status || errorData?.status;

          // Track failed login
          capture("user_login_failed", {
            method: "email",
            error_type:
              errorStatus === 401
                ? "invalid_credentials"
                : errorStatus === 403 && userStatus
                  ? `account_${userStatus}`
                  : "unknown",
            error_message:
              statusDetail?.error ||
              statusDetail?.message ||
              statusDetail ||
              "Unknown error",
          });

          // Handle status-specific errors (403 Forbidden)
          if (errorStatus === 403 && userStatus) {
            const statusMessages: Record<string, string> = {
              disabled:
                "Your account has been disabled. Please contact support.",
              suspended:
                "Your account has been suspended. Please contact support.",
            };
            const message =
              statusMessages[userStatus] ||
              statusDetail?.error ||
              "Your account cannot be accessed. Please contact support.";

            Alert.alert(t("common.error"), message);

            // Auto-logout if status is disabled or suspended
            if (userStatus === "disabled" || userStatus === "suspended") {
              setTimeout(async () => {
                const { handleAutoLogout } = await import("@/utils/authUtils");
                await handleAutoLogout(userStatus as "disabled" | "suspended");
              }, 1000);
            }
          } else if (errorStatus === 401) {
            // User not found or invalid credentials
            Alert.alert(t("common.error"), t("errors.authentication_error"));
          } else if (errorStatus === 400) {
            Alert.alert(
              t("common.error"),
              statusDetail?.detail ||
                statusDetail?.error ||
                t("errors.authentication_error")
            );
          } else {
            Alert.alert(t("common.error"), t("errors.authentication_error"));
          }
        },
      }
    );
  };

  const handleGoogleSignIn = () => {
    // Track Google sign-in attempt
    capture("user_login_attempt", {
      method: "google",
    });

    // TODO: Implement Google sign-in
    // This would integrate with Google Sign-In SDK
    Alert.alert(t("common.info"), "Google Sign-In will be available soon!");
  };

  const handleAppleSignIn = () => {
    // Track Apple sign-in attempt
    capture("user_login_attempt", {
      method: "apple",
    });

    // TODO: Implement Apple sign-in
    // This would integrate with Apple Sign-In SDK
    Alert.alert(t("common.info"), "Apple Sign-In will be available soon!");
  };

  const handleForgotPassword = () => {
    router.push(MOBILE_ROUTES.AUTH.FORGOT_PASSWORD);
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
            <Text style={styles.title}>{t("auth.login.title")}</Text>
            <Text style={styles.subtitle}>{t("auth.login.subtitle")}</Text>
          </View>

          {/* Social Sign In Buttons */}
          <SocialSignInContainer
            onGooglePress={handleGoogleSignIn}
            onApplePress={handleAppleSignIn}
          />

          {/* Form */}
          <View style={styles.form}>
            <TextInput
              label={t("auth.login.email_label")}
              placeholder={t("auth.login.email_placeholder")}
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
              label={t("auth.login.password_label")}
              placeholder={t("auth.login.password_placeholder")}
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

            {/* Remember me and Forgot password */}
            <View style={styles.optionsContainer}>
              <View style={styles.rememberMeContainer}>
                <Checkbox
                  checked={rememberMe}
                  onPress={() => setRememberMe(!rememberMe)}
                  label={t("auth.login.remember_me")}
                />
              </View>
              <Button
                title={t("auth.login.forgot_password")}
                onPress={handleForgotPassword}
                variant="text"
                size="sm"
                style={styles.forgotPasswordContainer}
              />
            </View>

            {/* Sign In Button */}
            <Button
              title={
                loginMutation.isPending
                  ? t("auth.login.signing_in")
                  : t("auth.login.sign_in")
              }
              onPress={handleLogin}
              size="lg"
              disabled={loginMutation.isPending}
              // style={styles.signInButton}
            />

            {/* Sign Up Link */}
            <View style={styles.signupContainer}>
              <Button
                title={t("auth.login.no_account")}
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
