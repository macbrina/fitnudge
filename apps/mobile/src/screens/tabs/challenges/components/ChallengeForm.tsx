import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
  Switch,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTranslation } from "@/lib/i18n";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { useStyles } from "@/themes/makeStyles";
import { tokens } from "@/themes/tokens";
import { useTheme } from "@/themes";
import { logger } from "@/services/logger";
import { useCreateChallenge } from "@/hooks/api/useChallenges";
import { router } from "expo-router";
import Button from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import Modal from "@/components/ui/Modal";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { Ionicons } from "@expo/vector-icons";
import { MOBILE_ROUTES } from "@/lib/routes";
import { DatePicker } from "@/components/ui/DatePicker";
import {
  CATEGORIES,
  FREQUENCIES,
  DAYS_OF_WEEK,
  CHALLENGE_DURATIONS,
  TARGET_OPTIONS,
  validateTitle,
  validateCategory,
  validateFrequency,
  validateTargetDays,
  validateDaysOfWeek,
  validateReminderTimes,
  validateChallengeDuration,
  validateTargetCheckins,
} from "@/utils/goalValidation";

// Challenge types - matching goal types pattern
// streak = time_challenge (duration-based)
// checkin_count = target_challenge (count-based)
const CHALLENGE_TYPES = [
  {
    key: "streak" as const,
    icon: "calendar" as const,
    color: "#3B82F6", // Blue - time, progress
  },
  {
    key: "checkin_count" as const,
    icon: "flag" as const,
    color: "#F59E0B", // Amber - achievement, target
  },
] as const;

// Valid categories - hydration is a tracking_type, not a category
const VALID_CATEGORY_KEYS = [
  "fitness",
  "nutrition",
  "wellness",
  "mindfulness",
  "sleep",
];

// Sanitize category - fix common AI mistakes
// "hydration" is a tracking_type, not a category - it should be under "nutrition"
const sanitizeChallengeCategory = (
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

  // If category is "hydration" or it's clearly a hydration goal, use "nutrition"
  if (
    categoryLower === "hydration" ||
    (isHydrationGoal && !VALID_CATEGORY_KEYS.includes(categoryLower))
  ) {
    return "nutrition";
  }

  // If category is valid, use it
  if (VALID_CATEGORY_KEYS.includes(categoryLower)) {
    return categoryLower;
  }

  // Default to fitness
  return "fitness";
};

export interface ChallengeFormProps {
  initialData?: {
    title?: string;
    description?: string;
    category?: string;
    frequency?: "daily" | "weekly";
    target_days?: number;
    days_of_week?: number[];
    reminder_times?: string[];
    duration_days?: number;
    target_checkins?: number;
  };
}

