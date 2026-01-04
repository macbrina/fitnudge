import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/lib/i18n";
import { ExerciseDetailModal } from "@/components/exercises";
import type { WorkoutExercise } from "@/types/workout";

// Extend WorkoutExercise to allow optional fields for backward compatibility
export interface Exercise extends Partial<WorkoutExercise> {
  name: string;
  duration?: string; // For time-based exercises
}

interface ExerciseCardProps {
  exercise: Exercise;
  index: number;
}

export function ExerciseCard({ exercise, index }: ExerciseCardProps) {
  const styles = useStyles(makeExerciseCardStyles);
  const { brandColors } = useTheme();
  const { t } = useTranslation();
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // Get exercise ID for detail modal
  const exerciseId = exercise.exercise_id;

  return (
    <View style={styles.container}>
      {/* Exercise Row - Tappable */}
      <TouchableOpacity
        style={styles.row}
        onPress={() => exerciseId && setDetailModalVisible(true)}
        disabled={!exerciseId}
        activeOpacity={0.7}
      >
        <View style={styles.numberBadge}>
          <Text style={styles.numberText}>{index + 1}</Text>
        </View>
        <View style={styles.content}>
          <Text style={styles.exerciseName}>{exercise.name}</Text>
          <View style={styles.meta}>
            {exercise.sets && exercise.reps && (
              <Text style={styles.setsReps}>
                {exercise.sets} sets × {exercise.reps} reps
              </Text>
            )}
            {exercise.duration && !exercise.sets && (
              <Text style={styles.setsReps}>{exercise.duration}</Text>
            )}
            {exercise.target_muscle && (
              <View style={styles.muscleChip}>
                <Ionicons name="fitness" size={12} color={brandColors.primary} />
                <Text style={styles.muscleText}>{exercise.target_muscle}</Text>
              </View>
            )}
          </View>
        </View>
        {exerciseId && (
          <View style={styles.arrowContainer}>
            <Ionicons name="chevron-forward" size={18} color={brandColors.primary} />
          </View>
        )}
      </TouchableOpacity>

      {/* Exercise Detail Modal - passes exercise data for focus_cues etc */}
      <ExerciseDetailModal
        visible={detailModalVisible}
        exerciseId={exerciseId}
        exerciseData={exercise}
        onClose={() => setDetailModalVisible(false)}
      />
    </View>
  );
}

const makeExerciseCardStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle
  },
  row: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[3])
  },
  numberBadge: {
    width: toRN(tokens.spacing[6]),
    height: toRN(tokens.spacing[6]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: brand.primary + "1A",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    flexShrink: 0
  },
  numberText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: brand.primary
  },
  content: {
    flex: 1,
    gap: toRN(tokens.spacing[1])
  },
  exerciseName: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    lineHeight: toRN(tokens.typography.fontSize.base) * 1.3,
    textTransform: "capitalize" as const
  },
  meta: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    flexWrap: "wrap" as const,
    gap: toRN(tokens.spacing[2])
  },
  setsReps: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary
  },
  muscleChip: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
    paddingVertical: toRN(tokens.spacing[0.5]),
    paddingHorizontal: toRN(tokens.spacing[2]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: brand.primary + "10"
  },
  muscleText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: brand.primary,
    textTransform: "capitalize" as const
  },
  arrowContainer: {
    width: toRN(tokens.spacing[6]),
    height: toRN(tokens.spacing[6]),
    alignItems: "center" as const,
    justifyContent: "center" as const
  }
});
