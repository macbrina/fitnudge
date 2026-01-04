import React from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { Ionicons } from "@expo/vector-icons";
import Button from "@/components/ui/Button";
import type { QuitReason } from "@/types/workout";

interface QuitFeedbackProps {
  visible: boolean;
  exercisesCompleted: number;
  totalExercises: number;
  timeSpent: string;
  onResume: () => void;
  onSubmitFeedback: (reason: QuitReason) => void;
  onQuitWithoutFeedback: () => void;
}

/**
 * Quit Feedback Overlay (IMG_9570)
 *
 * Shows feedback options when user decides to quit.
 * Renders as a full-screen overlay on top of the workout screen.
 * Helps improve workout recommendations.
 */
export function QuitFeedback({
  visible,
  exercisesCompleted,
  totalExercises,
  timeSpent,
  onResume,
  onSubmitFeedback,
  onQuitWithoutFeedback
}: QuitFeedbackProps) {
  const insets = useSafeAreaInsets();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { t } = useTranslation();

  if (!visible) return null;

  const feedbackOptions: { reason: QuitReason; label: string }[] = [
    {
      reason: "dont_know_how",
      label: t("workout.feedback.dont_know_how")
    },
    {
      reason: "too_easy",
      label: t("workout.feedback.too_easy")
    },
    {
      reason: "too_hard",
      label: t("workout.feedback.too_hard")
    },
    {
      reason: "just_looking",
      label: t("workout.feedback.just_looking")
    }
  ];

  // Fire and forget - submits feedback and exits immediately
  const handleOptionPress = (reason: QuitReason) => {
    onSubmitFeedback(reason);
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      {/* Solid background */}
      <View style={styles.background} />

      {/* Header with resume button - at top */}
      <View style={[styles.header, { paddingTop: insets.top + toRN(tokens.spacing[2]) }]}>
        <TouchableOpacity style={styles.resumeButton} onPress={onResume}>
          <Ionicons name="chevron-back" size={20} color={colors.text.primary} />
          <Text style={styles.resumeText}>{t("workout.resume")}</Text>
        </TouchableOpacity>
      </View>

      {/* Content pushed to bottom */}
      <View style={styles.bottomContainer}>
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={[
            styles.contentContainer,
            { paddingBottom: insets.bottom + toRN(tokens.spacing[6]) }
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Heading */}
          <Text style={styles.heading}>{t("workout.why_give_up")}</Text>
          <Text style={styles.subheading}>{t("workout.feedback_helps")}</Text>

          {/* Feedback options */}
          <View style={styles.optionsContainer}>
            {feedbackOptions.map((option) => (
              <Button
                key={option.reason}
                title={option.label}
                textStyle={{ fontFamily: fontFamily.bold }}
                onPress={() => handleOptionPress(option.reason)}
                variant="secondary"
                size="md"
                fullWidth
              />
            ))}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Quit without feedback */}
          <Button
            title={t("workout.quit")}
            textStyle={{ fontFamily: fontFamily.bold }}
            onPress={onQuitWithoutFeedback}
            variant="secondary"
            size="md"
            fullWidth
          />
        </ScrollView>
      </View>
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  overlay: {
    zIndex: 100
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg.canvas
  },
  container: {
    flex: 1
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[3])
  },
  resumeButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1])
  },
  resumeText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  bottomContainer: {
    flex: 1,
    justifyContent: "flex-end" as const
  },
  scrollContent: {
    flexGrow: 0
  },
  contentContainer: {
    paddingHorizontal: toRN(tokens.spacing[5]),
    paddingTop: toRN(tokens.spacing[6])
  },
  heading: {
    fontSize: toRN(tokens.typography.fontSize["3xl"]),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[3])
  },
  subheading: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.base) * 1.5,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[6]),
    paddingHorizontal: toRN(tokens.spacing[4])
  },
  optionsContainer: {
    gap: toRN(tokens.spacing[3])
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: toRN(tokens.spacing[5]),
    marginHorizontal: toRN(tokens.spacing[4])
  }
});
