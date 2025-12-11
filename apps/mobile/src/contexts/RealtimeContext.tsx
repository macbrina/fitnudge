/**
 * Realtime Context
 *
 * Provides Supabase Realtime functionality throughout the app.
 * Automatically starts/stops subscriptions based on auth state.
 * Handles app state changes to refresh data when returning from background.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { realtimeService } from "@/services/realtime/realtimeService";
import { useAuthStore } from "@/stores/authStore";
import { setLoggingOut } from "@/services/api/base";

// CONFIGURATION: Disable Realtime in local development if it's not working
// Set to false to skip Realtime subscriptions (app will still work via polling)
const ENABLE_REALTIME = process.env.EXPO_PUBLIC_ENABLE_REALTIME !== "false";

interface RealtimeContextType {
  isConnected: boolean;
  channelCount: number;
  reconnectAttempts: number;
}

const RealtimeContext = createContext<RealtimeContextType>({
  isConnected: false,
  channelCount: 0,
  reconnectAttempts: 0,
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
    reconnectAttempts: 0,
  });
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    // Initialize Realtime service with QueryClient
    realtimeService.initialize(queryClient);
  }, [queryClient]);

  // Handle app state changes to refresh data when returning from background
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // App coming back to foreground from background
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === "active" &&
        isAuthenticated
      ) {
        console.log(
          "[RealtimeContext] 📱 App returned to foreground, refreshing data..."
        );

        // Invalidate key queries to ensure fresh data
        // These will refetch immediately since we set staleTime: 0
        queryClient.invalidateQueries({ queryKey: ["checkIns"] });
        queryClient.invalidateQueries({ queryKey: ["user"] }); // All user queries including stats
        queryClient.invalidateQueries({ queryKey: ["progress"] }); // All progress queries
        queryClient.invalidateQueries({ queryKey: ["progress", "streak"] }); // Explicitly streak
        queryClient.invalidateQueries({ queryKey: ["progress", "mood"] }); // Explicitly mood trends
        queryClient.invalidateQueries({ queryKey: ["goals"] });
      }

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, queryClient]);

  useEffect(() => {
    if (!ENABLE_REALTIME) {
      if (__DEV__) {
        console.log(
          "[RealtimeContext] ⚠️ Realtime DISABLED (EXPO_PUBLIC_ENABLE_REALTIME=false)"
        );
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
      const startupDelay = setTimeout(() => {
        realtimeService.start(user.id);
      }, 2000); // 2 second delay for initialization

      // Update connection status every 5 seconds
      const statusInterval = setInterval(() => {
        setConnectionStatus(realtimeService.getConnectionStatus());
      }, 5000);

      return () => {
        clearTimeout(startupDelay); // Cancel delayed startup if unmounting
        clearInterval(statusInterval);
        realtimeService.stop();
      };
    } else {
      realtimeService.stop();
    }
  }, [isAuthenticated, user?.id, isVerifyingUser]);

  return (
    <RealtimeContext.Provider value={connectionStatus}>
      {children}
    </RealtimeContext.Provider>
  );
}
