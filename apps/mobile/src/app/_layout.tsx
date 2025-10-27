import { Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StatusBar as RNStatusBar } from "react-native";
import "@i18n";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ThemeProvider, useTheme } from "@/themes";
import { Platform, View } from "react-native";

function SafeAreaWrapper() {
  const segments = useSegments();
  const { isDark, colors } = useTheme();

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

function BackgroundColorWrapper({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.canvas }}>
      {children}
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider initialBrand="fitnudge">
          <BackgroundColorWrapper>
            <StatusBarWrapper />
            <SafeAreaWrapper />
          </BackgroundColorWrapper>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
