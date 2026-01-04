import { Ionicons } from "@expo/vector-icons";
import React, { useCallback } from "react";
import {
  Image,
  ImageSourcePropType,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View
} from "react-native";

import { BackButton } from "@/components/ui/BackButton";
import { Card } from "@/components/ui/Card";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { VolumeSlider } from "@/components/ui/VolumeSlider";
import { useAudioPreferences, useUpdateAudioPreferences } from "@/hooks/api/useAudioPreferences";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { toRN } from "@/lib/units";
import { useStyles, useTheme } from "@/themes";
import { router } from "expo-router";

// Import music app icons
const AppleMusicIcon = require("@assetsimages/images/Apple_Music_icon.png");
const SpotifyIcon = require("@assetsimages/images/Spotify_icon.png");

type MusicAppOption = "playlist" | "apple_music" | "spotify";

interface MusicAppOptionItem {
  value: MusicAppOption;
  labelKey: string;
  icon?: keyof typeof Ionicons.glyphMap;
  image?: ImageSourcePropType;
}

const MUSIC_APP_OPTIONS: MusicAppOptionItem[] = [
  { value: "playlist", labelKey: "audio.music_app_playlist", icon: "musical-notes" },
  { value: "apple_music", labelKey: "audio.music_app_apple", image: AppleMusicIcon },
  { value: "spotify", labelKey: "audio.music_app_spotify", image: SpotifyIcon }
];

