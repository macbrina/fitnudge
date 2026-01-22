import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { partnersService, Partner, PartnerRequest } from "@/services/api/partners";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { useAuthStore } from "@/stores/authStore";
import { partnersQueryKeys } from "./queryKeys";

// Re-export query keys for external use
export { partnersQueryKeys } from "./queryKeys";

// Empty placeholder to prevent loading spinners
const EMPTY_PARTNERS_RESPONSE = { data: [], status: 200 };

/**
 * Get accepted accountability partners
 */
export const usePartners = () => {
  return useQuery({
    queryKey: partnersQueryKeys.list(),
    queryFn: () => partnersService.getPartners(),
    staleTime: 60 * 1000, // 1 minute - partners can change when accepting/rejecting requests
    refetchOnMount: true, // Always check for fresh data on mount
    placeholderData: EMPTY_PARTNERS_RESPONSE
  });
};

/**
 * Get accepted partners with today's goals and check-in status
 * Used for home screen partner cards
 */
export const usePartnersWithTodayGoals = () => {
  return useQuery({
    queryKey: partnersQueryKeys.listWithGoals(),
    queryFn: () => partnersService.getPartners(true),
    staleTime: 60 * 1000, // 1 minute
    refetchOnMount: true,
    placeholderData: EMPTY_PARTNERS_RESPONSE
  });
};

/**
 * Get pending partner requests (received by current user)
 */
export const usePendingPartnerRequests = () => {
  return useQuery({
    queryKey: partnersQueryKeys.pending(),
    queryFn: () => partnersService.getPendingRequests(),
    staleTime: 30 * 1000, // 30 seconds
    refetchOnMount: true, // Always check for fresh data on mount
    placeholderData: EMPTY_PARTNERS_RESPONSE
  });
};

/**
 * Get sent partner requests (initiated by current user)
 */
export const useSentPartnerRequests = () => {
  return useQuery({
    queryKey: partnersQueryKeys.sent(),
    queryFn: () => partnersService.getSentRequests(),
    staleTime: 30 * 1000, // 30 seconds
    refetchOnMount: true, // Always check for fresh data on mount
    placeholderData: EMPTY_PARTNERS_RESPONSE
  });
};

/**
 * Get blocked partners
 */
export const useBlockedPartners = () => {
  return useQuery({
    queryKey: partnersQueryKeys.blocked(),
    queryFn: () => partnersService.getBlockedPartners(),
    staleTime: 5 * 60 * 1000, // 5 minutes - blocked list changes infrequently
    refetchOnMount: true,
    placeholderData: EMPTY_PARTNERS_RESPONSE
  });
};

/**
 * Search for users to add as partners (simple query, for backwards compat)
 */
export const useSearchPartners = (query: string) => {
  return useQuery({
    queryKey: partnersQueryKeys.search(query),
    queryFn: async () => {
      const response = await partnersService.searchUsers(query, 1, 20);
      // Transform to match old format for backwards compatibility
      return {
        ...response,
        data: response.data?.users || []
      };
    },
    enabled: query.length >= 2,
    staleTime: 2 * 60 * 1000 // 2 minutes
  });
};

/**
 * Search for users to add as partners with infinite scroll pagination
 */
export const useSearchPartnersInfinite = (query: string, limit: number = 20) => {
  return useInfiniteQuery({
    queryKey: partnersQueryKeys.searchInfinite(query),
    queryFn: async ({ pageParam = 1 }) => {
      const response = await partnersService.searchUsers(query, pageParam, limit);
      if (response.status !== 200 || !response.data) {
        throw new Error(response.error || "Failed to search users");
      }
      return response.data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.has_more) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    enabled: query.length >= 2,
    staleTime: 2 * 60 * 1000 // 2 minutes
  });
};

/**
 * Get suggested users to add as partners with infinite scroll pagination
 */
