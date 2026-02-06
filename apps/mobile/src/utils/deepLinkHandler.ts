import { router } from "expo-router";
import { MOBILE_ROUTES } from "@/lib/routes";
import { storageUtil, STORAGE_KEYS } from "@/utils/storageUtil";
import * as Linking from "expo-linking";
import { queryClient } from "@/lib/queryClient";
import {
  weeklyRecapsQueryKeys,
  goalsQueryKeys,
  partnersQueryKeys,
  nudgesQueryKeys,
  userQueryKeys,
  homeDashboardQueryKeys,
  achievementsQueryKeys,
  notificationHistoryQueryKeys
} from "@/hooks/api/queryKeys";

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
 * Route unauthenticated user to auth screen, or onboarding first if they haven't seen it.
 * Prevents deep links from bypassing onboarding for first-time users.
 */
async function routeToAuthOrOnboarding(authUrl: string): Promise<void> {
  const hasSeenOnboarding = await storageUtil.getItem<boolean>(STORAGE_KEYS.HAS_SEEN_ONBOARDING);
  if (!hasSeenOnboarding) {
    const params = new URLSearchParams({ redirectTo: authUrl });
    router.push(`${MOBILE_ROUTES.ONBOARDING.MAIN}?${params.toString()}`);
  } else {
    router.push(authUrl);
  }
}

/**
 * Route to authenticated page or auth screen with redirect params
 *
 * @param authenticatedRoute - Route to go to if authenticated
 * @param redirectParams - Params to pass to auth screen for post-auth redirect
 * @param authType - Which auth screen to redirect to: "signup" or "login" (default: "signup")
 */
export async function routeWithAuthCheck(
  authenticatedRoute: string,
  redirectParams?: Record<string, string>,
  authType: AuthRedirectType = "signup"
): Promise<void> {
  const authenticated = await isUserAuthenticated();
  if (authenticated) {
    invalidateQueriesForRoute(authenticatedRoute);
    router.push(authenticatedRoute);
  } else {
    // Build auth URL with redirect params
    const params = new URLSearchParams(redirectParams || {});
    const authRoute = authType === "login" ? MOBILE_ROUTES.AUTH.LOGIN : MOBILE_ROUTES.AUTH.SIGNUP;
    const authUrl = params.toString() ? `${authRoute}?${params.toString()}` : authRoute;
    await routeToAuthOrOnboarding(authUrl);
  }
}

/**
 * Invalidate React Query cache for the destination route.
 * When navigating via deep link (notification, external link), the screen
 * won't have been prefetched - invalidating ensures fresh data on mount.
 */
