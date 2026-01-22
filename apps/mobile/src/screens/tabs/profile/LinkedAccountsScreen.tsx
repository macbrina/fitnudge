import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/lib/i18n";
import { useStyles, useTheme } from "@/themes";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAlertModal } from "@/contexts/AlertModalContext";
import BackButton from "@/components/ui/BackButton";
import { router } from "expo-router";
import { useLinkGoogle, useLinkApple, useUnlinkProvider } from "@/hooks/api/useAuth";
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
import { ApiError } from "@/services/api/base";

export default function LinkedAccountsScreen() {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { user, updateUser } = useAuthStore();
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();

  // Loading states
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  // Mutations
  const linkGoogleMutation = useLinkGoogle();
  const linkAppleMutation = useLinkApple();
  const unlinkMutation = useUnlinkProvider();

  const showGoogle = hasGoogleSignInConfiguration();
  const showApple = Platform.OS === "ios" && appleAvailable;

  // Check Apple sign-in availability
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

  const providerLabels: Record<string, string> = {
    password: t("auth.social.providers.password"),
    email: t("auth.social.providers.password"),
    google: t("auth.social.providers.google"),
    apple: t("auth.social.providers.apple")
  };

  const providerIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
    google: "logo-google",
    apple: "logo-apple"
  };

  const linkedProviders = user?.linked_providers ?? [];
  const primaryProvider = user?.auth_provider;

  // iOS shows both Google and Apple, Android only shows Google
  const availableProviders = Platform.OS === "ios" ? ["google", "apple"] : ["google"];

  const handleLinkGoogle = async () => {
    if (!showGoogle) {
      await showAlert({
        title: t("common.error"),
        message: t("errors.authentication_error"),
        variant: "error"
      });
      return;
    }

    try {
      setIsGoogleLoading(true);
      const { idToken } = await performNativeGoogleSignIn();

      const response = await linkGoogleMutation.mutateAsync(idToken);

      console.log("response", response);

      if (response.data?.user) {
        updateUser(response.data.user);
        await showAlert({
          title: t("common.success"),
          message: t("profile.google_linked_success"),
          variant: "success"
        });
      } else if (response.error) {
        await showAlert({
          title: t("common.error"),
          message: response.error,
          variant: "error"
        });
      }
    } catch (error: any) {
      if (isGoogleCancelledError(error)) {
        return;
      }

      console.error("Google linking failed:", error);

      // Check if it's an API error (from our backend)
      let errorMessage: string;
      if (error instanceof ApiError) {
        // Use the backend error message directly
        errorMessage = error.message;
      } else {
        // Fall back to Google SDK error handling
        errorMessage = getFriendlyGoogleError(error);
      }

      await showAlert({
        title: t("common.error"),
        message: errorMessage,
        variant: "error"
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleLinkApple = async () => {
    if (!showApple) {
      await showAlert({
        title: t("common.error"),
        message: t("errors.authentication_error"),
        variant: "error"
      });
      return;
    }

    try {
      setIsAppleLoading(true);
      const credential = await performNativeAppleSignIn();

      if (!credential.identityToken) {
        await showAlert({
          title: t("common.error"),
          message: t("errors.authentication_error"),
          variant: "error"
        });
        return;
      }

      const response = await linkAppleMutation.mutateAsync({
        identityToken: credential.identityToken,
        authorizationCode: credential.authorizationCode || undefined
      });

      if (response.data?.user) {
        updateUser(response.data.user);
        await showAlert({
          title: t("common.success"),
          message: t("profile.apple_linked_success"),
          variant: "success"
        });
      } else if (response.error) {
        await showAlert({
          title: t("common.error"),
          message: response.error,
          variant: "error"
        });
      }
    } catch (error: any) {
      if (isAppleCancelledError(error)) {
        return;
      }

      console.error("Apple linking failed:", error);

      // Check if it's an API error (from our backend)
      let errorMessage: string;
      if (error instanceof ApiError) {
        // Use the backend error message directly
        errorMessage = error.message;
      } else {
        // Fall back to generic error
        errorMessage = t("errors.authentication_error");
      }

      await showAlert({
        title: t("common.error"),
        message: errorMessage,
        variant: "error"
      });
    } finally {
      setIsAppleLoading(false);
    }
  };

  const handleUnlink = async (provider: "google" | "apple") => {
    // Confirm before unlinking
    const confirmed = await showAlert({
      title: t("profile.unlink_confirm_title"),
      message: t("profile.unlink_confirm_message", {
        provider: providerLabels[provider]
      }),
      variant: "warning",
      confirmLabel: t("profile.unlink_account"),
      cancelLabel: t("common.cancel"),
      showCancel: true
    });

    if (!confirmed) return;

    try {
      if (provider === "google") {
        setIsGoogleLoading(true);
      } else {
        setIsAppleLoading(true);
      }

      const response = await unlinkMutation.mutateAsync(provider);

      if (response.data?.user) {
        updateUser(response.data.user);
        await showAlert({
          title: t("common.success"),
          message: t("profile.account_unlinked_success"),
          variant: "success"
        });
      } else if (response.error) {
        await showAlert({
          title: t("common.error"),
          message: response.error,
          variant: "error"
        });
      }
    } catch (error: any) {
      console.error("Unlink failed:", error);

      // Check if it's an API error (from our backend)
      let errorMessage: string;
      if (error instanceof ApiError) {
        // Use the backend error message directly
        errorMessage = error.message;
      } else {
        // Fall back to generic error
        errorMessage = t("errors.unlink_error");
      }

      await showAlert({
        title: t("common.error"),
        message: errorMessage,
        variant: "error"
      });
    } finally {
      setIsGoogleLoading(false);
      setIsAppleLoading(false);
    }
  };

  const handleLinkingPress = async (provider: "google" | "apple") => {
    const isLinked = linkedProviders.includes(provider);

    if (isLinked) {
      await handleUnlink(provider);
    } else {
      if (provider === "google") {
        await handleLinkGoogle();
      } else {
        await handleLinkApple();
      }
    }
  };

  const isProviderLoading = (provider: string) => {
    if (provider === "google") return isGoogleLoading || linkGoogleMutation.isPending;
    if (provider === "apple") return isAppleLoading || linkAppleMutation.isPending;
    return unlinkMutation.isPending;
  };

  return (
    <View style={styles.container}>
      <BackButton
        title={t("profile.linked_accounts") || "Linked Accounts"}
        onPress={() => router.back()}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Card */}
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle" size={20} color={brandColors.primary} />
            <Text style={styles.infoText}>
              {t("profile.linked_accounts_info") ||
                "Link additional accounts for easier sign-in. Your primary account cannot be unlinked."}
            </Text>
          </View>
        </Card>

        {/* Primary Provider Notice */}
        <Text style={styles.sectionTitle}>{t("profile.primary_account") || "Primary Account"}</Text>
        <Card style={styles.providerCard}>
          <View style={styles.providerRow}>
            <View style={styles.providerInfo}>
              <View style={[styles.providerIcon, { backgroundColor: `${brandColors.primary}15` }]}>
                <Ionicons
                  name={
                    providerIcons[primaryProvider as string] ||
                    ((primaryProvider as string) === "email" ||
                    (primaryProvider as string) === "password"
                      ? "mail"
                      : "person")
                  }
                  size={24}
                  color={brandColors.primary}
                />
              </View>
              <View style={styles.providerDetails}>
                <Text style={styles.providerLabel}>
                  {providerLabels[primaryProvider as string] || primaryProvider}
                </Text>
                <Text style={styles.providerStatus}>
                  {t("profile.primary_provider") || "Primary sign-in method"}
                </Text>
              </View>
            </View>
            <View style={styles.primaryBadge}>
              <Text style={styles.primaryBadgeText}>{t("profile.primary") || "Primary"}</Text>
            </View>
          </View>
        </Card>

        {/* Linked Accounts Section */}
        <Text style={styles.sectionTitle}>{t("profile.other_accounts") || "Other Accounts"}</Text>
        <Card style={styles.accountsCard}>
          {availableProviders.map((provider, index) => {
            const isPrimary = primaryProvider === provider;
            const isLinked = isPrimary || linkedProviders.includes(provider);

            // Skip if this is the primary provider (already shown above)
            if (isPrimary) return null;

            return (
              <React.Fragment key={provider}>
                {index > 0 && !isPrimary && <View style={styles.divider} />}
                <View style={styles.accountRow}>
                  <View style={styles.accountInfo}>
                    <View
                      style={[
                        styles.providerIcon,
                        {
                          backgroundColor: isLinked
                            ? `${colors.feedback.success}15`
                            : `${colors.text.tertiary}10`
                        }
                      ]}
                    >
                      <Ionicons
                        name={providerIcons[provider]}
                        size={24}
                        color={isLinked ? colors.feedback.success : colors.text.tertiary}
                      />
                    </View>
                    <View style={styles.providerDetails}>
                      <Text style={styles.providerLabel}>{providerLabels[provider]}</Text>
                      <Text
                        style={[
                          styles.accountStatus,
                          isLinked ? styles.statusLinked : styles.statusNotLinked
                        ]}
                      >
                        {isLinked ? t("profile.linked") : t("profile.not_linked")}
                      </Text>
                    </View>
                  </View>
                  <Button
                    title={isLinked ? t("profile.unlink_account") : t("profile.link_account")}
                    size="sm"
                    variant={isLinked ? "secondary" : "primary"}
                    onPress={() => handleLinkingPress(provider as "google" | "apple")}
                    loading={isProviderLoading(provider)}
                    disabled={isProviderLoading(provider)}
                  />
                </View>
              </React.Fragment>
            );
          })}
          {/* Show message if all available providers are primary */}
          {availableProviders.every((p) => p === primaryProvider) && (
            <Text style={styles.noOtherAccounts}>
              {t("profile.no_other_accounts") || "No other accounts available to link."}
            </Text>
          )}
        </Card>

        {/* Security Note */}
        <View style={styles.securityNote}>
          <Ionicons name="shield-checkmark" size={16} color={colors.text.tertiary} />
          <Text style={styles.securityNoteText}>
            {t("profile.security_note") ||
              "Your account data is secure. Linking accounts only provides alternative sign-in methods."}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    padding: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[8])
  },
  // Info Card
  infoCard: {
    marginBottom: toRN(tokens.spacing[4])
  },
  infoRow: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: toRN(tokens.spacing[3])
  },
  infoText: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm * 1.5)
  },
  // Section Title
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.tertiary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: toRN(tokens.spacing[2]),
    marginTop: toRN(tokens.spacing[2]),
    marginLeft: toRN(tokens.spacing[1])
  },
  // Provider Card (Primary)
  providerCard: {
    marginBottom: toRN(tokens.spacing[4])
  },
  providerRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const
  },
  providerInfo: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    flex: 1
  },
  providerIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginRight: toRN(tokens.spacing[3])
  },
  providerDetails: {
    flex: 1
  },
  providerLabel: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    textTransform: "capitalize" as const
  },
  providerStatus: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    marginTop: toRN(tokens.spacing[0.5])
  },
  primaryBadge: {
    paddingVertical: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[2]),
    backgroundColor: `${brand.primary}15`,
    borderRadius: toRN(tokens.borderRadius.full)
  },
  primaryBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: brand.primary
  },
  // Accounts Card
  accountsCard: {
    marginBottom: toRN(tokens.spacing[4])
  },
  accountRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: toRN(tokens.spacing[2])
  },
  accountInfo: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    flex: 1,
    marginRight: toRN(tokens.spacing[3])
  },
  accountStatus: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    marginTop: toRN(tokens.spacing[0.5])
  },
  statusLinked: {
    color: colors.feedback.success
  },
  statusNotLinked: {
    color: colors.text.tertiary
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: toRN(tokens.spacing[2])
  },
  noOtherAccounts: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    textAlign: "center" as const,
    paddingVertical: toRN(tokens.spacing[4])
  },
  // Security Note
  securityNote: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[2])
  },
  securityNoteText: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    lineHeight: toRN(tokens.typography.fontSize.xs * 1.5)
  }
});
