/**
 * Realtime Context
 *
 * Provides Supabase Realtime functionality throughout the app.
 * Automatically starts/stops subscriptions based on auth state.
 * Handles app state changes to refresh data when returning from background.
 */

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { realtimeService } from "@/services/realtime/realtimeService";
import { useAuthStore } from "@/stores/authStore";
import { setLoggingOut, TokenManager } from "@/services/api/base";

// CONFIGURATION: Disable Realtime in local development if it's not working
// Set to false to skip Realtime subscriptions (app will still work via polling)
const ENABLE_REALTIME = process.env.EXPO_PUBLIC_ENABLE_REALTIME !== "false";

interface RealtimeContextType {
  isConnected: boolean;
  channelCount: number;
  reconnectAttempts: number;
  trackUserActivity: () => void;
}

const RealtimeContext = createContext<RealtimeContextType>({
  isConnected: false,
  channelCount: 0,
  reconnectAttempts: 0,
  trackUserActivity: () => {}
});

export const useRealtime = () => useContext(RealtimeContext);

interface RealtimeProviderProps {
  children: React.ReactNode;
}

export function RealtimeProvider({ children }: RealtimeProviderProps) {
  const queryClient = useQueryClient();
  const { isAuthenticated, user, isVerifyingUser } = useAuthStore();
  const [connectionStatus, setConnectionStatus] = useState({
    isConnected: false,
    channelCount: 0,
    reconnectAttempts: 0
  });
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    // Initialize Realtime service with QueryClient
    realtimeService.initialize(queryClient);
  }, [queryClient]);

  // Handle app state changes to refresh data when returning from background
  // NOTE: Realtime reconnection is now handled by the service itself (realtimeService.ts)
  // This effect only handles query invalidation for fresh data
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      // App coming back to foreground from background
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === "active" &&
        isAuthenticated &&
        user?.id
      ) {
        console.log(
          "[RealtimeContext] 📱 App returned to foreground, checking token and refreshing data..."
        );

        // Proactively refresh token if expiring soon
        // This ensures all subsequent API requests have a valid token
        await TokenManager.ensureValidToken();

        // Invalidate key queries to ensure fresh data
        // Realtime reconnection is handled by the service's AppState listener
        // These keys match the definitions in hooks/api/queryKeys.ts and other hook files

        // V2 Core data - only invalidate data that changes frequently
        // Don't invalidate dailyMotivations, weeklyRecaps, achievements - they rarely change
        // and already have proper staleTime/gcTime caching
        queryClient.invalidateQueries({ queryKey: ["goals"] }); // goalsQueryKeys.all
        queryClient.invalidateQueries({ queryKey: ["checkIns"] }); // checkInsQueryKeys.all
        queryClient.invalidateQueries({ queryKey: ["user"] }); // userQueryKeys
        queryClient.invalidateQueries({ queryKey: ["partners"] }); // partnersQueryKeys.all
        queryClient.invalidateQueries({ queryKey: ["nudges"] }); // nudgesQueryKeys.all
        queryClient.invalidateQueries({ queryKey: ["home"] }); // homeDashboardQueryKeys.all
        queryClient.invalidateQueries({ queryKey: ["notificationHistory"] }); // notificationHistoryQueryKeys.all
      }

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, user?.id, queryClient]);

  useEffect(() => {
    if (!ENABLE_REALTIME) {
      if (__DEV__) {
        console.log("[RealtimeContext] ⚠️ Realtime DISABLED (EXPO_PUBLIC_ENABLE_REALTIME=false)");
        console.log("[RealtimeContext] App will use polling for updates");
      }
      return;
    }

    // Only start Realtime if user is authenticated AND verification is complete
    if (isAuthenticated && user?.id && !isVerifyingUser) {
      // Reset logout flag (in case user logged back in after logout)
      setLoggingOut(false);

      // Add delay to allow Supabase client and tokens to fully initialize
      // This prevents race conditions where Realtime tries to connect before auth is ready
      const startupDelay = setTimeout(async () => {
        await realtimeService.start(user.id);
      }, 2000); // 2 second delay for initialization

      // Update connection status every 5 seconds
      const statusInterval = setInterval(() => {
        setConnectionStatus(realtimeService.getConnectionStatus());
      }, 5000);

      return () => {
        clearTimeout(startupDelay); // Cancel delayed startup if unmounting
        clearInterval(statusInterval);
        // Don't clear userId on cleanup - allows reconnection after background
        realtimeService.stop(false);
      };
    } else if (!isAuthenticated) {
      // User logged out - full cleanup including userId
      // This is the only time we should do full cleanup
      console.log("[RealtimeContext] 🚪 User logged out, full cleanup");
      realtimeService.cleanup();
    } else {
      // Still verifying or no user yet - just stop but keep state for potential reconnect
      // This prevents clearing queryClient/userId during the verification phase
      console.log("[RealtimeContext] ⏳ Auth in progress, stopping without cleanup");
      realtimeService.stop(false);
    }
  }, [isAuthenticated, user?.id, isVerifyingUser]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue: RealtimeContextType = {
    ...connectionStatus,
    trackUserActivity: () => realtimeService.trackUserActivity()
  };

  return <RealtimeContext.Provider value={contextValue}>{children}</RealtimeContext.Provider>;
}
