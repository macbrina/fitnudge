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
import { useEditGoal } from "@/hooks/api/useGoals";
import Button from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { ReminderTimesPicker } from "@/components/ui/ReminderTimesPicker";
import { useAlertModal, AlertOverlay } from "@/contexts/AlertModalContext";
import { DAYS_OF_WEEK, validateTitle } from "@/utils/goalValidation";
import { Goal } from "@/services/api/goals";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "@/components/ui/Card";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface EditGoalFormProps {
  visible: boolean;
  goal: Goal;
  onSuccess?: () => void;
  onClose: () => void;
}

/**
 * EditGoalForm - Full-screen modal for editing existing goals
 *
 * Only allows editing fields that don't affect the AI-generated plan:
 * - title, description: Safe to change (user is warned plan was based on original)
 * - days_of_week: Can ADD days, but cannot REMOVE existing days
 * - reminder_times: Just notification preferences
 */
export function EditGoalForm({ visible, goal, onSuccess, onClose }: EditGoalFormProps) {
  // Form state - initialize from goal
  const [title, setTitle] = useState(goal.title || "");
  const [description, setDescription] = useState(goal.description || "");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(goal.days_of_week || []);
  const [reminderTimes, setReminderTimes] = useState<string[]>(goal.reminder_times || []);

  // Track original days to prevent removal
  const originalDays = new Set(goal.days_of_week || []);

  // Validation errors
  const [titleError, setTitleError] = useState<string | null>(null);

  // Hooks
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { showAlert } = useAlertModal();
  const editGoal = useEditGoal();
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
      setTitle(goal.title || "");
      setDescription(goal.description || "");
      setDaysOfWeek(goal.days_of_week || []);
      setReminderTimes(goal.reminder_times || []);
      setTitleError(null);

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
  }, [visible, translateY, screenHeight, internalVisible, goal]);

  // Clear title error when title changes
  useEffect(() => {
    if (titleError) setTitleError(null);
  }, [title]);

  // Validate form
  const validateForm = (): boolean => {
    const error = validateTitle(title);
    if (error) {
      setTitleError(error);
      return false;
    }
    return true;
  };

  // Toggle day of week (ADD only, cannot remove original days)
  const toggleDayOfWeek = (day: number) => {
    // If this is an original day, don't allow removal
    if (originalDays.has(day) && daysOfWeek.includes(day)) {
      showAlert({
        title: t("goals.edit.cannot_remove_day_title") || "Cannot Remove Day",
        message:
          t("goals.edit.cannot_remove_day_message") ||
          "Days with planned tasks cannot be removed. You can only add new days.",
        variant: "warning"
      });
      return;
    }

    if (daysOfWeek.includes(day)) {
      // Remove newly added day
      setDaysOfWeek(daysOfWeek.filter((d) => d !== day));
    } else {
      // Add new day
      setDaysOfWeek([...daysOfWeek, day].sort((a, b) => a - b));
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) return;

    // Build edit payload - only include changed fields
    const edits: {
      title?: string;
      description?: string;
      days_of_week?: number[];
      reminder_times?: string[];
    } = {};

    if (title.trim() !== goal.title) {
      edits.title = title.trim();
    }
    if (description.trim() !== (goal.description || "")) {
      edits.description = description.trim();
    }
    if (JSON.stringify(daysOfWeek) !== JSON.stringify(goal.days_of_week || [])) {
      edits.days_of_week = daysOfWeek;
    }
    if (JSON.stringify(reminderTimes) !== JSON.stringify(goal.reminder_times || [])) {
      edits.reminder_times = reminderTimes;
    }

    // No changes
    if (Object.keys(edits).length === 0) {
      onClose();
      return;
    }

    try {
      await editGoal.mutateAsync({ goalId: goal.id, edits });
      onSuccess?.();
      onClose();
    } catch (error: any) {
      // Don't await error alert - let user dismiss it while staying in modal
      showAlert({
        title: t("goals.edit.error_title") || "Update Failed",
        message: error?.message || t("goals.edit.error_message") || "Failed to update goal.",
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
              <Text style={styles.headerTitle}>{t("goals.edit_goal") || "Edit Goal"}</Text>
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
                    {t("goals.edit.plan_warning") ||
                      "Your plan was generated based on your original goal. Editing the title or description won't regenerate the plan."}
                  </Text>
                </View>
              </Card>

              {/* Title Input */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>{t("goals.create.form.title") || "Title"}</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder={t("goals.create.form.title_placeholder") || "Enter goal title"}
                  maxLength={100}
                  error={titleError || undefined}
                />
                {titleError && <Text style={styles.errorText}>{titleError}</Text>}
              </View>

              {/* Description Input */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>
                  {t("goals.create.form.description") || "Description"}
                </Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder={
                    t("goals.create.form.description_placeholder") ||
                    "Describe your goal (optional)"
                  }
                  maxLength={500}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Days of Week (weekly goals only) */}
              {goal.frequency === "weekly" && (
                <View style={styles.fieldContainer}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>
                      {t("goals.create.form.days_of_week") || "Days of Week"}
                    </Text>
                    <Text style={styles.labelHint}>
                      {t("goals.edit.add_days_only") || "(You can only add new days)"}
                    </Text>
                  </View>
                  <View style={styles.daysContainer}>
                    {DAYS_OF_WEEK.map((day) => {
                      const isSelected = daysOfWeek.includes(day.value);
                      const isOriginal = originalDays.has(day.value);
                      return (
                        <TouchableOpacity
                          key={day.value}
                          style={[
                            styles.dayButton,
                            isSelected && styles.dayButtonSelected,
                            isOriginal && styles.dayButtonLocked
                          ]}
                          onPress={() => toggleDayOfWeek(day.value)}
                          activeOpacity={isOriginal ? 0.9 : 0.7}
                        >
                          <Text
                            style={[
                              styles.dayButtonText,
                              isSelected && styles.dayButtonTextSelected
                            ]}
                          >
                            {day.label}
                          </Text>
                          {isOriginal && isSelected && (
                            <Ionicons
                              name="lock-closed"
                              size={10}
                              color={colors.text.onPrimary}
                              style={styles.lockIcon}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Reminder Times */}
              <ReminderTimesPicker
                value={reminderTimes}
                onChange={setReminderTimes}
                label={t("goals.create.form.reminder_times") || "Reminders"}
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
                  loading={editGoal.isPending}
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
  daysContainer: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: toRN(tokens.spacing[2])
  },
  dayButton: {
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.md),
    borderWidth: 1,
    borderColor: colors.border.muted,
    backgroundColor: colors.bg.card,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1])
  },
  dayButtonSelected: {
    backgroundColor: brand.primary,
    borderColor: brand.primary
  },
  dayButtonLocked: {
    opacity: 0.9
  },
  dayButtonText: {
    fontFamily: fontFamily.medium,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.secondary
  },
  dayButtonTextSelected: {
    color: brand.onPrimary
  },
  lockIcon: {
    marginLeft: toRN(tokens.spacing[1])
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
  pickerContainer: {
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
  pickerAddButton: {
    marginTop: toRN(tokens.spacing[4])
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
