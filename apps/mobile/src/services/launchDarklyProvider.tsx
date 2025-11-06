import React, { ReactNode, useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";

import {
  AutoEnvAttributes,
  LDProvider,
  ReactNativeLDClient,
} from "@launchdarkly/react-native-client-sdk";

import {
  useBoolVariation,
  useLDClient,
} from "@launchdarkly/react-native-client-sdk";

// Fallback components when LaunchDarkly is not available
const FallbackLDProvider = ({ children }: { children: ReactNode }) => {
  return <>{children}</>;
};

const useFallbackBoolVariation = (
  flagKey: string,
  defaultValue: boolean = false
) => {
  console.warn(
    `LaunchDarkly: Using fallback for flag ${flagKey}, returning default: ${defaultValue}`
  );
  return defaultValue;
};

const useFallbackLDClient = () => {
  return {
    identify: async (user: any) => {
      console.warn("LaunchDarkly: Using fallback identify, user:", user);
    },
    track: async (eventKey: string, data?: any) => {
      console.warn("LaunchDarkly: Using fallback track:", eventKey, data);
    },
  };
};

// Create LaunchDarkly client
const createLDClient = () => {
  const clientId = process.env.EXPO_PUBLIC_LAUNCHDARKLY_CLIENT_ID;

  if (!clientId) {
    console.warn("LaunchDarkly: No client ID found in environment variables");
    return null;
  }

  // Optional: Hint if the key does not look like a mobile (Test) key
  if (!clientId.startsWith("mob-")) {
    console.warn(
      "LaunchDarkly: SDK key may be incorrect for Test environment (expected to start with 'mob-')."
    );
  }

  if (!ReactNativeLDClient) {
    console.warn("LaunchDarkly: Native SDK not available");
    return null;
  }

  try {
    return new ReactNativeLDClient(
      clientId,
      AutoEnvAttributes?.Enabled || true,
      {
        debug: false,
        applicationInfo: {
          id: "fitnudge-mobile",
          version: "1.0.0",
        },
      }
    );
  } catch (error) {
    console.error("LaunchDarkly: Failed to create client:", error);
    return null;
  }
};

// User identification component
function UserIdentifier({ children }: { children: ReactNode }) {
  const { user } = useAuthStore();
  const ldClient = useLDClient ? useLDClient() : useFallbackLDClient();

  useEffect(() => {
    if (ldClient && ldClient.identify) {
      const ldUser = user
        ? {
            kind: "user",
            key: user.id,
            email: user.email,
            name: user.name,
            custom: {
              username: user.username,
              plan: user.plan,
              emailVerified: user.email_verified,
              authProvider: user.auth_provider,
              createdAt: user.created_at,
            },
          }
        : {
            kind: "user",
            key: "anonymous",
            anonymous: true,
          };

      // track("68fed7daead2430abe79ae24");
      Promise.resolve(ldClient.identify(ldUser))
        .then(() => {
          // Signal connectivity per LaunchDarkly setup checklist
          if (ldClient && ldClient.track) {
            // Fire-and-forget; RN SDK may return void or Promise
            try {
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              ldClient.track("68fed7daead2430abe79ae24");
            } catch (e) {
              console.warn("LaunchDarkly: track failed", e);
            }
          }
        })
        .catch((error: any) => {
          console.error("LaunchDarkly: Failed to identify user:", error);
        });
    }
  }, [user, ldClient]);

  return <>{children}</>;
}

// Main LaunchDarkly provider component
export function LaunchDarklyProvider({ children }: { children: ReactNode }) {
  const client = createLDClient();

  if (!client || !LDProvider) {
    console.warn("LaunchDarkly: Using fallback provider");
    return (
      <FallbackLDProvider>
        <UserIdentifier>{children}</UserIdentifier>
      </FallbackLDProvider>
    );
  }

  return (
    <LDProvider client={client}>
      <UserIdentifier>{children}</UserIdentifier>
    </LDProvider>
  );
}

// Custom hook for boolean feature flags
export function useFeatureFlag(flagKey: string, defaultValue: boolean = false) {
  if (useBoolVariation) {
    return useBoolVariation(flagKey, defaultValue);
  }

  return useFallbackBoolVariation(flagKey, defaultValue);
}

// Custom hook for LaunchDarkly client
export function useFeatureFlagClient() {
  if (useLDClient) {
    return useLDClient();
  }

  return useFallbackLDClient();
}

// Export LaunchDarkly components for direct use
export {
  ReactNativeLDClient,
  AutoEnvAttributes,
  LDProvider,
  useBoolVariation,
  useLDClient,
};
