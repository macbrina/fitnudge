/**
 * General app constants
 *
 * IMPORTANT: These are FALLBACK values used when the backend is unreachable.
 * The actual values are fetched from the database via useAppConfig hook.
 * Update via admin panel, not here (unless updating fallbacks).
 */

import { toRN } from "@/lib/units";
import { tokens } from "@/themes/tokens";

// FALLBACK App Store URLs - used when API is unreachable
// Actual values are fetched from app_config table
export const FALLBACK_APP_STORE_URLS = {
  IOS: "https://apps.apple.com/app/fitnudge/id123456789", // TODO: Replace with actual App Store ID
  ANDROID: "https://play.google.com/store/apps/details?id=com.fitnudge.app" // TODO: Replace with actual package name
} as const;

// FALLBACK External URLs - used when API is unreachable
// Actual values are fetched from app_config table
export const FALLBACK_EXTERNAL_URLS = {
  PRIVACY_POLICY: "https://fitnudge.app/privacy-policy",
  TERMS_OF_SERVICE: "https://fitnudge.app/terms-of-service",
  HELP_CENTER: "https://fitnudge.tawk.help/",
  TALLY_SO: "https://tally.so/r/2EaLE9",
  TALLY_BUG: "https://tally.so/r/Y54p2J",
  TAWK_TO_CHAT: "https://tawk.to/chat/695732b53a0c9b197f142f94/1jdu9s5a9",
  CONTACT: "mailto:hello@fitnudge.app"
} as const;

/**
 * @deprecated Use useAppStoreUrls() hook instead for dynamic values
 */
export const APP_STORE_URLS = FALLBACK_APP_STORE_URLS;

/**
 * @deprecated Use useExternalUrls() hook instead for dynamic values
 */
export const EXTERNAL_URLS = FALLBACK_EXTERNAL_URLS;

// Profile avatars 1–32 (assets/avatars/avatar-1.svg … avatar-32.svg). IDs match filenames.
export const AVATAR_IDS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "30",
  "31",
  "32"
] as const;

export const PROFILE_AVATARS = AVATAR_IDS.map((id) => ({ id }));

export const CARD_PADDING_VALUES = {
  SM: toRN(tokens.spacing[2]),
  MD: toRN(tokens.spacing[3]),
  LG: toRN(tokens.spacing[4]),
  XL: toRN(tokens.spacing[5])
};
