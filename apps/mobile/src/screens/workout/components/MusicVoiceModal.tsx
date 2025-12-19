import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  Modal,
  Linking,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { VolumeSlider } from "@/components/ui/VolumeSlider";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { ActionSheet } from "@/components/ui/ActionSheet";
import type { WorkoutMusicTrack, UserAudioPreferences } from "@/types/audio";
import Button from "@/components/ui/Button";
import { PlaylistModal } from "./PlaylistModal";

// Import icons
const AppleMusicIcon = require("@assetsimages/images/Apple_Music_icon.png");
const SpotifyIcon = require("@assetsimages/images/Spotify_icon.png");

interface MusicVoiceModalProps {
  visible: boolean;
  onClose: () => void;

  // Music state
  currentTrack: WorkoutMusicTrack | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onShuffle: () => void;
  isShuffleOn: boolean;

  // Preferences
  preferences: UserAudioPreferences;
  onUpdatePreferences: (updates: Partial<UserAudioPreferences>) => void;

  // Playlist (optional - for displaying and selecting tracks)
  tracks?: WorkoutMusicTrack[];
  onSelectTrack?: (track: WorkoutMusicTrack) => void;
  isLoadingTracks?: boolean;
}

export function MusicVoiceModal({
  visible,
  onClose,
  currentTrack,
  isPlaying,
  onPlayPause,
  onPrevious,
  onNext,
  onShuffle,
  isShuffleOn,
  preferences,
  onUpdatePreferences,
  tracks = [],
  onSelectTrack,
  isLoadingTracks = false,
}: MusicVoiceModalProps) {
  const insets = useSafeAreaInsets();
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();

  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showOtherApps, setShowOtherApps] = useState(false);

  // Handle external app selection
  const handleOpenAppleMusic = () => {
    Linking.openURL("music://");
    onUpdatePreferences({ preferred_music_app: "apple_music" });
  };

  const handleOpenSpotify = () => {
    Linking.openURL("spotify://");
    onUpdatePreferences({ preferred_music_app: "spotify" });
  };

  const handleSelectTrack = (track: WorkoutMusicTrack) => {
    onSelectTrack?.(track);
    setShowPlaylist(false);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {t("workout.music_voice_title", "Music & Voice")}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={[
            styles.contentContainer,
            { paddingBottom: insets.bottom + toRN(tokens.spacing[6]) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* ========== MUSIC SECTION ========== */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {t("workout.music", "Music")}
              </Text>
              <Switch
                value={preferences.music_enabled}
                onValueChange={(value) =>
                  onUpdatePreferences({ music_enabled: value })
                }
                trackColor={{
                  false: colors.border.subtle,
                  true: brandColors.primary,
                }}
              />
            </View>

            {preferences.music_enabled && (
              <>
                {/* Now Playing */}
                {currentTrack && (
                  <View style={styles.nowPlaying}>
                    <Ionicons
                      name="musical-notes"
                      size={16}
                      color={colors.text.tertiary}
                    />
                    <Text style={styles.nowPlayingText} numberOfLines={1}>
                      {currentTrack.title}
                      {currentTrack.artist && ` - ${currentTrack.artist}`}
                    </Text>
                  </View>
                )}

                {/* Playback Controls */}
                <View style={styles.playbackControls}>
                  <TouchableOpacity
                    style={styles.controlButton}
                    onPress={onPrevious}
                  >
                    <Ionicons
                      name="play-skip-back"
                      size={24}
                      color={colors.text.primary}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.controlButton}
                    onPress={onPlayPause}
                  >
                    <Ionicons
                      name={isPlaying ? "pause" : "play"}
                      size={24}
                      color={colors.text.primary}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.controlButton}
                    onPress={onNext}
                  >
                    <Ionicons
                      name="play-skip-forward"
                      size={24}
                      color={colors.text.primary}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.controlButton,
                      isShuffleOn && styles.controlButtonActive,
                    ]}
                    onPress={onShuffle}
                  >
                    <Ionicons
                      name="shuffle"
                      size={24}
                      color={
                        isShuffleOn ? brandColors.primary : colors.text.primary
                      }
                    />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.controlButton} disabled>
                    <Ionicons
                      name="repeat"
                      size={24}
                      color={colors.text.tertiary}
                    />
                  </TouchableOpacity>
                </View>

                {/* Volume Slider */}
                <View style={styles.volumeRow}>
                  <Ionicons
                    name="volume-low"
                    size={20}
                    color={colors.text.tertiary}
                  />
                  <VolumeSlider
                    style={styles.slider}
                    value={preferences.music_volume}
                    onValueChange={(value) =>
                      onUpdatePreferences({ music_volume: value })
                    }
                    minimumTrackTintColor={brandColors.primary}
                    maximumTrackTintColor={colors.border.subtle}
                    thumbTintColor="#FFFFFF"
                  />
                  <Ionicons
                    name="volume-high"
                    size={20}
                    color={colors.text.tertiary}
                  />
                </View>

                {/* Playlist / Other Apps */}
                <View style={styles.musicSourceRow}>
                  <TouchableOpacity
                    style={styles.musicSourceButton}
                    onPress={() => setShowPlaylist(true)}
                  >
                    <Text style={styles.musicSourceText}>
                      {t("workout.playlist", "Playlist")}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.musicSourceDivider} />

                  <TouchableOpacity
                    style={styles.otherAppsButton}
                    onPress={() => setShowOtherApps(true)}
                  >
                    <View style={styles.appIconsStack}>
                      <Image
                        source={AppleMusicIcon}
                        style={[styles.appIcon, styles.appIconBottom]}
                        resizeMode="contain"
                      />
                      <Image
                        source={SpotifyIcon}
                        style={[styles.appIcon, styles.appIconTop]}
                        resizeMode="contain"
                      />
                    </View>
                    <Text style={styles.otherAppsLabel}>
                      {t("workout.other_apps", "Other Apps")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          {/* ========== COACH VOICE SECTION ========== */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {t("workout.coach_voice", "Coach Voice")}
              </Text>
              <Switch
                value={preferences.coach_voice_enabled}
                onValueChange={(value) =>
                  onUpdatePreferences({ coach_voice_enabled: value })
                }
                trackColor={{
                  false: colors.border.subtle,
                  true: brandColors.primary,
                }}
              />
            </View>

            {preferences.coach_voice_enabled && (
              <View style={styles.volumeRow}>
                <Ionicons
                  name="volume-low"
                  size={20}
                  color={colors.text.tertiary}
                />
                <VolumeSlider
                  style={styles.slider}
                  value={preferences.coach_voice_volume}
                  onValueChange={(value) =>
                    onUpdatePreferences({ coach_voice_volume: value })
                  }
                  minimumTrackTintColor={brandColors.primary}
                  maximumTrackTintColor={colors.border.subtle}
                  thumbTintColor="#FFFFFF"
                />
                <Ionicons
                  name="volume-high"
                  size={20}
                  color={colors.text.tertiary}
                />
              </View>
            )}
          </View>

          {/* ========== SOUND EFFECTS SECTION ========== */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>
                  {t("workout.sound_effects", "Sound Effects")}
                </Text>
                <Text style={styles.sectionSubtitle}>
                  {t(
                    "workout.sound_effects_desc",
                    "'Ding' sound after exercises, etc."
                  )}
                </Text>
              </View>
              <Switch
                value={preferences.sound_effects_enabled}
                onValueChange={(value) =>
                  onUpdatePreferences({ sound_effects_enabled: value })
                }
                trackColor={{
                  false: colors.border.subtle,
                  true: brandColors.primary,
                }}
              />
            </View>

            {preferences.sound_effects_enabled && (
              <View style={styles.volumeRow}>
                <Ionicons
                  name="volume-low"
                  size={20}
                  color={colors.text.tertiary}
                />
                <VolumeSlider
                  style={styles.slider}
                  value={preferences.sound_effects_volume}
                  onValueChange={(value) =>
                    onUpdatePreferences({ sound_effects_volume: value })
                  }
                  minimumTrackTintColor={brandColors.primary}
                  maximumTrackTintColor={colors.border.subtle}
                  thumbTintColor="#FFFFFF"
                />
                <Ionicons
                  name="volume-high"
                  size={20}
                  color={colors.text.tertiary}
                />
              </View>
            )}
          </View>
        </ScrollView>

        {/* Done Button */}
        <View
          style={[
            styles.footer,
            { paddingBottom: insets.bottom + toRN(tokens.spacing[4]) },
          ]}
        >
          <Button
            title={t("common.done", "Done")}
            onPress={onClose}
            variant="primary"
            fullWidth
          />
        </View>

        {/* Playlist Modal */}
        <PlaylistModal
          visible={showPlaylist}
          onClose={() => setShowPlaylist(false)}
          tracks={tracks}
          currentTrack={currentTrack}
          onSelectTrack={handleSelectTrack}
          isLoading={isLoadingTracks}
        />

        {/* Other Apps Action Sheet */}
        <ActionSheet
          visible={showOtherApps}
          title={t("workout.other_apps", "Other Apps")}
          options={[
            {
              id: "apple_music",
              label: "Apple Music",
              icon: "musical-notes",
              onPress: handleOpenAppleMusic,
            },
            {
              id: "spotify",
              label: "Spotify",
              icon: "logo-spotify" as any,
              onPress: handleOpenSpotify,
            },
          ]}
          onClose={() => setShowOtherApps(false)}
          cancelLabel={t("common.close", "Close")}
        />
      </View>
    </Modal>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: toRN(tokens.spacing[5]),
    paddingVertical: toRN(tokens.spacing[4]),
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
  },
  closeButton: {
    width: toRN(32),
    height: toRN(32),
    borderRadius: toRN(16),
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: colors.bg.muted,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: toRN(tokens.spacing[5]),
    gap: toRN(tokens.spacing[4]),
  },

  // Section - full width, no rounded corners
  section: {
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.xl),
    padding: toRN(tokens.spacing[4]),
  },
  sectionHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
  sectionSubtitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[0.5]),
  },

  // Now Playing
  nowPlaying: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    marginTop: toRN(tokens.spacing[3]),
  },
  nowPlayingText: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
  },

  // Playback Controls
  playbackControls: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[4]),
    marginTop: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[4]),
  },
  controlButton: {
    width: toRN(44),
    height: toRN(44),
    borderRadius: toRN(22),
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  controlButtonActive: {
    backgroundColor: brand.primary + "20",
  },

  // Volume Row
  volumeRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    marginTop: toRN(tokens.spacing[3]),
  },
  slider: {
    flex: 1,
    height: toRN(44),
  },

  // Music Source
  musicSourceRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginTop: toRN(tokens.spacing[4]),
    paddingTop: toRN(tokens.spacing[3]),
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  musicSourceButton: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: toRN(tokens.spacing[2]),
  },
  musicSourceDivider: {
    width: 1,
    height: toRN(40),
    backgroundColor: colors.border.default,
  },
  musicSourceText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.bold,
    color: brand.primary,
  },
  otherAppsButton: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[2]),
  },
  appIconsStack: {
    width: toRN(28),
    height: toRN(28),
    position: "relative" as const,
  },
  appIconBottom: {
    position: "absolute" as const,
    left: 0,
    bottom: 0,
  },
  appIconTop: {
    position: "absolute" as const,
    right: 0,
    top: 0,
  },
  appIcon: {
    width: toRN(18),
    height: toRN(18),
    borderRadius: toRN(4),
  },
  otherAppsLabel: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.bold,
    color: brand.primary,
  },

  // Footer
  footer: {
    paddingHorizontal: toRN(tokens.spacing[5]),
    paddingTop: toRN(tokens.spacing[3]),
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    backgroundColor: colors.bg.canvas,
  },
});

export default MusicVoiceModal;
