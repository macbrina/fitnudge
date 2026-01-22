/**
 * Weekly Progress View Component
 *
 * Displays the current week with M-T-W-Th-F-S-S checkmarks showing
 * completion status for each day:
 * - ✓ (green) = Completed
 * - ✗ (red) = Missed
 * - 💤 (gray) = Rest day
 * - · (muted) = Not yet / No data
 */

import React, { useMemo } from "react";
import { View, Text } from "react-native";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { Check, X, Moon, Minus, Clock } from "lucide-react-native";

interface DayCheckIn {
  date: string;
  // V2: status is the single source of truth
  // Backend returns: completed, rest_day, skipped, missed, pending, not_scheduled, no_data
  status:
    | "pending"
    | "completed"
    | "skipped"
    | "missed"
    | "rest_day"
    | "future"
    | "not_scheduled"
    | "no_data";
  isScheduled?: boolean;
}

interface WeeklyProgressViewProps {
  checkIns: DayCheckIn[];
  // Target days for schedule: null = daily (all days), array = specific days [0,1,2...] (0=Sun, 1=Mon, etc.)
  targetDays?: number[] | null;
  // Goal creation date - days before this are "not_scheduled"
  goalCreatedAt?: string | null;
}

export function WeeklyProgressView({
  checkIns,
  targetDays,
  goalCreatedAt
}: WeeklyProgressViewProps) {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();

  // Get the current week's days (Monday to Sunday)
  const weekDays = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const monday = new Date(today);

    // Calculate days to subtract to get to Monday
    const daysToMonday = currentDay === 0 ? 6 : currentDay - 1;
    monday.setDate(today.getDate() - daysToMonday);

    // Helper to get YYYY-MM-DD in local time (not UTC)
    const getLocalDateStr = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const dayNum = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${dayNum}`;
    };
    const todayStr = getLocalDateStr(today);

    const days: { date: string; dayOfWeek: number; label: string; isToday: boolean }[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const dateStr = getLocalDateStr(date);
      const dayOfWeek = date.getDay();
      const isToday = dateStr === todayStr;

      // Short day labels
      const dayLabels = [
        t("common.days_of_week.short.sun"),
        t("common.days_of_week.short.mon"),
        t("common.days_of_week.short.tue"),
        t("common.days_of_week.short.wed"),
        t("common.days_of_week.short.thu"),
        t("common.days_of_week.short.fri"),
        t("common.days_of_week.short.sat")
      ];

      days.push({
        date: dateStr,
        dayOfWeek,
        label: dayLabels[dayOfWeek],
        isToday
      });
    }

    return days;
  }, [t]);

  // Create a map for quick lookup (V2: use status)
  const checkInMap = useMemo(() => {
    const map = new Map<string, DayCheckIn>();
    checkIns.forEach((checkIn) => {
      const existing = map.get(checkIn.date);
      if (!existing) {
        map.set(checkIn.date, checkIn);
      } else {
        // Merge: prefer completed > rest_day > pending > missed/skipped
        const priority = { completed: 4, rest_day: 3, pending: 2, skipped: 1, missed: 0 };
        const existingPriority = priority[existing.status as keyof typeof priority] ?? 0;
        const newPriority = priority[checkIn.status as keyof typeof priority] ?? 0;
        if (newPriority > existingPriority) {
          map.set(checkIn.date, checkIn);
        }
      }
    });
    return map;
  }, [checkIns]);

  // Helper to check if a day of week is scheduled
  // targetDays is always an array now: [0,1,2,3,4,5,6] for daily, [1,3,5] for specific days
  const isDayScheduled = (dayOfWeek: number): boolean => {
    return targetDays?.includes(dayOfWeek) ?? true; // Fallback true for legacy data
  };

  // Parse goal creation date once
  const goalCreationDate = useMemo(() => {
    if (!goalCreatedAt) return null;
    const d = new Date(goalCreatedAt);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [goalCreatedAt]);

  // Determine the status icon and color for each day
  // 4 visual states matching HeatMapCalendar:
  // 1. Completed = Primary (blue)
  // 2. Missed/Skipped = Red
  // 3. Rest = Amber (user-marked rest day)
  // 4. Not Scheduled = Muted (off day, future, pending)
  const getDayStatus = (date: string, dayOfWeek: number) => {
    const checkIn = checkInMap.get(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Helper to get YYYY-MM-DD in local time
    const getLocalDateStr = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    const todayStr = getLocalDateStr(today);

    // Use date string comparison for reliable future check
    const isFuture = date > todayStr;
    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);
    const isBeforeGoalCreation = goalCreationDate && dateObj < goalCreationDate;
    const isScheduledDay = isDayScheduled(dayOfWeek);

    // Day is before goal was created - show as muted (irrelevant, not an "off day")
    if (isBeforeGoalCreation) {
      return {
        icon: <Minus size={16} color={colors.text.tertiary} />,
        bgColor: colors.bg.muted, // Muted color for pre-goal days
        status: "future" // Treat as future/irrelevant
      };
    }

    if (checkIn) {
      // Use status from backend directly - 6 distinct states
      switch (checkIn.status) {
        case "completed":
          return {
            icon: <Check size={16} color="#FFFFFF" />,
            bgColor: brandColors.primary, // Blue - completed successfully
            status: "completed"
          };
        case "rest_day":
          // User-marked rest day (amber)
          return {
            icon: <Moon size={16} color={colors.text.primary} />,
            bgColor: colors.feedback.warning + "99", // Amber ~60%
            status: "rest"
          };
        case "pending":
          // Today, actionable (green)
          return {
            icon: <Clock size={16} color={colors.text.primary} />,
            bgColor: colors.feedback.success + "80", // Green ~50%
            status: "pending"
          };
        case "not_scheduled":
          // Off day but visible
          return {
            icon: <Minus size={16} color={colors.text.tertiary} />,
            bgColor: colors.border.default, // Border color
            status: "not_scheduled"
          };
        case "future":
        case "no_data":
          // Future or no data - most muted
          return {
            icon: <Minus size={16} color={colors.text.tertiary} />,
            bgColor: colors.bg.muted,
            status: "future"
          };
        case "skipped":
        case "missed":
        default:
          return {
            icon: <X size={16} color="#FFFFFF" />,
            bgColor: colors.feedback.error, // Red - missed
            status: "missed"
          };
      }
    }

    // No check-in data - determine based on schedule
    // Check off-day FIRST (regardless of past/future)
    if (!isScheduledDay) {
      // Day not in goal's target days - off day
      return {
        icon: <Minus size={16} color={colors.text.tertiary} />,
        bgColor: colors.border.default, // Border color - off day
        status: "not_scheduled"
      };
    }

    if (isFuture) {
      return {
        icon: <Minus size={16} color={colors.text.tertiary} />,
        bgColor: colors.bg.muted, // Future scheduled day - muted
        status: "future"
      };
    }

    // Past scheduled day with no check-in - missed (fallback)
    return {
      icon: <X size={16} color="#FFFFFF" />,
      bgColor: colors.feedback.error, // Red - missed
      status: "missed"
    };
  };

  // Calculate stats for the week (5 visual states - excluding future)
  const weekStats = useMemo(() => {
    let completed = 0;
    let missed = 0;
    let rest = 0;
    let pending = 0;
    let notScheduled = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Helper to get YYYY-MM-DD in local time (not UTC)
    const getLocalDateStr = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const dayNum = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${dayNum}`;
    };
    const todayStr = getLocalDateStr(today);

    weekDays.forEach((day) => {
      const dateObj = new Date(day.date);
      dateObj.setHours(0, 0, 0, 0);
      const isFutureDay = day.date > todayStr;
      const isScheduledDay = isDayScheduled(day.dayOfWeek);

      // Off-days are always counted (regardless of past/future)
      if (!isScheduledDay) {
        notScheduled++;
        return;
      }

      // Skip future SCHEDULED days (they haven't happened yet)
      if (isFutureDay) return;

      // Check if before goal creation (treat as not countable)
      if (goalCreationDate && dateObj < goalCreationDate) {
        return; // Don't count pre-goal days in stats
      }

      const checkIn = checkInMap.get(day.date);

      if (!checkIn) {
        // No check-in for a past scheduled day - missed
        missed++;
        return;
      }

      // Use status field directly
      switch (checkIn.status) {
        case "completed":
          completed++;
          break;
        case "rest_day":
          rest++;
          break;
        case "pending":
          pending++;
          break;
        case "not_scheduled":
        case "no_data":
          notScheduled++;
          break;
        case "skipped":
        case "missed":
          missed++;
          break;
        // future not counted in stats
      }
    });

    return { completed, missed, rest, pending, notScheduled };
  }, [weekDays, checkInMap, goalCreationDate, targetDays]);

  return (
    <View style={styles.container}>
      {/* Week Days Grid */}
      <View style={styles.weekGrid}>
        {weekDays.map((day) => {
          const { icon, bgColor } = getDayStatus(day.date, day.dayOfWeek);

          return (
            <View key={day.date} style={[styles.dayColumn, day.isToday && styles.todayColumn]}>
              {/* Day Label */}
              <Text
                style={[
                  styles.dayLabel,
                  day.isToday && { color: brandColors.primary, fontFamily: fontFamily.groteskBold }
                ]}
              >
                {day.label}
              </Text>

              {/* Status Icon */}
              <View style={[styles.statusCircle, { backgroundColor: bgColor }]}>{icon}</View>
            </View>
          );
        })}
      </View>

      {/* Week Summary - matching HeatMapCalendar colors */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <View style={[styles.summaryDot, { backgroundColor: brandColors.primary }]} />
            <Text style={styles.summaryText}>
              {weekStats.completed} {t("progress.completed")}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <View style={[styles.summaryDot, { backgroundColor: colors.feedback.error }]} />
            <Text style={styles.summaryText}>
              {weekStats.missed} {t("progress.missed")}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <View
              style={[styles.summaryDot, { backgroundColor: colors.feedback.success + "80" }]}
            />
            <Text style={styles.summaryText}>
              {weekStats.pending} {t("progress.pending")}
            </Text>
          </View>
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <View
              style={[styles.summaryDot, { backgroundColor: colors.feedback.warning + "99" }]}
            />
            <Text style={styles.summaryText}>
              {weekStats.rest} {t("progress.rest")}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <View style={[styles.summaryDot, { backgroundColor: colors.border.default }]} />
            <Text style={styles.summaryText}>
              {weekStats.notScheduled} {t("progress.not_scheduled")}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    gap: toRN(tokens.spacing[4])
  },
  weekGrid: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const
  },
  dayColumn: {
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    flex: 1
  },
  todayColumn: {
    transform: [{ scale: 1.05 }]
  },
  dayLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.tertiary,
    textTransform: "uppercase" as const
  },
  statusCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  summaryContainer: {
    paddingTop: toRN(tokens.spacing[2]),
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    gap: toRN(tokens.spacing[2])
  },
  summaryRow: {
    flexDirection: "row" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[4])
  },
  summaryItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1.5])
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  summaryText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.secondary
  }
});

export default WeeklyProgressView;
