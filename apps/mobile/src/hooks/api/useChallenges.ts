import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  challengesService,
  Challenge,
  ChallengeCheckInRequest,
  ShareAsChallengeRequest,
} from "@/services/api/challenges";
import { goalsQueryKeys, challengesQueryKeys } from "./queryKeys";

// Re-export query keys for external use
export { challengesQueryKeys } from "./queryKeys";

/**
 * Get all challenges for current user
 */
export const useChallenges = () => {
  return useQuery({
    queryKey: challengesQueryKeys.list(),
    queryFn: () => challengesService.getChallenges(),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

/**
 * Get public challenges
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
    onSuccess: (_, challengeId) => {
      // Invalidate challenge data
      queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.detail(challengeId),
      });
      queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.participants(challengeId),
      });
      queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.list(),
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
    onSuccess: (_, challengeId) => {
      // Invalidate challenge data
      queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.detail(challengeId),
      });
      queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.participants(challengeId),
      });
      queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.list(),
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
    onSuccess: (response, { challengeId }) => {
      // Invalidate check-ins and leaderboard
      queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.checkIns(challengeId),
      });
      queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.myCheckIns(challengeId),
      });
      queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.leaderboard(challengeId),
      });
      queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.detail(challengeId),
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
