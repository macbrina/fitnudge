import { Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StatusBar as RNStatusBar } from "react-native";
import "@i18n";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ThemeProvider, useTheme } from "@/themes";
import { Platform, View } from "react-native";
import * as Sentry from "@sentry/react-native";
import { logger } from "@/services/logger";
import { LaunchDarklyProvider } from "@/services/launchDarklyProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { AlertModalProvider } from "@/contexts/AlertModalContext";
import { PostHogProvider } from "@/providers/PostHogProvider";
import { setupDeepLinkListener } from "@/utils/deepLinkHandler";
import { useEffect, type ReactElement, type ReactNode } from "react";
import { SystemStatusListener } from "@/components/system/SystemStatusListener";
import { useBackendHealthMonitor } from "@/hooks/useBackendHealthMonitor";

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
  const segments = useSegments();
  const { colors } = useTheme();

  const isSafeAreaHidden =
    segments.includes("(onboarding)") || segments.includes("auth");

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
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(user)" />
      </Stack>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg.canvas }}
      edges={["bottom", "left", "right"]}
    >
      <Stack
        screenOptions={{
          animation: "slide_from_right",
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(user)" />
      </Stack>
    </SafeAreaView>
  );
}

function StatusBarWrapper() {
  const segments = useSegments();
  const { isDark, colors } = useTheme();

  // Onboarding screens handle their own StatusBar
  const isStatusBarHidden =
    segments.includes("(onboarding)") || segments.includes("auth");

  // Don't render StatusBar for onboarding screens as they handle it themselves
  if (isStatusBarHidden) {
    return null;
  }

  const statusBarStyle = isDark ? "light" : "dark";

  return (
    <>
      <View
        style={{
          height: Platform.OS === "ios" ? 44 : RNStatusBar.currentHeight,
          backgroundColor: colors.bg.canvas,
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
        }}
      />
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
                <NotificationProvider>
                  <AlertModalProvider>
                    <BackgroundColorWrapper>
                      <StatusBarWrapper />
                      <SafeAreaWrapper />
                      <SystemStatusListener />
                    </BackgroundColorWrapper>
                  </AlertModalProvider>
                </NotificationProvider>
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
