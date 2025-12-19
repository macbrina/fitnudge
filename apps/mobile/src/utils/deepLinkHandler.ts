import { router } from "expo-router";
import { MOBILE_ROUTES } from "@/lib/routes";
import * as Linking from "expo-linking";

/**
 * Check if user is authenticated and not in verification state
 * Uses dynamic import to avoid circular dependency with authStore
 */
async function isUserAuthenticated(): Promise<boolean> {
  const { useAuthStore } = await import("@/stores/authStore");
  const { isAuthenticated, isVerifyingUser } = useAuthStore.getState();
  return isAuthenticated && !isVerifyingUser;
}

type AuthRedirectType = "signup" | "login";

/**
 * Route to authenticated page or auth screen with redirect params
 *
 * @param authenticatedRoute - Route to go to if authenticated
 * @param redirectParams - Params to pass to auth screen for post-auth redirect
 * @param authType - Which auth screen to redirect to: "signup" or "login" (default: "signup")
 */
async function routeWithAuthCheck(
  authenticatedRoute: string,
  redirectParams?: Record<string, string>,
  authType: AuthRedirectType = "signup"
): Promise<void> {
  const authenticated = await isUserAuthenticated();
  if (authenticated) {
    router.push(authenticatedRoute);
  } else {
    // Build auth URL with redirect params
    const params = new URLSearchParams(redirectParams || {});
    const authRoute =
      authType === "login"
        ? MOBILE_ROUTES.AUTH.LOGIN
        : MOBILE_ROUTES.AUTH.SIGNUP;
    const authUrl = params.toString()
      ? `${authRoute}?${params.toString()}`
      : authRoute;
    router.push(authUrl);
  }
}

/**
 * Handle deep links from Universal Links/App Links
 * Routes URLs like https://fitnudge.app/reset-password?token=abc123
 * to the appropriate app screens
 *
 * For authenticated routes, checks auth state first and redirects
 * to signup with appropriate params if not authenticated.
 *
 * In development, also accepts localhost and ngrok URLs for testing
 */
