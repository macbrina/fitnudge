// Polyfill for Supabase (must be first import)
import "react-native-url-polyfill/auto";

import { SystemStatusListener } from "@/components/system/SystemStatusListener";
import { AlertModalProvider } from "@/contexts/AlertModalContext";
import { AppUpdateProvider } from "@/providers/AppUpdateProvider";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { RealtimeProvider } from "@/contexts/RealtimeContext";
import { RevenueCatProvider } from "@/contexts/RevenueCatContext";
import { useBackendHealthMonitor } from "@/hooks/useBackendHealthMonitor";
import { prefetchAppConfig } from "@/hooks/api/useAppConfig";
import { MaintenanceGate } from "@/components/maintenance";
import { PostHogProvider } from "@/providers/PostHogProvider";
import { LaunchDarklyProvider } from "@/services/launchDarklyProvider";
import { logger } from "@/services/logger";
import { ThemeProvider, useTheme } from "@/themes";
import { setupDeepLinkListener } from "@/utils/deepLinkHandler";
import { initDeviceInfo } from "@/utils/deviceInfo";
import "@i18n";
import * as Sentry from "@sentry/react-native";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Stack, usePathname, useSegments } from "expo-router";
import { queryClient, queryPersister } from "@/lib/queryClient";
import * as ScreenOrientation from "expo-screen-orientation";
import { StatusBar } from "expo-status-bar";
import { useEffect, type ReactElement, type ReactNode } from "react";
import { AppState, Platform, StatusBar as RNStatusBar, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ReducedMotionConfig, ReduceMotion } from "react-native-reanimated";
import mobileAds from "react-native-google-mobile-ads";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useAdMobStore } from "@/stores/adMobStore";
import { useAuthStore } from "@/stores/authStore";
import { initializeAuthenticatedData, refreshAuthenticatedData } from "@/services/prefetch";
import { TokenManager } from "@/services/api/base";
import { useSubscriptionStore } from "@/stores/subscriptionStore";

// Initialize Sentry with error handling
try {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    sendDefaultPii: true,
    enableLogs: true,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1,
    integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],
    spotlight: __DEV__
  });

  // Initialize vendor logger after Sentry
  logger.markInitialized();
} catch (error) {
  console.warn("Sentry initialization failed:", error);
}

// QueryClient is now imported from @/lib/queryClient with persistent cache
// LaunchDarkly is now handled by the provider pattern

function SafeAreaWrapper() {
  const { colors } = useTheme();
  const pathname = usePathname();
  const segments = useSegments();
  const { isAuthenticated } = useAuthStore();

  const inOnboarding = segments.includes("(onboarding)") && !segments.includes("(user)");
  const inAuth = segments.includes("(auth)") || pathname.startsWith("/auth");
  const isAuthBase = segments.includes("(auth)") && segments.includes("auth");
  // Check if we're in tabs route using segments: ["(user)", "(tabs)", ...]
  const inTabs = segments.includes("(user)") && segments.includes("(tabs)");
  const inGoals = segments.includes("(user)") && segments.includes("(goals)");
  const inAchievements = segments.includes("(user)") && segments.includes("achievements");
  const isProfile = segments.includes("(user)") && segments.includes("profile");
  const isVerifyEmail = segments.includes("(auth)") && segments.includes("verify-email");

  const isSafeAreaHidden = inOnboarding || isAuthBase;

  // For tabs, exclude bottom edge since tab bar handles its own safe area insets
  const safeAreaEdges: ("bottom" | "left" | "right" | "top")[] =
    inTabs || inGoals || inAuth || inAchievements || isProfile || isVerifyEmail
      ? ["left", "right", "top"]
      : ["bottom", "left", "right", "top"];

  // Single Stack component to avoid Expo Router context issues
  // Wrap conditionally with SafeAreaView based on route
  const stackContent = (
    <Stack
      screenOptions={{
        animation: "slide_from_right",
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg.canvas }
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(auth)" />
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(user)" />
      </Stack.Protected>
    </Stack>
  );

  // Return without SafeAreaView for onboarding/auth base screens
  if (isSafeAreaHidden) {
    return stackContent;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg.canvas }} edges={safeAreaEdges}>
      {stackContent}
    </SafeAreaView>
  );
}

function StatusBarWrapper() {
  const pathname = usePathname();
  const inOnboarding = pathname.startsWith("/(onboarding)");
  const inAuth = pathname.startsWith("/(auth)");
  const { isDark, colors } = useTheme();
  const backgroundColor = colors.bg.canvas;
  const statusBarStyle = isDark ? "light" : "dark";

  // Onboarding screens handle their own StatusBar
  const isStatusBarHidden = inOnboarding || inAuth;

  useEffect(() => {
    if (Platform.OS === "android") {
      RNStatusBar.setBackgroundColor(backgroundColor, true);
      RNStatusBar.setBarStyle(statusBarStyle === "light" ? "light-content" : "dark-content", true);
      RNStatusBar.setTranslucent(false);
    }
  }, [backgroundColor, statusBarStyle]);

  // Don't render StatusBar for onboarding screens as they handle it themselves
  if (isStatusBarHidden) {
    return null;
  }

  return (
    <StatusBar style={statusBarStyle} translucent={false} backgroundColor={colors.bg.canvas} />
  );
}

