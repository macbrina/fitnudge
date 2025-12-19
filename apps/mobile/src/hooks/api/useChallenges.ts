import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  challengesService,
  Challenge,
  ChallengeCheckInRequest,
  ShareAsChallengeRequest,
} from "@/services/api/challenges";
import { goalsQueryKeys, challengesQueryKeys } from "./queryKeys";
import { homeDashboardQueryKeys } from "./useHomeDashboard";

// Re-export query keys for external use
export { challengesQueryKeys } from "./queryKeys";

/**
 * Get all challenges (generic list)
 */
export const useChallenges = () => {
  return useQuery({
    queryKey: challengesQueryKeys.list(),
    queryFn: () => challengesService.getChallenges(),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

/**
 * Get user's challenges (created or joined) - for GoalsScreen
 * This returns challenges the user has access to, not public discovery
 */
export const useMyChallenges = (status?: string) => {
  return useQuery({
    queryKey: [...challengesQueryKeys.list(), "my", status],
    queryFn: () => challengesService.getMyChallenges(status),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

/**
 * Get public challenges for discovery - for SocialScreen
 */
export const usePublicChallenges = () => {
  return useQuery({
    queryKey: challengesQueryKeys.public(),
    queryFn: () => challengesService.getPublicChallenges(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Get a specific challenge
 */
export const useChallenge = (id: string) => {
  return useQuery({
    queryKey: challengesQueryKeys.detail(id),
    queryFn: () => challengesService.getChallenge(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

/**
 * Get challenge leaderboard
 */
export const useChallengeLeaderboard = (challengeId: string) => {
  return useQuery({
    queryKey: challengesQueryKeys.leaderboard(challengeId),
    queryFn: () => challengesService.getLeaderboard(challengeId),
    enabled: !!challengeId,
    staleTime: 30 * 1000, // 30 seconds - leaderboards change frequently
  });
};

/**
 * Get challenge participants
 */
export const useChallengeParticipants = (challengeId: string) => {
  return useQuery({
    queryKey: challengesQueryKeys.participants(challengeId),
    queryFn: () => challengesService.getParticipants(challengeId),
    enabled: !!challengeId,
    staleTime: 60 * 1000, // 1 minute
  });
};

/**
 * Get all check-ins for a challenge
 */
export const useChallengeCheckIns = (challengeId: string) => {
  return useQuery({
    queryKey: challengesQueryKeys.checkIns(challengeId),
    queryFn: () => challengesService.getCheckIns(challengeId),
    enabled: !!challengeId,
    staleTime: 30 * 1000, // 30 seconds
  });
};

/**
 * Get my check-ins for a challenge
 */
export const useMyChallengeCheckIns = (challengeId: string) => {
  return useQuery({
    queryKey: challengesQueryKeys.myCheckIns(challengeId),
    queryFn: () => challengesService.getMyCheckIns(challengeId),
    enabled: !!challengeId,
    staleTime: 30 * 1000, // 30 seconds
  });
};

/**
 * Join a challenge
 */
export const useJoinChallenge = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (challengeId: string) =>
      challengesService.joinChallenge(challengeId),
    // Optimistic update
    onMutate: async (challengeId) => {
      await queryClient.cancelQueries({
        queryKey: challengesQueryKeys.detail(challengeId),
      });
      await queryClient.cancelQueries({
        queryKey: challengesQueryKeys.list(),
      });

      const previousDetail = queryClient.getQueryData(
        challengesQueryKeys.detail(challengeId)
      );
      const previousList = queryClient.getQueryData(challengesQueryKeys.list());

      // Update challenge detail to show user as participant
      queryClient.setQueryData(
        challengesQueryKeys.detail(challengeId),
        (old: any) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: {
              ...old.data,
              is_participant: true,
              participant_count: (old.data.participant_count || 0) + 1,
            },
          };
        }
      );

      return { previousDetail, previousList };
    },
    onError: (err, challengeId, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(
          challengesQueryKeys.detail(challengeId),
          context.previousDetail
        );
      }
      if (context?.previousList) {
        queryClient.setQueryData(
          challengesQueryKeys.list(),
          context.previousList
        );
      }
    },
    onSettled: (_, __, challengeId) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.detail(challengeId),
      });
      queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.participants(challengeId),
      });
      queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.list(),
      });
      queryClient.invalidateQueries({
        queryKey: homeDashboardQueryKeys.all,
      });
    },
  });
};

/**
 * Leave a challenge
 */
export const useLeaveChallenge = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (challengeId: string) =>
      challengesService.leaveChallenge(challengeId),
    // Optimistic update
    onMutate: async (challengeId) => {
      await queryClient.cancelQueries({
        queryKey: challengesQueryKeys.detail(challengeId),
      });
      await queryClient.cancelQueries({
        queryKey: challengesQueryKeys.list(),
      });

      const previousDetail = queryClient.getQueryData(
        challengesQueryKeys.detail(challengeId)
      );
      const previousList = queryClient.getQueryData(challengesQueryKeys.list());

      // Update challenge detail to show user left
      queryClient.setQueryData(
        challengesQueryKeys.detail(challengeId),
        (old: any) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: {
              ...old.data,
              is_participant: false,
              participant_count: Math.max(
                0,
                (old.data.participant_count || 1) - 1
              ),
            },
          };
        }
      );

      // Remove from list
      queryClient.setQueryData(challengesQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((c: Challenge) => c.id !== challengeId),
        };
      });

      return { previousDetail, previousList };
    },
    onError: (err, challengeId, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(
          challengesQueryKeys.detail(challengeId),
          context.previousDetail
        );
      }
      if (context?.previousList) {
        queryClient.setQueryData(
          challengesQueryKeys.list(),
          context.previousList
        );
      }
    },
    onSettled: (_, __, challengeId) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.detail(challengeId),
      });
      queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.participants(challengeId),
      });
      queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.list(),
      });
      queryClient.invalidateQueries({
        queryKey: homeDashboardQueryKeys.all,
      });
    },
  });
};

