import { Redirect } from "expo-router";
import { useAuthStore } from "@/stores/authStore";
import { useEffect, useState } from "react";
import { MOBILE_ROUTES } from "@/lib/routes";
import { useAppFonts } from "@/lib/fonts";
import { LoadingContainer } from "@/components/common/LoadingContainer";
import { TokenManager } from "@/services/api/base";
import { getRedirection } from "@/utils/getRedirection";

export default function Index() {
  const { isAuthenticated, user } = useAuthStore();
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const fontsLoaded = useAppFonts();

  useEffect(() => {
    const initialize = async () => {
      // Cache tokens in memory on app startup for fast access
      await TokenManager.initializeCache();

      // Restore tokens from TokenManager to authStore if user exists but tokens are missing
      if (isAuthenticated && user) {
        const accessToken = await TokenManager.getAccessToken();
        const refreshToken = await TokenManager.getRefreshToken();

        // If tokens exist in storage but not in store, restore them
        if (accessToken && refreshToken) {
          const currentAccessToken = useAuthStore.getState().accessToken;
          const currentRefreshToken = useAuthStore.getState().refreshToken;

          if (!currentAccessToken || !currentRefreshToken) {
            useAuthStore.setState({
              accessToken,
              refreshToken,
            });
          }
        }

        // Check user status on app startup
        // Only check if we have tokens available (reuse accessToken from above)
        if (accessToken) {
          try {
            const { userService } = await import("@/services/api/user");
            // Make a lightweight API call to check user status
            const response = await userService.getCurrentUser();

            if (response.status === 403 && response.error) {
              // User is disabled or suspended
              // Handle both string and object error responses
              const errorData =
                typeof response.error === "string"
                  ? { error: response.error }
                  : (response.error as {
                      error?: string;
                      status?: string;
                      [key: string]: any;
                    });
              const userStatus = errorData?.status;

              if (userStatus === "disabled" || userStatus === "suspended") {
                const { handleAutoLogout } = await import("@/utils/authUtils");
                await handleAutoLogout(userStatus as "disabled" | "suspended");
                return; // Exit early, auto-logout will redirect
              }
            } else if (response.status === 401) {
              // Token expired, attempt refresh
              const { authService } = await import("@/services/api/auth");
              const refreshResponse = await authService.refreshToken();
              // Only logout if refresh returns 404 (user not found)
              // Other failures (expired token, network issues, etc.) should not trigger logout
              if (refreshResponse.status === 404) {
                const { handleAutoLogout } = await import("@/utils/authUtils");
                await handleAutoLogout("not_found");
                return;
              }
              // For other failures, just continue without logging out
            }
          } catch (error) {
            // If status check fails, log but don't block app
            console.warn("[Index] Status check failed:", error);
          }
        }
      }

      // Get redirect URL based on onboarding status
      if (isAuthenticated && user) {
        const url = await getRedirection();
        setRedirectUrl(url);
      } else {
        setRedirectUrl(MOBILE_ROUTES.AUTH.MAIN);
      }
    };
    initialize();
  }, [isAuthenticated, user]);

  // Show loading while checking redirect status
  if (redirectUrl === null || !fontsLoaded) {
    return <LoadingContainer />;
  }

  if (!isAuthenticated) {
    if (redirectUrl === MOBILE_ROUTES.ONBOARDING.MAIN) {
      return <Redirect href={redirectUrl} />;
    }
    return <Redirect href={MOBILE_ROUTES.AUTH.MAIN} />;
  }

  // Check email verification for email/password users
  if (user && !user.email_verified && user.auth_provider === "email") {
    return <Redirect href={MOBILE_ROUTES.AUTH.VERIFY_EMAIL} />;
  }

  // Redirect to the appropriate route based on onboarding status
  return <Redirect href={redirectUrl} />;
}
