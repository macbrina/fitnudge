"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "@/lib/api";
import { queryKeys } from "./queryKeys";

async function unwrap<T>(promise: Promise<{ data?: T; error?: string }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(error);
  if (data === undefined) throw new Error("No data");
  return data;
}

export function useTasksOverview() {
  return useQuery({
    queryKey: queryKeys.tasks.overview(),
    queryFn: () => unwrap(tasksApi.overview()),
    refetchInterval: 10000, // Refresh every 10s
  });
}

export function useTasksRecent(
  limit = 50,
  options?: { refetchInterval?: number | false }
) {
  return useQuery({
    queryKey: queryKeys.tasks.recent(limit),
    queryFn: () => unwrap(tasksApi.recent({ limit })),
    refetchInterval: options?.refetchInterval ?? 5000,
  });
}

export function useTasksFailures(params?: { limit?: number; task_name?: string }) {
  return useQuery({
    queryKey: queryKeys.tasks.failures(params),
    queryFn: () => unwrap(tasksApi.failures(params)),
    refetchInterval: 15000,
  });
}

export function useTaskFailureDelete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recordId: string) => unwrap(tasksApi.deleteFailure(recordId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}

export function useTasksWorkers() {
  return useQuery({
    queryKey: queryKeys.tasks.workers(),
    queryFn: () => unwrap(tasksApi.workers()),
    refetchInterval: 10000,
  });
}

export function useTasksActive() {
  return useQuery({
    queryKey: queryKeys.tasks.active(),
    queryFn: () => unwrap(tasksApi.active()),
    refetchInterval: 5000,
  });
}

export function useTasksScheduled() {
  return useQuery({
    queryKey: queryKeys.tasks.scheduled(),
    queryFn: () => unwrap(tasksApi.scheduled()),
    refetchInterval: 10000,
  });
}

export function useTasksBeatSchedule() {
  return useQuery({
    queryKey: queryKeys.tasks.beatSchedule(),
    queryFn: () => unwrap(tasksApi.beatSchedule()),
  });
}

export function useTasksRegistered() {
  return useQuery({
    queryKey: queryKeys.tasks.registered(),
    queryFn: () => unwrap(tasksApi.registered()),
  });
}

export function useTaskDetail(taskId: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tasks.detail(taskId ?? ""),
    queryFn: () => unwrap(tasksApi.getTask(taskId!)),
    enabled: enabled && !!taskId,
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      if (state === "PENDING" || state === "STARTED") return 2000;
      return false;
    },
  });
}

export function useTaskRevoke() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, terminate }: { id: string; terminate?: boolean }) =>
      unwrap(tasksApi.revoke(id, terminate)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}

export function useTaskPurge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (queue?: string) => unwrap(tasksApi.purge(queue)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}

export function useTaskCatchup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params?: { lookback_days?: number; start_date?: string; end_date?: string }) =>
      unwrap(tasksApi.catchup(params)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}
