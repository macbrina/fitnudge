import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Speech from "expo-speech";
import { useStyles } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { Ionicons } from "@expo/vector-icons";

interface ReadyCountdownProps {
  timeRemaining: number;
  exerciseNumber: number;
  totalExercises: number;
  exerciseName: string;
  onSkip: () => void;
  onClose: () => void;
  onHelp?: () => void;
  coachVoiceEnabled?: boolean;
}

/**
 * Ready Countdown Overlay
 *
 * Shows when user first enters workout (from Start/Continue).
 * Simple countdown (e.g., 15, 14, 13...) with "Ready to Go" message.
 * When done, the separate ExerciseCountdown (3-2-1) takes over.
 */
export function ReadyCountdown({
  timeRemaining,
  exerciseNumber,
  totalExercises,
  exerciseName,
  onSkip,
  onClose,
  onHelp,
  coachVoiceEnabled = true,
}: ReadyCountdownProps) {
  const insets = useSafeAreaInsets();
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();

  // Animation refs
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation on each second
  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.8,
          duration: 100,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [timeRemaining]);

  // Speak "Ready to go" and exercise name on mount
  useEffect(() => {
    if (coachVoiceEnabled) {
      Speech.speak(`Ready to go. ${exerciseName}`, {
        rate: 0.9,
        pitch: 1.0,
      });
    }

    return () => {
      // Stop any ongoing speech when component unmounts
      Speech.stop();
    };
  }, []);

  return (
    <View style={styles.fullScreenOverlay}>
      <StatusBar barStyle="light-content" />

      {/* Semi-transparent background overlay */}
      <View style={styles.overlay} />

      {/* Header */}
      <View style={[styles.header, { marginTop: insets.top + toRN(8) }]}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Main content - centered */}
      <View style={styles.content}>
        {/* Ready label */}
        <Text style={styles.readyLabel}>{t("workout.ready_to_go")}</Text>

        {/* Large countdown number */}
        <Animated.Text
          style={[
            styles.countdownNumber,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          {timeRemaining}
        </Animated.Text>

        {/* Exercise info */}
        <Text style={styles.exerciseLabel}>
          {t("workout.exercise_count", {
            current: exerciseNumber,
            total: totalExercises,
          })}
        </Text>

        {/* Exercise name with help icon */}
        <View style={styles.exerciseNameRow}>
          <Text style={styles.exerciseName}>{exerciseName}</Text>
          {onHelp && (
            <TouchableOpacity onPress={onHelp} style={styles.helpButton}>
              <Ionicons name="help-circle-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Start button */}
      <TouchableOpacity
        style={[styles.startButton, { marginBottom: insets.bottom + toRN(32) }]}
        onPress={onSkip}
      >
        <Text style={styles.startButtonText}>{t("workout.start_now")}</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  // Full screen absolute overlay
  fullScreenOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },

  // Semi-transparent background overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(30, 30, 30, 0.85)",
  },

  // Header
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    zIndex: 10,
  },
  closeButton: {
    width: toRN(40),
    height: toRN(40),
    borderRadius: toRN(20),
    backgroundColor: "rgba(60, 60, 60, 0.8)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },

  // Main content - centered
  content: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    zIndex: 5,
  },
  readyLabel: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.groteskBold,
    color: "#FFFFFF",
    letterSpacing: 3,
    marginBottom: toRN(tokens.spacing[2]),
    textTransform: "uppercase" as const,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  countdownNumber: {
    fontSize: toRN(120),
    fontFamily: fontFamily.groteskBold,
    color: "#FFFFFF",
    lineHeight: toRN(130),
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  exerciseLabel: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: "rgba(255,255,255,0.85)",
    marginTop: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[2]),
  },
  exerciseNameRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
  },
  exerciseName: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.groteskBold,
    color: "#FFFFFF",
    textTransform: "capitalize" as const,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  helpButton: {
    padding: toRN(tokens.spacing[1]),
  },

  // Start button
  startButton: {
    backgroundColor: "#FFFFFF",
    paddingVertical: toRN(tokens.spacing[4]),
    paddingHorizontal: toRN(tokens.spacing[10]),
    borderRadius: toRN(tokens.borderRadius.full),
    marginHorizontal: toRN(tokens.spacing[8]),
    alignItems: "center" as const,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 10,
  },
  startButtonText: {
    color: "#1a1a1a",
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
  },
});
