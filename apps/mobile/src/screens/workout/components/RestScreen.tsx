import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StatusBar,
} from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { Ionicons } from "@expo/vector-icons";
import type { WorkoutExercise, WarmupCooldownExercise } from "@/types/workout";

interface RestScreenProps {
  timeRemaining: number;
  nextExerciseIndex: number;
  totalExercises: number;
  nextExercise: WorkoutExercise | WarmupCooldownExercise | null;
  onExtendRest: () => void;
  onSkipRest: () => void;
  onHelp?: () => void;
  onMenu?: () => void;
}

/**
 * Rest Screen with Blue Theme (IMG_9566)
 *
 * Full blue background with:
 * - Large REST label and timer
 * - +20s and SKIP buttons
 * - Next exercise preview with GIF
 */
export function RestScreen({
  timeRemaining,
  nextExerciseIndex,
  totalExercises,
  nextExercise,
  onExtendRest,
  onSkipRest,
  onHelp,
  onMenu,
}: RestScreenProps) {
  const insets = useSafeAreaInsets();
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation on last 5 seconds
  useEffect(() => {
    if (timeRemaining <= 5 && timeRemaining > 0) {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [timeRemaining]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Get next exercise duration
  const getNextDuration = () => {
    if (!nextExercise) return "";
    if ("duration_seconds" in nextExercise && nextExercise.duration_seconds) {
      return `${nextExercise.duration_seconds}s`;
    }
    if (
      "work_duration_seconds" in nextExercise &&
      nextExercise.work_duration_seconds
    ) {
      return `${nextExercise.work_duration_seconds}s`;
    }
    if ("reps" in nextExercise && nextExercise.reps) {
      return `${nextExercise.reps} reps`;
    }
    return "";
  };

  // Get MP4 URL (Cloudflare CDN URLs stored in database)
  const getMp4Url = () => {
    if (!nextExercise) return null;

    if ("mp4_url" in nextExercise && nextExercise.mp4_url) {
      return nextExercise.mp4_url;
    }
    if ("demo" in nextExercise && nextExercise.demo?.mp4_url) {
      return nextExercise.demo.mp4_url;
    }

    return null;
  };

  const mp4Url = getMp4Url();

  // Create video player for next exercise preview
  const player = useVideoPlayer(mp4Url || "", (player) => {
    player.loop = true;
    player.playbackRate = 0.5;
    player.muted = true;
    player.play();
  });

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <StatusBar barStyle="light-content" />
      {/* Header with menu icon */}
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        {onMenu && (
          <TouchableOpacity onPress={onMenu} style={styles.menuButton}>
            <Ionicons name="menu" size={28} color="white" />
          </TouchableOpacity>
        )}
      </View>

      {/* Main content */}
      <View style={styles.content}>
        {/* REST label */}
        <Text style={styles.restLabel}>{t("workout.phase.rest")}</Text>

        {/* Large timer */}
        <Animated.Text
          style={[
            styles.timer,
            { transform: [{ scale: pulseAnim }] },
            timeRemaining <= 5 && styles.timerWarning,
          ]}
        >
          {formatTime(timeRemaining)}
        </Animated.Text>

        {/* Action buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.extendButton} onPress={onExtendRest}>
            <Text style={styles.extendButtonText}>+20s</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipButton} onPress={onSkipRest}>
            <Text style={styles.skipButtonText}>{t("workout.skip")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Next exercise preview */}
      {nextExercise && (
        <View style={styles.nextExerciseContainer}>
          {/* Next label */}
          <Text style={styles.nextLabel}>
            {t("workout.next_exercise", {
              current: nextExerciseIndex + 1,
              total: totalExercises,
            })}
          </Text>

          {/* Exercise name row */}
          <View style={styles.exerciseNameRow}>
            <Text style={styles.nextExerciseName}>{nextExercise.name}</Text>
            {onHelp && (
              <TouchableOpacity onPress={onHelp} style={styles.helpButton}>
                <Ionicons
                  name="help-circle-outline"
                  size={18}
                  color="rgba(255,255,255,0.7)"
                />
              </TouchableOpacity>
            )}
            <Text style={styles.durationLabel}>{getNextDuration()}</Text>
          </View>

          {/* Video preview */}
          {mp4Url && (
            <View style={styles.videoContainer}>
              <VideoView
                player={player}
                style={styles.videoPreview}
                contentFit="contain"
                nativeControls={false}
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const BLUE_COLOR = "#007AFF";

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  header: {
    flexDirection: "row" as const,
    justifyContent: "flex-end" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingTop: toRN(tokens.spacing[4]),
  },
  headerSpacer: {
    flex: 1,
  },
  menuButton: {
    padding: toRN(tokens.spacing[1]),
  },
  content: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
  },
  restLabel: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: "rgba(255,255,255,0.9)",
    letterSpacing: 4,
    marginBottom: toRN(tokens.spacing[3]),
  },
  timer: {
    fontSize: toRN(80),
    fontFamily: fontFamily.groteskBold,
    color: "white",
    marginBottom: toRN(tokens.spacing[8]),
  },
  timerWarning: {
    color: "#FFCC00",
  },
  buttonRow: {
    flexDirection: "row" as const,
    gap: toRN(tokens.spacing[3]),
  },
  extendButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[6]),
    borderRadius: toRN(tokens.borderRadius.full),
    minWidth: toRN(100),
    alignItems: "center" as const,
  },
  extendButtonText: {
    color: "white",
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
  },
  skipButton: {
    backgroundColor: "white",
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[6]),
    borderRadius: toRN(tokens.borderRadius.full),
    minWidth: toRN(100),
    alignItems: "center" as const,
  },
  skipButtonText: {
    color: BLUE_COLOR,
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
  },
  nextExerciseContainer: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderTopLeftRadius: toRN(tokens.borderRadius.xl),
    borderTopRightRadius: toRN(tokens.borderRadius.xl),
    paddingTop: toRN(tokens.spacing[4]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[8]),
  },
  nextLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 1,
    marginBottom: toRN(tokens.spacing[2]),
  },
  exerciseNameRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
    marginBottom: toRN(tokens.spacing[3]),
  },
  nextExerciseName: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: "white",
    flex: 1,
    textTransform: "capitalize" as const,
  },
  helpButton: {
    padding: toRN(tokens.spacing[1]),
  },
  durationLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: "rgba(255,255,255,0.8)",
  },
  videoContainer: {
    backgroundColor: "white",
    borderRadius: toRN(tokens.borderRadius.lg),
    overflow: "hidden" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    height: toRN(150),
  },
  videoPreview: {
    width: "100%",
    height: "100%",
  },
});
