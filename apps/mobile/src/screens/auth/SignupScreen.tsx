import React, { useEffect, useState } from "react";
import {
  View,
  Text,
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
import LinkText from "@/components/ui/LinkText";
import { router, useLocalSearchParams } from "expo-router";
import { tokens, lineHeight } from "@/themes/tokens";
import { useTheme } from "@/themes";
import { MOBILE_ROUTES } from "@/lib/routes";
import { useSignup } from "@/hooks/api/useAuth";
import { getRedirection } from "@/utils/getRedirection";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { authService, type LoginResponse } from "@/services/api/auth";
import { getApiErrorDetails } from "@/services/api/errors";
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

export default function SignupScreen() {
  // Get query params from deep links
  const params = useLocalSearchParams<{
    referral?: string;
    redirectTo?: string;
  }>();

  // Extract referral param (handle array case from expo-router)
  const referral = Array.isArray(params.referral)
    ? params.referral[0]
    : params.referral;

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [showReferralInput, setShowReferralInput] = useState(false);
  const [errors, setErrors] = useState<{
    username?: string;
    email?: string;
    password?: string;
    referralCode?: string;
  }>({});

  const { login } = useAuthStore();
  const { t } = useTranslation();
  const styles = useStyles(makeSignupScreenStyles);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { showAlert } = useAlertModal();

  // Use the signup mutation hook
  const signupMutation = useSignup();

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  const showGoogle = hasGoogleSignInConfiguration();
  const showApple = Platform.OS === "ios" && appleAvailable;

  // Fetch subscription data after login (non-blocking)
  const fetchSubscriptionData = async () => {
    try {
      const [{ useSubscriptionStore }, { usePricingStore }] = await Promise.all(
        [import("@/stores/subscriptionStore"), import("@/stores/pricingStore")]
      );

      // Fetch subscription, features, and pricing plans in parallel
      await Promise.all([
        useSubscriptionStore.getState().fetchSubscription(),
        useSubscriptionStore.getState().fetchFeatures(),
        usePricingStore.getState().fetchPlans(),
      ]);
    } catch (error) {
      console.warn("[Signup] Failed to fetch subscription data:", error);
    }
  };

  // Check if user has fitness profile (for personalization skip)
  const checkFitnessProfile = async (): Promise<boolean> => {
    try {
      const { useOnboardingStore } = await import("@/stores/onboardingStore");
      return await useOnboardingStore.getState().checkHasFitnessProfile();
    } catch (error) {
      console.warn("[Signup] Failed to check fitness profile:", error);
      return false;
    }
  };

  // Sync referral code from URL params
  useEffect(() => {
    if (referral) {
      setReferralCode(referral);
      setShowReferralInput(true);
    }
  }, [referral]);

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

  const handleSocialSuccess = async (payload: LoginResponse) => {
    await login(payload.user, payload.access_token, payload.refresh_token);

    // Fetch subscription data immediately after login (non-blocking for navigation)
    fetchSubscriptionData();

    try {
      // Check if user has fitness profile (skip personalization if they do - e.g., existing user via OAuth)
      const hasFitnessProfile = await checkFitnessProfile();
      const destination = await getRedirection({ hasFitnessProfile });
      router.replace(destination);
    } catch (redirectError) {
      console.warn("[Signup] Failed to compute redirection", redirectError);
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
        referral_code: referralCode.trim() || undefined,
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

            // Fetch subscription data immediately after login (non-blocking for navigation)
            fetchSubscriptionData();

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
              try {
                // Check if user has fitness profile (skip personalization if they do)
                const hasFitnessProfile = await checkFitnessProfile();
                const destination = await getRedirection({ hasFitnessProfile });
                router.replace(destination);
              } catch (redirectError) {
                console.warn(
                  "[Signup] Failed to compute redirection",
                  redirectError
                );
                router.replace(MOBILE_ROUTES.MAIN.HOME);
              }
            }
          }
        },
        onError: async (error: unknown) => {
          console.error("Signup error:", error);

          const {
            status: errorStatus,
            dataRecord,
            detailRecord,
            detailString,
            backendMessage,
          } = getApiErrorDetails(error);

          // Handle specific error cases
          if (errorStatus === 400) {
            const messageSource =
              backendMessage ||
              detailString ||
              (detailRecord?.detail as string | undefined) ||
              (dataRecord?.detail as string | undefined) ||
              "";
            const hint = messageSource.toLowerCase();

            if (hint.includes("email")) {
              setErrors({ email: t("errors.email_already_exists") });
            } else if (hint.includes("username")) {
              setErrors({ username: t("errors.username_already_taken") });
            } else {
              await showAlert({
                title: t("common.error"),
                message: backendMessage || t("errors.registration_error"),
                variant: "error",
              });
            }
          } else {
            await showAlert({
              title: t("common.error"),
              message: backendMessage || t("errors.registration_error"),
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

      // Pass referral code if available
      const response = await authService.loginWithGoogle(
        idToken,
        referralCode.trim() || undefined
      );

      if (response.data) {
        await handleSocialSuccess(response.data);
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
      // Trigger alert asynchronously so loading state can reset immediately
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

      // Pass referral code if available
      const response = await authService.loginWithApple(
        {
          identityToken: credential.identityToken,
          authorizationCode: credential.authorizationCode,
          email: credential.email ?? undefined,
          fullName: credential.fullName
            ? {
                givenName: credential.fullName.givenName ?? undefined,
                familyName: credential.fullName.familyName ?? undefined,
              }
            : undefined,
        },
        referralCode.trim() || undefined
      );

      if (response.data) {
        await handleSocialSuccess(response.data);
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
            <Text style={styles.title}>{t("auth.signup.title")}</Text>
            <Text style={styles.subtitle}>{t("auth.signup.subtitle")}</Text>
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

            {/* Referral Code Input - Collapsible */}
            {showReferralInput ? (
              <TextInput
                label={t("auth.signup.referral_code_label")}
                placeholder={t("auth.signup.referral_code_placeholder")}
                value={referralCode}
                onChangeText={(text) => {
                  setReferralCode(text.toUpperCase());
                  if (errors.referralCode) {
                    setErrors((prev) => ({ ...prev, referralCode: undefined }));
                  }
                }}
                autoCapitalize="characters"
                autoCorrect={false}
                error={errors.referralCode}
              />
            ) : (
              <Button
                title={t("auth.signup.have_referral_code")}
                onPress={() => setShowReferralInput(true)}
                variant="text"
                size="sm"
                style={styles.referralToggle}
              />
            )}

            {/* Sign Up Button */}
            <Button
              title={
                signupMutation.isPending
                  ? t("auth.signup.creating_account")
                  : t("auth.signup.create_account")
              }
              onPress={handleSignup}
              disabled={signupMutation.isPending}
              loading={signupMutation.isPending}
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
                  url="https://fitnudge.app/privacy-policy"
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
    referralToggle: {
      alignSelf: "flex-start" as const,
      marginBottom: toRN(tokens.spacing[2]),
    },
    loginLinkContainer: {
      alignItems: "center" as const,
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
