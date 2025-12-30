import React, { useState } from "react";
import {
  View,
  Text,
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
import { router } from "expo-router";
import { tokens, lineHeight } from "@/themes/tokens";
import { MOBILE_ROUTES } from "@/lib/routes";
import { useChangePassword } from "@/hooks/api/useAuth";
import { useAlertModal } from "@/contexts/AlertModalContext";

export default function ChangePasswordScreen() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  const { t } = useTranslation();
  const styles = useStyles(makeChangePasswordScreenStyles);
  const insets = useSafeAreaInsets();
  const changePasswordMutation = useChangePassword();
  const { showAlert, showToast } = useAlertModal();

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!currentPassword) {
      newErrors.currentPassword = t(
        "auth.change_password.current_password_required",
      );
    }

    if (!newPassword) {
      newErrors.newPassword = t("errors.password_required");
    } else if (newPassword.length < 8) {
      newErrors.newPassword = t("errors.password_too_short");
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      newErrors.newPassword = t("errors.password_weak");
    } else if (currentPassword && newPassword === currentPassword) {
      newErrors.newPassword = t("auth.change_password.new_password_same");
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = t(
        "auth.change_password.confirm_password_required",
      );
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = t(
        "auth.change_password.passwords_dont_match",
      );
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    setErrors({});

    if (!validateForm()) {
      return;
    }

    changePasswordMutation.mutate(
      {
        current_password: currentPassword,
        new_password: newPassword,
      },
      {
        onSuccess: async () => {
          showToast({
            title: t("auth.change_password.success_title"),
            message: t("auth.change_password.success_message"),
            variant: "success",
            duration: 2000,
          });
          setTimeout(() => router.back(), 500);
        },
        onError: async (error: any) => {
          console.error("Change password error:", error);
          const errorMessage =
            error?.error ||
            error?.response?.data?.detail ||
            error?.message ||
            t("auth.change_password.error_change_failed");

          if (errorMessage.includes("incorrect")) {
            setErrors((prev) => ({
              ...prev,
              currentPassword: t(
                "auth.change_password.error_incorrect_password",
              ),
            }));
          } else {
            await showAlert({
              title: t("common.error"),
              message: errorMessage,
              variant: "error",
              confirmLabel: t("common.ok"),
            });
          }
        },
      },
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
            <Text style={styles.title}>{t("auth.change_password.title")}</Text>
            <Text style={styles.subtitle}>
              {t("auth.change_password.subtitle")}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <TextInput
              label={t("auth.change_password.current_password_label")}
              placeholder={t(
                "auth.change_password.current_password_placeholder",
              )}
              value={currentPassword}
              onChangeText={(text) => {
                setCurrentPassword(text);
                if (errors.currentPassword) {
                  setErrors((prev) => ({
                    ...prev,
                    currentPassword: undefined,
                  }));
                }
              }}
              secureTextEntry
              showPasswordToggle
              autoCapitalize="none"
              error={errors.currentPassword}
            />

            <TextInput
              label={t("auth.change_password.new_password_label")}
              placeholder={t("auth.change_password.new_password_placeholder")}
              value={newPassword}
              onChangeText={(text) => {
                setNewPassword(text);
                if (errors.newPassword) {
                  setErrors((prev) => ({ ...prev, newPassword: undefined }));
                }
              }}
              secureTextEntry
              showPasswordToggle
              autoCapitalize="none"
              error={errors.newPassword}
            />

            <TextInput
              label={t("auth.change_password.confirm_password_label")}
              placeholder={t(
                "auth.change_password.confirm_password_placeholder",
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
                changePasswordMutation.isPending
                  ? t("auth.change_password.changing")
                  : t("auth.change_password.change_password")
              }
              onPress={handleSubmit}
              disabled={changePasswordMutation.isPending}
              loading={changePasswordMutation.isPending}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeChangePasswordScreenStyles = (
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
  };
};
