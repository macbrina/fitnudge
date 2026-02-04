"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dataExportApi } from "@/lib/api";
import { queryKeys } from "./queryKeys";

async function unwrap<T>(promise: Promise<{ data?: T; error?: string }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(error);
  if (data === undefined) throw new Error("No data");
  return data;
}

export function useDataExportList(params?: {
  page?: number;
  per_page?: number;
  status?: string;
  user_id?: string;
}) {
  return useQuery({
    queryKey: queryKeys.dataExport.list(params ?? {}),
    queryFn: () => unwrap(dataExportApi.list(params)),
  });
}

export function useDataExportDetail(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.dataExport.detail(id),
    queryFn: () => unwrap(dataExportApi.get(id)),
    enabled: enabled && !!id,
  });
}

export function useDataExportRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => unwrap(dataExportApi.request(email)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dataExport.all });
    },
  });
}

export function useDataExportRetry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(dataExportApi.retry(id)),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dataExport.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dataExport.detail(id) });
    },
  });
}
