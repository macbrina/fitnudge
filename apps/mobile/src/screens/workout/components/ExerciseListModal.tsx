import React from "react";
import { View, Text, Modal, TouchableOpacity, FlatList, Dimensions } from "react-native";
import Video, { ResizeMode } from "react-native-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { Ionicons } from "@expo/vector-icons";
import type { WorkoutExercise, WarmupCooldownExercise } from "@/types/workout";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

type AnyExercise = WorkoutExercise | WarmupCooldownExercise;

interface ExerciseListModalProps {
  visible: boolean;
  onClose: () => void;
  exercises: AnyExercise[];
  currentExerciseIndex: number;
  onSelectExercise: (index: number) => void;
}

/**
 * Modal showing list of all exercises in the workout
 * Highlights the current/next exercise
 * Allows jumping to any exercise
 */
export function ExerciseListModal({
  visible,
  onClose,
  exercises,
  currentExerciseIndex,
  onSelectExercise
}: ExerciseListModalProps) {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // Get exercise duration display
  const getExerciseDuration = (exercise: AnyExercise) => {
    if ("duration_seconds" in exercise && exercise.duration_seconds) {
      const mins = Math.floor(exercise.duration_seconds / 60);
      const secs = exercise.duration_seconds % 60;
      return mins > 0
        ? `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
        : `00:${secs.toString().padStart(2, "0")}`;
    }
    if ("work_duration_seconds" in exercise && exercise.work_duration_seconds) {
      const mins = Math.floor(exercise.work_duration_seconds / 60);
      const secs = exercise.work_duration_seconds % 60;
      return mins > 0
        ? `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
        : `00:${secs.toString().padStart(2, "0")}`;
    }
    if ("reps" in exercise && exercise.reps) {
      return `${exercise.reps} reps`;
    }
    return "00:30";
  };

  // Get MP4 URL for exercise
  const getMp4Url = (exercise: AnyExercise) => {
    if ("mp4_url" in exercise && exercise.mp4_url) {
      return exercise.mp4_url;
    }
    if ("demo" in exercise && exercise.demo?.mp4_url) {
      return exercise.demo.mp4_url;
    }
    return null;
  };

  const handleExercisePress = (index: number) => {
    onSelectExercise(index);
    onClose();
  };

  const renderExerciseItem = ({ item, index }: { item: AnyExercise; index: number }) => {
    const isHighlighted = index === currentExerciseIndex;
    const isCompleted = index < currentExerciseIndex; // Exercises before current are completed
    const mp4Url = getMp4Url(item);

    return (
      <TouchableOpacity
        style={[
          styles.exerciseItem,
          isCompleted && styles.exerciseItemCompleted,
          isHighlighted && styles.exerciseItemHighlighted
        ]}
        onPress={() => handleExercisePress(index)}
        activeOpacity={0.7}
      >
        {/* Exercise thumbnail */}
        <View
          style={[styles.thumbnailContainer, isCompleted && styles.thumbnailContainerCompleted]}
        >
          {mp4Url ? (
            <Video
              source={{ uri: mp4Url }}
              style={styles.thumbnail}
              resizeMode={ResizeMode.COVER}
              repeat={true}
              rate={0.75}
              muted={true}
              paused={!visible}
              controls={false}
            />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Ionicons name="fitness" size={24} color={colors.text.tertiary} />
            </View>
          )}
          {/* Completed overlay with checkmark */}
          {isCompleted && (
            <View style={styles.completedOverlay}>
              <Ionicons name="checkmark-circle" size={24} color="white" />
            </View>
          )}
        </View>

        {/* Exercise info */}
        <View style={styles.exerciseInfo}>
          <Text
            style={[
              styles.exerciseName,
              isCompleted && styles.exerciseNameCompleted,
              isHighlighted && styles.exerciseNameHighlighted
            ]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text
            style={[
              styles.exerciseDuration,
              isCompleted && styles.exerciseDurationCompleted,
              isHighlighted && styles.exerciseDurationHighlighted
            ]}
          >
            {getExerciseDuration(item)}
          </Text>
        </View>
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
          <Text style={styles.title}>
            {exercises.length} {t("workout.exercises_title")}
          </Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={24} color={colors.text.tertiary} />
          </TouchableOpacity>
        </View>

        {/* Exercise list */}
        <FlatList
          data={exercises}
          renderItem={renderExerciseItem}
          keyExtractor={(_, index) => `exercise-${index}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialScrollIndex={currentExerciseIndex > 2 ? currentExerciseIndex - 2 : 0}
          getItemLayout={(data, index) => ({
            length: 80,
            offset: 80 * index,
            index
          })}
        />

        {/* Close button at bottom */}
        <View
          style={[
            styles.bottomContainer,
            { paddingBottom: insets.bottom + toRN(tokens.spacing[4]) }
          ]}
        >
          <TouchableOpacity style={styles.closeButtonBottom} onPress={onClose}>
            <Text style={styles.closeButtonText}>{t("common.close")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  header: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[4])
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.bold,
    color: colors.text.primary
  },
  closeButton: {
    width: toRN(32),
    height: toRN(32),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: colors.bg.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  listContent: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[4])
  },
  exerciseItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.xl),
    padding: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[2]),
    borderWidth: 1,
    borderColor: colors.border.subtle
  },
  exerciseItemCompleted: {
    backgroundColor: colors.bg.muted,
    opacity: 0.7
  },
  exerciseItemHighlighted: {
    backgroundColor: brand.primary,
    borderColor: brand.primary,
    opacity: 1
  },
  thumbnailContainer: {
    width: toRN(60),
    height: toRN(60),
    borderRadius: toRN(tokens.borderRadius.lg),
    overflow: "hidden" as const,
    backgroundColor: colors.bg.muted,
    position: "relative" as const
  },
  thumbnailContainerCompleted: {
    opacity: 0.6
  },
  thumbnail: {
    width: "100%",
    height: "100%"
  },
  thumbnailPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: colors.bg.muted
  },
  completedOverlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  exerciseInfo: {
    flex: 1,
    marginLeft: toRN(tokens.spacing[3])
  },
  exerciseName: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    textTransform: "capitalize" as const,
    marginBottom: toRN(tokens.spacing[0.5])
  },
  exerciseNameCompleted: {
    color: colors.text.tertiary
  },
  exerciseNameHighlighted: {
    color: "white"
  },
  exerciseDuration: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary
  },
  exerciseDurationCompleted: {
    color: colors.text.muted
  },
  exerciseDurationHighlighted: {
    color: "rgba(255,255,255,0.8)"
  },
  bottomContainer: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingTop: toRN(tokens.spacing[3]),
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle
  },
  closeButtonBottom: {
    backgroundColor: brand.primary,
    paddingVertical: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.xl),
    alignItems: "center" as const
  },
  closeButtonText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: "white"
  }
});

export default ExerciseListModal;