export const useSuggestedPartnersInfinite = (limit: number = 20) => {
  return useInfiniteQuery({
    queryKey: partnersQueryKeys.suggestedInfinite(),
    queryFn: async ({ pageParam = 1 }) => {
      const response = await partnersService.getSuggestedUsers(pageParam, limit);
      if (response.status !== 200 || !response.data) {
        throw new Error(response.error || "Failed to get suggested users");
      }
      return response.data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.has_more) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
};

/**
 * Helper to update user's request_status in infinite query pages
 */
const updateUserInInfiniteQuery = (
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: readonly string[],
  userId: string,
  updates: {
    request_status: string;
    partnership_id?: string | null;
    is_partner?: boolean;
    has_pending_request?: boolean;
  }
) => {
  queryClient.setQueryData(queryKey, (old: any) => {
    if (!old?.pages) return old;
    return {
      ...old,
      pages: old.pages.map((page: any) => ({
        ...page,
        users: page.users.map((user: any) => (user.id === userId ? { ...user, ...updates } : user))
      }))
    };
  });
};

/**
 * Send a partner request
 */
export const useSendPartnerRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PartnerRequest) => partnersService.sendRequest(data),
    // Optimistic update
    onMutate: async (data) => {
      // Cancel only specific queries we're about to update
      // Note: We do NOT update pending list - that's for requests RECEIVED from others
      await queryClient.cancelQueries({
        queryKey: partnersQueryKeys.sent()
      });
      await queryClient.cancelQueries({
        queryKey: [...partnersQueryKeys.all, "search-infinite"],
        exact: false
      });
      await queryClient.cancelQueries({
        queryKey: partnersQueryKeys.suggestedInfinite()
      });

      // Create optimistic sent request
      const optimisticRequest: Partner = {
        id: `temp-${Date.now()}`,
        user_id: "",
        partner_user_id: data.partner_user_id,
        status: "pending",
        initiated_by_user_id: "",
        created_at: new Date().toISOString()
      };

      // Add to sent list only (NOT pending - that's for received requests)
      queryClient.setQueryData(partnersQueryKeys.sent(), (old: any) => {
        if (!old?.data) {
          return { data: [optimisticRequest] };
        }
        return {
          ...old,
          data: [optimisticRequest, ...old.data]
        };
      });

      // Optimistically update the user in search/suggested results
      const searchQueryState = queryClient.getQueriesData({
        queryKey: [...partnersQueryKeys.all, "search-infinite"],
        exact: false
      });
      searchQueryState.forEach(([key]) => {
        updateUserInInfiniteQuery(queryClient, key as readonly string[], data.partner_user_id, {
          request_status: "sent",
          partnership_id: optimisticRequest.id,
          has_pending_request: true
        });
      });

      // Update suggested query
      updateUserInInfiniteQuery(
        queryClient,
        partnersQueryKeys.suggestedInfinite(),
        data.partner_user_id,
        {
          request_status: "sent",
          partnership_id: optimisticRequest.id,
          has_pending_request: true
        }
      );

      return { partnerId: data.partner_user_id };
    },
    onError: (err, data, context) => {
      // Rollback: only remove the specific user we tried to add (not entire snapshot)
      // This prevents race conditions when multiple requests are sent rapidly
      queryClient.setQueryData(partnersQueryKeys.sent(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((p: Partner) => p.partner_user_id !== data.partner_user_id)
        };
      });

      // Revert this user's status in search/suggested
      const searchQueryState = queryClient.getQueriesData({
        queryKey: [...partnersQueryKeys.all, "search-infinite"],
        exact: false
      });
      searchQueryState.forEach(([key]) => {
        updateUserInInfiniteQuery(queryClient, key as readonly string[], data.partner_user_id, {
          request_status: "none",
          partnership_id: undefined,
          has_pending_request: false
        });
      });

      updateUserInInfiniteQuery(
        queryClient,
        partnersQueryKeys.suggestedInfinite(),
        data.partner_user_id,
        {
          request_status: "none",
          partnership_id: undefined,
          has_pending_request: false
        }
      );
    },
    onSuccess: (response, data) => {
      // Replace temp with real data in sent list only
      // Also check if real item already exists (from realtime refetch race condition)
      const realPartnership = response?.data;
      if (realPartnership) {
        queryClient.setQueryData(partnersQueryKeys.sent(), (old: any) => {
          if (!old?.data) return { data: [realPartnership] };
          // Filter out temp items AND duplicates of the real item
          const filtered = old.data.filter(
            (p: Partner) => !p.id.startsWith("temp-") && p.id !== realPartnership.id
          );
          return { ...old, data: [realPartnership, ...filtered] };
        });

        // Update the real partnership_id in search/suggested
        const searchQueryState = queryClient.getQueriesData({
          queryKey: [...partnersQueryKeys.all, "search-infinite"],
          exact: false
        });

        searchQueryState.forEach(([key]) => {
          updateUserInInfiniteQuery(queryClient, key as readonly string[], data.partner_user_id, {
            request_status: "sent",
            partnership_id: realPartnership.id,
            has_pending_request: true
          });
        });

        updateUserInInfiniteQuery(
          queryClient,
          partnersQueryKeys.suggestedInfinite(),
          data.partner_user_id,
          {
            request_status: "sent",
            partnership_id: realPartnership.id,
            has_pending_request: true
          }
        );
      }
    }
  });
};

