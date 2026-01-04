import { create } from "zustand";

export type BackendStatus = "online" | "degraded" | "offline";

interface SystemStatusState {
  // Network connectivity (device level)
  isNetworkConnected: boolean | null;

  // Backend status (API level)
  backendStatus: BackendStatus;
  lastChecked: number | null;
  reason: string | null;

  // Actions
  setNetworkConnected: (connected: boolean | null) => void;
  setBackendStatus: (status: BackendStatus, reason?: string | null) => void;
  clearReason: () => void;
}

export const useSystemStatusStore = create<SystemStatusState>((set) => ({
  isNetworkConnected: true, // Assume connected initially
  backendStatus: "online",
  lastChecked: null,
  reason: null,

  setNetworkConnected: (connected) => set({ isNetworkConnected: connected }),

  setBackendStatus: (status, reason = null) =>
    set({
      backendStatus: status,
      lastChecked: Date.now(),
      reason
    }),

  clearReason: () => set({ reason: null })
}));

// Helper hook to check if app is offline (network or backend)
export const useIsOffline = () => {
  const isNetworkConnected = useSystemStatusStore((s) => s.isNetworkConnected);
  const backendStatus = useSystemStatusStore((s) => s.backendStatus);
  return isNetworkConnected === false || backendStatus === "offline";
};
