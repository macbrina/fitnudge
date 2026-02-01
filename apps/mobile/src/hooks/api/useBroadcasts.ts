/**
 * Admin broadcast notifications (in-app modal, system tab)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsService, type Broadcast } from "@/services/api/notifications";

export const broadcastsQueryKeys = {
  all: ["broadcasts"] as const,
  active: () => [...broadcastsQueryKeys.all, "active"] as const
};

async function fetchActiveBroadcasts(): Promise<Broadcast[]> {
  const res = await notificationsService.getActiveBroadcasts();
  if (res.error || !res.data) throw new Error(res.message || "Failed to fetch broadcasts");
  return res.data;
}

export function useActiveBroadcasts() {
  return useQuery({
    queryKey: broadcastsQueryKeys.active(),
    queryFn: fetchActiveBroadcasts,
    staleTime: 60 * 1000,
    refetchOnMount: "always",
    retry: 1
  });
}

export function useMarkBroadcastSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ broadcastId, dismissed }: { broadcastId: string; dismissed?: boolean }) =>
      notificationsService.markBroadcastSeen(broadcastId, dismissed ?? false),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: broadcastsQueryKeys.all });
      qc.invalidateQueries({ queryKey: ["notificationHistory"] });
    }
  });
}
