import Button from "@/components/ui/Button";
import TextInput from "@/components/ui/TextInput";
import { useForgotPassword } from "@/hooks/api/useAuth";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { toRN } from "@/lib/units";
import { useStyles } from "@/themes/makeStyles";
import { lineHeight } from "@/themes/tokens";
import { router } from "expo-router";
import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { MOBILE_ROUTES } from "@/lib";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{
    email?: string;
  }>({});

  const { t } = useTranslation();
  const styles = useStyles(makeForgotPasswordScreenStyles);
  const insets = useSafeAreaInsets();
  const forgotPasswordMutation = useForgotPassword();
  const { showAlert } = useAlertModal();

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!email.trim()) {
      newErrors.email = t("errors.email_required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = t("errors.email_invalid");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    setErrors({});

    if (!validateForm()) {
      return;
    }

    forgotPasswordMutation.mutate(
      { email: email.trim().toLowerCase() },
      {
        onSuccess: async () => {
          const confirmed = await showAlert({
            title: t("auth.forgot_password.success_title"),
            message: t("auth.forgot_password.success_message"),
            confirmLabel: t("common.done"),
            dismissible: false,
            variant: "success",
          });

          if (confirmed) {
            router.push(MOBILE_ROUTES.AUTH.LOGIN);
          }
        },
        onError: async (error: any) => {
          console.error("Forgot password error:", error);
          await showAlert({
            title: t("common.error"),
            message:
              error?.error || t("auth.forgot_password.error_send_failed"),
            confirmLabel: t("common.ok"),
            dismissible: true,
            variant: "error",
          });
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
            <Text style={styles.title}>{t("auth.forgot_password.title")}</Text>
            <Text style={styles.subtitle}>
              {t("auth.forgot_password.subtitle")}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <TextInput
              label={t("auth.forgot_password.email_label")}
              placeholder={t("auth.forgot_password.email_placeholder")}
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

            {/* Submit Button */}
            <Button
              title={
                forgotPasswordMutation.isPending
                  ? t("auth.forgot_password.sending")
                  : t("auth.forgot_password.send_reset_link")
              }
              onPress={handleSubmit}
              disabled={forgotPasswordMutation.isPending}
              loading={forgotPasswordMutation.isPending}
            />

            {/* Back to Login */}
            <View style={styles.backToLoginContainer}>
              <Button
                title={t("auth.forgot_password.back_to_login")}
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

const makeForgotPasswordScreenStyles = (
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
