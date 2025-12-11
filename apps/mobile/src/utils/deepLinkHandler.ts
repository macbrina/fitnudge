import { router } from "expo-router";
import { MOBILE_ROUTES } from "@/lib/routes";
import * as Linking from "expo-linking";

/**
 * Handle deep links from Universal Links/App Links
 * Routes URLs like https://fitnudge.app/reset-password?token=abc123
 * to the appropriate app screens
 *
 * In development, also accepts localhost and ngrok URLs for testing
 */
export function handleDeepLink(url: string): void {
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
          router.push(
            `${MOBILE_ROUTES.AUTH.VERIFY_EMAIL}?code=${queryParams.code}`
          );
        } else {
          router.push(MOBILE_ROUTES.AUTH.VERIFY_EMAIL);
        }
        break;

      case "/forgot-password":
        router.push(MOBILE_ROUTES.AUTH.FORGOT_PASSWORD);
        break;

      // Goals
      case "/goal":
      case "/goals":
        if (queryParams?.id) {
          router.push(`${MOBILE_ROUTES.GOALS.DETAILS}?id=${queryParams.id}`);
        } else {
          router.push(MOBILE_ROUTES.GOALS.LIST);
        }
        break;

      // Profile
      case "/profile":
        if (queryParams?.id) {
          router.push(
            `${MOBILE_ROUTES.SOCIAL.USER_PROFILE}?id=${queryParams.id}`
          );
        } else {
          router.push(MOBILE_ROUTES.PROFILE.MAIN);
        }
        break;

      // Notifications
      case "/notification":
      case "/notifications":
        router.push(MOBILE_ROUTES.PROFILE.NOTIFICATIONS);
        break;

      // Invites
      case "/invite":
      case "/invites":
        if (queryParams?.token) {
          // Handle invite acceptance
          router.push(
            `${MOBILE_ROUTES.AUTH.SIGNUP}?invite=${queryParams.token}`
          );
        } else {
          router.push(MOBILE_ROUTES.MAIN.HOME);
        }
        break;

      // Check-ins (from push notifications)
      case "/checkin":
        if (queryParams?.goalId) {
          router.push(
            `${MOBILE_ROUTES.MAIN.HOME}?openCheckinGoalId=${queryParams.goalId}`
          );
        } else {
          router.push(MOBILE_ROUTES.MAIN.HOME);
        }
        break;

      // Default: handle dynamic paths or go to home
      default:
        // Handle /checkin/{goalId} format (from push notifications)
        if (normalizedPath.startsWith("/checkin/")) {
          const goalId = normalizedPath.replace("/checkin/", "");
          if (goalId) {
            router.push(
              `${MOBILE_ROUTES.MAIN.HOME}?openCheckinGoalId=${goalId}`
            );
            break;
          }
        }
        router.push(MOBILE_ROUTES.MAIN.HOME);
        break;
    }
  } catch (error) {
    console.error("Error handling deep link:", error);
    // Fallback to home on error
    router.push(MOBILE_ROUTES.MAIN.HOME);
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
