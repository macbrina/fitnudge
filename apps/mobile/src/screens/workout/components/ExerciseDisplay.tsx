import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";

interface ExerciseDemo {
  id: string;
  mp4_url: string;
  target_muscle: string;
  body_part?: string;
  equipment?: string;
  difficulty?: string;
  secondary_muscles?: string[];
  instructions?: string[];
  description?: string;
  category?: string;
}

interface Exercise {
  exercise_id?: string;
  name: string;
  sets?: number;
  reps?: number | string;
  work_duration_seconds?: number;
  rest_between_sets_seconds?: number;
  demo?: ExerciseDemo;
}

interface ExerciseDisplayProps {
  exercise: Exercise;
  isResting?: boolean;
  isPaused?: boolean; // Sync video pause with workout pause
}

export function ExerciseDisplay({
  exercise,
  isResting = false,
  isPaused = false,
}: ExerciseDisplayProps) {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // MP4 URLs are now full Cloudflare CDN URLs stored in the database
  const mp4Url = exercise.demo?.mp4_url || null;

  // Create video player with expo-video
  const player = useVideoPlayer(mp4Url || "", (player) => {
    player.loop = true;
    player.playbackRate = 0.5; // Slow motion
    player.muted = true;
  });

  // Listen for player status changes to know when video is ready
  useEffect(() => {
    if (!player) return;

    const subscription = player.addListener("statusChange", (status) => {
      if (status.status === "readyToPlay") {
        setVideoLoaded(true);
      } else if (status.status === "error") {
        setVideoError(true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [player]);

  // Sync video playback with workout pause state
  useEffect(() => {
    if (player && mp4Url) {
      if (isPaused || isResting) {
        player.pause();
      } else {
        player.play();
      }
    }
  }, [isPaused, isResting, mp4Url, player]);

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty?.toLowerCase()) {
      case "beginner":
        return colors.feedback.success;
      case "intermediate":
        return colors.feedback.warning;
      case "advanced":
        return colors.feedback.error;
      default:
        return colors.text.secondary;
    }
  };

  return (
    <View style={styles.container}>
      {/* Exercise Name */}
      <Text
        style={[styles.exerciseName, isResting && styles.exerciseNameResting]}
      >
        {exercise.name}
      </Text>

      {/* Sets x Reps */}
      {!isResting && (exercise.sets || exercise.reps) && (
        <Text style={styles.setsReps}>
          {exercise.sets && exercise.reps
            ? `${exercise.sets} ${t("workout.sets")} × ${exercise.reps} ${t("workout.reps")}`
            : ""}
        </Text>
      )}

      {/* Resting message */}
      {isResting && (
        <Text style={styles.restingMessage}>{t("workout.take_a_break")}</Text>
      )}

      {/* Video Display */}
      {mp4Url && !videoError && !isResting && (
        <View style={styles.videoContainer}>
          {!videoLoaded && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={brandColors.primary} />
            </View>
          )}
          <VideoView
            player={player}
            style={[styles.video, !videoLoaded && styles.videoHidden]}
            contentFit="contain"
            nativeControls={false}
          />
        </View>
      )}

      {/* Resting animation placeholder */}
      {isResting && (
        <View style={styles.restingContainer}>
          <View style={styles.restingIconContainer}>
            <Ionicons
              name="cafe-outline"
              size={64}
              color={colors.feedback.success}
            />
          </View>
          <Text style={styles.restingHint}>{t("workout.catch_breath")}</Text>
        </View>
      )}

      {/* Exercise Info Tags */}
      {exercise.demo && !isResting && (
        <View style={styles.tagsContainer}>
          {exercise.demo.target_muscle && (
            <View style={styles.tag}>
              <Ionicons name="fitness" size={14} color={brandColors.primary} />
              <Text style={styles.tagText}>{exercise.demo.target_muscle}</Text>
            </View>
          )}
          {exercise.demo.equipment && (
            <View style={styles.tag}>
              <Ionicons
                name="barbell-outline"
                size={14}
                color={colors.text.secondary}
              />
              <Text style={styles.tagText}>{exercise.demo.equipment}</Text>
            </View>
          )}
          {exercise.demo.difficulty && (
            <View
              style={[
                styles.tag,
                {
                  backgroundColor:
                    getDifficultyColor(exercise.demo.difficulty) + "15",
                },
              ]}
            >
              <Text
                style={[
                  styles.tagText,
                  { color: getDifficultyColor(exercise.demo.difficulty) },
                ]}
              >
                {exercise.demo.difficulty}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Details Toggle */}
      {exercise.demo?.instructions && !isResting && (
        <TouchableOpacity
          style={styles.detailsToggle}
          onPress={() => setShowDetails(!showDetails)}
        >
          <Text style={styles.detailsToggleText}>
            {showDetails
              ? t("workout.hide_details")
              : t("workout.show_details")}
          </Text>
          <Ionicons
            name={showDetails ? "chevron-up" : "chevron-down"}
            size={16}
            color={brandColors.primary}
          />
        </TouchableOpacity>
      )}

      {/* Details Panel */}
      {showDetails && exercise.demo?.instructions && (
        <ScrollView style={styles.detailsPanel} nestedScrollEnabled>
          {/* Body Part & Category */}
          <View style={styles.detailsRow}>
            {exercise.demo.body_part && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>{t("workout.body_part")}</Text>
                <Text style={styles.detailValue}>
                  {exercise.demo.body_part}
                </Text>
              </View>
            )}
            {exercise.demo.category && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>{t("workout.category")}</Text>
                <Text style={styles.detailValue}>{exercise.demo.category}</Text>
              </View>
            )}
          </View>

          {/* Secondary Muscles */}
          {exercise.demo.secondary_muscles &&
            exercise.demo.secondary_muscles.length > 0 && (
              <View style={styles.secondaryMuscles}>
                <Text style={styles.detailLabel}>
                  {t("workout.also_works")}
                </Text>
                <Text style={styles.secondaryMusclesText}>
                  {exercise.demo.secondary_muscles.join(", ")}
                </Text>
              </View>
            )}

          {/* Description */}
          {exercise.demo.description && (
            <View style={styles.descriptionContainer}>
              <Text style={styles.detailLabel}>{t("workout.description")}</Text>
              <Text style={styles.descriptionText}>
                {exercise.demo.description}
              </Text>
            </View>
          )}

          {/* Instructions */}
          <View style={styles.instructionsContainer}>
            <Text style={styles.detailLabel}>{t("workout.how_to")}</Text>
            {exercise.demo.instructions.map((step, index) => (
              <View key={index} style={styles.instructionRow}>
                <Text style={styles.instructionNumber}>{index + 1}.</Text>
                <Text style={styles.instructionText}>{step}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
  },
  exerciseName: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
    textAlign: "center" as const,
    textTransform: "capitalize" as const,
  },
  exerciseNameResting: {
    color: colors.text.secondary,
    fontSize: toRN(tokens.typography.fontSize.lg),
  },
  setsReps: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
    marginTop: toRN(tokens.spacing[1]),
  },
  restingMessage: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.medium,
    color: colors.feedback.success,
    marginTop: toRN(tokens.spacing[2]),
  },
  videoContainer: {
    width: "100%",
    height: toRN(200),
    borderRadius: toRN(tokens.borderRadius.xl),
    backgroundColor: colors.bg.secondary,
    overflow: "hidden" as const,
    marginTop: toRN(tokens.spacing[4]),
    position: "relative" as const,
  },
  loadingContainer: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    zIndex: 1,
  },
  video: {
    width: "100%",
    height: "100%",
  },
  videoHidden: {
    opacity: 0,
  },
  restingContainer: {
    alignItems: "center" as const,
    marginTop: toRN(tokens.spacing[6]),
  },
  restingIconContainer: {
    width: toRN(120),
    height: toRN(120),
    borderRadius: toRN(60),
    backgroundColor: colors.feedback.success + "15",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  restingHint: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[3]),
  },
  tagsContainer: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[2]),
    marginTop: toRN(tokens.spacing[3]),
  },
  tag: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
    paddingVertical: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[2]),
    borderRadius: toRN(tokens.borderRadius.md),
    backgroundColor: colors.bg.muted,
  },
  tagText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
    textTransform: "capitalize" as const,
  },
  detailsToggle: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
    marginTop: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[2]),
  },
  detailsToggleText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: brand.primary,
  },
  detailsPanel: {
    width: "100%",
    maxHeight: toRN(200),
    backgroundColor: colors.bg.secondary,
    borderRadius: toRN(tokens.borderRadius.lg),
    padding: toRN(tokens.spacing[3]),
    marginTop: toRN(tokens.spacing[2]),
  },
  detailsRow: {
    flexDirection: "row" as const,
    gap: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[3]),
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: colors.text.tertiary,
    textTransform: "uppercase" as const,
    marginBottom: toRN(tokens.spacing[1]),
  },
  detailValue: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.primary,
    textTransform: "capitalize" as const,
  },
  secondaryMuscles: {
    marginBottom: toRN(tokens.spacing[3]),
  },
  secondaryMusclesText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
    textTransform: "capitalize" as const,
  },
  descriptionContainer: {
    marginBottom: toRN(tokens.spacing[3]),
  },
  descriptionText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5,
  },
  instructionsContainer: {
    marginBottom: toRN(tokens.spacing[2]),
  },
  instructionRow: {
    flexDirection: "row" as const,
    gap: toRN(tokens.spacing[2]),
    marginTop: toRN(tokens.spacing[1]),
  },
  instructionNumber: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: brand.primary,
    minWidth: toRN(tokens.spacing[4]),
  },
  instructionText: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5,
  },
});