/**
 * Check into a challenge
 */
export const useChallengeCheckIn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      challengeId,
      data,
    }: {
      challengeId: string;
      data?: ChallengeCheckInRequest;
    }) => challengesService.checkIn(challengeId, data),

    // Optimistic update - mark pre-created check-in as completed
    onMutate: async ({ challengeId, data }) => {
      // Cancel in-flight queries to prevent race conditions
      await queryClient.cancelQueries({
        queryKey: challengesQueryKeys.myCheckIns(challengeId),
      });
      await queryClient.cancelQueries({
        queryKey: challengesQueryKeys.checkIns(challengeId),
      });
      await queryClient.cancelQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
      });

      // Snapshot previous data for rollback
      const previousMyCheckIns = queryClient.getQueryData(
        challengesQueryKeys.myCheckIns(challengeId)
      );
      const previousCheckIns = queryClient.getQueryData(
        challengesQueryKeys.checkIns(challengeId)
      );
      const previousDashboard = queryClient.getQueryData(
        homeDashboardQueryKeys.dashboard()
      );

      const today = new Date().toISOString().split("T")[0];

      // Update existing pre-created check-in to mark as completed
      queryClient.setQueryData(
        challengesQueryKeys.myCheckIns(challengeId),
        (old: any) => {
          if (!old) return old;
          const dataArray = Array.isArray(old) ? old : old?.data || [];
          const updated = dataArray.map((c: any) =>
            c.check_in_date === today && !c.is_checked_in
              ? {
                  ...c,
                  completed: true,
                  is_checked_in: true,
                  notes: data?.notes || c.notes,
                  mood: data?.mood || c.mood,
                  photo_url: data?.photo_url || c.photo_url,
                  updated_at: new Date().toISOString(),
                }
              : c
          );
          return Array.isArray(old) ? updated : { ...old, data: updated };
        }
      );

      // Remove from pending check-ins in dashboard and update stats
      queryClient.setQueryData(
        homeDashboardQueryKeys.dashboard(),
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            // Remove this challenge from pending check-ins
            today_pending_checkins: (old.today_pending_checkins || []).filter(
              (c: any) =>
                !(c.type === "challenge" && c.item?.id === challengeId)
            ),
            // Optimistically update stats
            stats: old.stats
              ? {
                  ...old.stats,
                  total_check_ins: (old.stats.total_check_ins || 0) + 1,
                }
              : old.stats,
            // Update challenge progress in items
            items: (old.items || []).map((item: any) => {
              if (item.type === "challenge" && item.data?.id === challengeId) {
                return {
                  ...item,
                  data: {
                    ...item.data,
                    my_progress: (item.data.my_progress || 0) + 1,
                  },
                };
              }
              return item;
            }),
          };
        }
      );

      return {
        previousMyCheckIns,
        previousCheckIns,
        previousDashboard,
        challengeId,
      };
    },

    // Rollback on error
    onError: (err, { challengeId }, context) => {
      if (context?.previousMyCheckIns) {
        queryClient.setQueryData(
          challengesQueryKeys.myCheckIns(challengeId),
          context.previousMyCheckIns
        );
      }
      if (context?.previousCheckIns) {
        queryClient.setQueryData(
          challengesQueryKeys.checkIns(challengeId),
          context.previousCheckIns
        );
      }
      if (context?.previousDashboard) {
        queryClient.setQueryData(
          homeDashboardQueryKeys.dashboard(),
          context.previousDashboard
        );
      }
    },

    // Replace optimistic data with real data
    onSuccess: (response, { challengeId }) => {
      const realCheckIn = response?.data;

      if (realCheckIn) {
        // Replace temp check-in with real one
        queryClient.setQueryData(
          challengesQueryKeys.myCheckIns(challengeId),
          (old: any) => {
            if (!old) return [realCheckIn];
            const data = Array.isArray(old) ? old : old?.data || [];
            const filtered = data.filter(
              (c: any) => !c.id?.startsWith?.("temp-")
            );
            const result = [...filtered, realCheckIn];
            return Array.isArray(old) ? result : { ...old, data: result };
          }
        );
      }

      // Invalidate server-calculated data
      queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.checkIns(challengeId),
      });
      queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.leaderboard(challengeId),
      });
      queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.detail(challengeId),
      });
      queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.list(),
      });
      queryClient.invalidateQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
      });
    },
  });
};

