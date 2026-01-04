import { usePostHog as usePostHogBase } from "posthog-react-native";
import { captureEvent, setUserProperties, getFeatureFlag, isFeatureEnabled } from "@/lib/posthog";

export const usePostHog = (): {
  posthog: any;
  capture: typeof captureEvent;
  setUserProperties: typeof setUserProperties;
  getFeatureFlag: typeof getFeatureFlag;
  isFeatureEnabled: typeof isFeatureEnabled;
  identify: any;
  reset: any;
  alias: any;
  group: any;
  flush: any;
} => {
  const posthog = usePostHogBase();

  return {
    // Core PostHog instance
    posthog,

    // Helper methods
    capture: captureEvent,
    setUserProperties,
    getFeatureFlag,
    isFeatureEnabled,

    // Direct access to PostHog methods
    identify: posthog?.identify.bind(posthog),
    reset: posthog?.reset.bind(posthog),
    alias: posthog?.alias.bind(posthog),
    group: posthog?.group.bind(posthog),
    flush: posthog?.flush.bind(posthog)
  };
};

export default usePostHog;
