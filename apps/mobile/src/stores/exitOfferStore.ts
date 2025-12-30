/**
 * Exit Offer Store
 *
 * Tracks the active exit offer countdown globally so it can be
 * displayed on other screens (like HomeScreen) with a floating button.
 *
 * Flow:
 * 1. FIRST TIME: User opens SubscriptionScreen → exits → Exit offer shows
 *    - Recorded as show #1
 * 2. SUBSEQUENT (2-5): FloatingOfferButton appears PROACTIVELY on HomeScreen
 *    - Every 7 days, automatically shows countdown
 *    - No need to go through SubscriptionScreen again
 * 3. AFTER 5 TIMES: Never shows again
 *
 * Rules:
 * - Maximum 5 times total (~5 weeks of opportunities)
 * - 7-day cooldown between shows
 * - If user has EVER subscribed (even cancelled), never shows
 */

import { create } from "zustand";
import { storageUtil, STORAGE_KEYS } from "@/utils/storageUtil";

// Use the same storage keys as storageUtil for consistency
const EXIT_OFFER_LAST_SHOWN = STORAGE_KEYS.EXIT_OFFER_LAST_SHOWN;
const EXIT_OFFER_SHOW_COUNT = STORAGE_KEYS.EXIT_OFFER_SHOW_COUNT;
const HAS_EVER_SUBSCRIBED = STORAGE_KEYS.HAS_EVER_SUBSCRIBED;
const HAS_DISMISSED_EXIT_INTENT = STORAGE_KEYS.HAS_DISMISSED_EXIT_INTENT;

// Constants
const SHOW_INTERVAL_DAYS = 7; // Show every 7 days
const MAX_SHOW_COUNT = 5; // Maximum times to show (~5 weeks)
const COUNTDOWN_MINUTES = 15; // 15 minute countdown

interface ExitOfferState {
  // State
  expiryTime: Date | null;
  isActive: boolean;
  hasCheckedProactive: boolean;

  // Exit Intent Modal visibility (global state shared across screens)
  showExitIntentModal: boolean;

  // Actions
  setExitOffer: (expiryTime: Date) => void;
  clearExitOffer: () => void;
  getTimeRemaining: () => number;

  // Exit Intent Modal visibility actions
  openExitIntentModal: () => void;
  closeExitIntentModal: () => void;

  // Proactive offer logic
  checkAndShowProactiveOffer: (hasEverSubscribed: boolean) => Promise<boolean>;
  markAsSubscribed: () => Promise<void>;
  canShowOffer: (hasEverSubscribed: boolean) => Promise<boolean>;
  recordOfferShown: () => Promise<void>;

  // Exit Intent Modal dismissed tracking
  // This is set ONLY when user closes ExitIntentModal (not when it's shown)
  markExitIntentDismissed: () => Promise<void>;
  hasExitIntentBeenDismissed: () => Promise<boolean>;

  // Testing/Debug
  resetForTesting: () => Promise<void>;

  // Check if exit offer has ever been shown (for SubscriptionScreen to know)
  hasEverBeenShown: () => Promise<boolean>;
}

