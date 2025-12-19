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
import { usePostHog } from "@/hooks/usePostHog";
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
import { Ionicons } from "@expo/vector-icons";
import { ROUTES } from "@/lib";

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
];

// Goal types with descriptions and icons
const GOAL_TYPES = [
  {
    key: "habit",
    icon: "repeat" as const,
    color: "#22C55E", // Green - growth, consistency
  },
  {
    key: "time_challenge",
    icon: "calendar" as const,
    color: "#3B82F6", // Blue - time, progress
  },
  {
    key: "target_challenge",
    icon: "flag" as const,
    color: "#F59E0B", // Amber - achievement, target
  },
] as const;

// Days of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
const DAYS_OF_WEEK = [
  { value: 0, label: "Sun", short: "S" },
  { value: 1, label: "Mon", short: "M" },
  { value: 2, label: "Tue", short: "T" },
  { value: 3, label: "Wed", short: "W" },
  { value: 4, label: "Thu", short: "T" },
  { value: 5, label: "Fri", short: "F" },
  { value: 6, label: "Sat", short: "S" },
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
const VALID_FREQUENCIES = ["daily", "weekly"];

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

const validateDaysOfWeek = (
  days: number[],
  frequency: string,
  targetDays: number
): string | null => {
  if (frequency === "weekly") {
    if (days.length === 0) {
      return "Please select at least one day";
    }
    if (days.length > targetDays) {
      return `You can only select ${targetDays} day(s) based on your target days`;
    }
    // Validate day values are valid (0-6)
    for (const day of days) {
      if (day < 0 || day > 6) {
        return "Invalid day selected";
      }
    }
  }
  return null;
};

// Challenge duration options
const CHALLENGE_DURATIONS = [
  { value: 30, label: "30" },
  { value: 60, label: "60" },
  { value: 90, label: "90" },
  { value: -1, label: "Custom" }, // -1 indicates custom input
];

// Validate challenge duration
const validateChallengeDuration = (
  duration: number,
  goalType: string
): string | null => {
  if (goalType !== "time_challenge") return null;

  if (duration <= 0) {
    return "Duration must be greater than 0";
  }
  if (duration < 7) {
    return "Duration must be at least 7 days";
  }
  if (duration > 365) {
    return "Duration cannot exceed 365 days";
  }
  return null;
};

// Target checkin options
const TARGET_OPTIONS = [
  { value: 25, label: "25" },
  { value: 50, label: "50" },
  { value: 75, label: "75" },
  { value: 100, label: "100" },
  { value: -1, label: "Custom" }, // -1 indicates custom input
];

// Validate target checkins against available workout days
const validateTargetCheckins = (
  targetCheckins: number,
  daysOfWeek: number[],
  frequency: string,
  challengeDuration: number,
  reminderTimes: string[]
): string | null => {
  if (targetCheckins <= 0) {
    return "Target check-ins must be greater than 0";
  }

  // Calculate maximum achievable check-ins
  let maxCheckins: number;
  const numReminderTimes = Math.max(1, reminderTimes.length);

  if (frequency === "weekly" && daysOfWeek.length > 0) {
    // Weekly: workout_days_per_week × weeks × reminder_times
    const workoutDaysPerWeek = daysOfWeek.length;
    const weeks = Math.ceil(challengeDuration / 7);
    maxCheckins = workoutDaysPerWeek * weeks * numReminderTimes;
  } else {
    // Daily: duration × reminder_times
    maxCheckins = challengeDuration * numReminderTimes;
  }

  if (targetCheckins > maxCheckins) {
    const daysDesc =
      frequency === "weekly" ? `${daysOfWeek.length} days/week` : "daily";
    return `Target of ${targetCheckins} is not achievable in ${challengeDuration} days with ${daysDesc}. Maximum: ${maxCheckins}`;
  }

  return null;
};

export interface CustomGoalFormProps {
  initialData?: SuggestedGoal | null;
  goalType?: "habit" | "time_challenge" | "target_challenge" | "mixed";
}

export function CustomGoalForm({
  initialData,
  goalType = "habit",
}: CustomGoalFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("fitness");
  const [frequency, setFrequency] = useState("daily");
  const [targetDays, setTargetDays] = useState("7");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [reminderTimes, setReminderTimes] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedTime, setSelectedTime] = useState<Date>(new Date());

  // Challenge-specific fields
  const [challengeDuration, setChallengeDuration] = useState(30);
  const [targetCheckins, setTargetCheckins] = useState(50);
  const [isCustomTarget, setIsCustomTarget] = useState(false);
  const [customTargetValue, setCustomTargetValue] = useState("");
  const [targetCheckinsError, setTargetCheckinsError] = useState<string | null>(
    null
  );
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [customDurationValue, setCustomDurationValue] = useState("");
  const [challengeDurationError, setChallengeDurationError] = useState<
    string | null
  >(null);

  // Goal type state - allow user to change it
  const [selectedGoalType, setSelectedGoalType] = useState<
    "habit" | "time_challenge" | "target_challenge"
  >("habit");

  // Determine the effective goal type (from initialData, selectedGoalType, or prop)
  const effectiveGoalType = selectedGoalType;

  // Validation errors
  const [titleError, setTitleError] = useState<string | null>(null);
  const [targetDaysError, setTargetDaysError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [frequencyError, setFrequencyError] = useState<string | null>(null);
  const [reminderTimesError, setReminderTimesError] = useState<string | null>(
    null
  );
  const [daysOfWeekError, setDaysOfWeekError] = useState<string | null>(null);

  const { t } = useTranslation();
  const styles = useStyles(makeCustomGoalFormStyles);
  const { colors } = useTheme();
  const { capture } = usePostHog();
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
      setCategory(initialData.category || "fitness");
      const freq = initialData.frequency || "daily";
      setFrequency(freq);
      const targetDaysValue = initialData.target_days || 7;
      setTargetDays(String(targetDaysValue));

      // Set goal type from initialData
      const goalTypeFromData = (initialData as any).goal_type || goalType;
      if (
        goalTypeFromData === "habit" ||
        goalTypeFromData === "time_challenge" ||
        goalTypeFromData === "target_challenge"
      ) {
        setSelectedGoalType(goalTypeFromData);
      } else {
        setSelectedGoalType("habit");
      }

      // Set challenge-specific fields
      if ((initialData as any).duration_days) {
        setChallengeDuration((initialData as any).duration_days);
      }
      if ((initialData as any).target_checkins) {
        setTargetCheckins((initialData as any).target_checkins);
      }

      // Handle days_of_week for weekly goals
      const daysArray = Array.isArray(initialData.days_of_week)
        ? [...initialData.days_of_week]
        : [];
      if (freq === "weekly" && daysArray.length > 0) {
        setDaysOfWeek(daysArray);
      } else {
        setDaysOfWeek([]);
      }

      // Ensure reminder_times is always a fresh array to trigger re-render
      const reminderTimesArray = Array.isArray(initialData.reminder_times)
        ? [...initialData.reminder_times] // Create new array reference
        : [];
      setReminderTimes(reminderTimesArray);
      // Clear errors when pre-filling
      setTitleError(null);
      setTargetDaysError(null);
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
      // Reset to default goal type from prop
      if (
        goalType === "habit" ||
        goalType === "time_challenge" ||
        goalType === "target_challenge"
      ) {
        setSelectedGoalType(goalType);
      } else {
        setSelectedGoalType("habit");
      }
    }
  }, [initialData, goalType]);

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

    // Validate days of week for weekly goals
    const targetDaysNum = parseInt(targetDays, 10) || 0;
    const daysErr = validateDaysOfWeek(daysOfWeek, frequency, targetDaysNum);
    setDaysOfWeekError(daysErr);
    if (daysErr) isValid = false;

    // Validate reminder times format
    const reminderTimesErr = validateReminderTimes(reminderTimes);
    setReminderTimesError(reminderTimesErr);
    if (reminderTimesErr) isValid = false;

    // Validate target check-ins for target challenges
    if (effectiveGoalType === "target_challenge") {
      const targetCheckinsErr = validateTargetCheckins(
        targetCheckins,
        daysOfWeek,
        frequency,
        challengeDuration,
        reminderTimes
      );
      setTargetCheckinsError(targetCheckinsErr);
      if (targetCheckinsErr) isValid = false;
    }

    // Validate challenge duration for time challenges
    if (effectiveGoalType === "time_challenge") {
      const durationErr = validateChallengeDuration(
        challengeDuration,
        effectiveGoalType
      );
      setChallengeDurationError(durationErr);
      if (durationErr) isValid = false;
    }

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

      // If reducing target_days and we have more days selected, clear excess
      const targetDaysNum = parseInt(numericValue, 10) || 0;
      if (targetDaysNum > 0 && daysOfWeek.length > targetDaysNum) {
        setDaysOfWeek((prev) => prev.slice(0, targetDaysNum));
      }

      // Real-time validation
      if (targetDaysError) {
        const error = validateTargetDays(numericValue);
        setTargetDaysError(error);
      }

      // Validate days_of_week against new target
      if (numericValue && frequency === "weekly") {
        const error = validateDaysOfWeek(daysOfWeek, frequency, targetDaysNum);
        setDaysOfWeekError(error);
      }
    }
  };

  const formatTime = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const handleTimePickerChange = async (event: any, date?: Date) => {
    // Android: handle time selection
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
    }
    // iOS: only update the selected time state (Done button handles the actual add)
    else if (Platform.OS === "ios" && date) {
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

    // Reset days_of_week and target_days based on frequency
    if (value === "daily") {
      setDaysOfWeek([]);
      setTargetDays("7"); // Daily = all 7 days
      setTargetDaysError(null);
    } else if (value === "weekly") {
      // Keep existing days if valid, otherwise clear
      const targetDaysNum = parseInt(targetDays, 10) || 0;
      if (daysOfWeek.length > targetDaysNum) {
        setDaysOfWeek([]);
      }
    }
  };

  const toggleDaySelection = (dayValue: number) => {
    const targetDaysNum = parseInt(targetDays, 10) || 0;

    setDaysOfWeek((prev) => {
      const isSelected = prev.includes(dayValue);
      let newDays: number[];

      if (isSelected) {
        // Remove day
        newDays = prev.filter((d) => d !== dayValue);
      } else {
        // Add day if under limit
        if (prev.length < targetDaysNum) {
          newDays = [...prev, dayValue].sort((a, b) => a - b);
        } else {
          // Can't add more days
          return prev;
        }
      }

      // Validate after change
      const error = validateDaysOfWeek(newDays, frequency, targetDaysNum);
      setDaysOfWeekError(error);

      return newDays;
    });
  };

  // Check remaining goal slots (same logic as SuggestedGoalsScreen)
  const getRemainingGoalSlots = () => {
    const planId = user?.plan || "free";
    const currentGoalCount = activeGoalsResponse?.data?.length || 0;
    const goalLimit = getGoalLimit(planId);

    // If unlimited, return a large number
    if (goalLimit === null) {
      return 999; // Effectively unlimited
    }

    return Math.max(0, goalLimit - currentGoalCount);
  };

  const handleCreateGoal = async () => {
    // Validate all fields before submission
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

    // Validate goal limit before creating (same as SuggestedGoalsScreen)
    const remaining = getRemainingGoalSlots();

    console.log("remaining", remaining);
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

    // Parse validated target days
    const targetDaysNum = parseInt(targetDays, 10);

    // Additional validation for type safety (shouldn't fail at this point)
    if (!VALID_CATEGORIES.includes(category)) {
      await showAlert({
        title: t("common.error"),
        message: "Invalid category selected",
        variant: "error",
        confirmLabel: t("common.ok"),
      });
      return;
    }

    if (!VALID_FREQUENCIES.includes(frequency)) {
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

      // Determine target_days based on frequency
      let finalTargetDays = targetDaysNum;
      if (frequency === "daily") {
        finalTargetDays = 7; // Daily goals always use all 7 days
      }

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
        frequency: frequency as "daily" | "weekly",
        target_days: finalTargetDays,
        days_of_week:
          frequency === "weekly" && daysOfWeek.length > 0
            ? daysOfWeek
            : undefined,
        reminder_times: reminderTimes || [],
        // Goal type fields
        goal_type: effectiveGoalType as
          | "habit"
          | "time_challenge"
          | "target_challenge",
        // Time challenge: duration in days
        challenge_duration_days:
          effectiveGoalType === "time_challenge"
            ? challengeDuration
            : undefined,
        // Target challenge: number of check-ins to complete
        target_checkins:
          effectiveGoalType === "target_challenge" ? targetCheckins : undefined,
      };

      // Create goal via API mutation
      const createdGoal = await createGoal.mutateAsync(goalData);

      // Add goal to store for real-time updates (same as SuggestedGoalsScreen)
      if (createdGoal?.data) {
        // React Query auto-invalidates cache on mutation success (no manual update needed)
      }

      // Navigate back
      router.push(ROUTES.GOALS.LIST);
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      const isUpgradeError =
        error?.status === 403 ||
        errorMessage.toLowerCase().includes("upgrade") ||
        errorMessage.toLowerCase().includes("pro") ||
        errorMessage.toLowerCase().includes("premium");

      if (isUpgradeError) {
        // Business logic response - show upgrade prompt, don't log as error
        await showAlert({
          title: t("onboarding.subscription.upgrade_required"),
          message: errorMessage,
          variant: "warning",
          confirmLabel: t("common.ok"),
        });
      } else {
        // Actual error - log and show generic message
        logger.error("Failed to create goal", {
          error: errorMessage,
          goalData: { title, category, frequency, target_days: targetDaysNum },
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

        {/* Goal Type Selection - Apple-style segmented cards */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t("goals.create.form.goal_type")}</Text>
          <View style={styles.goalTypeContainer}>
            {GOAL_TYPES.map((type) => {
              const isSelected = selectedGoalType === type.key;
              return (
                <TouchableOpacity
                  key={type.key}
                  onPress={() =>
                    setSelectedGoalType(
                      type.key as
                        | "habit"
                        | "time_challenge"
                        | "target_challenge"
                    )
                  }
                  activeOpacity={0.7}
                  style={[
                    styles.goalTypeCard,
                    isSelected && {
                      borderColor: type.color,
                      backgroundColor: type.color + "08",
                    },
                  ]}
                >
                  {/* Icon circle */}
                  <View
                    style={[
                      styles.goalTypeIconContainer,
                      {
                        backgroundColor: isSelected
                          ? type.color + "15"
                          : colors.bg.muted,
                      },
                    ]}
                  >
                    <Ionicons
                      name={type.icon}
                      size={toRN(tokens.typography.fontSize.xl)}
                      color={isSelected ? type.color : colors.text.tertiary}
                    />
                  </View>

                  {/* Text content */}
                  <View style={styles.goalTypeTextContainer}>
                    <Text
                      style={[
                        styles.goalTypeLabel,
                        isSelected && { color: type.color },
                      ]}
                    >
                      {t(`goals.create.form.goal_type_${type.key}`)}
                    </Text>
                    <Text style={styles.goalTypeDescription}>
                      {t(`goals.create.form.goal_type_${type.key}_desc`)}
                    </Text>
                  </View>

                  {/* Selection indicator */}
                  <View
                    style={[
                      styles.goalTypeCheckCircle,
                      isSelected && {
                        backgroundColor: type.color,
                        borderColor: type.color,
                      },
                    ]}
                  >
                    {isSelected && (
                      <Ionicons
                        name="checkmark"
                        size={toRN(tokens.typography.fontSize.sm)}
                        color="#FFFFFF"
                      />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

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

        {/* Challenge Duration - Only for time challenges */}
        {effectiveGoalType === "time_challenge" && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {t("goals.types.time_challenge.duration_label") ||
                "Challenge Duration"}{" "}
              *
            </Text>
            <View style={styles.optionsGrid}>
              {CHALLENGE_DURATIONS.map((duration) => {
                const isSelected =
                  duration.value === -1
                    ? isCustomDuration
                    : !isCustomDuration && challengeDuration === duration.value;
                return (
                  <Button
                    key={duration.value}
                    title={duration.label}
                    onPress={() => {
                      if (duration.value === -1) {
                        setIsCustomDuration(true);
                        setChallengeDurationError(null);
                      } else {
                        setIsCustomDuration(false);
                        setChallengeDuration(duration.value);
                        setCustomDurationValue("");
                        setChallengeDurationError(null);
                      }
                    }}
                    variant={isSelected ? "primary" : "outline"}
                    size="sm"
                    borderRadius="lg"
                    style={styles.optionButton}
                  />
                );
              })}
            </View>

            {/* Custom duration input */}
            {isCustomDuration && (
              <TextInput
                label={
                  t("goals.types.time_challenge.custom_duration") ||
                  "Enter custom duration (days)"
                }
                value={customDurationValue}
                onChangeText={(value) => {
                  setCustomDurationValue(value);
                  const num = parseInt(value, 10);
                  if (!isNaN(num) && num > 0) {
                    setChallengeDuration(num);
                    setChallengeDurationError(null);
                  }
                }}
                placeholder="e.g., 45"
                keyboardType="numeric"
                containerStyle={{ marginTop: 8 }}
                error={challengeDurationError || undefined}
              />
            )}

            {/* Validation error */}
            {challengeDurationError && !isCustomDuration && (
              <Text style={styles.errorText}>{challengeDurationError}</Text>
            )}

            <Text style={styles.helperText}>
              {t("goals.types.time_challenge.description") ||
                "Complete this challenge within the selected duration"}
            </Text>

            {/* Achievability hint for time challenges */}
            {frequency === "weekly" && daysOfWeek.length > 0 && (
              <Text style={styles.infoText}>
                {t("goals.types.time_challenge.achievability_hint", {
                  daysPerWeek: daysOfWeek.length,
                  weeks: Math.ceil(challengeDuration / 7),
                  totalDays:
                    daysOfWeek.length * Math.ceil(challengeDuration / 7),
                }) ||
                  `With ${daysOfWeek.length} days/week over ${Math.ceil(challengeDuration / 7)} weeks = ${daysOfWeek.length * Math.ceil(challengeDuration / 7)} workout days`}
              </Text>
            )}
          </View>
        )}

        {/* Target Check-ins - Only for target challenges */}
        {effectiveGoalType === "target_challenge" && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {t("goals.types.target_challenge.target_label") ||
                "Target Check-ins"}{" "}
              *
            </Text>
            <View style={styles.optionsGrid}>
              {TARGET_OPTIONS.map((target) => {
                const isSelected =
                  target.value === -1
                    ? isCustomTarget
                    : !isCustomTarget && targetCheckins === target.value;
                return (
                  <Button
                    key={target.value}
                    title={target.label}
                    onPress={() => {
                      if (target.value === -1) {
                        setIsCustomTarget(true);
                        setTargetCheckinsError(null);
                      } else {
                        setIsCustomTarget(false);
                        setTargetCheckins(target.value);
                        setCustomTargetValue("");
                        setTargetCheckinsError(null);
                      }
                    }}
                    variant={isSelected ? "primary" : "outline"}
                    size="sm"
                    borderRadius="lg"
                    style={styles.optionButton}
                  />
                );
              })}
            </View>

            {/* Custom input field */}
            {isCustomTarget && (
              <TextInput
                label={
                  t("goals.types.target_challenge.custom_target") ||
                  "Enter custom target"
                }
                value={customTargetValue}
                onChangeText={(value) => {
                  setCustomTargetValue(value);
                  const num = parseInt(value, 10);
                  if (!isNaN(num) && num > 0) {
                    setTargetCheckins(num);
                    setTargetCheckinsError(null);
                  }
                }}
                placeholder="e.g., 15"
                keyboardType="numeric"
                containerStyle={{ marginTop: 8 }}
                error={targetCheckinsError || undefined}
              />
            )}

            {/* Validation error */}
            {targetCheckinsError && !isCustomTarget && (
              <Text style={styles.errorText}>{targetCheckinsError}</Text>
            )}

            <Text style={styles.helperText}>
              {t("goals.types.target_challenge.description") ||
                "Complete when you reach this number of check-ins"}
            </Text>

            {/* Achievability hint */}
            {frequency === "weekly" && daysOfWeek.length > 0 && (
              <Text style={styles.infoText}>
                {t("goals.types.target_challenge.achievability_hint", {
                  daysPerWeek: daysOfWeek.length,
                  weeks: Math.ceil(challengeDuration / 7),
                  maxCheckins:
                    daysOfWeek.length *
                    Math.ceil(challengeDuration / 7) *
                    Math.max(1, reminderTimes.length),
                }) ||
                  `With ${daysOfWeek.length} days/week over ${Math.ceil(challengeDuration / 7)} weeks, max achievable: ${daysOfWeek.length * Math.ceil(challengeDuration / 7) * Math.max(1, reminderTimes.length)} check-ins`}
              </Text>
            )}
          </View>
        )}

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
            disabled={frequency === "daily"}
          />
          <Text style={styles.helperText}>
            {frequency === "daily"
              ? t("goals.create.form.target_days_daily_helper") ||
                "Daily goals automatically use all 7 days"
              : t("goals.create.form.target_days_helper")}
          </Text>
        </View>

        {/* Days of Week Selector - Only for weekly goals */}
        {frequency === "weekly" && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {t("goals.create.form.days_of_week") || "Select Days"} *
            </Text>
            <Text style={styles.helperText}>
              {t("goals.create.form.days_of_week_helper") ||
                `Select up to ${targetDays} day(s) (${daysOfWeek.length} selected)`}
            </Text>
            <View style={styles.daysGrid}>
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = daysOfWeek.includes(day.value);
                const targetDaysNum = parseInt(targetDays, 10) || 0;
                const canSelect =
                  daysOfWeek.length < targetDaysNum || isSelected;

                return (
                  <TouchableOpacity
                    key={day.value}
                    onPress={() => canSelect && toggleDaySelection(day.value)}
                    style={[
                      styles.dayButton,
                      isSelected && styles.dayButtonSelected,
                      !canSelect && !isSelected && styles.dayButtonDisabled,
                    ]}
                    disabled={!canSelect && !isSelected}
                  >
                    <Text
                      style={[
                        styles.dayButtonText,
                        isSelected && styles.dayButtonTextSelected,
                        !canSelect &&
                          !isSelected &&
                          styles.dayButtonTextDisabled,
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

          {/* Display selected times */}
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

          {/* Add new time button */}
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
            !!targetDaysError ||
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
    infoText: {
      fontSize: toRN(tokens.typography.fontSize.xs),
      color: colors.text.tertiary,
      marginTop: toRN(tokens.spacing[2]),
      fontFamily: fontFamily.groteskRegular,
      fontStyle: "italic" as const,
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
    goalTypeContainer: {
      gap: toRN(tokens.spacing[3]),
    },
    goalTypeCard: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      padding: toRN(tokens.spacing[4]),
      borderRadius: toRN(tokens.borderRadius.xl),
      borderWidth: 2,
      borderColor: colors.border.default,
      backgroundColor: colors.bg.surface,
    },
    goalTypeIconContainer: {
      width: toRN(44),
      height: toRN(44),
      borderRadius: toRN(tokens.borderRadius.lg),
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginRight: toRN(tokens.spacing[3]),
    },
    goalTypeTextContainer: {
      flex: 1,
    },
    goalTypeLabel: {
      fontSize: toRN(tokens.typography.fontSize.base),
      fontFamily: fontFamily.groteskSemiBold,
      color: colors.text.primary,
      marginBottom: toRN(tokens.spacing[0.5] || 2),
    },
    goalTypeDescription: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      fontFamily: fontFamily.groteskRegular,
      color: colors.text.tertiary,
    },
    goalTypeCheckCircle: {
      width: toRN(24),
      height: toRN(24),
      borderRadius: toRN(12),
      borderWidth: 2,
      borderColor: colors.border.default,
      backgroundColor: "transparent",
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginLeft: toRN(tokens.spacing[2]),
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
    dayButtonDisabled: {
      opacity: 0.5,
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
    dayButtonTextDisabled: {
      color: colors.text.tertiary,
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
