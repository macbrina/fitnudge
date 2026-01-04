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
    const authRoute = authType === "login" ? MOBILE_ROUTES.AUTH.LOGIN : MOBILE_ROUTES.AUTH.SIGNUP;
    const authUrl = params.toString() ? `${authRoute}?${params.toString()}` : authRoute;
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

    const normalizedPath = path ? (path.startsWith("/") ? path : `/${path}`) : "/";

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

    // If the path is already an Expo Router path (starts with /(user) or /(auth) or /(onboarding)),
    // route directly - these come from notification data.deepLink
    if (
      normalizedPath.startsWith("/(user)") ||
      normalizedPath.startsWith("/(auth)") ||
      normalizedPath.startsWith("/(onboarding)")
    ) {
      const authenticated = await isUserAuthenticated();
      if (authenticated || normalizedPath.startsWith("/(auth)")) {
        router.push(normalizedPath as any);
      } else {
        // User not authenticated - redirect to auth with original destination
        const params = new URLSearchParams({ redirectTo: normalizedPath });
        router.push(`${MOBILE_ROUTES.AUTH.SIGNUP}?${params.toString()}`);
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

      // Referral signup link: /join?ref={code}
      // Always goes to signup (this IS a signup route)
      case "/join":
        if (queryParams?.ref) {
          router.push(`${MOBILE_ROUTES.AUTH.SIGNUP}?referral=${queryParams.ref}`);
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
          await routeWithAuthCheck(`${MOBILE_ROUTES.SOCIAL.USER_PROFILE}?id=${queryParams.id}`, {
            redirectTo: "profile",
            profileId: queryParams.id as string
          });
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
      // Route directly to Goal/Challenge detail screen where user can tap the check-in button
      // This works for all tracking types (checkin, meal, hydration, workout)
      case "/checkin":
        if (queryParams?.goalId) {
          // Goal check-in - route to goal detail screen
          await routeWithAuthCheck(`${MOBILE_ROUTES.GOALS.DETAILS}?id=${queryParams.goalId}`, {
            redirectTo: "goal",
            goalId: queryParams.goalId as string
          });
        } else if (queryParams?.challengeId) {
          // Challenge check-in - route to challenge detail screen
          await routeWithAuthCheck(
            MOBILE_ROUTES.CHALLENGES.DETAILS(queryParams.challengeId as string),
            {
              redirectTo: "challenge",
              challengeId: queryParams.challengeId as string
            }
          );
        } else {
          await routeWithAuthCheck(MOBILE_ROUTES.MAIN.HOME, {
            redirectTo: "home"
          });
        }
        break;

      // Challenges - handles /challenge?id=xxx (from plan_ready notifications)
      case "/challenge":
        if (queryParams?.id) {
          await routeWithAuthCheck(MOBILE_ROUTES.CHALLENGES.DETAILS(queryParams.id as string), {
            redirectTo: "challenge",
            challengeId: queryParams.id as string
          });
        } else if (queryParams?.challengeId) {
          // Handle challengeId param (from push notifications)
          await routeWithAuthCheck(
            MOBILE_ROUTES.CHALLENGES.DETAILS(queryParams.challengeId as string),
            {
              redirectTo: "challenge",
              challengeId: queryParams.challengeId as string
            }
          );
        } else {
          // No ID provided, go to goals list (challenges are shown there)
          await routeWithAuthCheck(MOBILE_ROUTES.MAIN.GOALS, {
            redirectTo: "goals"
          });
        }
        break;

      // =====================================================
      // PARTNER NOTIFICATIONS (moved to Profile section)
      // =====================================================

      // Partner request received - go to partners screen
      case "/partner-request":
      case "/partners/received":
        await routeWithAuthCheck(MOBILE_ROUTES.PROFILE.PARTNERS, {
          redirectTo: "partners"
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
      // CHALLENGE NOTIFICATIONS
      // =====================================================

      // Challenge invite
      case "/challenge-invite":
        if (queryParams?.challengeId) {
          await routeWithAuthCheck(
            MOBILE_ROUTES.CHALLENGES.DETAILS(queryParams.challengeId as string),
            {
              redirectTo: "challenge",
              challengeId: queryParams.challengeId as string
            }
          );
        } else {
          await routeWithAuthCheck(`${MOBILE_ROUTES.GOALS.LIST}?tab=challenges`, {
            redirectTo: "challenges"
          });
        }
        break;

      // Challenge leaderboard updates (overtaken, lead)
      case "/challenge-leaderboard":
      case "/challenge-overtaken":
      case "/challenge-lead":
        if (queryParams?.challengeId) {
          await routeWithAuthCheck(
            MOBILE_ROUTES.CHALLENGES.DETAILS(queryParams.challengeId as string),
            {
              redirectTo: "challenge",
              challengeId: queryParams.challengeId as string
            }
          );
        } else {
          await routeWithAuthCheck(`${MOBILE_ROUTES.GOALS.LIST}?tab=challenges`, {
            redirectTo: "challenges"
          });
        }
        break;

      // Challenge starting/ending/ended
      case "/challenge-starting":
      case "/challenge-ending":
      case "/challenge-ended":
        if (queryParams?.challengeId) {
          await routeWithAuthCheck(
            MOBILE_ROUTES.CHALLENGES.DETAILS(queryParams.challengeId as string),
            {
              redirectTo: "challenge",
              challengeId: queryParams.challengeId as string
            }
          );
        } else {
          await routeWithAuthCheck(`${MOBILE_ROUTES.GOALS.LIST}?tab=challenges`, {
            redirectTo: "challenges"
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

      // Social tab (for general social notifications)
      case "/social":
        await routeWithAuthCheck(MOBILE_ROUTES.SOCIAL.FEED, {
          redirectTo: "social"
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
        // Challenge detail link: /challenge/{id}
        if (normalizedPath.startsWith("/challenge/")) {
          const challengeId = normalizedPath.replace("/challenge/", "");
          if (challengeId && challengeId !== "join") {
            await routeWithAuthCheck(MOBILE_ROUTES.CHALLENGES.DETAILS(challengeId), {
              redirectTo: "challenge",
              challengeId
            });
            break;
          }
        }

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
