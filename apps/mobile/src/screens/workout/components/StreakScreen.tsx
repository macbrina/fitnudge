import React, { useEffect, useRef } from "react";
import { View, Text, Animated, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@/lib/i18n";

interface StreakInfo {
  current_streak: number;
  longest_streak: number;
  milestone_target: number;
  days_until_milestone: number;
  workout_dates_this_week: string[];
}

interface StreakScreenProps {
  streak: StreakInfo;
  workoutNumberToday: number;
  onContinue: () => void;
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Ordinal suffix helper
const getOrdinal = (n: number): string => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export function StreakScreen({ streak, workoutNumberToday, onContinue }: StreakScreenProps) {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const flameAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(50)).current;

  // Get today's day index (0 = Sunday)
  const today = new Date();
  const todayIndex = today.getDay();

  useEffect(() => {
    Animated.sequence([
      // Fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      }),
      // Flame pop in
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 100,
        useNativeDriver: true
      }),
      // Card slide up
      Animated.spring(cardAnim, {
        toValue: 0,
        friction: 8,
        tension: 80,
        useNativeDriver: true
      })
    ]).start();

    // Flame flicker animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(flameAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        }),
        Animated.timing(flameAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true
        })
      ])
    ).start();
  }, []);

  // Flame color based on streak
  const getFlameColor = () => {
    if (streak.current_streak >= 30) return "#FF4500"; // Red-orange for 30+
    if (streak.current_streak >= 14) return "#FF6B00"; // Orange for 14+
    if (streak.current_streak >= 7) return "#FF8C00"; // Dark orange for 7+
    return "#FF9500"; // Default orange
  };

  const flameScale = flameAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05]
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Decorative elements */}
      <View style={styles.decorativeContainer}>
        {[...Array(8)].map((_, i) => (
          <Text
            key={i}
            style={[
              styles.decorativeChar,
              {
                top: `${10 + Math.random() * 30}%`,
                left: i < 4 ? `${-5 + Math.random() * 20}%` : undefined,
                right: i >= 4 ? `${-5 + Math.random() * 20}%` : undefined,
                opacity: 0.1,
                transform: [{ rotate: `${Math.random() * 30 - 15}deg` }]
              }
            ]}
          >
            {["✧", "✦", "★", "⚡", "♦", "◆", "✸", "✹"][i]}
          </Text>
        ))}
      </View>

      <View style={[styles.content, { paddingTop: insets.top + toRN(40) }]}>
        {/* Flame with streak number */}
        <Animated.View
          style={[
            styles.flameContainer,
            {
              transform: [{ scale: scaleAnim }, { scaleY: flameScale }]
            }
          ]}
        >
          <View style={[styles.flameGlow, { backgroundColor: getFlameColor() }]} />
          <Ionicons name="flame" size={140} color={getFlameColor()} />
          <View style={styles.streakNumberContainer}>
            <Text style={styles.streakNumber}>{streak.current_streak}</Text>
          </View>
        </Animated.View>

        {/* Message */}
        {workoutNumberToday > 1 ? (
          <View style={styles.messageContainer}>
            <Text style={styles.messageTitle}>{t("completion.streak.bravo")}</Text>
            <Text style={styles.messageSubtitle}>
              {t("completion.streak.your")}{" "}
              <Text style={[styles.highlight, { color: getFlameColor() }]}>
                {getOrdinal(workoutNumberToday).toUpperCase()}
              </Text>
            </Text>
            <Text style={styles.messageSubtitle}>{t("completion.streak.workout")}</Text>
            <Text style={styles.messageSubtitle}>{t("completion.streak.today")}</Text>
          </View>
        ) : (
          <View style={styles.messageContainer}>
            <Text style={styles.messageTitle}>{t("completion.streak.you_are_on_a")}</Text>
            <Text style={[styles.highlight, { color: getFlameColor() }]}>
              {t("completion.streak.day_count", {
                count: streak.current_streak
              })}
            </Text>
            <Text style={styles.messageTitle}>{t("completion.streak.streak")}</Text>
          </View>
        )}

        {/* Week progress card */}
        <Animated.View style={[styles.weekCard, { transform: [{ translateY: cardAnim }] }]}>
          <Text style={styles.milestoneText}>
            {t("completion.streak.first_milestone")}{" "}
            <Text style={styles.milestoneBold}>
              {t("completion.streak.days_count", {
                count: streak.milestone_target
              })}
            </Text>
          </Text>

          {/* Days of week */}
          <View style={styles.daysRow}>
            {DAYS_OF_WEEK.map((day, index) => {
              const isToday = index === todayIndex;
              const isCompleted = streak.workout_dates_this_week.includes(day);
              const isPast = index < todayIndex;

              return (
                <View key={day} style={styles.dayColumn}>
                  <Text
                    style={[
                      styles.dayLabel,
                      isToday && styles.dayLabelToday,
                      isCompleted && styles.dayLabelCompleted
                    ]}
                  >
                    {day}
                  </Text>
                  <View
                    style={[
                      styles.dayCircle,
                      isCompleted && styles.dayCircleCompleted,
                      !isCompleted && isPast && styles.dayCircleMissed,
                      !isCompleted && !isPast && styles.dayCircleFuture
                    ]}
                  >
                    {isCompleted && (
                      <>
                        <Ionicons
                          name="flame"
                          size={16}
                          color={getFlameColor()}
                          style={styles.dayFlame}
                        />
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      </>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Encouragement message */}
          <View style={styles.encouragementContainer}>
            <Text style={styles.encouragementText}>
              {streak.days_until_milestone > 0
                ? t("completion.streak.great_job", {
                    days: streak.days_until_milestone
                  })
                : t("completion.streak.milestone_hit")}
            </Text>
          </View>
        </Animated.View>
      </View>

      {/* Done button */}
      <View style={[styles.buttonContainer, { paddingBottom: insets.bottom + toRN(16) }]}>
        <Pressable style={styles.doneButton} onPress={onContinue}>
          <Text style={styles.doneButtonText}>{t("common.done")}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  decorativeContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden" as const
  },
  decorativeChar: {
    position: "absolute" as const,
    fontSize: toRN(40),
    color: colors.text.primary
  },
  content: {
    flex: 1,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[4])
  },
  flameContainer: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: toRN(tokens.spacing[4])
  },
  flameGlow: {
    position: "absolute" as const,
    width: toRN(120),
    height: toRN(120),
    borderRadius: toRN(60),
    opacity: 0.3
  },
  streakNumberContainer: {
    position: "absolute" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  streakNumber: {
    fontSize: toRN(48),
    fontFamily: fontFamily.groteskBold,
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4
  },
  messageContainer: {
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[8])
  },
  messageTitle: {
    fontSize: toRN(tokens.typography.fontSize["3xl"]),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
    textAlign: "center" as const
  },
  messageSubtitle: {
    fontSize: toRN(tokens.typography.fontSize["3xl"]),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
    textAlign: "center" as const
  },
  highlight: {
    fontSize: toRN(tokens.typography.fontSize["4xl"]),
    fontFamily: fontFamily.groteskBold
  },
  weekCard: {
    width: "100%",
    backgroundColor: colors.bg.secondary,
    borderRadius: toRN(tokens.borderRadius["2xl"]),
    padding: toRN(tokens.spacing[5])
  },
  milestoneText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[4])
  },
  milestoneBold: {
    fontFamily: fontFamily.bold,
    color: colors.text.primary
  },
  daysRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    marginBottom: toRN(tokens.spacing[4])
  },
  dayColumn: {
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2])
  },
  dayLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary
  },
  dayLabelToday: {
    color: brand.primary,
    fontFamily: fontFamily.bold
  },
  dayLabelCompleted: {
    color: "#FF9500",
    fontFamily: fontFamily.bold
  },
  dayCircle: {
    width: toRN(36),
    height: toRN(36),
    borderRadius: toRN(18),
    backgroundColor: colors.bg.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  dayCircleCompleted: {
    backgroundColor: "#FF9500"
  },
  dayCircleMissed: {
    backgroundColor: colors.bg.muted,
    opacity: 0.5
  },
  dayCircleFuture: {
    backgroundColor: colors.bg.muted,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderStyle: "dashed" as const
  },
  dayFlame: {
    position: "absolute" as const,
    top: -8
  },
  encouragementContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    borderStyle: "dashed" as const,
    paddingTop: toRN(tokens.spacing[4])
  },
  encouragementText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
    textAlign: "center" as const
  },
  buttonContainer: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingTop: toRN(tokens.spacing[4])
  },
  doneButton: {
    width: "100%",
    paddingVertical: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.xl),
    backgroundColor: brand.primary,
    alignItems: "center" as const
  },
  doneButtonText: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: "#FFFFFF"
  }
});
