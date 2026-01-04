import React, { useState, useEffect, useMemo } from "react";
import {
  Modal as RNModal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
  Animated,
  Dimensions,
  Easing,
  StatusBar,
  KeyboardAvoidingView
} from "react-native";
import { useTranslation } from "@/lib/i18n";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { useStyles } from "@/themes/makeStyles";
import { tokens } from "@/themes/tokens";
import { useTheme } from "@/themes";
import { useEditChallenge } from "@/hooks/api/useChallenges";
import Button from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { DatePicker } from "@/components/ui/DatePicker";
import { ReminderTimesPicker } from "@/components/ui/ReminderTimesPicker";
import { useAlertModal, AlertOverlay } from "@/contexts/AlertModalContext";
import { Challenge } from "@/services/api/challenges";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "@/components/ui/Card";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface EditChallengeFormProps {
  visible: boolean;
  challenge: Challenge;
  onSuccess?: () => void;
  onClose: () => void;
}

/**
 * EditChallengeForm - Full-screen modal for editing challenges
 *
 * Only available to the CREATOR when challenge status === 'upcoming'
 *
 * Allowed edits:
 * - title, description: Safe to change (user is warned plan was based on original)
 * - join_deadline: EXTEND only (>= original, >= now, < start_date)
 * - max_participants: INCREASE only (>= current participants_count)
 * - reminder_times: Just notification preferences
 */
