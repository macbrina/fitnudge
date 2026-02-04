"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/lib/api";
import { queryKeys } from "./queryKeys";

export function useAuthMe(enabled = true) {
  return useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: async () => {
      const res = await authApi.me();
      if (res.error) throw new Error(res.error);
      return res.data ?? null;
    },
    enabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAuthLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.login(email, password),
    onSuccess: (res) => {
      if (res.data?.user) {
        queryClient.setQueryData(queryKeys.auth.me(), res.data.user);
      }
    },
  });
}

export function useAuthLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.auth.me(), null);
      queryClient.clear();
    },
  });
}

export function useAuthForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
  });
}

export function useAuthValidateResetToken(token: string, enabled: boolean) {
  return useQuery({
    queryKey: ["auth", "validate-reset-token", token] as const,
    queryFn: async () => {
      const res = await authApi.validateResetToken(token);
      if (res.error) throw new Error(res.error);
      return res.data ?? { valid: false };
    },
    enabled: enabled && !!token,
    retry: false,
  });
}

export function useAuthResetPassword() {
  return useMutation({
    mutationFn: ({ token, newPassword }: { token: string; newPassword: string }) =>
      authApi.resetPassword(token, newPassword),
  });
}
