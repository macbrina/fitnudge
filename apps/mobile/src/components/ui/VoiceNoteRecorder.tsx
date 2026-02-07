import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  AppState,
  AppStateStatus,
  Linking,
  Platform
} from "react-native";
import { useAudioRecorder, useAudioPlayer, RecordingPresets, setAudioModeAsync } from "expo-audio";
import { Mic, Play, Pause, Trash2, Check, X } from "lucide-react-native";
import { useTheme } from "@/themes";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { tokens } from "@/themes/tokens";
import { useTranslation } from "@/lib/i18n";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { useMediaPermissions } from "@/hooks/media/useMediaPermissions";

// Constants
const DEFAULT_MAX_DURATION_SECONDS = 30;
/** Stop recording this many seconds before max (0 = stop exactly at max). */
const RECORDING_STOP_HEADROOM_SEC = 0;
const BAR_COUNT = 20;
const METERING_UPDATE_INTERVAL = 50; // ms

// Recording states
type RecordingState = "idle" | "recording" | "paused" | "recorded";

interface VoiceNoteRecorderProps {
  onRecordingComplete: (audioUri: string, duration: number) => void;
  onCancel: () => void;
  disabled?: boolean;
  /** When true and user has premium, recording starts as soon as the component mounts. */
  startImmediately?: boolean;
  /** Max recording length in seconds. Default from subscription voice_note_max_duration or 30. */
  maxDurationSeconds?: number;
  /** Optional. Called with { stopRecording, stopPlayback } when mounted, null when unmounted. */
  onRegisterActions?: (
    actions: {
      stopRecording: () => Promise<{ uri: string | null; duration: number }>;
      stopPlayback: () => Promise<void>;
    } | null
  ) => void;
}