/**
 * Accept a partner request
 * Pass both partnershipId and userId for optimistic updates
 */
export const useAcceptPartnerRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { partnershipId: string; userId: string }) =>
      partnersService.acceptRequest(params.partnershipId),
    // Optimistic update
    onMutate: async ({ partnershipId, userId }) => {
      // Cancel only specific queries we're about to update
      await queryClient.cancelQueries({
        queryKey: partnersQueryKeys.pending()
      });
      await queryClient.cancelQueries({ queryKey: partnersQueryKeys.list() });
      await queryClient.cancelQueries({
        queryKey: [...partnersQueryKeys.all, "search-infinite"],
        exact: false
      });
      await queryClient.cancelQueries({
        queryKey: partnersQueryKeys.suggestedInfinite()
      });

      // Find the request being accepted (store for potential rollback)
      let acceptedPartner: Partner | undefined;
      const currentUserId = useAuthStore.getState().user?.id;

      // Remove from pending
      queryClient.setQueryData(partnersQueryKeys.pending(), (old: any) => {
        if (!old?.data) return old;
        acceptedPartner = old.data.find((p: Partner) => p.id === partnershipId);
        return {
          ...old,
          data: old.data.filter((p: Partner) => p.id !== partnershipId)
        };
      });

      // Add to list with accepted status (check for duplicates)
      // IMPORTANT: Normalize partner_user_id to always be the OTHER person
      if (acceptedPartner) {
        // Capture in local variable to satisfy TypeScript
        const partnerEntry = acceptedPartner;

        queryClient.setQueryData(partnersQueryKeys.list(), (old: any) => {
          // Normalize: if partner_user_id is me, swap with user_id
          // This matches what the API does when returning partners list
          let normalizedPartner: Partner = { ...partnerEntry, status: "accepted" as const };

          if (currentUserId && partnerEntry.partner_user_id === currentUserId) {
            // I received this request, so the sender (user_id) is my partner
            normalizedPartner = {
              ...normalizedPartner,
              partner_user_id: partnerEntry.user_id
              // The partner object should already have the sender's info from pending list
            };
          }

          if (!old?.data) {
            return { data: [normalizedPartner] };
          }
          // Check if already exists (from realtime race condition)
          const exists = old.data.some((p: Partner) => p.id === partnerEntry.id);
          if (exists) {
            // Update existing instead of adding duplicate
            return {
              ...old,
              data: old.data.map((p: Partner) => (p.id === partnerEntry.id ? normalizedPartner : p))
            };
          }
          return {
            ...old,
            data: [...old.data, normalizedPartner]
          };
        });
      }

      // Optimistically update the user in search/suggested to show "Partner" status
      const searchQueryState = queryClient.getQueriesData({
        queryKey: [...partnersQueryKeys.all, "search-infinite"],
        exact: false
      });
      searchQueryState.forEach(([key]) => {
        updateUserInInfiniteQuery(queryClient, key as readonly string[], userId, {
          request_status: "accepted",
          partnership_id: partnershipId,
          is_partner: true,
          has_pending_request: false
        });
      });

      updateUserInInfiniteQuery(queryClient, partnersQueryKeys.suggestedInfinite(), userId, {
        request_status: "accepted",
        partnership_id: partnershipId,
        is_partner: true,
        has_pending_request: false
      });

      return { partnershipId, userId, acceptedPartner };
    },
    onError: (err, params, context) => {
      // Rollback: only revert this specific partnership (not entire snapshot)
      // Remove from partners list
      queryClient.setQueryData(partnersQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((p: Partner) => p.id !== params.partnershipId)
        };
      });

      // Add back to pending list if we have the original entry
      const originalEntry = context?.acceptedPartner;
      if (originalEntry) {
        queryClient.setQueryData(partnersQueryKeys.pending(), (old: any) => {
          if (!old?.data) return { data: [originalEntry] };
          const exists = old.data.some((p: Partner) => p.id === originalEntry.id);
          if (exists) return old;
          return { ...old, data: [originalEntry, ...old.data] };
        });
      }

      // Revert this user's status in search/suggested back to "received"
      const searchQueryState = queryClient.getQueriesData({
        queryKey: [...partnersQueryKeys.all, "search-infinite"],
        exact: false
      });
      searchQueryState.forEach(([key]) => {
        updateUserInInfiniteQuery(queryClient, key as readonly string[], params.userId, {
          request_status: "received",
          partnership_id: params.partnershipId,
          is_partner: false,
          has_pending_request: true
        });
      });

      updateUserInInfiniteQuery(queryClient, partnersQueryKeys.suggestedInfinite(), params.userId, {
        request_status: "received",
        partnership_id: params.partnershipId,
        is_partner: false,
        has_pending_request: true
      });
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: partnersQueryKeys.pending()
      });
      queryClient.invalidateQueries({ queryKey: partnersQueryKeys.list() });
    }
  });
};

