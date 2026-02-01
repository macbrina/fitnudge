import * as StoreReview from "expo-store-review";
import { storageUtil, STORAGE_KEYS } from "./storageUtil";

const RATING_DELAY_MS = 1200;

export interface RequestRatingIfFirstCheckInParams {
  /** Total check-ins before this create (from stats). Prompt only when 0 → first ever. */
  totalCheckInsBeforeCreate: number;
  /** Only prompt after a completed (Yes) check-in, not skip/rest day. */
  completed: boolean;
}

/**
 * Request in-app review after the user's first *completed* check-in.
 * Uses native StoreKit / In-App Review; only runs once per user (persisted).
 * Call fire-and-forget from check-in success handler.
 */
export async function requestRatingIfFirstCheckIn(
  params: RequestRatingIfFirstCheckInParams
): Promise<void> {
  const { totalCheckInsBeforeCreate, completed } = params;

  if (!completed || totalCheckInsBeforeCreate !== 0) return;

  try {
    const already = await storageUtil.getItem<boolean>(STORAGE_KEYS.HAS_REQUESTED_RATING);
    if (already) return;

    await new Promise((r) => setTimeout(r, RATING_DELAY_MS));

    const available = await StoreReview.isAvailableAsync();
    if (!available) return;

    await StoreReview.requestReview();
    await storageUtil.setItem(STORAGE_KEYS.HAS_REQUESTED_RATING, true);
  } catch {
    // Silently skip (simulator, rate-limited, etc.)
  }
}
