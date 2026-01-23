import { Redirect } from "expo-router";
import { useAuthStore } from "@/stores/authStore";
import { useEffect, useState } from "react";
import { MOBILE_ROUTES } from "@/lib/routes";
import { useAppFonts } from "@/lib/fonts";
import { LoadingContainer } from "@/components/common/LoadingContainer";
import { TokenManager } from "@/services/api/base";
import { getRedirection, hasCompletedV2Onboarding } from "@/utils/getRedirection";
import { storageUtil, STORAGE_KEYS } from "@/utils/storageUtil";
import { initializeAuthenticatedData } from "@/services/prefetch";
import { queryClient } from "@/lib/queryClient";

export default function Index() {
  const { isAuthenticated, user, setVerifyingUser } = useAuthStore();
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const fontsLoaded = useAppFonts();

  useEffect(() => {
    const initialize = async () => {
      // CRITICAL: If user appears authenticated from storage, verify they actually exist
      // This prevents wasted API calls from services if user was deleted
      if (isAuthenticated && user) {
        const accessToken = await TokenManager.getAccessToken();
        const refreshToken = await TokenManager.getRefreshToken();

        // If no tokens, user is not really authenticated
        if (!accessToken || !refreshToken) {
          console.log("[Index] No tokens found, clearing authentication");
          useAuthStore.setState({
            isAuthenticated: false,
            user: null
          });
          setRedirectUrl(MOBILE_ROUTES.AUTH.MAIN);
          return;
        }

        // Restore tokens to store if missing
        const currentAccessToken = useAuthStore.getState().accessToken;
        const currentRefreshToken = useAuthStore.getState().refreshToken;

        if (!currentAccessToken || !currentRefreshToken) {
          useAuthStore.setState({
            accessToken,
            refreshToken
          });
        }

        // VERIFY USER EXISTS before allowing authenticated access
        // This prevents services from initializing if user was deleted
        // base.ts will handle all error cases (404→logout, 401→refresh, 403→logout)
        setVerifyingUser(true);
        console.log("[Index] Verifying user exists...");
        let isUserVerified = false;

        try {
          const { userService } = await import("@/services/api/user");
          const response = await userService.getCurrentUser();

          // base.ts already handled logout if needed (404/401/403)
          // We just need to check if the call succeeded
          if (response.status === 200 && response.data) {
            isUserVerified = true;
            // CRITICAL: Update user in store with fresh data from API
            // This ensures email_verified and other fields are up-to-date
            // (e.g., if email was auto-verified due to SMTP failure)
            useAuthStore.getState().updateUser(response.data);
          } else {
            // base.ts triggered logout, just log
          }
        } catch (error) {
          setVerifyingUser(true);
          // base.ts already handled logout if applicable
          console.warn("[Index] User verification error:", error);
        } finally {
          // Always clear verification flag
          setVerifyingUser(false);
        }

        // Only fetch background data if user was successfully verified
        let hasCompletedOnboarding = false;
        if (isUserVerified) {
          // V2: Check if user has completed onboarding from the user object
          hasCompletedOnboarding = hasCompletedV2Onboarding(useAuthStore.getState().user);

          // Fetch subscription, features, pricing plans in the background
          // This runs after user verification, preventing wasted calls if user doesn't exist
          // Uses coordinated initialization to prevent duplicates with _layout.tsx
          try {
            await initializeAuthenticatedData(queryClient);
          } catch (error) {
            // If any fetch fails, log but don't block app
            console.warn("[Index] Background data fetch failed:", error);
          }
        }

        // Get redirect URL based on onboarding status
        const url = await getRedirection({ hasCompletedOnboarding });
        setRedirectUrl(url);
      } else {
        // Non-authenticated user
        setVerifyingUser(false);

        // Get redirect URL based on onboarding status for non-authenticated users
        const hasSeenOnboarding = await storageUtil.getItem<boolean>(
          STORAGE_KEYS.HAS_SEEN_ONBOARDING
        );
        if (!hasSeenOnboarding) {
          setRedirectUrl(MOBILE_ROUTES.ONBOARDING.MAIN);
        } else {
          // Go directly to login screen (not auth landing page)
          setRedirectUrl(MOBILE_ROUTES.AUTH.LOGIN);
        }
      }
    };
    initialize();
    // Note: Only depend on isAuthenticated, not user
    // updateUser() changes user which would cause infinite loop
  }, [isAuthenticated]);

  // Show loading while verifying user or checking redirect status
  const { isVerifyingUser } = useAuthStore();
  if (redirectUrl === null || !fontsLoaded || isVerifyingUser) {
    return <LoadingContainer />;
  }

  if (!isAuthenticated) {
    if (redirectUrl === MOBILE_ROUTES.ONBOARDING.MAIN) {
      return <Redirect href={redirectUrl} />;
    }
    // Go directly to login screen (not auth landing page)
    return <Redirect href={MOBILE_ROUTES.AUTH.LOGIN} />;
  }

  // Check email verification for email/password users
  if (user && !user.email_verified && user.auth_provider === "email") {
    return <Redirect href={MOBILE_ROUTES.AUTH.VERIFY_EMAIL} />;
  }

  // Redirect to the appropriate route based on onboarding status
  return <Redirect href={redirectUrl} />;
}
