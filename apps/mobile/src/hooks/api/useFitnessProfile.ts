import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { onboardingApi, FitnessProfileResponse } from "@/services/api/onboarding";

// Query keys for fitness profile
export const fitnessProfileQueryKeys = {
  all: ["fitness-profile"] as const,
  profile: () => [...fitnessProfileQueryKeys.all, "profile"] as const
};

/**
 * Hook to fetch fitness profile with React Query caching
 * Used by PersonalizationScreen and can be shared with other screens
 */
export function useFitnessProfile() {
  return useQuery({
    queryKey: fitnessProfileQueryKeys.profile(),
    queryFn: async () => {
      const profile = await onboardingApi.getProfile();
      return profile;
    },
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    gcTime: 1000 * 60 * 30, // Keep in cache for 30 minutes
    retry: 1 // Only retry once on failure
  });
}

/**
 * Hook to update fitness profile with optimistic updates
 */
export function useUpdateFitnessProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<FitnessProfileResponse>) => {
      await onboardingApi.updateProfile(updates);
      return updates;
    },
    onMutate: async (updates) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: fitnessProfileQueryKeys.profile()
      });

      // Snapshot the previous value
      const previousProfile = queryClient.getQueryData<FitnessProfileResponse>(
        fitnessProfileQueryKeys.profile()
      );

      // Optimistically update to the new value
      if (previousProfile) {
        queryClient.setQueryData(fitnessProfileQueryKeys.profile(), {
          ...previousProfile,
          ...updates
        });
      }

      // Return context with the previous value
      return { previousProfile };
    },
    onError: (_error, _updates, context) => {
      // Rollback to previous value on error
      if (context?.previousProfile) {
        queryClient.setQueryData(fitnessProfileQueryKeys.profile(), context.previousProfile);
      }
    },
    onSuccess: () => {
      // Invalidate to ensure we have the latest data
      queryClient.invalidateQueries({
        queryKey: fitnessProfileQueryKeys.profile()
      });
    }
  });
}

/**
 * Hook to check if user has a fitness profile (quick check)
 */
export function useHasFitnessProfile() {
  const { data, isLoading } = useFitnessProfile();
  return {
    hasFitnessProfile: !!data,
    isLoading
  };
}
