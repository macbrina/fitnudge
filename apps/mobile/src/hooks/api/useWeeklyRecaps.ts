/**
 * Weekly Recaps Hooks
 *
 * React Query hooks for fetching and managing weekly recaps.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { recapsService, WeeklyRecap, WeeklyRecapsListResponse } from "@/services/api/recaps";
import { ApiError } from "@/services/api/base";
import { weeklyRecapsQueryKeys } from "./queryKeys";

// Re-export query keys for convenience
export { weeklyRecapsQueryKeys };

// ============================================================================
// Hooks
// ============================================================================

/**
 * Get list of cached weekly recaps.
 * PREMIUM FEATURE: Only fetch if user has weekly_recap feature.
 */
export const useWeeklyRecaps = (
  limit: number = 10,
  offset: number = 0,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: weeklyRecapsQueryKeys.list(limit, offset),
    queryFn: async (): Promise<WeeklyRecapsListResponse> => {
      const response = await recapsService.getList(limit, offset);
      if (response.status !== 200 || !response.data) {
        throw new Error(response.error || "Failed to fetch weekly recaps");
      }
      return response.data;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000 // 30 minutes
  });
};

/**
 * Get current week's recap (generates if not cached)
 */
export const useCurrentWeekRecap = (enabled: boolean = true) => {
  return useQuery({
    queryKey: weeklyRecapsQueryKeys.current(),
    queryFn: async (): Promise<WeeklyRecap> => {
      const response = await recapsService.getCurrentWeek();
      if (response.status !== 200 || !response.data) {
        throw new Error(response.error || "Failed to fetch current week recap");
      }
      return response.data;
    },
    enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes - recaps don't change often
    gcTime: 60 * 60 * 1000, // 1 hour
    retry: 1 // Only retry once since generating can be slow
  });
};

/**
 * Get a specific recap by ID.
 * PREMIUM FEATURE: Only fetch if user has weekly_recap feature.
 */
export const useWeeklyRecapDetail = (recapId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: weeklyRecapsQueryKeys.detail(recapId),
    queryFn: async (): Promise<WeeklyRecap | null> => {
      try {
        const response = await recapsService.getById(recapId);
        if (response.status !== 200 || !response.data) {
          throw new Error(response.error || "Failed to fetch weekly recap");
        }
        return response.data;
      } catch (err) {
        // BaseApiService throws ApiError on non-2xx.
        // For a true 404, return null so the UI can render NotFoundState
        // and React Query clears the previous cached data.
        if (err instanceof ApiError && err.status === 404) {
          return null;
        }
        throw err;
      }
    },
    enabled: enabled && !!recapId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    retry: false
  });
};

/**
 * Force regenerate current week's recap
 */
export const useRegenerateRecap = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<WeeklyRecap> => {
      const response = await recapsService.getCurrentWeek(true);
      if (response.status !== 200 || !response.data) {
        throw new Error(response.error || "Failed to regenerate weekly recap");
      }
      return response.data;
    },
    onSuccess: (newRecap) => {
      // Update the cache directly with the new recap
      queryClient.setQueryData(weeklyRecapsQueryKeys.current(), newRecap);
      // Invalidate list to include new recap
      queryClient.invalidateQueries({
        queryKey: weeklyRecapsQueryKeys.all
      });
    }
  });
};
