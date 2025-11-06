import BackButton from "@/components/ui/BackButton";
import Button from "@/components/ui/Button";
import { useResendVerification, useVerifyEmail } from "@/hooks/api/useAuth";
import { usePostHog } from "@/hooks/usePostHog";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { toRN } from "@/lib/units";
import { useAuthStore } from "@/stores/authStore";
import { useStyles } from "@/themes/makeStyles";
import { lineHeight } from "@/themes/tokens";
import { getRedirection } from "@/utils/getRedirection";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const makeVerifyEmailScreenStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
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
  emailText: {
    fontWeight: tokens.typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  form: {
    paddingHorizontal: toRN(tokens.spacing[6]),
    flex: 1,
  },
  codeContainer: {
    marginBottom: toRN(tokens.spacing[6]),
  },
  codeInputContainer: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    gap: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[2]),
  },
  codeInput: {
    flex: 1,
    height: toRN(64),
    borderWidth: 2,
    borderColor: colors.border.default,
    borderRadius: toRN(tokens.borderRadius.lg),
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontWeight: tokens.typography.fontWeight.bold,
    textAlign: "center" as const,
    backgroundColor: colors.bg.card,
    color: colors.text.primary,
    fontFamily: fontFamily.groteskBold,
  },
  codeInputFocused: {
    borderColor: brand.primary,
  },
  codeInputError: {
    borderColor: colors.feedback.error,
  },
  errorText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.feedback.error,
    marginTop: toRN(tokens.spacing[2]),
    fontFamily: fontFamily.groteskRegular,
    textAlign: "center" as const,
  },
  verifyButton: {
    backgroundColor: brand.primary,
    borderRadius: toRN(tokens.borderRadius.lg),
    paddingVertical: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[6]),
  },
  resendContainer: {
    alignItems: "center" as const,
    marginTop: toRN(tokens.spacing[4]),
  },
  resendText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    color: colors.text.secondary,
    fontFamily: fontFamily.groteskRegular,
    marginBottom: toRN(tokens.spacing[2]),
    textAlign: "center" as const,
  },
  resendButton: {
    padding: toRN(tokens.spacing[2]),
  },
  resendButtonText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    color: brand.primary,
    fontWeight: tokens.typography.fontWeight.semibold,
    fontFamily: fontFamily.groteskSemiBold,
  },
  resendButtonDisabled: {
    opacity: 0.5,
  },
});

