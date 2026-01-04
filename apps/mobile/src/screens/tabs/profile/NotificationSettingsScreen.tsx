import React, { useCallback } from "react";
import { RefreshControl, ScrollView, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { BackButton } from "@/components/ui/BackButton";
import { Card } from "@/components/ui/Card";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { TimePicker } from "@/components/ui/TimePicker";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { toRN } from "@/lib/units";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences
} from "@/hooks/api/useNotificationPreferences";
import { NotificationPreferences } from "@/services/notifications/notificationTypes";
import { useStyles, useTheme } from "@/themes";

// Default preferences for initial render before data loads
const DEFAULT_PREFERENCES: NotificationPreferences = {
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
  email_notifications: true
};

export default function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const router = useRouter();

  // Use React Query hooks for caching
  const {
    data: preferences = DEFAULT_PREFERENCES,
    isLoading,
    refetch
  } = useNotificationPreferences();
  const updatePreferencesMutation = useUpdateNotificationPreferences();

  const updatePreference = useCallback(
    (key: keyof NotificationPreferences, value: any) => {
      const newPreferences = { ...preferences, [key]: value };
      updatePreferencesMutation.mutate(newPreferences);
    },
    [preferences, updatePreferencesMutation]
  );

  // Render setting row with icon
  const renderSettingRow = (
    icon: keyof typeof Ionicons.glyphMap,
    iconColor: string,
    label: string,
    description: string | undefined,
    value: boolean,
    onValueChange: (value: boolean) => void,
    disabled?: boolean
  ) => (
    <View style={[styles.settingRow, disabled && styles.settingRowDisabled]}>
      <View style={styles.settingLeft}>
        <View style={[styles.settingIcon, { backgroundColor: `${iconColor}15` }]}>
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
        <View style={styles.settingContent}>
          <Text style={[styles.settingLabel, disabled && styles.disabledText]}>{label}</Text>
          {description && (
            <Text style={[styles.settingDescription, disabled && styles.disabledText]}>
              {description}
            </Text>
          )}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{
          false: colors.border.subtle,
          true: brandColors.primary
        }}
      />
    </View>
  );

  // Render simple toggle row (for sub-options)
  const renderSimpleToggle = (
    label: string,
    value: boolean,
    onValueChange: (value: boolean) => void,
    disabled?: boolean
  ) => (
    <View style={[styles.simpleToggleRow, disabled && styles.settingRowDisabled]}>
      <Text style={[styles.simpleToggleLabel, disabled && styles.disabledText]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{
          false: colors.border.subtle,
          true: brandColors.primary
        }}
      />
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <BackButton
          title={t("notifications.settings.title") || "Notification Settings"}
          onPress={() => router.back()}
        />
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.section}>
            <SkeletonBox width="100%" height={150} borderRadius={16} />
          </View>
          <View style={styles.section}>
            <SkeletonBox width="100%" height={300} borderRadius={16} />
          </View>
          <View style={styles.section}>
            <SkeletonBox width="100%" height={200} borderRadius={16} />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BackButton
        title={t("notifications.settings.title") || "Notification Settings"}
        onPress={() => router.back()}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => refetch()}
            tintColor={brandColors.primary}
          />
        }
      >
        {/* Master Controls Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("notifications.settings.channels") || "Channels"}
          </Text>
          <Card style={styles.card}>
            {renderSettingRow(
              "notifications",
              brandColors.primary,
              t("notifications.settings.master_toggle") || "All Notifications",
              t("notifications.settings.master_toggle_desc") ||
                "Enable or disable all notifications",
              preferences.enabled,
              (value) => updatePreference("enabled", value)
            )}
            <View style={styles.divider} />
            {renderSettingRow(
              "phone-portrait-outline",
              "#10B981",
              t("notifications.settings.push") || "Push Notifications",
              t("notifications.settings.push_desc") || "Receive notifications on your device",
              preferences.push_notifications,
              (value) => updatePreference("push_notifications", value),
              !preferences.enabled
            )}
            <View style={styles.divider} />
            {renderSettingRow(
              "mail-outline",
              "#6366F1",
              t("notifications.settings.email") || "Email Notifications",
              t("notifications.settings.email_desc") || "Receive updates via email",
              preferences.email_notifications,
              (value) => updatePreference("email_notifications", value),
              !preferences.enabled
            )}
          </Card>
        </View>

        {/* Categories Section */}
        {preferences.enabled && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("notifications.settings.categories_title") || "Categories"}
            </Text>
            <Card style={styles.card}>
              {renderSettingRow(
                "sparkles",
                "#F59E0B",
                t("notifications.settings.categories.ai_motivation") || "AI Motivation",
                t("notifications.settings.categories.ai_motivation_desc") ||
                  "Daily motivation & workout tips",
                preferences.ai_motivation,
                (value) => updatePreference("ai_motivation", value)
              )}
              <View style={styles.divider} />
              {renderSettingRow(
                "alarm-outline",
                "#EF4444",
                t("notifications.settings.categories.reminders") || "Reminders",
                t("notifications.settings.categories.reminders_desc") || "Workout & goal reminders",
                preferences.reminders,
                (value) => updatePreference("reminders", value)
              )}
              <View style={styles.divider} />
              {renderSettingRow(
                "trophy-outline",
                "#8B5CF6",
                t("notifications.settings.categories.achievements") || "Achievements",
                t("notifications.settings.categories.achievements_desc") ||
                  "Badges & milestone celebrations",
                preferences.achievements,
                (value) => updatePreference("achievements", value)
              )}
              <View style={styles.divider} />
              {renderSettingRow(
                "heart-outline",
                "#EC4899",
                t("notifications.settings.categories.reengagement") || "Re-engagement",
                t("notifications.settings.categories.reengagement_desc") ||
                  "We miss you when you're away",
                preferences.reengagement,
                (value) => updatePreference("reengagement", value)
              )}
            </Card>
          </View>
        )}

        {/* Social Section */}
        {preferences.enabled && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("notifications.settings.social_title") || "Social"}
            </Text>
            <Card style={styles.card}>
              {renderSettingRow(
                "people",
                "#3B82F6",
                t("notifications.settings.categories.social") || "Social Notifications",
                t("notifications.settings.social_desc") || "Partner & challenge updates",
                preferences.social,
                (value) => updatePreference("social", value)
              )}
            </Card>

            {/* Partner Sub-options */}
            {preferences.social && (
              <>
                <Text style={styles.subSectionTitle}>
                  {t("notifications.settings.partners_section") || "Partners"}
                </Text>
                <Card style={styles.card}>
                  {renderSimpleToggle(
                    t("notifications.settings.social.partner_requests") || "Partner Requests",
                    preferences.social_partner_requests,
                    (value) => updatePreference("social_partner_requests", value)
                  )}
                  <View style={styles.simpleDivider} />
                  {renderSimpleToggle(
                    t("notifications.settings.social.partner_nudges") || "Partner Nudges",
                    preferences.social_partner_nudges,
                    (value) => updatePreference("social_partner_nudges", value)
                  )}
                  <View style={styles.simpleDivider} />
                  {renderSimpleToggle(
                    t("notifications.settings.social.partner_cheers") || "Partner Cheers",
                    preferences.social_partner_cheers,
                    (value) => updatePreference("social_partner_cheers", value)
                  )}
                  <View style={styles.simpleDivider} />
                  {renderSimpleToggle(
                    t("notifications.settings.social.partner_milestones") || "Partner Milestones",
                    preferences.social_partner_milestones,
                    (value) => updatePreference("social_partner_milestones", value)
                  )}
                </Card>

                <Text style={styles.subSectionTitle}>
                  {t("notifications.settings.challenges_section") || "Challenges"}
                </Text>
                <Card style={styles.card}>
                  {renderSimpleToggle(
                    t("notifications.settings.social.challenge_invites") || "Challenge Invites",
                    preferences.social_challenge_invites,
                    (value) => updatePreference("social_challenge_invites", value)
                  )}
                  <View style={styles.simpleDivider} />
                  {renderSimpleToggle(
                    t("notifications.settings.social.challenge_leaderboard") ||
                      "Leaderboard Updates",
                    preferences.social_challenge_leaderboard,
                    (value) => updatePreference("social_challenge_leaderboard", value)
                  )}
                  <View style={styles.simpleDivider} />
                  {renderSimpleToggle(
                    t("notifications.settings.social.challenge_nudges") || "Challenge Nudges",
                    preferences.social_challenge_nudges,
                    (value) => updatePreference("social_challenge_nudges", value)
                  )}
                  <View style={styles.simpleDivider} />
                  {renderSimpleToggle(
                    t("notifications.settings.social.challenge_reminders") || "Challenge Reminders",
                    preferences.social_challenge_reminders,
                    (value) => updatePreference("social_challenge_reminders", value)
                  )}
                </Card>

                <Text style={styles.subSectionTitle}>
                  {t("notifications.settings.motivation_section") || "Motivation"}
                </Text>
                <Card style={styles.card}>
                  {renderSimpleToggle(
                    t("notifications.settings.social.motivation_messages") || "Motivation Messages",
                    preferences.social_motivation_messages,
                    (value) => updatePreference("social_motivation_messages", value)
                  )}
                </Card>
              </>
            )}
          </View>
        )}

        {/* Quiet Hours Section */}
        {preferences.enabled && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("notifications.settings.quiet_hours.title") || "Quiet Hours"}
            </Text>
            <Card style={styles.card}>
              {renderSettingRow(
                "moon-outline",
                "#6366F1",
                t("notifications.settings.quiet_hours.enabled") || "Quiet Hours",
                t("notifications.settings.quiet_hours.subtitle") ||
                  "Pause notifications during set times",
                preferences.quiet_hours_enabled,
                (value) => updatePreference("quiet_hours_enabled", value)
              )}

              {preferences.quiet_hours_enabled && (
                <View style={styles.timePickersContainer}>
                  <TimePicker
                    value={preferences.quiet_hours_start}
                    onChange={(time) => updatePreference("quiet_hours_start", time)}
                    label={t("notifications.settings.quiet_hours.start_time") || "Start Time"}
                  />
                  <TimePicker
                    value={preferences.quiet_hours_end}
                    onChange={(time) => updatePreference("quiet_hours_end", time)}
                    label={t("notifications.settings.quiet_hours.end_time") || "End Time"}
                  />
                </View>
              )}
            </Card>
          </View>
        )}
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
    paddingBottom: toRN(tokens.spacing[8])
  },
  section: {
    marginBottom: toRN(tokens.spacing[4]),
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
  subSectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[2]),
    marginLeft: toRN(tokens.spacing[1])
  },
  card: {
    padding: 0,
    overflow: "hidden" as const
  },
  settingRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: toRN(tokens.spacing[3])
    // paddingHorizontal: toRN(tokens.spacing[4])
  },
  settingRowDisabled: {
    opacity: 0.5
  },
  settingLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    flex: 1
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginRight: toRN(tokens.spacing[3])
  },
  settingContent: {
    flex: 1,
    paddingRight: toRN(tokens.spacing[2])
  },
  settingLabel: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.primary
  },
  settingDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[0.5])
  },
  disabledText: {
    color: colors.text.tertiary
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginLeft: toRN(tokens.spacing[4]) + 36 + toRN(tokens.spacing[3])
  },
  simpleDivider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginLeft: toRN(tokens.spacing[4])
  },
  timePickersContainer: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingTop: toRN(tokens.spacing[3]),
    paddingBottom: toRN(tokens.spacing[1])
  },
  simpleToggleRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[4])
  },
  simpleToggleLabel: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.primary,
    flex: 1
  }
});
