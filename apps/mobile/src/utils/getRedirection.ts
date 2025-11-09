import { MOBILE_ROUTES } from "@/lib/routes";
import { storageUtil, STORAGE_KEYS } from "@/utils/storageUtil";

/**
 * Determine the redirect URL based on user's onboarding status
 * Checks all onboarding flags in order and returns the first incomplete step
 * Returns home route if all onboarding steps are complete
 */
export async function getRedirection(): Promise<string> {
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
    if (!hasSeenPersonalization) {
      return MOBILE_ROUTES.ONBOARDING.PERSONALIZATION;
    }

    const hasSeenSuggestedGoals = await storageUtil.getItem<boolean>(
      STORAGE_KEYS.HAS_SEEN_SUGGESTED_GOALS
    );
    if (!hasSeenSuggestedGoals) {
      return MOBILE_ROUTES.ONBOARDING.SUGGESTED_GOALS;
    }

    const hasSeenSubscription = await storageUtil.getItem<boolean>(
      STORAGE_KEYS.HAS_SEEN_SUBSCRIPTION
    );
    if (!hasSeenSubscription) {
      return MOBILE_ROUTES.ONBOARDING.SUBSCRIPTION;
    }

    // All onboarding steps complete → home
    return MOBILE_ROUTES.MAIN.HOME;
  } catch (error) {
    console.warn("[getRedirection] Error checking onboarding status:", error);
    // On error, default to home
    return MOBILE_ROUTES.MAIN.HOME;
  }
}
