/**
 * V2 Check-In Modal
 *
 * Simple check-in flow following the V2 spec:
 * - Yes / No / Rest Day response
 * - Optional mood (for Yes): tough / good / amazing
 * - Optional skip reason (for No): work / tired / sick / schedule / other
 * - Optional note (max 140 chars)
 */

import React, { useEffect, useState, useRef, useCallback } from "react";
import * as Haptics from "expo-haptics";
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
  StyleSheet,
  Keyboard,
  ActivityIndicator
} from "react-native";
import { useStyles, useTheme } from "@/themes";
import { tokens, lineHeight } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCreateCheckIn } from "@/hooks/api/useCheckIns";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { CheckInMood, MOODS, SKIP_REASONS, SkipReason } from "@/services/api/checkins";
import Button from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { X, CheckCircle, XCircle, Moon, Mic, Crown, Play, Pause } from "lucide-react-native";
import { MoodIcons, SkipIcons } from "@/components/icons/CheckinIcons";
import { VoiceNoteRecorder } from "@/components/ui/VoiceNoteRecorder";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { voiceNotesService } from "@/services/api/voiceNotes";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// V2 Check-in types
type CheckInResponse = "yes" | "no" | "rest_day";

interface Goal {
  id: string;
  title: string;
  why_statement?: string;
}

