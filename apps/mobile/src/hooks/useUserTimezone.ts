import { useAuthStore } from "@/stores/authStore";
import { useCurrentUser } from "@/hooks/api/useUser";

/**
 * Hook to get the user's stored timezone.
 * Falls back to device timezone if user timezone is not available.
 * @returns User's timezone (IANA format, e.g., 'America/New_York')
 */
export const useUserTimezone = (): string => {
  const { user } = useAuthStore();
  const { data: currentUserResponse } = useCurrentUser();

  // Try to get timezone from auth store first (faster)
  if (user?.timezone) {
    return user.timezone;
  }

  // Try to get timezone from API response
  if (currentUserResponse?.data?.timezone) {
    return currentUserResponse.data.timezone;
  }

  // Fallback to device timezone if user timezone is not available
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};
