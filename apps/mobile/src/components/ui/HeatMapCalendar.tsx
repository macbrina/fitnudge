import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "@/themes";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { tokens } from "@/themes/tokens";
import { useTranslation } from "@/lib/i18n";

interface CheckInDay {
  date: string; // YYYY-MM-DD
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

interface HeatMapCalendarProps {
  checkIns: CheckInDay[];
  daysToShow?: number; // 30 or 90
  startDate?: Date; // Defaults to today - daysToShow
  // Target days for schedule: null = daily (all days), array = specific days [0,1,2...] (0=Sun, 1=Mon, etc.)
  targetDays?: number[] | null;
  // Goal creation date - days before this are "no_data"
  goalCreatedAt?: string | null;
}

const CELL_SIZE = 14;
const CELL_GAP = 3;
const WEEKS_PER_ROW = 7; // Show full weeks

export function HeatMapCalendar({
  checkIns,
  daysToShow = 30,
  startDate,
  targetDays,
  goalCreatedAt
}: HeatMapCalendarProps) {
  const { t } = useTranslation();
  const { colors, brandColors, isDark } = useTheme();

  // Create a map for quick lookup
  const checkInMap = useMemo(() => {
    const map = new Map<string, CheckInDay>();
    checkIns.forEach((ci) => map.set(ci.date, ci));
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

  // Generate the days grid
  const days = useMemo(() => {
    const result: Array<{
      date: Date;
      dateStr: string;
      status: "completed" | "missed" | "rest" | "future" | "not_scheduled" | "pending";
    }> = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = startDate
      ? new Date(startDate)
      : new Date(today.getTime() - daysToShow * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);

    // Adjust to start from Sunday
    const dayOfWeek = start.getDay();
    start.setDate(start.getDate() - dayOfWeek);

    // Generate days until today + remaining week
    const end = new Date(today);
    const endDayOfWeek = end.getDay();
    if (endDayOfWeek !== 6) {
      end.setDate(end.getDate() + (6 - endDayOfWeek));
    }

    const current = new Date(start);
    // Helper to get YYYY-MM-DD in local time (not UTC)
    const getLocalDateStr = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    const todayStr = getLocalDateStr(today);

    while (current <= end) {
      const dateStr = getLocalDateStr(current);
      const checkIn = checkInMap.get(dateStr);
      const isFuture = dateStr > todayStr; // Compare date strings for reliable future check
      const isBeforeGoalCreation = goalCreationDate && current < goalCreationDate;
      const isScheduledDay = isDayScheduled(current.getDay());

      let status: "completed" | "missed" | "rest" | "future" | "not_scheduled" | "pending";

      // Day is before goal was created - show as muted (irrelevant, not an "off day")
      if (isBeforeGoalCreation) {
        status = "future"; // Use future color (muted) for pre-goal days
      } else if (checkIn) {
        // Backend now returns proper status including future/not_scheduled
        switch (checkIn.status) {
          case "completed":
            status = "completed";
            break;
          case "rest_day":
            status = "rest";
            break;
          case "future":
            status = "future";
            break;
          case "not_scheduled":
          case "no_data":
            status = "not_scheduled";
            break;
          case "pending":
            // Pending = today or future scheduled day awaiting response
            // Today (dateStr === todayStr) or future → show as pending (green)
            // Past pending → missed (red) - shouldn't happen with end-of-day task
            status = dateStr >= todayStr ? "pending" : "missed";
            break;
          case "skipped":
          case "missed":
          default:
            status = "missed";
            break;
        }
      } else if (!isScheduledDay) {
        // Day not in goal's target days - off day (check before future)
        status = "not_scheduled";
      } else if (isFuture) {
        // Future scheduled day
        status = "future";
      } else {
        // Past scheduled day with no check-in - missed (fallback, shouldn't happen with pre-create)
        status = "missed";
      }

      result.push({
        date: new Date(current),
        dateStr,
        status
      });

      current.setDate(current.getDate() + 1);
    }

    return result;
  }, [checkInMap, daysToShow, startDate, goalCreationDate, targetDays]);

  // Group into weeks (rows)
  const weeks = useMemo(() => {
    const result: (typeof days)[] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  }, [days]);

  // Get cell color based on status (6 visual states)
  // 1. Completed = Primary (blue) - positive, celebratory
  // 2. Missed/Skipped = Red - negative, attention needed
  // 3. Rest = Amber - user-marked rest day, intentional break
  // 4. Pending = Green with opacity - today, actionable
  // 5. Not Scheduled = theme-aware off-day; dark: border gray, light: medium gray so it’s visible on white
  // 6. Future/No Data = Muted - almost invisible
  const offDayColor = isDark ? colors.border.default : "#b8c4d0"; // Medium gray visible on light backgrounds (avoids border.default blending with white)

  const getCellColor = (status: string) => {
    switch (status) {
      case "completed":
        return brandColors.primary; // Blue - completed successfully
      case "missed":
      case "skipped":
        return colors.feedback.error; // Red - missed/failed
      case "rest":
        return colors.feedback.warning + "99"; // Amber ~60% - intentional rest
      case "pending":
        return colors.feedback.success + "80"; // Green ~50% - actionable today
      case "not_scheduled":
        return offDayColor;
      case "future":
      case "no_data":
      default:
        return colors.bg.muted; // Muted - future/no data
    }
  };

  // Day labels using translation keys
  const dayLabels = useMemo(
    () => [
      t("common.days_of_week.short.sun"),
      t("common.days_of_week.short.mon"),
      t("common.days_of_week.short.tue"),
      t("common.days_of_week.short.wed"),
      t("common.days_of_week.short.thu"),
      t("common.days_of_week.short.fri"),
      t("common.days_of_week.short.sat")
    ],
    [t]
  );

  return (
    <View style={styles.container}>
      {/* Day labels header */}
      <View style={styles.dayLabelsRow}>
        {dayLabels.map((label, index) => (
          <Text key={index} style={[styles.dayLabel, { color: colors.text.tertiary }]}>
            {label}
          </Text>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.grid}>
        {weeks.map((week, weekIndex) => (
          <View key={weekIndex} style={styles.weekRow}>
            {week.map((day, dayIndex) => (
              <View
                key={day.dateStr}
                style={[
                  styles.cell,
                  { backgroundColor: getCellColor(day.status) },
                  day.status === "completed" && styles.cellCompleted
                ]}
              />
            ))}
          </View>
        ))}
      </View>

      {/* Legend - 6 statuses with distinct colors */}
      <View style={styles.legendContainer}>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendCell, { backgroundColor: brandColors.primary }]} />
            <Text style={[styles.legendText, { color: colors.text.tertiary }]}>
              {t("progress.completed")}
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendCell, { backgroundColor: colors.feedback.error }]} />
            <Text style={[styles.legendText, { color: colors.text.tertiary }]}>
              {t("progress.missed")}
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View
              style={[styles.legendCell, { backgroundColor: colors.feedback.success + "80" }]}
            />
            <Text style={[styles.legendText, { color: colors.text.tertiary }]}>
              {t("progress.pending") || "Pending"}
            </Text>
          </View>
        </View>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View
              style={[styles.legendCell, { backgroundColor: colors.feedback.warning + "99" }]}
            />
            <Text style={[styles.legendText, { color: colors.text.tertiary }]}>
              {t("progress.rest")}
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendCell, { backgroundColor: offDayColor }]} />
            <Text style={[styles.legendText, { color: colors.text.tertiary }]}>
              {t("progress.not_scheduled")}
            </Text>
          </View>
          {/* <View style={styles.legendItem}>
            <View style={[styles.legendCell, { backgroundColor: colors.bg.muted }]} />
            <Text style={[styles.legendText, { color: colors.text.tertiary }]}>
              {t("progress.future") || "Future"}
            </Text>
          </View> */}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: toRN(tokens.spacing[2])
  },
  dayLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: toRN(tokens.spacing[1])
  },
  dayLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskMedium,
    width: CELL_SIZE,
    textAlign: "center"
  },
  grid: {
    gap: CELL_GAP
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    gap: CELL_GAP
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 3
  },
  cellCompleted: {
    // Optional: Add subtle shadow or border for completed cells
  },
  legendContainer: {
    marginTop: toRN(tokens.spacing[3]),
    gap: toRN(tokens.spacing[2])
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: toRN(tokens.spacing[4])
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: toRN(tokens.spacing[1])
  },
  legendCell: {
    width: 10,
    height: 10,
    borderRadius: 2
  },
  legendText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskRegular
  }
});
