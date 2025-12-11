import { fromZonedTime, toZonedTime } from "date-fns-tz";

/**
 * Calculate the relative luminance of a color using WCAG formula
 * @param hex - Hex color string (e.g., "#FF5733" or "FF5733")
 * @returns Relative luminance value between 0 (darkest) and 1 (lightest)
 */
export const getColorLuminance = (hex: string): number => {
  // Remove # if present
  const cleanHex = hex.replace("#", "");

  // Parse RGB values
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  // Apply gamma correction (WCAG formula)
  const rsRGB = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const gsRGB = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const bsRGB = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

  // Calculate relative luminance
  return 0.2126 * rsRGB + 0.7152 * gsRGB + 0.0722 * bsRGB;
};

/**
 * Calculate the average luminance of a gradient
 * @param colors - Array of hex color strings
 * @returns Average luminance value between 0 and 1
 */
export const getGradientAverageLuminance = (colors: string[]): number => {
  if (!colors || colors.length === 0) return 0.5;

  const luminances = colors.map((color) => getColorLuminance(color));
  const average =
    luminances.reduce((sum, lum) => sum + lum, 0) / luminances.length;

  return average;
};

/**
 * Get contrasting text color (black or white) based on background luminance
 * @param backgroundColors - Array of hex color strings for gradient
 * @returns "#000000" for light backgrounds, "#FFFFFF" for dark backgrounds
 */
export const getContrastingTextColor = (backgroundColors: string[]): string => {
  const avgLuminance = getGradientAverageLuminance(backgroundColors);

  // WCAG recommendation: Use dark text on light backgrounds (luminance > 0.5)
  // Use light text on dark backgrounds (luminance <= 0.5)
  return avgLuminance > 0.5 ? "#000000" : "#FFFFFF";
};

/**
 * Convert reminder time from user's timezone to device's local timezone
 * This ensures reminders fire at the correct time relative to the user's timezone,
 * regardless of where their device is located.
 */
export const convertTimeToDeviceTimezone = (
  reminderTime: string,
  userTimezone: string
): { hours: number; minutes: number } => {
  // Parse reminder time (HH:MM format)
  const [userHours, userMinutes] = reminderTime.split(":").map(Number);

  // Get device's local timezone
  const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // If timezones are the same, no conversion needed
  if (userTimezone === deviceTimezone) {
    return { hours: userHours, minutes: userMinutes };
  }

  try {
    // Get today's date components
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const day = today.getDate();

    // Create a date object representing today at the reminder time in local device time
    // fromZonedTime will interpret this date as if it represents local time in the user's timezone
    const dateAsUserLocal = new Date(
      year,
      month,
      day,
      userHours,
      userMinutes,
      0
    );

    // fromZonedTime: Treats the date as if it represents local time in userTimezone,
    // and returns a Date object representing the same moment in UTC
    const utcDate = fromZonedTime(dateAsUserLocal, userTimezone);

    // toZonedTime: Takes a UTC Date and returns a Date that when formatted
    // in deviceTimezone shows the correct local time
    const deviceLocalDate = toZonedTime(utcDate, deviceTimezone);

    // Extract hours and minutes from device local time
    const deviceHours = deviceLocalDate.getHours();
    const deviceMinutes = deviceLocalDate.getMinutes();

    return {
      hours: deviceHours,
      minutes: deviceMinutes,
    };
  } catch (error) {
    console.error(
      "Error converting timezone, using original time:",
      error,
      `User timezone: ${userTimezone}, Device timezone: ${deviceTimezone}, Reminder time: ${reminderTime}`
    );
    // Fallback to original time if conversion fails
    return { hours: userHours, minutes: userMinutes };
  }
};

/**
 * Format a date string or Date object to a readable format (e.g., "Jan 15, 2024")
 * @param date - Date string or Date object
 * @param format - Format type: "short" (Jan 15, 2024) or "long" (January 15, 2024)
 * @returns Formatted date string
 */
export const formatDate = (
  date: string | Date,
  format: "short" | "long" = "short"
): string => {
  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) {
      return ""; // Invalid date
    }

    const options: Intl.DateTimeFormatOptions =
      format === "short"
        ? {
            year: "numeric",
            month: "short",
            day: "numeric",
          }
        : {
            year: "numeric",
            month: "long",
            day: "numeric",
          };

    return new Intl.DateTimeFormat("en-US", options).format(dateObj);
  } catch (error) {
    console.error("Error formatting date:", error);
    return "";
  }
};

/**
 * Format a date to relative time (e.g., "2 minutes ago", "5 hours ago", "3 days ago")
 * This is a replacement for date-fns formatDistanceToNow
 * @param date - Date string or Date object
 * @param options - Options for formatting
 * @returns Formatted relative time string
 */
export const formatTimeAgo = (
  date: string | Date,
  options?: { addSuffix?: boolean }
): string => {
  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) {
      return ""; // Invalid date
    }

    const now = new Date();
    const diffInSeconds = Math.floor(
      (now.getTime() - dateObj.getTime()) / 1000
    );

    // Handle future dates
    if (diffInSeconds < 0) {
      return options?.addSuffix ? "in the future" : "future";
    }

    // Less than a minute
    if (diffInSeconds < 60) {
      return options?.addSuffix ? "just now" : "now";
    }

    // Less than an hour
    if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      const text = minutes === 1 ? "1 minute" : `${minutes} minutes`;
      return options?.addSuffix ? `${text} ago` : text;
    }

    // Less than a day
    if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      const text = hours === 1 ? "1 hour" : `${hours} hours`;
      return options?.addSuffix ? `${text} ago` : text;
    }

    // Less than a week
    if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      const text = days === 1 ? "1 day" : `${days} days`;
      return options?.addSuffix ? `${text} ago` : text;
    }

    // Less than a month (30 days)
    if (diffInSeconds < 2592000) {
      const weeks = Math.floor(diffInSeconds / 604800);
      const text = weeks === 1 ? "1 week" : `${weeks} weeks`;
      return options?.addSuffix ? `${text} ago` : text;
    }

    // Less than a year
    if (diffInSeconds < 31536000) {
      const months = Math.floor(diffInSeconds / 2592000);
      const text = months === 1 ? "1 month" : `${months} months`;
      return options?.addSuffix ? `${text} ago` : text;
    }

    // A year or more
    const years = Math.floor(diffInSeconds / 31536000);
    const text = years === 1 ? "1 year" : `${years} years`;
    return options?.addSuffix ? `${text} ago` : text;
  } catch (error) {
    console.error("Error formatting time ago:", error);
    return "";
  }
};
