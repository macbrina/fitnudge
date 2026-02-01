import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dailyMotivationService, DailyMotivation } from "@/services/api";
import { useUserTimezone } from "@/hooks/useUserTimezone";

// Query Keys
export const dailyMotivationsQueryKeys = {
  all: ["dailyMotivations"] as const,
  today: (tz?: string) => [...dailyMotivationsQueryKeys.all, "today", tz] as const,
  list: (limit?: number, offset?: number) =>
    [...dailyMotivationsQueryKeys.all, "list", limit, offset] as const,
  detail: (id: string) => [...dailyMotivationsQueryKeys.all, "detail", id] as const
} as const;

// Helper to get milliseconds until midnight (next motivation)
const getMillisecondsUntilMidnight = () => {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
};

// Daily Motivations Hooks
export const useTodayDailyMotivation = () => {
  const tz = useUserTimezone();
  return useQuery({
    queryKey: dailyMotivationsQueryKeys.today(tz),
    queryFn: async () => {
      const response = await dailyMotivationService.getToday(tz);
      if (response.status !== 200 || !response.data) {
        throw new Error(response.error || "Failed to fetch daily motivation");
      }
      return response.data;
    },
    staleTime: getMillisecondsUntilMidnight(), // Cache until midnight when new motivation is generated
    gcTime: 24 * 60 * 60 * 1000 // 24 hours - keep in cache for a full day
  });
};

export const useDailyMotivations = (limit: number = 30, offset: number = 0) => {
  return useQuery({
    queryKey: dailyMotivationsQueryKeys.list(limit, offset),
    queryFn: async () => {
      const response = await dailyMotivationService.getList(limit, offset);
      if (response.status !== 200 || !response.data) {
        throw new Error(response.error || "Failed to fetch daily motivations");
      }
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    placeholderData: []
  });
};

export const useDailyMotivation = (motivationId: string) => {
  return useQuery({
    queryKey: dailyMotivationsQueryKeys.detail(motivationId),
    queryFn: async () => {
      const response = await dailyMotivationService.getById(motivationId);
      if (response.status !== 200 || !response.data) {
        throw new Error(response.error || "Failed to fetch daily motivation");
      }
      return response.data;
    },
    enabled: !!motivationId,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
};

export const useShareDailyMotivation = () => {
  const queryClient = useQueryClient();
  const tz = useUserTimezone();

  return useMutation({
    mutationFn: (motivationId: string) => dailyMotivationService.share(motivationId),
    onMutate: async (motivationId) => {
      await queryClient.cancelQueries({
        queryKey: dailyMotivationsQueryKeys.today(tz)
      });

      const previousToday = queryClient.getQueryData(dailyMotivationsQueryKeys.today(tz));

      queryClient.setQueryData(dailyMotivationsQueryKeys.today(tz), (old: any) => {
        if (!old) return old;
        return { ...old, share_count: (old.share_count || 0) + 1 };
      });

      return { previousToday };
    },
    onError: (err, motivationId, context) => {
      if (context?.previousToday) {
        queryClient.setQueryData(dailyMotivationsQueryKeys.today(tz), context.previousToday);
      }
    }
  });
};

export const useRegenerateDailyMotivation = () => {
  const queryClient = useQueryClient();
  const tz = useUserTimezone();

  return useMutation({
    mutationFn: async () => {
      const response = await dailyMotivationService.regenerate(tz);
      if (response.status !== 200 || !response.data) {
        throw new Error(response.error || "Failed to regenerate daily motivation");
      }
      return response.data;
    },
    onSuccess: (newMotivation) => {
      queryClient.setQueryData(dailyMotivationsQueryKeys.today(tz), newMotivation);
      queryClient.invalidateQueries({ queryKey: dailyMotivationsQueryKeys.all });
    }
  });
};
