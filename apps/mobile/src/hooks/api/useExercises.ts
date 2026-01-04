import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { exercisesService, Exercise, SearchExercisesParams } from "@/services/api/exercises";

// Query keys
export const exercisesQueryKeys = {
  all: ["exercises"] as const,
  detail: (id: string) => ["exercises", "detail", id] as const,
  search: (params: SearchExercisesParams) => ["exercises", "search", params] as const,
  popular: (limit: number) => ["exercises", "popular", limit] as const
};

/**
 * Hook to fetch exercise details by ID
 */
export const useExerciseDetails = (exerciseId: string | undefined, enabled = true) => {
  return useQuery({
    queryKey: exercisesQueryKeys.detail(exerciseId || ""),
    queryFn: () => exercisesService.getExerciseById(exerciseId!),
    enabled: enabled && !!exerciseId,
    staleTime: 60 * 60 * 1000, // 1 hour (exercise data rarely changes)
    gcTime: 24 * 60 * 60 * 1000 // 24 hours cache
  });
};

/**
 * Hook to search exercises with filters
 */
export const useSearchExercises = (params: SearchExercisesParams, enabled = true) => {
  return useQuery({
    queryKey: exercisesQueryKeys.search(params),
    queryFn: () => exercisesService.searchExercises(params),
    enabled,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
};

/**
 * Hook to get popular exercises
 */
export const usePopularExercises = (limit: number = 20, enabled = true) => {
  return useQuery({
    queryKey: exercisesQueryKeys.popular(limit),
    queryFn: () => exercisesService.getPopularExercises(limit),
    enabled,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
};

/**
 * Hook to invalidate all exercise queries (forces refetch)
 */
export const useInvalidateExercises = () => {
  const queryClient = useQueryClient();

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: exercisesQueryKeys.all });
  }, [queryClient]);

  const invalidateDetail = useCallback(
    (exerciseId: string) => {
      queryClient.invalidateQueries({
        queryKey: exercisesQueryKeys.detail(exerciseId)
      });
    },
    [queryClient]
  );

  return { invalidateAll, invalidateDetail };
};

export type { Exercise };
