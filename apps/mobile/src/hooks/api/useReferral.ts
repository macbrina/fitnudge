import { useQuery, useQueryClient } from "@tanstack/react-query";
import { userService } from "@/services/api/user";
import { useCallback } from "react";

// Query keys
export const referralQueryKeys = {
  all: ["referral"] as const,
  code: () => [...referralQueryKeys.all, "code"] as const,
  referrals: () => [...referralQueryKeys.all, "list"] as const
} as const;

/**
 * Get current user's referral code and link
 */
export const useReferralCode = () => {
  return useQuery({
    queryKey: referralQueryKeys.code(),
    queryFn: () => userService.getReferralCode(),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - referral code rarely changes
    gcTime: 24 * 60 * 60 * 1000
  });
};

/**
 * Get list of users referred by current user
 */
export const useMyReferrals = () => {
  return useQuery({
    queryKey: referralQueryKeys.referrals(),
    queryFn: () => userService.getMyReferrals(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000
  });
};

/**
 * Hook to force refresh referral data (invalidates cache first to ensure network call)
 */
export const useRefreshReferrals = () => {
  const queryClient = useQueryClient();

  return useCallback(async () => {
    // Invalidate marks data as stale, then refetch forces network call
    await queryClient.invalidateQueries({ queryKey: referralQueryKeys.all });
    await Promise.all([
      queryClient.refetchQueries({ queryKey: referralQueryKeys.code() }),
      queryClient.refetchQueries({ queryKey: referralQueryKeys.referrals() })
    ]);
  }, [queryClient]);
};
