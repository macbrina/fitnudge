import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTranslation } from "@/lib/i18n";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { useStyles } from "@/themes/makeStyles";
import { tokens } from "@/themes/tokens";
import { useTheme } from "@/themes";
import { logger } from "@/services/logger";
import { useCreateGoal, useActiveGoals } from "@/hooks/api/useGoals";
import { router } from "expo-router";
import { usePricing } from "@/hooks/usePricing";
import { useAuthStore } from "@/stores/authStore";
import Button from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import Modal from "@/components/ui/Modal";
import { SuggestedGoal } from "@/services/api/onboarding";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { ROUTES } from "@/lib";
import {
  VALID_CATEGORIES,
  VALID_FREQUENCIES,
  CATEGORIES,
  FREQUENCIES,
  DAYS_OF_WEEK,
  validateTitle,
  validateCategory,
  validateFrequency,
  validateDaysOfWeek,
  validateReminderTimes,
} from "@/utils/goalValidation";

export interface CustomGoalFormProps {
  initialData?: SuggestedGoal | null;
}

/**
 * CustomGoalForm - Simplified form for creating ongoing habits
 *
 * Goals are now only for habits (ongoing, no end date).
 * For time-bound challenges, users should create a Challenge instead.
 */
// Sanitize category - fix common AI mistakes
// "hydration" is a tracking_type, not a category - it should be under "nutrition"
const sanitizeCategory = (
  cat: string | undefined,
  title?: string,
  desc?: string,
): string => {
  const categoryLower = (cat || "").toLowerCase();
  const combinedText = `${title || ""} ${desc || ""}`.toLowerCase();
  const hydrationKeywords = [
    "water",
    "hydration",
    "hydrate",
    "drink",
    "glasses",
    "ml",
    "fluid",
    "h2o",
  ];
  const isHydrationGoal = hydrationKeywords.some((kw) =>
    combinedText.includes(kw),
  );

  // If category is "hydration" or it's clearly a hydration goal with invalid category, use "nutrition"
  if (
    categoryLower === "hydration" ||
    (isHydrationGoal &&
      !(VALID_CATEGORIES as readonly string[]).includes(categoryLower))
  ) {
    return "nutrition";
  }

  // If category is valid, use it
  if ((VALID_CATEGORIES as readonly string[]).includes(categoryLower)) {
    return categoryLower;
  }

  // Default to fitness
  return "fitness";
};

