/**
 * App Config API Service
 *
 * Fetches dynamic app configuration values from the backend.
 * These values can be updated by admin without requiring an app release.
 *
 * No authentication required for public configs.
 */

import { BaseApiService } from "./base";
import { ROUTES } from "@/lib/routes";

export interface AppConfigItem {
  key: string;
  value: string;
  category: string;
}

export interface AppConfigResponse {
  config: Record<string, string>; // Key-value pairs for easy access
  items: AppConfigItem[]; // Full items with category info
}

/**
 * Typed config keys for type-safe access
 */
export type AppConfigKey =
  // App Store URLs
  | "ios_app_store_url"
  | "android_play_store_url"
  // External URLs
  | "privacy_policy_url"
  | "terms_of_service_url"
  | "help_center_url"
  | "tally_feedback_url"
  | "tally_bug_url"
  | "tawk_chat_url"
  | "contact_email";

export type AppConfigCategory = "app_store_urls" | "external_urls" | "feature_flags";

class AppConfigApiService extends BaseApiService {
  /**
   * Get all public app configuration values
   */
  async getPublicConfig(): Promise<AppConfigResponse> {
    const response = await this.get<AppConfigResponse>(ROUTES.APP_CONFIG.PUBLIC);
    return response.data ?? { config: {}, items: [] };
  }

  /**
   * Get public config values filtered by category
   */
  async getConfigByCategory(category: AppConfigCategory): Promise<AppConfigResponse> {
    const response = await this.get<AppConfigResponse>(ROUTES.APP_CONFIG.BY_CATEGORY(category));
    return response.data ?? { config: {}, items: [] };
  }
}

// Export singleton instance
export const appConfigService = new AppConfigApiService();
