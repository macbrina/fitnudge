"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { appConfigApi } from "@/lib/api";
import { queryKeys } from "./queryKeys";

async function unwrap<T>(promise: Promise<{ data?: T; error?: string }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(error);
  if (data === undefined) throw new Error("No data");
  return data;
}

export function useAppConfigList() {
  return useQuery({
    queryKey: queryKeys.appConfig.list(),
    queryFn: () => unwrap(appConfigApi.list()),
  });
}

export function useAppConfigDetail(key: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.appConfig.detail(key),
    queryFn: () => unwrap(appConfigApi.get(key)),
    enabled: enabled && !!key,
  });
}

export function useAppConfigUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      key,
      payload,
    }: {
      key: string;
      payload: { value: string; description?: string; is_public?: boolean };
    }) => unwrap(appConfigApi.update(key, payload)),
    onSuccess: (_, { key }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.appConfig.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.appConfig.detail(key) });
    },
  });
}
