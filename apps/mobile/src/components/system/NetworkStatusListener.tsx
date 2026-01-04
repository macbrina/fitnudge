import { useEffect } from "react";
import NetInfo from "@react-native-community/netinfo";
import { useSystemStatusStore } from "@/stores/systemStatusStore";

/**
 * Listens to device network connectivity changes and updates the system status store.
 * This component should be mounted once at the app root level.
 */
export function NetworkStatusListener() {
  const setNetworkConnected = useSystemStatusStore((s) => s.setNetworkConnected);

  useEffect(() => {
    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener((state) => {
      // isConnected can be null on first call, treat as unknown (assume connected)
      setNetworkConnected(state.isConnected ?? true);
    });

    // Also do an initial check
    NetInfo.fetch().then((state) => {
      setNetworkConnected(state.isConnected ?? true);
    });

    return () => {
      unsubscribe();
    };
  }, [setNetworkConnected]);

  return null;
}
