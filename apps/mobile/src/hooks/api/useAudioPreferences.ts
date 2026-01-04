/**
 * Audio Preferences Hooks
 *
 * React Query hooks for fetching and updating user audio preferences.
 */

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  audioPreferencesService,
  type AudioPreferences,
  type UpdateAudioPreferencesRequest
} from "@/services/api/audioPreferences";

const QUERY_KEY = ["audio-preferences"];

/**
 * Fetch user's audio preferences
 * Automatically creates defaults if they don't exist
 */
export function useAudioPreferences() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => audioPreferencesService.getPreferences(),
    staleTime: 1000 * 60 * 60, // 1 hour - preferences don't change often
    gcTime: 1000 * 60 * 60 * 24 // 24 hours
  });
}

/**
 * Update audio preferences mutation
 * Optimistically updates the cache
 */
export function useUpdateAudioPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: UpdateAudioPreferencesRequest) =>
      audioPreferencesService.updatePreferences(updates),

    // Optimistic update
    onMutate: async (updates) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });

      // Snapshot current value
      const previousPrefs = queryClient.getQueryData<AudioPreferences>(QUERY_KEY);

      // Optimistically update
      if (previousPrefs) {
        queryClient.setQueryData<AudioPreferences>(QUERY_KEY, {
          ...previousPrefs,
          ...updates
        });
      }

      return { previousPrefs };
    },

    // Rollback on error
    onError: (_err, _updates, context) => {
      if (context?.previousPrefs) {
        queryClient.setQueryData(QUERY_KEY, context.previousPrefs);
      }
    },

    // Always refetch after error or success
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    }
  });
}

/**
 * Get cached audio preferences synchronously
 * Returns undefined if not cached
 */
export function useAudioPreferencesCache(): AudioPreferences | undefined {
  const queryClient = useQueryClient();
  return queryClient.getQueryData<AudioPreferences>(QUERY_KEY);
}

/**
 * Prefetch audio preferences
 * Call this when loading workout plan to have preferences ready
 */
export function usePrefetchAudioPreferences() {
  const queryClient = useQueryClient();

  const prefetch = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: QUERY_KEY,
      queryFn: () => audioPreferencesService.getPreferences(),
      staleTime: 1000 * 60 * 60 // 1 hour
    });
  }, [queryClient]);

  return { prefetch };
}
