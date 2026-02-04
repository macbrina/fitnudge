import Button from "@/components/ui/Button";
import CheckmarkCircle from "@/components/ui/CheckmarkCircle";
import { useNotificationPermissions } from "@/hooks/notifications/useNotificationPermissions";
import { usePostHog } from "@/hooks/usePostHog";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { toRN } from "@/lib/units";
import { logger } from "@/services/logger";
import { useAuthStore } from "@/stores/authStore";
import { useStyles, useTheme } from "@/themes";
import { MOBILE_ROUTES } from "@/lib/routes";
import { getRedirection } from "@/utils/getRedirection";
import { hasCompletedV2Onboarding } from "@/utils/onboardingUtils";
import { STORAGE_KEYS, storageUtil } from "@/utils/storageUtil";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function NotificationPermissionScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation();
  const styles = useStyles(makeNotificationPermissionScreenStyles);
  const { brandColors } = useTheme();
  const insets = useSafeAreaInsets();
  const { requestPermissionsWithSoftPrompt } = useNotificationPermissions();
  const { capture } = usePostHog();
  const { user } = useAuthStore();

  const handleEnableNotifications = async () => {
    try {
      setIsLoading(true);

      const granted = await requestPermissionsWithSoftPrompt();

      if (granted) {
        capture("notification_permission_granted", {
          source: "onboarding",
          screen: "notification_permission"
        });
        capture("onboarding_step_completed", { step: "notification_permission", skipped: false });
      } else {
        capture("notification_permission_denied", {
          source: "onboarding",
          screen: "notification_permission"
        });
        capture("onboarding_step_completed", { step: "notification_permission", skipped: true });
      }

      const completedOnboarding = hasCompletedV2Onboarding(user);

      if (completedOnboarding) {
        // Fast path: navigate immediately, storage in background
        storageUtil.setItem(STORAGE_KEYS.HAS_SEEN_NOTIFICATION_PERMISSION, true).catch(() => {});
        storageUtil.setItem(STORAGE_KEYS.HAS_SEEN_PERSONALIZATION, true).catch(() => {});
        router.replace(MOBILE_ROUTES.MAIN.HOME);
      } else {
        // Need getRedirection to check personalization step
        await storageUtil.setItem(STORAGE_KEYS.HAS_SEEN_NOTIFICATION_PERMISSION, true);
        const destination = await getRedirection({ hasCompletedOnboarding: false });
        router.replace(destination);
      }
    } catch (error) {
      logger.error("Error requesting notification permissions", {
        error: error instanceof Error ? error.message : String(error),
        screen: "notification_permission"
      });
      const destination = await getRedirection({
        hasCompletedOnboarding: hasCompletedV2Onboarding(user)
      });
      router.replace(destination);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMaybeLater = async () => {
    capture("notification_permission_skipped", {
      source: "onboarding",
      screen: "notification_permission"
    });
    capture("onboarding_step_completed", { step: "notification_permission", skipped: true });

    const completedOnboarding = hasCompletedV2Onboarding(user);

    if (completedOnboarding) {
      storageUtil.setItem(STORAGE_KEYS.HAS_SEEN_NOTIFICATION_PERMISSION, true).catch(() => {});
      storageUtil.setItem(STORAGE_KEYS.HAS_SEEN_PERSONALIZATION, true).catch(() => {});
      router.replace(MOBILE_ROUTES.MAIN.HOME);
    } else {
      await storageUtil.setItem(STORAGE_KEYS.HAS_SEEN_NOTIFICATION_PERMISSION, true);
      const destination = await getRedirection({ hasCompletedOnboarding: false });
      router.replace(destination);
    }
  };

  return (
    <View style={styles.container}>
      {/* Content */}
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="notifications" size={60} color={brandColors.primary} />
        </View>

        <Text style={styles.title}>{t("onboarding.notifications.title")}</Text>
        <Text style={styles.subtitle}>{t("onboarding.notifications.subtitle")}</Text>

        {/* Benefits List */}
        <View style={styles.benefitsContainer}>
          <View style={styles.benefitItem}>
            <CheckmarkCircle size={22} mr={3} />
            <Text style={styles.benefitText}>
              {t("onboarding.notifications.benefit_reminders")}
            </Text>
          </View>
          <View style={styles.benefitItem}>
            <CheckmarkCircle size={22} mr={3} />
            <Text style={styles.benefitText}>
              {t("onboarding.notifications.benefit_motivation")}
            </Text>
          </View>
          <View style={styles.benefitItem}>
            <CheckmarkCircle size={22} mr={3} />
            <Text style={styles.benefitText}>
              {t("onboarding.notifications.benefit_celebrations")}
            </Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + 20 }]}>
        <Button
          title={t("onboarding.notifications.enable_button")}
          onPress={handleEnableNotifications}
          disabled={isLoading}
          loading={isLoading}
        />

        <TouchableOpacity onPress={handleMaybeLater} style={styles.maybeLaterButton}>
          <Text style={styles.maybeLaterText}>{t("onboarding.notifications.maybe_later")}</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>{t("onboarding.notifications.disclaimer")}</Text>
      </View>
    </View>
  );
}

const makeNotificationPermissionScreenStyles = (tokens: any, colors: any, brand: any) => {
  return {
    container: {
      flex: 1,
      backgroundColor: colors.bg.canvas
    },
    header: {
      alignItems: "center" as const,
      paddingTop: toRN(tokens.spacing[8]),
      paddingBottom: toRN(tokens.spacing[6])
    },
    logo: {
      width: 60,
      height: 60
    },
    content: {
      flex: 1,
      alignItems: "center" as const,
      paddingHorizontal: toRN(tokens.spacing[6]),
      justifyContent: "center" as const
    },
    iconContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: brand.primary + "20",
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginBottom: toRN(tokens.spacing[8])
    },
    title: {
      fontSize: toRN(tokens.typography.fontSize["3xl"]),
      fontWeight: tokens.typography.fontWeight.bold,
      color: colors.text.primary,
      textAlign: "center" as const,
      marginBottom: toRN(tokens.spacing[4]),
      fontFamily: fontFamily.groteskBold
    },
    subtitle: {
      fontSize: toRN(tokens.typography.fontSize.lg),
      color: colors.text.secondary,
      textAlign: "center" as const,
      marginBottom: toRN(tokens.spacing[8]),
      fontFamily: fontFamily.groteskRegular
    },
    benefitsContainer: {
      width: "100%",
      maxWidth: 300
    },
    benefitItem: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      marginBottom: toRN(tokens.spacing[4])
    },
    benefitText: {
      fontSize: toRN(tokens.typography.fontSize.base),
      color: colors.text.primary,
      flex: 1,
      fontFamily: fontFamily.groteskRegular
    },
    actions: {
      paddingHorizontal: toRN(tokens.spacing[6])
    },
    maybeLaterButton: {
      alignItems: "center" as const,
      marginTop: toRN(tokens.spacing[4]),
      marginBottom: toRN(tokens.spacing[6])
    },
    maybeLaterText: {
      fontSize: toRN(tokens.typography.fontSize.base),
      color: colors.text.secondary,
      fontFamily: fontFamily.groteskMedium
    },
    disclaimer: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.text.tertiary,
      textAlign: "center" as const,
      fontFamily: fontFamily.groteskRegular
    }
  };
};
