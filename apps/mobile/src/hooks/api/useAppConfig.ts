/**
 * App Config Hook
 *
 * Fetches and caches dynamic app configuration values.
 * These can be updated by admin without requiring an app release.
 *
 * Features:
 * - Aggressive caching (24 hours stale time)
 * - Fallback values for offline/error scenarios
 * - Type-safe config access
 */

import { useQuery, QueryClient } from "@tanstack/react-query";
import { Platform } from "react-native";
import { appConfigService, AppConfigResponse, AppConfigKey } from "@/services/api/appConfig";
import { FALLBACK_APP_STORE_URLS, FALLBACK_EXTERNAL_URLS } from "@/constants/general";

// Query Keys
export const appConfigQueryKeys = {
  all: ["appConfig"] as const,
  public: () => [...appConfigQueryKeys.all, "public"] as const,
  byCategory: (category: string) => [...appConfigQueryKeys.all, category] as const
} as const;

// Stale time: 24 hours - config rarely changes
const STALE_TIME = 24 * 60 * 60 * 1000;

// GC time: Never - keep in cache indefinitely
const GC_TIME = Infinity;

/**
 * Fetch and cache all public app configuration
 */
export function useAppConfig() {
  return useQuery({
    queryKey: appConfigQueryKeys.public(),
    queryFn: () => appConfigService.getPublicConfig(),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    // Retry on failure
    retry: 2,
    retryDelay: 1000
  });
}

/**
 * Get a single config value with fallback
 */
function getConfigValue(
  config: Record<string, string> | undefined,
  key: AppConfigKey,
  fallback: string
): string {
  return config?.[key] ?? fallback;
}

/**
 * Hook for app store URLs with fallbacks
 */
export function useAppStoreUrls() {
  const { data, isLoading, error } = useAppConfig();

  const iosUrl = getConfigValue(data?.config, "ios_app_store_url", FALLBACK_APP_STORE_URLS.IOS);

  const androidUrl = getConfigValue(
    data?.config,
    "android_play_store_url",
    FALLBACK_APP_STORE_URLS.ANDROID
  );

  // Get current platform URL
  const currentPlatformUrl = Platform.OS === "ios" ? iosUrl : androidUrl;

  return {
    ios: iosUrl,
    android: androidUrl,
    current: currentPlatformUrl,
    isLoading,
    error
  };
}

/**
 * Hook for external URLs with fallbacks
 */
export function useExternalUrls() {
  const { data, isLoading, error } = useAppConfig();

  return {
    privacyPolicy: getConfigValue(
      data?.config,
      "privacy_policy_url",
      FALLBACK_EXTERNAL_URLS.PRIVACY_POLICY
    ),
    termsOfService: getConfigValue(
      data?.config,
      "terms_of_service_url",
      FALLBACK_EXTERNAL_URLS.TERMS_OF_SERVICE
    ),
    helpCenter: getConfigValue(data?.config, "help_center_url", FALLBACK_EXTERNAL_URLS.HELP_CENTER),
    tallyFeedback: getConfigValue(
      data?.config,
      "tally_feedback_url",
      FALLBACK_EXTERNAL_URLS.TALLY_SO
    ),
    tawkChat: getConfigValue(data?.config, "tawk_chat_url", FALLBACK_EXTERNAL_URLS.TAWK_TO_CHAT),
    contact: getConfigValue(data?.config, "contact_email", FALLBACK_EXTERNAL_URLS.CONTACT),
    isLoading,
    error
  };
}

/**
 * Prefetch app config - call early in app initialization
 * Returns a promise so it can be awaited if needed
 */
export async function prefetchAppConfig(queryClient: QueryClient): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: appConfigQueryKeys.public(),
    queryFn: () => appConfigService.getPublicConfig(),
    staleTime: STALE_TIME
  });
}
