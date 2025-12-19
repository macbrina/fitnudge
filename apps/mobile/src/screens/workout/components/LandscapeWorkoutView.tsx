import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";

interface LandscapeWorkoutViewProps {
  // Exercise info
  exerciseName: string;
  exerciseNumber: number;
  totalExercises: number;
  mp4Url: string | null;

  // Timer
  timeRemaining: number;
  isPlaying: boolean;
  isPaused: boolean;
  isTimed: boolean;

  // Progress
  totalExercisesCount: number;
  overallExerciseIndex: number;

  // Actions
  onTogglePause: () => void;
  onSkipNext: () => void;
  onMarkDone: () => void;
  onExitLandscape: () => void;
  onShowHelp?: () => void;
}

export function LandscapeWorkoutView({
  exerciseName,
  exerciseNumber,
  totalExercises,
  mp4Url,
  timeRemaining,
  isPaused,
  isTimed,
  totalExercisesCount,
  overallExerciseIndex,
  onTogglePause,
  onSkipNext,
  onMarkDone,
  onExitLandscape,
  onShowHelp,
}: LandscapeWorkoutViewProps) {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const insets = useSafeAreaInsets();

  // Video player for landscape view
  const player = useVideoPlayer(mp4Url || "", (player) => {
    player.loop = true;
    player.playbackRate = 0.5;
    player.muted = true;
  });

  // Sync video playback with workout pause state
  useEffect(() => {
    if (player && mp4Url) {
      if (isPaused) {
        player.pause();
      } else {
        player.play();
      }
    }
  }, [isPaused, mp4Url, player]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <View style={styles.container}>
      {/* Full-screen Video background */}
      {mp4Url ? (
        <VideoView
          player={player}
          style={[styles.backgroundVideo, isPaused && styles.videoPaused]}
          contentFit="contain"
          nativeControls={false}
        />
      ) : (
        <View style={styles.videoPlaceholder}>
          <Ionicons name="fitness" size={80} color={colors.text.tertiary} />
        </View>
      )}

      {/* Paused overlay */}
      {isPaused && (
        <View style={styles.pausedOverlay}>
          <Ionicons name="pause" size={60} color="white" />
        </View>
      )}

      {/* Progress bar at top */}
      <View
        style={[
          styles.progressBarContainer,
          { paddingTop: insets.top || toRN(tokens.spacing[2]) },
        ]}
      >
        {Array.from({ length: totalExercisesCount }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.progressSegment,
              index < overallExerciseIndex && styles.progressSegmentComplete,
              index === overallExerciseIndex && styles.progressSegmentActive,
            ]}
          />
        ))}
      </View>

      {/* Exit/Contract button (top right) */}
      <TouchableOpacity
        style={[
          styles.exitButton,
          {
            top:
              (insets.top || toRN(tokens.spacing[2])) + toRN(tokens.spacing[6]),
            right: insets.right || toRN(tokens.spacing[4]),
          },
        ]}
        onPress={onExitLandscape}
      >
        <Ionicons name="contract" size={22} color={colors.text.primary} />
      </TouchableOpacity>

      {/* Left side - Play/Pause button */}
      <TouchableOpacity
        style={[
          styles.playPauseButton,
          { left: insets.left || toRN(tokens.spacing[4]) },
        ]}
        onPress={onTogglePause}
      >
        <Ionicons name={isPaused ? "play" : "pause"} size={32} color="white" />
      </TouchableOpacity>

      {/* Right side - Skip button */}
      <TouchableOpacity
        style={[
          styles.skipButton,
          { right: insets.right || toRN(tokens.spacing[4]) },
        ]}
        onPress={onSkipNext}
      >
        <Ionicons
          name="play-skip-forward"
          size={28}
          color={colors.text.primary}
        />
      </TouchableOpacity>

      {/* Bottom left - Exercise name and count */}
      <View
        style={[
          styles.bottomLeftInfo,
          {
            left: insets.left || toRN(tokens.spacing[4]),
            bottom: insets.bottom || toRN(tokens.spacing[4]),
          },
        ]}
      >
        <Text style={styles.exerciseName}>{exerciseName}</Text>
        <TouchableOpacity onPress={onShowHelp} style={styles.helpButton}>
          <Ionicons name="help-circle" size={24} color="rgba(0,0,0,0.4)" />
        </TouchableOpacity>
        <Text style={styles.exerciseCount}>
          {exerciseNumber}/{totalExercises}
        </Text>
      </View>

      {/* Bottom right - Timer or Done button */}
      <View
        style={[
          styles.bottomRightInfo,
          {
            right: insets.right || toRN(tokens.spacing[4]),
            bottom: insets.bottom || toRN(tokens.spacing[4]),
          },
        ]}
      >
        {isTimed ? (
          <Text style={styles.timerText}>{formatTime(timeRemaining)}</Text>
        ) : (
          <TouchableOpacity style={styles.doneButton} onPress={onMarkDone}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },

  // Full-screen Video
  backgroundVideo: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  videoPaused: {
    opacity: 0.5,
  },
  videoPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: colors.bg.muted,
  },
  pausedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },

  // Progress bar
  progressBarContainer: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[2]),
    gap: toRN(4),
    zIndex: 10,
  },
  progressSegment: {
    flex: 1,
    height: toRN(4),
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: toRN(2),
  },
  progressSegmentComplete: {
    backgroundColor: colors.text.primary,
  },
  progressSegmentActive: {
    backgroundColor: colors.text.primary,
    opacity: 0.6,
  },

  // Exit button (top right)
  exitButton: {
    position: "absolute" as const,
    width: toRN(44),
    height: toRN(44),
    borderRadius: toRN(22),
    backgroundColor: colors.bg.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    zIndex: 10,
  },

  // Play/Pause button (left center)
  playPauseButton: {
    position: "absolute" as const,
    top: "50%",
    marginTop: toRN(-32),
    width: toRN(64),
    height: toRN(64),
    borderRadius: toRN(32),
    backgroundColor: brand.primary,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    zIndex: 10,
  },

  // Skip button (right center)
  skipButton: {
    position: "absolute" as const,
    top: "50%",
    marginTop: toRN(-24),
    width: toRN(48),
    height: toRN(48),
    borderRadius: toRN(24),
    backgroundColor: colors.bg.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    zIndex: 10,
  },

  // Bottom left info
  bottomLeftInfo: {
    position: "absolute" as const,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    zIndex: 10,
  },
  exerciseName: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
    textTransform: "capitalize" as const,
  },
  helpButton: {
    padding: toRN(2),
  },
  exerciseCount: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
  },

  // Bottom right info
  bottomRightInfo: {
    position: "absolute" as const,
    alignItems: "flex-end" as const,
    zIndex: 10,
  },
  timerText: {
    fontSize: toRN(56),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
  },
  doneButton: {
    backgroundColor: brand.primary,
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[6]),
    borderRadius: toRN(tokens.borderRadius.full),
  },
  doneButtonText: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: "white",
  },
});

export default LandscapeWorkoutView;
