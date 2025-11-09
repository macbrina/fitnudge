import { useEffect } from "react";
import { fetchBackendHealth } from "@/services/system/systemStatusService";

const CHECK_INTERVAL = 60_000;

export const useBackendHealthMonitor = () => {
  useEffect(() => {
    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const runCheck = async () => {
      await fetchBackendHealth();
      if (!isMounted) {
        return;
      }
      timeoutId = setTimeout(runCheck, CHECK_INTERVAL);
    };

    runCheck();

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);
};