function invalidateQueriesForRoute(route: string): void {
  try {
    const [path, query] = route.split("?");
    const params = query
      ? Object.fromEntries(new URLSearchParams(query))
      : ({} as Record<string, string>);

    // Weekly recaps list
    if (path === MOBILE_ROUTES.PROFILE.WEEKLY_RECAPS) {
      queryClient.invalidateQueries({ queryKey: weeklyRecapsQueryKeys.all });
      return;
    }

    // Weekly recap detail: /(user)/profile/weekly-recaps/{id}
    if (path.startsWith("/(user)/profile/weekly-recaps/")) {
      const recapId =
        path.replace("/(user)/profile/weekly-recaps/", "").split("/")[0] || params.recapId;
      if (recapId) {
        queryClient.invalidateQueries({ queryKey: weeklyRecapsQueryKeys.all });
        queryClient.invalidateQueries({ queryKey: weeklyRecapsQueryKeys.detail(recapId) });
      }
      return;
    }

    // Goals list
    if (path === MOBILE_ROUTES.GOALS.LIST || path.startsWith("/(user)/(tabs)/goals")) {
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.all });
      return;
    }
    // Goal detail: /(user)/(goals)/details?id=xxx
    if (path.startsWith("/(user)/(goals)/details")) {
      const goalId = params.id || params.goalId;
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.all });
      if (goalId) {
        queryClient.invalidateQueries({ queryKey: goalsQueryKeys.detail(goalId) });
      }
      return;
    }

    // Notifications tab
    if (path === MOBILE_ROUTES.NOTIFICATIONS.TAB || path.includes("notifications")) {
      queryClient.invalidateQueries({ queryKey: notificationHistoryQueryKeys.all });
      return;
    }

    // Partners list and partners/{id} (legacy - actual detail is at partner/{id})
    if (path === MOBILE_ROUTES.PROFILE.PARTNERS || path.startsWith("/(user)/profile/partners")) {
      queryClient.invalidateQueries({ queryKey: partnersQueryKeys.all });
      return;
    }

    // Partner detail: /(user)/profile/partner/{partnerUserId}
    if (path.startsWith("/(user)/profile/partner/")) {
      const partnerUserId =
        path.replace("/(user)/profile/partner/", "").split("/")[0] || params.partnerId;
      if (partnerUserId) {
        queryClient.invalidateQueries({ queryKey: partnersQueryKeys.all });
        queryClient.invalidateQueries({ queryKey: partnersQueryKeys.dashboard(partnerUserId) });
      }
      return;
    }

    // Activity (nudges from partners)
    if (path === MOBILE_ROUTES.PROFILE.ACTIVITY) {
      queryClient.invalidateQueries({ queryKey: nudgesQueryKeys.all });
      return;
    }

    // Achievements
    if (path === MOBILE_ROUTES.PROFILE.ACHIEVEMENTS || path === MOBILE_ROUTES.ACHIEVEMENTS.LIST) {
      queryClient.invalidateQueries({ queryKey: achievementsQueryKeys.all });
      return;
    }

    // Profile main
    if (path === MOBILE_ROUTES.PROFILE.MAIN || path.startsWith("/(user)/(tabs)/profile")) {
      queryClient.invalidateQueries({ queryKey: userQueryKeys.currentUser });
      return;
    }

    // Profile settings (may include id param for viewing another user)
    if (path === MOBILE_ROUTES.PROFILE.PROFILE_SETTINGS || path.includes("profile-settings")) {
      const profileId = params.id;
      queryClient.invalidateQueries({ queryKey: userQueryKeys.currentUser });
      if (profileId) {
        queryClient.invalidateQueries({ queryKey: userQueryKeys.userById(profileId) });
      }
      return;
    }

    // Home - invalidate dashboard and goals
    if (path === MOBILE_ROUTES.MAIN.HOME || path === "/(user)/(tabs)") {
      queryClient.invalidateQueries({ queryKey: homeDashboardQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: goalsQueryKeys.all });
      return;
    }
  } catch (e) {
    // Don't block navigation on invalidation errors
    console.warn("[DeepLink] Failed to invalidate queries for route:", route, e);
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

    const normalizedPath = path ? (path.startsWith("/") ? path : `/${path}`) : "/";

    // Custom scheme (fitnudge:///join?ref=CODE) - always process
    const isCustomScheme = url.startsWith("fitnudge://");
    // Universal Links: fitnudge.app (production) or localhost/ngrok (development)
    const isProductionDomain = hostname === "fitnudge.app";
    const isDevelopmentDomain =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname?.endsWith(".ngrok.io") ||
      hostname?.endsWith(".ngrok-free.app") ||
      hostname?.endsWith(".loca.lt") ||
      __DEV__;

    if (!isCustomScheme && !isProductionDomain && !isDevelopmentDomain) {
      return;
    }

    // Reconstruct full path with query params for Expo Router paths
    const queryString =
      queryParams && Object.keys(queryParams).length > 0
        ? `?${new URLSearchParams(queryParams as Record<string, string>).toString()}`
        : "";
    const fullPath = `${normalizedPath}${queryString}`;

    console.log("normalizedPath", normalizedPath);
    console.log("fullPath", fullPath);

    // If the path is already an Expo Router path (starts with /(user) or /(auth) or /(onboarding)),
    // route directly - these come from notification data.deepLink
    if (
      normalizedPath.startsWith("/(user)") ||
      normalizedPath.startsWith("/(auth)") ||
      normalizedPath.startsWith("/(onboarding)")
    ) {
      const authenticated = await isUserAuthenticated();
      console.log("authenticated", authenticated);
      if (authenticated || normalizedPath.startsWith("/(auth)")) {
        invalidateQueriesForRoute(fullPath);
        router.push(fullPath as any);
      } else {
        // User not authenticated - redirect to auth with original destination
        // Check onboarding first so first-time users see intro before signup
        const authUrl = `${MOBILE_ROUTES.AUTH.SIGNUP}?redirectTo=${encodeURIComponent(fullPath)}`;
        await routeToAuthOrOnboarding(authUrl);
      }
      return;
    }

    // Route based on path (external deep links)
    switch (normalizedPath) {
      // =====================================================
      // PUBLIC ROUTES (no auth required)
      // =====================================================
      case "/reset-password":
        if (queryParams?.token) {
          router.push(`${MOBILE_ROUTES.AUTH.RESET_PASSWORD}?token=${queryParams.token}`);
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

      // Help center - /help is used by external links (e.g. Tawk help widget)
      // Map to the actual help-center screen (authenticated route)
      case "/help":
        await routeWithAuthCheck(MOBILE_ROUTES.PROFILE.HELP_CENTER, {
          redirectTo: MOBILE_ROUTES.PROFILE.HELP_CENTER
        });
        break;

      // Referral signup link: /join?ref={code}
      // Goes to signup (or onboarding first if user hasn't seen it)
      case "/join":
        if (queryParams?.ref) {
          await routeToAuthOrOnboarding(`${MOBILE_ROUTES.AUTH.SIGNUP}?referral=${queryParams.ref}`);
        } else {
          await routeToAuthOrOnboarding(MOBILE_ROUTES.AUTH.SIGNUP);
        }
        break;

      // =====================================================
      // AUTHENTICATED ROUTES (require auth check)
      // =====================================================

      // Goals - handles /goal?id=xxx and /goals
      case "/goal":
      case "/goals":
        if (queryParams?.id) {
          await routeWithAuthCheck(`${MOBILE_ROUTES.GOALS.DETAILS}?id=${queryParams.id}`, {
            redirectTo: "goal",
            goalId: queryParams.id as string
          });
        } else if (queryParams?.goalId) {
          // Handle goalId param (from push notifications)
          await routeWithAuthCheck(`${MOBILE_ROUTES.GOALS.DETAILS}?id=${queryParams.goalId}`, {
            redirectTo: "goal",
            goalId: queryParams.goalId as string
          });
        } else {
          await routeWithAuthCheck(MOBILE_ROUTES.GOALS.LIST, {
            redirectTo: "goals"
          });
        }
        break;

      // Profile
      case "/profile":
        if (queryParams?.id) {
          await routeWithAuthCheck(
            `${MOBILE_ROUTES.PROFILE.PROFILE_SETTINGS}?id=${queryParams.id}`,
            {
              redirectTo: "profile",
              profileId: queryParams.id as string
            }
          );
        } else {
          await routeWithAuthCheck(MOBILE_ROUTES.PROFILE.MAIN, {
            redirectTo: "profile"
          });
        }
        break;

      // Notifications - goes to the Notifications tab now
      case "/notification":
      case "/notifications":
        await routeWithAuthCheck(MOBILE_ROUTES.NOTIFICATIONS.TAB, {
          redirectTo: "notifications"
        });
        break;

      // Achievements
      case "/achievement":
      case "/achievements":
        await routeWithAuthCheck(MOBILE_ROUTES.ACHIEVEMENTS.LIST, {
          redirectTo: "achievements"
        });
        break;

      // Check-ins (from push notifications)
      // Route directly to Goal detail screen where user can tap the check-in button
      case "/checkin":
        if (queryParams?.goalId) {
          // Goal check-in - route to goal detail screen
          await routeWithAuthCheck(`${MOBILE_ROUTES.GOALS.DETAILS}?id=${queryParams.goalId}`, {
            redirectTo: "goal",
            goalId: queryParams.goalId as string
          });
        } else {
          await routeWithAuthCheck(MOBILE_ROUTES.MAIN.HOME, {
            redirectTo: "home"
          });
        }
        break;

      // =====================================================
      // PARTNER NOTIFICATIONS (moved to Profile section)
      // =====================================================

      // Partner request received - go to partners screen with "received" tab
      case "/partner-request":
      case "/partners/received":
        await routeWithAuthCheck(`${MOBILE_ROUTES.PROFILE.PARTNERS}?tab=received`, {
          redirectTo: "partners",
          tab: "received"
        });
        break;

      // Partner request accepted - go to partner detail if partnerId provided
      case "/partner-accepted":
      case "/partner":
        if (queryParams?.partnerId && queryParams?.partnershipId) {
          await routeWithAuthCheck(
            MOBILE_ROUTES.PROFILE.PARTNER_DETAIL(
              queryParams.partnerId as string,
              queryParams.partnershipId as string
            ),
            {
              redirectTo: "partner",
              partnerId: queryParams.partnerId as string
            }
          );
        } else if (queryParams?.partnerId) {
          // Fall back to partner detail with just partnerId
          await routeWithAuthCheck(`${MOBILE_ROUTES.PROFILE.PARTNERS}/${queryParams.partnerId}`, {
            redirectTo: "partner",
            partnerId: queryParams.partnerId as string
          });
        } else {
          await routeWithAuthCheck(MOBILE_ROUTES.PROFILE.PARTNERS, {
            redirectTo: "partners"
          });
        }
        break;

      // Partners list
      case "/partners":
        await routeWithAuthCheck(MOBILE_ROUTES.PROFILE.PARTNERS, {
          redirectTo: "partners"
        });
        break;

      // Partner nudge/cheer/milestone - go to partner detail or goal
      case "/partner-nudge":
      case "/partner-cheer":
      case "/partner-milestone":
        if (queryParams?.goalId) {
          await routeWithAuthCheck(`${MOBILE_ROUTES.GOALS.DETAILS}?id=${queryParams.goalId}`, {
            redirectTo: "goal",
            goalId: queryParams.goalId as string
          });
        } else if (queryParams?.partnerId && queryParams?.partnershipId) {
          await routeWithAuthCheck(
            MOBILE_ROUTES.PROFILE.PARTNER_DETAIL(
              queryParams.partnerId as string,
              queryParams.partnershipId as string
            ),
            {
              redirectTo: "partner",
              partnerId: queryParams.partnerId as string
            }
          );
        } else {
          await routeWithAuthCheck(MOBILE_ROUTES.PROFILE.PARTNERS, {
            redirectTo: "partners"
          });
        }
        break;

      // =====================================================
      // OTHER NOTIFICATIONS
      // =====================================================

      // Weekly recap
      case "/weekly-recap":
        if (queryParams?.recapId) {
          await routeWithAuthCheck(
            MOBILE_ROUTES.PROFILE.RECAP_DETAIL(queryParams.recapId as string),
            {
              redirectTo: "weekly-recap",
              recapId: queryParams.recapId as string
            }
          );
        } else if (queryParams?.goalId) {
          // Legacy - redirect to goal if goalId provided
          await routeWithAuthCheck(`${MOBILE_ROUTES.GOALS.DETAILS}?id=${queryParams.goalId}`, {
            redirectTo: "goal",
            goalId: queryParams.goalId as string
          });
        } else {
          await routeWithAuthCheck(MOBILE_ROUTES.PROFILE.WEEKLY_RECAPS, {
            redirectTo: "weekly-recaps"
          });
        }
        break;

      // Streak milestone
      case "/streak-milestone":
        if (queryParams?.goalId) {
          await routeWithAuthCheck(`${MOBILE_ROUTES.GOALS.DETAILS}?id=${queryParams.goalId}`, {
            redirectTo: "goal",
            goalId: queryParams.goalId as string
          });
        } else {
          await routeWithAuthCheck(MOBILE_ROUTES.MAIN.HOME, {
            redirectTo: "home"
          });
        }
        break;

      // Goal complete
      case "/goal-complete":
        if (queryParams?.goalId) {
          await routeWithAuthCheck(`${MOBILE_ROUTES.GOALS.DETAILS}?id=${queryParams.goalId}`, {
            redirectTo: "goal",
            goalId: queryParams.goalId as string
          });
        } else {
          await routeWithAuthCheck(MOBILE_ROUTES.GOALS.LIST, {
            redirectTo: "goals"
          });
        }
        break;

      // Subscription notifications - redirect to profile since subscription removed from menu
      case "/subscription":
        await routeWithAuthCheck(MOBILE_ROUTES.PROFILE.MAIN, {
          redirectTo: "profile"
        });
        break;

      // Nudges/activity (moved to Profile section)
      case "/nudges":
      case "/activity":
        await routeWithAuthCheck(MOBILE_ROUTES.PROFILE.ACTIVITY, {
          redirectTo: "activity"
        });
        break;

      // Inbox/notifications tab
      case "/inbox":
        await routeWithAuthCheck(MOBILE_ROUTES.NOTIFICATIONS.TAB, {
          redirectTo: "notifications"
        });
        break;

      // Default: handle dynamic paths or go to home
      default:
        // Handle /goal/{goalId} format (from push notifications)
        if (normalizedPath.startsWith("/goal/")) {
          const goalId = normalizedPath.replace("/goal/", "");
          if (goalId) {
            await routeWithAuthCheck(`${MOBILE_ROUTES.GOALS.DETAILS}?id=${goalId}`, {
              redirectTo: "goal",
              goalId
            });
            break;
          }
        }

        // Handle /partner/{partnerId} format (from partner notifications)
        if (normalizedPath.startsWith("/partner/")) {
          const partnerId = normalizedPath.replace("/partner/", "");
          if (partnerId) {
            await routeWithAuthCheck(`${MOBILE_ROUTES.PROFILE.PARTNERS}/${partnerId}`, {
              redirectTo: "partner",
              partnerId
            });
            break;
          }
        }

        // Handle /weekly-recap/{recapId} format
        if (normalizedPath.startsWith("/weekly-recap/")) {
          const recapId = normalizedPath.replace("/weekly-recap/", "");
          if (recapId) {
            await routeWithAuthCheck(MOBILE_ROUTES.PROFILE.RECAP_DETAIL(recapId), {
              redirectTo: "weekly-recap",
              recapId
            });
            break;
          }
        }

        // Default: home (with auth check)
        await routeWithAuthCheck(MOBILE_ROUTES.MAIN.HOME, {
          redirectTo: "home"
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
