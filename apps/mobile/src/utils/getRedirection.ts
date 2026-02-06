import { MOBILE_ROUTES } from "@/lib/routes";
import { storageUtil, STORAGE_KEYS } from "@/utils/storageUtil";
import { hasCompletedV2Onboarding } from "@/utils/onboardingUtils";

interface RedirectionOptions {
  /** V2: If user has completed onboarding (onboarding_completed_at is set) */
  hasCompletedOnboarding?: boolean;
}

/**
 * Determine the redirect URL based on user's onboarding status
 *
 * V2 Flow:
 * 1. Check notification permission
 * 2. Check if personalization is complete (onboarding_completed_at)
 * 3. If all complete → home
 *
 * @param options.hasCompletedOnboarding - If true, skip personalization (user.onboarding_completed_at is set)
 */
export async function getRedirection(
  options: RedirectionOptions = {}
): Promise<string> {
  const { hasCompletedOnboarding } = options;

  try {
    // Check if user has seen notification permission screen
    const hasSeenNotificationPermission = await storageUtil.getItem<boolean>(
      STORAGE_KEYS.HAS_SEEN_NOTIFICATION_PERMISSION
    );
    if (!hasSeenNotificationPermission) {
      return MOBILE_ROUTES.ONBOARDING.NOTIFICATION_PERMISSION;
    }

    // Check if user has completed V2 personalization
    // Skip if:
    // 1. User has seen it before (local storage), OR
    // 2. User has onboarding_completed_at set (from API - handles reinstall case)
    const hasSeenPersonalization = await storageUtil.getItem<boolean>(
      STORAGE_KEYS.HAS_SEEN_PERSONALIZATION
    );

    if (!hasSeenPersonalization && !hasCompletedOnboarding) {
      return MOBILE_ROUTES.ONBOARDING.PERSONALIZATION;
    }

    if (hasCompletedOnboarding) {
      // set hasSeenPersonalization to true
      await storageUtil.setItem(STORAGE_KEYS.HAS_SEEN_PERSONALIZATION, true);
    }

    // All onboarding steps complete → home
    return MOBILE_ROUTES.MAIN.HOME;
  } catch (error) {
    console.warn("[getRedirection] Error checking onboarding status:", error);
    // On error, default to home
    return MOBILE_ROUTES.MAIN.HOME;
  }
}
