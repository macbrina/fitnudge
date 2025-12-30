/**
 * React Query hook for workout music
 *
 * Fetches and caches workout music tracks.
 * Music library rarely changes, so we use long cache times.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { workoutMusicService } from "@/services/api/workoutMusic";
import type { WorkoutMusicTrack } from "@/types/audio";

// Query key for workout music
export const WORKOUT_MUSIC_QUERY_KEY = ["workout-music"];

/**
 * Hook to fetch all workout music tracks.
 *
 * Uses long cache times since music library rarely changes.
 */
export function useWorkoutMusic() {
  return useQuery<WorkoutMusicTrack[], Error>({
    queryKey: WORKOUT_MUSIC_QUERY_KEY,
    queryFn: async () => {
      console.log("[useWorkoutMusic] Fetching music tracks...");
      const tracks = await workoutMusicService.getAll();
      console.log("[useWorkoutMusic] Fetched", tracks.length, "tracks");
      return tracks;
    },
    // Music rarely changes, cache for 24 hours
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days
    placeholderData: [],
  });
}

/**
 * Hook to prefetch workout music.
 *
 * Use this when loading the plan to ensure music is ready.
 */
export function usePrefetchWorkoutMusic() {
  const queryClient = useQueryClient();

  const prefetch = () => {
    return queryClient.prefetchQuery({
      queryKey: WORKOUT_MUSIC_QUERY_KEY,
      queryFn: () => workoutMusicService.getAll(),
      staleTime: 24 * 60 * 60 * 1000,
    });
  };

  return { prefetch };
}

/**
 * Get cached workout music tracks synchronously.
 *
 * Returns null if not yet cached.
 */
export function useWorkoutMusicCache() {
  const queryClient = useQueryClient();

  const getCached = (): WorkoutMusicTrack[] | null => {
    return (
      queryClient.getQueryData<WorkoutMusicTrack[]>(WORKOUT_MUSIC_QUERY_KEY) ??
      null
    );
  };

  return { getCached };
}
