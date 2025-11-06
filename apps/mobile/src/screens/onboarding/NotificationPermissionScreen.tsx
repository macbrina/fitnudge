import React, { useState } from "react";
import { View, Text, Alert, Image, TouchableOpacity } from "react-native";
import { useTranslation } from "@/lib/i18n";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { useStyles } from "@/themes/makeStyles";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Button from "@/components/ui/Button";
import { router } from "expo-router";
import { tokens } from "@/themes/tokens";
import { useTheme } from "@/themes";
import { useNotificationPermissions } from "@/hooks/notifications/useNotificationPermissions";
import { usePostHog } from "@/hooks/usePostHog";
import { logger } from "@/services/logger";
import { MOBILE_ROUTES } from "@/lib/routes";
import { storageUtil, STORAGE_KEYS } from "@/utils/storageUtil";

export default function NotificationPermissionScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation();
  const styles = useStyles(makeNotificationPermissionScreenStyles);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { requestPermissionsWithSoftPrompt } = useNotificationPermissions();
  const { capture } = usePostHog();

  const handleEnableNotifications = async () => {
    try {
      setIsLoading(true);

      // Track event
      capture("notification_permission_requested", {
        source: "onboarding",
        screen: "notification_permission",
      });

      // Request permissions
      const granted = await requestPermissionsWithSoftPrompt();

      if (granted) {
        // Track success
        capture("notification_permission_granted", {
          source: "onboarding",
          screen: "notification_permission",
        });

        // Permission granted - tracked via PostHog above
      } else {
        // Track denial
        capture("notification_permission_denied", {
          source: "onboarding",
          screen: "notification_permission",
        });

        // Permission denied - tracked via PostHog above
      }

      // Mark step as seen
      await storageUtil.setItem(
        STORAGE_KEYS.HAS_SEEN_NOTIFICATION_PERMISSION,
        true
      );

      // Navigate to personalization flow regardless of permission result
      router.push(MOBILE_ROUTES.ONBOARDING.PERSONALIZATION);
    } catch (error) {
      logger.error("Error requesting notification permissions", {
        error: error instanceof Error ? error.message : String(error),
        screen: "notification_permission",
      });

      // Still navigate to personalization flow
      router.push(MOBILE_ROUTES.ONBOARDING.PERSONALIZATION);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMaybeLater = () => {
    // Track skip
    capture("notification_permission_skipped", {
      source: "onboarding",
      screen: "notification_permission",
    });

    // Permission skipped - tracked via PostHog above

    // Mark step as seen
    storageUtil
      .setItem(STORAGE_KEYS.HAS_SEEN_NOTIFICATION_PERMISSION, true)
      .catch(() => {});

    // Navigate to personalization flow
    router.push(MOBILE_ROUTES.ONBOARDING.PERSONALIZATION);
  };

  return (
    <View style={styles.container}>
      {/* Content */}
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>🔔</Text>
        </View>

        <Text style={styles.title}>{t("onboarding.notifications.title")}</Text>
        <Text style={styles.subtitle}>
          {t("onboarding.notifications.subtitle")}
        </Text>

        {/* Benefits List */}
        <View style={styles.benefitsContainer}>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>✓</Text>
            <Text style={styles.benefitText}>
              {t("onboarding.notifications.benefit_reminders")}
            </Text>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>✓</Text>
            <Text style={styles.benefitText}>
              {t("onboarding.notifications.benefit_motivation")}
            </Text>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>✓</Text>
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

        <TouchableOpacity
          onPress={handleMaybeLater}
          style={styles.maybeLaterButton}
        >
          <Text style={styles.maybeLaterText}>
            {t("onboarding.notifications.maybe_later")}
          </Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          {t("onboarding.notifications.disclaimer")}
        </Text>
      </View>
    </View>
  );
}

const makeNotificationPermissionScreenStyles = (
  tokens: any,
  colors: any,
  brand: any
) => {
  return {
    container: {
      flex: 1,
      backgroundColor: colors.bg.canvas,
    },
    header: {
      alignItems: "center" as const,
      paddingTop: toRN(tokens.spacing[8]),
      paddingBottom: toRN(tokens.spacing[6]),
    },
    logo: {
      width: 60,
      height: 60,
    },
    content: {
      flex: 1,
      alignItems: "center" as const,
      paddingHorizontal: toRN(tokens.spacing[6]),
      justifyContent: "center" as const,
    },
    iconContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: brand.primary + "20",
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginBottom: toRN(tokens.spacing[8]),
    },
    icon: {
      fontSize: 60,
    },
    title: {
      fontSize: toRN(tokens.typography.fontSize["3xl"]),
      fontWeight: tokens.typography.fontWeight.bold,
      color: colors.text.primary,
      textAlign: "center" as const,
      marginBottom: toRN(tokens.spacing[4]),
      fontFamily: fontFamily.groteskBold,
    },
    subtitle: {
      fontSize: toRN(tokens.typography.fontSize.lg),
      color: colors.text.secondary,
      textAlign: "center" as const,
      marginBottom: toRN(tokens.spacing[8]),
      fontFamily: fontFamily.groteskRegular,
    },
    benefitsContainer: {
      width: "100%",
      maxWidth: 300,
    },
    benefitItem: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      marginBottom: toRN(tokens.spacing[4]),
    },
    benefitIcon: {
      fontSize: toRN(tokens.typography.fontSize.lg),
      color: brand.primary,
      marginRight: toRN(tokens.spacing[3]),
      fontWeight: tokens.typography.fontWeight.bold,
    },
    benefitText: {
      fontSize: toRN(tokens.typography.fontSize.base),
      color: colors.text.primary,
      flex: 1,
      fontFamily: fontFamily.groteskRegular,
    },
    actions: {
      paddingHorizontal: toRN(tokens.spacing[6]),
    },
    maybeLaterButton: {
      alignItems: "center" as const,
      marginTop: toRN(tokens.spacing[4]),
      marginBottom: toRN(tokens.spacing[6]),
    },
    maybeLaterText: {
      fontSize: toRN(tokens.typography.fontSize.base),
      color: colors.text.secondary,
      fontFamily: fontFamily.groteskMedium,
    },
    disclaimer: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.text.tertiary,
      textAlign: "center" as const,
      fontFamily: fontFamily.groteskRegular,
    },
  };
};
