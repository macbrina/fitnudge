import { goalsQueryKeys, checkInsQueryKeys, userQueryKeys } from "../queryKeys";

describe("queryKeys", () => {
  describe("goalsQueryKeys", () => {
    it("list returns stable array", () => {
      expect(goalsQueryKeys.list()).toEqual(["goals", "list"]);
    });

    it("detail includes goal id", () => {
      expect(goalsQueryKeys.detail("abc-123")).toEqual(["goals", "detail", "abc-123"]);
    });

    it("insights includes goal id", () => {
      expect(goalsQueryKeys.insights("xyz")).toEqual(["goals", "insights", "xyz"]);
    });
  });

  describe("checkInsQueryKeys", () => {
    it("list with goalId includes it", () => {
      expect(checkInsQueryKeys.list("goal-1")).toEqual(["checkIns", "list", "goal-1"]);
    });

    it("today returns stable key", () => {
      expect(checkInsQueryKeys.today()).toEqual(["checkIns", "today"]);
    });
  });

  describe("userQueryKeys", () => {
    it("currentUser returns stable key", () => {
      expect(userQueryKeys.currentUser).toEqual(["user", "current"]);
    });
  });
});
