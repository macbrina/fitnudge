import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  AppState,
  AppStateStatus
} from "react-native";
import { useAudioRecorder, useAudioPlayer, RecordingPresets } from "expo-audio";
import { Mic, Play, Pause, Trash2, Check, X } from "lucide-react-native";
import { useTheme } from "@/themes";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { tokens } from "@/themes/tokens";
import { useTranslation } from "@/lib/i18n";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { useMediaPermissions } from "@/hooks/media/useMediaPermissions";

// Constants
const MAX_DURATION_SECONDS = 30;
const BAR_COUNT = 20;
const METERING_UPDATE_INTERVAL = 50; // ms

// Recording states
type RecordingState = "idle" | "recording" | "paused" | "recorded";

interface VoiceNoteRecorderProps {
  onRecordingComplete: (audioUri: string, duration: number) => void;
  onCancel: () => void;
  disabled?: boolean;
}

// Voice-reactive audio bars component
function AudioWaveformBars({
  isActive,
  audioLevel,
  color,
  barCount = BAR_COUNT
}: {
  isActive: boolean;
  audioLevel: number; // 0-1 normalized
  color: string;
  barCount?: number;
}) {
  const barAnims = useRef<Animated.Value[]>(
    Array.from({ length: barCount }, () => new Animated.Value(0.2))
  ).current;

  useEffect(() => {
    if (isActive) {
      // Animate bars based on audio level with some randomization for natural look
      barAnims.forEach((anim, index) => {
        // Create wave-like effect - center bars react more
        const centerFactor = 1 - Math.abs(index - barCount / 2) / (barCount / 2);
        const targetHeight = Math.max(
          0.15,
          Math.min(1, audioLevel * (0.5 + centerFactor * 0.8) + Math.random() * 0.2)
        );

        Animated.timing(anim, {
          toValue: targetHeight,
          duration: METERING_UPDATE_INTERVAL,
          useNativeDriver: false
        }).start();
      });
    } else {
      // Reset to minimal height when not active
      barAnims.forEach((anim) => {
        Animated.timing(anim, {
          toValue: 0.15,
          duration: 200,
          useNativeDriver: false
        }).start();
      });
    }
  }, [isActive, audioLevel]);

  return (
    <View style={waveformStyles.container}>
      {barAnims.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            waveformStyles.bar,
            {
              backgroundColor: color,
              height: anim.interpolate({
                inputRange: [0, 1],
                outputRange: ["15%", "100%"]
              })
            }
          ]}
        />
      ))}
    </View>
  );
}

const waveformStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 40,
    gap: 2,
    flex: 1
  },
  bar: {
    width: 3,
    borderRadius: 1.5,
    minHeight: 6
  }
});

