/**
 * Capture referral attribution on app launch:
 * - Android: Play Store Install Referrer API (referrer=ref%3DCODE)
 * - iOS: No automatic capture (clipboard approach removed - caused "Allow paste?" prompts and issues)
 */
import { Platform } from "react-native";
import { setPendingReferralCode } from "./referralStorage";

const REFERRAL_PREFIX = "ref=";

export async function captureInstallReferrerIfNeeded(): Promise<void> {
  // Android: Play Store Install Referrer
  if (Platform.OS === "android") {
    try {
      const RNInstallReferrer = require("react-native-install-referrer");
      const result = await RNInstallReferrer.getReferrer();
      if (!result || typeof result !== "object") return;
      const raw = result.installReferrer ?? result.referrer;
      if (typeof raw !== "string" || !raw) return;
      const code = parseReferrerToCode(raw);
      if (code) await setPendingReferralCode(code);
    } catch (_e) {
      // Module not linked or not available
    }
  }
  // iOS: No clipboard capture - users can enter referral code manually on signup
}

/**
 * Parse Play Store referrer string. We send referrer=ref%3DCODE so raw is "ref=CODE".
 */
function parseReferrerToCode(raw: string): string | null {
  const decoded = decodeURIComponent(raw.trim());
  if (decoded.startsWith(REFERRAL_PREFIX)) {
    const code = decoded.slice(REFERRAL_PREFIX.length).trim();
    return code || null;
  }
  return null;
}