/**
 * Reject a partner request
 */
export const useRejectPartnerRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (partnershipId: string) => partnersService.rejectRequest(partnershipId),
    // Optimistic update
    onMutate: async (partnershipId) => {
      await queryClient.cancelQueries({
        queryKey: partnersQueryKeys.pending()
      });

      const previousPending = queryClient.getQueryData(partnersQueryKeys.pending());

      // Remove from pending
      queryClient.setQueryData(partnersQueryKeys.pending(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((p: Partner) => p.id !== partnershipId)
        };
      });

      return { previousPending };
    },
    onError: (err, partnershipId, context) => {
      if (context?.previousPending) {
        queryClient.setQueryData(partnersQueryKeys.pending(), context.previousPending);
      }
    }
  });
};

/**
 * Cancel a partner request that the current user initiated
 * Pass both partnershipId and userId for optimistic updates
 */
export const useCancelPartnerRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { partnershipId: string; userId: string }) =>
      partnersService.cancelRequest(params.partnershipId),
    // Optimistic update
    onMutate: async ({ partnershipId, userId }) => {
      // Cancel only specific queries we're about to update
      await queryClient.cancelQueries({
        queryKey: partnersQueryKeys.pending()
      });
      await queryClient.cancelQueries({
        queryKey: partnersQueryKeys.sent()
      });
      await queryClient.cancelQueries({
        queryKey: [...partnersQueryKeys.all, "search-infinite"],
        exact: false
      });
      await queryClient.cancelQueries({
        queryKey: partnersQueryKeys.suggestedInfinite()
      });

      // Store the entry we're removing for potential rollback
      const sentData = queryClient.getQueryData(partnersQueryKeys.sent()) as any;
      const removedEntry = sentData?.data?.find((p: Partner) => p.id === partnershipId);

      // Remove from pending
      queryClient.setQueryData(partnersQueryKeys.pending(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((p: Partner) => p.id !== partnershipId)
        };
      });

      // Remove from sent
      queryClient.setQueryData(partnersQueryKeys.sent(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((p: Partner) => p.id !== partnershipId)
        };
      });

      // Optimistically update the user in search/suggested to show "Request" button
      const searchQueryState = queryClient.getQueriesData({
        queryKey: [...partnersQueryKeys.all, "search-infinite"],
        exact: false
      });
      searchQueryState.forEach(([key]) => {
        updateUserInInfiniteQuery(queryClient, key as readonly string[], userId, {
          request_status: "none",
          partnership_id: null,
          has_pending_request: false
        });
      });

      updateUserInInfiniteQuery(queryClient, partnersQueryKeys.suggestedInfinite(), userId, {
        request_status: "none",
        partnership_id: null,
        has_pending_request: false
      });

      return { partnershipId, userId, removedEntry };
    },
    onError: (err, params, context) => {
      // Rollback: add the entry back (only this specific one, not entire snapshot)
      if (context?.removedEntry) {
        queryClient.setQueryData(partnersQueryKeys.sent(), (old: any) => {
          if (!old?.data) return { data: [context.removedEntry] };
          // Only add if not already present
          const exists = old.data.some((p: Partner) => p.id === context.removedEntry.id);
          if (exists) return old;
          return { ...old, data: [context.removedEntry, ...old.data] };
        });
      }

      // Revert this user's status in search/suggested back to "sent"
      const searchQueryState = queryClient.getQueriesData({
        queryKey: [...partnersQueryKeys.all, "search-infinite"],
        exact: false
      });
      searchQueryState.forEach(([key]) => {
        updateUserInInfiniteQuery(queryClient, key as readonly string[], params.userId, {
          request_status: "sent",
          partnership_id: params.partnershipId,
          has_pending_request: true
        });
      });

      updateUserInInfiniteQuery(queryClient, partnersQueryKeys.suggestedInfinite(), params.userId, {
        request_status: "sent",
        partnership_id: params.partnershipId,
        has_pending_request: true
      });
    }
  });
};

