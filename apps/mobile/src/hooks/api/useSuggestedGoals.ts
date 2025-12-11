import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryObserverResult,
} from "@tanstack/react-query";
import {
  onboardingApi,
  type SuggestedGoalsStatusResponse,
} from "@/services/api/onboarding";

export const suggestedGoalsQueryKeys = {
  root: ["onboarding", "suggested-goals"] as const,
  status: () => [...suggestedGoalsQueryKeys.root, "status"] as const,
};

export const useSuggestedGoalsStatus = (
  enabled: boolean = true
): QueryObserverResult<SuggestedGoalsStatusResponse, unknown> => {
  return useQuery({
    queryKey: suggestedGoalsQueryKeys.status(),
    queryFn: () => onboardingApi.getSuggestedGoalsStatus(),
    enabled,
    refetchInterval: (query) => {
      const status =
        query.state.data?.status ?? (query.state.data as any)?.status;
      // Poll every 5 seconds when pending, otherwise don't poll
      return status === "pending" ? 5000 : false;
    },
    staleTime: 0, // Always consider data stale to ensure fresh fetches
    refetchOnMount: true, // Refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });
};

export type GoalTypeOption =
  | "habit"
  | "time_challenge"
  | "target_challenge"
  | "mixed";

export const useRequestSuggestedGoals = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (goalType: GoalTypeOption = "habit") =>
      onboardingApi.requestSuggestedGoals(goalType),
    onMutate: async () => {
      // Cancel any in-flight queries to avoid race conditions
      await queryClient.cancelQueries({
        queryKey: suggestedGoalsQueryKeys.status(),
      });

      // CRITICAL: Set status to "pending" with NO goals to prevent showing stale data
      // This ensures loading state is shown immediately
      queryClient.setQueryData<SuggestedGoalsStatusResponse>(
        suggestedGoalsQueryKeys.status(),
        { status: "pending" }
      );
    },
    onSuccess: (data) => {
      // Update with the actual response from API (should be { status: "pending" })
      // Ensure we don't accidentally restore old goals
      queryClient.setQueryData<SuggestedGoalsStatusResponse>(
        suggestedGoalsQueryKeys.status(),
        { status: data.status || "pending" }
      );
    },
    onSettled: () => {
      // Invalidate to trigger refetch and start polling
      queryClient.invalidateQueries({
        queryKey: suggestedGoalsQueryKeys.status(),
        refetchType: "active",
      });
    },
  });
};

export const useRegenerateSuggestedGoals = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (goalType: GoalTypeOption = "habit") =>
      onboardingApi.regenerateSuggestedGoals(goalType),
    onMutate: async () => {
      // Cancel any in-flight queries
      await queryClient.cancelQueries({
        queryKey: suggestedGoalsQueryKeys.status(),
      });

      // CRITICAL: Set status to "pending" with NO goals to prevent showing stale data
      // This ensures loading state is shown immediately
      queryClient.setQueryData<SuggestedGoalsStatusResponse>(
        suggestedGoalsQueryKeys.status(),
        { status: "pending" }
      );
    },
    onSuccess: (data) => {
      // Update with the actual response from API (includes new regeneration_count)
      queryClient.setQueryData<SuggestedGoalsStatusResponse>(
        suggestedGoalsQueryKeys.status(),
        {
          status: data.status || "pending",
          regeneration_count: data.regeneration_count,
        }
      );
    },
    onSettled: () => {
      // Invalidate to trigger refetch and start polling
      queryClient.invalidateQueries({
        queryKey: suggestedGoalsQueryKeys.status(),
        refetchType: "active",
      });
    },
  });
};
