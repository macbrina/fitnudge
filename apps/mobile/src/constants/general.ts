/**
 * General app constants
 *
 * IMPORTANT: These are FALLBACK values used when the backend is unreachable.
 * The actual values are fetched from the database via useAppConfig hook.
 * Update via admin panel, not here (unless updating fallbacks).
 */

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

// Predefined profile avatars
export const PROFILE_AVATARS = [
  // People & Expressions
  { id: "avatar_1", icon: "person-circle", color: "#3B82F6" },
  { id: "avatar_2", icon: "happy", color: "#10B981" },
  { id: "avatar_3", icon: "happy-outline", color: "#22C55E" },
  { id: "avatar_4", icon: "skull", color: "#6B7280" },
  { id: "avatar_5", icon: "body", color: "#8B5CF6" },
  // Fitness & Sports
  { id: "avatar_6", icon: "fitness", color: "#F59E0B" },
  { id: "avatar_7", icon: "barbell", color: "#EF4444" },
  { id: "avatar_8", icon: "bicycle", color: "#06B6D4" },
  { id: "avatar_9", icon: "football", color: "#84CC16" },
  { id: "avatar_10", icon: "basketball", color: "#F97316" },
  { id: "avatar_11", icon: "tennisball", color: "#FBBF24" },
  { id: "avatar_12", icon: "walk", color: "#14B8A6" },
  // Achievement & Energy
  { id: "avatar_13", icon: "trophy", color: "#F97316" },
  { id: "avatar_14", icon: "medal", color: "#EAB308" },
  { id: "avatar_15", icon: "ribbon", color: "#EC4899" },
  { id: "avatar_16", icon: "star", color: "#8B5CF6" },
  { id: "avatar_17", icon: "flash", color: "#EC4899" },
  { id: "avatar_18", icon: "flame", color: "#DC2626" },
  { id: "avatar_19", icon: "rocket", color: "#06B6D4" },
  { id: "avatar_20", icon: "sparkles", color: "#A855F7" },
  // Nature & Elements
  { id: "avatar_21", icon: "leaf", color: "#22C55E" },
  { id: "avatar_22", icon: "flower", color: "#F472B6" },
  { id: "avatar_23", icon: "rose", color: "#E11D48" },
  { id: "avatar_24", icon: "moon", color: "#6366F1" },
  { id: "avatar_25", icon: "sunny", color: "#FBBF24" },
  { id: "avatar_26", icon: "cloud", color: "#60A5FA" },
  { id: "avatar_27", icon: "snow", color: "#38BDF8" },
  { id: "avatar_28", icon: "thunderstorm", color: "#7C3AED" },
  { id: "avatar_29", icon: "water", color: "#0EA5E9" },
  // Animals
  { id: "avatar_30", icon: "paw", color: "#D97706" },
  { id: "avatar_31", icon: "fish", color: "#0891B2" },
  { id: "avatar_32", icon: "bug", color: "#65A30D" },
  // Symbols & Objects
  { id: "avatar_33", icon: "heart", color: "#EF4444" },
  { id: "avatar_34", icon: "diamond", color: "#06B6D4" },
  { id: "avatar_35", icon: "cube", color: "#8B5CF6" },
  { id: "avatar_36", icon: "prism", color: "#EC4899" },
  { id: "avatar_37", icon: "pizza", color: "#F97316" },
  { id: "avatar_38", icon: "cafe", color: "#92400E" },
  { id: "avatar_39", icon: "beer", color: "#CA8A04" },
  { id: "avatar_40", icon: "ice-cream", color: "#FB7185" },
  // Tech & Gaming
  { id: "avatar_41", icon: "game-controller", color: "#4F46E5" },
  { id: "avatar_42", icon: "headset", color: "#7C3AED" },
  { id: "avatar_43", icon: "musical-notes", color: "#DB2777" },
  { id: "avatar_44", icon: "planet", color: "#0D9488" },
  // Misc Fun
  { id: "avatar_45", icon: "glasses", color: "#374151" },
  { id: "avatar_46", icon: "balloon", color: "#F43F5E" },
  { id: "avatar_47", icon: "gift", color: "#C026D3" },
  { id: "avatar_48", icon: "airplane", color: "#2563EB" }
];
