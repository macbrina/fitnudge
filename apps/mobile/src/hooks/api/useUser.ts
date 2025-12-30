import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userService, UpdateUserRequest, UserStats } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";

// Query Keys
export const userQueryKeys = {
  currentUser: ["user", "current"] as const,
  userById: (id: string) => ["user", id] as const,
  userStats: (id?: string) => ["user", "stats", id] as const,
  notificationSettings: ["user", "notification-settings"] as const,
} as const;

// Empty placeholder to prevent loading spinners - no longer needed since types conflict

// User Hooks
export const useCurrentUser = () => {
  return useQuery({
    queryKey: userQueryKeys.currentUser,
    queryFn: () => userService.getCurrentUser(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: false,
  });
};

export const useUserById = (userId: string) => {
  return useQuery({
    queryKey: userQueryKeys.userById(userId),
    queryFn: () => userService.getUserById(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: UpdateUserRequest) =>
      userService.updateProfile(updates),
    // Optimistic update for instant UI feedback
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: userQueryKeys.currentUser });

      const previousUser = queryClient.getQueryData(userQueryKeys.currentUser);

      // Optimistically update user
      queryClient.setQueryData(userQueryKeys.currentUser, (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: { ...old.data, ...updates } };
      });

      return { previousUser };
    },
    onError: (err, updates, context) => {
      if (context?.previousUser) {
        queryClient.setQueryData(
          userQueryKeys.currentUser,
          context.previousUser,
        );
      }
    },
    onSuccess: (response) => {
      // Update with real server response
      const realUser = response?.data;
      if (realUser) {
        queryClient.setQueryData(userQueryKeys.currentUser, (old: any) => ({
          ...old,
          data: realUser,
        }));
      }
    },
  });
};

export const useDeleteAccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => userService.deleteAccount(),
    onSuccess: () => {
      // Clear all data on account deletion
      queryClient.clear();
    },
  });
};

export const useExportData = () => {
  return useMutation({
    mutationFn: () => userService.exportData(),
  });
};

export const useUserStats = (userId?: string) => {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: userQueryKeys.userStats(userId),
    queryFn: () => userService.getUserStats(userId),
    enabled: isAuthenticated,
    staleTime: 0, // Refetch immediately when invalidated (realtime updates)
    refetchOnMount: false,
  });
};

export const useUpdatePassword = () => {
  return useMutation({
    mutationFn: ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string;
      newPassword: string;
    }) => userService.updatePassword(currentPassword, newPassword),
  });
};

export const useUploadProfilePicture = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (imageUri: string) =>
      userService.uploadProfilePicture(imageUri),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userQueryKeys.currentUser });
    },
  });
};

export const useDeleteProfilePicture = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => userService.deleteProfilePicture(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userQueryKeys.currentUser });
    },
  });
};

export const useNotificationSettings = () => {
  return useQuery({
    queryKey: userQueryKeys.notificationSettings,
    queryFn: () => userService.getNotificationSettings(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useUpdateNotificationSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: {
      email_notifications?: boolean;
      push_notifications?: boolean;
      motivation_reminders?: boolean;
      goal_reminders?: boolean;
      social_notifications?: boolean;
    }) => userService.updateNotificationSettings(settings),
    // Optimistic update for instant toggle feedback
    onMutate: async (newSettings) => {
      await queryClient.cancelQueries({
        queryKey: userQueryKeys.notificationSettings,
      });

      const previousSettings = queryClient.getQueryData(
        userQueryKeys.notificationSettings,
      );

      // Optimistically update settings
      queryClient.setQueryData(
        userQueryKeys.notificationSettings,
        (old: any) => {
          if (!old?.data) return old;
          return { ...old, data: { ...old.data, ...newSettings } };
        },
      );

      return { previousSettings };
    },
    onError: (err, newSettings, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(
          userQueryKeys.notificationSettings,
          context.previousSettings,
        );
      }
    },
  });
};