export function CustomGoalForm({ initialData }: CustomGoalFormProps) {
  // Form state - initialize from initialData if available
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(
    initialData?.description || "",
  );
  const [category, setCategory] = useState(() =>
    initialData?.category
      ? sanitizeCategory(
          initialData.category,
          initialData.title,
          initialData.description,
        )
      : "fitness",
  );
  const [frequency, setFrequency] = useState(initialData?.frequency || "daily");
  const [targetDays, setTargetDays] = useState(
    initialData?.target_days ? String(initialData.target_days) : "7",
  );
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    initialData?.days_of_week || [],
  );
  const [reminderTimes, setReminderTimes] = useState<string[]>(
    initialData?.reminder_times || [],
  );
  const [isCreating, setIsCreating] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedTime, setSelectedTime] = useState<Date>(new Date());

  // Validation errors
  const [titleError, setTitleError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [frequencyError, setFrequencyError] = useState<string | null>(null);
  const [reminderTimesError, setReminderTimesError] = useState<string | null>(
    null,
  );
  const [daysOfWeekError, setDaysOfWeekError] = useState<string | null>(null);

  const { t } = useTranslation();
  const styles = useStyles(makeCustomGoalFormStyles);
  const { colors } = useTheme();
  const createGoal = useCreateGoal();
  const { data: activeGoalsResponse } = useActiveGoals();
  const { showAlert } = useAlertModal();
  const { getGoalLimit } = usePricing();
  const { user } = useAuthStore();

  // Pre-fill form when initialData changes
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || "");
      setDescription(initialData.description || "");
      setCategory(
        sanitizeCategory(
          initialData.category,
          initialData.title,
          initialData.description,
        ),
      );
      const freq = initialData.frequency || "daily";
      setFrequency(freq);

      // Handle days_of_week for weekly goals
      const daysArray = Array.isArray(initialData.days_of_week)
        ? [...initialData.days_of_week]
        : [];
      if (freq === "weekly" && daysArray.length > 0) {
        setDaysOfWeek(daysArray);
        setTargetDays(String(daysArray.length));
      } else if (freq === "weekly") {
        // Set default for weekly
        const defaultDays = [1, 3, 5];
        setDaysOfWeek(defaultDays);
        setTargetDays(String(defaultDays.length));
      } else {
        setDaysOfWeek([]);
        setTargetDays("7");
      }

      // Set reminder times
      const reminderTimesArray = Array.isArray(initialData.reminder_times)
        ? [...initialData.reminder_times]
        : [];
      setReminderTimes(reminderTimesArray);

      // Clear errors when pre-filling
      setTitleError(null);
      setCategoryError(null);
      setFrequencyError(null);
      setReminderTimesError(null);
      setDaysOfWeekError(null);
    } else {
      // Clear form when initialData becomes null
      setTitle("");
      setDescription("");
      setCategory("fitness");
      setFrequency("daily");
      setTargetDays("7");
      setDaysOfWeek([]);
      setReminderTimes([]);
    }
  }, [initialData]);

  // Validate all fields
  const validateAllFields = (): boolean => {
    let isValid = true;

    // Validate title
    const titleErr = validateTitle(title);
    setTitleError(titleErr);
    if (titleErr) isValid = false;

    // Validate category
    const categoryErr = validateCategory(category);
    setCategoryError(categoryErr);
    if (categoryErr) isValid = false;

    // Validate frequency
    const frequencyErr = validateFrequency(frequency);
    setFrequencyError(frequencyErr);
    if (frequencyErr) isValid = false;

    // Validate days of week for weekly goals
    const daysErr = validateDaysOfWeek(daysOfWeek, frequency);
    setDaysOfWeekError(daysErr);
    if (daysErr) isValid = false;

    // Validate reminder times format
    const reminderTimesErr = validateReminderTimes(reminderTimes);
    setReminderTimesError(reminderTimesErr);
    if (reminderTimesErr) isValid = false;

    return isValid;
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (titleError) {
      const error = validateTitle(value);
      setTitleError(error);
    }
  };

  const formatTime = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const handleTimePickerChange = async (event: any, date?: Date) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
      if (event.type === "set" && date) {
        const timeString = formatTime(date);
        if (reminderTimes.includes(timeString)) {
          await showAlert({
            title: t("common.error"),
            message:
              t("goals.create.form.add_time_error_duplicate") ||
              "This time is already added",
            variant: "error",
            confirmLabel: t("common.ok"),
          });
          return;
        }
        setReminderTimes((prev) => {
          const newTimes = [...prev, timeString].sort();
          const error = validateReminderTimes(newTimes);
          setReminderTimesError(error);
          return newTimes;
        });
      }
    } else if (Platform.OS === "ios" && date) {
      setSelectedTime(date);
    }
  };

  const handleAddReminderTime = () => {
    setShowTimePicker(true);
  };

  const handleRemoveReminderTime = (time: string) => {
    setReminderTimes((prev) => {
      const newTimes = prev.filter((t) => t !== time);
      const error = validateReminderTimes(newTimes);
      setReminderTimesError(error);
      return newTimes;
    });
  };

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    setCategoryError(null);
  };

  const handleFrequencyChange = (value: string) => {
    setFrequency(value);
    setFrequencyError(null);

    if (value === "daily") {
      setDaysOfWeek([]);
      setTargetDays("7");
      setDaysOfWeekError(null);
    } else if (value === "weekly") {
      if (daysOfWeek.length === 0) {
        const defaultDays = [1, 3, 5]; // Mon, Wed, Fri
        setDaysOfWeek(defaultDays);
        setTargetDays(String(defaultDays.length));
      } else {
        setTargetDays(String(daysOfWeek.length));
      }
      setDaysOfWeekError(null);
    }
  };

  const toggleDaySelection = (dayValue: number) => {
    setDaysOfWeek((prev) => {
      const isSelected = prev.includes(dayValue);
      let newDays: number[];

      if (isSelected) {
        newDays = prev.filter((d) => d !== dayValue);
      } else {
        newDays = [...prev, dayValue].sort((a, b) => a - b);
      }

      // Auto-update target days based on selection
      if (frequency === "weekly") {
        setTargetDays(String(newDays.length));
      }

      // Validate after change
      const error = validateDaysOfWeek(newDays, frequency);
      setDaysOfWeekError(error);

      return newDays;
    });
  };

  // Check remaining goal slots
  const getRemainingGoalSlots = () => {
    const planId = user?.plan || "free";
    const currentGoalCount = activeGoalsResponse?.data?.length || 0;
    const goalLimit = getGoalLimit(planId);

    if (goalLimit === null) {
      return 999; // Unlimited
    }

    return Math.max(0, goalLimit - currentGoalCount);
  };

  const handleCreateGoal = async () => {
    if (!validateAllFields()) {
      await showAlert({
        title: t("common.error"),
        message:
          t("goals.create.error.validation_failed") ||
          "Please fix the errors in the form",
        variant: "error",
        confirmLabel: t("common.ok"),
      });
      return;
    }

    const remaining = getRemainingGoalSlots();
    if (remaining <= 0) {
      await showAlert({
        title: t("common.error"),
        message: t("onboarding.suggested_goals.goal_limit_reached", {
          limit: user?.plan ? getGoalLimit(user.plan) || 0 : 0,
        }),
        variant: "error",
        confirmLabel: t("common.ok"),
      });
      return;
    }

    // Type validation
    if (!(VALID_CATEGORIES as readonly string[]).includes(category)) {
      await showAlert({
        title: t("common.error"),
        message: "Invalid category selected",
        variant: "error",
        confirmLabel: t("common.ok"),
      });
      return;
    }

    if (!(VALID_FREQUENCIES as readonly string[]).includes(frequency)) {
      await showAlert({
        title: t("common.error"),
        message: "Invalid frequency selected",
        variant: "error",
        confirmLabel: t("common.ok"),
      });
      return;
    }

    try {
      setIsCreating(true);

      const finalTargetDays =
        frequency === "daily" ? 7 : parseInt(targetDays, 10);

      const goalData = {
        title: title.trim(),
        description: description.trim() || undefined,
        category: category as
          | "fitness"
          | "nutrition"
          | "wellness"
          | "mindfulness"
          | "sleep",
        frequency: frequency as "daily" | "weekly",
        target_days: finalTargetDays,
        days_of_week:
          frequency === "weekly" && daysOfWeek.length > 0
            ? daysOfWeek
            : undefined,
        reminder_times: reminderTimes || [],
      };

      await createGoal.mutateAsync(goalData);
      router.push(ROUTES.GOALS.LIST);
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      const isUpgradeError =
        error?.status === 403 ||
        errorMessage.toLowerCase().includes("upgrade") ||
        errorMessage.toLowerCase().includes("pro") ||
        errorMessage.toLowerCase().includes("premium");

      if (isUpgradeError) {
        await showAlert({
          title: t("onboarding.subscription.upgrade_required"),
          message: errorMessage,
          variant: "warning",
          confirmLabel: t("common.ok"),
        });
      } else {
        logger.error("Failed to create goal", {
          error: errorMessage,
          goalData: { title, category, frequency },
        });

        await showAlert({
          title: t("common.error"),
          message: t("goals.create.error.failed"),
          variant: "error",
          confirmLabel: t("common.ok"),
        });
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title Input */}
        <TextInput
          label={`${t("goals.create.form.title")} *`}
          value={title}
          onChangeText={handleTitleChange}
          placeholder={t("goals.create.form.title_placeholder")}
          maxLength={100}
          error={titleError || undefined}
          containerStyle={styles.inputGroup}
        />

        {/* Description Input */}
        <TextInput
          label={t("goals.create.form.description")}
          value={description}
          onChangeText={setDescription}
          placeholder={t("goals.create.form.description_placeholder")}
          multiline
          numberOfLines={3}
          maxLength={500}
          containerStyle={styles.inputGroup}
        />

        {/* Category Selection */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t("goals.create.form.category")} *</Text>
          <View style={styles.optionsGrid}>
            {CATEGORIES.map((cat) => {
              const isDisabled = !!initialData && category !== cat.key;
              return (
                <Button
                  key={cat.key}
                  title={cat.label}
                  onPress={() => !initialData && handleCategoryChange(cat.key)}
                  variant={category === cat.key ? "primary" : "outline"}
                  size="sm"
                  borderRadius="lg"
                  style={
                    isDisabled
                      ? { ...styles.optionButton, ...styles.disabledOption }
                      : styles.optionButton
                  }
                  disabled={isDisabled}
                />
              );
            })}
          </View>
          {initialData && (
            <Text style={styles.helperText}>
              {t("goals.create.form.category_ai_hint") ||
                "Category selected by AI based on your goal"}
            </Text>
          )}
          {categoryError && (
            <Text style={styles.errorText}>{categoryError}</Text>
          )}
        </View>

        {/* Frequency Selection */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t("goals.create.form.frequency")} *</Text>
          <View style={styles.optionsGrid}>
            {FREQUENCIES.map((freq) => (
              <Button
                key={freq.key}
                title={freq.label}
                onPress={() => handleFrequencyChange(freq.key)}
                variant={frequency === freq.key ? "primary" : "outline"}
                size="sm"
                borderRadius="lg"
                style={styles.optionButton}
              />
            ))}
          </View>
          {frequencyError && (
            <Text style={styles.errorText}>{frequencyError}</Text>
          )}
        </View>

        {/* Target Days - Only shown for daily (disabled) */}
        {frequency === "daily" && (
          <View style={styles.inputGroup}>
            <TextInput
              label={`${t("goals.create.form.target_days")} *`}
              value={targetDays}
              onChangeText={() => {}} // Disabled, no-op
              placeholder="7"
              keyboardType="numeric"
              maxLength={1}
              containerStyle={{ marginBottom: 0 }}
              disabled={true}
            />
            <Text style={styles.helperText}>
              {t("goals.create.form.target_days_daily_helper") ||
                "Daily habits automatically use all 7 days"}
            </Text>
          </View>
        )}

        {/* Days of Week Selector - Only for weekly */}
        {frequency === "weekly" && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {t("goals.create.form.days_of_week") || "Select Days"} *
            </Text>
            <Text style={styles.helperText}>
              {`${t("goals.create.form.days_of_week_weekly_helper") || "Select the days you want to check in"} (${daysOfWeek.length} selected)`}
            </Text>
            <View style={styles.daysGrid}>
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = daysOfWeek.includes(day.value);

                return (
                  <TouchableOpacity
                    key={day.value}
                    onPress={() => toggleDaySelection(day.value)}
                    style={[
                      styles.dayButton,
                      isSelected && styles.dayButtonSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayButtonText,
                        isSelected && styles.dayButtonTextSelected,
                      ]}
                    >
                      {day.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {daysOfWeekError && (
              <Text style={styles.errorText}>{daysOfWeekError}</Text>
            )}
          </View>
        )}

        {/* Reminder Times */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            {t(`goals.create.form.reminder_times_${category}`) ||
              t("goals.create.form.reminder_times")}
          </Text>
          <Text style={styles.helperText}>
            {t(`goals.create.form.reminder_times_description_${category}`) ||
              t("goals.create.form.reminder_times_description") ||
              "Set times when you want to be reminded."}
          </Text>

          {reminderTimes.length > 0 && (
            <View style={styles.reminderTimesList}>
              {reminderTimes.map((time) => (
                <View key={time} style={styles.reminderTimeChip}>
                  <Text style={styles.reminderTimeText}>{time}</Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveReminderTime(time)}
                    style={styles.removeTimeButton}
                  >
                    <Text style={styles.removeTimeText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <View style={styles.addTimeContainer}>
            <Button
              title={t("goals.create.form.add_time") || "Add Time"}
              onPress={handleAddReminderTime}
              variant="outline"
              size="md"
              style={{ flex: 1 }}
            />
          </View>

          {/* Time Picker */}
          {showTimePicker && Platform.OS === "ios" && (
            <Modal
              visible={showTimePicker}
              onClose={() => setShowTimePicker(false)}
              title={t("goals.create.form.add_time") || "Select Time"}
            >
              <View style={styles.timePickerContainer}>
                <DateTimePicker
                  value={selectedTime}
                  mode="time"
                  is24Hour={true}
                  display="spinner"
                  onChange={handleTimePickerChange}
                  style={styles.timePicker}
                />
                <View style={styles.timePickerActions}>
                  <Button
                    title={t("common.cancel")}
                    onPress={() => setShowTimePicker(false)}
                    variant="outline"
                    size="md"
                    style={{ flex: 1, marginRight: toRN(tokens.spacing[2]) }}
                  />
                  <Button
                    title={t("common.done")}
                    onPress={() => {
                      const timeString = formatTime(selectedTime);
                      if (reminderTimes.includes(timeString)) {
                        showAlert({
                          title: t("common.error"),
                          message:
                            t("goals.create.form.add_time_error_duplicate") ||
                            "This time is already added",
                          variant: "error",
                          confirmLabel: t("common.ok"),
                        });
                        return;
                      }
                      setReminderTimes((prev) => {
                        const newTimes = [...prev, timeString].sort();
                        const error = validateReminderTimes(newTimes);
                        setReminderTimesError(error);
                        return newTimes;
                      });
                      setShowTimePicker(false);
                    }}
                    variant="primary"
                    size="md"
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            </Modal>
          )}

          {showTimePicker && Platform.OS === "android" && (
            <DateTimePicker
              value={selectedTime}
              mode="time"
              is24Hour={true}
              display="default"
              onChange={handleTimePickerChange}
            />
          )}

          {reminderTimesError && (
            <Text style={styles.errorText}>{reminderTimesError}</Text>
          )}
        </View>
      </ScrollView>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title={t("goals.create.button_create")}
          onPress={handleCreateGoal}
          disabled={
            isCreating ||
            !title.trim() ||
            !!titleError ||
            !!categoryError ||
            !!frequencyError ||
            !!reminderTimesError ||
            !!daysOfWeekError
          }
          loading={isCreating}
          variant="primary"
          size="lg"
          fullWidth
        />
      </View>
    </>
  );
}

const makeCustomGoalFormStyles = (tokens: any, colors: any, brand: any) => {
  return {
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: toRN(tokens.spacing[6]),
      paddingBottom: toRN(tokens.spacing[6]),
    },
    inputGroup: {
      marginBottom: toRN(tokens.spacing[6]),
    },
    label: {
      fontSize: toRN(tokens.typography.fontSize.base),
      fontWeight: tokens.typography.fontWeight.semibold,
      color: colors.text.primary,
      marginBottom: toRN(tokens.spacing[2]),
      fontFamily: fontFamily.groteskSemiBold,
    },
    helperText: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.text.secondary,
      marginTop: toRN(tokens.spacing[1]),
      fontFamily: fontFamily.groteskRegular,
    },
    errorText: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.error || "#ef4444",
      marginTop: toRN(tokens.spacing[1]),
      fontFamily: fontFamily.groteskRegular,
    },
    optionsGrid: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: toRN(tokens.spacing[2]),
    },
    optionButton: {
      margin: 0,
    },
    disabledOption: {
      opacity: 0.4,
    },
    actions: {
      paddingHorizontal: toRN(tokens.spacing[6]),
      paddingTop: toRN(tokens.spacing[4]),
      paddingBottom: toRN(tokens.spacing[4]),
      backgroundColor: colors.bg.canvas,
      borderTopWidth: 1,
      borderTopColor: colors.border.default,
    },
    daysGrid: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: toRN(tokens.spacing[2]),
      marginTop: toRN(tokens.spacing[2]),
    },
    dayButton: {
      width: toRN(48),
      height: toRN(48),
      borderRadius: toRN(tokens.borderRadius.lg),
      borderWidth: 2,
      borderColor: colors.border.default,
      backgroundColor: colors.bg.surface,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    dayButtonSelected: {
      backgroundColor: brand.primary,
      borderColor: brand.primary,
    },
    dayButtonText: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      fontFamily: fontFamily.groteskMedium,
      color: colors.text.primary,
    },
    dayButtonTextSelected: {
      color: colors.text.inverse || "#FFFFFF",
      fontFamily: fontFamily.groteskSemiBold,
    },
    reminderTimesList: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: toRN(tokens.spacing[2]),
      marginBottom: toRN(tokens.spacing[3]),
    },
    reminderTimeChip: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: brand.primary + "15",
      borderRadius: toRN(tokens.borderRadius.md),
      paddingHorizontal: toRN(tokens.spacing[3]),
      paddingVertical: toRN(tokens.spacing[2]),
    },
    reminderTimeText: {
      fontSize: toRN(tokens.typography.fontSize.base),
      fontFamily: fontFamily.groteskMedium,
      color: brand.primary,
      marginRight: toRN(tokens.spacing[2]),
    },
    removeTimeButton: {
      width: toRN(20),
      height: toRN(20),
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    removeTimeText: {
      fontSize: toRN(tokens.typography.fontSize.xl),
      color: brand.primary,
      lineHeight: toRN(tokens.typography.fontSize.xl),
    },
    addTimeContainer: {
      flexDirection: "row" as const,
      alignItems: "flex-start" as const,
      gap: toRN(tokens.spacing[2]),
    },
    timePickerContainer: {
      paddingVertical: toRN(tokens.spacing[4]),
    },
    timePicker: {
      width: "100%",
      height: toRN(200),
    },
    timePickerActions: {
      flexDirection: "row" as const,
      marginTop: toRN(tokens.spacing[4]),
      paddingTop: toRN(tokens.spacing[4]),
      borderTopWidth: 1,
      borderTopColor: colors.border.default,
    },
  };
};
