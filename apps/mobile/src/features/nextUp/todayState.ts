import type { Goal } from "@/services/api/goals";
import type { NextUpTask, TodayState } from "./types";

const MINUTES_IN_DAY = 24 * 60;

export function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseHHMMToMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23) return null;
  if (mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

export function earliestReminderMinutes(reminderTimes: string[] | null | undefined): number {
  if (!reminderTimes || reminderTimes.length === 0) return MINUTES_IN_DAY - 1;
  let best: number | null = null;
  for (const t of reminderTimes) {
    const mins = parseHHMMToMinutes(t);
    if (mins == null) continue;
    best = best == null ? mins : Math.min(best, mins);
  }
  return best ?? MINUTES_IN_DAY - 1;
}

/**
 * Mirrors existing HomeScreen semantics:
 * - daily => scheduled today
 * - weekly => scheduled iff today's weekday is in target_days (null means not scheduled)
 */
export function isGoalScheduledForToday(
  goal: Pick<Goal, "frequency_type" | "target_days">,
  now: Date
) {
  if (goal.frequency_type === "daily") return true;
  const dow = now.getDay(); // 0=Sun..6=Sat (local)
  return goal.target_days?.includes(dow) ?? false;
}

export function goalToNextUpTask(goal: Goal, now: Date): NextUpTask | null {
  if (goal.status !== "active") return null;
  if (!isGoalScheduledForToday(goal, now)) return null;

  const isDoneToday = goal.today_checkin_status != null;
  return {
    id: goal.id,
    title: goal.title,
    createdAt: goal.created_at,
    dueMinutes: earliestReminderMinutes(goal.reminder_times),
    isDoneToday,
    rawGoal: goal
  };
}

/**
 * Prefer deriving "done today" from check-ins (more accurate across devices / realtime),
 * falling back to goal.today_checkin_status when check-in status isn't available.
 */
export function goalToNextUpTaskWithCheckInStatus(
  goal: Goal,
  now: Date,
  checkInStatus: string | null | undefined
): NextUpTask | null {
  if (goal.status !== "active") return null;
  if (!isGoalScheduledForToday(goal, now)) return null;

  const isDoneToday =
    typeof checkInStatus === "string"
      ? checkInStatus !== "pending"
      : goal.today_checkin_status != null;

  return {
    id: goal.id,
    title: goal.title,
    createdAt: goal.created_at,
    dueMinutes: earliestReminderMinutes(goal.reminder_times),
    isDoneToday,
    rawGoal: goal
  };
}

export function sortTasksDeterministically(tasks: NextUpTask[]): NextUpTask[] {
  return [...tasks].sort((a, b) => {
    if (a.dueMinutes !== b.dueMinutes) return a.dueMinutes - b.dueMinutes;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
    if (a.id !== b.id) return a.id < b.id ? -1 : 1;
    return 0;
  });
}

export function computeTodayState(tasksDueToday: NextUpTask[]): TodayState {
  const totalDueToday = tasksDueToday.length;
  const completedToday = tasksDueToday.reduce((acc, t) => acc + (t.isDoneToday ? 1 : 0), 0);
  const remainingToday = totalDueToday - completedToday;

  const incomplete = tasksDueToday.filter((t) => !t.isDoneToday);
  const nextTaskId = sortTasksDeterministically(incomplete)[0]?.id ?? null;

  return { nextTaskId, totalDueToday, completedToday, remainingToday };
}

/**
 * Flicker-avoidance rule: keep showing the persisted task id if it’s still valid
 * (exists, still due today, still incomplete). Otherwise pick the deterministic next.
 */
export function resolveNextTaskIdWithLock(opts: {
  tasksDueToday: NextUpTask[];
  lockedTaskId: string | null;
}): TodayState {
  const base = computeTodayState(opts.tasksDueToday);
  if (!opts.lockedTaskId) return base;

  const locked = opts.tasksDueToday.find((t) => t.id === opts.lockedTaskId);
  if (locked && !locked.isDoneToday) {
    return { ...base, nextTaskId: locked.id };
  }
  return base;
}

export function msUntilNextLocalMidnight(now: Date): number {
  const next = new Date(now);
  next.setDate(now.getDate() + 1);
  next.setHours(0, 0, 0, 0);
  return Math.max(0, next.getTime() - now.getTime());
}