/**
 * Update a challenge check-in
 */
export const useUpdateChallengeCheckIn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      challengeId,
      checkInId,
      data,
    }: {
      challengeId: string;
      checkInId: string;
      data: { notes?: string; mood?: string; photo_url?: string };
    }) => challengesService.updateCheckIn(challengeId, checkInId, data),

    // Optimistic update
    onMutate: async ({ challengeId, checkInId, data }) => {
      // Cancel in-flight queries
      await queryClient.cancelQueries({
        queryKey: challengesQueryKeys.myCheckIns(challengeId),
      });
      await queryClient.cancelQueries({
        queryKey: challengesQueryKeys.checkIns(challengeId),
      });

      // Snapshot previous data
      const previousMyCheckIns = queryClient.getQueryData(
        challengesQueryKeys.myCheckIns(challengeId)
      );
      const previousCheckIns = queryClient.getQueryData(
        challengesQueryKeys.checkIns(challengeId)
      );

      // Optimistically update the check-in
      const updateCheckInList = (old: any) => {
        if (!old) return old;
        const dataArray = Array.isArray(old) ? old : old?.data || [];
        const updated = dataArray.map((c: any) =>
          c.id === checkInId
            ? { ...c, ...data, updated_at: new Date().toISOString() }
            : c
        );
        return Array.isArray(old) ? updated : { ...old, data: updated };
      };

      queryClient.setQueryData(
        challengesQueryKeys.myCheckIns(challengeId),
        updateCheckInList
      );
      queryClient.setQueryData(
        challengesQueryKeys.checkIns(challengeId),
        updateCheckInList
      );

      return { previousMyCheckIns, previousCheckIns, challengeId };
    },

    // Rollback on error
    onError: (err, { challengeId }, context) => {
      if (context?.previousMyCheckIns) {
        queryClient.setQueryData(
          challengesQueryKeys.myCheckIns(challengeId),
          context.previousMyCheckIns
        );
      }
      if (context?.previousCheckIns) {
        queryClient.setQueryData(
          challengesQueryKeys.checkIns(challengeId),
          context.previousCheckIns
        );
      }
    },

    // Replace with real data and invalidate server-calculated fields
    onSuccess: (response, { challengeId }) => {
      const updatedCheckIn = response?.data;

      if (updatedCheckIn) {
        const updateWithReal = (old: any) => {
          if (!old) return old;
          const dataArray = Array.isArray(old) ? old : old?.data || [];
          const updated = dataArray.map((c: any) =>
            c.id === updatedCheckIn.id ? updatedCheckIn : c
          );
          return Array.isArray(old) ? updated : { ...old, data: updated };
        };

        queryClient.setQueryData(
          challengesQueryKeys.myCheckIns(challengeId),
          updateWithReal
        );
        queryClient.setQueryData(
          challengesQueryKeys.checkIns(challengeId),
          updateWithReal
        );
      }

      // Invalidate server-calculated data
      queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.leaderboard(challengeId),
      });
      queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.detail(challengeId),
      });
      queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.list(),
      });
      queryClient.invalidateQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
      });
    },
  });
};

