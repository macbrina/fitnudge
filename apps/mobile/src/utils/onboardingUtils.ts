/**
 * Pure onboarding helpers (no dependencies, testable).
 */

/**
 * Check if user has completed V2 onboarding from user object.
 */
export function hasCompletedV2Onboarding(
  user: { onboarding_completed_at?: string | null } | null
): boolean {
  return !!user?.onboarding_completed_at;
}
