import { useAlertModal } from "@/contexts/AlertModalContext";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { notificationApi } from "@/services/api/notifications";
import { notificationService } from "@/services/notifications/notificationService";
import { NotificationPreferences } from "@/services/notifications/notificationTypes";
import { useStyles } from "@/themes/makeStyles";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Switch, Text, TouchableOpacity, View } from "react-native";

export const NotificationSettingsScreen: React.FC = () => {
  const { t } = useTranslation();
  const styles = useStyles(makeNotificationSettingsStyles);
  const { showAlert, showToast } = useAlertModal();

  const [preferences, setPreferences] = useState<NotificationPreferences>({
    enabled: true,
    aiMotivation: true,
    reminders: true,
    social: true,
    achievements: true,
    reengagement: true,
    quietHours: {
      enabled: false,
      start: "22:00",
      end: "08:00",
    },
  });

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const prefs = await notificationService.getNotificationPreferences();
      setPreferences(prefs);
    } catch (error) {
      console.error("Failed to load notification preferences:", error);
    }
  };

  const updatePreference = async (
    key: keyof NotificationPreferences,
    value: any
  ) => {
    try {
      const newPreferences = { ...preferences, [key]: value };
      setPreferences(newPreferences);
      await notificationService.updateNotificationPreferences(newPreferences);
    } catch (error) {
      console.error("Failed to update preference:", error);
      // Revert on error
      setPreferences(preferences);
    }
  };

  const updateQuietHours = async (
    key: "enabled" | "start" | "end",
    value: any
  ) => {
    try {
      const newQuietHours = { ...preferences.quietHours, [key]: value };
      const newPreferences = { ...preferences, quietHours: newQuietHours };
      setPreferences(newPreferences);
      await notificationService.updateNotificationPreferences(newPreferences);
    } catch (error) {
      console.error("Failed to update quiet hours:", error);
      setPreferences(preferences);
    }
  };

  const sendTestNotification = async () => {
    try {
      setIsLoading(true);
      await notificationApi.sendTestNotification("ai_motivation", {
        goalId: "test",
        message: "This is a test notification from FitNudge!",
      });
      showToast({
        title: t("notifications.settings.test_sent"),
        message: "Check your notification panel to see the test notification.",
        variant: "success",
        duration: 2000,
      });
    } catch (error) {
      console.error("Failed to send test notification:", error);
      await showAlert({
        title: t("common.error"),
        message: t("notifications.settings.test_failed"),
        variant: "error",
        confirmLabel: t("common.ok"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderToggle = (
    label: string,
    value: boolean,
    onValueChange: (value: boolean) => void,
    disabled?: boolean
  ) => (
    <View style={styles.toggleRow}>
      <Text style={[styles.toggleLabel, disabled && styles.disabledText]}>
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{
          false: styles.switchTrackFalse.backgroundColor,
          true: styles.switchTrackTrue.backgroundColor,
        }}
        thumbColor={
          value
            ? styles.switchThumbTrue.backgroundColor
            : styles.switchThumbFalse.backgroundColor
        }
      />
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t("notifications.settings.title")}
        </Text>

        {/* Master Toggle */}
        {renderToggle(
          t("notifications.settings.master_toggle"),
          preferences.enabled,
          (value) => updatePreference("enabled", value)
        )}
      </View>

      {preferences.enabled && (
        <>
          {/* Category Toggles */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Categories</Text>

            {renderToggle(
              t("notifications.settings.categories.ai_motivation"),
              preferences.aiMotivation,
              (value) => updatePreference("aiMotivation", value),
              !preferences.enabled
            )}

            {renderToggle(
              t("notifications.settings.categories.reminders"),
              preferences.reminders,
              (value) => updatePreference("reminders", value),
              !preferences.enabled
            )}

            {renderToggle(
              t("notifications.settings.categories.social"),
              preferences.social,
              (value) => updatePreference("social", value),
              !preferences.enabled
            )}

            {renderToggle(
              t("notifications.settings.categories.achievements"),
              preferences.achievements,
              (value) => updatePreference("achievements", value),
              !preferences.enabled
            )}

            {renderToggle(
              t("notifications.settings.categories.reengagement"),
              preferences.reengagement,
              (value) => updatePreference("reengagement", value),
              !preferences.enabled
            )}
          </View>

          {/* Quiet Hours */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("notifications.settings.quiet_hours.title")}
            </Text>
            <Text style={styles.sectionSubtitle}>
              {t("notifications.settings.quiet_hours.subtitle")}
            </Text>

            {renderToggle(
              t("notifications.settings.quiet_hours.enabled"),
              preferences.quietHours.enabled,
              (value) => updateQuietHours("enabled", value),
              !preferences.enabled
            )}
          </View>

          {/* Test Notification */}
          <View style={styles.section}>
            <TouchableOpacity
              style={[
                styles.testButton,
                isLoading && styles.testButtonDisabled,
              ]}
              onPress={sendTestNotification}
              disabled={isLoading || !preferences.enabled}
            >
              <Text
                style={[
                  styles.testButtonText,
                  isLoading && styles.testButtonTextDisabled,
                ]}
              >
                {isLoading
                  ? "Sending..."
                  : t("notifications.settings.test_notification")}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
};

const makeNotificationSettingsStyles = (
  tokens: any,
  colors: any,
  brand: any
) => {
  return {
    container: {
      flex: 1,
      backgroundColor: colors.bg.canvas,
    },
    section: {
      paddingHorizontal: toRN(tokens.spacing[6]),
      paddingVertical: toRN(tokens.spacing[4]),
      borderBottomWidth: 1,
      borderBottomColor: colors.border.primary,
    },
    sectionTitle: {
      fontSize: toRN(tokens.typography.fontSize.lg),
      fontWeight: tokens.typography.fontWeight.semibold,
      color: colors.text.primary,
      marginBottom: toRN(tokens.spacing[2]),
      fontFamily: fontFamily.groteskSemiBold,
    },
    sectionSubtitle: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.text.secondary,
      marginBottom: toRN(tokens.spacing[4]),
      fontFamily: fontFamily.groteskRegular,
    },
    toggleRow: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      paddingVertical: toRN(tokens.spacing[3]),
    },
    toggleLabel: {
      fontSize: toRN(tokens.typography.fontSize.base),
      color: colors.text.primary,
      flex: 1,
      fontFamily: fontFamily.groteskRegular,
    },
    disabledText: {
      color: colors.text.muted,
    },
    switchTrackFalse: {
      backgroundColor: colors.bg.secondary,
    },
    switchTrackTrue: {
      backgroundColor: brand.primary,
    },
    switchThumbFalse: {
      backgroundColor: colors.text.muted,
    },
    switchThumbTrue: {
      backgroundColor: brand.primaryForeground,
    },
    testButton: {
      backgroundColor: brand.primary,
      paddingVertical: toRN(tokens.spacing[4]),
      paddingHorizontal: toRN(tokens.spacing[6]),
      borderRadius: toRN(tokens.borderRadius.lg),
      alignItems: "center" as const,
    },
    testButtonDisabled: {
      backgroundColor: colors.bg.secondary,
    },
    testButtonText: {
      color: brand.primaryForeground,
      fontSize: toRN(tokens.typography.fontSize.base),
      fontWeight: tokens.typography.fontWeight.semibold,
      fontFamily: fontFamily.groteskSemiBold,
    },
    testButtonTextDisabled: {
      color: colors.text.muted,
    },
  };
};