/**
 * Delete a challenge check-in
 */
export const useDeleteChallengeCheckIn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      challengeId,
      checkInId,
    }: {
      challengeId: string;
      checkInId: string;
    }) => challengesService.deleteCheckIn(challengeId, checkInId),

    // Optimistic delete
    onMutate: async ({ challengeId, checkInId }) => {
      // Cancel in-flight queries
      await queryClient.cancelQueries({
        queryKey: challengesQueryKeys.myCheckIns(challengeId),
      });
      await queryClient.cancelQueries({
        queryKey: challengesQueryKeys.checkIns(challengeId),
      });

      // Snapshot previous data
      const previousMyCheckIns = queryClient.getQueryData(
        challengesQueryKeys.myCheckIns(challengeId)
      );
      const previousCheckIns = queryClient.getQueryData(
        challengesQueryKeys.checkIns(challengeId)
      );

      // Optimistically remove the check-in
      const removeCheckIn = (old: any) => {
        if (!old) return old;
        const dataArray = Array.isArray(old) ? old : old?.data || [];
        const filtered = dataArray.filter((c: any) => c.id !== checkInId);
        return Array.isArray(old) ? filtered : { ...old, data: filtered };
      };

      queryClient.setQueryData(
        challengesQueryKeys.myCheckIns(challengeId),
        removeCheckIn
      );
      queryClient.setQueryData(
        challengesQueryKeys.checkIns(challengeId),
        removeCheckIn
      );

      return { previousMyCheckIns, previousCheckIns, challengeId };
    },

    // Rollback on error
    onError: (err, { challengeId }, context) => {
      if (context?.previousMyCheckIns) {
        queryClient.setQueryData(
          challengesQueryKeys.myCheckIns(challengeId),
          context.previousMyCheckIns
        );
      }
      if (context?.previousCheckIns) {
        queryClient.setQueryData(
          challengesQueryKeys.checkIns(challengeId),
          context.previousCheckIns
        );
      }
    },

    // Invalidate server-calculated data
    onSuccess: (response, { challengeId }) => {
      queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.leaderboard(challengeId),
      });
      queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.detail(challengeId),
      });
      queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.list(),
      });
      queryClient.invalidateQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
      });
    },
  });
};

/**
 * Share a goal as a challenge
 */