export async function handleDeepLink(url: string): Promise<void> {
  try {
    const parsed = Linking.parse(url);
    const { hostname, path, queryParams } = parsed;

    const normalizedPath = path
      ? path.startsWith("/")
        ? path
        : `/${path}`
      : "/";

    // Handle fitnudge.app (production) or localhost/ngrok (development)
    const isProductionDomain = hostname === "fitnudge.app";
    const isDevelopmentDomain =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname?.endsWith(".ngrok.io") ||
      hostname?.endsWith(".ngrok-free.app") ||
      hostname?.endsWith(".loca.lt") ||
      __DEV__; // Allow any domain in development mode

    if (!isProductionDomain && !isDevelopmentDomain) {
      return;
    }

    // Route based on path
    switch (normalizedPath) {
      // =====================================================
      // PUBLIC ROUTES (no auth required)
      // =====================================================
      case "/reset-password":
        if (queryParams?.token) {
          router.push(
            `${MOBILE_ROUTES.AUTH.RESET_PASSWORD}?token=${queryParams.token}`
          );
        } else {
          router.push(MOBILE_ROUTES.AUTH.RESET_PASSWORD);
        }
        break;

      case "/verify-email":
        if (queryParams?.code) {
          await routeWithAuthCheck(
            `${MOBILE_ROUTES.AUTH.VERIFY_EMAIL}?code=${queryParams.code}`,
            { redirectTo: "verify-email", code: queryParams.code as string },
            "login"
          );
        } else {
          await routeWithAuthCheck(
            MOBILE_ROUTES.AUTH.VERIFY_EMAIL,
            { redirectTo: "verify-email" },
            "login"
          );
        }
        break;

      case "/forgot-password":
        router.push(MOBILE_ROUTES.AUTH.FORGOT_PASSWORD);
        break;

      // Referral signup link: /join?ref={code}
      // Always goes to signup (this IS a signup route)
      case "/join":
        if (queryParams?.ref) {
          router.push(
            `${MOBILE_ROUTES.AUTH.SIGNUP}?referral=${queryParams.ref}`
          );
        } else {
          router.push(MOBILE_ROUTES.AUTH.SIGNUP);
        }
        break;

      // =====================================================
      // AUTHENTICATED ROUTES (require auth check)
      // =====================================================

      // Goals - handles /goal?id=xxx and /goals
      case "/goal":
      case "/goals":
        if (queryParams?.id) {
          await routeWithAuthCheck(
            `${MOBILE_ROUTES.GOALS.DETAILS}?id=${queryParams.id}`,
            { redirectTo: "goal", goalId: queryParams.id as string }
          );
        } else if (queryParams?.goalId) {
          // Handle goalId param (from push notifications)
          await routeWithAuthCheck(
            `${MOBILE_ROUTES.GOALS.DETAILS}?id=${queryParams.goalId}`,
            { redirectTo: "goal", goalId: queryParams.goalId as string }
          );
        } else {
          await routeWithAuthCheck(MOBILE_ROUTES.GOALS.LIST, {
            redirectTo: "goals",
          });
        }
        break;

      // Profile
      case "/profile":
        if (queryParams?.id) {
          await routeWithAuthCheck(
            `${MOBILE_ROUTES.SOCIAL.USER_PROFILE}?id=${queryParams.id}`,
            { redirectTo: "profile", profileId: queryParams.id as string }
          );
        } else {
          await routeWithAuthCheck(MOBILE_ROUTES.PROFILE.MAIN, {
            redirectTo: "profile",
          });
        }
        break;

      // Notifications
      case "/notification":
      case "/notifications":
        await routeWithAuthCheck(MOBILE_ROUTES.PROFILE.NOTIFICATIONS, {
          redirectTo: "notifications",
        });
        break;

      // Check-ins (from push notifications)
      case "/checkin":
        if (queryParams?.goalId) {
          await routeWithAuthCheck(
            `${MOBILE_ROUTES.MAIN.HOME}?openCheckinGoalId=${queryParams.goalId}`,
            { redirectTo: "checkin", goalId: queryParams.goalId as string }
          );
        } else {
          await routeWithAuthCheck(MOBILE_ROUTES.MAIN.HOME, {
            redirectTo: "home",
          });
        }
        break;

      // Default: handle dynamic paths or go to home
      default:
        // Handle /checkin/{goalId} format (from push notifications)
        if (normalizedPath.startsWith("/checkin/")) {
          const goalId = normalizedPath.replace("/checkin/", "");
          if (goalId) {
            await routeWithAuthCheck(
              `${MOBILE_ROUTES.MAIN.HOME}?openCheckinGoalId=${goalId}`,
              { redirectTo: "checkin", goalId }
            );
            break;
          }
        }

        // Challenge detail link: /challenge/{id}
        if (normalizedPath.startsWith("/challenge/")) {
          const challengeId = normalizedPath.replace("/challenge/", "");
          if (challengeId && challengeId !== "join") {
            await routeWithAuthCheck(
              MOBILE_ROUTES.CHALLENGES.DETAILS(challengeId),
              {
                redirectTo: "challenge",
                challengeId,
              }
            );
            break;
          }
        }

        // Handle /goal/{goalId} format (from push notifications)
        if (normalizedPath.startsWith("/goal/")) {
          const goalId = normalizedPath.replace("/goal/", "");
          if (goalId) {
            await routeWithAuthCheck(
              `${MOBILE_ROUTES.GOALS.DETAILS}?id=${goalId}`,
              { redirectTo: "goal", goalId }
            );
            break;
          }
        }

        // Default: home (with auth check)
        await routeWithAuthCheck(MOBILE_ROUTES.MAIN.HOME, {
          redirectTo: "home",
        });
        break;
    }
  } catch (error) {
    console.error("Error handling deep link:", error);
    // Fallback to home on error (with auth check)
    await routeWithAuthCheck(MOBILE_ROUTES.MAIN.HOME);
  }
}

/**
 * Initialize deep link listeners
 * Call this in the root layout or App component
 */
export function setupDeepLinkListener(): () => void {
  // Handle initial URL (if app was opened via deep link)
  Linking.getInitialURL().then((url) => {
    if (url) {
      handleDeepLink(url);
    }
  });

  // Handle deep links while app is running
  const subscription = Linking.addEventListener("url", (event) => {
    handleDeepLink(event.url);
  });

  return () => {
    subscription.remove();
  };
}
