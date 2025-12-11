import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { Ionicons } from "@expo/vector-icons";
import { resolveApiRootUrl } from "@/services/api/base";

interface ExerciseDemo {
  id: string;
  gif_url: string;
  gif_url_thumb: string;
  target_muscle: string;
  body_part: string;
  equipment: string;
  difficulty: string;
  secondary_muscles: string[];
  instructions: string[];
  description: string;
  category: string;
}

interface Exercise {
  name: string;
  sets?: number;
  reps?: string | number;
  duration?: string;
  demo?: ExerciseDemo;
}

interface ExerciseCardProps {
  exercise: Exercise;
  index: number;
}

export function ExerciseCard({ exercise, index }: ExerciseCardProps) {
  const styles = useStyles(makeExerciseCardStyles);
  const { colors, brandColors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Use API root URL (without /api/v1) for static files
  const apiRootUrl = resolveApiRootUrl();
  const gifUrl = exercise.demo?.gif_url
    ? `${apiRootUrl}${exercise.demo.gif_url}`
    : null;

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
      {/* Exercise Header */}
      <View style={styles.header}>
        <View style={styles.numberBadge}>
          <Text style={styles.numberText}>{index + 1}</Text>
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.exerciseName}>{exercise.name}</Text>
          {(exercise.sets || exercise.duration) && (
            <Text style={styles.setsReps}>
              {exercise.sets && exercise.reps
                ? `${exercise.sets} sets × ${exercise.reps} reps`
                : exercise.duration || ""}
            </Text>
          )}
        </View>
        {exercise.demo && (
          <TouchableOpacity
            style={styles.expandButton}
            onPress={() => setExpanded(!expanded)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={20}
              color={brandColors.primary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Expanded Content */}
      {expanded && exercise.demo && (
        <View style={styles.expandedContent}>
          {/* GIF Demonstration */}
          {gifUrl && !imageError && (
            <View style={styles.gifContainer}>
              {!imageLoaded && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={brandColors.primary} />
                  <Text style={styles.loadingText}>Loading demo...</Text>
                </View>
              )}
              <Image
                source={{ uri: gifUrl }}
                style={[styles.gif, !imageLoaded && styles.gifHidden]}
                resizeMode="contain"
                onLoad={() => {
                  setImageLoaded(true);
                }}
                onError={(error) => {
                  setImageError(true);
                  setImageLoaded(true);
                }}
              />
            </View>
          )}

          {/* Error State */}
          {imageError && (
            <View style={styles.errorContainer}>
              <Ionicons
                name="alert-circle-outline"
                size={24}
                color={colors.text.tertiary}
              />
              <Text style={styles.errorText}>Demo unavailable</Text>
            </View>
          )}

          {/* Exercise Metadata */}
          <View style={styles.metadataRow}>
            {exercise.demo.target_muscle && (
              <View style={styles.chip}>
                <Ionicons
                  name="fitness"
                  size={14}
                  color={brandColors.primary}
                />
                <Text style={styles.chipText}>
                  {exercise.demo.target_muscle}
                </Text>
              </View>
            )}
            {exercise.demo.equipment && (
              <View style={styles.chip}>
                <Ionicons
                  name="barbell-outline"
                  size={14}
                  color={colors.text.secondary}
                />
                <Text style={styles.chipText}>{exercise.demo.equipment}</Text>
              </View>
            )}
            {exercise.demo.difficulty && (
              <View
                style={[
                  styles.chip,
                  styles.difficultyChip,
                  {
                    backgroundColor:
                      getDifficultyColor(exercise.demo.difficulty) + "15",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: getDifficultyColor(exercise.demo.difficulty) },
                  ]}
                >
                  {exercise.demo.difficulty}
                </Text>
              </View>
            )}
          </View>

          {/* Instructions */}
          {exercise.demo.instructions &&
            exercise.demo.instructions.length > 0 && (
              <View style={styles.instructionsContainer}>
                <Text style={styles.instructionsTitle}>How to perform:</Text>
                {exercise.demo.instructions.map((step, i) => (
                  <View key={i} style={styles.instructionRow}>
                    <Text style={styles.instructionNumber}>{i + 1}.</Text>
                    <Text style={styles.instructionText}>{step}</Text>
                  </View>
                ))}
              </View>
            )}

          {/* Secondary Muscles */}
          {exercise.demo.secondary_muscles &&
            exercise.demo.secondary_muscles.length > 0 && (
              <View style={styles.secondaryMuscles}>
                <Text style={styles.secondaryMusclesLabel}>Also works:</Text>
                <Text style={styles.secondaryMusclesText}>
                  {exercise.demo.secondary_muscles.join(", ")}
                </Text>
              </View>
            )}
        </View>
      )}
    </View>
  );
}

const makeExerciseCardStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    paddingVertical: toRN(tokens.spacing[3]),
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: toRN(tokens.spacing[2]),
  },
  numberBadge: {
    width: toRN(tokens.spacing[6]),
    height: toRN(tokens.spacing[6]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: brand.primary + "1A",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    flexShrink: 0,
    marginTop: toRN(tokens.spacing[0.5]),
  },
  numberText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: brand.primary,
  },
  headerContent: {
    flex: 1,
    gap: toRN(tokens.spacing[0.5]),
  },
  exerciseName: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    lineHeight: toRN(tokens.typography.fontSize.base) * 1.4,
    textTransform: "capitalize" as const,
  },
  setsReps: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
  },
  expandButton: {
    padding: toRN(tokens.spacing[1]),
  },
  expandedContent: {
    marginTop: toRN(tokens.spacing[3]),
    marginLeft: toRN(tokens.spacing[8]),
    gap: toRN(tokens.spacing[3]),
  },
  gifContainer: {
    width: "100%",
    height: toRN(200),
    borderRadius: toRN(tokens.borderRadius.lg),
    backgroundColor: colors.bg.muted,
    overflow: "hidden" as const,
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
  gif: {
    width: "100%",
    height: "100%",
  },
  gifHidden: {
    opacity: 0,
  },
  loadingText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[2]),
  },
  errorContainer: {
    padding: toRN(tokens.spacing[4]),
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
  },
  errorText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
  },
  metadataRow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: toRN(tokens.spacing[2]),
  },
  chip: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
    paddingVertical: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[2]),
    borderRadius: toRN(tokens.borderRadius.md),
    backgroundColor: colors.bg.muted,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  difficultyChip: {
    borderWidth: 0,
  },
  chipText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
    textTransform: "capitalize" as const,
  },
  instructionsContainer: {
    gap: toRN(tokens.spacing[2]),
  },
  instructionsTitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
  instructionRow: {
    flexDirection: "row" as const,
    gap: toRN(tokens.spacing[2]),
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
  secondaryMuscles: {
    paddingTop: toRN(tokens.spacing[2]),
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  secondaryMusclesLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: colors.text.secondary,
    marginBottom: toRN(tokens.spacing[1]),
  },
  secondaryMusclesText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
    textTransform: "capitalize" as const,
  },
});
