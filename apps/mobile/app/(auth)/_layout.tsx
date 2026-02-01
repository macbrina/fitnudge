import { useAuthStore } from "@/stores/authStore";
import { Stack, Redirect, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { getRedirection, hasCompletedV2Onboarding } from "@/utils/getRedirection";

export default function AuthLayout() {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const [destination, setDestination] = useState<string | null>(null);
  const segments = useSegments();

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    // Let login/signup screens handle their own redirect after prefetch — avoid double navigation
    const onLoginOrSignup =
      segments.includes("login") ||
      segments.includes("signup") ||
      segments.includes("verify-email") ||
      segments.includes("reset-password");
    if (onLoginOrSignup) return;

    const hasCompletedOnboarding = hasCompletedV2Onboarding(user);
    getRedirection({ hasCompletedOnboarding }).then(setDestination);
  }, [isLoading, isAuthenticated, user, segments]);

  if (!isLoading && isAuthenticated && destination) {
    return <Redirect href={destination} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right"
      }}
    >
      <Stack.Screen
        name="login"
        options={{
          title: "Login"
        }}
      />
      <Stack.Screen
        name="signup"
        options={{
          title: "Sign Up"
        }}
      />
      <Stack.Screen
        name="auth"
        options={{
          title: "Auth"
        }}
      />
    </Stack>
  );
}
