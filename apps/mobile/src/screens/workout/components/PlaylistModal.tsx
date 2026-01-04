import React from "react";
import { View, Text, TouchableOpacity, FlatList, Modal, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import type { WorkoutMusicTrack } from "@/types/audio";

interface PlaylistModalProps {
  visible: boolean;
  onClose: () => void;
  tracks: WorkoutMusicTrack[];
  currentTrack: WorkoutMusicTrack | null;
  onSelectTrack: (track: WorkoutMusicTrack) => void;
  isLoading?: boolean;
}

export function PlaylistModal({
  visible,
  onClose,
  tracks,
  currentTrack,
  onSelectTrack,
  isLoading = false
}: PlaylistModalProps) {
  const insets = useSafeAreaInsets();
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();

  const renderTrack = ({ item }: { item: WorkoutMusicTrack }) => {
    const isCurrentTrack = currentTrack?.id === item.id;

    return (
      <TouchableOpacity
        style={[styles.trackItem, isCurrentTrack && styles.trackItemActive]}
        onPress={() => onSelectTrack(item)}
      >
        <View style={styles.trackIcon}>
          <Ionicons
            name={isCurrentTrack ? "musical-notes" : "musical-note"}
            size={20}
            color={isCurrentTrack ? brandColors.primary : colors.text.tertiary}
          />
        </View>
        <View style={styles.trackInfo}>
          <Text
            style={[styles.trackTitle, isCurrentTrack && styles.trackTitleActive]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          {item.artist && (
            <Text style={styles.trackArtist} numberOfLines={1}>
              {item.artist}
            </Text>
          )}
        </View>
        <Text style={styles.trackDuration}>{formatDuration(item.duration_seconds)}</Text>
        {isCurrentTrack && (
          <Ionicons
            name="volume-high"
            size={18}
            color={brandColors.primary}
            style={styles.playingIndicator}
          />
        )}
      </TouchableOpacity>
    );
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
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>{t("workout.playlist", "Playlist")}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Track List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={brandColors.primary} />
          </View>
        ) : tracks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="musical-notes-outline" size={48} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>{t("workout.no_tracks", "No tracks available")}</Text>
          </View>
        ) : (
          <FlatList
            data={tracks}
            keyExtractor={(item) => item.id}
            renderItem={renderTrack}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + toRN(tokens.spacing[4]) }
            ]}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  );
}

function formatDuration(seconds?: number): string {
  if (!seconds) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.card
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[3]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle
  },
  backButton: {
    width: toRN(40),
    height: toRN(40),
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  headerSpacer: {
    width: toRN(40)
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[3])
  },
  emptyText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary
  },
  listContent: {
    padding: toRN(tokens.spacing[4])
  },
  trackItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.lg),
    marginBottom: toRN(tokens.spacing[2])
  },
  trackItemActive: {
    backgroundColor: brand.primary + "15"
  },
  trackIcon: {
    width: toRN(40),
    height: toRN(40),
    borderRadius: toRN(8),
    backgroundColor: colors.bg.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  trackInfo: {
    flex: 1,
    marginLeft: toRN(tokens.spacing[3])
  },
  trackTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.primary
  },
  trackTitleActive: {
    color: brand.primary
  },
  trackArtist: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginTop: toRN(2)
  },
  trackDuration: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginLeft: toRN(tokens.spacing[2])
  },
  playingIndicator: {
    marginLeft: toRN(tokens.spacing[2])
  }
});

export default PlaylistModal;
