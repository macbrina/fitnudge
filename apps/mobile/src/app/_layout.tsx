// Polyfill for Supabase (must be first import)
import "react-native-url-polyfill/auto";

import { SystemStatusListener } from "@/components/system/SystemStatusListener";
import { AlertModalProvider } from "@/contexts/AlertModalContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { RealtimeProvider } from "@/contexts/RealtimeContext";
import { RevenueCatProvider } from "@/contexts/RevenueCatContext";
import { useBackendHealthMonitor } from "@/hooks/useBackendHealthMonitor";
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
import { Platform, StatusBar as RNStatusBar, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "@/stores/authStore";

// Initialize Sentry with error handling
try {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    sendDefaultPii: true,
    enableLogs: true,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1,
    integrations: [
      Sentry.mobileReplayIntegration(),
      Sentry.feedbackIntegration(),
    ],
    spotlight: __DEV__,
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

  const inOnboarding =
    segments.includes("(onboarding)") && !segments.includes("(user)");
  const inAuth = segments.includes("(auth)") || pathname.startsWith("/auth");
  const isAuthBase = segments.includes("(auth)") && segments.includes("auth");
  // console.log("pathname", pathname);
  // console.log("segments", segments);
  // Check if we're in tabs route using segments: ["(user)", "(tabs)", ...]
  const inTabs = segments.includes("(user)") && segments.includes("(tabs)");
  const inGoals = segments.includes("(user)") && segments.includes("(goals)");
  const inChallenges =
    segments.includes("(user)") && segments.includes("challenges");
  const inWorkout = segments.includes("(user)") && segments.includes("workout");
  const inAchievements =
    segments.includes("(user)") && segments.includes("achievements");
  const isSocial = segments.includes("(user)") && segments.includes("social");
  // Workout screens handle their own safe areas for full-screen overlays
  const isSafeAreaHidden = inOnboarding || isAuthBase || inWorkout;
  const isProfile = segments.includes("(user)") && segments.includes("profile");

  // For tabs, exclude bottom edge since tab bar handles its own safe area insets
  const safeAreaEdges: ("bottom" | "left" | "right" | "top")[] =
    inTabs ||
    inGoals ||
    inChallenges ||
    inAuth ||
    inWorkout ||
    inAchievements ||
    isSocial ||
    isProfile
      ? ["left", "right", "top"]
      : ["bottom", "left", "right", "top"];

  if (isSafeAreaHidden) {
    return (
      <Stack
        screenOptions={{
          animation: "slide_from_right",
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(onboarding)" />
        {/* <Stack.Screen name="(auth)" /> */}
        {/* <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="(user)" />
        </Stack.Protected> */}
      </Stack>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg.canvas }}
      edges={safeAreaEdges}
    >
      <Stack
        screenOptions={{
          animation: "slide_from_right",
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        {/* <Stack.Screen name="(onboarding)" /> */}
        <Stack.Screen name="(auth)" />
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="(user)" />
        </Stack.Protected>
      </Stack>
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
      RNStatusBar.setBarStyle(
        statusBarStyle === "light" ? "light-content" : "dark-content",
        true,
      );
      RNStatusBar.setTranslucent(false);
    }
  }, [backgroundColor, statusBarStyle]);

  // Don't render StatusBar for onboarding screens as they handle it themselves
  if (isStatusBarHidden) {
    return null;
  }

  return (
    <StatusBar
      style={statusBarStyle}
      translucent={false}
      backgroundColor={colors.bg.canvas}
    />
  );
}

function BackgroundColorWrapper({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.canvas }}>
      {children}
    </View>
  );
}

// LaunchDarkly user identification is now handled by the provider

function RootLayout(): ReactElement {
  // Lock to portrait on app start (workout player can override this)
  useEffect(() => {
    ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.PORTRAIT_UP,
    ).catch((error) => {
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
  useBackendHealthMonitor();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister: queryPersister }}
        >
          <ThemeProvider initialBrand="fitnudge">
            <PostHogProvider>
              <LaunchDarklyProvider>
                <RealtimeProvider>
                  <NotificationProvider>
                    <AlertModalProvider>
                      <RevenueCatProvider>
                        <BackgroundColorWrapper>
                          <StatusBarWrapper />
                          <SafeAreaWrapper />
                          <SystemStatusListener />
                        </BackgroundColorWrapper>
                      </RevenueCatProvider>
                    </AlertModalProvider>
                  </NotificationProvider>
                </RealtimeProvider>
              </LaunchDarklyProvider>
            </PostHogProvider>
          </ThemeProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const WrappedRootLayout = Sentry.wrap(RootLayout);

export default function RootLayoutContainer(): ReactElement {
  return <WrappedRootLayout />;
}