export default function VerifyEmailScreen() {
  const { user } = useAuthStore();
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const { t } = useTranslation();
  const styles = useStyles(makeVerifyEmailScreenStyles);
  const { capture } = usePostHog();
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const verifyEmailMutation = useVerifyEmail();
  const resendVerificationMutation = useResendVerification();

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    const numericValue = value.replace(/[^0-9]/g, "");

    if (numericValue.length <= 1) {
      const newCode = [...code];
      const hadValue = !!code[index];
      newCode[index] = numericValue;
      setCode(newCode);
      setError("");

      // If field was cleared (had value but now empty), move to previous field
      if (hadValue && !numericValue && index > 0) {
        // Move to previous field immediately
        setTimeout(() => {
          inputRefs.current[index - 1]?.focus();
        }, 0);
      }
      // Auto-focus next input when entering a digit
      else if (numericValue && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }

      // Auto-submit when all 6 digits are entered
      const fullCode = newCode.join("");
      if (fullCode.length === 6) {
        handleVerify(fullCode);
      }
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === "Backspace") {
      // If current field is empty, clear previous field and focus it
      if (!code[index] && index > 0) {
        const newCode = [...code];
        newCode[index - 1] = "";
        setCode(newCode);
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handleVerify = async (verificationCode?: string) => {
    const codeToVerify = verificationCode || code.join("");

    if (codeToVerify.length !== 6) {
      setError(t("auth.verify_email.error_code_required"));
      return;
    }

    setError("");

    try {
      const response = await verifyEmailMutation.mutateAsync({
        code: codeToVerify,
        email: user?.email,
      });

      if (response.data) {
        // Update user in store with email_verified = true
        useAuthStore.getState().updateUser({ email_verified: true });

        capture("email_verified", {
          user_id: user?.id,
        });

        // Get redirect URL based on onboarding status
        const redirectUrl = await getRedirection();
        router.replace(redirectUrl);
      } else {
        const errorMessage =
          response.error || t("auth.verify_email.error_invalid_code");
        setError(errorMessage);
        // Clear the code input on error
        setCode(["", "", "", "", "", ""]);
        // Focus the first input
        setTimeout(() => {
          inputRefs.current[0]?.focus();
        }, 100);
      }
    } catch (error: any) {
      const errorMessage =
        error?.error || // From ApiResponse structure
        error?.response?.data?.detail || // Direct FastAPI response
        error?.message || // Generic error message
        t("auth.verify_email.error_invalid_code");

      setError(errorMessage);
      // Clear the code input on error
      setCode(["", "", "", "", "", ""]);
      // Focus the first input
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  };

  const handleResend = async () => {
    if (resendCountdown > 0) return;

    try {
      const response = await resendVerificationMutation.mutateAsync(
        user?.email
      );

      if (response.data) {
        Alert.alert(
          t("auth.verify_email.success_title"),
          t("auth.verify_email.success_message")
        );

        // Start countdown (2 minutes between requests)
        setResendCountdown(120); // 2 minutes in seconds
        const interval = setInterval(() => {
          setResendCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        Alert.alert(
          t("auth.verify_email.error_title"),
          response.error || t("auth.verify_email.error_resend_failed")
        );
      }
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.detail ||
        error?.message ||
        t("auth.verify_email.error_resend_failed");
      Alert.alert(t("auth.verify_email.error_title"), errorMessage);
    }
  };

  const formatCountdown = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
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

          {/* Title and Subtitle */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{t("auth.verify_email.title")}</Text>
            <Text style={styles.subtitle}>
              {t("auth.verify_email.subtitle")}{" "}
              <Text style={styles.emailText}>{user?.email}</Text>
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.codeContainer}>
              <View style={styles.codeInputContainer}>
                {code.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => {
                      inputRefs.current[index] = ref;
                    }}
                    style={[
                      styles.codeInput,
                      (focusedIndex === index || digit) &&
                        styles.codeInputFocused,
                      error && styles.codeInputError,
                    ]}
                    value={digit}
                    onChangeText={(value) => handleCodeChange(index, value)}
                    onKeyPress={({ nativeEvent }) =>
                      handleKeyPress(index, nativeEvent.key)
                    }
                    onFocus={() => setFocusedIndex(index)}
                    onBlur={() => setFocusedIndex(null)}
                    keyboardType="numeric"
                    maxLength={1}
                    selectTextOnFocus
                    editable={!verifyEmailMutation.isPending}
                  />
                ))}
              </View>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>

            <Button
              title={
                verifyEmailMutation.isPending
                  ? t("auth.verify_email.verifying")
                  : t("auth.verify_email.verify_button")
              }
              onPress={() => handleVerify()}
              disabled={
                verifyEmailMutation.isPending || code.join("").length !== 6
              }
            />

            <View style={styles.resendContainer}>
              <Text style={styles.resendText}>
                {t("auth.verify_email.resend_question")}{" "}
                {resendCountdown > 0 &&
                  `${t("auth.verify_email.resend_in")} ${formatCountdown(resendCountdown)}`}
              </Text>
              <TouchableOpacity
                onPress={handleResend}
                disabled={
                  resendCountdown > 0 || resendVerificationMutation.isPending
                }
                style={[
                  styles.resendButton,
                  (resendCountdown > 0 ||
                    resendVerificationMutation.isPending) &&
                    styles.resendButtonDisabled,
                ]}
              >
                <Text style={styles.resendButtonText}>
                  {resendVerificationMutation.isPending
                    ? t("auth.verify_email.sending")
                    : t("auth.verify_email.resend_button")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