export default function AudioSettingsScreen() {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();

  const { data: preferences, isLoading } = useAudioPreferences();
  const updatePreferences = useUpdateAudioPreferences();

  const handleToggle = useCallback(
    (key: string, value: boolean) => {
      updatePreferences.mutate({ [key]: value });
    },
    [updatePreferences]
  );

  const handleVolumeChange = useCallback(
    (key: string, value: number) => {
      updatePreferences.mutate({ [key]: Math.round(value * 100) / 100 });
    },
    [updatePreferences]
  );

  const handleMusicAppChange = useCallback(
    (value: MusicAppOption) => {
      updatePreferences.mutate({ preferred_music_app: value });
    },
    [updatePreferences]
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <BackButton title={t("profile.audio_settings") || "Audio Settings"} />
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.section}>
            <SkeletonBox width="100%" height={200} borderRadius={16} />
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
        title={t("profile.audio_settings") || "Audio Settings"}
        onPress={() => router.back()}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Music Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("audio.music_section") || "Music"}</Text>
          <Card style={styles.card}>
            {/* Music Enabled */}
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: `${brandColors.primary}15` }]}>
                  <Ionicons name="musical-notes" size={20} color={brandColors.primary} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingLabel}>
                    {t("audio.music_enabled") || "Background Music"}
                  </Text>
                  <Text style={styles.settingDescription}>
                    {t("audio.music_enabled_desc") || "Play music during workouts"}
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences?.music_enabled ?? true}
                onValueChange={(value) => handleToggle("music_enabled", value)}
                trackColor={{
                  false: colors.border.subtle,
                  true: brandColors.primary
                }}
              />
            </View>

            {preferences?.music_enabled && (
              <>
                <View style={styles.divider} />
                {/* Music Volume */}
                <View style={styles.volumeRow}>
                  <Ionicons name="volume-low" size={20} color={colors.text.tertiary} />
                  <VolumeSlider
                    style={styles.slider}
                    value={preferences?.music_volume ?? 0.7}
                    onValueChange={(value) => handleVolumeChange("music_volume", value)}
                    minimumTrackTintColor={brandColors.primary}
                    maximumTrackTintColor={colors.border.subtle}
                    thumbTintColor="#FFFFFF"
                  />
                  <Ionicons name="volume-high" size={20} color={colors.text.tertiary} />
                </View>

                <View style={styles.divider} />
                {/* Shuffle */}
                <View style={styles.settingRow}>
                  <View style={styles.settingLeft}>
                    <View
                      style={[styles.settingIcon, { backgroundColor: `${colors.text.tertiary}10` }]}
                    >
                      <Ionicons name="shuffle" size={20} color={colors.text.tertiary} />
                    </View>
                    <Text style={styles.settingLabel}>{t("audio.shuffle") || "Shuffle"}</Text>
                  </View>
                  <Switch
                    value={preferences?.shuffle_enabled ?? true}
                    onValueChange={(value) => handleToggle("shuffle_enabled", value)}
                    trackColor={{
                      false: colors.border.subtle,
                      true: brandColors.primary
                    }}
                  />
                </View>
              </>
            )}
          </Card>
        </View>

        {/* Preferred Music App */}
        {preferences?.music_enabled && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("audio.preferred_app") || "Preferred Music App"}
            </Text>
            <Card style={styles.card}>
              {MUSIC_APP_OPTIONS.map((option, index) => (
                <React.Fragment key={option.value}>
                  <TouchableOpacity
                    style={styles.optionRow}
                    onPress={() => handleMusicAppChange(option.value)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.optionLeft}>
                      <View
                        style={[
                          styles.settingIcon,
                          { backgroundColor: `${colors.text.tertiary}10` }
                        ]}
                      >
                        {option.image ? (
                          <Image
                            source={option.image}
                            style={styles.appIcon}
                            resizeMode="contain"
                          />
                        ) : (
                          <Ionicons
                            name={option.icon || "musical-notes"}
                            size={20}
                            color={colors.text.tertiary}
                          />
                        )}
                      </View>
                      <Text style={styles.settingLabel}>{t(option.labelKey)}</Text>
                    </View>
                    {preferences?.preferred_music_app === option.value && (
                      <Ionicons name="checkmark-circle" size={22} color={brandColors.primary} />
                    )}
                  </TouchableOpacity>
                  {index < MUSIC_APP_OPTIONS.length - 1 && <View style={styles.divider} />}
                </React.Fragment>
              ))}
            </Card>
          </View>
        )}

        {/* Coach Voice Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("audio.coach_section") || "Coach Voice"}</Text>
          <Card style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: `${brandColors.primary}15` }]}>
                  <Ionicons name="mic" size={20} color={brandColors.primary} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingLabel}>
                    {t("audio.coach_enabled") || "Coach Voice"}
                  </Text>
                  <Text style={styles.settingDescription}>
                    {t("audio.coach_enabled_desc") || "Audio cues and instructions"}
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences?.coach_voice_enabled ?? true}
                onValueChange={(value) => handleToggle("coach_voice_enabled", value)}
                trackColor={{
                  false: colors.border.subtle,
                  true: brandColors.primary
                }}
              />
            </View>

            {preferences?.coach_voice_enabled && (
              <>
                <View style={styles.divider} />
                <View style={styles.volumeRow}>
                  <Ionicons name="volume-low" size={20} color={colors.text.tertiary} />
                  <VolumeSlider
                    style={styles.slider}
                    value={preferences?.coach_voice_volume ?? 0.8}
                    onValueChange={(value) => handleVolumeChange("coach_voice_volume", value)}
                    minimumTrackTintColor={brandColors.primary}
                    maximumTrackTintColor={colors.border.subtle}
                    thumbTintColor="#FFFFFF"
                  />
                  <Ionicons name="volume-high" size={20} color={colors.text.tertiary} />
                </View>
              </>
            )}
          </Card>
        </View>

        {/* Sound Effects Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("audio.effects_section") || "Sound Effects"}</Text>
          <Card style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: `${brandColors.primary}15` }]}>
                  <Ionicons name="notifications" size={20} color={brandColors.primary} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingLabel}>
                    {t("audio.effects_enabled") || "Sound Effects"}
                  </Text>
                  <Text style={styles.settingDescription}>
                    {t("audio.effects_enabled_desc") || "Completion sounds and alerts"}
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences?.sound_effects_enabled ?? true}
                onValueChange={(value) => handleToggle("sound_effects_enabled", value)}
                trackColor={{
                  false: colors.border.subtle,
                  true: brandColors.primary
                }}
              />
            </View>

            {preferences?.sound_effects_enabled && (
              <>
                <View style={styles.divider} />
                <View style={styles.volumeRow}>
                  <Ionicons name="volume-low" size={20} color={colors.text.tertiary} />
                  <VolumeSlider
                    style={styles.slider}
                    value={preferences?.sound_effects_volume ?? 0.8}
                    onValueChange={(value) => handleVolumeChange("sound_effects_volume", value)}
                    minimumTrackTintColor={brandColors.primary}
                    maximumTrackTintColor={colors.border.subtle}
                    thumbTintColor="#FFFFFF"
                  />
                  <Ionicons name="volume-high" size={20} color={colors.text.tertiary} />
                </View>
              </>
            )}
          </Card>
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
  card: {
    padding: 0,
    overflow: "hidden" as const
  },
  settingRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[4])
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
    flex: 1
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
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginLeft: toRN(tokens.spacing[4]) + 36 + toRN(tokens.spacing[3])
  },
  volumeRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[4])
  },
  slider: {
    flex: 1,
    height: toRN(44)
  },
  optionRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[4])
  },
  optionLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const
  },
  appIcon: {
    width: toRN(24),
    height: toRN(24),
    borderRadius: toRN(4)
  }
});
