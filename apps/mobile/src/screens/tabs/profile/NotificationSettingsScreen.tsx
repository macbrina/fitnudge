import { Switch } from "@/components/ui/Switch";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Linking, Platform, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import { useLiveActivitiesStatus } from "@/features/nextUp/ios/useLiveActivitiesStatus";

import { NotificationSettingsSkeleton } from "@/components/skeletons";
import { BackButton } from "@/components/ui/BackButton";
import { Card } from "@/components/ui/Card";
import { TimePicker } from "@/components/ui/TimePicker";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences
} from "@/hooks/api/useNotificationPreferences";
import { useUpdateProfile } from "@/hooks/api/useUser";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { toRN } from "@/lib/units";
import { NotificationPreferences } from "@/services/notifications/notificationTypes";
import { useAuthStore } from "@/stores/authStore";
import { useStyles, useTheme } from "@/themes";

// Default preferences for initial render before data loads
const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  ai_motivation: true,
  reminders: true,
  achievements: true,
  reengagement: true,
  weekly_recap: true,
  quiet_hours_enabled: false,
  quiet_hours_start: "22:00",
  quiet_hours_end: "08:00",
  partners: true,
  push_notifications: true,
  email_notifications: true
};

export default function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const router = useRouter();

  // User profile for morning motivation settings
  const { user, updateUser } = useAuthStore();
  const updateProfileMutation = useUpdateProfile();

  // Local state for morning motivation (to handle optimistic updates)
  const [morningMotivationEnabled, setMorningMotivationEnabled] = useState(
    user?.morning_motivation_enabled ?? true
  );
  const [morningMotivationTime, setMorningMotivationTime] = useState(
    user?.morning_motivation_time ?? "08:00"
  );

  // Sync local state when user changes
  useEffect(() => {
    if (user) {
      setMorningMotivationEnabled(user.morning_motivation_enabled ?? true);
      setMorningMotivationTime(user.morning_motivation_time ?? "08:00");
    }
  }, [user]);

  // Use React Query hooks for caching
  const {
    data: preferences = DEFAULT_PREFERENCES,
    isLoading,
    refetch
  } = useNotificationPreferences();
  const updatePreferencesMutation = useUpdateNotificationPreferences();

  const { enabled: liveActivitiesEnabled, refresh: refreshLiveActivitiesStatus } =
    useLiveActivitiesStatus();

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === "ios") refreshLiveActivitiesStatus();
    }, [refreshLiveActivitiesStatus])
  );

  const updatePreference = useCallback(
    (key: keyof NotificationPreferences, value: any) => {
      const newPreferences = { ...preferences, [key]: value };
      updatePreferencesMutation.mutate(newPreferences);
    },
    [preferences, updatePreferencesMutation]
  );

  // Update morning motivation settings (stored in users table)
  const updateMorningMotivation = useCallback(
    async (enabled: boolean, time?: string) => {
      // Optimistic update
      setMorningMotivationEnabled(enabled);
      if (time !== undefined) {
        setMorningMotivationTime(time);
      }

      try {
        const updateData: Record<string, any> = {
          morning_motivation_enabled: enabled
        };
        if (time !== undefined) {
          updateData.morning_motivation_time = time;
        }

        const response = await updateProfileMutation.mutateAsync(updateData);
        if (response.data) {
          updateUser(response.data);
        }
      } catch (error) {
        // Revert on error
        setMorningMotivationEnabled(user?.morning_motivation_enabled ?? true);
        if (time !== undefined) {
          setMorningMotivationTime(user?.morning_motivation_time ?? "08:00");
        }
        console.error("Failed to update morning motivation settings:", error);
      }
    },
    [user, updateProfileMutation, updateUser]
  );

  // Render setting row with icon
  // Link row for settings that open system Settings (e.g. Live Activities)
  const renderSettingsLinkRow = (
    icon: keyof typeof Ionicons.glyphMap,
    iconColor: string,
    label: string,
    description: string,
    statusLabel: string,
    onPress: () => void
  ) => (
    <Pressable
      style={({ pressed }) => [styles.settingRow, pressed && styles.settingRowPressed]}
      onPress={onPress}
    >
      <View style={styles.settingLeft}>
        <View style={[styles.settingIcon, { backgroundColor: `${iconColor}15` }]}>
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
        <View style={styles.settingContent}>
          <Text style={styles.settingLabel}>{label}</Text>
          <Text style={styles.settingDescription}>{description}</Text>
        </View>
      </View>
      <View style={styles.settingRight}>
        <Text style={styles.settingStatus}>{statusLabel}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
      </View>
    </Pressable>
  );

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
      <Switch value={value} onValueChange={onValueChange} disabled={disabled} size="sm" />
    </View>
  );

  if (isLoading) {
    return <NotificationSettingsSkeleton />;
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
            {Platform.OS === "ios" && (
              <>
                <View style={styles.divider} />
                {renderSettingsLinkRow(
                  "phone-landscape-outline",
                  "#8B5CF6",
                  t("notifications.settings.live_activities") || "Live Activities",
                  t("notifications.settings.live_activities_desc") ||
                    "Today's focus on Lock Screen",
                  liveActivitiesEnabled === null
                    ? "..."
                    : liveActivitiesEnabled
                      ? t("notifications.settings.live_activities_enabled") || "Enabled"
                      : t("notifications.settings.live_activities_disabled") || "Disabled",
                  () => Linking.openSettings()
                )}
              </>
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
                "people-outline",
                "#3B82F6",
                t("notifications.settings.categories.partners") || "Partners",
                t("notifications.settings.categories.partners_desc") ||
                  "Requests, nudges, cheers & milestones",
                preferences.partners,
                (value) => updatePreference("partners", value)
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
              <View style={styles.divider} />
              {renderSettingRow(
                "analytics-outline",
                "#14B8A6",
                t("notifications.settings.categories.weekly_recap") || "Weekly Recaps",
                t("notifications.settings.categories.weekly_recap_desc") ||
                  "Monday notifications when your recap is ready",
                preferences.weekly_recap,
                (value) => updatePreference("weekly_recap", value)
              )}
            </Card>
          </View>
        )}

        {/* Morning Motivation Section */}
        {preferences.enabled && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("notifications.settings.morning_motivation.title") || "Morning Motivation"}
            </Text>
            <Card style={styles.card}>
              {renderSettingRow(
                "sunny-outline",
                "#F59E0B",
                t("notifications.settings.morning_motivation.enabled") || "Daily Inspiration",
                t("notifications.settings.morning_motivation.enabled_desc") ||
                  "Receive a motivational message each morning",
                morningMotivationEnabled,
                (value) => updateMorningMotivation(value)
              )}

              {morningMotivationEnabled && (
                <View style={styles.timePickersContainer}>
                  <TimePicker
                    value={morningMotivationTime}
                    onChange={(time) => updateMorningMotivation(morningMotivationEnabled, time)}
                    label={t("notifications.settings.morning_motivation.time") || "Delivery Time"}
                  />
                </View>
              )}
            </Card>
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
  },
  settingRowPressed: {
    opacity: 0.7
  },
  settingRight: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1])
  },
  settingStatus: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
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
