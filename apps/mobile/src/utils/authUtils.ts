import { useAuthStore } from "@/stores/authStore";
import { TokenManager } from "@/services/api/base";
import { router } from "expo-router";
import { MOBILE_ROUTES } from "@/lib/routes";

export type LogoutReason =
  | "not_found"
  | "disabled"
  | "suspended"
  | "expired_session";

const statusMessages: Record<LogoutReason, string> = {
  not_found: "Account not found or invalid credentials.",
  disabled: "Your account has been disabled. Please contact support.",
  suspended: "Your account has been suspended. Please contact support.",
  expired_session: "Session expired. Please login again.",
};

/**
 * Handle automatic logout with status-specific error messages
 * @param reason - The reason for logout (not_found, disabled, or suspended)
 * @returns Status-specific error message
 */
export async function handleAutoLogout(reason: LogoutReason): Promise<string> {
  const wasAuthenticated = useAuthStore.getState().isAuthenticated;

  // Clear auth store
  await useAuthStore.getState().logout();

  // Clear tokens (logout already does this, but ensure it's done)
  await TokenManager.clearTokens();
  await TokenManager.clearRememberMe();

  // Navigate to login screen only if we were previously in an authenticated flow
  if (wasAuthenticated) {
    router.replace(MOBILE_ROUTES.AUTH.LOGIN);
  }

  // Return status-specific message for display
  return statusMessages[reason];
}

/**
 * Get status message for a logout reason
 */
export function getLogoutMessage(reason: LogoutReason): string {
  return statusMessages[reason];
}