export function EditChallengeForm({
  visible,
  challenge,
  onSuccess,
  onClose
}: EditChallengeFormProps) {
  // Form state - initialize from challenge
  const [title, setTitle] = useState(challenge.title || "");
  const [description, setDescription] = useState(challenge.description || "");
  const [joinDeadline, setJoinDeadline] = useState<Date | null>(() => {
    if (challenge.join_deadline) {
      return new Date(challenge.join_deadline);
    }
    return null;
  });
  const [maxParticipants, setMaxParticipants] = useState<string>(
    challenge.max_participants?.toString() || ""
  );
  const [reminderTimes, setReminderTimes] = useState<string[]>(challenge.reminder_times || []);

  // Original values for validation
  const originalJoinDeadline = challenge.join_deadline ? new Date(challenge.join_deadline) : null;
  const originalMaxParticipants = challenge.max_participants;
  const startDate = challenge.start_date ? new Date(challenge.start_date) : null;
  const currentParticipantsCount = challenge.participants_count || 1;

  // Validation errors
  const [titleError, setTitleError] = useState<string | null>(null);
  const [maxParticipantsError, setMaxParticipantsError] = useState<string | null>(null);
  const [joinDeadlineError, setJoinDeadlineError] = useState<string | null>(null);

  // Hooks
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { showAlert } = useAlertModal();
  const editChallenge = useEditChallenge();
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get("window").height;

  // Animation values
  const translateY = useMemo(() => new Animated.Value(screenHeight), []);
  const [internalVisible, setInternalVisible] = useState(visible);

  // Handle modal visibility animation
  useEffect(() => {
    if (visible) {
      setInternalVisible(true);
      // Reset form state when opening
      setTitle(challenge.title || "");
      setDescription(challenge.description || "");
      setJoinDeadline(challenge.join_deadline ? new Date(challenge.join_deadline) : null);
      setMaxParticipants(challenge.max_participants?.toString() || "");
      setReminderTimes(challenge.reminder_times || []);
      setTitleError(null);
      setMaxParticipantsError(null);
      setJoinDeadlineError(null);

      Animated.spring(translateY, {
        toValue: 0,
        damping: 20,
        mass: 1,
        stiffness: 120,
        useNativeDriver: true
      }).start();
    } else if (internalVisible) {
      Animated.timing(translateY, {
        toValue: screenHeight,
        duration: 300,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true
      }).start(() => {
        setInternalVisible(false);
      });
    }
  }, [visible, translateY, screenHeight, internalVisible, challenge]);

  // Clear errors when values change
  useEffect(() => {
    if (titleError) setTitleError(null);
  }, [title]);

  useEffect(() => {
    if (maxParticipantsError) setMaxParticipantsError(null);
  }, [maxParticipants]);

  useEffect(() => {
    if (joinDeadlineError) setJoinDeadlineError(null);
  }, [joinDeadline]);

  // Validate form
  const validateForm = (): boolean => {
    let isValid = true;

    // Title validation
    if (!title.trim() || title.trim().length < 3) {
      setTitleError(t("challenges.edit.title_too_short") || "Title must be at least 3 characters");
      isValid = false;
    } else if (title.trim().length > 100) {
      setTitleError(t("challenges.edit.title_too_long") || "Title must be 100 characters or less");
      isValid = false;
    }

    // Max participants validation (increase only)
    if (maxParticipants) {
      const maxVal = parseInt(maxParticipants, 10);
      if (isNaN(maxVal) || maxVal < 2) {
        setMaxParticipantsError(
          t("challenges.edit.max_participants_min") || "Must be at least 2 participants"
        );
        isValid = false;
      } else if (maxVal < currentParticipantsCount) {
        setMaxParticipantsError(
          t("challenges.edit.max_below_current", { count: currentParticipantsCount }) ||
            `Cannot be less than current participants (${currentParticipantsCount})`
        );
        isValid = false;
      } else if (originalMaxParticipants && maxVal < originalMaxParticipants) {
        setMaxParticipantsError(
          t("challenges.edit.max_decrease_not_allowed", { original: originalMaxParticipants }) ||
            `Can only increase (original: ${originalMaxParticipants})`
        );
        isValid = false;
      }
    }

    // Join deadline validation (extend only)
    if (joinDeadline) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (joinDeadline < today) {
        setJoinDeadlineError(
          t("challenges.edit.deadline_past") || "Deadline cannot be in the past"
        );
        isValid = false;
      } else if (originalJoinDeadline && joinDeadline < originalJoinDeadline) {
        setJoinDeadlineError(
          t("challenges.edit.deadline_shorten_not_allowed") ||
            "Can only extend deadline, not shorten"
        );
        isValid = false;
      } else if (startDate && joinDeadline >= startDate) {
        setJoinDeadlineError(
          t("challenges.edit.deadline_after_start") || "Deadline must be before start date"
        );
        isValid = false;
      }
    }

    return isValid;
  };

  // Format date for display
  const formatDate = (date: Date | null): string => {
    if (!date) return "";
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) return;

    // Build edit payload - only include changed fields
    const edits: {
      title?: string;
      description?: string;
      join_deadline?: string;
      max_participants?: number;
      reminder_times?: string[];
    } = {};

    if (title.trim() !== challenge.title) {
      edits.title = title.trim();
    }
    if (description.trim() !== (challenge.description || "")) {
      edits.description = description.trim();
    }
    if (joinDeadline) {
      const newDeadlineStr = joinDeadline.toISOString().split("T")[0];
      const originalDeadlineStr = originalJoinDeadline
        ? originalJoinDeadline.toISOString().split("T")[0]
        : null;
      if (newDeadlineStr !== originalDeadlineStr) {
        edits.join_deadline = newDeadlineStr;
      }
    }
    if (maxParticipants) {
      const newMax = parseInt(maxParticipants, 10);
      if (newMax !== originalMaxParticipants) {
        edits.max_participants = newMax;
      }
    }
    if (JSON.stringify(reminderTimes) !== JSON.stringify(challenge.reminder_times || [])) {
      edits.reminder_times = reminderTimes;
    }

    // No changes
    if (Object.keys(edits).length === 0) {
      onClose();
      return;
    }

    try {
      await editChallenge.mutateAsync({ challengeId: challenge.id, edits });
      onSuccess?.();
      onClose();
    } catch (error: any) {
      // Don't await error alert - let user dismiss it while staying in modal
      showAlert({
        title: t("challenges.edit.error_title") || "Update Failed",
        message:
          error?.message || t("challenges.edit.error_message") || "Failed to update challenge.",
        variant: "error"
      });
    }
  };

  if (!internalVisible && !visible) {
    return null;
  }

  return (
    <RNModal
      visible={internalVisible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [{ translateY }]
            }
          ]}
        >
          <View
            style={[
              styles.contentContainer,
              {
                paddingTop: insets.top + toRN(tokens.spacing[4]),
                paddingBottom: insets.bottom + toRN(tokens.spacing[4])
              }
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>
                {t("challenges.edit_challenge") || "Edit Challenge"}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                accessibilityLabel={t("common.close")}
                accessibilityRole="button"
              >
                <Ionicons
                  name="close"
                  size={toRN(tokens.typography.fontSize["2xl"])}
                  color={colors.text.primary}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Warning Card */}
              <Card shadow="sm" style={styles.warningCard}>
                <View style={styles.warningContent}>
                  <Ionicons name="information-circle" size={24} color={brandColors.primary} />
                  <Text style={styles.warningText}>
                    {t("challenges.edit.plan_warning") ||
                      "Your plan was generated based on your original challenge. Editing the title or description won't regenerate the plan."}
                  </Text>
                </View>
              </Card>

              {/* Title Input */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>{t("challenges.form.title") || "Title"}</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder={t("challenges.form.title_placeholder") || "Enter challenge title"}
                  maxLength={100}
                  error={titleError || undefined}
                />
                {titleError && <Text style={styles.errorText}>{titleError}</Text>}
              </View>

              {/* Description Input */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>
                  {t("challenges.form.description") || "Description"}
                </Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder={
                    t("challenges.form.description_placeholder") ||
                    "Describe your challenge (optional)"
                  }
                  maxLength={500}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Join Deadline */}
              <DatePicker
                value={joinDeadline || new Date()}
                onChange={(date) => setJoinDeadline(date)}
                label={`${t("challenges.form.join_deadline") || "Join Deadline"} ${t("challenges.edit.extend_only") || "(Extend only)"}`}
                description={
                  originalJoinDeadline
                    ? `${t("challenges.edit.original") || "Original"}: ${formatDate(originalJoinDeadline)}`
                    : undefined
                }
                error={joinDeadlineError || undefined}
                minimumDate={originalJoinDeadline || new Date()}
                maximumDate={startDate ? new Date(startDate.getTime() - 86400000) : undefined}
              />

              {/* Max Participants */}
              <View style={styles.fieldContainer}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>
                    {t("challenges.form.max_participants") || "Max Participants"}
                  </Text>
                  <Text style={styles.labelHint}>
                    {t("challenges.edit.increase_only") || "(Increase only)"}
                  </Text>
                </View>
                <TextInput
                  value={maxParticipants}
                  onChangeText={setMaxParticipants}
                  placeholder={t("challenges.form.unlimited") || "No limit"}
                  keyboardType="numeric"
                  error={maxParticipantsError || undefined}
                />
                {maxParticipantsError && (
                  <Text style={styles.errorText}>{maxParticipantsError}</Text>
                )}
                {originalMaxParticipants && (
                  <Text style={styles.originalValue}>
                    {t("challenges.edit.original") || "Original"}: {originalMaxParticipants} |{" "}
                    {t("challenges.edit.current_participants") || "Current"}:{" "}
                    {currentParticipantsCount}
                  </Text>
                )}
              </View>

              {/* Reminder Times */}
              <ReminderTimesPicker
                value={reminderTimes}
                onChange={setReminderTimes}
                label={t("challenges.form.reminder_times") || "Reminders"}
                is24Hour={false}
              />

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <Button
                  title={t("common.cancel") || "Cancel"}
                  variant="outline"
                  onPress={onClose}
                  style={styles.cancelButton}
                />
                <Button
                  title={t("common.save") || "Save Changes"}
                  onPress={handleSubmit}
                  loading={editChallenge.isPending}
                  style={styles.saveButton}
                />
              </View>
            </ScrollView>

            {/* Alert Overlay for modals */}
            <AlertOverlay visible={visible} />
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  keyboardView: {
    flex: 1
  },
  modalContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg.canvas
  },
  contentContainer: {
    flex: 1,
    width: "100%"
  },
  header: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[2])
  },
  headerTitle: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: colors.text.primary
  },
  closeButton: {
    width: toRN(tokens.spacing[10]),
    height: toRN(tokens.spacing[10]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: colors.bg.muted,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    padding: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[8])
  },
  warningCard: {
    marginBottom: toRN(tokens.spacing[4]),
    backgroundColor: `${brand.primary}08`
  },
  warningContent: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: toRN(tokens.spacing[3]),
    padding: toRN(tokens.spacing[3])
  },
  warningText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.4
  },
  fieldContainer: {
    marginBottom: toRN(tokens.spacing[5])
  },
  label: {
    fontFamily: fontFamily.semiBold,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[2])
  },
  labelRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[2])
  },
  labelHint: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.xs),
    color: colors.text.tertiary
  },
  errorText: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.feedback.error,
    marginTop: toRN(tokens.spacing[1])
  },
  originalValue: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.xs),
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[1])
  },
  dateButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    padding: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.md),
    borderWidth: 1,
    borderColor: colors.border.muted,
    backgroundColor: colors.bg.card
  },
  dateButtonText: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.base),
    color: colors.text.primary
  },
  pickerOverlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end" as const,
    zIndex: 1000
  },
  pickerBackdrop: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)"
  },
  pickerSheetContainer: {
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: toRN(tokens.borderRadius["2xl"]),
    borderTopRightRadius: toRN(tokens.borderRadius["2xl"]),
    padding: toRN(tokens.spacing[6])
  },
  pickerHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    marginBottom: toRN(tokens.spacing[4])
  },
  pickerHeaderSpacer: {
    width: 32
  },
  pickerTitle: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    textAlign: "center" as const
  },
  pickerCloseButton: {
    width: 32,
    height: 32,
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  picker: {
    alignSelf: "center" as const
  },
  pickerDoneButton: {
    marginTop: toRN(tokens.spacing[4])
  },
  remindersContainer: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: toRN(tokens.spacing[2])
  },
  reminderChip: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: `${brand.primary}15`
  },
  reminderText: {
    fontFamily: fontFamily.medium,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: brand.primary
  },
  addReminderButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3])
  },
  addReminderText: {
    fontFamily: fontFamily.medium,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: brand.primary
  },
  actionButtons: {
    flexDirection: "row" as const,
    gap: toRN(tokens.spacing[3]),
    marginTop: toRN(tokens.spacing[4])
  },
  cancelButton: {
    flex: 1
  },
  saveButton: {
    flex: 1
  }
});
