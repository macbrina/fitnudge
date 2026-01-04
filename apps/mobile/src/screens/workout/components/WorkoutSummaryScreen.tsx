import React, { useEffect, useRef, useState } from "react";
import { View, Text, Animated, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@/lib/i18n";
import { WorkoutStats } from "@/hooks/useWorkoutTimer";

type FeedbackRating = "hard" | "just_right" | "easy" | null;

interface WorkoutSummaryScreenProps {
  stats: WorkoutStats;
  dayNumber?: number;
  isPractice?: boolean;
  onFinish: (feedback: FeedbackRating) => void;
  onShare?: () => void;
}

// Labels will be overridden with translations
const FEEDBACK_OPTIONS = [
  {
    key: "hard" as const,
    icon: "layers",
    labelKey: "completion.feedback.hard"
  },
  {
    key: "just_right" as const,
    icon: "layers-outline",
    labelKey: "completion.feedback.just_right"
  },
  {
    key: "easy" as const,
    icon: "remove",
    labelKey: "completion.feedback.easy"
  }
];

export function WorkoutSummaryScreen({
  stats,
  dayNumber = 1,
  isPractice = false,
  onFinish,
  onShare
}: WorkoutSummaryScreenProps) {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackRating>(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 80,
          useNativeDriver: true
        })
      ]),
      Animated.timing(statsAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true
      })
    ]).start();
  }, []);

  // Format duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Estimate calories burned
  const estimatedCalories = Math.round((stats.totalDurationSeconds / 60) * 6.5);

  // Completion percentage
  const completionPercent =
    stats.totalSets > 0 ? Math.round((stats.setsCompleted / stats.totalSets) * 100) : 100;

  const handleFinish = () => {
    onFinish(selectedFeedback);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + toRN(24) }]}
    >
      {/* Header area with background image placeholder */}
      <Animated.View
        style={[
          styles.headerSection,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        {/* Gradient overlay would go here if we had an image */}
        <View style={styles.headerContent}>
          {/* Share button */}
          {onShare && (
            <Pressable
              style={[styles.shareButton, { top: insets.top + toRN(12) }]}
              onPress={onShare}
            >
              <Ionicons name="share-social" size={18} color={colors.text.primary} />
              <Text style={styles.shareButtonText}>{t("common.share").toUpperCase()}</Text>
            </Pressable>
          )}

          {/* Main title */}
          <View style={[styles.titleContainer, { marginTop: insets.top + toRN(60) }]}>
            <Text style={styles.mainTitle}>{t("completion.summary.workout")}</Text>
            <Text style={styles.mainTitle}>{t("completion.summary.completed")}</Text>

            {isPractice && (
              <View style={styles.practiceBadge}>
                <Ionicons name="fitness" size={14} color={brandColors.primary} />
                <Text style={styles.practiceBadgeText}>
                  {t("completion.summary.practice_session")}
                </Text>
              </View>
            )}
          </View>

          {/* Day number */}
          <Text style={styles.dayNumber}>{t("completion.summary.day", { number: dayNumber })}</Text>
        </View>
      </Animated.View>

      {/* Stats row */}
      <Animated.View
        style={[
          styles.statsRow,
          {
            opacity: statsAnim
          }
        ]}
      >
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.exercisesCompleted}</Text>
          <Text style={styles.statLabel}>{t("completion.summary.exercises")}</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statItem}>
          <Text style={styles.statValue}>{estimatedCalories}</Text>
          <Text style={styles.statLabel}>{t("completion.summary.calories")}</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatDuration(stats.totalDurationSeconds)}</Text>
          <Text style={styles.statLabel}>{t("completion.summary.duration")}</Text>
        </View>
      </Animated.View>

      {/* Completion badge */}
      {completionPercent === 100 && stats.exercisesSkipped === 0 && (
        <View style={styles.completionBadge}>
          <Ionicons name="checkmark-circle" size={24} color="#10B981" />
          <Text style={styles.completionBadgeText}>{t("completion.summary.perfect_workout")}</Text>
        </View>
      )}

      {/* Skipped info */}
      {stats.exercisesSkipped > 0 && (
        <View style={styles.skippedInfo}>
          <Ionicons name="information-circle-outline" size={18} color={colors.text.tertiary} />
          <Text style={styles.skippedText}>
            {t("completion.summary.exercises_skipped", {
              count: stats.exercisesSkipped
            })}
          </Text>
        </View>
      )}

      {/* Feedback section */}
      <View style={styles.feedbackSection}>
        <Text style={styles.feedbackTitle}>{t("completion.summary.how_do_you_feel")}</Text>

        <View style={styles.feedbackOptions}>
          {FEEDBACK_OPTIONS.map((option) => {
            const isSelected = selectedFeedback === option.key;
            return (
              <Pressable
                key={option.key}
                style={[styles.feedbackOption, isSelected && styles.feedbackOptionSelected]}
                onPress={() => setSelectedFeedback(option.key)}
              >
                <View
                  style={[
                    styles.feedbackIconContainer,
                    isSelected && styles.feedbackIconContainerSelected
                  ]}
                >
                  <Ionicons
                    name={option.icon as any}
                    size={24}
                    color={isSelected ? brandColors.primary : colors.text.tertiary}
                  />
                </View>
                <Text style={[styles.feedbackLabel, isSelected && styles.feedbackLabelSelected]}>
                  {t(option.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Finish button */}
      <View style={styles.buttonContainer}>
        <Pressable style={styles.finishButton} onPress={handleFinish}>
          <Text style={styles.finishButtonText}>{t("completion.summary.finish")}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  contentContainer: {
    flexGrow: 1
  },
  headerSection: {
    backgroundColor: colors.bg.secondary,
    paddingBottom: toRN(tokens.spacing[6]),
    borderBottomLeftRadius: toRN(tokens.borderRadius["3xl"]),
    borderBottomRightRadius: toRN(tokens.borderRadius["3xl"])
  },
  headerContent: {
    paddingHorizontal: toRN(tokens.spacing[5])
  },
  shareButton: {
    position: "absolute" as const,
    right: toRN(tokens.spacing[4]),
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
    backgroundColor: colors.bg.tertiary,
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.full)
  },
  shareButtonText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    letterSpacing: 1
  },
  titleContainer: {
    marginBottom: toRN(tokens.spacing[4])
  },
  mainTitle: {
    fontSize: toRN(tokens.typography.fontSize["4xl"]),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
    lineHeight: toRN(tokens.typography.fontSize["4xl"] * 1.1)
  },
  practiceBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
    marginTop: toRN(tokens.spacing[2]),
    backgroundColor: brand.primary + "20",
    alignSelf: "flex-start" as const,
    paddingVertical: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[2]),
    borderRadius: toRN(tokens.borderRadius.md)
  },
  practiceBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: brand.primary
  },
  dayNumber: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: colors.text.primary
  },
  statsRow: {
    flexDirection: "row" as const,
    justifyContent: "space-around" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[6]),
    paddingHorizontal: toRN(tokens.spacing[4])
  },
  statItem: {
    flex: 1,
    alignItems: "center" as const
  },
  statValue: {
    fontSize: toRN(tokens.typography.fontSize["3xl"]),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary
  },
  statLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[1])
  },
  statDivider: {
    width: 1,
    height: toRN(40),
    backgroundColor: colors.border.subtle
  },
  completionBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[2]),
    marginHorizontal: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[3]),
    backgroundColor: "#10B981" + "15",
    borderRadius: toRN(tokens.borderRadius.lg)
  },
  completionBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: "#10B981"
  },
  skippedInfo: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[1]),
    marginBottom: toRN(tokens.spacing[4])
  },
  skippedText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary
  },
  feedbackSection: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginTop: toRN(tokens.spacing[2])
  },
  feedbackTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[4])
  },
  feedbackOptions: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    gap: toRN(tokens.spacing[3])
  },
  feedbackOption: {
    flex: 1,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2])
  },
  feedbackOptionSelected: {},
  feedbackIconContainer: {
    width: toRN(64),
    height: toRN(64),
    borderRadius: toRN(32),
    backgroundColor: colors.bg.secondary,
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  feedbackIconContainerSelected: {
    backgroundColor: brand.primary + "20",
    borderWidth: 2,
    borderColor: brand.primary
  },
  feedbackLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary
  },
  feedbackLabelSelected: {
    color: colors.text.primary,
    fontFamily: fontFamily.semiBold
  },
  buttonContainer: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginTop: "auto" as const,
    paddingTop: toRN(tokens.spacing[6])
  },
  finishButton: {
    width: "100%",
    paddingVertical: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.xl),
    backgroundColor: brand.primary,
    alignItems: "center" as const
  },
  finishButtonText: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: "#FFFFFF",
    letterSpacing: 1
  }
});
