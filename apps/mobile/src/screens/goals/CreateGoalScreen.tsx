import React, { useState } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { useTranslation } from "@/lib/i18n";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { useStyles } from "@/themes/makeStyles";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens } from "@/themes/tokens";
import { useTheme } from "@/themes";
import { usePostHog } from "@/hooks/usePostHog";
import { logger } from "@/services/logger";
import { useCreateGoal } from "@/hooks/api/useGoals";
import { router } from "expo-router";
import { MOBILE_ROUTES } from "@/lib/routes";
import { BackButton } from "@/components/ui/BackButton";
import { useGoals } from "@/hooks/useGoals";
import Button from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import Modal from "@/components/ui/Modal";

const CATEGORIES = [
  { key: "fitness", label: "Fitness" },
  { key: "nutrition", label: "Nutrition" },
  { key: "wellness", label: "Wellness" },
  { key: "mindfulness", label: "Mindfulness" },
  { key: "sleep", label: "Sleep" },
  { key: "custom", label: "Custom" },
];

const FREQUENCIES = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "custom", label: "Custom" },
];

const REMINDER_TIMES = [
  "06:00",
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
];

// Valid categories and frequencies based on API requirements
const VALID_CATEGORIES = [
  "fitness",
  "nutrition",
  "wellness",
  "mindfulness",
  "sleep",
  "custom",
];
const VALID_FREQUENCIES = ["daily", "weekly", "monthly", "custom"];

// Validation helpers
const isValidTimeFormat = (time: string): boolean => {
  const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
  return timeRegex.test(time);
};

const validateTitle = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Title is required";
  }
  if (trimmed.length < 3) {
    return "Title must be at least 3 characters";
  }
  if (trimmed.length > 100) {
    return "Title must be less than 100 characters";
  }
  return null;
};

const validateTargetDays = (value: string): string | null => {
  if (!value.trim()) {
    return "Target days is required";
  }
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    return "Target days must be a number";
  }
  if (num < 1 || num > 7) {
    return "Target days must be between 1 and 7";
  }
  return null;
};

const validateCategory = (value: string): string | null => {
  if (!value || !VALID_CATEGORIES.includes(value)) {
    return "Please select a valid category";
  }
  return null;
};

const validateFrequency = (value: string): string | null => {
  if (!value || !VALID_FREQUENCIES.includes(value)) {
    return "Please select a valid frequency";
  }
  return null;
};

const validateReminderTimes = (times: string[]): string | null => {
  for (const time of times) {
    if (!isValidTimeFormat(time)) {
      return `Invalid time format: ${time}. Use HH:MM format (e.g., 06:00)`;
    }
  }
  return null;
};

