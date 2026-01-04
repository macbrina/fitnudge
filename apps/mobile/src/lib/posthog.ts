import PostHog from "posthog-react-native";
import Constants from "expo-constants";

// Get PostHog configuration from environment variables
const POSTHOG_API_KEY =
  Constants.expoConfig?.extra?.posthogApiKey || process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
const POSTHOG_HOST =
  Constants.expoConfig?.extra?.posthogHost ||
  process.env.EXPO_PUBLIC_POSTHOG_HOST ||
  "https://us.i.posthog.com";

if (!POSTHOG_API_KEY) {
  console.warn("PostHog API key not found. PostHog analytics will be disabled.");
}

// Create PostHog instance
export const posthog = new PostHog(POSTHOG_API_KEY || "phc_disabled", {
  host: POSTHOG_HOST,
  // Disable in development if needed
  disabled: __DEV__ && !POSTHOG_API_KEY
});

// Helper function to identify users
export const identifyUser = (userId: string, userProperties?: Record<string, any>) => {
  if (posthog) {
    posthog.identify(userId, userProperties);
  }
};

// Helper function to reset user (on logout)
export const resetUser = () => {
  if (posthog) {
    posthog.reset();
  }
};

// Helper function to capture events
export const captureEvent = (eventName: string, properties?: Record<string, any>) => {
  if (posthog) {
    posthog.capture(eventName, properties);
  }
};

// Helper function to set user properties
export const setUserProperties = (properties: Record<string, any>) => {
  if (posthog) {
    // PostHog React Native doesn't have people.set, use identify instead
    posthog.identify(undefined, properties);
  }
};

// Helper function to get feature flag
export const getFeatureFlag = (flagKey: string, defaultValue?: any) => {
  if (posthog) {
    return posthog.getFeatureFlag(flagKey);
  }
  return defaultValue;
};

// Helper function to check if feature flag is enabled
export const isFeatureEnabled = (flagKey: string): boolean => {
  if (posthog) {
    return posthog.isFeatureEnabled(flagKey) || false;
  }
  return false;
};

export default posthog;