export function VoiceNoteRecorder({
  onRecordingComplete,
  onCancel,
  disabled = false
}: VoiceNoteRecorderProps) {
  const { t } = useTranslation();
  const { colors, brandColors } = useTheme();
  const { hasFeature, openModal } = useSubscriptionStore();

  // Recording state machine
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const meteringRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStateRef = useRef(recordingState);

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

  // expo-audio hooks
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player = useAudioPlayer(recordedUri || undefined);

  // Auto-pause on app background
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState !== "active" && recordingStateRef.current === "recording") {
        console.log("[VoiceRecorder] App went to background, pausing recording");
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

  // Track playback status
  useEffect(() => {
    if (player && recordedUri) {
      const interval = setInterval(() => {
        if (player.playing) {
          setPlaybackPosition(player.currentTime);
        }
        if (player.currentTime >= duration && player.playing) {
          setIsPlaying(false);
          setPlaybackPosition(0);
        }
      }, 100);

      return () => clearInterval(interval);
    }
  }, [player, recordedUri, duration]);

  // Auto-stop at max duration
  useEffect(() => {
    if (duration >= MAX_DURATION_SECONDS && recordingState === "recording") {
      stopRecording();
    }
  }, [duration, recordingState]);

  // Metering for audio visualization
  const startMetering = useCallback(() => {
    meteringRef.current = setInterval(() => {
      if (audioRecorder && recordingStateRef.current === "recording") {
        // Get current metering value (dB, typically -160 to 0)
        // Note: currentMetering may not be available on all versions of expo-audio
        const metering = (audioRecorder as { currentMetering?: number }).currentMetering ?? -160;
        // Normalize to 0-1 range (assuming -60dB is silence, 0dB is max)
        const normalized = Math.max(0, Math.min(1, (metering + 60) / 60));
        setAudioLevel(normalized);
      }
    }, METERING_UPDATE_INTERVAL);
  }, [audioRecorder]);

  const stopMetering = useCallback(() => {
    if (meteringRef.current) {
      clearInterval(meteringRef.current);
      meteringRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const startRecording = async () => {
    if (!hasPremium) {
      openModal();
      return;
    }

    // Check/request microphone permission
    if (!hasMicrophonePermission) {
      const granted = await requestMicrophonePermission();
      if (!granted) {
        console.log("Microphone permission denied");
        return;
      }
    }

    try {
      audioRecorder.record();
      setRecordingState("recording");
      setDuration(0);
      progressAnim.setValue(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          const newDuration = prev + 1;
          const progress = newDuration / MAX_DURATION_SECONDS;
          Animated.timing(progressAnim, {
            toValue: progress,
            duration: 900,
            useNativeDriver: false
          }).start();
          return newDuration;
        });
      }, 1000);

      // Start audio level metering
      startMetering();
    } catch (err) {
      console.error("Failed to start recording:", err);
    }
  };

  const pauseRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopMetering();

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

      // Resume timer
      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          const newDuration = prev + 1;
          const progress = newDuration / MAX_DURATION_SECONDS;
          Animated.timing(progressAnim, {
            toValue: progress,
            duration: 900,
            useNativeDriver: false
          }).start();
          return newDuration;
        });
      }, 1000);

      // Resume metering
      startMetering();
    } catch (err) {
      console.error("Failed to resume recording:", err);
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopMetering();

    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      setRecordedUri(uri || null);
      setRecordingState("recorded");
    } catch (err) {
      console.error("Failed to stop recording:", err);
    }
  };

  const deleteRecording = async () => {
    // If currently recording or paused, stop first
    if (recordingState === "recording" || recordingState === "paused") {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      stopMetering();
      try {
        await audioRecorder.stop();
      } catch (err) {
        console.warn("Error stopping during delete:", err);
      }
    }

    // Reset all state
    setRecordedUri(null);
    setDuration(0);
    setPlaybackPosition(0);
    setRecordingState("idle");
    progressAnim.setValue(0);
  };

  const playRecording = async () => {
    if (!recordedUri || !player) return;

    try {
      player.play();
      setIsPlaying(true);
    } catch (err) {
      console.error("Failed to play recording:", err);
    }
  };

  const pausePlayback = async () => {
    if (player) {
      player.pause();
      setIsPlaying(false);
    }
  };

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

  // Permission denied
  if (microphoneStatus === "denied") {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg.muted }]}>
        <Text style={[styles.permissionText, { color: colors.text.secondary }]}>
          {t("voice_notes.permission_required")}
        </Text>
        <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
          <Text style={[styles.cancelText, { color: brandColors.primary }]}>
            {t("common.cancel")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Recorded - show playback controls
  if (recordingState === "recorded" && recordedUri) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg.muted }]}>
        <View style={styles.playbackRow}>
          {/* Play/Pause Button */}
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

          {/* Progress Bar */}
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBarFill,
                {
                  backgroundColor: brandColors.primary,
                  width: `${duration > 0 ? (playbackPosition / duration) * 100 : 0}%`
                }
              ]}
            />
          </View>

          {/* Duration */}
          <Text style={[styles.timeText, { color: colors.text.secondary }]}>
            {formatTime(playbackPosition)} / {formatTime(duration)}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={deleteRecording}
            style={[styles.iconButton, { backgroundColor: colors.feedback.error + "20" }]}
          >
            <Trash2 size={18} color={colors.feedback.error} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={confirmRecording}
            style={[styles.confirmButton, { backgroundColor: brandColors.primary }]}
          >
            <Check size={18} color="#fff" />
            <Text style={styles.confirmText}>{t("voice_notes.save")}</Text>
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
            {formatTime(duration)} / {formatTime(MAX_DURATION_SECONDS)}
          </Text>
        </View>

        {/* Waveform visualization */}
        <AudioWaveformBars
          isActive={isRecording}
          audioLevel={audioLevel}
          color={isRecording ? colors.feedback.error : colors.text.tertiary}
        />

        {/* Progress bar */}
        <View style={[styles.progressBar, { backgroundColor: colors.border.subtle }]}>
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
            disabled={disabled || duration >= MAX_DURATION_SECONDS}
            style={[
              styles.mainButton,
              {
                backgroundColor: isRecording ? colors.text.primary : brandColors.primary,
                opacity: duration >= MAX_DURATION_SECONDS ? 0.5 : 1
              }
            ]}
          >
            {isRecording ? <Pause size={24} color="#fff" /> : <Mic size={24} color="#fff" />}
          </TouchableOpacity>

          {/* Stop/Done button - finalize recording */}
          <TouchableOpacity
            onPress={stopRecording}
            style={[styles.confirmButton, { backgroundColor: brandColors.primary }]}
          >
            <Check size={18} color="#fff" />
            <Text style={styles.confirmText}>{t("voice_notes.done")}</Text>
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

  // Idle state - ready to record
  return (
    <View style={[styles.container, { backgroundColor: colors.bg.muted }]}>
      <View style={styles.idleRow}>
        {/* Record Button */}
        <TouchableOpacity
          onPress={startRecording}
          disabled={disabled}
          style={[styles.recordButton, { backgroundColor: brandColors.primary }]}
        >
          <Mic size={24} color="#fff" />
        </TouchableOpacity>

        {/* Instructions */}
        <View style={styles.idleTextContainer}>
          <Text style={[styles.idleTitle, { color: colors.text.primary }]}>
            {t("voice_notes.title")}
          </Text>
          <Text style={[styles.hintText, { color: colors.text.tertiary }]}>
            {t("voice_notes.tap_to_record")}
          </Text>
        </View>

        {/* Cancel Button */}
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
  cancelButton: {
    alignSelf: "center",
    padding: toRN(tokens.spacing[2])
  },
  cancelText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskMedium
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
