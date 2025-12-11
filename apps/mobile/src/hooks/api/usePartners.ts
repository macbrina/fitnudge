import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  partnersService,
  Partner,
  PartnerRequest,
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
 * Get pending partner requests
 */
export const usePendingPartnerRequests = () => {
  return useQuery({
    queryKey: partnersQueryKeys.pending(),
    queryFn: () => partnersService.getPendingRequests(),
    staleTime: 60 * 1000, // 1 minute
  });
};

/**
 * Search for users to add as partners
 */
export const useSearchPartners = (query: string) => {
  return useQuery({
    queryKey: partnersQueryKeys.search(query),
    queryFn: () => partnersService.searchUsers(query),
    enabled: query.length >= 2,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

/**
 * Send a partner request
 */
export const useSendPartnerRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PartnerRequest) => partnersService.sendRequest(data),
    onSuccess: () => {
      // Invalidate pending requests
      queryClient.invalidateQueries({
        queryKey: partnersQueryKeys.pending(),
      });
      // Also invalidate search results to update "has_pending_request"
      queryClient.invalidateQueries({
        queryKey: [...partnersQueryKeys.all, "search"],
      });
    },
  });
};

/**
 * Accept a partner request
 */
export const useAcceptPartnerRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (partnershipId: string) =>
      partnersService.acceptRequest(partnershipId),
    // Optimistic update
    onMutate: async (partnershipId) => {
      await queryClient.cancelQueries({
        queryKey: partnersQueryKeys.pending(),
      });
      await queryClient.cancelQueries({ queryKey: partnersQueryKeys.list() });

      const previousPending = queryClient.getQueryData(
        partnersQueryKeys.pending()
      );
      const previousList = queryClient.getQueryData(partnersQueryKeys.list());

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

      return { previousPending, previousList };
    },
    onError: (err, partnershipId, context) => {
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
