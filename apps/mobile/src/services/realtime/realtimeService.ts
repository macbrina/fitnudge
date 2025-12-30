/**
 * Supabase Realtime Service
 *
 * Manages real-time subscriptions for instant data updates across the app.
 * Handles automatic React Query cache invalidation and connection management.
 *
 * Critical Features:
 * - Force logout on user status changes (banned/suspended)
 * - Auto-invalidate React Query cache on table changes
 * - Exponential backoff reconnection strategy
 * - Memory leak prevention via proper cleanup
 */

import { supabase } from "@/lib/supabase";
import { QueryClient } from "@tanstack/react-query";
import { AppState, AppStateStatus } from "react-native";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  REALTIME_SUBSCRIBE_STATES,
} from "@supabase/supabase-js";
import { logger } from "@/services/logger";
import { handleAutoLogout } from "@/utils/authUtils";
import { useAuthStore } from "@/stores/authStore";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { TokenManager } from "@/services/api/base";
import { achievementsQueryKeys } from "@/hooks/api/useAchievements";
import {
  challengesQueryKeys,
  goalsQueryKeys,
  checkInsQueryKeys,
  actionablePlansQueryKeys,
  partnersQueryKeys,
  nudgesQueryKeys,
  challengeInvitesQueryKeys,
} from "@/hooks/api/queryKeys";
import { notificationHistoryQueryKeys } from "@/hooks/api/useNotificationHistory";
import { dailyMotivationsQueryKeys } from "@/hooks/api/useDailyMotivations";
import { socialQueryKeys } from "@/hooks/api/useSocial";
import { homeDashboardQueryKeys } from "@/hooks/api/useHomeDashboard";
import { trackingStatsQueryKeys } from "@/hooks/api/useTrackingStats";
import { hydrationLogsQueryKeys } from "@/hooks/api/useHydrationLogs";
import { mealLogsQueryKeys } from "@/hooks/api/useMealLogs";
import { progressQueryKeys } from "@/hooks/api/useProgressData";
import type { ChallengeCheckIn } from "@/services/api/challenges";

// Realtime-enabled tables (22 total)
// NOTE: Cache updates are handled by mutations in hooks (useGoals.ts, useCheckIns.ts, etc.)
// Realtime is kept for: 1) User status changes (security), 2) External sync (admin, DB changes)
const REALTIME_TABLES = [
  // Security
  "users",
  // Core
  "check_ins",
  "goals",
  "actionable_plans",
  "daily_motivations",
  // Subscriptions (RevenueCat webhook updates)
  "subscriptions",
  // Notifications
  "motivations",
  "notification_history",
  // Meal & Hydration Tracking
  "meal_logs",
  "daily_nutrition_summaries",
  "hydration_logs",
  "daily_hydration_summaries",
  // Check-in & Workout Summaries (trigger-maintained)
  "daily_checkin_summaries",
  "daily_workout_summaries",
  // User Stats Cache (trigger-maintained, single row per user)
  "user_stats_cache",
  // Goal Statistics (trigger-maintained, per-goal streak/stats)
  "goal_statistics",
  // Challenge Statistics (trigger-maintained, per-participant challenge stats)
  "challenge_statistics",
  // Gamification
  "achievement_types",
  "user_achievements",
  "accountability_partners",
  // Challenges
  "challenges",
  "challenge_participants",
  "challenge_leaderboard",
  "challenge_check_ins",
  "challenge_invites",
  // Social (already enabled)
  "posts",
  "comments",
  "likes",
  "follows",
  // Social nudges (partner nudges, cheers, etc.)
  "social_nudges",
] as const;

type RealtimeTable = (typeof REALTIME_TABLES)[number];

/**
 * Mapping from table names to their base query keys for generic cache invalidation
 * Used for UPDATE and DELETE events from admin/external sources
 *
 * IMPORTANT: These must match the actual query keys used by the hooks!
 * - Summary tables (daily_*_summaries) update tracking-stats queries
 * - Log tables (meal_logs, hydration_logs) update their respective hooks
 */
const TABLE_QUERY_KEY_MAP: Record<RealtimeTable, readonly string[]> = {
  // Security
  users: ["user"],
  // Core
  check_ins: checkInsQueryKeys.all,
  goals: goalsQueryKeys.all,
  actionable_plans: actionablePlansQueryKeys.all,
  daily_motivations: dailyMotivationsQueryKeys.all,
  // Subscriptions
  subscriptions: ["subscriptions"],
  // Notifications
  motivations: ["motivations"],
  notification_history: notificationHistoryQueryKeys.all,
  // Meal & Hydration Tracking - use actual hook query keys!
  meal_logs: mealLogsQueryKeys.all,
  daily_nutrition_summaries: trackingStatsQueryKeys.all, // Used by useTrackingStats
  hydration_logs: hydrationLogsQueryKeys.all,
  daily_hydration_summaries: trackingStatsQueryKeys.all, // Used by useTrackingStats
  // Check-in & Workout Summaries (trigger-maintained) - use tracking-stats!
  daily_checkin_summaries: trackingStatsQueryKeys.all,
  daily_workout_summaries: trackingStatsQueryKeys.all, // Used by WorkoutProgressStats
  // User Stats Cache (trigger-maintained)
  user_stats_cache: ["userStatsCache"],
  // Goal Statistics (trigger-maintained, per-goal streak/stats)
  goal_statistics: progressQueryKeys.all, // Used by useStreakInfo, useHabitChain
  // Challenge Statistics (trigger-maintained, per-participant challenge stats)
  challenge_statistics: challengesQueryKeys.all, // Used by challenge leaderboards, progress
  // Gamification
  achievement_types: achievementsQueryKeys.all,
  user_achievements: achievementsQueryKeys.all,
  accountability_partners: partnersQueryKeys.all,
  // Challenges
  challenges: challengesQueryKeys.all,
  challenge_participants: challengesQueryKeys.all,
  challenge_leaderboard: challengesQueryKeys.all,
  challenge_check_ins: challengesQueryKeys.all,
  challenge_invites: challengeInvitesQueryKeys.all,
  // Social
  posts: socialQueryKeys.posts.all,
  comments: ["social", "comments"],
  likes: ["social", "likes"],
  follows: ["social", "follows"],
  // Social nudges (partner nudges, cheers, etc.)
  social_nudges: nudgesQueryKeys.all,
};

class RealtimeService {
  private queryClient: QueryClient | null = null;
  private channels: Map<string, RealtimeChannel> = new Map();
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private failedTables: Set<string> = new Set();
  private successfulTables: Set<string> = new Set();

  // App state and connection management
  private currentUserId: string | null = null;
  private appStateSubscription: { remove: () => void } | null = null;
  private lastAppState: AppStateStatus = "active";
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastHeartbeat: number = Date.now();
  private readonly HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
  private readonly STALE_CONNECTION_THRESHOLD_MS = 60000; // 1 minute

  /**
   * Initialize the Realtime service with a React Query client
   */
  initialize(queryClient: QueryClient) {
    this.queryClient = queryClient;
    this.setupAppStateListener();
  }

  /**
   * Setup AppState listener to handle app backgrounding/foregrounding
   * This is CRITICAL for React Native - OS suspends WebSocket when app goes to background
   */
  private setupAppStateListener() {
    // Remove existing subscription if any
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }

    this.appStateSubscription = AppState.addEventListener(
      "change",
      this.handleAppStateChange.bind(this),
    );