export const useShareGoalAsChallenge = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      goalId,
      data,
    }: {
      goalId: string;
      data: ShareAsChallengeRequest;
    }) => challengesService.shareGoalAsChallenge(goalId, data),
    onSuccess: (response, { goalId }) => {
      // Invalidate goal and challenges
      queryClient.invalidateQueries({
        queryKey: goalsQueryKeys.detail(goalId),
      });
      queryClient.invalidateQueries({
        queryKey: goalsQueryKeys.list(),
      });
      queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.list(),
      });
    },
  });
};

// =====================================================
// Challenge Invite Hooks
// =====================================================

import { challengeInvitesQueryKeys, partnersQueryKeys } from "./queryKeys";
import type { ChallengeInvite } from "@/services/api/challenges";

/**
 * Helper to update user's challenge invite status in infinite query pages
 * Same pattern as usePartners.ts updateUserInInfiniteQuery
 */
const updateUserChallengeInviteStatus = (
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: readonly string[],
  userId: string,
  updates: {
    challenge_invite_status?: string;
    pending_challenge_invite_id?: string | null;
  }
) => {
  queryClient.setQueryData(queryKey, (old: any) => {
    if (!old?.pages) return old;
    return {
      ...old,
      pages: old.pages.map((page: any) => ({
        ...page,
        users: page.users.map((user: any) =>
          user.id === userId ? { ...user, ...updates } : user
        ),
      })),
    };
  });
};

/**
 * Get received challenge invites for current user
 */
export const useReceivedChallengeInvites = () => {
  return useQuery({
    queryKey: challengeInvitesQueryKeys.received(),
    queryFn: () => challengesService.getReceivedInvites(),
    staleTime: 60 * 1000, // 1 minute
  });
};

/**
 * Get sent challenge invites by current user
 */
export const useSentChallengeInvites = () => {
  return useQuery({
    queryKey: challengeInvitesQueryKeys.sent(),
    queryFn: () => challengesService.getSentInvites(),
    staleTime: 60 * 1000, // 1 minute
  });
};

/**
 * Send a challenge invite to a user
 * Pass challengeId, userId, and optionally user info for optimistic updates
 * Follows the same pattern as useSendPartnerRequest in usePartners.ts
 */
