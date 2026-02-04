import { calculateStreakFromCheckIns } from "../streakHelpers";
import type { CheckInForStreak } from "../streakHelpers";

describe("calculateStreakFromCheckIns", () => {
  const today = "2025-02-03";

  it("returns 0 for empty list", () => {
    expect(calculateStreakFromCheckIns([], today)).toBe(0);
  });

  it("returns 1 for single completed check-in today", () => {
    expect(
      calculateStreakFromCheckIns([{ check_in_date: today, status: "completed" }], today)
    ).toBe(1);
  });

  it("returns 0 when most recent is missed", () => {
    expect(calculateStreakFromCheckIns([{ check_in_date: today, status: "skipped" }], today)).toBe(
      0
    );
  });

  it("returns 3 for 3 consecutive completed days", () => {
    const checkIns: CheckInForStreak[] = [
      { check_in_date: "2025-02-03", status: "completed" },
      { check_in_date: "2025-02-02", status: "completed" },
      { check_in_date: "2025-02-01", status: "completed" }
    ];
    expect(calculateStreakFromCheckIns(checkIns, today)).toBe(3);
  });

  it("breaks streak on missed day", () => {
    const checkIns: CheckInForStreak[] = [
      { check_in_date: "2025-02-03", status: "completed" },
      { check_in_date: "2025-02-02", status: "skipped" },
      { check_in_date: "2025-02-01", status: "completed" }
    ];
    expect(calculateStreakFromCheckIns(checkIns, today)).toBe(1);
  });

  it("preserves streak through rest_day", () => {
    const checkIns: CheckInForStreak[] = [
      { check_in_date: "2025-02-03", status: "completed" },
      { check_in_date: "2025-02-02", status: "rest_day" },
      { check_in_date: "2025-02-01", status: "completed" }
    ];
    expect(calculateStreakFromCheckIns(checkIns, today)).toBe(2);
  });

  it("returns 0 when no completed today and most recent is pending", () => {
    const checkIns: CheckInForStreak[] = [{ check_in_date: today, status: "pending" }];
    expect(calculateStreakFromCheckIns(checkIns, today)).toBe(0);
  });
});
