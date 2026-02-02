/**
 * Capture referral attribution on app launch:
 * - Android: Play Store Install Referrer API (referrer=ref%3DCODE)
 * - iOS: Clipboard (FITNUDGE_REF:CODE copied by /join page before App Store redirect)
 */
import { Platform } from "react-native";
import * as Clipboard from "expo-clipboard";
import { setPendingReferralCode } from "./referralStorage";

const REFERRAL_PREFIX = "ref=";
const CLIPBOARD_REF_PREFIX = "FITNUDGE_REF:";

/** iOS: Read clipboard for FITNUDGE_REF:CODE (copied by /join page before App Store). */
async function captureClipboardReferrerIfNeeded(): Promise<void> {
  if (Platform.OS !== "ios") return;
  try {
    const text = await Clipboard.getStringAsync();
    if (!text || typeof text !== "string") return;
    const trimmed = text.trim();
    if (!trimmed.startsWith(CLIPBOARD_REF_PREFIX)) return;
    const code = trimmed.slice(CLIPBOARD_REF_PREFIX.length).trim();
    if (code) await setPendingReferralCode(code);
  } catch (_e) {
    // Clipboard read may prompt "Allow paste?" - user can deny
  }
}

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
    return;
  }

  // iOS: Clipboard (copied by /join page before App Store redirect)
  await captureClipboardReferrerIfNeeded();
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
