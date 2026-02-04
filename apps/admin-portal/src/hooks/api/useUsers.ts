"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi, type UserUpdatePayload } from "@/lib/api";
import { queryKeys } from "./queryKeys";

/** Wrapper: api returns { data, error }; queryFn needs to throw or return data */
async function unwrap<T>(promise: Promise<{ data?: T; error?: string }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(error);
  if (data === undefined) throw new Error("No data");
  return data;
}

export function useUsersList(params?: {
  page?: number;
  per_page?: number;
  search?: string;
  status?: string;
  role?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}) {
  return useQuery({
    queryKey: queryKeys.users.list(params ?? {}),
    queryFn: () =>
      unwrap(
        usersApi.list({
          page: params?.page,
          per_page: params?.per_page,
          search: params?.search,
          status: params?.status,
          role: params?.role,
          sort_by: params?.sort_by,
          sort_order: params?.sort_order,
        })
      ),
  });
}

export function useUsersStats() {
  return useQuery({
    queryKey: queryKeys.users.stats(),
    queryFn: () => unwrap(usersApi.stats()),
  });
}

export function useUserDetail(userId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.users.detail(userId),
    queryFn: () => unwrap(usersApi.get(userId)),
    enabled: enabled && !!userId,
  });
}

export function useUserGoals(userId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.users.goals(userId),
    queryFn: () => unwrap(usersApi.getGoals(userId)),
    enabled: enabled && !!userId,
  });
}

export function useUserActivity(userId: string, limit?: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.users.activity(userId, limit),
    queryFn: () => unwrap(usersApi.getActivity(userId, limit)),
    enabled: enabled && !!userId,
  });
}

export function useUserUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UserUpdatePayload }) =>
      unwrap(usersApi.update(id, data)),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.stats() });
    },
  });
}