export default function CreateGoalScreen() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("fitness");
  const [frequency, setFrequency] = useState("daily");
  const [targetDays, setTargetDays] = useState("7");
  const [reminderTimes, setReminderTimes] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);

  // Validation errors
  const [titleError, setTitleError] = useState<string | null>(null);
  const [targetDaysError, setTargetDaysError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [frequencyError, setFrequencyError] = useState<string | null>(null);
  const [reminderTimesError, setReminderTimesError] = useState<string | null>(
    null
  );

  const { t } = useTranslation();
  const styles = useStyles(makeCreateGoalScreenStyles);
  const insets = useSafeAreaInsets();
  const { colors, brandColors } = useTheme();
  const { capture } = usePostHog();
  const createGoal = useCreateGoal();
  const { createGoal: createGoalInStore } = useGoals();

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

    // Validate target days
    const targetDaysErr = validateTargetDays(targetDays);
    setTargetDaysError(targetDaysErr);
    if (targetDaysErr) isValid = false;

    // Validate reminder times format
    const reminderTimesErr = validateReminderTimes(reminderTimes);
    setReminderTimesError(reminderTimesErr);
    if (reminderTimesErr) isValid = false;

    return isValid;
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    // Real-time validation only after user has interacted
    if (titleError) {
      const error = validateTitle(value);
      setTitleError(error);
    }
  };

  const handleTargetDaysChange = (value: string) => {
    // Only allow numeric input
    const numericValue = value.replace(/[^0-9]/g, "");
    if (
      numericValue === "" ||
      (numericValue.length <= 1 && parseInt(numericValue) <= 7)
    ) {
      setTargetDays(numericValue);
      // Real-time validation
      if (targetDaysError) {
        const error = validateTargetDays(numericValue);
        setTargetDaysError(error);
      }
    }
  };

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    setCategoryError(null);
  };

  const handleFrequencyChange = (value: string) => {
    setFrequency(value);
    setFrequencyError(null);
  };

  const handleCreateGoal = async () => {
    // Validate all fields before submission
    if (!validateAllFields()) {
      Alert.alert(
        t("common.error"),
        t("goals.create.error.validation_failed") ||
          "Please fix the errors in the form"
      );
      return;
    }

    // Parse validated target days
    const targetDaysNum = parseInt(targetDays, 10);

    // Additional validation for type safety (shouldn't fail at this point)
    if (!VALID_CATEGORIES.includes(category)) {
      Alert.alert(t("common.error"), "Invalid category selected");
      return;
    }

    if (!VALID_FREQUENCIES.includes(frequency)) {
      Alert.alert(t("common.error"), "Invalid frequency selected");
      return;
    }

    try {
      setIsCreating(true);

      const goalData = {
        title: title.trim(),
        description: description.trim() || undefined,
        category: category as
          | "fitness"
          | "nutrition"
          | "wellness"
          | "mindfulness"
          | "sleep"
          | "custom",
        frequency: frequency as "daily" | "weekly" | "monthly" | "custom",
        target_days: targetDaysNum,
        reminder_times: reminderTimes || [],
      };

      // Create goal using both the mutation and store
      const createdGoal = await createGoal.mutateAsync(goalData);

      // Also update the store for real-time updates
      if (createdGoal) {
        await createGoalInStore(goalData);
      }

      // Track success
      capture("goal_manual_created", {
        category,
        frequency,
        target_days: targetDaysNum,
        reminder_count: reminderTimes.length,
        source: "manual_creation",
      });

      // Navigate back to suggested goals or to subscription
      router.back();
    } catch (error) {
      logger.error("Failed to create manual goal", {
        error: error instanceof Error ? error.message : String(error),
        goalData: { title, category, frequency, target_days: targetDaysNum },
      });

      Alert.alert(t("common.error"), t("goals.create.error.failed"));
    } finally {
      setIsCreating(false);
    }
  };

  const toggleReminderTime = (time: string) => {
    setReminderTimes((prev) => {
      const newTimes = prev.includes(time)
        ? prev.filter((t) => t !== time)
        : [...prev, time];
      // Validate reminder times when they change
      const error = validateReminderTimes(newTimes);
      setReminderTimesError(error);
      return newTimes;
    });
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <BackButton
        onPress={handleBack}
        title={t("goals.create.title")}
        titleCentered={true}
      />

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
            {CATEGORIES.map((cat) => (
              <Button
                key={cat.key}
                title={cat.label}
                onPress={() => handleCategoryChange(cat.key)}
                variant={category === cat.key ? "primary" : "outline"}
                size="sm"
                borderRadius="lg"
                style={styles.optionButton}
              />
            ))}
          </View>
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

        {/* Target Days */}
        <View style={styles.inputGroup}>
          <TextInput
            label={`${t("goals.create.form.target_days")} *`}
            value={targetDays}
            onChangeText={handleTargetDaysChange}
            placeholder="7"
            keyboardType="numeric"
            maxLength={1}
            error={targetDaysError || undefined}
            containerStyle={{ marginBottom: 0 }}
          />
          <Text style={styles.helperText}>
            {t("goals.create.form.target_days_helper")}
          </Text>
        </View>

        {/* Reminder Times */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            {t("goals.create.form.reminder_times")}
          </Text>
          <Button
            title={
              reminderTimes.length === 0
                ? t("goals.create.form.select_reminder_times")
                : t("goals.create.form.reminder_times_selected", {
                    count: reminderTimes.length,
                  })
            }
            onPress={() => setShowReminderModal(true)}
            variant="outline"
            size="md"
            fullWidth
            borderRadius="lg"
            rightIcon="chevron-forward"
          />
          {reminderTimesError && (
            <Text style={styles.errorText}>{reminderTimesError}</Text>
          )}
        </View>
      </ScrollView>

      {/* Actions */}
      <View style={[styles.actions, { paddingBottom: insets.bottom - 30 }]}>
        <Button
          title={t("goals.create.button_create")}
          onPress={handleCreateGoal}
          disabled={
            isCreating ||
            !title.trim() ||
            !!titleError ||
            !!targetDaysError ||
            !!categoryError ||
            !!frequencyError ||
            !!reminderTimesError
          }
          loading={isCreating}
          variant="primary"
          size="lg"
          fullWidth
        />
      </View>

      {/* Reminder Times Modal */}
      <Modal
        visible={showReminderModal}
        onClose={() => setShowReminderModal(false)}
        title={t("goals.create.form.reminder_times")}
        showFooter={true}
        scrollable={true}
      >
        <View style={styles.modalReminderGrid}>
          {REMINDER_TIMES.map((time) => (
            <Button
              key={time}
              title={time}
              onPress={() => toggleReminderTime(time)}
              variant={reminderTimes.includes(time) ? "primary" : "outline"}
              size="sm"
              borderRadius="md"
              style={styles.modalReminderButton}
            />
          ))}
        </View>
      </Modal>
    </View>
  );
}

const makeCreateGoalScreenStyles = (tokens: any, colors: any, brand: any) => {
  return {
    container: {
      flex: 1,
      backgroundColor: colors.bg.canvas,
    },
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
    textInput: {
      backgroundColor: colors.bg.surface,
      borderRadius: toRN(tokens.borderRadius.lg),
      paddingHorizontal: toRN(tokens.spacing[4]),
      paddingVertical: toRN(tokens.spacing[3]),
      fontSize: toRN(tokens.typography.fontSize.base),
      color: colors.text.primary,
      fontFamily: fontFamily.groteskRegular,
      borderWidth: 1,
      borderColor: colors.border.primary,
    },
    textArea: {
      height: toRN(tokens.spacing[20]),
      textAlignVertical: "top" as const,
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
    reminderGrid: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: toRN(tokens.spacing[2]),
    },
    reminderButton: {
      margin: 0,
    },
    actions: {
      paddingHorizontal: toRN(tokens.spacing[6]),
    },
    modalReminderGrid: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: toRN(tokens.spacing[2]),
    },
    modalReminderButton: {
      margin: 0,
    },
  };
};
