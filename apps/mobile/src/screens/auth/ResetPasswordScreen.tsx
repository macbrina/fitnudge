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

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(params.token || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{
    token?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const { t } = useTranslation();
  const styles = useStyles(makeResetPasswordScreenStyles);
  const insets = useSafeAreaInsets();
  const resetPasswordMutation = useResetPassword();

  useEffect(() => {
    if (params.token) {
      setToken(params.token);
    }
  }, [params.token]);

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!token.trim()) {
      newErrors.token = t("auth.reset_password.token_required");
    }

    if (!password) {
      newErrors.password = t("errors.password_required");
    } else if (password.length < 8) {
      newErrors.password = t("errors.password_too_short");
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      newErrors.password = t("errors.password_weak");
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = t(
        "auth.reset_password.confirm_password_required"
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

    resetPasswordMutation.mutate(
      {
        token: token.trim(),
        new_password: password,
      },
      {
        onSuccess: () => {
          Alert.alert(
            t("auth.reset_password.success_title"),
            t("auth.reset_password.success_message"),
            [
              {
                text: t("common.done"),
                onPress: () => router.replace(MOBILE_ROUTES.AUTH.LOGIN),
              },
            ]
          );
        },
        onError: (error: any) => {
          console.error("Reset password error:", error);
          const errorMessage =
            error?.error ||
            error?.response?.data?.detail ||
            error?.message ||
            t("auth.reset_password.error_reset_failed");

          if (errorMessage.includes("expired")) {
            Alert.alert(
              t("common.error"),
              t("auth.reset_password.error_token_expired")
            );
          } else if (errorMessage.includes("Invalid")) {
            Alert.alert(
              t("common.error"),
              t("auth.reset_password.error_invalid_token")
            );
          } else {
            Alert.alert(t("common.error"), errorMessage);
          }
        },
      }
    );
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
            <Text style={styles.title}>{t("auth.reset_password.title")}</Text>
            <Text style={styles.subtitle}>
              {t("auth.reset_password.subtitle")}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <TextInput
              label={t("auth.reset_password.token_label")}
              placeholder={t("auth.reset_password.token_placeholder")}
              value={token}
              onChangeText={(text) => {
                setToken(text);
                if (errors.token) {
                  setErrors((prev) => ({ ...prev, token: undefined }));
                }
              }}
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.token}
            />

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
            />

            <TextInput
              label={t("auth.reset_password.confirm_password_label")}
              placeholder={t(
                "auth.reset_password.confirm_password_placeholder"
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
            />

            {/* Submit Button */}
            <Button
              title={
                resetPasswordMutation.isPending
                  ? t("auth.reset_password.resetting")
                  : t("auth.reset_password.reset_password")
              }
              onPress={handleSubmit}
              disabled={resetPasswordMutation.isPending}
            />

            {/* Back to Login */}
            <View style={styles.backToLoginContainer}>
              <Button
                title={t("auth.reset_password.back_to_login")}
                onPress={() => router.back()}
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

const makeResetPasswordScreenStyles = (
  tokens: any,
  colors: any,
  brand: any
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
        tokens.typography.lineHeight.relaxed
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
  };
};
