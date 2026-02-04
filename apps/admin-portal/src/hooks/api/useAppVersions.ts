"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  appVersionsApi,
  type AppVersionUpdatePayload,
} from "@/lib/api";
import { queryKeys } from "./queryKeys";

async function unwrap<T>(promise: Promise<{ data?: T; error?: string }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(error);
  if (data === undefined) throw new Error("No data");
  return data;
}

export function useAppVersionsList() {
  return useQuery({
    queryKey: queryKeys.appVersions.list(),
    queryFn: () => unwrap(appVersionsApi.list()),
  });
}

export function useAppVersionDetail(platform: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.appVersions.detail(platform),
    queryFn: () => unwrap(appVersionsApi.get(platform)),
    enabled: enabled && !!platform,
  });
}

export function useAppVersionUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      platform,
      payload,
    }: {
      platform: string;
      payload: AppVersionUpdatePayload;
    }) => unwrap(appVersionsApi.update(platform, payload)),
    onSuccess: (_, { platform }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.appVersions.list() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.appVersions.detail(platform),
      });
    },
  });
}
