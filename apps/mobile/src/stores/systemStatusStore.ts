import { create } from "zustand";

export type BackendStatus = "online" | "degraded" | "offline";

interface SystemStatusState {
  backendStatus: BackendStatus;
  lastChecked: number | null;
  reason: string | null;
  setBackendStatus: (status: BackendStatus, reason?: string | null) => void;
  clearReason: () => void;
}

export const useSystemStatusStore = create<SystemStatusState>((set) => ({
  backendStatus: "online",
  lastChecked: null,
  reason: null,
  setBackendStatus: (status, reason = null) =>
    set({
      backendStatus: status,
      lastChecked: Date.now(),
      reason,
    }),
  clearReason: () =>
    set({
      reason: null,
    }),
}));
