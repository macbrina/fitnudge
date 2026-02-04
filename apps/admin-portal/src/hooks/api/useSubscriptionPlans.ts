"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  subscriptionPlansApi,
  type SubscriptionPlanUpdatePayload,
} from "@/lib/api";
import { queryKeys } from "./queryKeys";

async function unwrap<T>(promise: Promise<{ data?: T; error?: string }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(error);
  if (data === undefined) throw new Error("No data");
  return data;
}

export function useSubscriptionPlansList() {
  return useQuery({
    queryKey: queryKeys.subscriptionPlans.list(),
    queryFn: () => unwrap(subscriptionPlansApi.list()),
  });
}

export function useSubscriptionPlanDetail(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.subscriptionPlans.detail(id),
    queryFn: () => unwrap(subscriptionPlansApi.get(id)),
    enabled: enabled && !!id,
  });
}

export function useSubscriptionPlanUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: SubscriptionPlanUpdatePayload;
    }) => unwrap(subscriptionPlansApi.update(id, payload)),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptionPlans.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.subscriptionPlans.detail(id),
      });
    },
  });
}
