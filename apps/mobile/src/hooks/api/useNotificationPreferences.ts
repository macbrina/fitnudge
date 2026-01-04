import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationService } from "@/services/notifications/notificationService";
import { NotificationPreferences } from "@/services/notifications/notificationTypes";

// Query keys for notification preferences
export const notificationPreferencesQueryKeys = {
  all: ["notification-preferences"] as const,
  preferences: () => [...notificationPreferencesQueryKeys.all, "preferences"] as const
};

/**
 * Hook to fetch notification preferences with React Query caching
 */
export function useNotificationPreferences() {
  return useQuery({
    queryKey: notificationPreferencesQueryKeys.preferences(),
    queryFn: async () => {
      const prefs = await notificationService.getNotificationPreferences();
      return prefs;
    },
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    gcTime: 1000 * 60 * 30 // Keep in cache for 30 minutes
  });
}

/**
 * Hook to update notification preferences with optimistic updates
 */
export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (preferences: NotificationPreferences) => {
      await notificationService.updateNotificationPreferences(preferences);
      return preferences;
    },
    onMutate: async (newPreferences) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: notificationPreferencesQueryKeys.preferences()
      });

      // Snapshot the previous value
      const previousPreferences = queryClient.getQueryData<NotificationPreferences>(
        notificationPreferencesQueryKeys.preferences()
      );

      // Optimistically update to the new value
      queryClient.setQueryData(notificationPreferencesQueryKeys.preferences(), newPreferences);

      // Return context with the previous value
      return { previousPreferences };
    },
    onError: (_error, _newPreferences, context) => {
      // Rollback to previous value on error
      if (context?.previousPreferences) {
        queryClient.setQueryData(
          notificationPreferencesQueryKeys.preferences(),
          context.previousPreferences
        );
      }
    },
    onSettled: () => {
      // Refetch after mutation settles (optional - we have optimistic updates)
      // queryClient.invalidateQueries({ queryKey: notificationPreferencesQueryKeys.preferences() });
    }
  });
}
