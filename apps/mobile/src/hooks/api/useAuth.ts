import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authService, LoginRequest, SignupRequest } from "@/services/api";
import { AppleLoginPayload } from "@/services/api/auth";

// Query Keys
export const authQueryKeys = {
  isAuthenticated: ["auth", "isAuthenticated"] as const,
} as const;

// Auth Hooks
export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: LoginRequest) => authService.login(credentials),
    onSuccess: () => {
      // Invalidate user queries after successful login
      queryClient.invalidateQueries({ queryKey: ["user"] });
      queryClient.invalidateQueries({
        queryKey: authQueryKeys.isAuthenticated,
      });
    },
  });
};

export const useSignup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userData: SignupRequest) => authService.signup(userData),
    onSuccess: () => {
      // Invalidate user queries after successful signup
      queryClient.invalidateQueries({ queryKey: ["user"] });
      queryClient.invalidateQueries({
        queryKey: authQueryKeys.isAuthenticated,
      });
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      // Clear all cached data on logout
      queryClient.clear();
    },
  });
};

export const useRefreshToken = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authService.refreshToken(),
    onSuccess: () => {
      // Invalidate user queries after successful token refresh
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });
};

export const useForgotPassword = () => {
  return useMutation({
    mutationFn: ({ email }: { email: string }) =>
      authService.forgotPassword(email),
  });
};

export const useResetPassword = () => {
  return useMutation({
    mutationFn: ({
      token,
      new_password,
    }: {
      token: string;
      new_password: string;
    }) => authService.resetPassword(token, new_password),
  });
};

export const useChangePassword = () => {
  return useMutation({
    mutationFn: ({
      current_password,
      new_password,
    }: {
      current_password: string;
      new_password: string;
    }) => authService.changePassword(current_password, new_password),
  });
};

export const useVerifyEmail = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ code, email }: { code: string; email?: string }) =>
      authService.verifyEmail(code, email),
    onSuccess: () => {
      // Invalidate user queries after successful verification
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });
};

export const useResendVerification = () => {
  return useMutation({
    mutationFn: (email?: string) => authService.resendVerification(email),
  });
};

export const useLoginWithApple = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (appleToken: AppleLoginPayload) =>
      authService.loginWithApple(appleToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
      queryClient.invalidateQueries({
        queryKey: authQueryKeys.isAuthenticated,
      });
    },
  });
};

export const useLoginWithGoogle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (googleToken: string) =>
      authService.loginWithGoogle(googleToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
      queryClient.invalidateQueries({
        queryKey: authQueryKeys.isAuthenticated,
      });
    },
  });
};

// Utility Hooks
export const useIsAuthenticated = () => {
  return useQuery({
    queryKey: authQueryKeys.isAuthenticated,
    queryFn: () => authService.isAuthenticated(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