    console.log("[Realtime] 📱 AppState listener initialized");
  }

  /**
   * Handle app state changes (foreground/background)
   * When app comes to foreground, check connection health and reconnect if needed
   */
  private async handleAppStateChange(nextAppState: AppStateStatus) {
    const previousState = this.lastAppState;
    this.lastAppState = nextAppState;

    // Only act when transitioning TO active (foreground)
    if (nextAppState === "active" && previousState !== "active") {
      console.log(
        `[Realtime] 📱 App came to foreground (was: ${previousState})`,
      );

      // Check if we have a user and should be connected
      if (this.currentUserId) {
        // Check connection health
        const isHealthy = await this.checkConnectionHealth();

        if (!isHealthy) {
          console.log(
            "[Realtime] 🔄 Connection unhealthy after foreground, reconnecting...",
          );
          await this.reconnectAfterBackground();
        } else {
          console.log("[Realtime] ✅ Connection healthy after foreground");
          // Refresh auth session to ensure RLS works
          await this.refreshAuth();
        }
      }
    } else if (nextAppState === "background") {
      console.log("[Realtime] 📱 App went to background");
      // Record timestamp for stale connection detection
      this.lastHeartbeat = Date.now();
    }
  }

  /**
   * Check if the realtime connection is healthy
   * Returns false if connection appears stale or broken
   */
  private async checkConnectionHealth(): Promise<boolean> {
    // If we have no channels, connection is not healthy
    if (this.channels.size === 0) {
      return false;
    }

    // Check if any channels are in "joined" state
    let joinedCount = 0;
    for (const channel of this.channels.values()) {
      if (channel.state === "joined") {
        joinedCount++;
      }
    }

    // If less than half the channels are joined, consider unhealthy
    const healthyThreshold = Math.ceil(this.channels.size / 2);
    if (joinedCount < healthyThreshold) {
      console.log(
        `[Realtime] ⚠️ Only ${joinedCount}/${this.channels.size} channels joined`,
      );
      return false;
    }

    // Check if connection has been stale (no heartbeat for too long)
    const timeSinceHeartbeat = Date.now() - this.lastHeartbeat;
    if (timeSinceHeartbeat > this.STALE_CONNECTION_THRESHOLD_MS) {
      console.log(
        `[Realtime] ⚠️ Connection stale: ${Math.round(timeSinceHeartbeat / 1000)}s since last heartbeat`,
      );
      return false;
    }

    return true;
  }

  /**
   * Reconnect after app comes back from background
   * More aggressive than normal reconnect - assumes connection is likely broken
   */
  private async reconnectAfterBackground() {
    if (!this.currentUserId) return;

    console.log("[Realtime] 🔄 Reconnecting after background...");

    // Stop all existing connections
    await this.stop();

    // Small delay to ensure cleanup
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Restart with fresh connections
    await this.start(this.currentUserId);
  }

  /**
   * Start heartbeat to detect stale connections
   * Supabase client handles ping/pong internally, but we track our own heartbeat
   * to detect when the connection has gone stale (e.g., after long background)
   */
  private startHeartbeat() {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      this.lastHeartbeat = Date.now();

      // Check channel health periodically
      let activeChannels = 0;
      for (const channel of this.channels.values()) {
        if (channel.state === "joined") {
          activeChannels++;
        }
      }

      if (__DEV__ && activeChannels < this.channels.size) {
        console.log(
          `[Realtime] 💓 Heartbeat: ${activeChannels}/${this.channels.size} channels active`,
        );
      }

      // If all channels have disconnected, attempt reconnect
      if (
        activeChannels === 0 &&
        this.channels.size > 0 &&
        this.currentUserId
      ) {
        console.log(
          "[Realtime] 💔 All channels disconnected, attempting reconnect...",
        );
        this.reconnectAfterBackground();
      }
    }, this.HEARTBEAT_INTERVAL_MS);

    console.log("[Realtime] 💓 Heartbeat started");
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Helper to invalidate and refetch all partner dashboard queries
   * Uses predicate to match any ["partners", "dashboard", partnerUserId] query
   */
  private invalidatePartnerDashboards(forceRefetch: boolean = true) {
    if (!this.queryClient) return;

    // Invalidate all partner dashboard queries
    this.queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        query.queryKey[0] === "partners" &&
        query.queryKey[1] === "dashboard",
    });

    // Force immediate refetch if requested
    if (forceRefetch) {
      this.queryClient.refetchQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "partners" &&
          query.queryKey[1] === "dashboard",
        type: "active",
      });
    }
  }

  /**
   * Start all Realtime subscriptions with retry logic
   */
  async start(userId: string, retryCount: number = 0): Promise<void> {
    const MAX_START_RETRIES = 3;
    const RETRY_DELAY_MS = 2000; // 2 seconds base delay

    if (!this.queryClient) {
      console.error("[Realtime] Cannot start - QueryClient not initialized");
      return;
    }

    // Store userId for reconnection after background
    this.currentUserId = userId;

    if (this.isConnected) {
      return;
    }

    // Set the user's session on Supabase client for RLS to work with Realtime
    // This ensures auth.uid() returns the correct user ID for INSERT/UPDATE events
    // CRITICAL: This MUST be called BEFORE subscribing to channels
    try {
      const accessToken = await TokenManager.getAccessToken();
      const refreshToken = await TokenManager.getRefreshToken();

      if (accessToken && supabase) {
        // Decode JWT payload (without verification) for debugging
        try {
          const parts = accessToken.split(".");
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            console.log(
              `[Realtime] 🔑 Setting session for user: ${payload.sub?.substring(0, 8)}...`,
            );
          }
        } catch (decodeErr) {
          console.warn(
            "[Realtime]   - Failed to decode JWT payload:",
            decodeErr,
          );
        }

        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || "",
        });

        if (error) {
          console.error("[Realtime] ❌ Failed to set session:", error.message);
          // Without a valid session, RLS won't work - user won't receive their events
          console.warn(
            "[Realtime] ⚠️ Continuing without session - realtime events may not work for this user",
          );
        } else {
          console.log("[Realtime] ✅ Session set successfully for RLS");
        }
      } else {
        console.warn(
          "[Realtime] ⚠️ No access token available - realtime RLS filtering won't work",
        );
      }
    } catch (error) {
      console.error(
        "[Realtime] ❌ Session setup error:",
        error instanceof Error ? error.message : error,
      );
    }

    // Reset tracking
    this.failedTables.clear();
    this.successfulTables.clear();

    // Subscribe to all Realtime-enabled tables
    const subscriptionPromises = REALTIME_TABLES.map((table) =>
      this.subscribeToTable(table, userId),
    );
    await Promise.allSettled(subscriptionPromises);

    // Wait a bit for subscription status to settle
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Identify tables that are still pending (not successful, not failed)
    // These are tables where subscription didn't respond in time
    for (const table of REALTIME_TABLES) {
      if (!this.successfulTables.has(table) && !this.failedTables.has(table)) {
        // Table is stuck in pending state - mark as failed so we retry it
        this.failedTables.add(table);
      }
    }

    // Log concise summary and handle retries
    if (this.successfulTables.size === REALTIME_TABLES.length) {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.startHeartbeat(); // Start heartbeat to detect stale connections
      console.log(
        `[Realtime] ✅ Connected: ${this.successfulTables.size}/${REALTIME_TABLES.length} tables`,
      );
    } else if (this.successfulTables.size > 0) {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.startHeartbeat(); // Start heartbeat even for partial connections
      console.log(
        `[Realtime] ⚠️ Partial: ${this.successfulTables.size}/${REALTIME_TABLES.length} tables`,
      );
      console.log(
        `   Failed/Pending: ${Array.from(this.failedTables).join(", ")}`,
      );

      // Schedule retry for failed/pending tables
      if (this.failedTables.size > 0) {
        this.schedulePartialRetry(userId);
      }
    } else {
      // No tables connected - retry with exponential backoff
      if (retryCount < MAX_START_RETRIES) {
        const delay = RETRY_DELAY_MS * 2 ** retryCount;
        console.warn(
          `[Realtime] ⚠️ Failed to connect, retrying in ${delay / 1000}s... (attempt ${retryCount + 1}/${MAX_START_RETRIES})`,
        );

        // Clear any failed channels before retry
        await this.stop();

        // Wait and retry
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.start(userId, retryCount + 1);
      } else {
        console.error(
          `[Realtime] ❌ Failed after ${MAX_START_RETRIES} retries: 0/${REALTIME_TABLES.length} tables - Check connection`,
        );
        // Schedule a background reconnect attempt
        this.scheduleReconnect(userId);
      }
    }
  }

  /**
   * Schedule a background reconnect attempt after initial failures
   * Uses longer delays since this is after immediate retries failed
   */
  private scheduleReconnect(userId: string) {
    const BACKGROUND_RETRY_DELAY = 30000; // 30 seconds

    console.log(
      `[Realtime] 🔄 Scheduling background reconnect in ${BACKGROUND_RETRY_DELAY / 1000}s...`,
    );

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(async () => {
      console.log("[Realtime] 🔄 Attempting background reconnect...");
      await this.stop();
      await this.start(userId, 0); // Reset retry count for fresh attempt
    }, BACKGROUND_RETRY_DELAY);
  }

  /**
   * Schedule retry for only failed tables (partial connection scenario)
   * Uses shorter delay since most tables are already connected
   */
  private partialRetryTimeout: NodeJS.Timeout | null = null;
  private partialRetryAttempts = 0;
  private readonly MAX_PARTIAL_RETRIES = 3;

  private schedulePartialRetry(userId: string) {
    const PARTIAL_RETRY_DELAY = 5000; // 5 seconds

    if (this.partialRetryAttempts >= this.MAX_PARTIAL_RETRIES) {
      console.log(
        `[Realtime] ⚠️ Max partial retries (${this.MAX_PARTIAL_RETRIES}) reached for failed tables`,
      );
      return;
    }

    console.log(
      `[Realtime] 🔄 Retrying failed tables in ${PARTIAL_RETRY_DELAY / 1000}s... (attempt ${this.partialRetryAttempts + 1}/${this.MAX_PARTIAL_RETRIES})`,
    );

    if (this.partialRetryTimeout) {
      clearTimeout(this.partialRetryTimeout);
    }

    this.partialRetryTimeout = setTimeout(async () => {
      this.partialRetryAttempts++;

      // Get list of failed tables to retry
      const failedTablesList = Array.from(this.failedTables) as RealtimeTable[];

      if (failedTablesList.length === 0) {
        console.log("[Realtime] ✅ All tables now connected");
        this.partialRetryAttempts = 0;
        return;
      }

      console.log(
        `[Realtime] 🔄 Retrying ${failedTablesList.length} failed tables: ${failedTablesList.slice(0, 5).join(", ")}${failedTablesList.length > 5 ? "..." : ""}`,
      );

      // Remove from failed set before retrying (will be re-added if fails again)
      for (const table of failedTablesList) {
        this.failedTables.delete(table);
      }

      // Try to subscribe to each failed table
      const retryPromises = failedTablesList.map((table) =>
        this.subscribeToTable(table, userId).catch(() => {
          // Error logged in subscribeToTable
        }),
      );
      await Promise.allSettled(retryPromises);

      // Wait for subscription status to settle
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Re-check which tables are still not connected
      for (const table of failedTablesList) {
        if (!this.successfulTables.has(table)) {
          this.failedTables.add(table);
        }
      }

      // Check if still have failed tables
      if (this.failedTables.size > 0) {
        console.log(
          `[Realtime] ⚠️ Still ${this.failedTables.size} pending: ${Array.from(this.failedTables).slice(0, 5).join(", ")}${this.failedTables.size > 5 ? "..." : ""}`,
        );
        // Schedule another retry if under max
        if (this.partialRetryAttempts < this.MAX_PARTIAL_RETRIES) {
          this.schedulePartialRetry(userId);
        } else {
          console.log(
            `[Realtime] ⚠️ Max retries reached. Connected: ${this.successfulTables.size}/${REALTIME_TABLES.length} tables`,
          );
        }
      } else {
        console.log(
          `[Realtime] ✅ All ${REALTIME_TABLES.length} tables now connected`,
        );
        this.partialRetryAttempts = 0;
      }
    }, PARTIAL_RETRY_DELAY);
  }

  /**
   * Refresh the auth session on Supabase client
   * Call this after token refresh to ensure RLS continues to work
   */
  async refreshAuth() {
    try {
      const accessToken = await TokenManager.getAccessToken();
      const refreshToken = await TokenManager.getRefreshToken();

      if (accessToken && supabase) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || "",
        });
        console.log("[Realtime] 🔄 Refreshed Supabase auth session");
      }
    } catch (error) {
      console.warn("[Realtime] Failed to refresh auth session:", error);
    }
  }

  /**
   * Subscribe to a single table's changes
   */
  private async subscribeToTable(table: RealtimeTable, userId: string) {
    const channelName = `${table}_changes_${userId}`;

    // Skip if already subscribed - but update tracking to reflect success
    if (this.channels.has(channelName)) {
      // Table is actually connected, update tracking
      this.failedTables.delete(table);
      this.successfulTables.add(table);
      console.log(`[Realtime] Already subscribed to ${table}`);
      return;
    }

    try {
      // Verify Supabase client is initialized
      if (!supabase) {
        this.failedTables.add(table);
        console.error(
          `[Realtime] ❌ Cannot subscribe to ${table}: Supabase client is not initialized.\n` +
            `   Check that EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set.`,
        );
        return;
      }

      // Verify channel method exists
      if (typeof supabase.channel !== "function") {
        this.failedTables.add(table);
        const clientType = typeof supabase;
        const clientKeys = supabase
          ? Object.keys(supabase).slice(0, 10).join(", ")
          : "N/A";
        const channelType = typeof supabase.channel;
        console.error(
          `[Realtime] ❌ Cannot subscribe to ${table}: supabase.channel is not a function.\n` +
            `   Client type: ${clientType}\n` +
            `   Channel type: ${channelType}\n` +
            `   Available keys: ${clientKeys}...\n` +
            `   This usually means the Supabase client wasn't initialized correctly.`,
        );
        return;
      }

      const channel = supabase.channel(channelName, {
        config: {
          broadcast: { self: true },
          presence: { key: userId },
        },
      });

      // Listen for postgres changes
      // IMPORTANT: No filters on subscription (filter in handler instead)
      // Realtime filters don't work reliably for DELETE events
      channel
        .on(
          "postgres_changes",
          {
            event: "*", // Listen to INSERT, UPDATE, DELETE
            schema: "public",
            table: table,
            // No filter here - we filter in the handler
          },
          (payload: RealtimePostgresChangesPayload<any>) => {
            // NO CLIENT-SIDE FILTERING NEEDED!
            // Backend RLS already ensures users only receive/modify their own data
            // With RLS enabled, even REPLICA IDENTITY FULL doesn't include user_id in DELETE events
            // So we trust the backend and process all events we receive
            this.handleTableChange(table, payload);
          },
        )
        .subscribe((status: `${REALTIME_SUBSCRIBE_STATES}`, err?: any) => {
          if (status === "SUBSCRIBED") {
            this.successfulTables.add(table);
            // Reset reconnect attempts on successful subscription
            this.reconnectAttempts = 0;
          } else if (status === "CHANNEL_ERROR") {
            this.failedTables.add(table);
          } else if (status === "TIMED_OUT") {
            this.failedTables.add(table);
          } else if (status === "CLOSED") {
            this.failedTables.add(table);
          }
        });

      this.channels.set(channelName, channel);
    } catch (error) {
      console.error(
        `[Realtime] Failed to subscribe to ${table}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  // Tables with specific handlers - skip generic handler for these
  private static TABLES_WITH_SPECIFIC_HANDLERS: Set<RealtimeTable> = new Set([
    "users",
    "user_achievements",
    "subscriptions",
    "challenge_check_ins",
    "challenge_participants",
    "challenge_leaderboard",
    "challenges",
    "user_stats_cache",
    // Goal statistics (per-goal streak/stats cache)
    "goal_statistics",
    // Challenge statistics (per-participant challenge stats cache)
    "challenge_statistics",
    // Summary tables have specific handlers for proper cache invalidation
    "daily_workout_summaries",
    "daily_nutrition_summaries",
    "daily_hydration_summaries",
    "daily_checkin_summaries",
    // Accountability partners - smart cache updates to avoid duplicates/flashes
    "accountability_partners",
    // Notification history - instant UI updates for new notifications
    "notification_history",
    // Social nudges - partner activity updates
    "social_nudges",
  ]);

  /**
   * Handle table change events
   *
   * NOTE: We no longer do optimistic cache updates here.
   * Mutations in useGoals.ts, useCheckIns.ts etc. handle instant UI feedback.
   * Realtime is kept for:
   * 1. CRITICAL: User status changes (ban/suspend) - security
   * 2. External changes from admin panel, other devices, backend tasks, etc.
   */
  private async handleTableChange(
    table: RealtimeTable,
    payload: RealtimePostgresChangesPayload<any>,
  ) {
    // Log changes (minimal for performance)
    if (__DEV__) {
      // Some tables use user_id as primary key (e.g., user_stats_cache)
      const newData = payload.new as any;
      const oldData = payload.old as any;
      const identifier =
        newData?.id ||
        oldData?.id ||
        newData?.user_id ||
        oldData?.user_id ||
        "N/A";
      console.log(`[Realtime] 📡 ${table} ${payload.eventType}`, {
        id: identifier,
      });
    }

    // CRITICAL: Handle user status changes (ban/suspend/delete)
    if (
      table === "users" &&
      (payload.eventType === "UPDATE" || payload.eventType === "DELETE")
    ) {
      await this.handleUserStatusChange(payload);
      return; // Specific handler fully handles this
    }

    // Handle new achievements (unlocked via backend/Celery tasks)
    if (table === "user_achievements" && payload.eventType === "INSERT") {
      this.handleNewAchievement(payload);
      return; // Specific handler fully handles this
    }

    // Handle subscription changes (RevenueCat webhook updates)
    if (table === "subscriptions") {
      this.handleSubscriptionChange(payload);
      return; // Specific handler fully handles this
    }

    // Handle challenge check-ins (external changes from admin/DB/tasks)
    if (table === "challenge_check_ins") {
      this.handleChallengeCheckInsChange(payload);
      return; // Specific handler fully handles this
    }

    // Handle challenge participants changes (points, progress updates)
    if (table === "challenge_participants") {
      this.handleChallengeParticipantsChange(payload);
      return; // Specific handler fully handles this
    }

    // Handle challenge leaderboard changes
    if (table === "challenge_leaderboard") {
      this.handleChallengeLeaderboardChange(payload);
      return; // Specific handler fully handles this
    }

    // Handle challenges table changes (for main challenge data)
    if (table === "challenges") {
      this.handleChallengesChange(payload);
      return; // Specific handler fully handles this
    }

    // Handle user_stats_cache changes (trigger-maintained)
    // This is updated by DB triggers when check-ins, goals, etc. change
    if (table === "user_stats_cache") {
      this.handleUserStatsCacheChange(payload);
      return; // Specific handler fully handles this
    }

    // Handle goal_statistics changes (trigger-maintained per-goal stats)
    // This is updated by DB triggers when check-ins for a goal change
    if (table === "goal_statistics") {
      this.handleGoalStatisticsChange(payload);
      return; // Specific handler fully handles this
    }

    // Handle challenge_statistics changes (trigger-maintained per-participant challenge stats)
    // This is updated by DB triggers when challenge_check_ins change
    if (table === "challenge_statistics") {
      this.handleChallengeStatisticsChange(payload);
      return; // Specific handler fully handles this
    }

    // Handle accountability_partners changes (smart cache updates)
    if (table === "accountability_partners") {
      this.handleAccountabilityPartnersChange(payload);
      return; // Specific handler fully handles this
    }

    // Handle notification_history changes (new notifications)
    if (table === "notification_history") {
      this.handleNotificationHistoryChange(payload);
      return; // Specific handler fully handles this
    }

    // Handle social_nudges changes (partner activity)
    if (table === "social_nudges") {
      this.handleSocialNudgesChange(payload);
      return; // Specific handler fully handles this
    }

    // Handle summary table changes - invalidate both tracking-stats AND progress queries
    if (
      table === "daily_workout_summaries" ||
      table === "daily_nutrition_summaries" ||
      table === "daily_hydration_summaries" ||
      table === "daily_checkin_summaries"
    ) {
      this.handleSummaryTableChange(table, payload);
      return; // Specific handler fully handles this
    }

    // Generic handler for all OTHER tables without specific handlers
    this.handleGenericTableChange(table, payload);
  }

  /**
   * Generic handler for UPDATE and DELETE events on all tables
   * This catches admin/external changes that don't have specific handlers above
   *
   * - DELETE: Invalidate queries (only id is available)
   * - UPDATE: Try to update cache optimistically, then invalidate for fresh data
   */
  private handleGenericTableChange(
    table: RealtimeTable,
    payload: RealtimePostgresChangesPayload<any>,
  ) {
    if (!this.queryClient) return;

    const oldRecord = payload.old as any;
    const newRecord = payload.new as any;
    const baseQueryKey = TABLE_QUERY_KEY_MAP[table];

    if (!baseQueryKey) {
      console.warn(`[Realtime] No query key mapping for table: ${table}`);
      return;
    }

    if (payload.eventType === "DELETE") {
      // DELETE: Only id is available, invalidate queries to refetch
      console.log(
        `[Realtime] 🗑️ DELETE on ${table}, invalidating queries:`,
        baseQueryKey,
      );
      this.queryClient.invalidateQueries({
        queryKey: baseQueryKey,
      });

      // Invalidate AND refetch home dashboard since it aggregates data
      console.log(
        `[Realtime] 🏠 Invalidating home dashboard for ${table} DELETE`,
      );
      this.queryClient.invalidateQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
      });
      // Force refetch to ensure UI updates immediately
      this.queryClient.refetchQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
        type: "active",
      });

      // Invalidate partner dashboards for tables that affect partner view
      if (
        table === "goals" ||
        table === "check_ins" ||
        table === "actionable_plans" ||
        table === "challenges" ||
        table === "challenge_check_ins" ||
        table === "challenge_participants"
      ) {
        this.invalidatePartnerDashboards();
      }
    } else if (payload.eventType === "UPDATE") {
      // UPDATE: Full record available, try optimistic update then invalidate
      console.log(
        `[Realtime] ✏️ UPDATE on ${table}, updating cache:`,
        newRecord?.id,
      );

      // For list queries, try to update the item in place
      this.queryClient.setQueriesData(
        { queryKey: baseQueryKey },
        (oldData: any) => {
          if (!oldData) return oldData;

          // Handle array data (list queries)
          if (Array.isArray(oldData)) {
            const index = oldData.findIndex(
              (item: any) => item?.id === newRecord?.id,
            );
            if (index !== -1) {
              const updated = [...oldData];
              updated[index] = { ...updated[index], ...newRecord };
              return updated;
            }
          }

          // Handle { data: [...] } format
          if (oldData?.data && Array.isArray(oldData.data)) {
            const index = oldData.data.findIndex(
              (item: any) => item?.id === newRecord?.id,
            );
            if (index !== -1) {
              const updatedData = [...oldData.data];
              updatedData[index] = { ...updatedData[index], ...newRecord };
              return { ...oldData, data: updatedData };
            }
          }

          // Handle single object (detail queries)
          if (oldData?.id === newRecord?.id) {
            return { ...oldData, ...newRecord };
          }

          return oldData;
        },
      );

      // Also invalidate to ensure computed fields are fresh
      this.queryClient.invalidateQueries({
        queryKey: baseQueryKey,
      });

      // Invalidate AND refetch home dashboard for aggregate updates
      // Important for: goal archived, status changes, etc.
      console.log(
        `[Realtime] 🏠 Invalidating home dashboard for ${table} UPDATE`,
      );
      this.queryClient.invalidateQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
      });
      // Force refetch to ensure UI updates immediately
      this.queryClient.refetchQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
        type: "active", // Only refetch if query is currently active (component mounted)
      });

      // Invalidate partner dashboards for tables that affect partner view
      // Partners see goal/challenge summaries, so updates should refresh their view
      if (
        table === "goals" ||
        table === "check_ins" ||
        table === "actionable_plans" ||
        table === "challenges" ||
        table === "challenge_check_ins" ||
        table === "challenge_participants"
      ) {
        console.log(
          `[Realtime] 👥 Invalidating partner dashboards for ${table} UPDATE`,
        );
        this.invalidatePartnerDashboards();
      }
    } else if (payload.eventType === "INSERT") {
      // INSERT: Only invalidate queries - don't add to cache directly
      //
      // Why? Mutations handle optimistic updates for user-created data.
      // Adding here causes duplicates when mutation and realtime race:
      // 1. Mutation adds goal with temp-ID optimistically
      // 2. Realtime fires INSERT with real ID (temp-ID not found, so it adds)
      // 3. Mutation succeeds, replaces temp-ID with real ID
      // 4. Result: Two goals with same real ID!
      //
      // Invalidation is safer - it triggers a refetch which dedupes naturally.
      // External inserts (admin, backend tasks) will be picked up on refetch.

      if (__DEV__) {
        console.log(
          `[Realtime] ➕ INSERT on ${table}: invalidating queries (id: ${newRecord?.id})`,
        );
      }

      // Invalidate to trigger refetch with fresh data
      this.queryClient.invalidateQueries({
        queryKey: baseQueryKey,
      });

      // Invalidate AND refetch home dashboard for new items
      console.log(
        `[Realtime] 🏠 Invalidating home dashboard for ${table} INSERT`,
      );
      this.queryClient.invalidateQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
      });
      // Force refetch to ensure UI updates immediately
      this.queryClient.refetchQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
        type: "active",
      });

      // Invalidate partner dashboards for tables that affect partner view
      if (
        table === "goals" ||
        table === "check_ins" ||
        table === "actionable_plans" ||
        table === "challenges" ||
        table === "challenge_check_ins" ||
        table === "challenge_participants"
      ) {
        this.invalidatePartnerDashboards();
      }
    }
  }

  /**
   * Handle new achievement unlocked
   * Invalidates achievements cache to show new badges
   */
  private handleNewAchievement(payload: RealtimePostgresChangesPayload<any>) {
    const newAchievement = payload.new as any;

    console.log(
      `[Realtime] 🏆 New achievement unlocked:`,
      newAchievement?.achievement_type_id,
    );

    // Invalidate achievements cache to fetch the new badge
    if (this.queryClient) {
      this.queryClient.invalidateQueries({
        queryKey: achievementsQueryKeys.myAchievements(),
      });
      this.queryClient.invalidateQueries({
        queryKey: achievementsQueryKeys.stats(),
      });
    }
  }

  /**
   * Handle subscription changes from RevenueCat webhooks
   * Refreshes subscription store AND updates user plan in auth store
   *
   * IMPORTANT: We check subscription STATUS before updating user plan!
   * - active: User gets the subscription's plan
   * - expired: User gets "free"
   * - cancelled: User keeps plan until expiry (handled by backend)
   * - past_due/pending: Uncertain, rely on backend
   */
  private handleSubscriptionChange(
    payload: RealtimePostgresChangesPayload<any>,
  ) {
    const oldRecord = payload.old as any;
    const newRecord = payload.new as any;
    const newStatus = newRecord?.status;
    const newPlan = newRecord?.plan;

    console.log(`[Realtime] 💳 Subscription ${payload.eventType}:`, {
      oldStatus: oldRecord?.status,
      newStatus: newStatus,
      oldPlan: oldRecord?.plan,
      newPlan: newPlan,
    });

    // Refresh subscription store to get latest subscription & features
    // This will update feature gating across the app
    useSubscriptionStore.getState().refresh();

    // Update user's plan based on subscription STATUS
    const currentUser = useAuthStore.getState().user;
    if (currentUser) {
      // Only update plan if we have a clear status
      if (newStatus === "active" && newPlan) {
        // Active subscription - user gets the plan
        if (currentUser.plan !== newPlan) {
          console.log(
            `[Realtime]   📝 Subscription active, updating plan: ${currentUser.plan} → ${newPlan}`,
          );
          useAuthStore.getState().updateUser({ plan: newPlan });
        }
      } else if (newStatus === "expired") {
        // Expired subscription - user goes back to free
        if (currentUser.plan !== "free") {
          console.log(
            `[Realtime]   📝 Subscription expired, downgrading to free: ${currentUser.plan} → free`,
          );
          useAuthStore.getState().updateUser({ plan: "free" });
        }
      }
      // For 'cancelled', 'past_due', 'pending' - don't update immediately
      // The backend handles grace periods and expiry dates correctly
      // User query invalidation below will fetch the correct state
    }

    // Invalidate user query so React Query refetches latest user data from backend
    // This ensures we get the authoritative plan from the backend
    if (this.queryClient) {
      this.queryClient.invalidateQueries({
        queryKey: ["user", "current"],
      });

      // Also invalidate partner dashboard queries
      // This ensures that when viewing a partner's dashboard, premium access status updates
      this.queryClient.invalidateQueries({
        queryKey: partnersQueryKeys.all,
      });

      // Force refetch active partner queries
      this.invalidatePartnerDashboards();
    }

    console.log(
      `[Realtime]   ✅ Triggered subscription, user & partner refresh`,
    );
  }

  /**
   * Handle user record changes:
   * - CRITICAL: Force logout if user is banned/suspended/disabled/deleted
   * - Update auth store if plan or other fields changed
   */
  private async handleUserStatusChange(
    payload: RealtimePostgresChangesPayload<any>,
  ) {
    const oldRecord = payload.old as any;
    const newRecord = payload.new as any;

    // Handle DELETE - force logout if user is deleted
    if (payload.eventType === "DELETE") {
      console.log(`[Realtime] 🚨 User deleted, forcing logout`);
      await handleAutoLogout("disabled");
      return;
    }

    // Handle UPDATE
    const oldStatus = oldRecord?.status;
    const newStatus = newRecord?.status;

    // Check if user was active and is now disabled/suspended
    if (
      oldStatus === "active" &&
      (newStatus === "disabled" || newStatus === "suspended")
    ) {
      console.log(
        `[Realtime] 🚨 User status changed to ${newStatus}, forcing logout`,
      );

      // Force logout immediately
      await handleAutoLogout(newStatus as "disabled" | "suspended");
      return;
    }

    // Handle plan changes from users table
    const oldPlan = oldRecord?.plan;
    const newPlan = newRecord?.plan;
    if (newPlan && oldPlan !== newPlan) {
      const currentUser = useAuthStore.getState().user;
      if (currentUser && currentUser.plan !== newPlan) {
        console.log(`[Realtime] 📝 User plan updated: ${oldPlan} → ${newPlan}`);
        useAuthStore.getState().updateUser({ plan: newPlan });

        // Also refresh subscription store to ensure features are in sync
        useSubscriptionStore.getState().refresh();
      }

      // Invalidate partner queries when plan changes
      // This ensures premium access checks are updated in partner views
      if (this.queryClient) {
        this.queryClient.invalidateQueries({
          queryKey: partnersQueryKeys.all,
        });
        this.invalidatePartnerDashboards();
      }
    }

    // Invalidate user query for any user update
    if (this.queryClient) {
      this.queryClient.invalidateQueries({
        queryKey: ["user", "current"],
      });

      // If any user's status changed, also invalidate partner queries
      // This handles when a partner's account becomes inactive/suspended
      // Other users viewing their dashboard will get updated data
      if (oldStatus !== newStatus) {
        console.log(
          `[Realtime] 👥 User status changed (${oldStatus} → ${newStatus}), invalidating partner queries`,
        );
        this.queryClient.invalidateQueries({
          queryKey: partnersQueryKeys.all,
        });
        this.queryClient.refetchQueries({
          queryKey: partnersQueryKeys.list(),
          type: "active",
        });
        this.invalidatePartnerDashboards();
      }
    }
  }

  /**
   * Handle challenge check-ins changes (external: admin, direct DB changes)
   * - DELETE: Remove from cache, recalculate progress
   * - UPDATE: Update existing check-in in cache
   * - INSERT: Only add if not already in cache (avoid dupes from optimistic updates)
   */
  private handleChallengeCheckInsChange(
    payload: RealtimePostgresChangesPayload<any>,
  ) {
    const oldRecord = payload.old as any;
    const newRecord = payload.new as any;
    const challengeId = newRecord?.challenge_id || oldRecord?.challenge_id;
    const checkInId = newRecord?.id || oldRecord?.id;

    if (!this.queryClient) return;

    if (payload.eventType === "DELETE") {
      if (challengeId) {
        // Remove from cache directly for immediate feedback
        const queryKeys = [
          challengesQueryKeys.checkIns(challengeId),
          challengesQueryKeys.myCheckIns(challengeId),
        ];

        for (const queryKey of queryKeys) {
          this.queryClient.setQueryData(queryKey, (old: any) => {
            if (!old?.data) return old;
            const filtered = old.data.filter(
              (ci: ChallengeCheckIn) => ci.id !== oldRecord?.id,
            );
            console.log(
              `[Realtime]   ✅ Removed check-in from cache: ${oldRecord?.id}`,
            );
            return { ...old, data: filtered };
          });
        }

        // Invalidate related queries to refetch updated totals
        this.queryClient.invalidateQueries({
          queryKey: challengesQueryKeys.detail(challengeId),
        });
        this.queryClient.invalidateQueries({
          queryKey: challengesQueryKeys.leaderboard(challengeId),
        });
      } else {
        // Fallback: no challenge_id, invalidate all
        console.log(
          `[Realtime]   ⚠️ No challenge_id in DELETE payload, invalidating all challenges`,
        );
        this.queryClient.invalidateQueries({
          queryKey: challengesQueryKeys.all,
        });
      }

      // Invalidate home dashboard so TodaysActionsCard updates
      this.queryClient.invalidateQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
      });

      // Invalidate partner dashboards
      this.invalidatePartnerDashboards();
    } else if (payload.eventType === "UPDATE") {
      if (challengeId) {
        // Update existing check-in in cache
        const queryKeys = [
          challengesQueryKeys.checkIns(challengeId),
          challengesQueryKeys.myCheckIns(challengeId),
        ];

        for (const queryKey of queryKeys) {
          this.queryClient.setQueryData(queryKey, (old: any) => {
            if (!old?.data) return old;
            const updated = old.data.map((ci: ChallengeCheckIn) =>
              ci.id === newRecord?.id ? { ...ci, ...newRecord } : ci,
            );
            return { ...old, data: updated };
          });
        }
      } else {
        // Fallback: no challenge_id, invalidate all
        this.queryClient.invalidateQueries({
          queryKey: challengesQueryKeys.all,
        });
      }

      // Invalidate home dashboard so TodaysActionsCard updates
      this.queryClient.invalidateQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
      });

      // Invalidate partner dashboards
      this.invalidatePartnerDashboards();
    } else if (payload.eventType === "INSERT") {
      if (challengeId) {
        // Check if already exists (avoid duplicates from optimistic updates)
        const checkInsQueryKey = challengesQueryKeys.checkIns(challengeId);
        const myCheckInsQueryKey = challengesQueryKeys.myCheckIns(challengeId);
        const existingData = this.queryClient.getQueryData(checkInsQueryKey) as
          | { data?: ChallengeCheckIn[] }
          | undefined;

        const alreadyExists = existingData?.data?.some(
          (ci) => ci.id === newRecord?.id || ci.id?.startsWith?.("temp-"),
        );

        if (!alreadyExists) {
          // Add to cache for both checkIns and myCheckIns
          for (const queryKey of [checkInsQueryKey, myCheckInsQueryKey]) {
            this.queryClient.setQueryData(queryKey, (old: any) => {
              if (!old) return old;
              if (Array.isArray(old)) return [newRecord, ...old];
              if (old?.data) return { ...old, data: [newRecord, ...old.data] };
              return old;
            });
          }
        }

        // Always invalidate to get fresh totals
        this.queryClient.invalidateQueries({
          queryKey: challengesQueryKeys.detail(challengeId),
        });
        this.queryClient.invalidateQueries({
          queryKey: challengesQueryKeys.leaderboard(challengeId),
        });
      } else {
        // Fallback: no challenge_id, invalidate all
        this.queryClient.invalidateQueries({
          queryKey: challengesQueryKeys.all,
        });
      }

      // Invalidate home dashboard so TodaysActionsCard shows new pending check-ins
      this.queryClient.invalidateQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
      });

      // Invalidate partner dashboards
      this.invalidatePartnerDashboards();
    }
  }

  /**
   * Handle challenge participants changes (points, progress_data updates)
   * This is triggered when points are recalculated after check-in add/delete
   */
  private handleChallengeParticipantsChange(
    payload: RealtimePostgresChangesPayload<any>,
  ) {
    const newRecord = payload.new as any;
    const oldRecord = payload.old as any;
    const challengeId = newRecord?.challenge_id || oldRecord?.challenge_id;

    if (!this.queryClient) return;

    if (challengeId) {
      // Invalidate participants query
      this.queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.participants(challengeId),
      });

      // Also invalidate challenge detail (to get updated my_progress, my_rank)
      this.queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.detail(challengeId),
      });

      // Leaderboard depends on participants
      this.queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.leaderboard(challengeId),
      });
    } else {
      // Fallback: challenge_id not in payload (REPLICA IDENTITY not set)
      this.queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.all,
      });
    }
  }

  /**
   * Handle user_stats_cache changes
   * This cache is maintained by DB triggers and contains pre-calculated user stats.
   * When it updates, we need to refresh the home dashboard to show new streak/stats.
   */
  private handleUserStatsCacheChange(
    payload: RealtimePostgresChangesPayload<any>,
  ) {
    if (!this.queryClient) return;

    // The user_stats_cache is updated by triggers whenever:
    // - Check-ins are created/updated/deleted
    // - Goals are created/updated/deleted
    // - Challenge participation changes
    // - Workouts are completed
    // - Meals/hydration are logged

    console.log(`[Realtime] 📊 User stats cache ${payload.eventType}`);

    // Invalidate home dashboard to pick up new stats
    this.queryClient.invalidateQueries({
      queryKey: homeDashboardQueryKeys.dashboard(),
    });

    // Also invalidate progress queries that might depend on this data
    this.queryClient.invalidateQueries({
      queryKey: ["progress"],
    });

    // Invalidate partner dashboards - user stats affect partner's view of this user
    console.log(`[Realtime] 👥 Invalidating partner dashboards for user stats`);
    this.invalidatePartnerDashboards();

    // Invalidate user stats cache query key for direct access
    this.queryClient.invalidateQueries({
      queryKey: ["userStatsCache"],
    });
  }

  /**
   * Handle goal_statistics table changes
   * Updated by triggers when check-ins for a goal are created/updated/deleted
   */
  private handleGoalStatisticsChange(
    payload: RealtimePostgresChangesPayload<any>,
  ) {
    if (!this.queryClient) return;

    const newRecord = payload.new as any;
    const oldRecord = payload.old as any;
    const goalId = newRecord?.goal_id || oldRecord?.goal_id;

    console.log(
      `[Realtime] 📊 Goal statistics ${payload.eventType}`,
      goalId ? { goalId } : {},
    );

    // Invalidate progress queries for this specific goal
    if (goalId) {
      // Invalidate streak info for this goal
      this.queryClient.invalidateQueries({
        queryKey: progressQueryKeys.streak(goalId),
      });

      // Invalidate habit chain for this goal
      this.queryClient.invalidateQueries({
        queryKey: [...progressQueryKeys.all, "chain", goalId],
        exact: false,
      });
    }

    // Also invalidate general progress queries
    this.queryClient.invalidateQueries({
      queryKey: progressQueryKeys.all,
    });

    // Invalidate partner dashboards - goal stats affect partner's view
    this.invalidatePartnerDashboards();
  }

  /**
   * Handle challenge_statistics table changes
   * Updated by triggers when challenge_check_ins are created/updated/deleted
   */
  private handleChallengeStatisticsChange(
    payload: RealtimePostgresChangesPayload<any>,
  ) {
    if (!this.queryClient) return;

    const newRecord = payload.new as any;
    const oldRecord = payload.old as any;
    const challengeId = newRecord?.challenge_id || oldRecord?.challenge_id;

    console.log(
      `[Realtime] 🏆 Challenge statistics ${payload.eventType}`,
      challengeId ? { challengeId } : {},
    );

    // Invalidate challenge queries for this specific challenge
    if (challengeId) {
      // Invalidate challenge details
      this.queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.detail(challengeId),
      });

      // Invalidate leaderboard for this challenge
      this.queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.leaderboard(challengeId),
      });
    }

    // Also invalidate general challenge queries
    this.queryClient.invalidateQueries({
      queryKey: challengesQueryKeys.all,
    });

    // Invalidate partner dashboard (if viewing partner's challenges)
    this.queryClient.invalidateQueries({
      queryKey: partnersQueryKeys.all,
    });
  }

  /**
   * Handle accountability_partners changes
   * Smart cache updates to avoid duplicates and UI flashes
   */
  private handleAccountabilityPartnersChange(
    payload: RealtimePostgresChangesPayload<any>,
  ) {
    if (!this.queryClient) return;

    const newRecord = payload.new as any;
    const oldRecord = payload.old as any;
    const partnershipId = newRecord?.id || oldRecord?.id;
    const status = newRecord?.status;

    if (payload.eventType === "DELETE") {
      // Remove from all partner caches directly (no refetch needed)
      // This prevents the UI flash where deleted items briefly reappear
      console.log(`[Realtime] 👥 Partner DELETE detected, updating caches`, {
        partnershipId,
      });

      // Remove from partners list
      this.queryClient.setQueryData(partnersQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((p: any) => p.id !== partnershipId),
        };
      });

      // Remove from pending requests
      this.queryClient.setQueryData(partnersQueryKeys.pending(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((p: any) => p.id !== partnershipId),
        };
      });

      // Remove from sent requests
      this.queryClient.setQueryData(partnersQueryKeys.sent(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((p: any) => p.id !== partnershipId),
        };
      });

      // Remove from partners list (for accepted partnerships that are deleted)
      this.queryClient.setQueryData(partnersQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((p: any) => p.id !== partnershipId),
        };
      });

      // Force refetch partners list to ensure UI updates
      this.queryClient.refetchQueries({
        queryKey: partnersQueryKeys.list(),
        type: "active",
      });

      // Force invalidate and refetch ALL search/suggested queries
      // Note: Supabase DELETE events don't include full old record data by default
      // (only includes primary key unless REPLICA IDENTITY FULL is enabled)
      // So we must invalidate all search queries to get fresh data from server
      console.log(
        `[Realtime] 👥 Partner DELETE - invalidating all search/suggested queries`,
      );

      // Invalidate ALL search queries (forces refetch with fresh data from server)
      this.queryClient.invalidateQueries({
        queryKey: ["partners", "search"],
      });

      // Invalidate suggested queries
      this.queryClient.invalidateQueries({
        queryKey: partnersQueryKeys.suggestedInfinite(),
      });

      // Force immediate refetch if screens are active
      this.queryClient.refetchQueries({
        queryKey: ["partners", "search"],
        type: "active",
      });
      this.queryClient.refetchQueries({
        queryKey: partnersQueryKeys.suggestedInfinite(),
        type: "active",
      });

      // Invalidate all dashboard caches
      // Note: We can't target specific dashboards since oldRecord is undefined for DELETE
      // This ensures PartnerDetailScreen gets updated if viewing removed partner
      this.invalidatePartnerDashboards();
    } else if (payload.eventType === "UPDATE") {
      // Update in the appropriate list based on status
      if (status === "accepted") {
        // FIRST: Get partner info from pending/sent caches BEFORE we remove them
        // The realtime payload doesn't include joined data (partner name, avatar, etc.)
        const pendingData = this.queryClient.getQueryData(
          partnersQueryKeys.pending(),
        ) as any;
        const sentData = this.queryClient.getQueryData(
          partnersQueryKeys.sent(),
        ) as any;

        const existingFromPending = pendingData?.data?.find(
          (p: any) => p.id === partnershipId,
        );
        const existingFromSent = sentData?.data?.find(
          (p: any) => p.id === partnershipId,
        );

        // Merge: preserved partner info + realtime data (realtime takes precedence for status)
        const mergedRecord = {
          ...(existingFromPending || existingFromSent || {}),
          ...newRecord,
        };

        console.log(`[Realtime] 👥 Partner accepted - merging data`, {
          partnershipId: partnershipId?.substring(0, 8),
          hasFromPending: !!existingFromPending,
          hasFromSent: !!existingFromSent,
          mergedHasPartner: !!mergedRecord?.partner,
          partnerName: mergedRecord?.partner?.name || "MISSING",
        });

        // THEN: Remove from pending/sent caches
        this.queryClient.setQueryData(
          partnersQueryKeys.pending(),
          (old: any) => {
            if (!old?.data) return old;
            return {
              ...old,
              data: old.data.filter((p: any) => p.id !== partnershipId),
            };
          },
        );

        this.queryClient.setQueryData(partnersQueryKeys.sent(), (old: any) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.filter((p: any) => p.id !== partnershipId),
          };
        });

        // FINALLY: Add to partners list with preserved partner info
        this.queryClient.setQueryData(partnersQueryKeys.list(), (old: any) => {
          if (!old?.data) return { data: [mergedRecord] };
          const existingInList = old.data.find(
            (p: any) => p.id === partnershipId,
          );
          if (existingInList) {
            // Update existing - preserve partner info
            return {
              ...old,
              data: old.data.map((p: any) =>
                p.id === partnershipId ? { ...p, ...mergedRecord } : p,
              ),
            };
          }
          return { ...old, data: [...old.data, mergedRecord] };
        });

        // Update search/suggested caches to show "accepted" status
        // This ensures FindPartnerScreen shows correct state
        const partnerUserId = newRecord?.partner_user_id;
        const senderUserId = newRecord?.user_id;

        // Update all search queries in cache
        // Capture reference for use in callbacks
        const qc = this.queryClient;
        const searchQueryState = qc.getQueriesData({
          queryKey: ["partners", "search"],
        });

        searchQueryState.forEach(([key]: [any, any]) => {
          qc.setQueryData(key, (old: any) => {
            if (!old?.pages) return old;
            return {
              ...old,
              pages: old.pages.map((page: any) => ({
                ...page,
                users: page.users?.map((user: any) =>
                  user.id === partnerUserId || user.id === senderUserId
                    ? {
                        ...user,
                        request_status: "accepted" as const,
                        is_partner: true,
                      }
                    : user,
                ),
              })),
            };
          });
        });

        // Update suggested infinite query
        qc.setQueryData(partnersQueryKeys.suggestedInfinite(), (old: any) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              users: page.users?.map((user: any) =>
                user.id === partnerUserId || user.id === senderUserId
                  ? {
                      ...user,
                      request_status: "accepted" as const,
                      is_partner: true,
                    }
                  : user,
              ),
            })),
          };
        });
      } else if (status === "rejected") {
        // Remove from pending (receiver's view)
        this.queryClient.setQueryData(
          partnersQueryKeys.pending(),
          (old: any) => {
            if (!old?.data) return old;
            return {
              ...old,
              data: old.data.filter((p: any) => p.id !== partnershipId),
            };
          },
        );

        // Remove from sent (sender's view)
        this.queryClient.setQueryData(partnersQueryKeys.sent(), (old: any) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.filter((p: any) => p.id !== partnershipId),
          };
        });
      }

      // Invalidate to refresh full data (but cache is already updated)
      this.queryClient.invalidateQueries({
        queryKey: partnersQueryKeys.all,
      });

      // CRITICAL: Invalidate partner dashboards on any UPDATE
      // The backend touches updated_at when a user's goals/challenges change
      // This triggers realtime events to partners so their dashboards refresh
      console.log(
        "[Realtime] 👥 Partnership UPDATE - invalidating partner dashboards",
      );
      this.invalidatePartnerDashboards();
    } else if (payload.eventType === "INSERT") {
      // For INSERT, force refetch to ensure UI updates immediately
      // invalidateQueries doesn't trigger refetch if query is fresh (staleTime)
      // refetchQueries forces immediate refetch regardless of stale status
      const newUserId = newRecord?.user_id;
      const newPartnerId = newRecord?.partner_user_id;
      const newStatus = newRecord?.status;
      console.log(`[Realtime] 👥 Partner INSERT detected, updating caches`, {
        partnershipId: partnershipId?.substring(0, 8),
        userId: newUserId?.substring(0, 8),
        partnerId: newPartnerId?.substring(0, 8),
        status: newStatus,
      });

      // For pending requests (status='pending'), add to the correct cache immediately
      // This ensures the badge count updates instantly
      if (newStatus === "pending" && newRecord) {
        const currentUserId = useAuthStore.getState().user?.id;

        // Only add to pending cache if current user is the RECIPIENT (partner_user_id)
        if (newPartnerId === currentUserId) {
          console.log(
            `[Realtime] 👥 Adding to pending cache (I am recipient)`,
            { partnershipId: partnershipId?.substring(0, 8) },
          );
          this.queryClient.setQueryData(
            partnersQueryKeys.pending(),
            (old: any) => {
              if (!old?.data) return { data: [newRecord] };
              const exists = old.data.some((p: any) => p.id === partnershipId);
              if (exists) return old;
              return { ...old, data: [newRecord, ...old.data] };
            },
          );
        }

        // Only add to sent cache if current user is the SENDER (user_id)
        if (newUserId === currentUserId) {
          console.log(`[Realtime] 👥 Adding to sent cache (I am sender)`, {
            partnershipId: partnershipId?.substring(0, 8),
          });
          this.queryClient.setQueryData(
            partnersQueryKeys.sent(),
            (old: any) => {
              if (!old?.data) return { data: [newRecord] };
              const exists = old.data.some((p: any) => p.id === partnershipId);
              if (exists) return old;
              return { ...old, data: [newRecord, ...old.data] };
            },
          );
        }
      }

      // Invalidate and refetch to get full partner info (name, avatar, etc.)
      this.queryClient.invalidateQueries({
        queryKey: partnersQueryKeys.all,
      });

      // Force refetch to get complete data with joins
      this.queryClient.refetchQueries({
        queryKey: partnersQueryKeys.pending(),
        type: "all",
      });

      this.queryClient.refetchQueries({
        queryKey: partnersQueryKeys.sent(),
        type: "all",
      });

      this.queryClient.refetchQueries({
        queryKey: partnersQueryKeys.list(),
        type: "all",
      });
    }
  }

  /**
   * Handle notification_history changes
   * Invalidate notification queries when new notifications arrive or are updated
   */
  private handleNotificationHistoryChange(
    payload: RealtimePostgresChangesPayload<any>,
  ) {
    if (!this.queryClient) return;

    const newRecord = payload.new as any;
    const notificationType = newRecord?.notification_type;
    const notificationId = newRecord?.id;
    const userId = newRecord?.user_id;

    console.log(`[Realtime] 🔔 Notification history ${payload.eventType}`, {
      id: notificationId?.substring(0, 8),
      type: notificationType,
      userId: userId?.substring(0, 8),
    });

    if (payload.eventType === "INSERT") {
      // New notification arrived - prepend to first page for immediate UI update
      // useNotificationHistory uses useInfiniteQuery with { pages: [...], pageParams: [...] }
      this.queryClient.setQueriesData(
        { queryKey: notificationHistoryQueryKeys.list() },
        (old: { pages: any[][]; pageParams: number[] } | undefined) => {
          if (!old?.pages) return old;
          const firstPage = old.pages[0] || [];
          // Check if already exists (avoid duplicates)
          const exists = firstPage.some((n: any) => n.id === newRecord?.id);
          if (exists) return old;
          // Prepend to first page
          return {
            ...old,
            pages: [[newRecord, ...firstPage], ...old.pages.slice(1)],
          };
        },
      );

      // Also update the unread count query cache directly
      this.queryClient.setQueryData(
        notificationHistoryQueryKeys.unreadCount(),
        (old: any[] | undefined) => {
          if (!old) return [newRecord];
          const exists = old.some((n: any) => n.id === newRecord?.id);
          if (exists) return old;
          return [newRecord, ...old];
        },
      );

      // Force refetch unread count immediately (for tab badge)
      this.queryClient.refetchQueries({
        queryKey: notificationHistoryQueryKeys.unreadCount(),
      });

      // Force refetch notification list immediately
      this.queryClient.refetchQueries({
        queryKey: notificationHistoryQueryKeys.list(),
      });

      // Also invalidate to ensure all notification data is fresh
      this.queryClient.invalidateQueries({
        queryKey: notificationHistoryQueryKeys.all,
      });
    } else if (payload.eventType === "UPDATE") {
      // Notification was updated (e.g., opened_at set)
      // Update in infinite query pages
      this.queryClient.setQueriesData(
        { queryKey: notificationHistoryQueryKeys.list() },
        (old: { pages: any[][]; pageParams: number[] } | undefined) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: any[]) =>
              page.map((n: any) =>
                n.id === newRecord?.id ? { ...n, ...newRecord } : n,
              ),
            ),
          };
        },
      );

      // Also update in unread count query
      this.queryClient.setQueryData(
        notificationHistoryQueryKeys.unreadCount(),
        (old: any[] | undefined) => {
          if (!old) return old;
          return old.map((n: any) =>
            n.id === newRecord?.id ? { ...n, ...newRecord } : n,
          );
        },
      );

      // Refetch unread count if opened_at changed
      if (newRecord?.opened_at) {
        this.queryClient.refetchQueries({
          queryKey: notificationHistoryQueryKeys.unreadCount(),
        });
      }
    } else if (payload.eventType === "DELETE") {
      // Notification was deleted - remove from cache
      const oldRecord = payload.old as any;
      this.queryClient.setQueriesData(
        { queryKey: notificationHistoryQueryKeys.list() },
        (old: { pages: any[][]; pageParams: number[] } | undefined) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: any[]) =>
              page.filter((n: any) => n.id !== oldRecord?.id),
            ),
          };
        },
      );

      // Also remove from unread count query
      this.queryClient.setQueryData(
        notificationHistoryQueryKeys.unreadCount(),
        (old: any[] | undefined) => {
          if (!old) return old;
          return old.filter((n: any) => n.id !== oldRecord?.id);
        },
      );

      // Refetch unread count
      this.queryClient.refetchQueries({
        queryKey: notificationHistoryQueryKeys.unreadCount(),
      });
    }
  }

  /**
   * Handle social_nudges changes (partner nudges, cheers, etc.)
   * Updates the partner activity / nudges cache for instant UI updates
   */
  private handleSocialNudgesChange(
    payload: RealtimePostgresChangesPayload<any>,
  ) {
    if (!this.queryClient) return;

    const newRecord = payload.new as any;
    const oldRecord = payload.old as any;
    const nudgeId = newRecord?.id || oldRecord?.id;

    console.log(
      `[Realtime] 💬 Social nudge ${payload.eventType}`,
      nudgeId ? { id: nudgeId } : {},
    );

    if (payload.eventType === "INSERT") {
      // New nudge received - force refetch for immediate UI update
      this.queryClient.refetchQueries({
        queryKey: nudgesQueryKeys.list(),
      });

      // Also refetch unread count
      this.queryClient.refetchQueries({
        queryKey: nudgesQueryKeys.unreadCount(),
      });

      // Invalidate all nudge queries
      this.queryClient.invalidateQueries({
        queryKey: nudgesQueryKeys.all,
      });
    } else if (payload.eventType === "UPDATE") {
      // Nudge was updated (e.g., marked as read)
      // Update in list cache
      this.queryClient.setQueryData(nudgesQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((n: any) =>
            n.id === newRecord?.id ? { ...n, ...newRecord } : n,
          ),
        };
      });

      // Also update in filtered lists
      this.queryClient.setQueryData(
        nudgesQueryKeys.listFiltered(false),
        (old: any) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((n: any) =>
              n.id === newRecord?.id ? { ...n, ...newRecord } : n,
            ),
          };
        },
      );

      // Refresh unread count if is_read changed
      if (newRecord?.is_read !== oldRecord?.is_read) {
        this.queryClient.refetchQueries({
          queryKey: nudgesQueryKeys.unreadCount(),
        });
      }
    } else if (payload.eventType === "DELETE") {
      // Nudge was deleted - remove from caches
      this.queryClient.setQueryData(nudgesQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((n: any) => n.id !== oldRecord?.id),
        };
      });

      this.queryClient.setQueryData(nudgesQueryKeys.sent(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((n: any) => n.id !== oldRecord?.id),
        };
      });

      // Invalidate all nudge queries
      this.queryClient.invalidateQueries({
        queryKey: nudgesQueryKeys.all,
      });
    }
  }

  /**
   * Handle summary table changes (daily_workout_summaries, daily_nutrition_summaries, etc.)
   * These are trigger-maintained tables that aggregate data for performance.
   * When they update, we need to invalidate:
   * 1. Tracking stats queries (WorkoutProgressStats, MealProgressStats, etc.)
   * 2. Progress queries (streak, habit chain, week progress)
   * 3. Home dashboard
   */
  private handleSummaryTableChange(
    table: RealtimeTable,
    payload: RealtimePostgresChangesPayload<any>,
  ) {
    if (!this.queryClient) return;

    const newRecord = payload.new as any;
    const oldRecord = payload.old as any;
    const goalId = newRecord?.goal_id || oldRecord?.goal_id;
    const challengeId = newRecord?.challenge_id || oldRecord?.challenge_id;

    // Invalidate tracking stats for the specific entity
    if (goalId) {
      this.queryClient.invalidateQueries({
        queryKey: trackingStatsQueryKeys.entity("goal", goalId),
      });
      // Also invalidate progress data (streak, habit chain, week progress)
      this.queryClient.invalidateQueries({
        queryKey: progressQueryKeys.streak(goalId),
      });
      this.queryClient.invalidateQueries({
        queryKey: progressQueryKeys.weekProgress(goalId),
      });
      this.queryClient.invalidateQueries({
        queryKey: [...progressQueryKeys.all, "chain", goalId],
      });
    }

    if (challengeId) {
      this.queryClient.invalidateQueries({
        queryKey: trackingStatsQueryKeys.entity("challenge", challengeId),
      });
      // Also invalidate progress data for challenges
      this.queryClient.invalidateQueries({
        queryKey: progressQueryKeys.streak(challengeId),
      });
      this.queryClient.invalidateQueries({
        queryKey: progressQueryKeys.weekProgress(challengeId),
      });
      this.queryClient.invalidateQueries({
        queryKey: [...progressQueryKeys.all, "chain", challengeId],
      });
    }

    // If no specific entity, invalidate all tracking stats
    if (!goalId && !challengeId) {
      this.queryClient.invalidateQueries({
        queryKey: trackingStatsQueryKeys.all,
      });
    }

    // Always invalidate home dashboard
    this.queryClient.invalidateQueries({
      queryKey: homeDashboardQueryKeys.dashboard(),
    });
  }

  /**
   * Handle challenge leaderboard changes
   * Leaderboard is updated after check-ins affect points/rankings
   */
  private handleChallengeLeaderboardChange(
    payload: RealtimePostgresChangesPayload<any>,
  ) {
    const newRecord = payload.new as any;
    const oldRecord = payload.old as any;
    const challengeId = newRecord?.challenge_id || oldRecord?.challenge_id;

    if (!this.queryClient) return;

    if (challengeId) {
      // Invalidate specific leaderboard query
      this.queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.leaderboard(challengeId),
      });

      // Also update challenge detail for my_rank
      this.queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.detail(challengeId),
      });
    } else {
      // Fallback: challenge_id not in payload (REPLICA IDENTITY not set)
      // Invalidate all challenge queries to ensure UI stays in sync
      this.queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.all,
      });
    }
  }

  /**
   * Handle challenges table changes
   * For when challenge details are updated (title, status, etc.)
   */
  private handleChallengesChange(payload: RealtimePostgresChangesPayload<any>) {
    const newRecord = payload.new as any;
    const oldRecord = payload.old as any;
    const challengeId = newRecord?.id || oldRecord?.id;

    if (!this.queryClient) return;

    if (payload.eventType === "DELETE") {
      // Remove from list cache
      this.queryClient.setQueryData(challengesQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;
        const filtered = old.data.filter((c: any) => c.id !== oldRecord?.id);
        return { ...old, data: filtered };
      });

      // Also remove from "my challenges" cache (used by GoalsScreen)
      this.queryClient.setQueryData(challengesQueryKeys.my(), (old: any) => {
        if (!old?.data) return old;
        const filtered = old.data.filter((c: any) => c.id !== oldRecord?.id);
        return { ...old, data: filtered };
      });

      // Remove specific detail cache
      this.queryClient.removeQueries({
        queryKey: challengesQueryKeys.detail(oldRecord?.id),
      });

      // Invalidate home dashboard (TodaysActionsCard uses this)
      this.queryClient.invalidateQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
      });

      // Invalidate partner dashboards
      this.invalidatePartnerDashboards();
    } else if (payload.eventType === "UPDATE") {
      // Update in list cache
      this.queryClient.setQueryData(challengesQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;
        const updated = old.data.map((c: any) =>
          c.id === newRecord?.id ? { ...c, ...newRecord } : c,
        );
        return { ...old, data: updated };
      });

      // Also update in "my challenges" cache (used by GoalsScreen)
      this.queryClient.setQueryData(challengesQueryKeys.my(), (old: any) => {
        if (!old?.data) return old;
        const updated = old.data.map((c: any) =>
          c.id === newRecord?.id ? { ...c, ...newRecord } : c,
        );
        return { ...old, data: updated };
      });

      // Invalidate detail to get fresh computed fields
      this.queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.detail(challengeId),
      });

      // Invalidate home dashboard (TodaysActionsCard uses this)
      this.queryClient.invalidateQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
      });

      // Invalidate partner dashboards
      console.log(
        `[Realtime] 👥 Invalidating partner dashboards for challenges UPDATE`,
      );
      this.invalidatePartnerDashboards();
    } else if (payload.eventType === "INSERT") {
      // For new challenges, invalidate all challenge queries
      this.queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.all,
      });
      this.queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.list(),
      });
      this.queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.my(),
      });
      this.queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.public(),
      });

      // Invalidate home dashboard so TodaysActionsCard shows new pending check-ins
      this.queryClient.invalidateQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
      });

      // Invalidate partner dashboards
      this.invalidatePartnerDashboards();
    }
  }

  /**
   * Handle reconnection with exponential backoff
   * Only called when there's a global connection issue, not individual table failures
   */
  private handleReconnect() {
    // Only reconnect if we have very few successful subscriptions
    const successfulCount = Array.from(this.channels.values()).filter(
      (channel) => channel.state === "joined",
    ).length;

    // If we have some successful subscriptions, don't reconnect globally
    if (successfulCount > 0) {
      console.log(
        `[Realtime] Some subscriptions working (${successfulCount}), skipping global reconnect`,
      );
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(
        "[Realtime] Max reconnection attempts reached, giving up",
        "\n[Realtime] Troubleshooting:",
        "\n  1. Check if Supabase is running: supabase status",
        "\n  2. Verify Realtime is enabled in config.toml",
        "\n  3. Ensure migration ran: supabase db push --local",
        "\n  4. For local dev, restart: supabase stop && supabase start",
      );
      return;
    }

    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000); // Max 30s
    this.reconnectAttempts++;

    console.log(
      `[Realtime] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
    );

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(async () => {
      const userId = useAuthStore.getState().user?.id;
      if (userId) {
        await this.stop();
        await this.start(userId);
      }
    }, delay);
  }

  /**
   * Stop all Realtime subscriptions
   * @param clearUserId - If true, clears the stored userId (prevents auto-reconnect)
   */
  async stop(clearUserId: boolean = false) {
    // Stop heartbeat
    this.stopHeartbeat();

    if (this.channels.size === 0) {
      if (clearUserId) {
        this.currentUserId = null;
      }
      return;
    }

    // Unsubscribe from all channels
    if (supabase) {
      for (const [channelName, channel] of this.channels.entries()) {
        try {
          await supabase.removeChannel(channel);
        } catch (error) {
          // Silently handle cleanup errors
          if (__DEV__) {
            console.warn(`[Realtime] Cleanup warning:`, error);
          }
        }
      }
    }

    this.channels.clear();
    this.failedTables.clear();
    this.successfulTables.clear();
    this.isConnected = false;

    // Clear userId only if explicitly requested (e.g., on logout)
    if (clearUserId) {
      this.currentUserId = null;
    }

    // Clear any pending retry timeouts
    if (this.partialRetryTimeout) {
      clearTimeout(this.partialRetryTimeout);
      this.partialRetryTimeout = null;
    }
    this.partialRetryAttempts = 0;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    console.log("[Realtime] 🛑 Stopped all subscriptions");
  }

  /**
   * Full cleanup - call this on logout
   * Stops subscriptions and removes AppState listener
   */
  cleanup() {
    this.stop(true);

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    console.log("[Realtime] 🧹 Full cleanup completed");
  }

  /**
   * Check if Realtime is connected
   */
  isRealtimeConnected(): boolean {
    return this.isConnected && this.channels.size > 0;
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      channelCount: this.channels.size,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

export const realtimeService = new RealtimeService();
