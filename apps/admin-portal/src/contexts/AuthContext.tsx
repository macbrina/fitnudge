"use client";

import React, { createContext, useCallback, useContext } from "react";
import i18n from "@/lib/i18n";
import { useAuthMe, useAuthLogin, useAuthLogout } from "@/hooks/api/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/api/queryKeys";

export type AdminUser = {
  id: string;
  email: string;
  display_name?: string | null;
  role: string;
};

type AuthState = {
  user: AdminUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useAuthMe();
  const loginMutation = useAuthLogin();
  const logoutMutation = useAuthLogout();

  const login = useCallback(
    async (email: string, password: string): Promise<{ error?: string }> => {
      try {
        const res = await loginMutation.mutateAsync({ email, password });
        if (res.error) return { error: res.error };
        if (res.data?.user) return {};
      } catch {
        // mutateAsync can throw on network errors
      }
      return { error: i18n.t("auth.login_failed") };
    },
    [loginMutation]
  );

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const refetchUser = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
  }, [queryClient]);

  const value: AuthContextValue = {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    refetch: refetchUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
