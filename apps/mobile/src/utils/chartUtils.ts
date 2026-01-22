/**
 * Chart Utilities for Analytics Screen
 *
 * Client-side computation of chart data from check-ins
 * Following SCALABILITY.md - single API call, all aggregation in-memory
 */

import { CheckIn, SkipReason } from "@/services/api/checkins";
import { Goal } from "@/services/api/goals";

// Types for chart data
export interface WeeklyConsistencyData {
  day: string;
  dayIndex: number;
  percentage: number;
  completed: number;
  total: number;
}

export interface StreakHistoryData {
  week: string;
  weekStart: Date;
  maxStreak: number;
}

export interface GoalComparisonData {
  id: string;
  title: string;
  completion: number;
  completed: number;
  total: number;
  color: string;
}

export interface MonthlyTrendData {
  month: string;
  monthIndex: number;
  year: number;
  percentage: number;
  completed: number;
  total: number;
}

export interface SkipReasonData {
  reason: SkipReason;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

// Day labels
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
];

// Colors for goals
const GOAL_COLORS = [
  "#FF6B6B", // Red
  "#4ECDC4", // Teal
  "#6366F1", // Indigo
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#22C55E", // Green
  "#8B5CF6", // Purple
  "#EF4444", // Bright Red
  "#3B82F6" // Blue
];

// Skip reason colors
const SKIP_REASON_COLORS: Record<SkipReason, string> = {
  work: "#FF6B6B",
  tired: "#4ECDC4",
  sick: "#9B59B6",
  schedule: "#F39C12",
  other: "#95A5A6"
};

// Skip reason labels
const SKIP_REASON_LABELS: Record<SkipReason, string> = {
  work: "Work",
  tired: "Tired",
  sick: "Sick",
  schedule: "Schedule",
  other: "Other"
};

/**
 * Compute weekly consistency data (which days are users most consistent)
 * Aggregates all check-ins by day of week
 */
export function computeWeeklyConsistency(checkIns: CheckIn[]): WeeklyConsistencyData[] {
  // Initialize counters for each day
  const dayStats: Record<number, { completed: number; total: number }> = {};
  for (let i = 0; i < 7; i++) {
    dayStats[i] = { completed: 0, total: 0 };
  }

  // Count check-ins by day of week (V2: use status field)
  checkIns.forEach((checkIn) => {
    const date = new Date(checkIn.check_in_date);
    const dayIndex = date.getDay(); // 0 = Sunday

    dayStats[dayIndex].total++;
    if (checkIn.status === "completed" || checkIn.status === "rest_day") {
      dayStats[dayIndex].completed++;
    }
  });

  // Convert to chart format (Mon-Sun order)
  const orderedDays = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun
  return orderedDays.map((dayIndex) => {
    const stats = dayStats[dayIndex];
    const percentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

    return {
      day: DAY_LABELS[dayIndex],
      dayIndex,
      percentage,
      completed: stats.completed,
      total: stats.total
    };
  });
}

/**
 * Compute streak history (max streak per week for the last 12 weeks)
 */