/**
 * Remove an existing partner
 */
export const useRemovePartner = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (partnershipId: string) => partnersService.removePartner(partnershipId),
    // Optimistic update
    onMutate: async (partnershipId) => {
      await queryClient.cancelQueries({ queryKey: partnersQueryKeys.list() });

      const previousList = queryClient.getQueryData(partnersQueryKeys.list());

      // Remove from list
      queryClient.setQueryData(partnersQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((p: Partner) => p.id !== partnershipId)
        };
      });

      return { previousList };
    },
    onError: (err, partnershipId, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(partnersQueryKeys.list(), context.previousList);
      }
    }
  });
};

/**
 * Block a partner - removes from list and prevents future matching
 * Optimistically removes from partners list and adds to blocked list
 */
export const useBlockPartner = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (partnershipId: string) => partnersService.blockPartner(partnershipId),
    // Optimistic update: remove from partner lists, add to blocked list
    onMutate: async (partnershipId) => {
      const currentUserId = useAuthStore.getState().user?.id;

      await queryClient.cancelQueries({ queryKey: partnersQueryKeys.list() });
      await queryClient.cancelQueries({ queryKey: partnersQueryKeys.listWithGoals() });
      await queryClient.cancelQueries({ queryKey: partnersQueryKeys.blocked() });

      const previousList = queryClient.getQueryData(partnersQueryKeys.list());
      const previousListWithGoals = queryClient.getQueryData(partnersQueryKeys.listWithGoals());
      const previousBlocked = queryClient.getQueryData(partnersQueryKeys.blocked());

      // Find partner data before removing
      const partnerData = (previousList as any)?.data?.find((p: Partner) => p.id === partnershipId);

      // Remove from partner lists
      queryClient.setQueryData(partnersQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((p: Partner) => p.id !== partnershipId)
        };
      });

      queryClient.setQueryData(partnersQueryKeys.listWithGoals(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((p: Partner) => p.id !== partnershipId)
        };
      });

      // Add to blocked list (optimistic) - current user is the blocker
      if (partnerData && currentUserId) {
        const blockedPartner = { ...partnerData, status: "blocked", blocked_by: currentUserId };
        queryClient.setQueryData(partnersQueryKeys.blocked(), (old: any) => {
          if (!old?.data) return { data: [blockedPartner] };
          const exists = old.data.some((p: Partner) => p.id === partnershipId);
          if (exists) return old;
          return { ...old, data: [blockedPartner, ...old.data] };
        });
      }

      return { previousList, previousListWithGoals, previousBlocked };
    },
    onError: (_err, _partnershipId, context) => {
      // Rollback all caches
      if (context?.previousList) {
        queryClient.setQueryData(partnersQueryKeys.list(), context.previousList);
      }
      if (context?.previousListWithGoals) {
        queryClient.setQueryData(partnersQueryKeys.listWithGoals(), context.previousListWithGoals);
      }
      if (context?.previousBlocked) {
        queryClient.setQueryData(partnersQueryKeys.blocked(), context.previousBlocked);
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: partnersQueryKeys.list() });
      queryClient.invalidateQueries({ queryKey: partnersQueryKeys.listWithGoals() });
      queryClient.invalidateQueries({ queryKey: partnersQueryKeys.limits() });
      queryClient.invalidateQueries({ queryKey: partnersQueryKeys.blocked() });
    }
  });
};

/**
 * Unblock a partner - allows future matching again
 * Uses optimistic update to remove from blocked list immediately
 */
