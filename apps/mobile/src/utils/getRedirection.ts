import { MOBILE_ROUTES } from "@/lib/routes";
import { storageUtil, STORAGE_KEYS } from "@/utils/storageUtil";

interface RedirectionOptions {
  /** If provided, skip personalization if user already has a fitness profile */
  hasFitnessProfile?: boolean;
}

/**
 * Determine the redirect URL based on user's onboarding status
 * Checks all onboarding flags in order and returns the first incomplete step
 * Returns home route if all onboarding steps are complete
 *
 * @param options.hasFitnessProfile - If true, skip personalization (user already completed it before)
 */
export async function getRedirection(options: RedirectionOptions = {}): Promise<string> {
  const { hasFitnessProfile } = options;

  // Check onboarding flags in order
  try {
    const hasSeenNotificationPermission = await storageUtil.getItem<boolean>(
      STORAGE_KEYS.HAS_SEEN_NOTIFICATION_PERMISSION
    );
    if (!hasSeenNotificationPermission) {
      return MOBILE_ROUTES.ONBOARDING.NOTIFICATION_PERMISSION;
    }

    const hasSeenPersonalization = await storageUtil.getItem<boolean>(
      STORAGE_KEYS.HAS_SEEN_PERSONALIZATION
    );

    // Skip personalization if:
    // 1. User has seen it before (local storage), OR
    // 2. User already has a fitness profile (from API - handles reinstall case)
    if (!hasSeenPersonalization && !hasFitnessProfile) {
      return MOBILE_ROUTES.ONBOARDING.PERSONALIZATION;
    }

    // All onboarding steps complete → home
    return MOBILE_ROUTES.MAIN.HOME;
  } catch (error) {
    console.warn("[getRedirection] Error checking onboarding status:", error);
    // On error, default to home
    return MOBILE_ROUTES.MAIN.HOME;
  }
}
