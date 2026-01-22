/**
 * AdMob Ad Unit IDs
 *
 * This file contains all ad unit IDs for both iOS and Android.
 * In development, test IDs are used automatically.
 *
 * IMPORTANT: Replace the placeholder IDs with your actual AdMob ad unit IDs
 * before publishing to production.
 *
 * @see docs/ADMOB_SETUP.md for setup instructions
 */

import { TestIds } from "react-native-google-mobile-ads";
import { Platform } from "react-native";

/**
 * Production ad unit IDs organized by platform.
 *
 * TODO: Replace these placeholder IDs with your actual AdMob ad unit IDs
 */
const AD_UNITS = {
  ios: {
    HOME_BANNER: "ca-app-pub-6576776260143449/7659405612",
    GOAL_DETAIL_BANNER: "ca-app-pub-6576776260143449/7339841411",
    PROGRESS_BANNER: "ca-app-pub-6576776260143449/4083122680",
    BLOG_NATIVE: "ca-app-pub-6576776260143449/7132985522",
    AI_MESSAGE: "ca-app-pub-6576776260143449/5105587980"
  },
  android: {
    HOME_BANNER: "ca-app-pub-6576776260143449/7540179634",
    GOAL_DETAIL_BANNER: "ca-app-pub-6576776260143449/3891550994",
    PROGRESS_BANNER: "ca-app-pub-6576776260143449/6154752259",
    BLOG_NATIVE: "ca-app-pub-6576776260143449/8565293171",
    AI_MESSAGE: "ca-app-pub-6576776260143449/5939129830"
  }
} as const;

export type AdUnitKey = keyof (typeof AD_UNITS)["ios"];

/**
 * Get the appropriate ad unit ID for the current platform.
 *
 * In development (__DEV__), returns Google's official test ad unit IDs.
 * In production, returns the platform-specific production ad unit ID.
 *
 * @param key - The ad unit key (e.g., "HOME_BANNER", "BLOG_NATIVE")
 * @returns The ad unit ID string
 *
 * @example
 * ```tsx
 * import { getAdUnitId } from "@/constants/adUnits";
 *
 * <BannerAd unitId={getAdUnitId("HOME_BANNER")} />
 * ```
 */
export const getAdUnitId = (key: AdUnitKey): string => {
  if (__DEV__) {
    // Return test IDs in development to avoid policy violations
    switch (key) {
      case "AI_MESSAGE":
        return TestIds.REWARDED;
      case "BLOG_NATIVE":
        return TestIds.NATIVE;
      default:
        return TestIds.BANNER;
    }
  }

  const platform = Platform.OS === "ios" ? "ios" : "android";
  return AD_UNITS[platform][key];
};

/**
 * Ad placement configuration
 */
export const AD_CONFIG = {
  /** How often to show native ads in feeds (every N items) */
  NATIVE_AD_FREQUENCY: 4,

  /** Minimum items before showing first native ad */
  MIN_ITEMS_FOR_NATIVE_AD: 3
} as const;
