import React, { useEffect, useRef, useState } from "react";
import { View, Text, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import Button from "@/components/ui/Button";
import { WorkoutStats } from "@/hooks/useWorkoutTimer";

// Dynamic import for confetti to avoid crashes if it fails to load
let ConfettiCannon: any = null;
try {
  ConfettiCannon = require("react-native-confetti-cannon").default;
} catch (e) {
  // Confetti not available, will skip rendering
}

interface WorkoutCompleteProps {
  stats: WorkoutStats;
  onClose: () => void;
  goalId: string;
}

export function WorkoutComplete({
  stats,
  onClose,
  goalId,
}: WorkoutCompleteProps) {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();

  // State for confetti
  const [showConfetti, setShowConfetti] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();

    // Show confetti after a short delay (if available)
    if (ConfettiCannon) {
      setTimeout(() => {
        setShowConfetti(true);
      }, 200);
    }
  }, [fadeAnim, scaleAnim]);

  // Format duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  // Calculate completion percentage
  const completionPercent =
    stats.totalSets > 0
      ? Math.round((stats.setsCompleted / stats.totalSets) * 100)
      : 100;

  // Estimate calories burned (rough estimate: ~5-8 cal per minute for strength training)
  const estimatedCalories = Math.round((stats.totalDurationSeconds / 60) * 6.5);

  // Determine motivational message based on performance
  const getMessage = () => {
    if (completionPercent === 100) {
      return t("workout.complete.perfect");
    } else if (completionPercent >= 80) {
      return t("workout.complete.great");
    } else if (completionPercent >= 50) {
      return t("workout.complete.good");
    }
    return t("workout.complete.keep_going");
  };

  return (
    <View style={styles.container}>
      {/* Confetti - only render if available and after delay */}
      {showConfetti && ConfettiCannon && (
        <ConfettiCannon
          count={100}
          origin={{ x: -10, y: -10 }}
          fadeOut
          autoStart={true}
          colors={[brandColors.primary, "#FFD700", "#FF6B6B", "#4ECDC4"]}
        />
      )}

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Trophy Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="trophy" size={80} color="#FFD700" />
        </View>

        {/* Title */}
        <Text style={styles.title}>{t("workout.complete.title")}</Text>

        {/* Motivational Message */}
        <Text style={styles.message}>{getMessage()}</Text>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Ionicons
              name="time-outline"
              size={24}
              color={brandColors.primary}
              style={styles.statIcon}
            />
            <Text style={styles.statValue}>
              {formatDuration(stats.totalDurationSeconds)}
            </Text>
            <Text style={styles.statLabel}>
              {t("workout.complete.total_time", "Total Time")}
            </Text>
          </View>

          <View style={styles.statBox}>
            <Ionicons
              name="flame-outline"
              size={24}
              color="#FF6B6B"
              style={styles.statIcon}
            />
            <Text style={[styles.statValue, { color: "#FF6B6B" }]}>
              {estimatedCalories}
            </Text>
            <Text style={styles.statLabel}>
              {t("workout.complete.calories", "Calories")}
            </Text>
          </View>

          <View style={styles.statBox}>
            <Ionicons
              name="barbell-outline"
              size={24}
              color={brandColors.primary}
              style={styles.statIcon}
            />
            <Text style={styles.statValue}>{stats.exercisesCompleted}</Text>
            <Text style={styles.statLabel}>
              {t("workout.complete.exercises")}
            </Text>
          </View>

          <View style={styles.statBox}>
            <Ionicons
              name="checkmark-circle-outline"
              size={24}
              color={
                completionPercent === 100 ? "#FFD700" : brandColors.primary
              }
              style={styles.statIcon}
            />
            <Text
              style={[
                styles.statValue,
                completionPercent === 100 && styles.perfectValue,
              ]}
            >
              {completionPercent}%
            </Text>
            <Text style={styles.statLabel}>
              {t("workout.complete.completion")}
            </Text>
          </View>
        </View>

        {/* Perfect Workout Badge */}
        {completionPercent === 100 && stats.exercisesSkipped === 0 && (
          <View style={styles.perfectBadge}>
            <Ionicons name="star" size={20} color="#FFD700" />
            <Text style={styles.perfectBadgeText}>
              {t("workout.complete.perfect_badge")}
            </Text>
          </View>
        )}

        {/* Skipped Info */}
        {stats.exercisesSkipped > 0 && (
          <View style={styles.skippedInfo}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color={colors.text.tertiary}
            />
            <Text style={styles.skippedText}>
              {t("workout.complete.skipped", { count: stats.exercisesSkipped })}
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Done Button */}
      <View style={styles.buttonContainer}>
        <Button
          title={t("workout.complete.done")}
          onPress={onClose}
          variant="primary"
          size="lg"
          fullWidth
          leftIcon="checkmark"
        />
      </View>
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
  content: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[6]),
  },
  iconContainer: {
    width: toRN(140),
    height: toRN(140),
    borderRadius: toRN(70),
    backgroundColor: "#FFD700" + "20",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: toRN(tokens.spacing[6]),
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize["3xl"]),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[2]),
  },
  message: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[8]),
  },
  statsGrid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[6]),
  },
  statBox: {
    width: toRN(140),
    backgroundColor: colors.bg.secondary,
    borderRadius: toRN(tokens.borderRadius.lg),
    padding: toRN(tokens.spacing[4]),
    alignItems: "center" as const,
  },
  statIcon: {
    marginBottom: toRN(tokens.spacing[2]),
  },
  statValue: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.groteskBold,
    color: brand.primary,
  },
  perfectValue: {
    color: "#FFD700",
  },
  statLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[1]),
    textTransform: "uppercase" as const,
  },
  perfectBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    backgroundColor: "#FFD700" + "20",
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.full),
    marginBottom: toRN(tokens.spacing[4]),
  },
  perfectBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: "#FFD700",
  },
  skippedInfo: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
  },
  skippedText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
  },
  buttonContainer: {
    padding: toRN(tokens.spacing[4]),
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
});
