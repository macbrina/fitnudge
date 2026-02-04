"use client";

import { useQuery } from "@tanstack/react-query";
import { auditLogsApi } from "@/lib/api";
import { queryKeys } from "./queryKeys";

async function unwrap<T>(promise: Promise<{ data?: T; error?: string }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(error);
  if (data === undefined) throw new Error("No data");
  return data;
}

export function useAuditLogsList(params?: {
  page?: number;
  per_page?: number;
  admin_user_id?: string;
  resource_type?: string;
  action?: string;
  from_date?: string;
  to_date?: string;
}) {
  return useQuery({
    queryKey: queryKeys.auditLogs.list(params ?? {}),
    queryFn: () => unwrap(auditLogsApi.list(params)),
  });
}
