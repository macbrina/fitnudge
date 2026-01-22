import AsyncStorage from "@react-native-async-storage/async-storage";

// Storage keys dictionary - only keys that are actually used in the codebase
export const STORAGE_KEYS = {
  // Onboarding
  HAS_SEEN_ONBOARDING: "has_seen_onboarding",
  HAS_SEEN_NOTIFICATION_PERMISSION: "has_seen_notification_permission",
  HAS_SEEN_PERSONALIZATION: "has_seen_personalization",
  HAS_SEEN_SUBSCRIPTION: "has_seen_subscription",

  // Exit Offer Tracking
  EXIT_OFFER_LAST_SHOWN: "exit_offer_last_shown",
  EXIT_OFFER_SHOW_COUNT: "exit_offer_show_count",
  EXIT_OFFER_EXPIRY_TIME: "exit_offer_expiry_time",
  HAS_EVER_SUBSCRIBED: "has_ever_subscribed",
  HAS_DISMISSED_EXIT_INTENT: "has_dismissed_exit_intent",

  // Authentication
  ACCESS_TOKEN: "access_token",
  REFRESH_TOKEN: "refresh_token",
  REMEMBER_ME_EMAIL: "remember_me_email",
  REMEMBER_ME_ENABLED: "remember_me_enabled",

  // Notifications
  NOTIFICATION_PREFERENCES: "notification_preferences",
  NOTIFICATION_SOFT_PROMPT_SHOWN: "notification_soft_prompt_shown",

  // App Updates
  DISMISSED_UPDATE_VERSION: "dismissed_update_version"
} as const;

class StorageUtil {
  // Basic storage operations
  async setItem<T>(key: string, value: T): Promise<void> {
    try {
      // Don't save null or undefined values
      if (value === null || value === undefined) {
        console.warn(
          `Attempted to save null/undefined value for key: ${key}. Use removeItem instead.`
        );
        return;
      }
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error saving to storage (${key}):`, error);
      throw error;
    }
  }

  async getItem<T>(key: string): Promise<T | null> {
    try {
      const value = await AsyncStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Error reading from storage (${key}):`, error);
      return null;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error("Error removing item:", error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error("Error clearing storage:", error);
      throw error;
    }
  }

  /**
   * Clear all user data from storage (for account deletion, disabled, suspended).
   *
   * NOTE: System permissions (notification, camera, media library) are OS-level
   * and CANNOT be revoked programmatically. They will persist even after clearing.
   */
  async clearAll(): Promise<void> {
    try {
      // Clear all notification data (preferences, scheduled notifications, device registration)
      try {
        const { notificationService } =
          await import("@/services/notifications/notificationService");
        await notificationService.clearAllNotificationData();
      } catch (notificationError) {
        console.warn("[StorageUtil] Failed to clear notification data:", notificationError);
      }

      const keysToRemove = [
        // Authentication
        STORAGE_KEYS.ACCESS_TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.REMEMBER_ME_EMAIL,
        STORAGE_KEYS.REMEMBER_ME_ENABLED,

        // Notifications
        STORAGE_KEYS.NOTIFICATION_PREFERENCES,
        STORAGE_KEYS.NOTIFICATION_SOFT_PROMPT_SHOWN,

        // Onboarding state
        STORAGE_KEYS.HAS_SEEN_ONBOARDING,
        STORAGE_KEYS.HAS_SEEN_NOTIFICATION_PERMISSION,
        STORAGE_KEYS.HAS_SEEN_PERSONALIZATION,
        STORAGE_KEYS.HAS_SEEN_SUBSCRIPTION,

        // Exit offer tracking
        STORAGE_KEYS.EXIT_OFFER_LAST_SHOWN,
        STORAGE_KEYS.EXIT_OFFER_SHOW_COUNT,
        STORAGE_KEYS.EXIT_OFFER_EXPIRY_TIME,
        STORAGE_KEYS.HAS_EVER_SUBSCRIBED,
        STORAGE_KEYS.HAS_DISMISSED_EXIT_INTENT,

        // App updates
        STORAGE_KEYS.DISMISSED_UPDATE_VERSION
      ];

      await AsyncStorage.multiRemove(keysToRemove);
      console.log("[StorageUtil] Successfully cleared all user data");
    } catch (error) {
      console.error("[StorageUtil] Error clearing all storage:", error);
      throw error;
    }
  }

  /**
   * Clear only authentication-related data (for expired sessions).
   * Preserves user preferences, notification settings, and onboarding state.
   */
  async clearAuthData(): Promise<void> {
    try {
      const keysToRemove = [STORAGE_KEYS.ACCESS_TOKEN, STORAGE_KEYS.REFRESH_TOKEN];

      await AsyncStorage.multiRemove(keysToRemove);
      console.log("[StorageUtil] Successfully cleared auth data");
    } catch (error) {
      console.error("[StorageUtil] Error clearing auth data:", error);
      throw error;
    }
  }

  /**
   * Clear user-specific data on logout (normal logout, not account deletion).
   *
   * This clears data that is specific to a user so that if a different user
   * logs in on the same device, they get a fresh experience.
   *
   * Preserves device-level settings:
   * - HAS_SEEN_ONBOARDING (intro screens - device level)
   * - HAS_SEEN_NOTIFICATION_PERMISSION (OS permission - device level)
   *
   * Clears user-specific data:
   * - Personalization state (each user should personalize)
   * - Subscription/paywall state (each user has their own subscription)
   * - Exit offer tracking (each user should see offers fresh)
   */
  async clearUserSpecificData(): Promise<void> {
    try {
      const keysToRemove = [
        // User-specific onboarding state
        STORAGE_KEYS.HAS_SEEN_PERSONALIZATION,
        STORAGE_KEYS.HAS_SEEN_SUBSCRIPTION,

        // Exit offer tracking (user-specific)
        STORAGE_KEYS.EXIT_OFFER_LAST_SHOWN,
        STORAGE_KEYS.EXIT_OFFER_SHOW_COUNT,
        STORAGE_KEYS.EXIT_OFFER_EXPIRY_TIME,
        STORAGE_KEYS.HAS_EVER_SUBSCRIBED,
        STORAGE_KEYS.HAS_DISMISSED_EXIT_INTENT
      ];

      await AsyncStorage.multiRemove(keysToRemove);
      console.log("[StorageUtil] Successfully cleared user-specific data");
    } catch (error) {
      console.error("[StorageUtil] Error clearing user-specific data:", error);
      // Don't throw - logout should still proceed
    }
  }

  // Secure storage operations (used by TokenManager in base.ts)
  async setSecureItem(key: string, value: string): Promise<void> {
    try {
      await this.setItem(`secure_${key}`, value);
    } catch (error) {
      console.error("Error storing secure item:", error);
      throw error;
    }
  }

  async getSecureItem(key: string): Promise<string | null> {
    try {
      return await this.getItem(`secure_${key}`);
    } catch (error) {
      console.error("Error retrieving secure item:", error);
      return null;
    }
  }
}

export const storageUtil = new StorageUtil();
