import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import {
  partnersService,
  Partner,
  PartnerRequest,
  SearchUserResult,
} from "@/services/api/partners";
import { partnersQueryKeys } from "./queryKeys";

// Re-export query keys for external use
export { partnersQueryKeys } from "./queryKeys";

/**
 * Get accepted accountability partners
 */
export const usePartners = () => {
  return useQuery({
    queryKey: partnersQueryKeys.list(),
    queryFn: () => partnersService.getPartners(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Get pending partner requests (received by current user)
 */
export const usePendingPartnerRequests = () => {
  return useQuery({
    queryKey: partnersQueryKeys.pending(),
    queryFn: () => partnersService.getPendingRequests(),
    staleTime: 60 * 1000, // 1 minute
  });
};

/**
 * Get sent partner requests (initiated by current user)
 */
export const useSentPartnerRequests = () => {
  return useQuery({
    queryKey: partnersQueryKeys.sent(),
    queryFn: () => partnersService.getSentRequests(),
    staleTime: 60 * 1000, // 1 minute
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
        data: response.data?.users || [],
      };
    },
    enabled: query.length >= 2,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

/**
 * Search for users to add as partners with infinite scroll pagination
 */
export const useSearchPartnersInfinite = (
  query: string,
  limit: number = 20
) => {
  return useInfiniteQuery({
    queryKey: partnersQueryKeys.searchInfinite(query),
    queryFn: async ({ pageParam = 1 }) => {
      const response = await partnersService.searchUsers(
        query,
        pageParam,
        limit
      );
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
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

/**
 * Get suggested users to add as partners with infinite scroll pagination
 */
export const useSuggestedPartnersInfinite = (limit: number = 20) => {
  return useInfiniteQuery({
    queryKey: partnersQueryKeys.suggestedInfinite(),
    queryFn: async ({ pageParam = 1 }) => {
      const response = await partnersService.getSuggestedUsers(
        pageParam,
        limit
      );
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
    staleTime: 5 * 60 * 1000, // 5 minutes
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
        users: page.users.map((user: any) =>
          user.id === userId ? { ...user, ...updates } : user
        ),
      })),
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
      await queryClient.cancelQueries({
        queryKey: partnersQueryKeys.pending(),
      });
      await queryClient.cancelQueries({
        queryKey: partnersQueryKeys.sent(),
      });
      await queryClient.cancelQueries({
        queryKey: [...partnersQueryKeys.all, "search-infinite"],
        exact: false,
      });
      await queryClient.cancelQueries({
        queryKey: partnersQueryKeys.suggestedInfinite(),
      });

      // Snapshot previous data for rollback
      const previousPending = queryClient.getQueryData(
        partnersQueryKeys.pending()
      );
      const previousSent = queryClient.getQueryData(partnersQueryKeys.sent());

      // Get all search infinite query keys and snapshot them
      // Use base key without search term to match all search queries
      const searchQueryState = queryClient.getQueriesData({
        queryKey: [...partnersQueryKeys.all, "search-infinite"],
        exact: false,
      });

      const suggestedQueryState = queryClient.getQueriesData({
        queryKey: partnersQueryKeys.suggestedInfinite(),
      });

      // Create optimistic pending request
      const optimisticRequest: Partner = {
        id: `temp-${Date.now()}`,
        user_id: "",
        partner_user_id: data.partner_user_id,
        status: "pending",
        initiated_by_user_id: "",
        created_at: new Date().toISOString(),
      };

      // Add to pending list
      queryClient.setQueryData(partnersQueryKeys.pending(), (old: any) => {
        if (!old?.data) {
          return { data: [optimisticRequest] };
        }
        return {
          ...old,
          data: [...old.data, optimisticRequest],
        };
      });

      // Add to sent list
      queryClient.setQueryData(partnersQueryKeys.sent(), (old: any) => {
        if (!old?.data) {
          return { data: [optimisticRequest] };
        }
        return {
          ...old,
          data: [optimisticRequest, ...old.data],
        };
      });

      // Optimistically update the user in search/suggested results
      // Update all search queries
      searchQueryState.forEach(([key]) => {
        updateUserInInfiniteQuery(
          queryClient,
          key as readonly string[],
          data.partner_user_id,
          {
            request_status: "sent",
            partnership_id: optimisticRequest.id,
            has_pending_request: true,
          }
        );
      });

      // Update suggested query
      updateUserInInfiniteQuery(
        queryClient,
        partnersQueryKeys.suggestedInfinite(),
        data.partner_user_id,
        {
          request_status: "sent",
          partnership_id: optimisticRequest.id,
          has_pending_request: true,
        }
      );

      return {
        previousPending,
        previousSent,
        searchQueryState,
        suggestedQueryState,
      };
    },
    onError: (err, data, context) => {
      // Rollback pending list
      if (context?.previousPending) {
        queryClient.setQueryData(
          partnersQueryKeys.pending(),
          context.previousPending
        );
      }
      // Rollback sent list
      if (context?.previousSent) {
        queryClient.setQueryData(
          partnersQueryKeys.sent(),
          context.previousSent
        );
      }
      // Rollback search queries
      context?.searchQueryState?.forEach(([key, value]: [any, any]) => {
        queryClient.setQueryData(key, value);
      });
      // Rollback suggested query
      context?.suggestedQueryState?.forEach(([key, value]: [any, any]) => {
        queryClient.setQueryData(key, value);
      });
    },
    onSuccess: (response, data) => {
      // Replace temp with real data in pending list
      const realPartnership = response?.data;
      if (realPartnership) {
        queryClient.setQueryData(partnersQueryKeys.pending(), (old: any) => {
          if (!old?.data) return { data: [realPartnership] };
          const filtered = old.data.filter(
            (p: Partner) => !p.id.startsWith("temp-")
          );
          return { ...old, data: [...filtered, realPartnership] };
        });

        // Replace temp with real data in sent list
        queryClient.setQueryData(partnersQueryKeys.sent(), (old: any) => {
          if (!old?.data) return { data: [realPartnership] };
          const filtered = old.data.filter(
            (p: Partner) => !p.id.startsWith("temp-")
          );
          return { ...old, data: [realPartnership, ...filtered] };
        });

        // Update the real partnership_id in search/suggested
        const searchQueryState = queryClient.getQueriesData({
          queryKey: [...partnersQueryKeys.all, "search-infinite"],
          exact: false,
        });

        searchQueryState.forEach(([key]) => {
          updateUserInInfiniteQuery(
            queryClient,
            key as readonly string[],
            data.partner_user_id,
            {
              request_status: "sent",
              partnership_id: realPartnership.id,
              has_pending_request: true,
            }
          );
        });

        updateUserInInfiniteQuery(
          queryClient,
          partnersQueryKeys.suggestedInfinite(),
          data.partner_user_id,
          {
            request_status: "sent",
            partnership_id: realPartnership.id,
            has_pending_request: true,
          }
        );
      }
    },
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
        queryKey: partnersQueryKeys.pending(),
      });
      await queryClient.cancelQueries({ queryKey: partnersQueryKeys.list() });
      await queryClient.cancelQueries({
        queryKey: [...partnersQueryKeys.all, "search-infinite"],
        exact: false,
      });
      await queryClient.cancelQueries({
        queryKey: partnersQueryKeys.suggestedInfinite(),
      });

      const previousPending = queryClient.getQueryData(
        partnersQueryKeys.pending()
      );
      const previousList = queryClient.getQueryData(partnersQueryKeys.list());

      const searchQueryState = queryClient.getQueriesData({
        queryKey: [...partnersQueryKeys.all, "search-infinite"],
        exact: false,
      });

      const suggestedQueryState = queryClient.getQueriesData({
        queryKey: partnersQueryKeys.suggestedInfinite(),
      });

      // Find the request being accepted
      let acceptedPartner: Partner | undefined;

      // Remove from pending
      queryClient.setQueryData(partnersQueryKeys.pending(), (old: any) => {
        if (!old?.data) return old;
        acceptedPartner = old.data.find((p: Partner) => p.id === partnershipId);
        return {
          ...old,
          data: old.data.filter((p: Partner) => p.id !== partnershipId),
        };
      });

      // Add to list with accepted status
      if (acceptedPartner) {
        queryClient.setQueryData(partnersQueryKeys.list(), (old: any) => {
          if (!old?.data) {
            return { data: [{ ...acceptedPartner, status: "accepted" }] };
          }
          return {
            ...old,
            data: [...old.data, { ...acceptedPartner, status: "accepted" }],
          };
        });
      }

      // Optimistically update the user in search/suggested to show "Partner" status
      searchQueryState.forEach(([key]) => {
        updateUserInInfiniteQuery(
          queryClient,
          key as readonly string[],
          userId,
          {
            request_status: "accepted",
            partnership_id: partnershipId,
            is_partner: true,
            has_pending_request: false,
          }
        );
      });

      updateUserInInfiniteQuery(
        queryClient,
        partnersQueryKeys.suggestedInfinite(),
        userId,
        {
          request_status: "accepted",
          partnership_id: partnershipId,
          is_partner: true,
          has_pending_request: false,
        }
      );

      return {
        previousPending,
        previousList,
        searchQueryState,
        suggestedQueryState,
      };
    },
    onError: (err, params, context) => {
      if (context?.previousPending) {
        queryClient.setQueryData(
          partnersQueryKeys.pending(),
          context.previousPending
        );
      }
      if (context?.previousList) {
        queryClient.setQueryData(
          partnersQueryKeys.list(),
          context.previousList
        );
      }
      // Rollback search queries
      context?.searchQueryState?.forEach(([key, value]: [any, any]) => {
        queryClient.setQueryData(key, value);
      });
      // Rollback suggested query
      context?.suggestedQueryState?.forEach(([key, value]: [any, any]) => {
        queryClient.setQueryData(key, value);
      });
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: partnersQueryKeys.pending(),
      });
      queryClient.invalidateQueries({ queryKey: partnersQueryKeys.list() });
    },
  });
};

/**
 * Reject a partner request
 */
export const useRejectPartnerRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (partnershipId: string) =>
      partnersService.rejectRequest(partnershipId),
    // Optimistic update
    onMutate: async (partnershipId) => {
      await queryClient.cancelQueries({
        queryKey: partnersQueryKeys.pending(),
      });

      const previousPending = queryClient.getQueryData(
        partnersQueryKeys.pending()
      );

      // Remove from pending
      queryClient.setQueryData(partnersQueryKeys.pending(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((p: Partner) => p.id !== partnershipId),
        };
      });

      return { previousPending };
    },
    onError: (err, partnershipId, context) => {
      if (context?.previousPending) {
        queryClient.setQueryData(
          partnersQueryKeys.pending(),
          context.previousPending
        );
      }
    },
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
        queryKey: partnersQueryKeys.pending(),
      });
      await queryClient.cancelQueries({
        queryKey: partnersQueryKeys.sent(),
      });
      await queryClient.cancelQueries({
        queryKey: [...partnersQueryKeys.all, "search-infinite"],
        exact: false,
      });
      await queryClient.cancelQueries({
        queryKey: partnersQueryKeys.suggestedInfinite(),
      });

      // Snapshot previous data for rollback
      const previousPending = queryClient.getQueryData(
        partnersQueryKeys.pending()
      );
      const previousSent = queryClient.getQueryData(partnersQueryKeys.sent());

      const searchQueryState = queryClient.getQueriesData({
        queryKey: [...partnersQueryKeys.all, "search-infinite"],
        exact: false,
      });

      const suggestedQueryState = queryClient.getQueriesData({
        queryKey: partnersQueryKeys.suggestedInfinite(),
      });

      // Remove from pending
      queryClient.setQueryData(partnersQueryKeys.pending(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((p: Partner) => p.id !== partnershipId),
        };
      });

      // Remove from sent
      queryClient.setQueryData(partnersQueryKeys.sent(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((p: Partner) => p.id !== partnershipId),
        };
      });

      // Optimistically update the user in search/suggested to show "Request" button
      searchQueryState.forEach(([key]) => {
        updateUserInInfiniteQuery(
          queryClient,
          key as readonly string[],
          userId,
          {
            request_status: "none",
            partnership_id: null,
            has_pending_request: false,
          }
        );
      });

      updateUserInInfiniteQuery(
        queryClient,
        partnersQueryKeys.suggestedInfinite(),
        userId,
        {
          request_status: "none",
          partnership_id: null,
          has_pending_request: false,
        }
      );

      return {
        previousPending,
        previousSent,
        searchQueryState,
        suggestedQueryState,
      };
    },
    onError: (err, params, context) => {
      // Rollback pending list
      if (context?.previousPending) {
        queryClient.setQueryData(
          partnersQueryKeys.pending(),
          context.previousPending
        );
      }
      // Rollback sent list
      if (context?.previousSent) {
        queryClient.setQueryData(
          partnersQueryKeys.sent(),
          context.previousSent
        );
      }
      // Rollback search queries
      context?.searchQueryState?.forEach(([key, value]: [any, any]) => {
        queryClient.setQueryData(key, value);
      });
      // Rollback suggested query
      context?.suggestedQueryState?.forEach(([key, value]: [any, any]) => {
        queryClient.setQueryData(key, value);
      });
    },
  });
};

/**
 * Remove an existing partner
 */
export const useRemovePartner = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (partnershipId: string) =>
      partnersService.removePartner(partnershipId),
    // Optimistic update
    onMutate: async (partnershipId) => {
      await queryClient.cancelQueries({ queryKey: partnersQueryKeys.list() });

      const previousList = queryClient.getQueryData(partnersQueryKeys.list());

      // Remove from list
      queryClient.setQueryData(partnersQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((p: Partner) => p.id !== partnershipId),
        };
      });

      return { previousList };
    },
    onError: (err, partnershipId, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(
          partnersQueryKeys.list(),
          context.previousList
        );
      }
    },
  });
};
