import { useAlertModal } from "@/contexts/AlertModalContext";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { notificationsService } from "@/services/api/notifications";
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
    ai_motivation: true,
    reminders: true,
    social: true,
    achievements: true,
    reengagement: true,
    quiet_hours_enabled: false,
    quiet_hours_start: "22:00",
    quiet_hours_end: "08:00",
    social_partner_requests: true,
    social_partner_nudges: true,
    social_partner_cheers: true,
    social_partner_milestones: true,
    social_challenge_invites: true,
    social_challenge_leaderboard: true,
    social_challenge_nudges: true,
    social_challenge_reminders: true,
    social_motivation_messages: true,
    push_notifications: true,
    email_notifications: true,
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
    value: any,
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
    value: any,
  ) => {
    try {
      // Map key to the correct flat field name
      const fieldMap = {
        enabled: "quiet_hours_enabled",
        start: "quiet_hours_start",
        end: "quiet_hours_end",
      } as const;

      const fieldName = fieldMap[key];
      const newPreferences = {
        ...preferences,
        [fieldName]: value,
      };
      setPreferences(newPreferences);
      await notificationService.updateNotificationPreferences(newPreferences);
    } catch (error) {
      console.error("Failed to update quiet hours:", error);
      setPreferences(preferences);
    }
  };

  const renderToggle = (
    label: string,
    value: boolean,
    onValueChange: (value: boolean) => void,
    disabled?: boolean,
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
          (value) => updatePreference("enabled", value),
        )}
      </View>

      {preferences.enabled && (
        <>
          {/* Category Toggles */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Categories</Text>

            {renderToggle(
              t("notifications.settings.categories.ai_motivation"),
              preferences.ai_motivation,
              (value) => updatePreference("ai_motivation", value),
              !preferences.enabled,
            )}

            {renderToggle(
              t("notifications.settings.categories.reminders"),
              preferences.reminders,
              (value) => updatePreference("reminders", value),
              !preferences.enabled,
            )}

            {renderToggle(
              t("notifications.settings.categories.social"),
              preferences.social,
              (value) => updatePreference("social", value),
              !preferences.enabled,
            )}

            {renderToggle(
              t("notifications.settings.categories.achievements"),
              preferences.achievements,
              (value) => updatePreference("achievements", value),
              !preferences.enabled,
            )}

            {renderToggle(
              t("notifications.settings.categories.reengagement"),
              preferences.reengagement,
              (value) => updatePreference("reengagement", value),
              !preferences.enabled,
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
              preferences.quiet_hours_enabled,
              (value) => updateQuietHours("enabled", value),
              !preferences.enabled,
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
};

const makeNotificationSettingsStyles = (
  tokens: any,
  colors: any,
  brand: any,
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
