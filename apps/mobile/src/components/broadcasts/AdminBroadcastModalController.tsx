import React, { useEffect, useState, useCallback, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useActiveBroadcasts, useMarkBroadcastSeen } from "@/hooks/api/useBroadcasts";
import type { Broadcast } from "@/services/api/notifications";
import { useDeletedBroadcastIdsStore } from "@/stores/deletedBroadcastIdsStore";
import { BroadcastModal } from "./BroadcastModal";

/**
 * Option B: Show admin broadcasts only on app open or return from background.
 * - Seeds queue only from explicit mount refetch + AppState 'active' refetch. Never from realtime.
 * - Queue advances only when user dismisses (handleClose); we do NOT prune by broadcasts
 *   (mark-seen removes from active API → would auto-advance like a carousel).
 * - Realtime DELETE: store adds deleted id; we prune queue by those ids only, then consume.
 * - On show: fire-and-forget mark opened (dismissed: false).
 * - On dismiss: fire-and-forget mark dismissed (dismissed: true), then show next until queue empty.
 */
export function AdminBroadcastModalController() {
  const { refetch } = useActiveBroadcasts();
  const markSeen = useMarkBroadcastSeen();
  const deletedIds = useDeletedBroadcastIdsStore((s) => s.ids);
  const consumeDeleted = useDeletedBroadcastIdsStore((s) => s.consume);
  const [queue, setQueue] = useState<Broadcast[]>([]);
  const openedIdRef = useRef<string | null>(null);

  useEffect(() => {
    refetch().then(({ data }) => {
      setQueue(Array.isArray(data) ? data : []);
    });
  }, [refetch]);

  useEffect(() => {
    let prev: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener("change", (state) => {
      const wasBackground = prev === "background" || prev === "inactive";
      prev = state;
      if (state === "active" && wasBackground) {
        refetch().then(({ data }) => {
          setQueue((prevQueue) =>
            prevQueue.length === 0 ? (Array.isArray(data) ? data : []) : prevQueue
          );
        });
      }
    });
    return () => sub.remove();
  }, [refetch]);

  useEffect(() => {
    if (deletedIds.length === 0) return;
    const ids = new Set(deletedIds);
    setQueue((prev) => prev.filter((b) => !ids.has(b.id)));
    consumeDeleted();
  }, [deletedIds, consumeDeleted]);

  const current = queue[0] ?? null;
  const isVisible = !!current;

  useEffect(() => {
    if (!current) return;
    if (openedIdRef.current === current.id) return;
    openedIdRef.current = current.id;
    markSeen.mutate({ broadcastId: current.id, dismissed: false }, { onSettled: () => {} });
  }, [current?.id, markSeen]);

  const handleClose = useCallback(() => {
    if (!current) return;
    markSeen.mutate({ broadcastId: current.id, dismissed: true }, { onSettled: () => {} });
    openedIdRef.current = null;
    setQueue((prev) => prev.slice(1));
  }, [current, markSeen]);

  return <BroadcastModal visible={isVisible} broadcast={current} onClose={handleClose} />;
}