export const useUnblockPartner = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (partnershipId: string) => partnersService.unblockPartner(partnershipId),
    // Optimistic update: immediately remove from blocked list
    onMutate: async (partnershipId) => {
      await queryClient.cancelQueries({ queryKey: partnersQueryKeys.blocked() });

      const previousBlocked = queryClient.getQueryData(partnersQueryKeys.blocked());

      // Remove from blocked list optimistically
      queryClient.setQueryData(partnersQueryKeys.blocked(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((p: Partner) => p.id !== partnershipId)
        };
      });

      return { previousBlocked };
    },
    onError: (err, partnershipId, context) => {
      // Rollback on error
      if (context?.previousBlocked) {
        queryClient.setQueryData(partnersQueryKeys.blocked(), context.previousBlocked);
      }
    },
    onSettled: () => {
      // Refetch blocked list and suggested partners to ensure consistency
      queryClient.invalidateQueries({ queryKey: partnersQueryKeys.blocked() });
      queryClient.invalidateQueries({ queryKey: partnersQueryKeys.suggestedInfinite() });
    }
  });
};

/**
 * Report a user for inappropriate username or behavior
 * When blockPartner is true, optimistically removes from partners list and adds to blocked list
 */
export const useReportUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      userId: string;
      reason: "inappropriate_username" | "harassment" | "spam" | "other";
      details?: string;
      blockPartner?: boolean;
    }) =>
      partnersService.reportUser(params.userId, params.reason, params.details, params.blockPartner),

    onMutate: async (params) => {
      // Only do optimistic update if blocking
      if (!params.blockPartner) return {};

      const currentUserId = useAuthStore.getState().user?.id;

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: partnersQueryKeys.list() });
      await queryClient.cancelQueries({ queryKey: partnersQueryKeys.listWithGoals() });
      await queryClient.cancelQueries({ queryKey: partnersQueryKeys.blocked() });

      // Snapshot previous values
      const previousPartners = queryClient.getQueryData(partnersQueryKeys.list());
      const previousPartnersWithGoals = queryClient.getQueryData(partnersQueryKeys.listWithGoals());
      const previousBlocked = queryClient.getQueryData(partnersQueryKeys.blocked());

      // Find partner data before removing (to add to blocked list)
      const partnerData = (previousPartners as any)?.data?.find(
        (p: any) => p.partner_user_id === params.userId
      );

      // Optimistically remove the user from partners lists
      const filterOutUser = (data: any) => {
        if (!data?.data) return data;
        return {
          ...data,
          data: data.data.filter((p: any) => p.partner_user_id !== params.userId)
        };
      };

      queryClient.setQueryData(partnersQueryKeys.list(), filterOutUser);
      queryClient.setQueryData(partnersQueryKeys.listWithGoals(), filterOutUser);

      // Add to blocked list (optimistic) - current user is the blocker
      if (partnerData && currentUserId) {
        const blockedPartner = { ...partnerData, status: "blocked", blocked_by: currentUserId };
        queryClient.setQueryData(partnersQueryKeys.blocked(), (old: any) => {
          if (!old?.data) return { data: [blockedPartner] };
          const exists = old.data.some((p: any) => p.partner_user_id === params.userId);
          if (exists) return old;
          return { ...old, data: [blockedPartner, ...old.data] };
        });
      }

      // Return context with previous values for rollback
      return { previousPartners, previousPartnersWithGoals, previousBlocked };
    },

    onError: (_err, params, context) => {
      // Rollback on error (only if we did optimistic update)
      if (params.blockPartner && context) {
        if (context.previousPartners !== undefined) {
          queryClient.setQueryData(partnersQueryKeys.list(), context.previousPartners);
        }
        if (context.previousPartnersWithGoals !== undefined) {
          queryClient.setQueryData(
            partnersQueryKeys.listWithGoals(),
            context.previousPartnersWithGoals
          );
        }
        if (context.previousBlocked !== undefined) {
          queryClient.setQueryData(partnersQueryKeys.blocked(), context.previousBlocked);
        }
      }
    },

    onSettled: (_data, _error, params) => {
      // Invalidate to ensure fresh data
      if (params.blockPartner) {
        queryClient.invalidateQueries({ queryKey: partnersQueryKeys.list() });
        queryClient.invalidateQueries({ queryKey: partnersQueryKeys.listWithGoals() });
        queryClient.invalidateQueries({ queryKey: partnersQueryKeys.limits() });
        queryClient.invalidateQueries({ queryKey: partnersQueryKeys.blocked() });
      }
    }
  });
};