export const useSendChallengeInvite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      challengeId,
      userId,
    }: {
      challengeId: string;
      userId: string;
      userInfo?: {
        name?: string;
        username?: string;
        profile_picture_url?: string;
      };
      challengeInfo?: { title?: string };
    }) => challengesService.sendInvite(challengeId, userId),
    // Optimistic update - same pattern as useSendPartnerRequest
    onMutate: async ({ challengeId, userId, userInfo, challengeInfo }) => {
      // Cancel queries we're about to update
      await queryClient.cancelQueries({
        queryKey: challengeInvitesQueryKeys.sent(),
      });
      await queryClient.cancelQueries({
        queryKey: challengesQueryKeys.participants(challengeId),
      });
      // Also cancel search/suggested queries (same as partners)
      await queryClient.cancelQueries({
        queryKey: [...partnersQueryKeys.all, "search-infinite"],
        exact: false,
      });
      await queryClient.cancelQueries({
        queryKey: partnersQueryKeys.suggestedInfinite(),
      });

      // Snapshot previous data for rollback
      const previousSent = queryClient.getQueryData(
        challengeInvitesQueryKeys.sent()
      );
      const previousParticipants = queryClient.getQueryData(
        challengesQueryKeys.participants(challengeId)
      );

      // Get all search infinite query keys and snapshot them (same as partners)
      const searchQueryState = queryClient.getQueriesData({
        queryKey: [...partnersQueryKeys.all, "search-infinite"],
        exact: false,
      });

      const suggestedQueryState = queryClient.getQueriesData({
        queryKey: partnersQueryKeys.suggestedInfinite(),
      });

      // Create optimistic invite
      const optimisticInvite: ChallengeInvite = {
        id: `temp-${Date.now()}`,
        challenge_id: challengeId,
        invited_by_user_id: "",
        invited_user_id: userId,
        status: "pending",
        created_at: new Date().toISOString(),
        invitee: userInfo
          ? {
              id: userId,
              name: userInfo.name,
              username: userInfo.username,
              profile_picture_url: userInfo.profile_picture_url,
            }
          : { id: userId },
        challenge: challengeInfo
          ? {
              id: challengeId,
              title: challengeInfo.title || "",
              start_date: "",
            }
          : undefined,
      };

      // Add to sent list
      queryClient.setQueryData(challengeInvitesQueryKeys.sent(), (old: any) => {
        if (!old?.data) {
          return { data: [optimisticInvite] };
        }
        return {
          ...old,
          data: [optimisticInvite, ...old.data],
        };
      });

      // Optimistically update the user in search/suggested results (same as partners)
      // Update all search queries
      searchQueryState.forEach(([key]) => {
        updateUserChallengeInviteStatus(
          queryClient,
          key as readonly string[],
          userId,
          {
            challenge_invite_status: "sent",
            pending_challenge_invite_id: optimisticInvite.id,
          }
        );
      });

      // Update suggested query
      updateUserChallengeInviteStatus(
        queryClient,
        partnersQueryKeys.suggestedInfinite(),
        userId,
        {
          challenge_invite_status: "sent",
          pending_challenge_invite_id: optimisticInvite.id,
        }
      );

      return {
        previousSent,
        previousParticipants,
        challengeId,
        searchQueryState,
        suggestedQueryState,
        userId,
      };
    },
    onError: (err, { challengeId, userId }, context) => {
      // Rollback sent list
      if (context?.previousSent) {
        queryClient.setQueryData(
          challengeInvitesQueryKeys.sent(),
          context.previousSent
        );
      }
      // Rollback participants
      if (context?.previousParticipants) {
        queryClient.setQueryData(
          challengesQueryKeys.participants(challengeId),
          context.previousParticipants
        );
      }
      // Rollback search queries (same as partners)
      context?.searchQueryState?.forEach(([key, value]: [any, any]) => {
        queryClient.setQueryData(key, value);
      });
      // Rollback suggested query
      context?.suggestedQueryState?.forEach(([key, value]: [any, any]) => {
        queryClient.setQueryData(key, value);
      });
    },
    onSuccess: (response, { challengeId, userId }) => {
      // Replace temp with real data
      const realInvite = response?.data;
      if (realInvite) {
        queryClient.setQueryData(
          challengeInvitesQueryKeys.sent(),
          (old: any) => {
            if (!old?.data) return { data: [realInvite] };
            const filtered = old.data.filter(
              (i: ChallengeInvite) => !i.id?.startsWith?.("temp-")
            );
            return { ...old, data: [realInvite, ...filtered] };
          }
        );

        // Update the real invite_id in search/suggested (same as partners)
        const searchQueryState = queryClient.getQueriesData({
          queryKey: [...partnersQueryKeys.all, "search-infinite"],
          exact: false,
        });

        searchQueryState.forEach(([key]) => {
          updateUserChallengeInviteStatus(
            queryClient,
            key as readonly string[],
            userId,
            {
              challenge_invite_status: "sent",
              pending_challenge_invite_id: realInvite.invite_id,
            }
          );
        });

        updateUserChallengeInviteStatus(
          queryClient,
          partnersQueryKeys.suggestedInfinite(),
          userId,
          {
            challenge_invite_status: "sent",
            pending_challenge_invite_id: realInvite.invite_id,
          }
        );
      }

      // Invalidate participants to update invite status
      queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.participants(challengeId),
      });
    },
  });
};

/**
 * Generate a shareable invite link
 */
export const useGenerateChallengeInviteLink = () => {
  return useMutation({
    mutationFn: (challengeId: string) =>
      challengesService.generateInviteLink(challengeId),
  });
};

/**
 * Accept a challenge invite
 * Pass inviteId for the mutation
 */
