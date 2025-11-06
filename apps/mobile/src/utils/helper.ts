import { fromZonedTime, toZonedTime } from "date-fns-tz";

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
