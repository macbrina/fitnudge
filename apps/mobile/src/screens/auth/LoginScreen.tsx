import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import SocialSignInContainer from "@/components/ui/SocialSignInContainer";
import TextInput from "@/components/ui/TextInput";
import { useLogin } from "@/hooks/api/useAuth";
import { usePostHog } from "@/hooks/usePostHog";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { MOBILE_ROUTES } from "@/lib/routes";
import { toRN } from "@/lib/units";
import { authService } from "@/services/api";
import { getApiErrorDetails } from "@/services/api/errors";
import { useAuthStore } from "@/stores/authStore";
import { useStyles } from "@/themes/makeStyles";
import { lineHeight } from "@/themes/tokens";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getRedirection } from "@/utils/getRedirection";
import { useAlertModal } from "@/contexts/AlertModalContext";
import {
  performNativeGoogleSignIn,
  getFriendlyGoogleError,
  hasGoogleSignInConfiguration,
  isGoogleCancelledError,
} from "@/lib/auth/google";
import {
  performNativeAppleSignIn,
  isAppleSigninAvailable,
  isAppleCancelledError,
} from "@/lib/auth/apple";
import type { LoginResponse } from "@/services/api/auth";
import { logger } from "@/services/logger";

export default function LoginScreen() {
  const params = useLocalSearchParams<{ alertMessage?: string }>();
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
  const { showAlert } = useAlertModal();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [alertHandled, setAlertHandled] = useState(false);
  const [initialAlertShown, setInitialAlertShown] = useState(false);

  const showGoogle = hasGoogleSignInConfiguration();
  const showApple = Platform.OS === "ios" && appleAvailable;

  useEffect(() => {
    let isMounted = true;

    if (Platform.OS === "ios") {
      isAppleSigninAvailable()
        .then((available) => {
          if (isMounted) {
            setAppleAvailable(available);
          }
        })
        .catch(() => {
          if (isMounted) {
            setAppleAvailable(false);
          }
        });
    }

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSocialSuccess = async (
    payload: LoginResponse,
    provider: "google" | "apple"
  ) => {
    await login(payload.user, payload.access_token, payload.refresh_token);

    capture("user_logged_in", {
      method: provider,
      user_id: payload.user.id,
    });

    try {
      const destination = await getRedirection();
      router.replace(destination);
    } catch (redirectError) {
      console.warn("[Login] Failed to compute redirection", redirectError);
      router.replace(MOBILE_ROUTES.MAIN.HOME);
    }
  };

  const handleSocialError = async (message: string) => {
    await showAlert({
      title: t("common.error"),
      message,
      variant: "error",
    });
  };
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

  useEffect(() => {
    let isMounted = true;
    const alertMessage = Array.isArray(params.alertMessage)
      ? params.alertMessage[0]
      : params.alertMessage;

    const maybeShowAlert = async () => {
      if (!initialAlertShown && alertMessage) {
        await showAlert({
          title: t("common.error"),
          message: alertMessage,
          variant: "error",
        });
        if (!isMounted) {
          return;
        }
        setInitialAlertShown(true);
      }
    };

    maybeShowAlert();

    return () => {
      isMounted = false;
    };
  }, [params.alertMessage, initialAlertShown, showAlert, t, router]);

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
          console.log("response", response);
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

            try {
              const destination = await getRedirection();
              router.replace(destination);
            } catch (redirectError) {
              router.replace(MOBILE_ROUTES.MAIN.HOME);
            }
          }
        },
        onError: async (error: unknown) => {
          console.error("Login error:", error);

          const {
            status: errorStatus,
            dataRecord,
            detailRecord,
            detailString,
            backendMessage,
          } = getApiErrorDetails(error);

          const userStatus =
            (detailRecord?.status as string | undefined) ||
            (dataRecord?.status as string | undefined);

          // Track failed login
          logger.error("user_login_failed", {
            method: "email",
            error_type:
              errorStatus === 401
                ? "invalid_credentials"
                : errorStatus === 403 && userStatus
                  ? `account_${userStatus}`
                  : "unknown",
            error_message: backendMessage || detailString || "Unknown error",
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
              backendMessage ||
              detailString ||
              "Your account cannot be accessed. Please contact support.";

            await showAlert({
              title: t("common.error"),
              message,
              variant: "error",
            });

            // Auto-logout if status is disabled or suspended
            if (userStatus === "disabled" || userStatus === "suspended") {
              setTimeout(async () => {
                const { handleAutoLogout } = await import("@/utils/authUtils");
                await handleAutoLogout(userStatus as "disabled" | "suspended");
              }, 1000);
            }
          } else if (errorStatus === 401) {
            // User not found or invalid credentials
            await showAlert({
              title: t("common.error"),
              message: t("errors.authentication_error"),
              variant: "error",
            });
          } else if (errorStatus === 400) {
            await showAlert({
              title: t("common.error"),
              message:
                detailString ||
                (detailRecord?.detail as string | undefined) ||
                (detailRecord?.error as string | undefined) ||
                backendMessage ||
                t("errors.authentication_error"),
              variant: "error",
            });
          } else {
            await showAlert({
              title: t("common.error"),
              message: backendMessage || t("errors.authentication_error"),
              variant: "error",
            });
          }
        },
      }
    );
  };

  const handleGoogleSignIn = async () => {
    if (!showGoogle) {
      await handleSocialError(
        t("errors.authentication_error") ||
          "Google Sign-In is not configured for this build."
      );
      return;
    }

    try {
      setIsGoogleLoading(true);
      const { idToken } = await performNativeGoogleSignIn();

      const response = await authService.loginWithGoogle(idToken);

      if (response.data) {
        await handleSocialSuccess(response.data, "google");
      } else {
        await handleSocialError(
          response.error || t("errors.authentication_error")
        );
      }
    } catch (error) {
      if (isGoogleCancelledError(error)) {
        return;
      }

      console.error("Google sign-in failed:", error);
      void handleSocialError(getFriendlyGoogleError(error));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    if (!showApple) {
      await handleSocialError(
        "Sign in with Apple is not available on this device."
      );
      return;
    }

    capture("user_login_attempt", {
      method: "apple",
    });

    try {
      setIsAppleLoading(true);
      const credential = await performNativeAppleSignIn();

      if (!credential.identityToken) {
        await handleSocialError(t("errors.authentication_error"));
        return;
      }

      if (!credential.authorizationCode) {
        await handleSocialError(t("errors.authentication_error"));
        return;
      }

      const response = await authService.loginWithApple({
        identityToken: credential.identityToken,
        authorizationCode: credential.authorizationCode,
        email: credential.email ?? undefined,
        fullName: credential.fullName
          ? {
              givenName: credential.fullName.givenName ?? undefined,
              familyName: credential.fullName.familyName ?? undefined,
            }
          : undefined,
      });

      if (response.data) {
        await handleSocialSuccess(response.data, "apple");
      } else {
        await handleSocialError(
          response.error || t("errors.authentication_error")
        );
      }
    } catch (error: any) {
      if (isAppleCancelledError(error)) {
        return;
      }

      console.error("Apple sign-in failed:", error);
      await handleSocialError(t("errors.authentication_error"));
    } finally {
      setIsAppleLoading(false);
    }
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
            showGoogle={showGoogle}
            showApple={showApple}
            onGooglePress={handleGoogleSignIn}
            onApplePress={handleAppleSignIn}
            googleDisabled={!showGoogle || isGoogleLoading}
            googleLoading={isGoogleLoading}
            appleDisabled={!showApple || isAppleLoading}
            appleLoading={isAppleLoading}
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
              loading={loginMutation.isPending}
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