export const useAcceptChallengeInvite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inviteId: string) => challengesService.acceptInvite(inviteId),
    // Optimistic update
    onMutate: async (inviteId) => {
      // Cancel queries we're about to update
      await queryClient.cancelQueries({
        queryKey: challengeInvitesQueryKeys.received(),
      });
      await queryClient.cancelQueries({
        queryKey: challengesQueryKeys.list(),
      });

      // Snapshot previous data for rollback
      const previousReceived = queryClient.getQueryData(
        challengeInvitesQueryKeys.received()
      );
      const previousChallengesList = queryClient.getQueryData(
        challengesQueryKeys.list()
      );

      // Find the invite being accepted
      let acceptedInvite: ChallengeInvite | undefined;

      // Remove from received
      queryClient.setQueryData(
        challengeInvitesQueryKeys.received(),
        (old: any) => {
          if (!old?.data) return old;
          acceptedInvite = old.data.find(
            (i: ChallengeInvite) => i.id === inviteId
          );
          return {
            ...old,
            data: old.data.filter((i: ChallengeInvite) => i.id !== inviteId),
          };
        }
      );

      // Optionally add the challenge to the user's list (if we have challenge info)
      if (acceptedInvite?.challenge) {
        queryClient.setQueryData(challengesQueryKeys.list(), (old: any) => {
          if (!old?.data) {
            return {
              data: [
                {
                  ...acceptedInvite!.challenge,
                  is_participant: true,
                },
              ],
            };
          }
          // Check if already in list
          const exists = old.data.some(
            (c: Challenge) => c.id === acceptedInvite!.challenge_id
          );
          if (exists) return old;
          return {
            ...old,
            data: [
              ...old.data,
              {
                ...acceptedInvite!.challenge,
                is_participant: true,
              },
            ],
          };
        });
      }

      return { previousReceived, previousChallengesList, acceptedInvite };
    },
    onError: (err, inviteId, context) => {
      // Rollback received
      if (context?.previousReceived) {
        queryClient.setQueryData(
          challengeInvitesQueryKeys.received(),
          context.previousReceived
        );
      }
      // Rollback challenges list
      if (context?.previousChallengesList) {
        queryClient.setQueryData(
          challengesQueryKeys.list(),
          context.previousChallengesList
        );
      }
    },
    onSettled: (_, __, ___, context) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: challengeInvitesQueryKeys.received(),
      });
      queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.list(),
      });
      // If we know the challenge, invalidate its detail and participants
      if (context?.acceptedInvite?.challenge_id) {
        queryClient.invalidateQueries({
          queryKey: challengesQueryKeys.detail(
            context.acceptedInvite.challenge_id
          ),
        });
        queryClient.invalidateQueries({
          queryKey: challengesQueryKeys.participants(
            context.acceptedInvite.challenge_id
          ),
        });
      }
      queryClient.invalidateQueries({
        queryKey: homeDashboardQueryKeys.all,
      });
    },
  });
};

/**
 * Decline a challenge invite
 */
export const useDeclineChallengeInvite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inviteId: string) => challengesService.declineInvite(inviteId),
    // Optimistic update
    onMutate: async (inviteId) => {
      // Cancel queries we're about to update
      await queryClient.cancelQueries({
        queryKey: challengeInvitesQueryKeys.received(),
      });

      // Snapshot previous data for rollback
      const previousReceived = queryClient.getQueryData(
        challengeInvitesQueryKeys.received()
      );

      // Remove from received
      queryClient.setQueryData(
        challengeInvitesQueryKeys.received(),
        (old: any) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.filter((i: ChallengeInvite) => i.id !== inviteId),
          };
        }
      );

      return { previousReceived };
    },
    onError: (err, inviteId, context) => {
      // Rollback received
      if (context?.previousReceived) {
        queryClient.setQueryData(
          challengeInvitesQueryKeys.received(),
          context.previousReceived
        );
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: challengeInvitesQueryKeys.received(),
      });
    },
  });
};

