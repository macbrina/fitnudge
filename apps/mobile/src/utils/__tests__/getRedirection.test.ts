import { hasCompletedV2Onboarding } from "../onboardingUtils";

describe("hasCompletedV2Onboarding", () => {
  it("returns false for null user", () => {
    expect(hasCompletedV2Onboarding(null)).toBe(false);
  });

  it("returns false when onboarding_completed_at is undefined", () => {
    expect(hasCompletedV2Onboarding({})).toBe(false);
    expect(
      hasCompletedV2Onboarding({
        onboarding_completed_at: undefined
      })
    ).toBe(false);
  });

  it("returns false when onboarding_completed_at is null", () => {
    expect(hasCompletedV2Onboarding({ onboarding_completed_at: null })).toBe(false);
  });

  it("returns true when onboarding_completed_at is set", () => {
    expect(hasCompletedV2Onboarding({ onboarding_completed_at: "2025-01-01T00:00:00Z" })).toBe(
      true
    );
  });
});
