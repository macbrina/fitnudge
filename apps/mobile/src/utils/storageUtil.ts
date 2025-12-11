import AsyncStorage from "@react-native-async-storage/async-storage";

// Storage keys dictionary
export const STORAGE_KEYS = {
  // Onboarding
  HAS_SEEN_ONBOARDING: "has_seen_onboarding",
  HAS_SEEN_NOTIFICATION_PERMISSION: "has_seen_notification_permission",
  HAS_SEEN_PERSONALIZATION: "has_seen_personalization",
  HAS_SEEN_SUBSCRIPTION: "has_seen_subscription",
  HAS_SEEN_EXIT_DISCOUNT: "has_seen_exit_discount",

  // Exit Offer Tracking (once per 7 days, max 5 times)
  EXIT_OFFER_LAST_SHOWN: "exit_offer_last_shown", // ISO timestamp
  EXIT_OFFER_SHOW_COUNT: "exit_offer_show_count", // number (max 5)
  HAS_EVER_SUBSCRIBED: "has_ever_subscribed", // boolean - prevents exit offer for users who have ever subscribed
  HAS_DISMISSED_EXIT_INTENT: "has_dismissed_exit_intent", // boolean - true ONLY after user closes ExitIntentModal

  // Authentication
  AUTH_TOKEN: "auth_token",
  REFRESH_TOKEN: "refresh_token",
  USER_DATA: "user_data",
  REMEMBER_ME_EMAIL: "remember_me_email",
  REMEMBER_ME_ENABLED: "remember_me_enabled",
  NOTIFICATION_PREFERENCES: "notification_preferences",
  NOTIFICATION_SOFT_PROMPT_SHOWN: "notification_soft_prompt_shown",

  // User preferences
  LANGUAGE: "user_pref_language",
  THEME: "user_pref_theme",
  NOTIFICATIONS_ENABLED: "user_pref_notifications",
  BIOMETRIC_ENABLED: "user_pref_biometric",
  AUTO_SHOW_CHECKIN_ENABLED: "user_pref_auto_show_checkin",
  AUTO_SHOW_CHECKIN_TIME_LIMIT: "user_pref_auto_show_checkin_time",
  LAST_CHECKIN_AUTO_SHOWN_DATE: "last_checkin_auto_shown_date",

  // App state
  LAST_ACTIVE: "last_active",
  APP_VERSION: "app_version",
  FIRST_LAUNCH: "first_launch",

  // Goals and fitness data
  GOALS_DATA: "goals_data",
  WORKOUT_HISTORY: "workout_history",
  PROGRESS_DATA: "progress_data",

  // Social features
  SOCIAL_FEED_CACHE: "social_feed_cache",
  FOLLOWING_LIST: "following_list",

  // Offline data
  OFFLINE_GOALS: "offline_goals",
  OFFLINE_MOTIVATION: "offline_motivation",

  // Cache keys
  API_CACHE: "api_cache",
  IMAGES_CACHE: "images_cache",
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
   * Clear all user-specific data when user is deleted or logged out.
   * This removes all personal data while preserving app-level preferences if needed.
   */
  /**
   * Clear all user data from storage
   *
   * NOTE: System permissions (notification, camera, media library) are OS-level
   * and CANNOT be revoked programmatically. They will persist even after clearing.
   * The app will check permissions from the OS on next use.
   */
  async clearAll(): Promise<void> {
    try {
      // Clear all notification data (preferences, scheduled notifications, device registration)
      // Use dynamic import to avoid circular dependency
      try {
        const { notificationService } = await import(
          "@/services/notifications/notificationService"
        );
        await notificationService.clearAllNotificationData();
      } catch (notificationError) {
        console.warn(
          "[StorageUtil] Failed to clear notification data:",
          notificationError
        );
      }

      const keysToRemove = [
        // Authentication
        STORAGE_KEYS.AUTH_TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.USER_DATA,
        STORAGE_KEYS.REMEMBER_ME_EMAIL,
        STORAGE_KEYS.REMEMBER_ME_ENABLED,
        STORAGE_KEYS.NOTIFICATION_PREFERENCES, // Also cleared by notificationService, but included for safety
        STORAGE_KEYS.NOTIFICATION_SOFT_PROMPT_SHOWN, // Also cleared by notificationService, but included for safety

        // Onboarding state
        STORAGE_KEYS.HAS_SEEN_ONBOARDING,
        STORAGE_KEYS.HAS_SEEN_NOTIFICATION_PERMISSION,
        STORAGE_KEYS.HAS_SEEN_PERSONALIZATION,
        STORAGE_KEYS.HAS_SEEN_SUBSCRIPTION,

        // User preferences
        STORAGE_KEYS.LANGUAGE,
        STORAGE_KEYS.THEME,
        STORAGE_KEYS.NOTIFICATIONS_ENABLED,
        STORAGE_KEYS.BIOMETRIC_ENABLED,
        STORAGE_KEYS.AUTO_SHOW_CHECKIN_ENABLED,
        STORAGE_KEYS.AUTO_SHOW_CHECKIN_TIME_LIMIT,
        STORAGE_KEYS.LAST_CHECKIN_AUTO_SHOWN_DATE,

        // Goals and fitness data
        STORAGE_KEYS.GOALS_DATA,
        STORAGE_KEYS.WORKOUT_HISTORY,
        STORAGE_KEYS.PROGRESS_DATA,

        // Social features
        STORAGE_KEYS.SOCIAL_FEED_CACHE,
        STORAGE_KEYS.FOLLOWING_LIST,

        // Offline data
        STORAGE_KEYS.OFFLINE_GOALS,
        STORAGE_KEYS.OFFLINE_MOTIVATION,

        // Cache
        STORAGE_KEYS.API_CACHE,
        STORAGE_KEYS.IMAGES_CACHE,
      ];

      await AsyncStorage.multiRemove(keysToRemove);

      // Also clear any dynamic cache keys (cache_*, offline_*, user_pref_*, secure_*)
      const allKeys = await AsyncStorage.getAllKeys();
      const dynamicKeys = allKeys.filter(
        (key) =>
          key.startsWith("cache_") ||
          key.startsWith("offline_") ||
          key.startsWith("user_pref_") ||
          key.startsWith("secure_")
      );

      if (dynamicKeys.length > 0) {
        await AsyncStorage.multiRemove(dynamicKeys);
      }

      console.log("Successfully cleared all user data from storage");
    } catch (error) {
      console.error("Error clearing all storage:", error);
      throw error;
    }
  }

  /**
   * Clear only authentication-related data (for expired sessions).
   * Preserves user preferences, notification settings, and onboarding state.
   * Only clears tokens so user can log back in without losing their preferences.
   */
  async clearAuthData(): Promise<void> {
    try {
      const keysToRemove = [
        STORAGE_KEYS.AUTH_TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        // Note: USER_DATA is kept for offline UI purposes (will be refreshed on login)
        // Note: NOTIFICATION_PREFERENCES are user preferences and should persist
      ];

      await AsyncStorage.multiRemove(keysToRemove);
      console.log("Successfully cleared auth data from storage");
    } catch (error) {
      console.error("Error clearing auth data:", error);
      throw error;
    }
  }

  // Secure storage operations (for sensitive data like tokens)
  async setSecureItem(key: string, value: string): Promise<void> {
    try {
      // In a production app, you might want to use expo-secure-store
      // For now, we'll use AsyncStorage with a prefix
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

  // JSON storage operations
  async setObject(key: string, value: any): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      await this.setItem(key, jsonValue);
    } catch (error) {
      console.error("Error storing object:", error);
      throw error;
    }
  }

  async getObject(key: string): Promise<any | null> {
    try {
      const jsonValue = await this.getItem<string>(key);
      return jsonValue ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error("Error retrieving object:", error);
      return null;
    }
  }

  // User preferences
  async setUserPreference(key: string, value: any): Promise<void> {
    try {
      await this.setObject(`user_pref_${key}`, value);
    } catch (error) {
      console.error("Error storing user preference:", error);
      throw error;
    }
  }

  async getUserPreference(key: string): Promise<any | null> {
    try {
      return await this.getObject(`user_pref_${key}`);
    } catch (error) {
      console.error("Error retrieving user preference:", error);
      return null;
    }
  }

  // Cache operations
  async setCacheItem(
    key: string,
    value: any,
    ttl: number = 3600000
  ): Promise<void> {
    try {
      const cacheData = {
        value,
        timestamp: Date.now(),
        ttl,
      };
      await this.setObject(`cache_${key}`, cacheData);
    } catch (error) {
      console.error("Error storing cache item:", error);
      throw error;
    }
  }

  async getCacheItem(key: string): Promise<any | null> {
    try {
      const cacheData = await this.getObject(`cache_${key}`);
      if (!cacheData) return null;

      const now = Date.now();
      if (now - cacheData.timestamp > cacheData.ttl) {
        // Cache expired
        await this.removeItem(`cache_${key}`);
        return null;
      }

      return cacheData.value;
    } catch (error) {
      console.error("Error retrieving cache item:", error);
      return null;
    }
  }

  // Offline data operations
  async setOfflineData(key: string, value: any): Promise<void> {
    try {
      await this.setObject(`offline_${key}`, value);
    } catch (error) {
      console.error("Error storing offline data:", error);
      throw error;
    }
  }

  async getOfflineData(key: string): Promise<any | null> {
    try {
      return await this.getObject(`offline_${key}`);
    } catch (error) {
      console.error("Error retrieving offline data:", error);
      return null;
    }
  }
}

export const storageUtil = new StorageUtil();
