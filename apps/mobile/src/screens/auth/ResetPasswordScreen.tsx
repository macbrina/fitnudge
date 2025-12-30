import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { useTranslation } from "@/lib/i18n";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { useStyles } from "@/themes/makeStyles";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Button from "@/components/ui/Button";
import TextInput from "@/components/ui/TextInput";
import { router, useLocalSearchParams } from "expo-router";
import { tokens, lineHeight } from "@/themes/tokens";
import { MOBILE_ROUTES } from "@/lib/routes";
import { useResetPassword } from "@/hooks/api/useAuth";
import { authService } from "@/services/api";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { useAuthStore } from "@/stores/authStore";
import { getRedirection } from "@/utils/getRedirection";
import LoadingContainer from "@/components/common/LoadingContainer";

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const initialToken = useMemo(() => params.token || "", [params.token]);
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{
    password?: string;
    confirmPassword?: string;
  }>({});
  const [validationState, setValidationState] = useState<
    "checking" | "valid" | "invalid"
  >(initialToken ? "checking" : "invalid");
  const [validationMessage, setValidationMessage] = useState<string | null>(
    initialToken ? null : null,
  );

  const { t } = useTranslation();
  const styles = useStyles(makeResetPasswordScreenStyles);
  const insets = useSafeAreaInsets();
  const resetPasswordMutation = useResetPassword();
  const { showAlert } = useAlertModal();
  const { isAuthenticated } = useAuthStore();

  const redirectToLoginWithMessage = useCallback(
    (message: string) => {
      router.replace({
        pathname: MOBILE_ROUTES.AUTH.LOGIN,
        params: { alertMessage: message },
      });
    },
    [router],
  );

  useEffect(() => {
    let isMounted = true;

    const handleAuthenticatedRedirect = async () => {
      try {
        const destination = await getRedirection();
        if (isMounted) {
          router.replace(destination);
        }
      } catch (error) {
        console.warn(
          "[ResetPassword] Failed to compute authenticated redirect",
          error,
        );
        if (isMounted) {
          router.replace(MOBILE_ROUTES.MAIN.HOME);
        }
      }
    };

    if (isAuthenticated) {
      handleAuthenticatedRedirect();
    }

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    setToken(initialToken);
    if (initialToken) {
      setValidationState("checking");
      setValidationMessage(null);
    } else {
      setValidationState("invalid");
      setValidationMessage(t("auth.reset_password.error_invalid_token"));
    }
  }, [initialToken, t]);

  useEffect(() => {
    let isMounted = true;

    const validate = async () => {
      if (isAuthenticated) {
        return;
      }

      if (!token) {
        if (!isMounted) return;
        const message = t("auth.reset_password.error_invalid_token");
        setValidationState("invalid");
        setValidationMessage(message);
        redirectToLoginWithMessage(message);
        return;
      }

      setValidationState("checking");
      setValidationMessage(null);

      try {
        const response = await authService.validateResetToken(token);

        if (!isMounted) return;

        if (response.status >= 200 && response.status < 300) {
          setValidationState("valid");
          setValidationMessage(null);
        } else {
          const message =
            response.error || t("auth.reset_password.error_token_expired");
          setValidationState("invalid");
          setValidationMessage(message);
          redirectToLoginWithMessage(message);
        }
      } catch (error) {
        if (!isMounted) return;
        const message = t("auth.reset_password.error_token_expired");
        setValidationState("invalid");
        setValidationMessage(message);
        redirectToLoginWithMessage(message);
      }
    };

    if (token) {
      validate();
    }

    return () => {
      isMounted = false;
    };
  }, [token, t, redirectToLoginWithMessage]);

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!password) {
      newErrors.password = t("errors.password_required");
    } else if (password.length < 8) {
      newErrors.password = t("errors.password_too_short");
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      newErrors.password = t("errors.password_weak");
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = t(
        "auth.reset_password.confirm_password_required",
      );
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = t("auth.reset_password.passwords_dont_match");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    setErrors({});

    if (!validateForm()) {
      return;
    }

    if (validationState !== "valid") {
      showAlert({
        title: t("common.error"),
        message:
          validationMessage || t("auth.reset_password.error_token_expired"),
        variant: "error",
      });
      return;
    }

    resetPasswordMutation.mutate(
      {
        token: token.trim(),
        new_password: password,
      },
      {
        onSuccess: async () => {
          const confirmed = await showAlert({
            title: t("auth.reset_password.success_title"),
            message: t("auth.reset_password.success_message"),
            confirmLabel: t("common.done"),
            dismissible: false,
            variant: "success",
          });

          if (confirmed) {
            router.replace(MOBILE_ROUTES.AUTH.LOGIN);
          }
        },
        onError: async (error: any) => {
          const errorMessage =
            error?.error ||
            error?.response?.data?.detail ||
            error?.message ||
            t("auth.reset_password.error_reset_failed");

          if (errorMessage.includes("expired")) {
            await showAlert({
              title: t("common.error"),
              message: t("auth.reset_password.error_token_expired"),
              variant: "error",
            });
            const message = t("auth.reset_password.error_token_expired");
            setValidationState("invalid");
            setValidationMessage(message);
            redirectToLoginWithMessage(message);
          } else if (errorMessage.includes("Invalid")) {
            await showAlert({
              title: t("common.error"),
              message: t("auth.reset_password.error_invalid_token"),
              variant: "error",
            });
            const message = t("auth.reset_password.error_invalid_token");
            setValidationState("invalid");
            setValidationMessage(message);
            redirectToLoginWithMessage(message);
          } else {
            await showAlert({
              title: t("common.error"),
              message: errorMessage,
              variant: "error",
            });
          }
        },
      },
    );
  };

  if (validationState === "checking" || isAuthenticated) {
    return (
      <LoadingContainer
        visible
        text={t("auth.reset_password.validating_link")}
      />
    );
  }

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
            <Text style={styles.title}>{t("auth.reset_password.title")}</Text>
            <Text style={styles.subtitle}>
              {t("auth.reset_password.subtitle")}
            </Text>
            {validationState === "invalid" && (
              <Text style={styles.validationMessage}>
                {t(`${validationMessage}`) ||
                  t("auth.reset_password.error_token_expired")}
              </Text>
            )}
          </View>

          {/* Form */}
          <View style={styles.form}>
            <TextInput
              label={t("auth.reset_password.password_label")}
              placeholder={t("auth.reset_password.password_placeholder")}
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
              disabled={validationState !== "valid"}
            />

            <TextInput
              label={t("auth.reset_password.confirm_password_label")}
              placeholder={t(
                "auth.reset_password.confirm_password_placeholder",
              )}
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (errors.confirmPassword) {
                  setErrors((prev) => ({
                    ...prev,
                    confirmPassword: undefined,
                  }));
                }
              }}
              secureTextEntry
              showPasswordToggle
              autoCapitalize="none"
              error={errors.confirmPassword}
              disabled={validationState !== "valid"}
            />

            {/* Submit Button */}
            <Button
              title={
                resetPasswordMutation.isPending
                  ? t("auth.reset_password.resetting")
                  : t("auth.reset_password.reset_password")
              }
              onPress={handleSubmit}
              disabled={
                resetPasswordMutation.isPending || validationState !== "valid"
              }
              loading={resetPasswordMutation.isPending}
            />

            {/* Back to Login */}
            <View style={styles.backToLoginContainer}>
              <Button
                title={t("auth.reset_password.back_to_login")}
                onPress={() => router.replace(MOBILE_ROUTES.AUTH.LOGIN)}
                variant="text"
                size="sm"
              />
            </View>

            {validationState === "invalid" && (
              <View style={styles.validationMessageContainer}>
                <Button
                  title={t("auth.reset_password.request_new_link")}
                  onPress={() =>
                    router.replace(MOBILE_ROUTES.AUTH.FORGOT_PASSWORD)
                  }
                  variant="text"
                  size="sm"
                />
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeResetPasswordScreenStyles = (
  tokens: any,
  colors: any,
  brand: any,
) => {
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
        tokens.typography.lineHeight.relaxed,
      ),
      fontFamily: fontFamily.groteskRegular,
    },
    form: {
      paddingHorizontal: toRN(tokens.spacing[6]),
      flex: 1,
    },
    backToLoginContainer: {
      alignItems: "center" as const,
      marginTop: toRN(tokens.spacing[6]),
    },
    validationStateContainer: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      marginBottom: toRN(tokens.spacing[4]),
    },
    validationStateText: {
      color: colors.text.secondary,
      fontFamily: fontFamily.groteskRegular,
      marginLeft: toRN(tokens.spacing[2]),
    },
    validationMessageContainer: {
      alignItems: "center" as const,
    },
    validationMessage: {
      color: colors.feedback.error,
      textAlign: "center" as const,
      fontFamily: fontFamily.groteskRegular,
      fontSize: toRN(tokens.typography.fontSize.sm),
      marginBottom: toRN(tokens.spacing[2]),
    },
  };
};