export function VoiceNoteRecorder({
  onRecordingComplete,
  onCancel,
  disabled = false,
  startImmediately = false,
  maxDurationSeconds = DEFAULT_MAX_DURATION_SECONDS,
  onRegisterActions
}: VoiceNoteRecorderProps) {
  const { t } = useTranslation();
  const { colors, brandColors, isDark } = useTheme();
  const { hasFeature, openModal } = useSubscriptionStore();

  // Recording state machine
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const meteringRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStateRef = useRef(recordingState);
  const hasStartedImmediatelyRef = useRef(false);
  const elapsedMsRef = useRef(0);
  const lastRecordedUrlRef = useRef<string | null>(null);
  const autoStopTriggeredRef = useRef(false);
  const stopRecordingRef = useRef<(() => Promise<{ uri: string | null; duration: number }>) | null>(
    null
  );

  const hasPremium = hasFeature("voice_notes");

  // Keep ref in sync with state
  useEffect(() => {
    recordingStateRef.current = recordingState;
  }, [recordingState]);

  // Use media permissions hook for microphone access
  const {
    hasMicrophonePermission,
    microphoneStatus,
    requestMicrophonePermission,
    isLoading: isPermissionLoading
  } = useMediaPermissions();

  const stopAtSeconds = Math.max(1, maxDurationSeconds - RECORDING_STOP_HEADROOM_SEC);
  const stopAtMs = stopAtSeconds * 1000;

  // Status listener: capture url when available (before stop disposes native object)
  const handleRecordingStatusUpdate = useCallback((status: { url?: string | null }) => {
    if (status.url) lastRecordedUrlRef.current = status.url;
  }, []);

  // expo-audio: HIGH_QUALITY preset uses platform-specific android/ios/web options (RecordingOptions)
  const audioRecorder = useAudioRecorder(
    RecordingPresets.HIGH_QUALITY,
    handleRecordingStatusUpdate
  );
  const player = useAudioPlayer(recordedUri || undefined);

  // Auto-pause on app background
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState !== "active" && recordingStateRef.current === "recording") {
        pauseRecording();
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (meteringRef.current) clearInterval(meteringRef.current);
    };
  }, []);

  // Track playback position when playing (matches CheckInDetailModal pattern)
  useEffect(() => {
    if (!player || !isPlaying) return;
    const interval = setInterval(() => {
      const now = player.currentTime ?? 0;
      const dur = (player.duration ?? duration) || 1;
      setPlaybackPosition(now);
      if (dur > 0 && now >= dur - 0.1) {
        setIsPlaying(false);
        setPlaybackPosition(0);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [player, isPlaying, duration]);

  // Start recording immediately when startImmediately + premium (e.g. tap "Record" in check-in)
  useEffect(() => {
    if (
      startImmediately &&
      hasPremium &&
      !hasStartedImmediatelyRef.current &&
      recordingState === "idle"
    ) {
      hasStartedImmediatelyRef.current = true;
      startRecording();
    }
  }, [startImmediately, hasPremium, recordingState]);

  const startRecording = async () => {
    if (!hasPremium) {
      openModal();
      return;
    }

    // Check/request microphone permission
    if (!hasMicrophonePermission) {
      const granted = await requestMicrophonePermission();
      if (!granted) return;
    }

    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setRecordingState("recording");
      setDuration(0);
      progressAnim.setValue(0);
      elapsedMsRef.current = 0;
      autoStopTriggeredRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        const status = (
          audioRecorder as { getStatus?: () => { durationMillis?: number } }
        )?.getStatus?.();
        // console.log("status", status);
        const durationMs = status?.durationMillis ?? Math.min(elapsedMsRef.current + 50, stopAtMs);
        const clampedMs = Math.min(durationMs, stopAtMs);
        elapsedMsRef.current = clampedMs;
        setDuration(Math.floor(clampedMs / 1000));
        progressAnim.setValue(clampedMs / stopAtMs);
        if (durationMs >= stopAtMs && !autoStopTriggeredRef.current) {
          autoStopTriggeredRef.current = true;
          stopRecordingRef.current?.();
        }
      }, 50);
    } catch (err) {
      console.error("Failed to start recording:", err);
    }
  };

  const pauseRecording = async () => {
    try {
      audioRecorder.pause();
      setRecordingState("paused");
    } catch (err) {
      console.error("Failed to pause recording:", err);
    }
  };

  const resumeRecording = async () => {
    try {
      audioRecorder.record();
      setRecordingState("recording");
      autoStopTriggeredRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        const status = (
          audioRecorder as { getStatus?: () => { durationMillis?: number } }
        )?.getStatus?.();
        const durationMs = status?.durationMillis ?? Math.min(elapsedMsRef.current + 50, stopAtMs);
        const clampedMs = Math.min(durationMs, stopAtMs);
        elapsedMsRef.current = clampedMs;
        setDuration(Math.floor(clampedMs / 1000));
        progressAnim.setValue(clampedMs / stopAtMs);
        if (durationMs >= stopAtMs && !autoStopTriggeredRef.current) {
          autoStopTriggeredRef.current = true;
          stopRecordingRef.current?.();
        }
      }, 50);
    } catch (err) {
      console.error("Failed to resume recording:", err);
    }
  };

  const stopRecording = async (): Promise<{ uri: string | null; duration: number }> => {
    const noResult = { uri: null as string | null, duration: 0 };
    try {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      let uri: string | null = null;
      let statusDurationMs: number | null = null;
      try {
        const status = (
          audioRecorder as { getStatus?: () => { durationMillis?: number } }
        )?.getStatus?.();
        statusDurationMs = status?.durationMillis ?? null;
        uri =
          lastRecordedUrlRef.current ??
          (audioRecorder as { getStatus?: () => { url?: string | null } })?.getStatus?.()?.url ??
          (audioRecorder as { uri?: string | null }).uri ??
          null;
      } catch {
        uri = lastRecordedUrlRef.current;
      }

      await audioRecorder.stop();
      lastRecordedUrlRef.current = null;
      // Prefer timer-derived duration when native durationMillis is missing or 0 (expo-audio can return 0)
      const durationMs =
        statusDurationMs != null && statusDurationMs > 0 ? statusDurationMs : elapsedMsRef.current;
      elapsedMsRef.current = durationMs;
      const finalDuration = Math.max(0, Math.floor(durationMs / 1000));
      setRecordedUri(uri || null);
      setDuration(finalDuration);
      if (startImmediately && uri) {
        onRecordingComplete(uri, finalDuration);
        return { uri, duration: finalDuration };
      }
      setRecordingState("recorded");
      return { uri, duration: finalDuration };
    } catch (err) {
      console.error("Failed to stop recording:", err);
      return noResult;
    }
  };

  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  const deleteRecording = async () => {
    // If currently recording or paused, stop first
    if (recordingState === "recording" || recordingState === "paused") {
      try {
        await audioRecorder.stop();
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      } catch (err) {
        console.warn("Error stopping during delete:", err);
      }
    }

    // When opened from CheckInModal (startImmediately): delete = close recorder, back to "Record Voice Note" button.
    if (startImmediately) {
      onCancel();
      return;
    }

    // Standalone recorder: reset to idle so user can tap record again
    setRecordedUri(null);
    setDuration(0);
    setPlaybackPosition(0);
    setRecordingState("idle");
    progressAnim.setValue(0);
  };

  const playRecording = async () => {
    if (!recordedUri || !player) return;
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      player.seekTo(0);
      await player.play();
      setIsPlaying(true);
    } catch (err) {
      console.error("[VoiceNoteRecorder] player.play() failed", err);
      setIsPlaying(false);
    }
  };

  const pausePlayback = async () => {
    if (player) {
      player.pause();
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    if (!onRegisterActions) return;
    onRegisterActions({
      stopRecording: async () => {
        if (recordingStateRef.current === "recording" || recordingStateRef.current === "paused") {
          return stopRecording();
        }
        return { uri: recordedUri, duration };
      },
      stopPlayback: pausePlayback
    });
    return () => {
      onRegisterActions?.(null);
    };
  }, [onRegisterActions, recordedUri, duration]);

  const confirmRecording = () => {
    if (recordedUri) {
      onRecordingComplete(recordedUri, duration);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Loading permissions
  if (isPermissionLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg.muted }]}>
        <ActivityIndicator color={brandColors.primary} />
      </View>
    );
  }

  const openAppSettings = () => {
    if (Platform.OS === "ios") {
      Linking.openURL("app-settings:").catch(() => {});
    } else {
      Linking.openSettings().catch(() => {});
    }
  };

  // Permission denied: toast already shown on deny; one tap opens FitNudge app settings
  if (microphoneStatus === "denied") {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg.muted }]}>
        <Text style={[styles.permissionText, { color: colors.text.secondary }]}>
          {t("voice_notes.permission_required")}
        </Text>
        <TouchableOpacity
          onPress={openAppSettings}
          style={[styles.openSettingsButton, { backgroundColor: brandColors.primary }]}
        >
          <Text style={styles.openSettingsText}>{t("common.open_settings")}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
          <Text style={[styles.cancelText, { color: brandColors.primary }]}>
            {t("common.cancel")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Recorded - show playback controls (only when not startImmediately; otherwise we already called onRecordingComplete on stop)
  if (recordingState === "recorded" && recordedUri) {
    const totalSec = (player?.duration ?? duration) || 1;
    const percent = totalSec > 0 ? (playbackPosition / totalSec) * 100 : 0;
    return (
      <View style={[styles.container, { backgroundColor: colors.bg.muted }]}>
        <View style={styles.playbackRow}>
          <TouchableOpacity
            onPress={isPlaying ? pausePlayback : playRecording}
            style={[styles.playButton, { backgroundColor: brandColors.primary }]}
          >
            {isPlaying ? (
              <Pause size={20} color="#fff" />
            ) : (
              <Play size={20} color="#fff" fill="#fff" />
            )}
          </TouchableOpacity>

          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBarFill,
                { backgroundColor: brandColors.primary, width: `${percent}%` }
              ]}
            />
          </View>

          <Text style={[styles.timeText, { color: colors.text.secondary }]}>
            {formatTime(playbackPosition)} / {formatTime(totalSec)}
          </Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={deleteRecording}
            style={[styles.iconButton, { backgroundColor: colors.feedback.error + "20" }]}
          >
            <Trash2 size={18} color={colors.feedback.error} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={confirmRecording}
            style={[styles.doneCircleButton, { backgroundColor: brandColors.primary }]}
          >
            <Check size={22} color="#fff" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Recording or Paused state
  if (recordingState === "recording" || recordingState === "paused") {
    const isRecording = recordingState === "recording";

    return (
      <View style={[styles.container, { backgroundColor: colors.bg.muted }]}>
        {/* Top row: Duration */}
        <View style={styles.durationRow}>
          <View
            style={[
              styles.recordingIndicator,
              { backgroundColor: isRecording ? colors.feedback.error : colors.text.tertiary }
            ]}
          />
          <Text style={[styles.timerText, { color: colors.text.primary }]}>
            {formatTime(duration)} / {formatTime(maxDurationSeconds)}
          </Text>
        </View>

        {/* Progress bar — track = unfilled, fill = elapsed */}
        <View style={[styles.progressBar, { backgroundColor: colors.text.tertiary + "30" }]}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor: isRecording ? colors.feedback.error : brandColors.primary,
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"]
                })
              }
            ]}
          />
        </View>

        {/* Control buttons */}
        <View style={styles.controlRow}>
          {/* Delete button */}
          <TouchableOpacity
            onPress={deleteRecording}
            style={[styles.iconButton, { backgroundColor: colors.feedback.error + "20" }]}
          >
            <Trash2 size={18} color={colors.feedback.error} />
          </TouchableOpacity>

          {/* Pause/Resume button */}
          <TouchableOpacity
            onPress={isRecording ? pauseRecording : resumeRecording}
            disabled={disabled || duration >= maxDurationSeconds}
            style={[
              styles.mainButton,
              {
                backgroundColor: isRecording ? colors.text.primary : brandColors.primary,
                opacity: duration >= maxDurationSeconds ? 0.5 : 1
              }
            ]}
          >
            {isRecording ? (
              <Pause size={24} color={isDark ? "#000" : "#fff"} />
            ) : (
              <Mic size={24} color="#fff" />
            )}
          </TouchableOpacity>

          {/* Done = check in circle only (no separate "Save"; check-in submits everything) */}
          <TouchableOpacity
            onPress={stopRecording}
            style={[styles.doneCircleButton, { backgroundColor: brandColors.primary }]}
          >
            <Check size={22} color="#fff" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {/* Hint text */}
        <Text style={[styles.hintText, { color: colors.text.tertiary }]}>
          {isRecording
            ? t("voice_notes.tap_pause") || "Tap to pause"
            : t("voice_notes.tap_continue") || "Tap mic to continue"}
        </Text>
      </View>
    );
  }

  // Idle: when startImmediately, we never show "Tap to record" — entry point is CheckInModal's "Record Voice Note". Show "Starting…" briefly until recording starts.
  if (startImmediately && recordingState === "idle") {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg.muted }]}>
        <View style={styles.startingRow}>
          <ActivityIndicator color={brandColors.primary} size="small" />
          <Text style={[styles.startingText, { color: colors.text.secondary }]}>
            {t("voice_notes.starting")}
          </Text>
          <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
            <X size={20} color={colors.text.tertiary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Idle state - only when NOT startImmediately (e.g. standalone recorder). "Tap to record" lives in parent; we show manual trigger here.
  return (
    <View style={[styles.container, { backgroundColor: colors.bg.muted }]}>
      <View style={styles.idleRow}>
        <TouchableOpacity
          onPress={startRecording}
          disabled={disabled}
          style={[styles.recordButton, { backgroundColor: brandColors.primary }]}
        >
          <Mic size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.idleTextContainer}>
          <Text style={[styles.idleTitle, { color: colors.text.primary }]}>
            {t("voice_notes.title")}
          </Text>
          <Text style={[styles.hintText, { color: colors.text.tertiary }]}>
            {t("voice_notes.tap_to_record")}
          </Text>
        </View>
        <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
          <X size={20} color={colors.text.tertiary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: toRN(tokens.borderRadius.xl),
    padding: toRN(tokens.spacing[4]),
    marginTop: toRN(tokens.spacing[3])
  },
  permissionText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    textAlign: "center",
    marginBottom: toRN(tokens.spacing[3])
  },
  openSettingsButton: {
    alignSelf: "center",
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.md),
    marginBottom: toRN(tokens.spacing[2])
  },
  openSettingsText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskSemiBold,
    color: "#fff"
  },
  cancelButton: {
    alignSelf: "center",
    padding: toRN(tokens.spacing[2])
  },
  cancelText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskMedium
  },
  startingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: toRN(tokens.spacing[3])
  },
  startingText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    flex: 1
  },
  // Idle state
  idleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: toRN(tokens.spacing[3])
  },
  idleTextContainer: {
    flex: 1,
    gap: toRN(tokens.spacing[1])
  },
  idleTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskSemiBold
  },
  recordButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center"
  },
  closeButton: {
    padding: toRN(tokens.spacing[2])
  },
  // Recording/Paused state
  durationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: toRN(tokens.spacing[2]),
    marginBottom: toRN(tokens.spacing[3])
  },
  recordingIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  timerText: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.groteskSemiBold
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    marginTop: toRN(tokens.spacing[3])
  },
  progressFill: {
    height: "100%",
    borderRadius: 2
  },
  controlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: toRN(tokens.spacing[4]),
    gap: toRN(tokens.spacing[3])
  },
  mainButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center"
  },
  hintText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskRegular,
    textAlign: "center",
    marginTop: toRN(tokens.spacing[2])
  },
  // Playback state
  playbackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[3])
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center"
  },
  progressBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: "rgba(0,0,0,0.1)",
    borderRadius: 3,
    overflow: "hidden"
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3
  },
  timeText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskMedium,
    minWidth: 80,
    textAlign: "right"
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: toRN(tokens.spacing[3])
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center"
  },
  doneCircleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center"
  },
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[2]),
    borderRadius: toRN(tokens.borderRadius.lg)
  },
  confirmText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskMedium,
    color: "#fff"
  }
});
