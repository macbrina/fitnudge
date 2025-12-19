import { useQuery } from "@tanstack/react-query";
import { userService } from "@/services/api/user";

// Query keys
export const referralQueryKeys = {
  all: ["referral"] as const,
  code: () => [...referralQueryKeys.all, "code"] as const,
  referrals: () => [...referralQueryKeys.all, "list"] as const,
} as const;

/**
 * Get current user's referral code and link
 */
export const useReferralCode = () => {
  return useQuery({
    queryKey: referralQueryKeys.code(),
    queryFn: () => userService.getReferralCode(),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - referral code rarely changes
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
  });
};
