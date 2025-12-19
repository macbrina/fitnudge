import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";

interface ExitConfirmationModalProps {
  visible: boolean;
  completionPercentage: number;
  exercisesRemaining: number;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

/**
 * Exit Confirmation Modal (IMG_9569)
 *
 * Triggered when user taps Close (X) or Back button during workout.
 * Shows motivational message with progress and options to resume, restart, or quit.
 */
export function ExitConfirmationModal({
  visible,
  completionPercentage,
  exercisesRemaining,
  onResume,
  onRestart,
  onQuit,
}: ExitConfirmationModalProps) {
  const insets = useSafeAreaInsets();
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();

  if (!visible) return null;

  return (
    <View style={styles.fullScreenOverlay}>
      <StatusBar barStyle="dark-content" />

      {/* Semi-transparent overlay that dims the workout behind */}
      <View style={styles.dimOverlay} />

      {/* Bottom content panel */}
      <View
        style={[
          styles.contentPanel,
          { paddingBottom: insets.bottom + toRN(tokens.spacing[6]) },
        ]}
      >
        {/* Motivational heading */}
        <Text style={styles.heading}>{t("workout.hold_on")}</Text>
        <Text style={styles.subheading}>{t("workout.you_can_do_it")}</Text>

        {/* Progress info */}
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            {t("workout.you_have_finished")}{" "}
            <Text style={styles.progressHighlight}>
              {Math.round(completionPercentage)}%
            </Text>
          </Text>
          <Text style={styles.remainingText}>
            Only{" "}
            <Text style={styles.remainingHighlight}>
              {exercisesRemaining}{" "}
              {exercisesRemaining === 1 ? "round" : "rounds"}
            </Text>{" "}
            left
          </Text>
        </View>

        {/* Action buttons */}
        <View style={styles.buttonContainer}>
          {/* Resume button - primary */}
          <TouchableOpacity style={styles.resumeButton} onPress={onResume}>
            <Text style={styles.resumeButtonText}>{t("workout.resume")}</Text>
          </TouchableOpacity>

          {/* Restart button - secondary */}
          <TouchableOpacity style={styles.restartButton} onPress={onRestart}>
            <Text style={styles.restartButtonText}>
              {t("workout.restart_exercise")}
            </Text>
          </TouchableOpacity>

          {/* Quit link */}
          <TouchableOpacity style={styles.quitButton} onPress={onQuit}>
            <Text style={styles.quitButtonText}>{t("workout.quit")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  // Full screen absolute overlay
  fullScreenOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
  },

  // Semi-transparent dim layer
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(245, 245, 245, 0.85)",
  },

  // Bottom content panel
  contentPanel: {
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bg.canvas,
    borderTopLeftRadius: toRN(tokens.borderRadius["2xl"]),
    borderTopRightRadius: toRN(tokens.borderRadius["2xl"]),
    paddingTop: toRN(tokens.spacing[8]),
    paddingHorizontal: toRN(tokens.spacing[6]),
    alignItems: "center" as const,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },

  heading: {
    fontSize: toRN(tokens.typography.fontSize["3xl"]),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
    textAlign: "center" as const,
  },
  subheading: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[4]),
  },

  progressContainer: {
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[6]),
  },
  progressText: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.regular,
    color: colors.text.primary,
    textAlign: "center" as const,
  },
  progressHighlight: {
    fontFamily: fontFamily.bold,
    color: brand.primary,
  },
  remainingText: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.regular,
    color: colors.text.primary,
    textAlign: "center" as const,
  },
  remainingHighlight: {
    fontFamily: fontFamily.bold,
    color: brand.primary,
  },

  buttonContainer: {
    width: "100%",
    gap: toRN(tokens.spacing[3]),
  },
  resumeButton: {
    backgroundColor: brand.primary,
    paddingVertical: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.full),
    alignItems: "center" as const,
  },
  resumeButtonText: {
    color: "#FFFFFF",
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
  },
  restartButton: {
    backgroundColor: colors.bg.muted,
    paddingVertical: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.full),
    alignItems: "center" as const,
  },
  restartButtonText: {
    color: colors.text.primary,
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
  },
  quitButton: {
    paddingVertical: toRN(tokens.spacing[3]),
    alignItems: "center" as const,
  },
  quitButtonText: {
    color: colors.text.tertiary,
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
  },
});