/**
 * Get partner's accountability dashboard (goals, progress)
 *
 * NOTE: Realtime updates for partner data work via the accountability_partners table.
 * When a user updates their goals, the backend touches the partnership
 * record's updated_at, which triggers a realtime event to the partner.
 * The realtimeService then invalidates this dashboard query.
 */
export const usePartnerDashboard = (partnerUserId: string | undefined) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: partnersQueryKeys.dashboard(partnerUserId || ""),
    queryFn: async () => {
      const response = await partnersService.getPartnerDashboard(partnerUserId!);
      if (response.status !== 200 || !response.data) {
        // Include status in error for retry logic
        const error = new Error(response.error || "Failed to get partner dashboard");
        (error as any).status = response.status;
        throw error;
      }
      return response.data;
    },
    enabled: !!partnerUserId,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnMount: "always", // Always refetch when screen mounts
    refetchOnWindowFocus: true, // Refetch when app comes to foreground
    // Retry on 404 only if partner exists in cache (optimistic update pending)
    // If partner was actually deleted, don't retry
    retry: (failureCount, error) => {
      const status = (error as any).status;
      if (status !== 404 || failureCount >= 3) {
        return false;
      }

      // Check if partner still exists in our cache (from optimistic update)
      const partnersData = queryClient.getQueryData(partnersQueryKeys.list()) as any;
      const partnerInCache = partnersData?.data?.some(
        (p: Partner) => p.partner_user_id === partnerUserId || p.partner?.id === partnerUserId
      );

      // Only retry if partner is in cache (pending optimistic update)
      // If not in cache, partnership was likely deleted - don't retry
      return partnerInCache;
    },
    retryDelay: (attemptIndex) => Math.min(500 * (attemptIndex + 1), 2000) // 500ms, 1s, 2s
  });
};

/**
 * Get current user's partner limits (accepted count, pending sent count, limit)
 */
export const usePartnerLimits = () => {
  return useQuery({
    queryKey: partnersQueryKeys.limits(),
    queryFn: async () => {
      const response = await partnersService.getPartnerLimits();
      if (response.status !== 200 || !response.data) {
        throw new Error(response.error || "Failed to get partner limits");
      }
      return response.data;
    },
    staleTime: 60 * 1000 // 1 minute
  });
};

/**
 * Combined hook for checking partner access with immediate subscription store updates
 *
 * Uses subscriptionStore for hasFeature (updates immediately after purchase)
 * Uses usePartnerLimits for counts (accepted_count, pending_sent_count)
 *
 * This ensures:
 * 1. Feature access updates immediately after purchase (via subscriptionStore)
 * 2. Counts come from cached backend data (accurate accepted + pending counts)
 */
export const usePartnerAccess = () => {
  const { hasPartnerFeature, getPartnerLimit, openModal } = useSubscriptionStore();
  const { data: limits, isLoading, refetch } = usePartnerLimits();

  // Use subscription store for feature (immediate after purchase)
  const hasFeature = hasPartnerFeature();
  const limit = getPartnerLimit();

  // Use cached limits for counts (from backend)
  const acceptedCount = limits?.accepted_count ?? 0;
  const pendingSentCount = limits?.pending_sent_count ?? 0;

  // Calculate if user can send a request
  // Uses store for feature + limit (immediate), cache for counts (accurate)
  const canSendRequest = (): boolean => {
    // No feature = no access
    if (!hasFeature) return false;

    // null limit = unlimited
    if (limit === null) return true;

    // 0 limit = disabled
    if (limit === 0) return false;

    // Check against counts from cache
    return acceptedCount + pendingSentCount < limit;
  };

  // Remaining slots (if limit is not unlimited)
  const remainingSlots =
    limit === null ? null : Math.max(0, limit - acceptedCount - pendingSentCount);

  return {
    // Feature access (immediate via subscriptionStore)
    hasFeature,
    limit,

    // Counts (from cached backend data)
    acceptedCount,
    pendingSentCount,
    isLoading,

    // Computed helpers
    canSendRequest: canSendRequest(),
    remainingSlots,

    // Actions
    refetch, // Refetch limits from backend
    openSubscriptionModal: openModal // Open subscription modal for upsell
  };
};
