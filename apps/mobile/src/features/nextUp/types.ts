import type { Goal } from "@/services/api/goals";

/**
 * "Next up" operates on a normalized task view.
 * For V2, a "task" is a goal that is scheduled for today and not yet checked-in.
 */
export type NextUpTask = {
  id: string;
  title: string;
  createdAt: string; // ISO
  /**
   * Minutes-from-midnight local time for deterministic sorting.
   * Lower means "earlier due today".
   */
  dueMinutes: number;
  /**
   * Whether the user has responded for today (completed / skipped / rest day).
   * We treat ANY non-null today_checkin_status as "done for today" for "Next up".
   */
  isDoneToday: boolean;
  rawGoal?: Goal;
};

export type TodayState = {
  nextTaskId: string | null;
  totalDueToday: number;
  completedToday: number;
  remainingToday: number;
};
