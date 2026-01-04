import { NetworkStatusListener } from "./NetworkStatusListener";
import { OfflineOverlay } from "./OfflineOverlay";

/**
 * System status listener that combines:
 * 1. NetworkStatusListener - Monitors device network connectivity via NetInfo
 * 2. OfflineOverlay - Full-screen overlay when offline (network or backend)
 *
 * The backend health monitoring is handled separately by useBackendHealthMonitor hook.
 */
export function SystemStatusListener() {
  return (
    <>
      <NetworkStatusListener />
      <OfflineOverlay />
    </>
  );
}