interface CheckInModalProps {
  isVisible: boolean;
  goal: Goal;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CheckInModal({ isVisible, goal, onClose, onSuccess }: CheckInModalProps) {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { showToast } = useAlertModal();

  // Animation
  const [slideAnim] = useState(new Animated.Value(SCREEN_HEIGHT));
  const [fadeAnim] = useState(new Animated.Value(0));

  // Form state
  const [response, setResponse] = useState<CheckInResponse | null>(null);
  const [mood, setMood] = useState<CheckInMood | null>(null);
  const [skipReason, setSkipReason] = useState<SkipReason | null>(null);
  const [note, setNote] = useState("");
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [voiceNoteUri, setVoiceNoteUri] = useState<string | null>(null);
  const [voiceNoteDuration, setVoiceNoteDuration] = useState<number>(0);
  const [isPlayingVoiceNote, setIsPlayingVoiceNote] = useState(false);
  const [isPlaybackLoading, setIsPlaybackLoading] = useState(false);

  // Premium check for voice notes
  const { hasFeature, getFeatureValue, openModal } = useSubscriptionStore();
  const hasVoiceNotes = hasFeature("voice_notes");
  const voiceNoteMaxDuration =
    (getFeatureValue("voice_note_max_duration") as number | null | undefined) ?? 30;

  // Playback for the recorded voice note preview (play before submitting)
  const voiceNotePlayer = useAudioPlayer(voiceNoteUri ?? undefined);

  // Mutations
  const createCheckIn = useCreateCheckIn();

  // Scroll ref for auto-scrolling to note input
  const scrollViewRef = useRef<ScrollView>(null);
  const recorderActionsRef = useRef<{
    stopRecording: () => Promise<{ uri: string | null; duration: number }>;
    stopPlayback: () => Promise<void>;
  } | null>(null);

  const setRecorderActions = useCallback(
    (
      actions: {
        stopRecording: () => Promise<{ uri: string | null; duration: number }>;
        stopPlayback: () => Promise<void>;
      } | null
    ) => {
      recorderActionsRef.current = actions;
    },
    []
  );

  // Animation effects
  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true
        })
      ]).start();
    }
  }, [isVisible, fadeAnim, slideAnim]);

  // Reset form when modal opens
  useEffect(() => {
    if (isVisible) {
      setResponse(null);
      setMood(null);
      setSkipReason(null);
      setNote("");
      setShowVoiceRecorder(false);
      setVoiceNoteUri(null);
      setVoiceNoteDuration(0);
      setIsPlayingVoiceNote(false);
      setIsPlaybackLoading(false);
    }
  }, [isVisible]);

  // When preview is cleared, stop playback
  useEffect(() => {
    if (!voiceNoteUri && isPlayingVoiceNote) {
      voiceNotePlayer?.pause?.();
      setIsPlayingVoiceNote(false);
    }
  }, [voiceNoteUri, isPlayingVoiceNote]);

  // Auto-scroll to show full VoiceNoteRecorder when recording starts
  useEffect(() => {
    if (showVoiceRecorder) {
      const t = setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 150);
      return () => clearTimeout(t);
    }
  }, [showVoiceRecorder]);

  // Detect when voice note playback finishes
  useEffect(() => {
    if (!voiceNoteUri || !isPlayingVoiceNote || !voiceNotePlayer) return;
    const interval = setInterval(() => {
      const dur = voiceNotePlayer.duration ?? voiceNoteDuration;
      if (dur > 0 && (voiceNotePlayer.currentTime ?? 0) >= dur - 0.1) {
        setIsPlayingVoiceNote(false);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [voiceNoteUri, isPlayingVoiceNote, voiceNotePlayer, voiceNoteDuration]);

  // Stop playback and recording (if active), then close and submit. Voice note upload runs after create succeeds (fire-and-forget).
  // When user submits while still recording, we stop first and use returned { uri, duration } so we don't miss the VN.
  const handleSubmit = useCallback(async () => {
    if (!response) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (isPlayingVoiceNote && voiceNotePlayer) {
      voiceNotePlayer.pause();
      setIsPlayingVoiceNote(false);
    }

    let uri: string | null = voiceNoteUri;
    let dur: number = voiceNoteDuration;

    if (showVoiceRecorder && recorderActionsRef.current) {
      await recorderActionsRef.current.stopPlayback();
      const stopped = await recorderActionsRef.current.stopRecording();
      if (stopped.uri != null) {
        uri = stopped.uri;
        dur = stopped.duration;
      }
    }

    const expectVoiceNote = !!(uri != null && dur != null);

    const checkInPayload = {
      goal_id: goal.id,
      check_in_date: new Date().toISOString().split("T")[0],
      completed: response === "yes",
      is_rest_day: response === "rest_day",
      mood: mood || undefined,
      skip_reason: skipReason || undefined,
      note: note.trim() || undefined,
      expect_voice_note: expectVoiceNote
    };

    onClose();
    onSuccess?.();

    const attemptSubmit = (retryCount: number) => {
      createCheckIn.mutate(checkInPayload, {
        onSuccess: (res) => {
          if (uri != null && dur != null && res?.data?.id) {
            voiceNotesService.uploadVoiceNote(res.data.id, uri, dur).catch((e) => {
              const msg = e?.response?.data?.detail ?? e?.message ?? String(e);
              console.warn("[CheckInModal] Voice note upload failed:", msg);
            });
          }
        },
        onError: () => {
          if (retryCount < 1) setTimeout(() => attemptSubmit(retryCount + 1), 1000);
        }
      });
    };
    attemptSubmit(0);
  }, [
    response,
    goal.id,
    mood,
    skipReason,
    note,
    voiceNoteUri,
    voiceNoteDuration,
    isPlayingVoiceNote,
    voiceNotePlayer,
    showVoiceRecorder,
    createCheckIn,
    onClose,
    onSuccess
  ]);

  // Can submit?
  const canSubmit = response !== null;

  if (!isVisible) return null;

  return (
    <RNModal transparent visible={isVisible} animationType="none" onRequestClose={onClose}>
      <View style={styles.modalWrapper}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
        </Animated.View>

        {/* Modal Content */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "position" : "height"}
          style={styles.keyboardAvoidingContainer}
          contentContainerStyle={styles.keyboardAvoidingContent}
        >
          <Animated.View
            style={[
              styles.container,
              { paddingBottom: insets.bottom + 16 },
              { transform: [{ translateY: slideAnim }] }
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={styles.title} numberOfLines={1}>
                  {goal.title}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={scrollViewRef}
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              {/* Response Buttons */}
              <Text style={styles.sectionTitle}>{t("checkin.did_you_complete")}</Text>
              <View style={styles.responseButtons}>
                {/* Yes */}
                <TouchableOpacity
                  style={[
                    styles.responseButton,
                    response === "yes" && {
                      borderColor: colors.feedback.success,
                      backgroundColor: colors.feedback.success + "10"
                    }
                  ]}
                  onPress={() => {
                    setResponse("yes");
                    setSkipReason(null);
                  }}
                >
                  <CheckCircle
                    size={28}
                    color={response === "yes" ? colors.feedback.success : colors.text.tertiary}
                  />
                  <Text
                    style={[
                      styles.responseLabel,
                      response === "yes" && { color: colors.feedback.success }
                    ]}
                  >
                    {t("checkin.yes")}
                  </Text>
                </TouchableOpacity>

                {/* No */}
                <TouchableOpacity
                  style={[
                    styles.responseButton,
                    response === "no" && {
                      borderColor: colors.feedback.error,
                      backgroundColor: colors.feedback.error + "10"
                    }
                  ]}
                  onPress={() => {
                    setResponse("no");
                    setMood(null);
                  }}
                >
                  <XCircle
                    size={28}
                    color={response === "no" ? colors.feedback.error : colors.text.tertiary}
                  />
                  <Text
                    style={[
                      styles.responseLabel,
                      response === "no" && { color: colors.feedback.error }
                    ]}
                  >
                    {t("checkin.no")}
                  </Text>
                </TouchableOpacity>

                {/* Rest Day */}
                <TouchableOpacity
                  style={[
                    styles.responseButton,
                    response === "rest_day" && {
                      borderColor: brandColors.primary,
                      backgroundColor: brandColors.primary + "10"
                    }
                  ]}
                  onPress={() => {
                    setResponse("rest_day");
                    setMood(null);
                    setSkipReason(null);
                  }}
                >
                  <Moon
                    size={28}
                    color={response === "rest_day" ? brandColors.primary : colors.text.tertiary}
                  />
                  <Text
                    style={[
                      styles.responseLabel,
                      response === "rest_day" && { color: brandColors.primary }
                    ]}
                  >
                    {t("checkin.rest_day")}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Mood (only for Yes) */}
              {response === "yes" && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    {t("checkin.how_was_it")}{" "}
                    <Text style={styles.optional}>({t("common.optional")})</Text>
                  </Text>
                  <View style={styles.optionRow}>
                    {MOODS.map((item) => (
                      <TouchableOpacity
                        key={item.value}
                        style={[
                          styles.optionButton,
                          mood === item.value && {
                            borderColor: brandColors.primary,
                            backgroundColor: brandColors.primary + "10"
                          }
                        ]}
                        onPress={() => setMood(item.value)}
                      >
                        <MoodIcons mood={item.value} size={36} />
                        <Text
                          style={[
                            styles.optionLabel,
                            mood === item.value && { color: brandColors.primary }
                          ]}
                        >
                          {t(item.labelKey)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Miss Screen (only for No) - Per V2 Spec */}
              {response === "no" && (
                <View style={styles.section}>
                  {/* Supportive message */}
                  <View style={styles.missIntro}>
                    <Text style={styles.missMessage}>{t("checkin.miss_message")}</Text>
                  </View>

                  {/* What got in the way? */}
                  <Text style={styles.sectionTitle}>
                    {t("checkin.what_happened")}{" "}
                    <Text style={styles.optional}>({t("common.optional")})</Text>
                  </Text>
                  <View style={styles.reasonGrid}>
                    {SKIP_REASONS.map((item) => (
                      <TouchableOpacity
                        key={item.value}
                        style={[
                          styles.reasonButton,
                          skipReason === item.value && {
                            borderColor: brandColors.primary,
                            backgroundColor: brandColors.primary + "10"
                          }
                        ]}
                        onPress={() => setSkipReason(item.value)}
                      >
                        <SkipIcons mood={item.value} size={32} />
                        <Text
                          style={[
                            styles.reasonLabel,
                            skipReason === item.value && { color: brandColors.primary }
                          ]}
                        >
                          {t(item.labelKey)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Closing encouragement */}
                  <Text style={styles.tomorrowMessage}>{t("checkin.tomorrow_new_chance")}</Text>
                </View>
              )}

              {/* Rest Day Message */}
              {response === "rest_day" && (
                <View style={styles.restMessage}>
                  <Text style={styles.restEmoji}>💤</Text>
                  <Text style={styles.restText}>{t("checkin.rest_message")}</Text>
                </View>
              )}

              {/* Note (for Yes and No) */}
              {(response === "yes" || response === "no") && (
                <View style={styles.section}>
                  <TextInput
                    label={`${t("checkin.add_note")} (${t("common.optional")})`}
                    placeholder={t("checkin.note_placeholder")}
                    value={note}
                    onChangeText={(text) => setNote(text.slice(0, 140))}
                    multiline
                    numberOfLines={3}
                    maxLength={140}
                    containerStyle={styles.noteInputContainer}
                    onFocus={() => {
                      // Scroll to bottom when note input is focused
                      setTimeout(() => {
                        scrollViewRef.current?.scrollToEnd({ animated: true });
                      }, 100);
                    }}
                  />
                  <Text style={styles.charCount}>{note.length}/140</Text>

                  {/* Voice Note Section (Yes/No, Premium feature) */}
                  {(response === "yes" || response === "no") &&
                    !showVoiceRecorder &&
                    !voiceNoteUri && (
                      <TouchableOpacity
                        style={[
                          styles.voiceNoteButton,
                          !hasVoiceNotes && styles.voiceNoteButtonPro
                        ]}
                        onPress={() => {
                          if (hasVoiceNotes) {
                            setShowVoiceRecorder(true);
                          } else {
                            openModal();
                          }
                        }}
                      >
                        <Mic
                          size={18}
                          color={hasVoiceNotes ? brandColors.primary : colors.text.tertiary}
                        />
                        <Text
                          style={[
                            styles.voiceNoteButtonText,
                            { color: hasVoiceNotes ? brandColors.primary : colors.text.tertiary }
                          ]}
                        >
                          {t("voice_notes.title")}
                        </Text>
                        {!hasVoiceNotes && <Crown size={18} color={colors.feedback.warning} />}
                      </TouchableOpacity>
                    )}

                  {/* Voice Recorder — premium: starts recording immediately, no extra tap */}
                  {(response === "yes" || response === "no") && showVoiceRecorder && (
                    <VoiceNoteRecorder
                      startImmediately={hasVoiceNotes}
                      maxDurationSeconds={voiceNoteMaxDuration}
                      onRecordingComplete={(uri, dur) => {
                        setVoiceNoteUri(uri);
                        setVoiceNoteDuration(dur);
                        setShowVoiceRecorder(false);
                      }}
                      onCancel={() => setShowVoiceRecorder(false)}
                      onRegisterActions={setRecorderActions}
                    />
                  )}

                  {/* Voice Note Preview (after recording) — play to listen before submitting */}
                  {(response === "yes" || response === "no") &&
                    voiceNoteUri &&
                    !showVoiceRecorder && (
                      <View style={styles.voiceNotePreview}>
                        <TouchableOpacity
                          onPress={async () => {
                            if (!voiceNotePlayer) return;
                            if (isPlayingVoiceNote) {
                              voiceNotePlayer.pause();
                              setIsPlayingVoiceNote(false);
                              return;
                            }
                            setIsPlaybackLoading(true);
                            try {
                              await setAudioModeAsync({
                                allowsRecording: false,
                                playsInSilentMode: true
                              });
                              voiceNotePlayer.seekTo(0);
                              await voiceNotePlayer.play();
                              setIsPlayingVoiceNote(true);
                            } catch (e) {
                              setIsPlayingVoiceNote(false);
                              showToast({
                                title: t("voice_notes.playback_failed"),
                                variant: "error"
                              });
                            } finally {
                              setIsPlaybackLoading(false);
                            }
                          }}
                          disabled={isPlaybackLoading}
                          style={[
                            styles.voiceNotePlayButton,
                            {
                              backgroundColor: brandColors.primary,
                              opacity: isPlaybackLoading ? 0.7 : 1
                            }
                          ]}
                        >
                          {isPlaybackLoading ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : isPlayingVoiceNote ? (
                            <Pause size={16} color="#fff" />
                          ) : (
                            <Play size={16} color="#fff" fill="#fff" />
                          )}
                        </TouchableOpacity>
                        <Text style={[styles.voiceNotePreviewText, { color: colors.text.primary }]}>
                          {t("voice_notes.title")} ({voiceNoteDuration}s)
                        </Text>
                        <TouchableOpacity
                          onPress={() => {
                            if (isPlayingVoiceNote) voiceNotePlayer?.pause?.();
                            setVoiceNoteUri(null);
                            setVoiceNoteDuration(0);
                            setIsPlayingVoiceNote(false);
                            setIsPlaybackLoading(false);
                          }}
                        >
                          <X size={16} color={colors.text.tertiary} />
                        </TouchableOpacity>
                      </View>
                    )}
                </View>
              )}
            </ScrollView>

            {/* Submit Button */}
            <View style={styles.footer}>
              <Button
                onPress={handleSubmit}
                title={
                  response === "yes"
                    ? t("checkin.submit_yes")
                    : response === "rest_day"
                      ? t("checkin.submit_rest")
                      : t("checkin.submit")
                }
                variant="primary"
                size="md"
                fullWidth
                disabled={!canSubmit}
              />
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </RNModal>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  modalWrapper: {
    flex: 1,
    justifyContent: "flex-end" as const
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)"
  },
  keyboardAvoidingContainer: {
    flex: 1,
    justifyContent: "flex-end" as const
  },
  keyboardAvoidingContent: {
    justifyContent: "flex-end" as const
  },
  container: {
    backgroundColor: colors.bg.canvas,
    borderTopLeftRadius: toRN(tokens.borderRadius["2xl"]),
    borderTopRightRadius: toRN(tokens.borderRadius["2xl"]),
    maxHeight: SCREEN_HEIGHT * 0.85
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[4]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle
  },
  headerLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    flex: 1,
    gap: toRN(tokens.spacing[2])
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontWeight: tokens.typography.fontWeight.semibold,
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary,
    flex: 1
  },
  closeButton: {
    padding: toRN(tokens.spacing[2])
  },
  scrollView: {
    flexShrink: 1
  },
  scrollContent: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[4])
  },
  section: {
    marginTop: toRN(tokens.spacing[5])
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontWeight: tokens.typography.fontWeight.semibold,
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[4])
  },
  optional: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontWeight: tokens.typography.fontWeight.normal,
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.tertiary
  },
  responseButtons: {
    flexDirection: "row" as const,
    gap: toRN(tokens.spacing[3]),
    marginTop: toRN(tokens.spacing[2])
  },
  responseButton: {
    flex: 1,
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.xl),
    paddingVertical: toRN(tokens.spacing[4]),
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[2]),
    borderWidth: 2,
    borderColor: "transparent",
    minHeight: 90
  },
  responseLabel: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontWeight: tokens.typography.fontWeight.semibold,
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.secondary
  },
  optionRow: {
    flexDirection: "row" as const,
    gap: toRN(tokens.spacing[3])
  },
  optionButton: {
    flex: 1,
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.xl),
    paddingVertical: toRN(tokens.spacing[4]),
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[2]),
    borderWidth: 2,
    borderColor: "transparent",
    minHeight: 80
  },
  optionLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontWeight: tokens.typography.fontWeight.medium,
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.secondary
  },
  reasonGrid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: toRN(tokens.spacing[3]),
    justifyContent: "flex-start" as const
  },
  reasonButton: {
    width: "30%" as any,
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.xl),
    paddingVertical: toRN(tokens.spacing[4]),
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[2]),
    borderWidth: 2,
    borderColor: "transparent",
    minHeight: 80
  },
  reasonLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontWeight: tokens.typography.fontWeight.medium,
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.secondary,
    textAlign: "center" as const
  },
  // Miss screen (No response) styles
  missIntro: {
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[2])
  },
  missMessage: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.mediumItalic,
    fontStyle: "italic" as const,
    color: colors.text.primary,
    textAlign: "center" as const,
    lineHeight: lineHeight(tokens.typography.fontSize.lg, tokens.typography.lineHeight.relaxed)
  },
  tomorrowMessage: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskMedium,
    color: brand.primary,
    textAlign: "center" as const,
    marginTop: toRN(tokens.spacing[5]),
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    backgroundColor: brand.primary + "10",
    borderRadius: toRN(tokens.borderRadius.lg),
    overflow: "hidden" as const
  },
  restMessage: {
    marginTop: toRN(tokens.spacing[5]),
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[6]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.xl)
  },
  restEmoji: {
    fontSize: 56,
    marginBottom: toRN(tokens.spacing[3])
  },
  restText: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.secondary,
    textAlign: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    lineHeight: lineHeight(tokens.typography.fontSize.lg, tokens.typography.lineHeight.relaxed)
  },
  noteInput: {
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.xl),
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[4]),
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.primary,
    minHeight: 100,
    borderWidth: 1,
    borderColor: colors.border.subtle
  },
  noteInputContainer: {
    marginBottom: 0
  },
  charCount: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.tertiary,
    textAlign: "right" as const,
    marginTop: toRN(tokens.spacing[2])
  },
  voiceNoteButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    marginTop: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    backgroundColor: brand.primary + "10",
    borderRadius: toRN(tokens.borderRadius.lg),
    borderWidth: 1,
    borderColor: brand.primary + "30"
  },
  voiceNoteButtonPro: {
    backgroundColor: colors.bg.muted,
    borderColor: colors.border.subtle
  },
  voiceNoteButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskMedium,
    flex: 1
  },
  voiceNotePreview: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    marginTop: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    backgroundColor: brand.primary + "10",
    borderRadius: toRN(tokens.borderRadius.lg)
  },
  voiceNotePlayButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  voiceNotePreviewText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskMedium,
    flex: 1
  },
  footer: {
    paddingHorizontal: toRN(tokens.spacing[5]),
    paddingTop: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[2]),
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle
  }
});