export function computeStreakHistory(
  checkIns: CheckIn[],
  numWeeks: number = 12
): StreakHistoryData[] {
  if (checkIns.length === 0) {
    return [];
  }

  // Sort check-ins by date
  const sorted = [...checkIns].sort(
    (a, b) => new Date(a.check_in_date).getTime() - new Date(b.check_in_date).getTime()
  );

  // Get date range
  const now = new Date();
  const weeksAgo = new Date(now);
  weeksAgo.setDate(weeksAgo.getDate() - numWeeks * 7);

  // Group check-ins by week
  const weeklyData: Map<string, { checkIns: CheckIn[]; weekStart: Date }> = new Map();

  for (let i = 0; i < numWeeks; i++) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - (numWeeks - i - 1) * 7);
    weekStart.setHours(0, 0, 0, 0);

    const weekKey = `W${i + 1}`;
    weeklyData.set(weekKey, { checkIns: [], weekStart: new Date(weekStart) });
  }

  // Assign check-ins to weeks
  sorted.forEach((checkIn) => {
    const checkInDate = new Date(checkIn.check_in_date);
    const weeksFromNow = Math.floor(
      (now.getTime() - checkInDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    const weekIndex = numWeeks - weeksFromNow - 1;

    if (weekIndex >= 0 && weekIndex < numWeeks) {
      const weekKey = `W${weekIndex + 1}`;
      const weekData = weeklyData.get(weekKey);
      if (weekData) {
        weekData.checkIns.push(checkIn);
      }
    }
  });

  // Calculate max streak for each week
  return Array.from(weeklyData.entries()).map(([week, data]) => {
    // Sort week's check-ins by date
    const weekCheckIns = [...data.checkIns].sort(
      (a, b) => new Date(a.check_in_date).getTime() - new Date(b.check_in_date).getTime()
    );

    // Calculate streak
    let currentStreak = 0;
    let maxStreak = 0;

    // V2: Use status field
    weekCheckIns.forEach((checkIn) => {
      if (checkIn.status === "completed" || checkIn.status === "rest_day") {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    });

    return {
      week,
      weekStart: data.weekStart,
      maxStreak
    };
  });
}

/**
 * Compute goal comparison data (completion rate per goal)
 */
export function computeGoalComparison(checkIns: CheckIn[], goals: Goal[]): GoalComparisonData[] {
  // Group check-ins by goal
  const goalStats: Map<string, { completed: number; total: number }> = new Map();

  // V2: Use status field
  checkIns.forEach((checkIn) => {
    const stats = goalStats.get(checkIn.goal_id) || { completed: 0, total: 0 };
    stats.total++;
    if (checkIn.status === "completed" || checkIn.status === "rest_day") {
      stats.completed++;
    }
    goalStats.set(checkIn.goal_id, stats);
  });

  // Match with goals and create chart data
  return goals
    .filter((goal) => goalStats.has(goal.id))
    .map((goal, index) => {
      const stats = goalStats.get(goal.id)!;
      const completion = stats.total > 0 ? stats.completed / stats.total : 0;

      return {
        id: goal.id,
        title: goal.title,
        completion,
        completed: stats.completed,
        total: stats.total,
        color: GOAL_COLORS[index % GOAL_COLORS.length]
      };
    })
    .sort((a, b) => b.completion - a.completion) // Sort by completion rate descending
    .slice(0, 5); // Top 5 goals
}

/**
 * Compute monthly trend data (completion rate per month)
 */
export function computeMonthlyTrend(
  checkIns: CheckIn[],
  numMonths: number = 6
): MonthlyTrendData[] {
  // Get date range
  const now = new Date();

  // Initialize monthly data
  const monthlyData: Map<
    string,
    { completed: number; total: number; monthIndex: number; year: number }
  > = new Map();

  for (let i = numMonths - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);

    const monthIndex = date.getMonth();
    const year = date.getFullYear();
    const key = `${year}-${monthIndex}`;

    monthlyData.set(key, { completed: 0, total: 0, monthIndex, year });
  }

  // Count check-ins per month
  checkIns.forEach((checkIn) => {
    const date = new Date(checkIn.check_in_date);
    const monthIndex = date.getMonth();
    const year = date.getFullYear();
    const key = `${year}-${monthIndex}`;

    const data = monthlyData.get(key);
    if (data) {
      data.total++;
      // V2: Use status field
      if (checkIn.status === "completed" || checkIn.status === "rest_day") {
        data.completed++;
      }
    }
  });

  // Convert to chart format
  return Array.from(monthlyData.entries()).map(([_, data]) => {
    const percentage = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;

    return {
      month: MONTH_LABELS[data.monthIndex],
      monthIndex: data.monthIndex,
      year: data.year,
      percentage,
      completed: data.completed,
      total: data.total
    };
  });
}

/**
 * Compute skip reasons distribution
 */
export function computeSkipReasons(checkIns: CheckIn[]): SkipReasonData[] {
  // Count skip reasons
  const reasonCounts: Record<SkipReason, number> = {
    work: 0,
    tired: 0,
    sick: 0,
    schedule: 0,
    other: 0
  };

  let totalSkips = 0;

  // V2: Use status field - skipped check-ins have skip_reason
  checkIns.forEach((checkIn) => {
    if (checkIn.status === "skipped" && checkIn.skip_reason) {
      reasonCounts[checkIn.skip_reason]++;
      totalSkips++;
    }
  });

  // Convert to chart format
  return (Object.keys(reasonCounts) as SkipReason[])
    .map((reason) => ({
      reason,
      label: SKIP_REASON_LABELS[reason],
      count: reasonCounts[reason],
      percentage: totalSkips > 0 ? Math.round((reasonCounts[reason] / totalSkips) * 100) : 0,
      color: SKIP_REASON_COLORS[reason]
    }))
    .filter((data) => data.count > 0)
    .sort((a, b) => b.count - a.count);
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number): string {
  return `${Math.round(value)}%`;
}
