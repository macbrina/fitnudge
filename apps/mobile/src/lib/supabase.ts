/**
 * Supabase Client Configuration
 *
 * Initializes the Supabase client for Realtime subscriptions.
 * Note: The mobile app uses the backend API for REST operations,
 * but uses Supabase client directly for Realtime features.
 */

// Polyfills for Supabase (must be first imports)
import "react-native-url-polyfill/auto";
import "expo-sqlite/localStorage/install"; // Required for Supabase localStorage

import { createClient } from "@supabase/supabase-js";
import { TokenManager } from "@/services/api/base";
import Constants from "expo-constants";

// Get environment variables with fallback to Constants.expoConfig.extra
// During development, Metro bundler embeds env vars from .env file
let supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL ||
  "";
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "";

// NOTE: DO NOT use JWT_SECRET on the client side!
// The anon key (above) is already a JWT signed with the secret.
// JWT_SECRET is a server-side secret and should NEVER be in client code.

// For React Native: Replace localhost with 127.0.0.1
// WebSocket connections work better with IP addresses on mobile
if (supabaseUrl.includes("localhost")) {
  const originalUrl = supabaseUrl;
  supabaseUrl = supabaseUrl.replace("localhost", "127.0.0.1");
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("[Supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY");
  console.warn("[Supabase] Realtime features will not work without valid credentials");
}

// Only create client if we have valid credentials
// This prevents "constructor is not callable" errors
let supabase: ReturnType<typeof createClient> | null = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // Use custom token storage via TokenManager
        storage: {
          getItem: async (key: string) => {
            if (key === "sb-access-token") {
              return await TokenManager.getAccessToken();
            }
            if (key === "sb-refresh-token") {
              return await TokenManager.getRefreshToken();
            }
            return null;
          },
          setItem: async (key: string, value: string) => {
            // Token management is handled by TokenManager
            // Supabase client will use tokens from TokenManager
            if (__DEV__) {
              console.log(`[Supabase] setItem called for ${key}`);
            }
          },
          removeItem: async (key: string) => {
            // Token removal is handled by TokenManager
            if (__DEV__) {
              console.log(`[Supabase] removeItem called for ${key}`);
            }
          }
        },
        // Don't auto-refresh sessions (handled by backend API)
        autoRefreshToken: false,
        // Don't persist session (handled by TokenManager)
        persistSession: false,
        // Detect session from URL (for OAuth redirects)
        detectSessionInUrl: false
      },
      realtime: {
        // Explicitly provide WebSocket for React Native
        // @ts-ignore - WebSocket is available globally in React Native
        constructor: WebSocket,
        // Realtime-specific configuration
        params: {
          eventsPerSecond: 10 // Rate limit for events
          // NOTE: DO NOT hardcode apikey here - it overrides the user's JWT token
          // After calling setSession(), Supabase uses the access_token for RLS
          // Hardcoding apikey here breaks RLS-filtered realtime events
        },
        // Log WebSocket events for debugging
        log_level: __DEV__ ? "info" : "error",
        // Heartbeat interval to keep connection alive
        heartbeatIntervalMs: 30000,
        // Reconnect settings
        reconnectAfterMs: (tries: number) => {
          return [1000, 2000, 5000, 10000][tries - 1] || 10000;
        }
      },
      global: {
        headers: {
          // Add custom headers for debugging
          "X-Client-Info": "fitnudge-mobile",
          // apikey header is used for authentication (anon key is a JWT)
          apikey: supabaseAnonKey
        }
      }
    });

    // Verify the client was created successfully
    if (!supabase || typeof supabase.channel !== "function") {
      console.error("[Supabase] ❌ Client initialization failed");
      supabase = null;
    }
  } catch (error) {
    console.error("[Supabase] ❌ Failed to create client:", error);
    supabase = null;
  }
} else {
  console.warn("[Supabase] ⚠️ Skipping client creation - missing credentials");
}

// Export a getter function that throws if client is not available
export { supabase };
