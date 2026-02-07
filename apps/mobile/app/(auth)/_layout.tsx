import { LoadingContainer } from "@/components/common/LoadingContainer";
import { MOBILE_ROUTES } from "@/lib/routes";
import { queryClient } from "@/lib/queryClient";
import { initializeAuthenticatedData } from "@/services/prefetch";
import { useAuthStore } from "@/stores/authStore";
import { Stack, Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { getRedirection } from "@/utils/getRedirection";
import { hasCompletedV2Onboarding } from "@/utils/onboardingUtils";

export default function AuthLayout() {
  const { isAuthenticated, isLoading, isVerifyingUser, user, setVerifyingUser } = useAuthStore();
  const [destination, setDestination] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;

    // Don't redirect if user needs to verify email first (email signup flow)
    const needsEmailVerification = user?.auth_provider === "email" && !user?.email_verified;
    if (needsEmailVerification) return;

    // User just logged in (we have user from login/signup API) - no verification needed.
    // index.tsx only runs on cold start; social/login from auth screen bypasses it.
    if (isVerifyingUser && user) {
      setVerifyingUser(false);
      return; // Re-run effect with isVerifyingUser false
    }
    if (isVerifyingUser) return;

    const runRedirect = async () => {
      try {
        // Prefetch critical data before navigating (ensures home has data)
        await Promise.race([
          initializeAuthenticatedData(queryClient),
          new Promise((resolve) => setTimeout(resolve, 5000))
        ]);
        const hasCompletedOnboarding = hasCompletedV2Onboarding(user);
        const dest = await getRedirection({ hasCompletedOnboarding });
        setDestination(dest);
      } catch (error) {
        console.warn("[AuthLayout] Redirect failed:", error);
        setDestination(MOBILE_ROUTES.MAIN.HOME);
      }
    };
    runRedirect();
  }, [isLoading, isAuthenticated, isVerifyingUser, user]);

  // Show loading while determining redirect (getRedirection)
  if (!isLoading && isAuthenticated && !isVerifyingUser && destination === null) {
    return <LoadingContainer />;
  }

  if (!isLoading && isAuthenticated && !isVerifyingUser && destination) {
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
