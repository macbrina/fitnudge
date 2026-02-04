/**
 * Pure streak calculation helpers (testable).
 * Matches backend logic in achievement_condition_checker and migration 026.
 */

export interface CheckInForStreak {
  check_in_date: string; // YYYY-MM-DD
  status: "completed" | "skipped" | "rest_day" | "missed" | "pending";
}

/**
 * Calculate current streak from check-ins ordered by date DESC (most recent first).
 * Matches backend: streak counts consecutive completed days ending today.
 * - completed: increment streak
 * - rest_day, pending: preserve (pass through)
 * - missed, skipped: break streak
 */
export function calculateStreakFromCheckIns(
  checkIns: CheckInForStreak[],
  todayIso: string
): number {
  if (!checkIns || checkIns.length === 0) return 0;

  const todayDate = new Date(todayIso);
  todayDate.setHours(0, 0, 0, 0);
  const todayTime = todayDate.getTime();

  let streak = 0;
  let prevDate: Date | null = null;

  for (const checkIn of checkIns) {
    const checkInDate = new Date(checkIn.check_in_date);
    checkInDate.setHours(0, 0, 0, 0);
    const checkInTime = checkInDate.getTime();

    if (prevDate === null) {
      if (checkInTime < todayTime) break;
      if (checkInTime > todayTime) continue;
      if (checkIn.status === "completed") {
        streak = 1;
      } else if (checkIn.status !== "rest_day" && checkIn.status !== "pending") {
        return 0;
      }
      prevDate = checkInDate;
      continue;
    }

    const prevDayBefore = new Date(prevDate);
    prevDayBefore.setDate(prevDayBefore.getDate() - 1);
    prevDayBefore.setHours(0, 0, 0, 0);

    if (checkInTime !== prevDayBefore.getTime()) break;

    if (checkIn.status === "completed") streak += 1;
    else if (checkIn.status !== "rest_day" && checkIn.status !== "pending") break;
    prevDate = checkInDate;
  }

  return streak;
}