export function ChallengeForm({ initialData }: ChallengeFormProps) {
  // Calculate dates
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const tomorrow = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d;
  }, [today]);

  const dayAfterTomorrow = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 2);
    return d;
  }, [today]);

  // Form state - initialize from initialData if available
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(
    initialData?.description || "",
  );
  const [category, setCategory] = useState(() =>
    initialData?.category
      ? sanitizeChallengeCategory(
          initialData.category,
          initialData.title,
          initialData.description,
        )
      : "fitness",
  );
  const [frequency, setFrequency] = useState<"daily" | "weekly">(
    initialData?.frequency || "weekly",
  );
  const [targetDays, setTargetDays] = useState(
    initialData?.target_days ? String(initialData.target_days) : "4",
  );
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    initialData?.days_of_week || [1, 3, 5],
  );
  const [reminderTimes, setReminderTimes] = useState<string[]>(
    initialData?.reminder_times || [],
  );
  const [isCreating, setIsCreating] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedTime, setSelectedTime] = useState<Date>(new Date());

  // Challenge type (streak = time challenge, checkin_count = target challenge)
  const [challengeType, setChallengeType] = useState<
    "streak" | "checkin_count"
  >("streak");

  // Challenge duration (for streak/time challenges)
  const [challengeDuration, setChallengeDuration] = useState(30);
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [customDurationValue, setCustomDurationValue] = useState("");
  const [challengeDurationError, setChallengeDurationError] = useState<
    string | null
  >(null);

  // Target check-ins (for checkin_count/target challenges)
  const [targetCheckins, setTargetCheckins] = useState(50);
  const [isCustomTarget, setIsCustomTarget] = useState(false);
  const [customTargetValue, setCustomTargetValue] = useState("");
  const [targetCheckinsError, setTargetCheckinsError] = useState<string | null>(
    null,
  );

  // Visibility
  const [isPublic, setIsPublic] = useState(true);

  // Date pickers
  const [joinDeadline, setJoinDeadline] = useState<Date>(tomorrow);
  const [startDate, setStartDate] = useState<Date>(dayAfterTomorrow);

  // Max participants (null = unlimited)
  const [hasMaxParticipants, setHasMaxParticipants] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState("");

  // Validation errors
  const [titleError, setTitleError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [frequencyError, setFrequencyError] = useState<string | null>(null);
  const [targetDaysError, setTargetDaysError] = useState<string | null>(null);
  const [daysOfWeekError, setDaysOfWeekError] = useState<string | null>(null);
  const [reminderTimesError, setReminderTimesError] = useState<string | null>(
    null,
  );
  const [dateErrors, setDateErrors] = useState<{
    joinDeadline?: string;
    startDate?: string;
  }>({});

  const { t } = useTranslation();
  const styles = useStyles(makeChallengeFormStyles);
  const { colors, brandColors } = useTheme();
  const createChallenge = useCreateChallenge();
  const { showAlert, showToast } = useAlertModal();

  // Pre-fill form when initialData changes
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || "");
      setDescription(initialData.description || "");
      setCategory(
        sanitizeChallengeCategory(
          initialData.category,
          initialData.title,
          initialData.description,
        ),
      );
      setFrequency(initialData.frequency || "weekly");
      setTargetDays(String(initialData.target_days || 4));
      setDaysOfWeek(initialData.days_of_week || [1, 3, 5]);
      setReminderTimes(initialData.reminder_times || []);
      if (initialData.duration_days) {
        setChallengeDuration(initialData.duration_days);
        if (![30, 60, 90].includes(initialData.duration_days)) {
          setIsCustomDuration(true);
          setCustomDurationValue(String(initialData.duration_days));
        }
      }
      if (initialData.target_checkins) {
        setTargetCheckins(initialData.target_checkins);
        setChallengeType("checkin_count");
        if (![25, 50, 75, 100].includes(initialData.target_checkins)) {
          setIsCustomTarget(true);
          setCustomTargetValue(String(initialData.target_checkins));
        }
      }
    }
  }, [initialData]);

  // Calculate minimum start date based on join deadline
  const minStartDate = useMemo(() => {
    const d = new Date(joinDeadline);
    d.setDate(d.getDate() + 1);
    return d;
  }, [joinDeadline]);

  // Calculate effective duration based on challenge type
  // For streak: use selected duration
  // For target: calculate from target check-ins and frequency
  const effectiveDuration = useMemo(() => {
    if (challengeType === "streak") {
      return challengeDuration;
    }

    // For target challenges: calculate how many days needed to reach target
    const checkinsPerWeek = frequency === "daily" ? 7 : daysOfWeek.length;
    if (checkinsPerWeek === 0) return 30; // Fallback

    const weeksNeeded = Math.ceil(targetCheckins / checkinsPerWeek);
    return weeksNeeded * 7;
  }, [challengeType, challengeDuration, targetCheckins, frequency, daysOfWeek]);

  // Calculate end date based on start date + effective duration
  const endDate = useMemo(() => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + effectiveDuration - 1);
    return d;
  }, [startDate, effectiveDuration]);

  // Format date for display
  const formatDateForDisplay = (date: Date): string => {
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Calculate achievability metrics
  const achievabilityMetrics = useMemo(() => {
    const checkinsPerWeek = frequency === "daily" ? 7 : daysOfWeek.length;
    const totalWeeks = Math.ceil(effectiveDuration / 7);
    const maxPossibleCheckins = checkinsPerWeek * totalWeeks;

    // For target challenges: calculate weeks needed
    const weeksToReachTarget =
      checkinsPerWeek > 0 ? Math.ceil(targetCheckins / checkinsPerWeek) : 0;
    const daysToReachTarget = weeksToReachTarget * 7;

    return {
      checkinsPerWeek,
      totalWeeks,
      maxPossibleCheckins,
      weeksToReachTarget,
      daysToReachTarget,
      // For target challenges, it's always achievable since we calculate duration from target
      isTargetAchievable:
        challengeType === "checkin_count"
          ? true
          : targetCheckins <= maxPossibleCheckins,
    };
  }, [frequency, daysOfWeek, effectiveDuration, targetCheckins, challengeType]);

  const formatTime = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const formatDateForAPI = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleTimePickerChange = async (event: any, date?: Date) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
      if (event.type === "set" && date) {
        const timeString = formatTime(date);
        if (reminderTimes.includes(timeString)) {
          await showAlert({
            title: t("common.error"),
            message: "This time is already added",
            variant: "error",
            confirmLabel: t("common.ok"),
          });
          return;
        }
        setReminderTimes((prev) => {
          const newTimes = [...prev, timeString].sort();
          // Re-validate after addition
          const error = validateReminderTimes(newTimes);
          setReminderTimesError(error);
          return newTimes;
        });
      }
    } else if (Platform.OS === "ios" && date) {
      setSelectedTime(date);
    }
  };

  const handleRemoveReminderTime = (time: string) => {
    setReminderTimes((prev) => {
      const newTimes = prev.filter((t) => t !== time);
      // Re-validate after removal
      const error = validateReminderTimes(newTimes);
      setReminderTimesError(error);
      return newTimes;
    });
  };

  const handleFrequencyChange = (value: "daily" | "weekly") => {
    setFrequency(value);
    setFrequencyError(null);

    if (value === "daily") {
      setDaysOfWeek([]);
      setTargetDays("7");
      setDaysOfWeekError(null);
    } else if (value === "weekly") {
      // Set default weekly selection if none exists
      if (daysOfWeek.length === 0) {
        const defaultDays = [1, 3, 5]; // Mon, Wed, Fri
        setDaysOfWeek(defaultDays);
        setTargetDays(String(defaultDays.length));
      } else {
        // Target days = currently selected days count
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
        // Add day (no limit - target days will be set from selection)
        newDays = [...prev, dayValue].sort((a, b) => a - b);
      }

      // Auto-update target days based on selection
      setTargetDays(String(newDays.length));

      // Validate after change
      const error = validateDaysOfWeek(newDays, frequency, newDays.length);
      setDaysOfWeekError(error);

      return newDays;
    });
  };

  // Handle join deadline change
  const handleJoinDeadlineChange = (date: Date) => {
    setJoinDeadline(date);
    // Auto-adjust start date if needed
    const minStart = new Date(date);
    minStart.setDate(minStart.getDate() + 1);
    if (startDate < minStart) {
      setStartDate(minStart);
    }
    setDateErrors((prev) => ({ ...prev, joinDeadline: undefined }));
  };

  // Handle start date change
  const handleStartDateChange = (date: Date) => {
    setStartDate(date);
    setDateErrors((prev) => ({ ...prev, startDate: undefined }));
  };

  // Validate dates
  const validateDates = (): boolean => {
    const newErrors: { joinDeadline?: string; startDate?: string } = {};

    if (joinDeadline < today) {
      newErrors.joinDeadline = "Join deadline cannot be in the past";
    }

    if (startDate <= today) {
      newErrors.startDate = "Start date must be in the future";
    }

    const oneDayAfterJoin = new Date(joinDeadline);
    oneDayAfterJoin.setDate(oneDayAfterJoin.getDate() + 1);

    if (startDate < oneDayAfterJoin) {
      newErrors.startDate =
        "Start date must be at least 1 day after join deadline";
    }

    setDateErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Validate all fields - consistent with CustomGoalForm validation
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

    // Validate target days (for weekly)
    const targetDaysNum = parseInt(targetDays, 10) || 4;
    if (frequency === "weekly") {
      const targetDaysErr = validateTargetDays(targetDays);
      setTargetDaysError(targetDaysErr);
      if (targetDaysErr) isValid = false;
    }

    // Validate days of week for weekly
    const daysErr = validateDaysOfWeek(daysOfWeek, frequency, targetDaysNum);
    setDaysOfWeekError(daysErr);
    if (daysErr) isValid = false;

    // Validate reminder times format
    const reminderTimesErr = validateReminderTimes(reminderTimes);
    setReminderTimesError(reminderTimesErr);
    if (reminderTimesErr) isValid = false;

    // Date validation (challenge-specific)
    if (!validateDates()) {
      isValid = false;
    }

    // Challenge type specific validation
    if (challengeType === "streak") {
      const durationErr = validateChallengeDuration(
        challengeDuration,
        challengeType,
      );
      setChallengeDurationError(durationErr);
      if (durationErr) isValid = false;
    } else {
      const targetErr = validateTargetCheckins(
        targetCheckins,
        daysOfWeek,
        frequency,
        challengeDuration,
        reminderTimes,
      );
      setTargetCheckinsError(targetErr);
      if (targetErr) isValid = false;
    }

    return isValid;
  };

  const handleCreateChallenge = async () => {
    if (!validateAllFields()) {
      await showAlert({
        title: t("common.error"),
        message: "Please fix the errors in the form",
        variant: "error",
        confirmLabel: t("common.ok"),
      });
      return;
    }

    try {
      setIsCreating(true);

      const targetDaysNum = parseInt(targetDays, 10) || 4;

      const result = await createChallenge.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        challenge_type: challengeType,
        duration_days: effectiveDuration, // Use calculated duration for target challenges
        start_date: formatDateForAPI(startDate),
        end_date: formatDateForAPI(endDate),
        join_deadline: formatDateForAPI(joinDeadline),
        is_public: isPublic,
        max_participants: hasMaxParticipants
          ? parseInt(maxParticipants, 10) || undefined
          : undefined,
        category: category,
        frequency: frequency,
        target_days: frequency === "daily" ? 7 : targetDaysNum,
        target_checkins:
          challengeType === "checkin_count" ? targetCheckins : undefined,
        days_of_week: frequency === "weekly" ? daysOfWeek : undefined,
        reminder_times: reminderTimes.length > 0 ? reminderTimes : undefined,
      });

      showToast({
        title: t("common.success"),
        message: t("challenges.create_success") || "Challenge created!",
        variant: "success",
      });

      // Navigate to Goals screen to see the new challenge
      router.replace(MOBILE_ROUTES.GOALS.LIST);
    } catch (error: any) {
      logger.error("Failed to create challenge", { error: String(error) });
      await showAlert({
        title: t("common.error"),
        message:
          error?.message ||
          t("challenges.create_error") ||
          "Failed to create challenge",
        variant: "error",
        confirmLabel: t("common.ok"),
      });
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
          label={`${t("challenges.form.title") || "Challenge Title"} *`}
          value={title}
          onChangeText={(v) => {
            setTitle(v);
            setTitleError(null);
          }}
          placeholder={
            t("challenges.form.title_placeholder") ||
            "e.g., 30-Day Fitness Challenge"
          }
          maxLength={100}
          error={titleError || undefined}
          containerStyle={styles.inputGroup}
        />

        {/* Description Input */}
        <TextInput
          label={t("challenges.form.description") || "Description"}
          value={description}
          onChangeText={setDescription}
          placeholder={
            t("challenges.form.description_placeholder") ||
            "What is this challenge about?"
          }
          multiline
          numberOfLines={3}
          maxLength={500}
          containerStyle={styles.inputGroup}
        />

        {/* Challenge Type Selection - Apple-style cards */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            {t("challenges.form.challenge_type") || "Challenge Type"} *
          </Text>
          <View style={styles.challengeTypeContainer}>
            {CHALLENGE_TYPES.map((type) => {
              const isSelected = challengeType === type.key;
              const labelKey =
                type.key === "streak" ? "time_challenge" : "target_challenge";
              return (
                <TouchableOpacity
                  key={type.key}
                  onPress={() => setChallengeType(type.key)}
                  activeOpacity={0.7}
                  style={[
                    styles.challengeTypeCard,
                    isSelected && {
                      borderColor: type.color,
                      backgroundColor: type.color + "08",
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.challengeTypeIconContainer,
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
                  <View style={styles.challengeTypeTextContainer}>
                    <Text
                      style={[
                        styles.challengeTypeLabel,
                        isSelected && { color: type.color },
                      ]}
                    >
                      {t(`goals.create.form.goal_type_${labelKey}`) ||
                        (type.key === "streak"
                          ? "Time Challenge"
                          : "Target Challenge")}
                    </Text>
                    <Text style={styles.challengeTypeDescription}>
                      {t(`goals.create.form.goal_type_${labelKey}_desc`) ||
                        (type.key === "streak"
                          ? "30, 60, or 90 days"
                          : "Hit your target")}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.challengeTypeCheckCircle,
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

        {/* Duration - Only for streak/time challenges */}
        {challengeType === "streak" && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {t("challenges.form.duration") || "Challenge Duration (days)"} *
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

            {isCustomDuration && (
              <TextInput
                label={t("challenges.form.custom_duration") || "Custom (days)"}
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

            {challengeDurationError && !isCustomDuration && (
              <Text style={styles.errorText}>{challengeDurationError}</Text>
            )}
          </View>
        )}

        {/* Target Check-ins - Only for checkin_count/target challenges */}
        {challengeType === "checkin_count" && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {t("challenges.form.target_checkins") || "Target Check-ins"} *
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

            {isCustomTarget && (
              <TextInput
                label={t("challenges.form.custom_target") || "Custom target"}
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

            {targetCheckinsError && !isCustomTarget && (
              <Text style={styles.errorText}>{targetCheckinsError}</Text>
            )}

            <Text style={styles.helperText}>
              {t("challenges.form.target_description") ||
                "Complete when you reach this number of check-ins"}
            </Text>
          </View>
        )}

        {/* Category Selection */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            {t("challenges.form.category") || "Category"} *
          </Text>
          <View style={styles.optionsGrid}>
            {CATEGORIES.map((cat) => {
              const isDisabled = !!initialData && category !== cat.key;
              return (
                <Button
                  key={cat.key}
                  title={cat.label}
                  onPress={() => {
                    if (!initialData) {
                      setCategory(cat.key);
                      setCategoryError(null);
                    }
                  }}
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
                "Category selected by AI based on your challenge"}
            </Text>
          )}
          {categoryError && (
            <Text style={styles.errorText}>{categoryError}</Text>
          )}
        </View>

        {/* Frequency Selection */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            {t("challenges.form.frequency") || "Check-in Frequency"} *
          </Text>
          <View style={styles.optionsGrid}>
            {FREQUENCIES.map((freq) => (
              <Button
                key={freq.key}
                title={freq.label}
                onPress={() => {
                  handleFrequencyChange(freq.key as "daily" | "weekly");
                  setFrequencyError(null);
                }}
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

        {/* Days of Week Selector - for weekly */}
        {frequency === "weekly" && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {t("challenges.form.days_of_week") || "Select Days"} *
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

        {/* Schedule Section */}
        <View style={styles.inputGroup}>
          <Text style={styles.sectionTitle}>
            {t("challenges.form.schedule") || "Challenge Schedule"}
          </Text>

          <DatePicker
            value={joinDeadline}
            onChange={handleJoinDeadlineChange}
            label={t("challenges.form.join_deadline") || "Join Deadline"}
            description={
              t("challenges.form.join_deadline_desc") ||
              "Last day friends can join the challenge"
            }
            minimumDate={today}
            error={dateErrors.joinDeadline}
          />

          <DatePicker
            value={startDate}
            onChange={handleStartDateChange}
            label={t("challenges.form.start_date") || "Start Date"}
            description={
              t("challenges.form.start_date_desc") ||
              "When the challenge begins"
            }
            minimumDate={minStartDate}
            error={dateErrors.startDate}
          />

          {/* End Date Display (computed) */}
          <View style={styles.endDateDisplay}>
            <View style={styles.endDateRow}>
              <Ionicons
                name="flag-outline"
                size={18}
                color={colors.text.secondary}
              />
              <View style={styles.endDateInfo}>
                <Text style={styles.endDateLabel}>
                  {t("challenges.form.end_date") || "End Date"}
                </Text>
                <Text style={styles.endDateValue}>
                  {formatDateForDisplay(endDate)}
                </Text>
              </View>
            </View>
            <Text style={styles.endDateHelper}>
              {challengeType === "checkin_count"
                ? `Based on ${targetCheckins} check-ins at ${frequency === "daily" ? 7 : daysOfWeek.length}/week (~${effectiveDuration} days)`
                : `Start date + ${challengeDuration} days`}
            </Text>
          </View>

          {/* Achievability Summary */}
          <View style={styles.achievabilitySummary}>
            <View style={styles.achievabilityRow}>
              <Ionicons
                name="calendar-outline"
                size={16}
                color={colors.text.tertiary}
              />
              <Text style={styles.achievabilityText}>
                {`${achievabilityMetrics.totalWeeks} weeks • ${achievabilityMetrics.checkinsPerWeek} check-ins/week`}
              </Text>
            </View>
            {challengeType === "streak" && (
              <View style={styles.achievabilityRow}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={16}
                  color={colors.text.tertiary}
                />
                <Text style={styles.achievabilityText}>
                  {`Max possible: ${achievabilityMetrics.maxPossibleCheckins} check-ins`}
                </Text>
              </View>
            )}
            {challengeType === "checkin_count" && (
              <View style={styles.achievabilityRow}>
                <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                <Text style={styles.achievabilityText}>
                  {`${targetCheckins} check-ins in ~${achievabilityMetrics.weeksToReachTarget} weeks (${effectiveDuration} days)`}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Reminder Times */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            {t("challenges.form.reminder_times") || "Reminder Times"}
          </Text>
          <Text style={styles.helperText}>
            {t("challenges.form.reminder_times_helper") ||
              "Set times when participants should be reminded."}
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

          <Button
            title={t("challenges.form.add_time") || "Add Time"}
            onPress={() => setShowTimePicker(true)}
            variant="outline"
            size="md"
          />

          {/* Time Picker */}
          {showTimePicker && Platform.OS === "ios" && (
            <Modal
              visible={showTimePicker}
              onClose={() => setShowTimePicker(false)}
              title="Select Time"
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
                    style={{ flex: 1, marginRight: 8 }}
                  />
                  <Button
                    title={t("common.done")}
                    onPress={() => {
                      const timeString = formatTime(selectedTime);
                      if (!reminderTimes.includes(timeString)) {
                        setReminderTimes((prev) => {
                          const newTimes = [...prev, timeString].sort();
                          // Re-validate after addition
                          const error = validateReminderTimes(newTimes);
                          setReminderTimesError(error);
                          return newTimes;
                        });
                      }
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

        {/* Max Participants */}
        <View style={styles.inputGroup}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <View style={styles.toggleIconContainer}>
                <Ionicons
                  name="people-outline"
                  size={20}
                  color={colors.text.secondary}
                />
              </View>
              <View style={styles.toggleText}>
                <Text style={styles.toggleLabel}>
                  {t("challenges.form.limit_participants") ||
                    "Limit Participants"}
                </Text>
                <Text style={styles.toggleDescription}>
                  {hasMaxParticipants
                    ? t("challenges.form.limited_spots") ||
                      "Set maximum number of participants"
                    : t("challenges.form.unlimited") ||
                      "Anyone can join (unlimited)"}
                </Text>
              </View>
            </View>
            <Switch
              value={hasMaxParticipants}
              onValueChange={setHasMaxParticipants}
              trackColor={{
                false: colors.bg.muted,
                true: brandColors.primary + "40",
              }}
              thumbColor={
                hasMaxParticipants ? brandColors.primary : colors.bg.surface
              }
            />
          </View>

          {hasMaxParticipants && (
            <TextInput
              label={
                t("challenges.form.max_participants") || "Maximum Participants"
              }
              value={maxParticipants}
              onChangeText={(value) => {
                const numericValue = value.replace(/[^0-9]/g, "");
                setMaxParticipants(numericValue);
              }}
              placeholder="e.g., 50"
              keyboardType="numeric"
              containerStyle={{ marginTop: 12 }}
            />
          )}
        </View>

        {/* Public/Private Toggle */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            {t("challenges.form.visibility") || "Visibility"}
          </Text>
          <View style={styles.optionsGrid}>
            <Button
              title={t("challenges.public") || "Public"}
              onPress={() => setIsPublic(true)}
              variant={isPublic ? "primary" : "outline"}
              size="sm"
              borderRadius="lg"
              style={styles.optionButton}
              leftIcon="globe-outline"
            />
            <Button
              title={t("challenges.private") || "Private"}
              onPress={() => setIsPublic(false)}
              variant={!isPublic ? "primary" : "outline"}
              size="sm"
              borderRadius="lg"
              style={styles.optionButton}
              leftIcon="lock-closed-outline"
            />
          </View>
          <Text style={styles.helperText}>
            {isPublic
              ? t("challenges.public_desc") ||
                "Anyone can discover and join this challenge."
              : t("challenges.private_desc") ||
                "Only people you invite can join."}
          </Text>
        </View>
      </ScrollView>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title={t("challenges.create_button") || "Create Challenge"}
          onPress={handleCreateChallenge}
          disabled={isCreating || !title.trim()}
          loading={isCreating}
          variant="primary"
          size="lg"
          fullWidth
        />
      </View>
    </>
  );
}

const makeChallengeFormStyles = (tokens: any, colors: any, brand: any) => {
  return {
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: toRN(tokens.spacing[6]),
      paddingBottom: toRN(tokens.spacing[6]),
      paddingTop: toRN(tokens.spacing[4]),
    },
    inputGroup: {
      marginBottom: toRN(tokens.spacing[6]),
    },
    label: {
      fontSize: toRN(tokens.typography.fontSize.base),
      fontWeight: tokens.typography.fontWeight.semibold,
      color: colors.text.primary,
      marginBottom: toRN(tokens.spacing[1]),
      fontFamily: fontFamily.groteskSemiBold,
    },
    sectionTitle: {
      fontSize: toRN(tokens.typography.fontSize.xs),
      fontFamily: fontFamily.groteskSemiBold,
      color: colors.text.tertiary,
      textTransform: "uppercase" as const,
      letterSpacing: 0.5,
      marginBottom: toRN(tokens.spacing[3]),
    },
    helperText: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.text.secondary,
      marginBottom: toRN(tokens.spacing[1]),
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
    disabledOption: {
      opacity: 0.4,
    },
    // Challenge type cards (like goal type in CustomGoalForm)
    challengeTypeContainer: {
      gap: toRN(tokens.spacing[3]),
    },
    challengeTypeCard: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      padding: toRN(tokens.spacing[4]),
      borderRadius: toRN(tokens.borderRadius.xl),
      borderWidth: 2,
      borderColor: colors.border.default,
      backgroundColor: colors.bg.surface,
    },
    challengeTypeIconContainer: {
      width: toRN(44),
      height: toRN(44),
      borderRadius: toRN(tokens.borderRadius.lg),
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginRight: toRN(tokens.spacing[3]),
    },
    challengeTypeTextContainer: {
      flex: 1,
    },
    challengeTypeLabel: {
      fontSize: toRN(tokens.typography.fontSize.base),
      fontFamily: fontFamily.groteskSemiBold,
      color: colors.text.primary,
      marginBottom: toRN(tokens.spacing[0.5] || 2),
    },
    challengeTypeDescription: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      fontFamily: fontFamily.groteskRegular,
      color: colors.text.tertiary,
    },
    challengeTypeCheckCircle: {
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
    // Toggle row styles (for max participants)
    toggleRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      padding: toRN(tokens.spacing[3]),
      backgroundColor: colors.bg.muted,
      borderRadius: toRN(tokens.borderRadius.lg),
    },
    toggleInfo: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: toRN(tokens.spacing[3]),
      flex: 1,
    },
    toggleIconContainer: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.bg.surface,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    toggleText: {
      flex: 1,
    },
    toggleLabel: {
      fontSize: toRN(tokens.typography.fontSize.base),
      fontFamily: fontFamily.groteskMedium,
      color: colors.text.primary,
    },
    toggleDescription: {
      fontSize: toRN(tokens.typography.fontSize.xs),
      fontFamily: fontFamily.groteskRegular,
      color: colors.text.tertiary,
      marginTop: 2,
    },
    // End date display styles
    endDateDisplay: {
      backgroundColor: colors.bg.muted,
      borderRadius: toRN(tokens.borderRadius.lg),
      padding: toRN(tokens.spacing[4]),
      marginTop: toRN(tokens.spacing[3]),
    },
    endDateRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: toRN(tokens.spacing[3]),
    },
    endDateInfo: {
      flex: 1,
    },
    endDateLabel: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      fontFamily: fontFamily.groteskMedium,
      color: colors.text.secondary,
    },
    endDateValue: {
      fontSize: toRN(tokens.typography.fontSize.base),
      fontFamily: fontFamily.groteskSemiBold,
      color: colors.text.primary,
      marginTop: 2,
    },
    endDateHelper: {
      fontSize: toRN(tokens.typography.fontSize.xs),
      fontFamily: fontFamily.groteskRegular,
      color: colors.text.tertiary,
      marginTop: toRN(tokens.spacing[2]),
    },
    // Achievability summary styles
    achievabilitySummary: {
      backgroundColor: colors.bg.muted,
      borderRadius: toRN(tokens.borderRadius.lg),
      padding: toRN(tokens.spacing[3]),
      marginTop: toRN(tokens.spacing[3]),
      gap: toRN(tokens.spacing[2]),
    },
    achievabilityRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: toRN(tokens.spacing[2]),
    },
    achievabilityText: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      fontFamily: fontFamily.groteskRegular,
      color: colors.text.secondary,
      flex: 1,
    },
    actions: {
      paddingHorizontal: toRN(tokens.spacing[6]),
      paddingTop: toRN(tokens.spacing[4]),
      paddingBottom: toRN(tokens.spacing[4]),
      backgroundColor: colors.bg.canvas,
      borderTopWidth: 1,
      borderTopColor: colors.border.default,
    },
  };
};
