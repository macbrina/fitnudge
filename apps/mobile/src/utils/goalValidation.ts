/**
 * Shared validation utilities for Goals and Challenges
 *
 * Both CustomGoalForm and ChallengeForm use these validators
 * to ensure consistent validation across the app.
 */

// =============================================================================
// SHARED CONSTANTS
// =============================================================================

// Valid categories based on API requirements
export const VALID_CATEGORIES = [
  "fitness",
  "nutrition",
  "wellness",
  "mindfulness",
  "sleep",
] as const;

// Valid frequencies based on API requirements
export const VALID_FREQUENCIES = ["daily", "weekly"] as const;

export type ValidCategory = (typeof VALID_CATEGORIES)[number];
export type ValidFrequency = (typeof VALID_FREQUENCIES)[number];

// Category options for UI display
export const CATEGORIES = [
  { key: "fitness", label: "Fitness" },
  { key: "nutrition", label: "Nutrition" },
  { key: "wellness", label: "Wellness" },
  { key: "mindfulness", label: "Mindfulness" },
  { key: "sleep", label: "Sleep" },
] as const;

// Frequency options for UI display
export const FREQUENCIES = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
] as const;

// Days of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
export const DAYS_OF_WEEK = [
  { value: 0, label: "Sun", short: "S" },
  { value: 1, label: "Mon", short: "M" },
  { value: 2, label: "Tue", short: "T" },
  { value: 3, label: "Wed", short: "W" },
  { value: 4, label: "Thu", short: "T" },
  { value: 5, label: "Fri", short: "F" },
  { value: 6, label: "Sat", short: "S" },
] as const;

// Challenge duration options (for time challenges)
// -1 indicates custom input
export const CHALLENGE_DURATIONS = [
  { value: 30, label: "30" },
  { value: 60, label: "60" },
  { value: 90, label: "90" },
  { value: -1, label: "Custom" },
] as const;

// Target check-in options (for target challenges)
// -1 indicates custom input
export const TARGET_OPTIONS = [
  { value: 25, label: "25" },
  { value: 50, label: "50" },
  { value: 75, label: "75" },
  { value: 100, label: "100" },
  { value: -1, label: "Custom" },
] as const;

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validate time format (HH:MM in 24-hour format)
 */
export const isValidTimeFormat = (time: string): boolean => {
  const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
  return timeRegex.test(time);
};

/**
 * Validate title
 * - Required
 * - Minimum 3 characters
 * - Maximum 100 characters
 */
export const validateTitle = (value: string): string | null => {
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

/**
 * Validate category
 * - Must be one of the valid categories
 */
export const validateCategory = (value: string): string | null => {
  if (!value || !VALID_CATEGORIES.includes(value as ValidCategory)) {
    return "Please select a valid category";
  }
  return null;
};

/**
 * Validate frequency
 * - Must be "daily" or "weekly"
 */
export const validateFrequency = (value: string): string | null => {
  if (!value || !VALID_FREQUENCIES.includes(value as ValidFrequency)) {
    return "Please select a valid frequency";
  }
  return null;
};

/**
 * Validate target days (days per week)
 * - Required
 * - Must be a number between 1 and 7
 */
export const validateTargetDays = (value: string): string | null => {
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

/**
 * Validate days of week selection
 * - For weekly frequency: at least one day required
 * - Cannot select more days than target days
 * - All day values must be valid (0-6)
 */
export const validateDaysOfWeek = (
  days: number[],
  frequency: string,
  _targetDays?: number, // No longer used - kept for backward compatibility
): string | null => {
  if (frequency === "weekly") {
    if (days.length === 0) {
      return "Please select at least one day";
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

/**
 * Validate reminder times array
 * - All times must be in HH:MM format
 */
export const validateReminderTimes = (times: string[]): string | null => {
  for (const time of times) {
    if (!isValidTimeFormat(time)) {
      return `Invalid time format: ${time}. Use HH:MM format (e.g., 06:00)`;
    }
  }
  return null;
};

/**
 * Validate challenge duration
 * - Must be greater than 0
 * - Minimum 7 days
 * - Maximum 365 days
 *
 * @param duration - Duration in days
 * @param goalType - Optional goal type. If provided and not "time_challenge" or "streak", returns null (no validation needed)
 */
export const validateChallengeDuration = (
  duration: number,
  goalType?: string,
): string | null => {
  // Skip validation if goalType is provided and is not a time-based challenge
  if (goalType && goalType !== "time_challenge" && goalType !== "streak") {
    return null;
  }

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

/**
 * Validate target check-ins for target challenges
 * For target challenges, duration is calculated from target + frequency,
 * so we just need basic validation.
 *
 * @param targetCheckins - Target number of check-ins
 * @param daysOfWeek - Selected days (for weekly frequency)
 * @param frequency - "daily" or "weekly"
 * @param _challengeDuration - Duration in days (unused - kept for API compatibility)
 * @param _reminderTimes - Reminder times (unused - kept for API compatibility)
 */
export const validateTargetCheckins = (
  targetCheckins: number,
  daysOfWeek: number[],
  frequency: string,
  _challengeDuration: number,
  _reminderTimes: string[],
): string | null => {
  if (targetCheckins <= 0) {
    return "Target check-ins must be greater than 0";
  }

  if (targetCheckins > 1000) {
    return "Target check-ins seems too high. Consider a smaller goal.";
  }

  // For weekly frequency, ensure at least 1 day is selected
  if (frequency === "weekly" && daysOfWeek.length === 0) {
    return "Please select at least one day for weekly check-ins";
  }

  return null;
};

/**
 * Calculate maximum achievable check-ins
 * Useful for displaying hints to users
 */
export const calculateMaxCheckins = (
  daysOfWeek: number[],
  frequency: string,
  challengeDuration: number,
  reminderTimes: string[],
): number => {
  const numReminderTimes = Math.max(1, reminderTimes.length);

  if (frequency === "weekly" && daysOfWeek.length > 0) {
    const workoutDaysPerWeek = daysOfWeek.length;
    const weeks = Math.ceil(challengeDuration / 7);
    return workoutDaysPerWeek * weeks * numReminderTimes;
  } else {
    return challengeDuration * numReminderTimes;
  }
};
