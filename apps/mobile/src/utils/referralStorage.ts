/**
 * Referral storage for install-attribution (e.g. Android Install Referrer).
 * When user installs from Play Store with referrer param, we store the code here;
 * SignupScreen reads it and applies to signup, then clears.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "./storageUtil";

const REFERRAL_EXPIRY_DAYS = 30;

export async function setPendingReferralCode(code: string): Promise<void> {
  if (!code?.trim()) return;
  try {
    const expiry = Date.now() + REFERRAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    await AsyncStorage.setItem(STORAGE_KEYS.PENDING_REFERRAL_CODE, code.trim().toUpperCase());
    await AsyncStorage.setItem(STORAGE_KEYS.PENDING_REFERRAL_EXPIRY, String(expiry));
  } catch (e) {
    console.warn("[ReferralStorage] Failed to set pending referral code", e);
  }
}

/**
 * Returns pending referral code if present and not expired, then removes it (one-time use).
 */
export async function getAndClearPendingReferralCode(): Promise<string | null> {
  try {
    const [code, expiryStr] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.PENDING_REFERRAL_CODE),
      AsyncStorage.getItem(STORAGE_KEYS.PENDING_REFERRAL_EXPIRY)
    ]);
    if (!code) return null;
    const expiry = expiryStr ? Number(expiryStr) : 0;
    if (expiry && Date.now() > expiry) {
      await clearPendingReferralCode();
      return null;
    }
    await clearPendingReferralCode();
    return code;
  } catch (e) {
    console.warn("[ReferralStorage] Failed to get pending referral code", e);
    return null;
  }
}

export async function clearPendingReferralCode(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.PENDING_REFERRAL_CODE,
      STORAGE_KEYS.PENDING_REFERRAL_EXPIRY
    ]);
  } catch (e) {
    console.warn("[ReferralStorage] Failed to clear pending referral code", e);
  }
}
