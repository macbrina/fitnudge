import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  nudgesService,
  Nudge,
  SendNudgeRequest,
  NudgeType,
} from "@/services/api/nudges";
import { nudgesQueryKeys } from "./queryKeys";

// Re-export query keys for external use
export { nudgesQueryKeys } from "./queryKeys";

/**
 * Get nudges received by current user
 */
export const useNudges = (unreadOnly: boolean = false) => {
  return useQuery({
    queryKey: nudgesQueryKeys.listFiltered(unreadOnly),
    queryFn: () => nudgesService.getNudges(unreadOnly),
    staleTime: 30 * 1000, // 30 seconds - nudges should refresh often
    placeholderData: { data: [] as Nudge[], status: 200 },
  });
};

/**
 * Get nudges sent by current user
 */
export const useSentNudges = () => {
  return useQuery({
    queryKey: nudgesQueryKeys.sent(),
    queryFn: () => nudgesService.getSentNudges(),
    staleTime: 60 * 1000, // 1 minute
    placeholderData: { data: [] as Nudge[], status: 200 },
  });
};

/**
 * Get unread nudge count (for badge)
 */
export const useUnreadNudgesCount = () => {
  return useQuery({
    queryKey: nudgesQueryKeys.unreadCount(),
    queryFn: () => nudgesService.getUnreadCount(),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Poll every minute
    placeholderData: { data: { unread_count: 0 }, status: 200 },
  });
};

/**
 * Send a nudge to another user
 */
export const useSendNudge = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SendNudgeRequest) => nudgesService.sendNudge(data),
    onSuccess: () => {
      // Invalidate sent nudges
      queryClient.invalidateQueries({ queryKey: nudgesQueryKeys.sent() });
    },
  });
};

/**
 * Send a quick nudge (simplified API)
 */
export const useSendQuickNudge = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      recipientId,
      type = "nudge",
      message,
      goalId,
      challengeId,
      partnershipId,
    }: {
      recipientId: string;
      type?: NudgeType;
      message?: string;
      goalId?: string;
      challengeId?: string;
      partnershipId?: string;
    }) =>
      nudgesService.sendNudge({
        recipient_id: recipientId,
        nudge_type: type,
        message,
        goal_id: goalId,
        challenge_id: challengeId,
        partnership_id: partnershipId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: nudgesQueryKeys.sent() });
    },
  });
};

/**
 * Send a cheer (simplified API for cheering on check-ins)
 */
export const useSendCheer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      recipientId,
      goalId,
      challengeId,
      emoji = "🎉",
    }: {
      recipientId: string;
      goalId?: string;
      challengeId?: string;
      emoji?: string;
    }) =>
      nudgesService.sendNudge({
        recipient_id: recipientId,
        nudge_type: "cheer",
        emoji,
        goal_id: goalId,
        challenge_id: challengeId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: nudgesQueryKeys.sent() });
    },
  });
};

/**
 * Mark a nudge as read
 */
export const useMarkNudgeRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (nudgeId: string) => nudgesService.markAsRead(nudgeId),
    // Optimistic update
    onMutate: async (nudgeId) => {
      await queryClient.cancelQueries({ queryKey: nudgesQueryKeys.list() });
      await queryClient.cancelQueries({
        queryKey: nudgesQueryKeys.unreadCount(),
      });

      const previousList = queryClient.getQueryData(nudgesQueryKeys.list());
      const previousCount = queryClient.getQueryData(
        nudgesQueryKeys.unreadCount(),
      );

      // Update list
      queryClient.setQueryData(nudgesQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((n: Nudge) =>
            n.id === nudgeId ? { ...n, is_read: true } : n,
          ),
        };
      });

      // Update filtered lists too
      queryClient.setQueryData(
        nudgesQueryKeys.listFiltered(false),
        (old: any) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((n: Nudge) =>
              n.id === nudgeId ? { ...n, is_read: true } : n,
            ),
          };
        },
      );

      // Decrement count
      queryClient.setQueryData(nudgesQueryKeys.unreadCount(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: {
            unread_count: Math.max(0, (old.data.unread_count || 0) - 1),
          },
        };
      });

      return { previousList, previousCount };
    },
    onError: (err, nudgeId, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(nudgesQueryKeys.list(), context.previousList);
      }
      if (context?.previousCount) {
        queryClient.setQueryData(
          nudgesQueryKeys.unreadCount(),
          context.previousCount,
        );
      }
    },
  });
};

/**
 * Mark all nudges as read
 */
export const useMarkAllNudgesRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => nudgesService.markAllAsRead(),
    // Optimistic update
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: nudgesQueryKeys.list() });
      await queryClient.cancelQueries({
        queryKey: nudgesQueryKeys.unreadCount(),
      });

      const previousList = queryClient.getQueryData(nudgesQueryKeys.list());
      const previousCount = queryClient.getQueryData(
        nudgesQueryKeys.unreadCount(),
      );

      // Mark all as read in cache
      queryClient.setQueryData(nudgesQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((n: Nudge) => ({ ...n, is_read: true })),
        };
      });

      // Set count to 0
      queryClient.setQueryData(nudgesQueryKeys.unreadCount(), (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: { unread_count: 0 } };
      });

      return { previousList, previousCount };
    },
    onError: (err, _, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(nudgesQueryKeys.list(), context.previousList);
      }
      if (context?.previousCount) {
        queryClient.setQueryData(
          nudgesQueryKeys.unreadCount(),
          context.previousCount,
        );
      }
    },
  });
};

/**
 * Delete a nudge
 */
export const useDeleteNudge = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (nudgeId: string) => nudgesService.deleteNudge(nudgeId),
    // Optimistic update
    onMutate: async (nudgeId) => {
      await queryClient.cancelQueries({ queryKey: nudgesQueryKeys.sent() });

      const previousSent = queryClient.getQueryData(nudgesQueryKeys.sent());

      // Remove from sent list
      queryClient.setQueryData(nudgesQueryKeys.sent(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((n: Nudge) => n.id !== nudgeId),
        };
      });

      return { previousSent };
    },
    onError: (err, nudgeId, context) => {
      if (context?.previousSent) {
        queryClient.setQueryData(nudgesQueryKeys.sent(), context.previousSent);
      }
    },
  });
};
