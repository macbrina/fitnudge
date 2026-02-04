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
import { Image, KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAlertModal } from "@/contexts/AlertModalContext";
import {
  performNativeGoogleSignIn,
  getFriendlyGoogleError,
  hasGoogleSignInConfiguration,
  isGoogleCancelledError
} from "@/lib/auth/google";
import {
  performNativeAppleSignIn,
  isAppleSigninAvailable,
  isAppleCancelledError
} from "@/lib/auth/apple";
import type { LoginResponse } from "@/services/api/auth";
import { ApiError } from "@/services/api/base";
import { logger } from "@/services/logger";
import { getAndClearPendingReferralCode } from "@/utils/referralStorage";

export default function LoginScreen() {
  const params = useLocalSearchParams<{ alertMessage?: string; referral?: string }>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  const { login, updateUser } = useAuthStore();
  const { t } = useTranslation();
  const styles = useStyles(makeLoginScreenStyles);
  const insets = useSafeAreaInsets();
  const { capture } = usePostHog();
  const { showAlert } = useAlertModal();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [initialAlertShown, setInitialAlertShown] = useState(false);
  const [manualLoginAttempt, setManualLoginAttempt] = useState(false);
  const [referralCode, setReferralCode] = useState("");

  const showGoogle = hasGoogleSignInConfiguration();

  // Sync referral code from URL params or install referrer (for social signup creating new accounts)
  useEffect(() => {
    const referral = Array.isArray(params.referral) ? params.referral[0] : params.referral;

    if (referral) {
      setReferralCode(referral);
      return;
    }
    getAndClearPendingReferralCode().then((pending) => {
      if (pending) setReferralCode(pending);
    });
  }, [params.referral]);
  const showApple = Platform.OS === "ios" && appleAvailable;

  // Prefetch all critical data after login
  // Awaited to ensure data is ready before showing home screen
  // Times out after 5 seconds to prevent blocking on slow networks
  const prefetchAfterAuth = async (): Promise<void> => {
    try {
      const [{ initializeAuthenticatedData }, { queryClient }] = await Promise.all([
        import("@/services/prefetch"),
        import("@/lib/queryClient")
      ]);

      // Use the same initialization as app reload for consistency
      // Race against timeout to prevent blocking forever on slow networks
      await Promise.race([
        initializeAuthenticatedData(queryClient),
        new Promise((resolve) => setTimeout(resolve, 5000)) // 5s max wait
      ]);
    } catch (error) {
      console.warn("[Login] Failed to prefetch data:", error);
      // Don't block navigation on prefetch failure
    }
  };

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

  const handleSocialSuccess = async (payload: LoginResponse, provider: "google" | "apple") => {
    await login(payload.user, payload.access_token, payload.refresh_token);
    updateUser(payload.user); // Ensure layout has response user for redirect logic

    capture("user_logged_in", {
      method: provider,
      user_id: payload.user.id
    });

    // Prefetch in background; layout handles redirect when isAuthenticated updates
    prefetchAfterAuth().catch((e) => console.warn("[Login] Prefetch failed:", e));
  };

  const handleSocialError = async (message: string) => {
    await showAlert({
      title: t("common.error"),
      message,
      variant: "error"
    });
  };
  // Use the login mutation hook
  const loginMutation = useLogin();

  // Combined loading state - disable all inputs when any auth is in progress
  const isAuthLoading =
    loginMutation.isPending || isGoogleLoading || isAppleLoading || manualLoginAttempt;

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
          variant: "error"
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

    setManualLoginAttempt(true);

    // Call the API
    loginMutation.mutate(
      {
        email: email.trim().toLowerCase(),
        password,
        remember_me: rememberMe
      },
      {
        onSuccess: async (response) => {
          if (response.data) {
            // Login the user with the returned data (layout handles redirect)
            await login(
              response.data.user,
              response.data.access_token,
              response.data.refresh_token
            );
            updateUser(response.data.user); // Ensure layout has response user for redirect logic

            // Handle remember me functionality
            if (rememberMe) {
              await authService.setRememberMePreference(response.data.user.email, true);
            } else {
              await authService.setRememberMePreference(response.data.user.email, false);
            }

            // Prefetch in background; layout handles redirect when isAuthenticated updates
            prefetchAfterAuth().catch((e) => console.warn("[Login] Prefetch failed:", e));
          }
        },
        onError: async (error: unknown) => {
          setManualLoginAttempt(false);

          const {
            status: errorStatus,
            dataRecord,
            detailRecord,
            detailString,
            backendMessage
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
            error_message: backendMessage || detailString || "Unknown error"
          });

          // Handle status-specific errors (403 Forbidden)
          if (errorStatus === 403 && userStatus) {
            const statusMessages: Record<string, string> = {
              disabled: "Your account has been disabled. Please contact support.",
              suspended: "Your account has been suspended. Please contact support."
            };
            const message =
              statusMessages[userStatus] ||
              backendMessage ||
              detailString ||
              "Your account cannot be accessed. Please contact support.";

            await showAlert({
              title: t("common.error"),
              message,
              variant: "error"
            });

            // Auto-logout if status is disabled or suspended
            if (userStatus === "disabled" || userStatus === "suspended") {
              setTimeout(async () => {
                const { handleAutoLogout } = await import("@/utils/authUtils");
                await handleAutoLogout(userStatus as "disabled" | "suspended");
              }, 1000);
            }
          } else if (errorStatus === 401) {
            // User not found or invalid credentials - show actual backend message
            await showAlert({
              title: t("common.error"),
              message: backendMessage || t("errors.authentication_error"),
              variant: "error"
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
              variant: "error"
            });
          } else {
            await showAlert({
              title: t("common.error"),
              message: backendMessage || t("errors.authentication_error"),
              variant: "error"
            });
          }
        }
      }
    );
  };

  const handleGoogleSignIn = async () => {
    if (!showGoogle) {
      await handleSocialError(
        t("errors.authentication_error") || "Google Sign-In is not configured for this build."
      );
      return;
    }

    try {
      setIsGoogleLoading(true);
      const { idToken } = await performNativeGoogleSignIn();

      const response = await authService.loginWithGoogle(idToken, referralCode.trim() || undefined);

      if (response.data) {
        await handleSocialSuccess(response.data, "google");
        // Keep loading until redirect (auth layout handles it)
      } else {
        setIsGoogleLoading(false);
        await handleSocialError(response.error || t("errors.authentication_error"));
      }
    } catch (error) {
      setIsGoogleLoading(false);
      if (isGoogleCancelledError(error)) {
        return;
      }

      console.error("Google sign-in failed:", error);

      // Check if it's an API error (from our backend)
      let errorMessage: string;
      if (error instanceof ApiError) {
        errorMessage = error.message;
      } else {
        errorMessage = getFriendlyGoogleError(error);
      }

      void handleSocialError(errorMessage);
    }
  };

  const handleAppleSignIn = async () => {
    if (!showApple) {
      await handleSocialError("Sign in with Apple is not available on this device.");
      return;
    }

    capture("user_login_attempt", {
      method: "apple"
    });

    try {
      setIsAppleLoading(true);
      const credential = await performNativeAppleSignIn();

      if (!credential.identityToken) {
        setIsAppleLoading(false);
        await handleSocialError(t("errors.authentication_error"));
        return;
      }

      if (!credential.authorizationCode) {
        setIsAppleLoading(false);
        await handleSocialError(t("errors.authentication_error"));
        return;
      }

      const response = await authService.loginWithApple(
        {
          identityToken: credential.identityToken,
          authorizationCode: credential.authorizationCode,
          email: credential.email ?? undefined,
          fullName: credential.fullName
            ? {
                givenName: credential.fullName.givenName ?? undefined,
                familyName: credential.fullName.familyName ?? undefined
              }
            : undefined
        },
        referralCode.trim() || undefined
      );

      if (response.data) {
        await handleSocialSuccess(response.data, "apple");
        // Keep loading until redirect (auth layout handles it)
      } else {
        setIsAppleLoading(false);
        await handleSocialError(response.error || t("errors.authentication_error"));
      }
    } catch (error: any) {
      setIsAppleLoading(false);
      if (isAppleCancelledError(error)) {
        return;
      }

      console.error("Apple sign-in failed:", error);

      // Check if it's an API error (from our backend)
      let errorMessage: string;
      if (error instanceof ApiError) {
        errorMessage = error.message;
      } else {
        errorMessage = t("errors.authentication_error");
      }

      await handleSocialError(errorMessage);
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
            paddingBottom: insets.bottom
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
            googleDisabled={!showGoogle || isAuthLoading}
            googleLoading={isGoogleLoading}
            appleDisabled={!showApple || isAuthLoading}
            appleLoading={isAppleLoading}
          />

          {/* Form */}
          <View style={styles.form}>
            <TextInput
              testID="email"
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
              disabled={isAuthLoading}
            />

            <TextInput
              testID="password"
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
              disabled={isAuthLoading}
            />

            {/* Remember me and Forgot password */}
            <View style={styles.optionsContainer}>
              <View style={styles.rememberMeContainer}>
                <Checkbox
                  checked={rememberMe}
                  onPress={() => setRememberMe(!rememberMe)}
                  label={t("auth.login.remember_me")}
                  disabled={isAuthLoading}
                />
              </View>
              <Button
                title={t("auth.login.forgot_password")}
                onPress={handleForgotPassword}
                variant="text"
                size="sm"
                style={styles.forgotPasswordContainer}
                disabled={isAuthLoading}
              />
            </View>

            {/* Sign In Button */}
            <Button
              title={loginMutation.isPending ? t("auth.login.signing_in") : t("auth.login.sign_in")}
              onPress={handleLogin}
              size="lg"
              disabled={isAuthLoading}
              loading={loginMutation.isPending || manualLoginAttempt}
            />

            {/* Sign Up Link */}
            <View style={styles.signupContainer}>
              <Button
                testID="sign-up"
                title={t("auth.login.no_account")}
                onPress={() => router.push(MOBILE_ROUTES.AUTH.SIGNUP)}
                variant="text"
                size="sm"
                disabled={isAuthLoading}
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
      backgroundColor: colors.bg.canvas
    },
    logoContainer: {
      alignItems: "center" as const,
      marginBottom: toRN(tokens.spacing[8])
    },
    logoImage: {
      width: 100,
      height: 100
    },
    titleContainer: {
      alignItems: "center" as const,
      marginBottom: toRN(tokens.spacing[8]),
      paddingHorizontal: toRN(tokens.spacing[6])
    },
    title: {
      fontSize: toRN(tokens.typography.fontSize["3xl"]),
      fontWeight: tokens.typography.fontWeight.bold,
      color: colors.text.primary,
      textAlign: "center" as const,
      marginBottom: toRN(tokens.spacing[3]),
      fontFamily: fontFamily.groteskBold
    },
    subtitle: {
      fontSize: toRN(tokens.typography.fontSize.base),
      color: colors.text.secondary,
      textAlign: "center" as const,
      lineHeight: lineHeight(tokens.typography.fontSize.base, tokens.typography.lineHeight.relaxed),
      fontFamily: fontFamily.groteskRegular
    },
    form: {
      paddingHorizontal: toRN(tokens.spacing[6]),
      flex: 1
    },
    optionsContainer: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      marginBottom: toRN(tokens.spacing[6]),
      paddingHorizontal: toRN(tokens.spacing[2])
    },
    rememberMeContainer: {
      flex: 1,
      flexShrink: 1
    },
    forgotPasswordContainer: {
      flexShrink: 0,
      paddingLeft: toRN(tokens.spacing[2])
    },
    signInButton: {
      backgroundColor: brand.primary,
      borderRadius: toRN(tokens.borderRadius.lg),
      paddingVertical: toRN(tokens.spacing[4]),
      marginBottom: toRN(tokens.spacing[8])
    },
    signupContainer: {
      alignItems: "center" as const,
      marginBottom: toRN(tokens.spacing[8]),
      marginTop: toRN(tokens.spacing[4])
    }
  };
};
