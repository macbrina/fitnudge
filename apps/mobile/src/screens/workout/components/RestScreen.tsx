import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, Animated, StatusBar } from "react-native";
import Video, { ResizeMode } from "react-native-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { Ionicons } from "@expo/vector-icons";
import { ExerciseListModal } from "./ExerciseListModal";
import type { WorkoutExercise, WarmupCooldownExercise } from "@/types/workout";

type AnyExercise = WorkoutExercise | WarmupCooldownExercise;

interface RestScreenProps {
  timeRemaining: number;
  nextExerciseIndex: number; // 1-based for display "NEXT X/Y"
  nextExerciseGlobalIndex: number; // 0-based for highlighting in modal
  totalExercises: number;
  nextExercise: WorkoutExercise | WarmupCooldownExercise | null;
  allExercises: AnyExercise[];
  onExtendRest: () => void;
  onSkipRest: () => void;
  onHelp?: () => void;
  onJumpToExercise?: (index: number) => void;
  onPauseTimer?: () => void;
  onResumeTimer?: () => void;
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
  nextExerciseGlobalIndex,
  totalExercises,
  nextExercise,
  allExercises,
  onExtendRest,
  onSkipRest,
  onHelp,
  onJumpToExercise,
  onPauseTimer,
  onResumeTimer
}: RestScreenProps) {
  const insets = useSafeAreaInsets();
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [showExerciseList, setShowExerciseList] = useState(false);

  // Handle opening the exercise list modal
  const handleOpenExerciseList = () => {
    onPauseTimer?.();
    setShowExerciseList(true);
  };

  // Handle closing the exercise list modal
  const handleCloseExerciseList = () => {
    setShowExerciseList(false);
    onResumeTimer?.();
  };

  // Handle selecting an exercise from the list
  const handleSelectExercise = (index: number) => {
    setShowExerciseList(false);
    onJumpToExercise?.(index);
  };

  // Pulse animation on last 5 seconds
  useEffect(() => {
    if (timeRemaining <= 5 && timeRemaining > 0) {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 200,
          useNativeDriver: true
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        })
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
    if ("work_duration_seconds" in nextExercise && nextExercise.work_duration_seconds) {
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      {/* Header with menu icon */}
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <TouchableOpacity onPress={handleOpenExerciseList} style={styles.menuButton}>
          <Ionicons name="menu" size={28} color="white" />
        </TouchableOpacity>
      </View>

      {/* Exercise List Modal */}
      <ExerciseListModal
        visible={showExerciseList}
        onClose={handleCloseExerciseList}
        exercises={allExercises}
        currentExerciseIndex={nextExerciseGlobalIndex}
        onSelectExercise={handleSelectExercise}
      />

      {/* Main content */}
      <View style={styles.content}>
        {/* REST label */}
        <Text style={styles.restLabel}>{t("workout.phase.rest")}</Text>

        {/* Large timer */}
        <Animated.Text
          style={[
            styles.timer,
            { transform: [{ scale: pulseAnim }] },
            timeRemaining <= 5 && styles.timerWarning
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
            NEXT {nextExerciseIndex}/{totalExercises}
          </Text>

          {/* Exercise name row with duration on right */}
          <View style={styles.exerciseNameRow}>
            <Text style={styles.nextExerciseName}>{nextExercise.name}</Text>
            {onHelp && (
              <TouchableOpacity onPress={onHelp} style={styles.helpButton}>
                <Ionicons name="help-circle" size={20} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            )}
            <Text style={styles.durationLabel}>{getNextDuration()}</Text>
          </View>

          {/* Video preview with rounded top corners */}
          <View style={styles.videoContainer}>
            {mp4Url ? (
              <Video
                source={{ uri: mp4Url }}
                style={styles.videoPreview}
                resizeMode={ResizeMode.COVER}
                repeat={true}
                rate={0.75}
                muted={true}
                paused={false}
                controls={false}
              />
            ) : (
              <View style={styles.videoPreview} />
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: brand.primary
  },
  header: {
    flexDirection: "row" as const,
    justifyContent: "flex-end" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingTop: toRN(tokens.spacing[2])
  },
  headerSpacer: {
    flex: 1
  },
  menuButton: {
    padding: toRN(tokens.spacing[2])
  },
  content: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[10])
  },
  restLabel: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.bold,
    color: "white",
    letterSpacing: 3,
    marginBottom: toRN(tokens.spacing[2]),
    textTransform: "uppercase" as const
  },
  timer: {
    fontSize: toRN(72),
    fontFamily: fontFamily.groteskBold,
    color: "white",
    marginBottom: toRN(tokens.spacing[6])
  },
  timerWarning: {
    color: "#FFCC00"
  },
  buttonRow: {
    flexDirection: "row" as const,
    gap: toRN(tokens.spacing[3])
  },
  extendButton: {
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingVertical: toRN(tokens.spacing[4]),
    paddingHorizontal: toRN(tokens.spacing[8]),
    borderRadius: toRN(tokens.borderRadius.full),
    minWidth: toRN(110),
    alignItems: "center" as const
  },
  extendButtonText: {
    color: "white",
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.bold
  },
  skipButton: {
    backgroundColor: "white",
    paddingVertical: toRN(tokens.spacing[4]),
    paddingHorizontal: toRN(tokens.spacing[8]),
    borderRadius: toRN(tokens.borderRadius.full),
    minWidth: toRN(110),
    alignItems: "center" as const
  },
  skipButtonText: {
    color: brand.primary,
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.bold
  },
  // Next exercise section - fills remaining space to bottom
  nextExerciseContainer: {
    flex: 1,
    paddingTop: toRN(tokens.spacing[4])
  },
  nextLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.bold,
    color: "white",
    letterSpacing: 0.5,
    marginBottom: toRN(tokens.spacing[1]),
    textTransform: "uppercase" as const,
    paddingHorizontal: toRN(tokens.spacing[4])
  },
  exerciseNameRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[4])
  },
  nextExerciseName: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: "white",
    textTransform: "capitalize" as const
  },
  helpButton: {
    marginLeft: toRN(tokens.spacing[1]),
    padding: toRN(tokens.spacing[0.5])
  },
  durationLabel: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: "white",
    marginLeft: "auto" as const
  },
  // Video container with rounded top corners - fills remaining space to bottom
  videoContainer: {
    flex: 1,
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: toRN(tokens.borderRadius["3xl"]),
    borderTopRightRadius: toRN(tokens.borderRadius["3xl"]),
    overflow: "hidden" as const
  },
  videoPreview: {
    width: "100%",
    height: "100%"
  }
});
