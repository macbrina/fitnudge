/**
 * AdMob Initialization Store
 *
 * Tracks whether the AdMob SDK has been initialized.
 * Ad components should check this before rendering to avoid crashes.
 */

import { create } from "zustand";

interface AdState {
  isInitialized: boolean;
  setInitialized: (value: boolean) => void;
}

export const useAdMobStore = create<AdState>((set) => ({
  isInitialized: false,
  setInitialized: (value: boolean) => set({ isInitialized: value })
}));