function ThemedRootWrapper({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg.canvas }}>
      <View style={{ flex: 1, backgroundColor: colors.bg.canvas }}>{children}</View>
    </GestureHandlerRootView>
  );
}

// LaunchDarkly user identification is now handled by the provider

function RootLayout(): ReactElement {
  // Lock to portrait on app start
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch((error) => {
      console.warn("[RootLayout] Failed to lock orientation:", error);
    });
  }, []);

  // Setup deep link listener and initialize device info
  useEffect(() => {
    const cleanup = setupDeepLinkListener();
    // Initialize and cache device info for auth requests
    initDeviceInfo().catch((error) => {
      console.warn("[RootLayout] Failed to initialize device info:", error);
    });
    return cleanup;
  }, []);

  // Prefetch app config early (no auth required, used by many screens)
  useEffect(() => {
    prefetchAppConfig(queryClient).catch((error) => {
      console.warn("[RootLayout] Failed to prefetch app config:", error);
    });
  }, []);

  // Initialize app on cold start: cache tokens + fetch authenticated data
  // This ensures data is available even when deep linking bypasses index.tsx
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // 1. Cache tokens in memory first (required for API calls)
        await TokenManager.initializeCache();

        // 2. If authenticated, fetch essential data
        // This handles the case where app cold starts to a deep link route
        // (bypassing index.tsx which normally handles this)
        // Uses coordinated initialization to prevent duplicates with index.tsx
        const isAuthenticated = useAuthStore.getState().isAuthenticated;
        const isVerifyingUser = useAuthStore.getState().isVerifyingUser;

        if (isAuthenticated && !isVerifyingUser) {
          await initializeAuthenticatedData(queryClient);
        }
      } catch (error) {
        console.warn("[RootLayout] App initialization failed:", error);
      }
    };

    initializeApp();
  }, []);

  // Initialize AdMob SDK (with ATT for iOS)
  useEffect(() => {
    const initializeAds = async () => {
      try {
        // Request App Tracking Transparency on iOS before initializing ads
        if (Platform.OS === "ios") {
          const { getTrackingPermissionsAsync, requestTrackingPermissionsAsync } =
            await import("expo-tracking-transparency");

          const { status } = await getTrackingPermissionsAsync();
          console.log("[RootLayout] ATT status:", status);
          if (status === "undetermined") {
            await requestTrackingPermissionsAsync();
          }
        }

        // Initialize AdMob after ATT (or immediately on Android)
        await mobileAds()
          .initialize()
          .then((adapterStatuses) => {
            // Initialization complete!
            console.log("[RootLayout] AdMob initialized:", adapterStatuses);
            useAdMobStore.getState().setInitialized(true);
          })
          .catch((error) => {
            console.warn("[RootLayout] AdMob initialization failed:", error);
          });
      } catch (error) {
        console.warn("[RootLayout] AdMob initialization failed:", error);
      }
    };

    initializeAds();
  }, []);

  // Refetch subscription & features when app comes to foreground
  // This ensures features are available even after network reconnection
  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (state) => {
      if (state === "active") {
        // Only refetch if user is authenticated
        const isAuthenticated = useAuthStore.getState().isAuthenticated;
        const isVerifyingUser = useAuthStore.getState().isVerifyingUser;

        if (isAuthenticated && !isVerifyingUser) {
          try {
            // Always refresh on foreground (unlike initialization which checks cache)
            await refreshAuthenticatedData(queryClient);
          } catch (error) {
            console.warn("[RootLayout] Foreground refetch failed:", error);
          }
        }
      }
    });
    return () => subscription.remove();
  }, []);

  useBackendHealthMonitor();

  return (
    <>
      <ReducedMotionConfig mode={ReduceMotion.Never} />
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister: queryPersister }}
        >
          <ThemeProvider initialBrand="fitnudge">
            <ThemedRootWrapper>
              <PostHogProvider>
                <LaunchDarklyProvider>
                  <RealtimeProvider>
                    <NotificationProvider>
                      <AlertModalProvider>
                        <RevenueCatProvider>
                          <AppUpdateProvider autoShow showDelay={3000}>
                            <MaintenanceGate>
                              <StatusBarWrapper />
                              <SafeAreaWrapper />
                              <SystemStatusListener />
                            </MaintenanceGate>
                          </AppUpdateProvider>
                        </RevenueCatProvider>
                      </AlertModalProvider>
                    </NotificationProvider>
                  </RealtimeProvider>
                </LaunchDarklyProvider>
              </PostHogProvider>
            </ThemedRootWrapper>
          </ThemeProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </>
  );
}

const WrappedRootLayout = Sentry.wrap(RootLayout);

export default function RootLayoutContainer(): ReactElement {
  return <WrappedRootLayout />;
}
