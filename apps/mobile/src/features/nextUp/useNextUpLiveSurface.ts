import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { useAuthStore } from "@/stores/authStore";
import { liveSurfaceManager } from "./LiveSurfaceManager";
import { msUntilNextLocalMidnight } from "./todayState";

/**
 * Keeps the "Next up" live surface in sync:
 * - when goals or today's check-ins load/update (including while in-app)
 * - on app resume (foreground)
 * - at local midnight rollover (no polling; single timer)
 *
 * Task-completion events also call liveSurfaceManager directly (see check-in hooks),
 * so updates are immediate even before refetch.
 */
export function useNextUpLiveSurface() {
  const { isAuthenticated, isVerifyingUser } = useAuthStore();
  const queryClient = useQueryClient();
  const midnightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update when goals or today's check-ins load/update (fixes: in-app updates, not just on foreground)
  useEffect(() => {
    if (!isAuthenticated || isVerifyingUser) return;

    const runUpdate = () => {
      liveSurfaceManager
        .updateFromQueryClient(queryClient)
        .catch((e) => console.warn("[NextUp] update failed:", e));
    };

    const unsub = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "updated") return;
      const key = event.query.queryKey;
      const isGoals = key[0] === "goals" && key[1] === "active";
      const isTodayCheckIns = key[0] === "checkIns" && key[1] === "today";
      if (isGoals || isTodayCheckIns) runUpdate();
    });

    // Initial run (data may already be cached from prefetch)
    runUpdate();

    return () => {
      unsub();
      // End Live Activity / ongoing notification when user logs out
      if (!useAuthStore.getState().isAuthenticated) {
        liveSurfaceManager.end().catch((e) => console.warn("[NextUp] end on logout failed:", e));
      }
    };
  }, [isAuthenticated, isVerifyingUser, queryClient]);

  // Foreground resume update (catches when returning from background with stale cache)
  useEffect(() => {
    if (!isAuthenticated || isVerifyingUser) return;

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        liveSurfaceManager
          .updateFromQueryClient(queryClient)
          .catch((e) => console.warn("[NextUp] update failed:", e));
      }
    });
    return () => sub.remove();
  }, [isAuthenticated, isVerifyingUser, queryClient]);

  // Local midnight rollover: end/recompute for new day.
  useEffect(() => {
    if (!isAuthenticated || isVerifyingUser) return;

    if (midnightTimerRef.current) clearTimeout(midnightTimerRef.current);

    const now = new Date();
    const ms = msUntilNextLocalMidnight(now) + 250; // small buffer after midnight

    midnightTimerRef.current = setTimeout(() => {
      // Recompute using current cached goals; data can be stale but selection rule stays deterministic.
      liveSurfaceManager
        .updateFromQueryClient(queryClient, new Date())
        .catch((e) => console.warn("[NextUp] midnight update failed:", e));
    }, ms);

    return () => {
      if (midnightTimerRef.current) clearTimeout(midnightTimerRef.current);
      midnightTimerRef.current = null;
    };
  }, [isAuthenticated, isVerifyingUser, queryClient]);
}
