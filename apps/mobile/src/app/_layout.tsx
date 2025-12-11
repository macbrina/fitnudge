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
import "@i18n";
import * as Sentry from "@sentry/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, usePathname, useSegments } from "expo-router";
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

// Initialize React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 1,
    },
  },
});

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

  const isSafeAreaHidden = inOnboarding || isAuthBase;

  // For tabs, exclude bottom edge since tab bar handles its own safe area insets
  const safeAreaEdges: ("bottom" | "left" | "right" | "top")[] =
    inTabs || inGoals || inAuth
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
        true
      );
      RNStatusBar.setTranslucent(false);
    }
  }, [backgroundColor, statusBarStyle]);

  // Don't render StatusBar for onboarding screens as they handle it themselves
  if (isStatusBarHidden) {
    return null;
  }

  return (
    <>
      <StatusBar
        style={statusBarStyle}
        translucent={false}
        backgroundColor={colors.bg.canvas}
      />
    </>
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
  // Setup deep link listener
  useEffect(() => {
    const cleanup = setupDeepLinkListener();
    return cleanup;
  }, []);
  useBackendHealthMonitor();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
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
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const WrappedRootLayout = Sentry.wrap(RootLayout);

export default function RootLayoutContainer(): ReactElement {
  return <WrappedRootLayout />;
}
