import { useAuthStore } from "@/stores/authStore";
import { TokenManager, setLoggingOut } from "@/services/api/base";
import { router } from "expo-router";
import { MOBILE_ROUTES } from "@/lib/routes";
import { storageUtil } from "./storageUtil";

export type LogoutReason = "not_found" | "disabled" | "suspended" | "expired_session";

const statusMessages: Record<LogoutReason, string> = {
  not_found: "Account not found or invalid credentials.",
  disabled: "Your account has been disabled. Please contact support.",
  suspended: "Your account has been suspended. Please contact support.",
  expired_session: "Session expired. Please login again."
};

// Guard to prevent multiple simultaneous logout calls
let isLoggingOut = false;
let logoutPromise: Promise<string> | null = null;

/**
 * Handle automatic logout with status-specific error messages
 * @param reason - The reason for logout (not_found, disabled, suspended, or expired_session)
 * @returns Status-specific error message
 */
export async function handleAutoLogout(reason: LogoutReason): Promise<string> {
  console.log(`[Auth] handleAutoLogout: ${reason}`);
  console.log("isLoaggingo", isLoggingOut);
  console.log("logoutPromise", logoutPromise);

  // If already logging out, return the existing promise (silently ignore duplicates)
  if (isLoggingOut && logoutPromise) {
    return logoutPromise;
  }

  // Mark as logging out
  isLoggingOut = true;

  // Create the logout promise
  logoutPromise = performLogout(reason);

  try {
    const result = await logoutPromise;
    return result;
  } finally {
    // Reset after a delay to allow navigation to complete
    setTimeout(() => {
      isLoggingOut = false;
      logoutPromise = null;
    }, 1000);
  }
}

async function performLogout(reason: LogoutReason): Promise<string> {
  const wasAuthenticated = useAuthStore.getState().isAuthenticated;

  // If user wasn't authenticated, this is likely a login failure
  // Don't clear storage or trigger logout flow
  if (!wasAuthenticated) {
    console.log(`[Auth] Skipping logout for unauthenticated user (reason: ${reason})`);
    return statusMessages[reason];
  }

  console.log(`[Auth] Logout: ${reason} (user was authenticated)`);

  // Clear auth store (this immediately sets isAuthenticated: false)
  await useAuthStore.getState().logout(reason as any);

  // Set the global flag to stop any further API requests
  setLoggingOut(true);

  // Clear appropriate storage based on reason
  if (reason === "not_found") {
    console.log("User was deleted - clearing all user data");
    // User was deleted - clear ALL user data
    // NOTE: System permissions (notification, camera, media) are OS-level
    // and cannot be revoked. They will persist, but app will re-check on next use.
    await storageUtil.clearAll();
  } else if (reason === "disabled" || reason === "suspended") {
    // Account issue - clear all data (they might create new account)
    // NOTE: System permissions persist (cannot be revoked programmatically)
    await storageUtil.clearAll();
  } else if (reason === "expired_session") {
    // Just session expired - only clear auth data, preserve preferences
    await storageUtil.clearAuthData();
  }

  // // Navigate to login screen
  // setTimeout(() => {
  //   router.replace(MOBILE_ROUTES.AUTH.LOGIN);
  // }, 100);

  // Return status-specific message for display
  return statusMessages[reason];
}

/**
 * Get status message for a logout reason
 */
export function getLogoutMessage(reason: LogoutReason): string {
  return statusMessages[reason];
}
