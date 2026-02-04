"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  planFeaturesApi,
  type PlanFeatureUpdatePayload,
} from "@/lib/api";
import { queryKeys } from "./queryKeys";

async function unwrap<T>(promise: Promise<{ data?: T; error?: string }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(error);
  if (data === undefined) throw new Error("No data");
  return data;
}

export function usePlanFeaturesList(planId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.planFeatures.listByPlan(planId),
    queryFn: () => unwrap(planFeaturesApi.listByPlan(planId)),
    enabled: enabled && !!planId,
  });
}

export function usePlanFeatureUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PlanFeatureUpdatePayload; planId: string }) =>
      unwrap(planFeaturesApi.update(id, payload)),
    onSuccess: (_, { planId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.planFeatures.listByPlan(planId),
      });
    },
  });
}
