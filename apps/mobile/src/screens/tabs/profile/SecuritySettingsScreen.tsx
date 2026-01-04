import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/lib/i18n";
import { useStyles, useTheme } from "@/themes";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { Card } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import BackButton from "@/components/ui/BackButton";
import { useSetPassword, useChangePassword } from "@/hooks/api/useAuth";
import { useCurrentUser } from "@/hooks/api/useUser";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { ApiError } from "@/services/api/base";

export default function SecuritySettingsScreen() {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { user, updateUser } = useAuthStore();
  const { t } = useTranslation();
  const router = useRouter();
  const { showAlert } = useAlertModal();

  const setPasswordMutation = useSetPassword();
  const changePasswordMutation = useChangePassword();

  // Fetch fresh user data from API and sync with auth store
  const { data: currentUserResponse } = useCurrentUser();

  useEffect(() => {
    // currentUserResponse is ApiResponse<User>, so we need .data to get the User
    const apiUser = currentUserResponse?.data;
    if (apiUser) {
      // Sync relevant fields with auth store
      updateUser({
        has_password: apiUser.has_password,
        linked_providers: apiUser.linked_providers
      });
    }
  }, [currentUserResponse?.data, updateUser]);

  // Form states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Determine if user signed up with OAuth
  const isOAuthUser = useMemo(() => {
    const provider = user?.auth_provider;
    return provider === "google" || provider === "apple";
  }, [user?.auth_provider]);

  const hasPassword = user?.has_password ?? false;

  // Email is read-only for OAuth users
  const isEmailReadOnly = isOAuthUser;

  const providerLabels: Record<string, string> = {
    password: t("auth.social.providers.password"),
    email: t("auth.social.providers.password"),
    google: t("auth.social.providers.google"),
    apple: t("auth.social.providers.apple")
  };

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return t("errors.password_too_short");
    }
    // Check for uppercase, lowercase, and numbers
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return t("errors.password_weak");
    }
    return null;
  };

  const handleSetPassword = async () => {
    // Validate new password
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      await showAlert({
        title: t("common.error"),
        message: passwordError,
        variant: "error"
      });
      return;
    }

    // Check passwords match
    if (newPassword !== confirmPassword) {
      await showAlert({
        title: t("common.error"),
        message: t("auth.change_password.passwords_dont_match"),
        variant: "error"
      });
      return;
    }

    try {
      const response = await setPasswordMutation.mutateAsync(newPassword);

      if (response.data?.user) {
        updateUser(response.data.user);
        await showAlert({
          title: t("common.success"),
          message: t("security_settings.password_set_success"),
          variant: "success"
        });
        // Clear form
        setNewPassword("");
        setConfirmPassword("");
      } else if (response.error) {
        await showAlert({
          title: t("common.error"),
          message: response.error,
          variant: "error"
        });
      }
    } catch (error: unknown) {
      console.error("Set password error:", error);
      const errorMessage = error instanceof ApiError ? error.message : t("errors.generic_error");
      await showAlert({
        title: t("common.error"),
        message: errorMessage,
        variant: "error"
      });
    }
  };

  const handleChangePassword = async () => {
    // Validate current password
    if (!currentPassword) {
      await showAlert({
        title: t("common.error"),
        message: t("auth.change_password.current_password_required"),
        variant: "error"
      });
      return;
    }

    // Validate new password
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      await showAlert({
        title: t("common.error"),
        message: passwordError,
        variant: "error"
      });
      return;
    }

    // Check passwords match
    if (newPassword !== confirmPassword) {
      await showAlert({
        title: t("common.error"),
        message: t("auth.change_password.passwords_dont_match"),
        variant: "error"
      });
      return;
    }

    // Check new password is different
    if (currentPassword === newPassword) {
      await showAlert({
        title: t("common.error"),
        message: t("auth.change_password.new_password_same"),
        variant: "error"
      });
      return;
    }

    try {
      const response = await changePasswordMutation.mutateAsync({
        current_password: currentPassword,
        new_password: newPassword
      });

      if (response.data) {
        await showAlert({
          title: t("common.success"),
          message: t("auth.change_password.success_message"),
          variant: "success"
        });
        // Clear form
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else if (response.error) {
        await showAlert({
          title: t("common.error"),
          message: response.error,
          variant: "error"
        });
      }
    } catch (error: unknown) {
      console.error("Change password error:", error);
      const errorMessage =
        error instanceof ApiError ? error.message : t("auth.change_password.error_change_failed");
      await showAlert({
        title: t("common.error"),
        message: errorMessage,
        variant: "error"
      });
    }
  };

  const isLoading = setPasswordMutation.isPending || changePasswordMutation.isPending;
  const canSubmit = hasPassword
    ? currentPassword && newPassword && confirmPassword
    : newPassword && confirmPassword;

  return (
    <View style={styles.container}>
      <BackButton title={t("security_settings.title")} onPress={() => router.back()} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Email Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("security_settings.email")}</Text>
            <Card style={styles.card}>
              <View style={styles.inputContainer}>
                <View style={styles.inputIconContainer}>
                  <Ionicons name="mail" size={20} color={colors.text.tertiary} />
                </View>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>{t("auth.login.email_label")}</Text>
                  <TextInput
                    style={[styles.input, isEmailReadOnly && styles.inputDisabled]}
                    value={user?.email}
                    editable={false}
                    placeholderTextColor={colors.text.tertiary}
                  />
                </View>
              </View>
              {isEmailReadOnly && (
                <View style={styles.infoRow}>
                  <Ionicons name="information-circle" size={16} color={colors.text.tertiary} />
                  <Text style={styles.infoText}>
                    {t("security_settings.email_oauth_notice", {
                      provider: providerLabels[user?.auth_provider || "email"]
                    })}
                  </Text>
                </View>
              )}
            </Card>
          </View>

          {/* Password Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {hasPassword
                ? t("security_settings.change_password")
                : t("security_settings.add_password")}
            </Text>
            <Card style={styles.card}>
              {/* Description */}
              <Text style={styles.passwordDescription}>
                {hasPassword
                  ? t("security_settings.change_password_description")
                  : t("security_settings.add_password_description")}
              </Text>

              {/* Current Password (only for users with existing password) */}
              {hasPassword && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    {t("auth.change_password.current_password_label")}
                  </Text>
                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      placeholder={t("auth.change_password.current_password_placeholder")}
                      placeholderTextColor={colors.text.tertiary}
                      secureTextEntry={!showCurrentPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      <Ionicons
                        name={showCurrentPassword ? "eye-off" : "eye"}
                        size={20}
                        color={colors.text.tertiary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* New Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("auth.change_password.new_password_label")}</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder={t("auth.change_password.new_password_placeholder")}
                    placeholderTextColor={colors.text.tertiary}
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowNewPassword(!showNewPassword)}
                  >
                    <Ionicons
                      name={showNewPassword ? "eye-off" : "eye"}
                      size={20}
                      color={colors.text.tertiary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("auth.change_password.confirm_password_label")}</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder={t("auth.change_password.confirm_password_placeholder")}
                    placeholderTextColor={colors.text.tertiary}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <Ionicons
                      name={showConfirmPassword ? "eye-off" : "eye"}
                      size={20}
                      color={colors.text.tertiary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Password Requirements */}
              <View style={styles.requirementsContainer}>
                <Text style={styles.requirementsTitle}>
                  {t("security_settings.password_requirements")}
                </Text>
                <View style={styles.requirementRow}>
                  <Ionicons
                    name={newPassword.length >= 8 ? "checkmark-circle" : "ellipse-outline"}
                    size={16}
                    color={newPassword.length >= 8 ? colors.feedback.success : colors.text.tertiary}
                  />
                  <Text
                    style={[
                      styles.requirementText,
                      newPassword.length >= 8 && styles.requirementMet
                    ]}
                  >
                    {t("security_settings.requirement_length")}
                  </Text>
                </View>
                <View style={styles.requirementRow}>
                  <Ionicons
                    name={/[A-Z]/.test(newPassword) ? "checkmark-circle" : "ellipse-outline"}
                    size={16}
                    color={
                      /[A-Z]/.test(newPassword) ? colors.feedback.success : colors.text.tertiary
                    }
                  />
                  <Text
                    style={[
                      styles.requirementText,
                      /[A-Z]/.test(newPassword) && styles.requirementMet
                    ]}
                  >
                    {t("security_settings.requirement_uppercase")}
                  </Text>
                </View>
                <View style={styles.requirementRow}>
                  <Ionicons
                    name={/[a-z]/.test(newPassword) ? "checkmark-circle" : "ellipse-outline"}
                    size={16}
                    color={
                      /[a-z]/.test(newPassword) ? colors.feedback.success : colors.text.tertiary
                    }
                  />
                  <Text
                    style={[
                      styles.requirementText,
                      /[a-z]/.test(newPassword) && styles.requirementMet
                    ]}
                  >
                    {t("security_settings.requirement_lowercase")}
                  </Text>
                </View>
                <View style={styles.requirementRow}>
                  <Ionicons
                    name={/[0-9]/.test(newPassword) ? "checkmark-circle" : "ellipse-outline"}
                    size={16}
                    color={
                      /[0-9]/.test(newPassword) ? colors.feedback.success : colors.text.tertiary
                    }
                  />
                  <Text
                    style={[
                      styles.requirementText,
                      /[0-9]/.test(newPassword) && styles.requirementMet
                    ]}
                  >
                    {t("security_settings.requirement_number")}
                  </Text>
                </View>
              </View>

              {/* Submit Button */}
              <Button
                title={
                  hasPassword
                    ? t("auth.change_password.change_password")
                    : t("security_settings.set_password_button")
                }
                onPress={hasPassword ? handleChangePassword : handleSetPassword}
                loading={isLoading}
                disabled={!canSubmit || isLoading}
                style={styles.submitButton}
              />
            </Card>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  keyboardView: {
    flex: 1
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: toRN(tokens.spacing[8])
  },
  // Sections
  section: {
    marginTop: toRN(tokens.spacing[4]),
    paddingHorizontal: toRN(tokens.spacing[4])
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.tertiary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: toRN(tokens.spacing[2]),
    marginLeft: toRN(tokens.spacing[1])
  },
  card: {
    padding: toRN(tokens.spacing[4])
  },
  // Input Container (for email)
  inputContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const
  },
  inputIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: `${colors.text.tertiary}10`,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginRight: toRN(tokens.spacing[3])
  },
  inputWrapper: {
    flex: 1
  },
  inputLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
    marginBottom: toRN(tokens.spacing[0.5])
  },
  input: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.primary
  },
  inputDisabled: {
    color: colors.text.tertiary
  },
  infoRow: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    marginTop: toRN(tokens.spacing[3]),
    paddingTop: toRN(tokens.spacing[3]),
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    gap: toRN(tokens.spacing[2])
  },
  infoText: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    lineHeight: toRN(tokens.typography.fontSize.sm * 1.5)
  },
  // Password Section
  passwordDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    marginBottom: toRN(tokens.spacing[4]),
    lineHeight: toRN(tokens.typography.fontSize.sm * 1.5)
  },
  inputGroup: {
    marginBottom: toRN(tokens.spacing[4])
  },
  label: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
    marginBottom: toRN(tokens.spacing[1.5])
  },
  passwordInputContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: colors.bg.canvas,
    borderRadius: toRN(tokens.borderRadius.lg),
    borderWidth: 1,
    borderColor: colors.border.subtle,
    paddingHorizontal: toRN(tokens.spacing[3])
  },
  passwordInput: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.primary,
    paddingVertical: toRN(tokens.spacing[3])
  },
  eyeButton: {
    padding: toRN(tokens.spacing[2])
  },
  // Requirements
  requirementsContainer: {
    marginTop: toRN(tokens.spacing[2]),
    marginBottom: toRN(tokens.spacing[4]),
    padding: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.canvas,
    borderRadius: toRN(tokens.borderRadius.lg)
  },
  requirementsTitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.secondary,
    marginBottom: toRN(tokens.spacing[2])
  },
  requirementRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    marginBottom: toRN(tokens.spacing[1])
  },
  requirementText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },
  requirementMet: {
    color: colors.feedback.success
  },
  submitButton: {
    marginTop: toRN(tokens.spacing[2])
  }
});
