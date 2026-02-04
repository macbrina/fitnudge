"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userReportsApi } from "@/lib/api";
import { queryKeys } from "./queryKeys";

async function unwrap<T>(promise: Promise<{ data?: T; error?: string }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(error);
  if (data === undefined) throw new Error("No data");
  return data;
}

export function useUserReportsList(params?: {
  page?: number;
  per_page?: number;
  status?: string;
  reason?: string;
}) {
  return useQuery({
    queryKey: queryKeys.userReports.list(params ?? {}),
    queryFn: () =>
      unwrap(
        userReportsApi.list({
          page: params?.page,
          per_page: params?.per_page,
          status: params?.status,
          reason: params?.reason,
        })
      ),
  });
}

export function useUserReportsStats() {
  return useQuery({
    queryKey: queryKeys.userReports.stats(),
    queryFn: () => unwrap(userReportsApi.stats()),
  });
}

export function useUserReportDetail(reportId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.userReports.detail(reportId),
    queryFn: () => unwrap(userReportsApi.get(reportId)),
    enabled: enabled && !!reportId,
  });
}

export function useUserReportUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      admin_notes,
    }: {
      id: string;
      status?: "pending" | "reviewed" | "actioned" | "dismissed";
      admin_notes?: string;
    }) =>
      unwrap(userReportsApi.update(id, { status, admin_notes })),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userReports.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.userReports.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.userReports.stats() });
    },
  });
}
