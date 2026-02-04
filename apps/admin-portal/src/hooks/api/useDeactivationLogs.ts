"use client";

import { useQuery } from "@tanstack/react-query";
import { deactivationLogsApi } from "@/lib/api";
import { queryKeys } from "./queryKeys";

async function unwrap<T>(promise: Promise<{ data?: T; error?: string }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(error);
  if (data === undefined) throw new Error("No data");
  return data;
}

export function useDeactivationLogsList(params?: {
  page?: number;
  per_page?: number;
  user_id?: string;
  reason?: string;
  from_date?: string;
  to_date?: string;
  export_csv?: boolean;
}) {
  return useQuery({
    queryKey: queryKeys.deactivationLogs.list(params ?? {}),
    queryFn: () => unwrap(deactivationLogsApi.list(params)),
  });
}
