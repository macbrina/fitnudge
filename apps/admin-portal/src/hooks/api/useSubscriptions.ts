"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { subscriptionsApi } from "@/lib/api";
import { queryKeys } from "./queryKeys";

async function unwrap<T>(promise: Promise<{ data?: T; error?: string }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(error);
  if (data === undefined) throw new Error("No data");
  return data;
}

export function useSubscriptionsList(params?: {
  page?: number;
  per_page?: number;
  status?: string;
  platform?: string;
}) {
  return useQuery({
    queryKey: queryKeys.subscriptions.list(params ?? {}),
    queryFn: () =>
      unwrap(
        subscriptionsApi.list({
          page: params?.page,
          per_page: params?.per_page,
          status: params?.status,
          platform: params?.platform,
        })
      ),
  });
}

export function useSubscriptionsStats() {
  return useQuery({
    queryKey: queryKeys.subscriptions.stats(),
    queryFn: () => unwrap(subscriptionsApi.stats()),
  });
}

export function useSubscriptionDetail(subscriptionId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.subscriptions.detail(subscriptionId),
    queryFn: () => unwrap(subscriptionsApi.get(subscriptionId)),
    enabled: enabled && !!subscriptionId,
  });
}

export function useSubscriptionCancel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, immediate }: { id: string; immediate: boolean }) =>
      unwrap(subscriptionsApi.cancel(id, immediate)),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.stats() });
    },
  });
}

export function useSubscriptionGrant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      user_id,
      plan_id,
      days,
    }: {
      user_id: string;
      plan_id?: string;
      days?: number;
    }) =>
      unwrap(subscriptionsApi.grant(user_id, plan_id ?? "premium", days ?? 30)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.stats() });
    },
  });
}