/**
 * Cancel a challenge invite that current user sent
 * Follows the same pattern as useCancelPartnerRequest in usePartners.ts
 */
export const useCancelChallengeInvite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inviteId: string) => challengesService.cancelInvite(inviteId),
    // Optimistic update - same pattern as useCancelPartnerRequest
    onMutate: async (inviteId) => {
      // Cancel queries we're about to update
      await queryClient.cancelQueries({
        queryKey: challengeInvitesQueryKeys.sent(),
      });
      // Also cancel search/suggested queries (same as partners)
      await queryClient.cancelQueries({
        queryKey: [...partnersQueryKeys.all, "search-infinite"],
        exact: false,
      });
      await queryClient.cancelQueries({
        queryKey: partnersQueryKeys.suggestedInfinite(),
      });

      // Snapshot previous data for rollback
      const previousSent = queryClient.getQueryData(
        challengeInvitesQueryKeys.sent()
      );

      // Get all search infinite query keys and snapshot them (same as partners)
      const searchQueryState = queryClient.getQueriesData({
        queryKey: [...partnersQueryKeys.all, "search-infinite"],
        exact: false,
      });

      const suggestedQueryState = queryClient.getQueriesData({
        queryKey: partnersQueryKeys.suggestedInfinite(),
      });

      // Find the invite being cancelled to get user_id and challenge_id
      let cancelledInvite: ChallengeInvite | undefined;

      // Remove from sent
      queryClient.setQueryData(challengeInvitesQueryKeys.sent(), (old: any) => {
        if (!old?.data) return old;
        cancelledInvite = old.data.find(
          (i: ChallengeInvite) => i.id === inviteId
        );
        return {
          ...old,
          data: old.data.filter((i: ChallengeInvite) => i.id !== inviteId),
        };
      });

      // Optimistically update the user in search/suggested to remove invite status (same as partners)
      const invitedUserId = cancelledInvite?.invited_user_id;
      if (invitedUserId) {
        searchQueryState.forEach(([key]) => {
          updateUserChallengeInviteStatus(
            queryClient,
            key as readonly string[],
            invitedUserId,
            {
              challenge_invite_status: "none",
              pending_challenge_invite_id: null,
            }
          );
        });

        updateUserChallengeInviteStatus(
          queryClient,
          partnersQueryKeys.suggestedInfinite(),
          invitedUserId,
          {
            challenge_invite_status: "none",
            pending_challenge_invite_id: null,
          }
        );
      }

      return {
        previousSent,
        cancelledInvite,
        searchQueryState,
        suggestedQueryState,
      };
    },
    onError: (err, inviteId, context) => {
      // Rollback sent
      if (context?.previousSent) {
        queryClient.setQueryData(
          challengeInvitesQueryKeys.sent(),
          context.previousSent
        );
      }
      // Rollback search queries (same as partners)
      context?.searchQueryState?.forEach(([key, value]: [any, any]) => {
        queryClient.setQueryData(key, value);
      });
      // Rollback suggested query
      context?.suggestedQueryState?.forEach(([key, value]: [any, any]) => {
        queryClient.setQueryData(key, value);
      });
    },
    onSettled: (_, __, ___, context) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: challengeInvitesQueryKeys.sent(),
      });
      // If we know the challenge, invalidate its participants
      if (context?.cancelledInvite?.challenge_id) {
        queryClient.invalidateQueries({
          queryKey: challengesQueryKeys.participants(
            context.cancelledInvite.challenge_id
          ),
        });
      }
    },
  });
};

/**
 * Join a challenge via invite code (from deep link)
 */
export const useJoinChallengeViaInvite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inviteCode: string) =>
      challengesService.joinViaInviteCode(inviteCode),
    onSuccess: () => {
      // Refetch challenges list since user joined a new one
      queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.list(),
      });
      queryClient.invalidateQueries({
        queryKey: homeDashboardQueryKeys.all,
      });
    },
  });
};
