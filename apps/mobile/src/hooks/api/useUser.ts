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

// User Hooks
export const useCurrentUser = () => {
  return useQuery({
    queryKey: userQueryKeys.currentUser,
    queryFn: () => userService.getCurrentUser(),
    staleTime: 5 * 60 * 1000, // 5 minutes
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userQueryKeys.currentUser });
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
  return useQuery({
    queryKey: userQueryKeys.userStats(userId),
    queryFn: () => userService.getUserStats(userId),
    staleTime: 2 * 60 * 1000, // 2 minutes
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
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: userQueryKeys.notificationSettings,
      });
    },
  });
};
