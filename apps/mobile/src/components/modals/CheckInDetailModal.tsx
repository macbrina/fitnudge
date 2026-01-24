/**
 * Check-In Detail Modal
 *
 * Displays the details of a single check-in:
 * - Date and status (completed/missed/rest day)
 * - Mood (for completed) or skip reason (for missed)
 * - Note (if any)
 * - Voice note playback (if any)
 * - AI response (if any)
 */

import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Modal as RNModal,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  Easing,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from "react-native";
import { useAudioPlayer } from "expo-audio";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckIn } from "@/services/api/checkins";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import {
  X,
  CheckCircle,
  XCircle,
  Circle,
  Moon,
  MessageSquare,
  Calendar,
  Play,
  Pause,
  Mic,
  Sparkles,
  Lock
} from "lucide-react-native";
import { MoodIcons, SkipIcons } from "@/components/icons/CheckinIcons";
import { formatDate } from "@/utils/helper";
import Button from "@/components/ui/Button";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface CheckInDetailModalProps {
  isVisible: boolean;
  checkIn: CheckIn | null;
  goalTitle?: string;
  onClose: () => void;
}

export function CheckInDetailModal({
  isVisible,
  checkIn,
  goalTitle,
  onClose
}: CheckInDetailModalProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const insets = useSafeAreaInsets();
  const { getPlan, openModal: openSubscriptionModal } = useSubscriptionStore();
  const isPremium = getPlan() !== "free";

  // Animation
  const translateY = useMemo(() => new Animated.Value(SCREEN_HEIGHT), []);
  const [internalVisible, setInternalVisible] = useState(isVisible);

  // Voice note playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const player = useAudioPlayer(checkIn?.voice_note_url || undefined);

  useEffect(() => {
    if (isVisible) {
      setInternalVisible(true);
      // Reset to off-screen before animating in (fixes animation on subsequent opens)
      translateY.setValue(SCREEN_HEIGHT);
      Animated.spring(translateY, {
        toValue: 0,
        damping: 20,
        mass: 1,
        stiffness: 120,
        useNativeDriver: true
      }).start();
    } else if (internalVisible) {
      // Stop audio when closing modal
      if (isPlaying && player) {
        player.pause();
        setIsPlaying(false);
      }
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 300,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true
      }).start(() => {
        setInternalVisible(false);
      });
    }
  }, [isVisible, translateY, internalVisible]);

  // Track playback progress
  useEffect(() => {
    if (!player || !isPlaying) return;

    const interval = setInterval(() => {
      if (player.duration && player.duration > 0) {
        const progress = player.currentTime / player.duration;
        setPlaybackProgress(progress);

        // Check if playback completed
        if (player.currentTime >= player.duration - 0.1) {
          setIsPlaying(false);
          setPlaybackProgress(0);
          player.seekTo(0);
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [player, isPlaying]);

  // Voice note playback toggle
  const handleVoiceNoteToggle = useCallback(async () => {
    if (!player || !checkIn?.voice_note_url) return;

    try {
      if (isPlaying) {
        player.pause();
        setIsPlaying(false);
      } else {
        setIsLoadingAudio(true);
        await player.play();
        setIsPlaying(true);
        setIsLoadingAudio(false);
      }
    } catch (error) {
      console.error("Voice note playback error:", error);
      setIsLoadingAudio(false);
      setIsPlaying(false);
    }
  }, [player, isPlaying, checkIn?.voice_note_url]);

  // Format duration in seconds to MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!internalVisible || !checkIn) {
    return null;
  }

  // Determine status (V2: use status field)
  const getStatusInfo = () => {
    switch (checkIn.status) {
      case "rest_day":
        return {
          icon: <Moon size={24} color={colors.text.tertiary} />,
          label: t("checkin.rest_day"),
          color: colors.text.tertiary,
          bgColor: colors.bg.muted
        };
      case "completed":
        return {
          icon: <CheckCircle size={24} color={colors.feedback.success} />,
          label: t("goals.completed"),
          color: colors.feedback.success,
          bgColor: colors.feedback.success + "15"
        };
      case "pending":
        return {
          icon: <Circle size={24} color={colors.text.tertiary} />,
          label: t("goals.pending"),
          color: colors.text.tertiary,
          bgColor: colors.bg.muted
        };
      default:
        // missed or skipped
        return {
          icon: <XCircle size={24} color={colors.feedback.error} />,
          label: t("goals.missed"),
          color: colors.feedback.error,
          bgColor: colors.feedback.error + "15"
        };
    }
  };

  const statusInfo = getStatusInfo();

  // Get mood label
  const getMoodLabel = () => {
    if (!checkIn.mood) return null;
    return t(`checkin.mood.${checkIn.mood}`);
  };

  // Get skip reason label
  const getSkipReasonLabel = () => {
    if (!checkIn.skip_reason) return null;
    return t(`checkin.reason.${checkIn.skip_reason}`);
  };

  return (
    <RNModal
      visible={internalVisible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        {/* Backdrop */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [{ translateY }],
              paddingBottom: insets.bottom + toRN(tokens.spacing[4])
            }
          ]}
        >
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t("checkin.detail_title")}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              accessibilityLabel={t("common.close")}
            >
              <X size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Goal Title */}
            {goalTitle && <Text style={styles.goalTitle}>{goalTitle}</Text>}

            {/* Date */}
            <View style={styles.dateRow}>
              <Calendar size={16} color={colors.text.tertiary} />
              <Text style={styles.dateText}>{formatDate(checkIn.check_in_date)}</Text>
            </View>

            {/* Status Badge */}
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
              {statusInfo.icon}
              <Text style={[styles.statusText, { color: statusInfo.color }]}>
                {statusInfo.label}
              </Text>
            </View>

            {/* Mood (for completed) */}
            {checkIn.status === "completed" && checkIn.mood && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>{t("checkin.how_was_it")}</Text>
                <View style={styles.moodRow}>
                  <MoodIcons mood={checkIn.mood} size={32} />
                  <Text style={styles.moodText}>{getMoodLabel()}</Text>
                </View>
              </View>
            )}

            {/* Skip Reason (for skipped/missed) */}
            {(checkIn.status === "skipped" || checkIn.status === "missed") &&
              checkIn.skip_reason && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>{t("checkin.what_happened")}</Text>
                  <View style={styles.moodRow}>
                    <SkipIcons mood={checkIn.skip_reason} size={28} />
                    <Text style={styles.moodText}>{getSkipReasonLabel()}</Text>
                  </View>
                </View>
              )}

            {/* Note */}
            {checkIn.note && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>{t("checkin.notes")}</Text>
                <View style={styles.noteBox}>
                  <Text style={styles.noteText}>{checkIn.note}</Text>
                </View>
              </View>
            )}

            {/* Voice Note */}
            {checkIn.voice_note_url && (
              <View style={styles.detailSection}>
                <View style={styles.voiceNoteHeader}>
                  <Mic size={16} color={brandColors.primary} />
                  <Text style={styles.voiceNoteLabel}>{t("voice_notes.title_note")}</Text>
                </View>
                <View style={styles.voiceNotePlayer}>
                  {/* Play/Pause Button */}
                  <TouchableOpacity
                    style={[styles.playButton, { backgroundColor: brandColors.primary }]}
                    onPress={handleVoiceNoteToggle}
                    disabled={isLoadingAudio}
                  >
                    {isLoadingAudio ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : isPlaying ? (
                      <Pause size={20} color="#FFFFFF" />
                    ) : (
                      <Play size={20} color="#FFFFFF" style={{ marginLeft: 2 }} />
                    )}
                  </TouchableOpacity>

                  {/* Progress Bar */}
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${playbackProgress * 100}%`,
                            backgroundColor: brandColors.primary
                          }
                        ]}
                      />
                    </View>
                    <Text style={styles.durationText}>
                      {player?.duration
                        ? `${formatDuration(player.currentTime)} / ${formatDuration(player.duration)}`
                        : "0:00"}
                    </Text>
                  </View>
                </View>

                {/* Transcript (if available) */}
                {checkIn.voice_note_transcript && (
                  <View style={styles.transcriptBox}>
                    <Text style={styles.transcriptLabel}>{t("voice_notes.transcript")}</Text>
                    <Text style={styles.transcriptText}>{checkIn.voice_note_transcript}</Text>
                  </View>
                )}
              </View>
            )}

            {/* AI Response Section */}
            {checkIn.status === "completed" && (
              <View style={styles.detailSection}>
                <View style={styles.aiHeader}>
                  <MessageSquare size={16} color={brandColors.primary} />
                  <Text style={styles.aiLabel}>{t("checkin.ai_response")}</Text>
                </View>

                {checkIn.ai_response ? (
                  // Has AI response - show it
                  <View style={styles.aiBox}>
                    <Text style={styles.aiText}>{checkIn.ai_response}</Text>
                  </View>
                ) : isPremium ? (
                  // Premium user but no AI response yet - generating (updates via live checkIn when ready)
                  <View style={styles.aiGeneratingBox}>
                    <ActivityIndicator size="small" color={brandColors.primary} />
                    <View style={styles.aiGeneratingContent}>
                      <Text style={styles.aiGeneratingTitle}>
                        {t("checkin.ai_generating_title")}
                      </Text>
                      <Text style={styles.aiGeneratingText}>
                        {t("checkin.ai_generating_subtitle")}
                      </Text>
                    </View>
                  </View>
                ) : (
                  // Free user - show upsell
                  <View style={styles.aiUpsellBox}>
                    <View style={styles.aiUpsellHeader}>
                      <Lock size={20} color={colors.text.tertiary} />
                      <Text style={styles.aiUpsellTitle}>{t("checkin.ai_upsell_title")}</Text>
                    </View>
                    <Text style={styles.aiUpsellText}>{t("checkin.ai_upsell_subtitle")}</Text>
                    <Button
                      title={t("checkin.ai_upsell_cta")}
                      size="sm"
                      onPress={() => {
                        onClose();
                        openSubscriptionModal();
                      }}
                      style={styles.aiUpsellButton}
                    />
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  keyboardView: {
    flex: 1,
    justifyContent: "flex-end" as const
  },
  backdrop: {
    ...{
      position: "absolute" as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0
    },
    backgroundColor: "rgba(0, 0, 0, 0.5)"
  },
  modalContainer: {
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: toRN(tokens.borderRadius["2xl"]),
    borderTopRightRadius: toRN(tokens.borderRadius["2xl"]),
    maxHeight: SCREEN_HEIGHT * 0.85
  },
  handleContainer: {
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[3])
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border.default,
    borderRadius: 2
  },
  header: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[3]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle
  },
  headerTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  scrollView: {
    flexShrink: 1
  },
  scrollContent: {
    padding: toRN(tokens.spacing[4]),
    gap: toRN(tokens.spacing[4])
  },
  goalTitle: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
    textAlign: "center" as const
  },
  dateRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[2])
  },
  dateText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.tertiary
  },
  statusBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.lg),
    alignSelf: "center" as const
  },
  statusText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskSemiBold
  },
  detailSection: {
    gap: toRN(tokens.spacing[2])
  },
  detailLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.tertiary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5
  },
  moodRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3])
  },
  moodText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.primary
  },
  noteBox: {
    backgroundColor: colors.bg.muted,
    padding: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.md)
  },
  noteText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5
  },
  aiHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2])
  },
  aiLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskMedium,
    color: brand.primary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5
  },
  aiBox: {
    backgroundColor: brand.primary + "10",
    padding: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.md),
    borderLeftWidth: 3,
    borderLeftColor: brand.primary
  },
  aiText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.primary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5
  },
  // AI Generating State
  aiGeneratingBox: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: brand.primary + "10",
    padding: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.md),
    gap: toRN(tokens.spacing[3])
  },
  aiGeneratingContent: {
    flex: 1,
    gap: toRN(tokens.spacing[0.5])
  },
  aiGeneratingTitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskSemiBold,
    color: brand.primary
  },
  aiGeneratingText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.secondary
  },
  // AI Upsell State
  aiUpsellBox: {
    backgroundColor: colors.bg.muted,
    padding: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.md),
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2])
  },
  aiUpsellHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2])
  },
  aiUpsellTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary
  },
  aiUpsellText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.secondary,
    textAlign: "center" as const
  },
  aiUpsellButton: {
    marginTop: toRN(tokens.spacing[2])
  },
  // Voice Note Styles
  voiceNoteHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2])
  },
  voiceNoteLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskMedium,
    color: brand.primary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5
  },
  voiceNotePlayer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: colors.bg.muted,
    padding: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.lg),
    gap: toRN(tokens.spacing[3])
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  progressContainer: {
    flex: 1,
    gap: toRN(tokens.spacing[1])
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border.default,
    borderRadius: 2,
    overflow: "hidden" as const
  },
  progressFill: {
    height: "100%" as any,
    borderRadius: 2
  },
  durationText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.tertiary
  },
  transcriptBox: {
    backgroundColor: colors.bg.surface,
    padding: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.md),
    marginTop: toRN(tokens.spacing[2]),
    borderLeftWidth: 2,
    borderLeftColor: colors.border.default
  },
  transcriptLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.tertiary,
    marginBottom: toRN(tokens.spacing[1]),
    textTransform: "uppercase" as const,
    letterSpacing: 0.5
  },
  transcriptText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.secondary,
    fontStyle: "italic" as const,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5
  }
});

export default CheckInDetailModal;
