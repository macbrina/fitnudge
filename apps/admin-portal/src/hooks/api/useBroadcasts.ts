"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  broadcastsApi,
  type BroadcastCreatePayload,
  type BroadcastUpdatePayload,
} from "@/lib/api";
import { queryKeys } from "./queryKeys";

async function unwrap<T>(promise: Promise<{ data?: T; error?: string }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(error);
  if (data === undefined) throw new Error("No data");
  return data;
}

export function useBroadcastsList(params?: {
  page?: number;
  per_page?: number;
  is_active?: boolean;
  audience?: string;
  delivery?: string;
}) {
  return useQuery({
    queryKey: queryKeys.broadcasts.list(params ?? {}),
    queryFn: () => unwrap(broadcastsApi.list(params)),
  });
}

export function useBroadcastDetail(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.broadcasts.detail(id),
    queryFn: () => unwrap(broadcastsApi.get(id)),
    enabled: enabled && !!id,
  });
}

export function useBroadcastCreate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BroadcastCreatePayload) =>
      unwrap(broadcastsApi.create(payload)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.broadcasts.lists() });
    },
  });
}

export function useBroadcastUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: BroadcastUpdatePayload }) =>
      unwrap(broadcastsApi.update(id, payload)),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.broadcasts.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.broadcasts.detail(id) });
    },
  });
}

export function useBroadcastDelete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(broadcastsApi.delete(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.broadcasts.lists() });
    },
  });
}
