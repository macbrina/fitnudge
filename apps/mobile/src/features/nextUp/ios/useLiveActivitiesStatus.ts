import { useState, useCallback, useEffect } from "react";
import { AppState, Platform } from "react-native";

const getExpoModule = () => {
  if (Platform.OS !== "ios") return null;
  try {
    return require("local:next-up-live-activity");
  } catch {
    return null;
  }
};

/**
 * Returns the current Live Activities system setting status (iOS only).
 * Use refresh() when the user returns from Settings to get the latest value.
 */
export function useLiveActivitiesStatus(): {
  enabled: boolean | null;
  refresh: () => void;
} {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  const refresh = useCallback(() => {
    if (Platform.OS !== "ios") {
      setEnabled(false);
      return;
    }
    const mod = getExpoModule();
    setEnabled(mod?.areActivitiesEnabled?.() ?? false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return { enabled, refresh };
}