export const useExitOfferStore = create<ExitOfferState>((set, get) => ({
  expiryTime: null,
  isActive: false,
  hasCheckedProactive: false,
  showExitIntentModal: false,

  setExitOffer: (expiryTime: Date) => {
    set({
      expiryTime,
      isActive: true,
    });
  },

  clearExitOffer: () => {
    set({
      expiryTime: null,
      isActive: false,
    });
  },

  openExitIntentModal: () => {
    set({ showExitIntentModal: true });
  },

  closeExitIntentModal: () => {
    set({ showExitIntentModal: false });
  },

  getTimeRemaining: () => {
    const { expiryTime, isActive } = get();
    if (!expiryTime || !isActive) return 0;

    const now = Date.now();
    const remaining = Math.max(
      0,
      Math.floor((expiryTime.getTime() - now) / 1000),
    );

    // Auto-clear if expired
    if (remaining <= 0) {
      set({ expiryTime: null, isActive: false });
    }

    return remaining;
  },

  /**
   * Check if user has EVER subscribed (stored locally)
   * This is set when user successfully subscribes
   */
  markAsSubscribed: async () => {
    await storageUtil.setItem(HAS_EVER_SUBSCRIBED, "true");
  },

  /**
   * Check if we can show the offer
   * - User has never subscribed
   * - Not shown more than 3 times total
   * - At least 7 days since last shown
   */
  canShowOffer: async (hasEverSubscribed: boolean) => {
    // Never show to users who have ever subscribed
    if (hasEverSubscribed) {
      return false;
    }

    // Also check local storage flag
    const localHasSubscribed = await storageUtil.getItem(HAS_EVER_SUBSCRIBED);
    if (localHasSubscribed === "true") {
      return false;
    }

    // Check show count
    const showCount = await storageUtil.getItem<number>(EXIT_OFFER_SHOW_COUNT);
    if (showCount !== null && showCount >= MAX_SHOW_COUNT) {
      return false;
    }

    // Check last shown date
    const lastShownStr = await storageUtil.getItem<string>(
      EXIT_OFFER_LAST_SHOWN,
    );
    if (lastShownStr) {
      const lastShown = new Date(lastShownStr);
      const daysSinceLastShown =
        (Date.now() - lastShown.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceLastShown < SHOW_INTERVAL_DAYS) {
        return false;
      }
    }

    return true;
  },

  /**
   * Record that the offer was shown
   */
  recordOfferShown: async () => {
    // Update last shown timestamp
    await storageUtil.setItem(EXIT_OFFER_LAST_SHOWN, new Date().toISOString());

    // Increment show count
    const currentCount = await storageUtil.getItem<number>(
      EXIT_OFFER_SHOW_COUNT,
    );
    await storageUtil.setItem(EXIT_OFFER_SHOW_COUNT, (currentCount || 0) + 1);
  },

  /**
   * Mark that the ExitIntentModal has been dismissed by the user.
   * This is called ONLY when the user closes the ExitIntentModal.
   * The FloatingOfferButton will ONLY show proactively after this is true.
   */
  markExitIntentDismissed: async () => {
    await storageUtil.setItem(HAS_DISMISSED_EXIT_INTENT, "true");
  },

  /**
   * Check if the ExitIntentModal has ever been dismissed
   */
  hasExitIntentBeenDismissed: async () => {
    const dismissed = await storageUtil.getItem(HAS_DISMISSED_EXIT_INTENT);
    return dismissed === "true";
  },

  /**
   * Check and show proactive offer if eligible
   * Called on HomeScreen mount
   *
   * IMPORTANT: Proactive offers only show AFTER:
   * 1. User opened SubscriptionScreen
   * 2. User closed it (which shows ExitIntentModal)
   * 3. User DISMISSED the ExitIntentModal
   *
   * Only after step 3 will FloatingOfferButton show proactively.
   *
   * Returns true if offer was shown
   */
  checkAndShowProactiveOffer: async (hasEverSubscribed: boolean) => {
    const {
      isActive,
      hasCheckedProactive,
      canShowOffer,
      recordOfferShown,
      hasExitIntentBeenDismissed,
    } = get();

    // Don't check again if already checked this session or offer is active
    if (hasCheckedProactive || isActive) {
      return false;
    }

    set({ hasCheckedProactive: true });

    // CRITICAL: Only show proactively if user has DISMISSED the ExitIntentModal
    // This ensures user has completed the full flow:
    // SubscriptionScreen → close → ExitIntentModal → dismiss
    const hasDismissed = await hasExitIntentBeenDismissed();
    if (!hasDismissed) {
      return false;
    }

    const canShow = await canShowOffer(hasEverSubscribed);
    if (!canShow) {
      return false;
    }

    // Start the countdown
    const expiryTime = new Date(Date.now() + COUNTDOWN_MINUTES * 60 * 1000);
    set({
      expiryTime,
      isActive: true,
    });

    // Record that we showed the offer
    await recordOfferShown();

    console.info("[ExitOfferStore] ✅ Proactive offer SHOWN");
    return true;
  },

  /**
   * Reset all exit offer state for testing
   * Clears storage and resets in-memory state
   */
  resetForTesting: async () => {
    // Clear storage
    await storageUtil.removeItem(EXIT_OFFER_LAST_SHOWN);
    await storageUtil.removeItem(EXIT_OFFER_SHOW_COUNT);
    await storageUtil.removeItem(HAS_EVER_SUBSCRIBED);
    await storageUtil.removeItem(HAS_DISMISSED_EXIT_INTENT);

    // Reset in-memory state
    set({
      expiryTime: null,
      isActive: false,
      hasCheckedProactive: false,
      showExitIntentModal: false,
    });

    console.info("[ExitOfferStore] Reset for testing - all state cleared");
  },

  /**
   * Check if the exit offer has ever been shown before
   * Used by SubscriptionScreen to know if it should trigger exit offer
   * (Only triggers on first time, subsequent shows are proactive from HomeScreen)
   */
  hasEverBeenShown: async () => {
    const showCount = await storageUtil.getItem<number>(EXIT_OFFER_SHOW_COUNT);
    return showCount !== null && showCount > 0;
  },
}));
