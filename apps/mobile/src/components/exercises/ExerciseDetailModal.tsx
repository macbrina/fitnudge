import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/lib/i18n";
import { useExerciseDetails } from "@/hooks/api/useExercises";
import { SkeletonBox } from "@/components/ui/SkeletonBox";

import type { WorkoutExercise } from "@/types/workout";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// Exercise data passed from plan (extends WorkoutExercise for backward compatibility)
export interface ExerciseFromPlan extends Partial<WorkoutExercise> {
  name: string;
  duration?: string; // For time-based exercises
}

interface ExerciseDetailModalProps {
  visible: boolean;
  exerciseId: string | undefined;
  exerciseData?: ExerciseFromPlan | WorkoutExercise; // Pass the exercise data from the plan
  onClose: () => void;
}

export function ExerciseDetailModal({
  visible,
  exerciseId,
  exerciseData,
  onClose,
}: ExerciseDetailModalProps) {
  const styles = useStyles(makeExerciseDetailModalStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const {
    data: exercise,
    isLoading,
    error,
  } = useExerciseDetails(exerciseId, visible && !!exerciseId);

  // Reset video state when modal opens with new exercise
  React.useEffect(() => {
    if (visible && exerciseId) {
      setVideoLoaded(false);
      setVideoError(false);
    }
  }, [visible, exerciseId]);

  // MP4 URLs are now full Cloudflare CDN URLs stored in the database
  const mp4Url = exercise?.mp4_url || null;

  // Video player for exercise demonstration
  const player = useVideoPlayer(mp4Url || "", (player) => {
    player.loop = true;
    player.playbackRate = 0.5;
    player.muted = true;
  });

  // Listen for player status changes
  useEffect(() => {
    if (!player) return;

    const subscription = player.addListener("statusChange", (status) => {
      if (status.status === "readyToPlay") {
        setVideoLoaded(true);
        player.play();
      } else if (status.status === "error") {
        setVideoError(true);
        setVideoLoaded(true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [player]);

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

  const renderLoadingState = () => (
    <View style={styles.content}>
      <SkeletonBox
        height={280}
        borderRadius={toRN(tokens.borderRadius.xl)}
        style={{ marginBottom: toRN(tokens.spacing[4]) }}
      />
      <SkeletonBox
        width="60%"
        height={28}
        borderRadius={toRN(tokens.borderRadius.md)}
        style={{ marginBottom: toRN(tokens.spacing[2]) }}
      />
      <SkeletonBox
        width="100%"
        height={40}
        borderRadius={toRN(tokens.borderRadius.md)}
        style={{ marginBottom: toRN(tokens.spacing[4]) }}
      />
      <SkeletonBox
        width="100%"
        height={100}
        borderRadius={toRN(tokens.borderRadius.lg)}
      />
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.errorContainer}>
      <Ionicons
        name="alert-circle-outline"
        size={48}
        color={colors.text.tertiary}
      />
      <Text style={styles.errorText}>{t("exercises.error_loading")}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={onClose}>
        <Text style={styles.retryButtonText}>{t("common.close")}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderContent = () => {
    if (!exercise) return null;

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + toRN(tokens.spacing[4]) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Video Demonstration */}
        <View style={styles.videoSection}>
          {mp4Url && !videoError ? (
            <View style={styles.videoContainer}>
              {!videoLoaded && (
                <View style={styles.videoLoadingContainer}>
                  <ActivityIndicator size="large" color={brandColors.primary} />
                  <Text style={styles.videoLoadingText}>
                    {t("exercises.loading_demo")}
                  </Text>
                </View>
              )}
              <VideoView
                player={player}
                style={[styles.video, !videoLoaded && styles.videoHidden]}
                contentFit="contain"
                nativeControls={false}
              />
            </View>
          ) : (
            <View style={styles.noVideoContainer}>
              <Ionicons
                name="barbell-outline"
                size={48}
                color={colors.text.tertiary}
              />
              <Text style={styles.noVideoText}>
                {t("exercises.no_demo_available")}
              </Text>
            </View>
          )}
        </View>

        {/* Exercise Name */}
        <Text style={styles.exerciseName}>{exercise.name}</Text>

        {/* Workout Info - from plan data */}
        {exerciseData &&
          (exerciseData.sets ||
            (exerciseData as ExerciseFromPlan).duration ||
            exerciseData.work_duration_seconds) && (
            <View style={styles.workoutInfoCard}>
              {exerciseData.sets && (
                <View style={styles.workoutInfoItem}>
                  <Text style={styles.workoutInfoValue}>
                    {exerciseData.sets}
                  </Text>
                  <Text style={styles.workoutInfoLabel}>
                    {t("workout.sets")}
                  </Text>
                </View>
              )}
              {exerciseData.reps && (
                <View style={styles.workoutInfoItem}>
                  <Text style={styles.workoutInfoValue}>
                    {exerciseData.reps}
                  </Text>
                  <Text style={styles.workoutInfoLabel}>
                    {t("workout.reps")}
                  </Text>
                </View>
              )}
              {exerciseData.work_duration_seconds && (
                <View style={styles.workoutInfoItem}>
                  <Text style={styles.workoutInfoValue}>
                    {exerciseData.work_duration_seconds}s
                  </Text>
                  <Text style={styles.workoutInfoLabel}>
                    {t("workout.work")}
                  </Text>
                </View>
              )}
              {exerciseData.rest_between_sets_seconds && (
                <View style={styles.workoutInfoItem}>
                  <Text style={styles.workoutInfoValue}>
                    {exerciseData.rest_between_sets_seconds}s
                  </Text>
                  <Text style={styles.workoutInfoLabel}>
                    {t("workout.rest")}
                  </Text>
                </View>
              )}
            </View>
          )}

        {/* Quick Info Chips */}
        <View style={styles.chipsRow}>
          {exercise.target_muscle && (
            <View style={[styles.chip, styles.primaryChip]}>
              <Ionicons name="fitness" size={14} color={brandColors.primary} />
              <Text style={[styles.chipText, { color: brandColors.primary }]}>
                {exercise.target_muscle}
              </Text>
            </View>
          )}
          {exercise.equipment && (
            <View style={styles.chip}>
              <Ionicons
                name="barbell-outline"
                size={14}
                color={colors.text.secondary}
              />
              <Text style={styles.chipText}>{exercise.equipment}</Text>
            </View>
          )}
          {exercise.difficulty && (
            <View
              style={[
                styles.chip,
                {
                  backgroundColor:
                    getDifficultyColor(exercise.difficulty) + "15",
                  borderColor: getDifficultyColor(exercise.difficulty) + "30",
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: getDifficultyColor(exercise.difficulty) },
                ]}
              >
                {exercise.difficulty}
              </Text>
            </View>
          )}
        </View>

        {/* Body Part & Category */}
        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons
                name="body-outline"
                size={18}
                color={colors.text.tertiary}
              />
              <View>
                <Text style={styles.infoLabel}>{t("exercises.body_part")}</Text>
                <Text style={styles.infoValue}>
                  {exercise.body_part || t("common.not_specified")}
                </Text>
              </View>
            </View>
            <View style={styles.infoItem}>
              <Ionicons
                name="albums-outline"
                size={18}
                color={colors.text.tertiary}
              />
              <View>
                <Text style={styles.infoLabel}>{t("exercises.category")}</Text>
                <Text style={styles.infoValue}>
                  {exercise.category || t("common.not_specified")}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Description */}
        {exercise.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("exercises.description")}
            </Text>
            <Text style={styles.descriptionText}>{exercise.description}</Text>
          </View>
        )}

        {/* Instructions */}
        {exercise.instructions && exercise.instructions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("exercises.how_to_perform")}
            </Text>
            <View style={styles.instructionsList}>
              {exercise.instructions.map((instruction, index) => (
                <View key={index} style={styles.instructionItem}>
                  <View style={styles.instructionNumber}>
                    <Text style={styles.instructionNumberText}>
                      {index + 1}
                    </Text>
                  </View>
                  <Text style={styles.instructionText}>{instruction}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Secondary Muscles */}
        {exercise.secondary_muscles &&
          exercise.secondary_muscles.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t("exercises.also_works")}
              </Text>
              <View style={styles.secondaryMusclesRow}>
                {exercise.secondary_muscles.map((muscle, index) => (
                  <View key={index} style={styles.secondaryMuscleChip}>
                    <Text style={styles.secondaryMuscleText}>{muscle}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

        {/* Focus Cues - from plan data */}
        {exerciseData?.focus_cues && exerciseData.focus_cues.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("exercises.focus_on")}</Text>
            <View style={styles.focusCuesList}>
              {exerciseData.focus_cues.map((cue, index) => (
                <View key={index} style={styles.focusCueItem}>
                  <View style={styles.focusCueIcon}>
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={colors.feedback.success}
                    />
                  </View>
                  <Text style={styles.focusCueText}>{cue}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {t("exercises.details")}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Content */}
        {isLoading && renderLoadingState()}
        {error && renderErrorState()}
        {!isLoading && !error && renderContent()}
      </View>
    </Modal>
  );
}

const makeExerciseDetailModalStyles = (
  tokens: any,
  colors: any,
  brand: any
) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[3]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  closeButton: {
    width: toRN(40),
    height: toRN(40),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: colors.bg.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  headerTitle: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    textAlign: "center" as const,
    marginHorizontal: toRN(tokens.spacing[3]),
  },
  headerSpacer: {
    width: toRN(40),
  },
  content: {
    flex: 1,
    padding: toRN(tokens.spacing[4]),
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: toRN(tokens.spacing[4]),
  },
  // Video Section
  videoSection: {
    marginBottom: toRN(tokens.spacing[4]),
  },
  videoContainer: {
    width: "100%",
    height: toRN(280),
    borderRadius: toRN(tokens.borderRadius.xl),
    backgroundColor: colors.bg.muted,
    overflow: "hidden" as const,
    position: "relative" as const,
  },
  videoLoadingContainer: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    zIndex: 1,
  },
  videoLoadingText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[2]),
  },
  video: {
    width: "100%",
    height: "100%",
  },
  videoHidden: {
    opacity: 0,
  },
  noVideoContainer: {
    width: "100%",
    height: toRN(200),
    borderRadius: toRN(tokens.borderRadius.xl),
    backgroundColor: colors.bg.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[2]),
  },
  noVideoText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
  },
  // Exercise Name
  exerciseName: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    textTransform: "capitalize" as const,
    marginBottom: toRN(tokens.spacing[3]),
  },
  // Workout Info Card
  workoutInfoCard: {
    flexDirection: "row" as const,
    justifyContent: "space-around" as const,
    backgroundColor: brand.primary + "10",
    borderRadius: toRN(tokens.borderRadius.xl),
    padding: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[4]),
    borderWidth: 1,
    borderColor: brand.primary + "20",
  },
  workoutInfoItem: {
    alignItems: "center" as const,
  },
  workoutInfoValue: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: brand.primary,
  },
  workoutInfoLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
    textTransform: "uppercase" as const,
    marginTop: 2,
  },
  // Chips
  chipsRow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: toRN(tokens.spacing[2]),
    marginBottom: toRN(tokens.spacing[4]),
  },
  chip: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1.5]),
    paddingVertical: toRN(tokens.spacing[1.5]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: colors.bg.muted,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  primaryChip: {
    backgroundColor: brand.primary + "15",
    borderColor: brand.primary + "30",
  },
  chipText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
    textTransform: "capitalize" as const,
  },
  // Info Section
  infoSection: {
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.xl),
    padding: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[4]),
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  infoRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
  },
  infoItem: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: toRN(tokens.spacing[2]),
  },
  infoLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    textTransform: "capitalize" as const,
  },
  // Sections
  section: {
    marginBottom: toRN(tokens.spacing[5]),
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[3]),
  },
  descriptionText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.6,
  },
  // Instructions
  instructionsList: {
    gap: toRN(tokens.spacing[3]),
  },
  instructionItem: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: toRN(tokens.spacing[3]),
  },
  instructionNumber: {
    width: toRN(28),
    height: toRN(28),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: brand.primary + "15",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    flexShrink: 0,
  },
  instructionNumberText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.bold,
    color: brand.primary,
  },
  instructionText: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5,
  },
  // Secondary Muscles
  secondaryMusclesRow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: toRN(tokens.spacing[2]),
  },
  secondaryMuscleChip: {
    paddingVertical: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[2.5]),
    borderRadius: toRN(tokens.borderRadius.md),
    backgroundColor: colors.bg.muted,
  },
  secondaryMuscleText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
    textTransform: "capitalize" as const,
  },
  // Focus Cues
  focusCuesList: {
    gap: toRN(tokens.spacing[2]),
  },
  focusCueItem: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: toRN(tokens.spacing[2]),
  },
  focusCueIcon: {
    marginTop: 2,
  },
  focusCueText: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5,
  },
  // Error State
  errorContainer: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[3]),
    padding: toRN(tokens.spacing[6]),
  },
  errorText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
    textAlign: "center" as const,
  },
  retryButton: {
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.md),
    backgroundColor: colors.bg.muted,
  },
  retryButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
});
