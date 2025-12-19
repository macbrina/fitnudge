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
import { dailyMotivationsQueryKeys } from "@/hooks/api/useDailyMotivations";
import { socialQueryKeys } from "@/hooks/api/useSocial";
import { homeDashboardQueryKeys } from "@/hooks/api/useHomeDashboard";
import type { ChallengeCheckIn } from "@/services/api/challenges";

// Realtime-enabled tables (19 total)
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
  // Meal Tracking
  "meal_logs",
  "daily_nutrition_summaries",
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
] as const;

type RealtimeTable = (typeof REALTIME_TABLES)[number];

/**
 * Mapping from table names to their base query keys for generic cache invalidation
 * Used for UPDATE and DELETE events from admin/external sources
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
  notification_history: ["notifications"],
  // Meal Tracking
  meal_logs: ["mealLogs"],
  daily_nutrition_summaries: ["nutritionSummaries"],
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

  /**
   * Initialize the Realtime service with a React Query client
   */
  initialize(queryClient: QueryClient) {
    this.queryClient = queryClient;
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

    if (this.isConnected) {
      return;
    }

    // Set the user's session on Supabase client for RLS to work with Realtime
    // This ensures auth.uid() returns the correct user ID for INSERT/UPDATE events
    try {
      const accessToken = await TokenManager.getAccessToken();
      const refreshToken = await TokenManager.getRefreshToken();

      if (accessToken && supabase) {
        // Decode JWT payload (without verification) for debugging
        try {
          const parts = accessToken.split(".");
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
          }
        } catch (decodeErr) {
          console.warn(
            "[Realtime]   - Failed to decode JWT payload:",
            decodeErr
          );
        }

        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || "",
        });
      } else {
        console.log("[Realtime] No access token, using anon key only");
      }
    } catch (error) {
      console.warn(
        "[Realtime] Session setup error (continuing anyway):",
        error
      );
    }

    // Reset tracking
    this.failedTables.clear();
    this.successfulTables.clear();

    // Subscribe to all Realtime-enabled tables
    const subscriptionPromises = REALTIME_TABLES.map((table) =>
      this.subscribeToTable(table, userId)
    );
    await Promise.allSettled(subscriptionPromises);

    // Wait a bit for subscription status to settle
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Log concise summary and handle retries
    if (this.successfulTables.size === REALTIME_TABLES.length) {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log(
        `[Realtime] ✅ Connected: ${this.successfulTables.size}/${REALTIME_TABLES.length} tables`
      );
    } else if (this.successfulTables.size > 0) {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log(
        `[Realtime] ⚠️ Partial: ${this.successfulTables.size}/${REALTIME_TABLES.length} tables`
      );
      console.log(`   Failed: ${Array.from(this.failedTables).join(", ")}`);
    } else {
      // No tables connected - retry with exponential backoff
      if (retryCount < MAX_START_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
        console.warn(
          `[Realtime] ⚠️ Failed to connect, retrying in ${delay / 1000}s... (attempt ${retryCount + 1}/${MAX_START_RETRIES})`
        );

        // Clear any failed channels before retry
        await this.stop();

        // Wait and retry
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.start(userId, retryCount + 1);
      } else {
        console.error(
          `[Realtime] ❌ Failed after ${MAX_START_RETRIES} retries: 0/${REALTIME_TABLES.length} tables - Check connection`
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
      `[Realtime] 🔄 Scheduling background reconnect in ${BACKGROUND_RETRY_DELAY / 1000}s...`
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

    // Skip if already subscribed
    if (this.channels.has(channelName)) {
      console.log(`[Realtime] Already subscribed to ${table}`);
      return;
    }

    try {
      // Verify Supabase client is initialized
      if (!supabase) {
        this.failedTables.add(table);
        console.error(
          `[Realtime] ❌ Cannot subscribe to ${table}: Supabase client is not initialized.\n` +
            `   Check that EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set.`
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
            `   This usually means the Supabase client wasn't initialized correctly.`
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
          }
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
        error instanceof Error ? error.message : error
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
    payload: RealtimePostgresChangesPayload<any>
  ) {
    // Log changes (minimal for performance)
    if (__DEV__) {
      console.log(`[Realtime] 📡 ${table} ${payload.eventType}`, {
        id: (payload.new as any)?.id || (payload.old as any)?.id || "N/A",
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
    payload: RealtimePostgresChangesPayload<any>
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
        baseQueryKey
      );
      this.queryClient.invalidateQueries({
        queryKey: baseQueryKey,
      });

      // Also invalidate home dashboard since it aggregates data
      this.queryClient.invalidateQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
      });
    } else if (payload.eventType === "UPDATE") {
      // UPDATE: Full record available, try optimistic update then invalidate
      console.log(
        `[Realtime] ✏️ UPDATE on ${table}, updating cache:`,
        newRecord?.id
      );

      // For list queries, try to update the item in place
      this.queryClient.setQueriesData(
        { queryKey: baseQueryKey },
        (oldData: any) => {
          if (!oldData) return oldData;

          // Handle array data (list queries)
          if (Array.isArray(oldData)) {
            const index = oldData.findIndex(
              (item: any) => item?.id === newRecord?.id
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
              (item: any) => item?.id === newRecord?.id
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
        }
      );

      // Also invalidate to ensure computed fields are fresh
      this.queryClient.invalidateQueries({
        queryKey: baseQueryKey,
      });

      // Invalidate home dashboard for aggregate updates
      this.queryClient.invalidateQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
      });
    } else if (payload.eventType === "INSERT") {
      // INSERT: Add to cache if not already exists (avoid duplicates from optimistic updates)
      const newId = newRecord?.id;

      if (newId) {
        // Try to add to existing cache data if not already present
        let wasAdded = false;

        this.queryClient.setQueriesData(
          { queryKey: baseQueryKey },
          (oldData: any) => {
            if (!oldData) return oldData;

            // Handle array data (list queries)
            if (Array.isArray(oldData)) {
              const exists = oldData.some((item: any) => item?.id === newId);
              if (!exists) {
                wasAdded = true;
                return [newRecord, ...oldData];
              }
              return oldData;
            }

            // Handle { data: [...] } format
            if (oldData?.data && Array.isArray(oldData.data)) {
              const exists = oldData.data.some(
                (item: any) => item?.id === newId
              );
              if (!exists) {
                wasAdded = true;
                return { ...oldData, data: [newRecord, ...oldData.data] };
              }
              return oldData;
            }

            return oldData;
          }
        );

        if (__DEV__) {
          console.log(
            `[Realtime] ➕ INSERT on ${table}:`,
            wasAdded ? "added to cache" : "already exists, skipped"
          );
        }
      }

      // Also invalidate to ensure computed fields and aggregates are fresh
      this.queryClient.invalidateQueries({
        queryKey: baseQueryKey,
      });

      // Invalidate home dashboard for new items
      this.queryClient.invalidateQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
      });
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
      newAchievement?.achievement_type_id
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
    payload: RealtimePostgresChangesPayload<any>
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
            `[Realtime]   📝 Subscription active, updating plan: ${currentUser.plan} → ${newPlan}`
          );
          useAuthStore.getState().updateUser({ plan: newPlan });
        }
      } else if (newStatus === "expired") {
        // Expired subscription - user goes back to free
        if (currentUser.plan !== "free") {
          console.log(
            `[Realtime]   📝 Subscription expired, downgrading to free: ${currentUser.plan} → free`
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
    }

    console.log(`[Realtime]   ✅ Triggered subscription & user refresh`);
  }

  /**
   * Handle user record changes:
   * - CRITICAL: Force logout if user is banned/suspended/disabled/deleted
   * - Update auth store if plan or other fields changed
   */
  private async handleUserStatusChange(
    payload: RealtimePostgresChangesPayload<any>
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
        `[Realtime] 🚨 User status changed to ${newStatus}, forcing logout`
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
    }

    // Invalidate user query for any user update
    if (this.queryClient) {
      this.queryClient.invalidateQueries({
        queryKey: ["user", "current"],
      });
    }
  }

  /**
   * Handle challenge check-ins changes (external: admin, direct DB changes)
   * - DELETE: Remove from cache, recalculate progress
   * - UPDATE: Update existing check-in in cache
   * - INSERT: Only add if not already in cache (avoid dupes from optimistic updates)
   */
  private handleChallengeCheckInsChange(
    payload: RealtimePostgresChangesPayload<any>
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
              (ci: ChallengeCheckIn) => ci.id !== oldRecord?.id
            );
            console.log(
              `[Realtime]   ✅ Removed check-in from cache: ${oldRecord?.id}`
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
          `[Realtime]   ⚠️ No challenge_id in DELETE payload, invalidating all challenges`
        );
        this.queryClient.invalidateQueries({
          queryKey: challengesQueryKeys.all,
        });
      }

      // Invalidate home dashboard so TodaysActionsCard updates
      this.queryClient.invalidateQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
      });
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
              ci.id === newRecord?.id ? { ...ci, ...newRecord } : ci
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
    } else if (payload.eventType === "INSERT") {
      if (challengeId) {
        // Check if already exists (avoid duplicates from optimistic updates)
        const checkInsQueryKey = challengesQueryKeys.checkIns(challengeId);
        const myCheckInsQueryKey = challengesQueryKeys.myCheckIns(challengeId);
        const existingData = this.queryClient.getQueryData(checkInsQueryKey) as
          | { data?: ChallengeCheckIn[] }
          | undefined;

        const alreadyExists = existingData?.data?.some(
          (ci) => ci.id === newRecord?.id || ci.id?.startsWith?.("temp-")
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
    }
  }

  /**
   * Handle challenge participants changes (points, progress_data updates)
   * This is triggered when points are recalculated after check-in add/delete
   */
  private handleChallengeParticipantsChange(
    payload: RealtimePostgresChangesPayload<any>
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
   * Handle challenge leaderboard changes
   * Leaderboard is updated after check-ins affect points/rankings
   */
  private handleChallengeLeaderboardChange(
    payload: RealtimePostgresChangesPayload<any>
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

      // Remove specific detail cache
      this.queryClient.removeQueries({
        queryKey: challengesQueryKeys.detail(oldRecord?.id),
      });

      // Invalidate home dashboard (TodaysActionsCard uses this)
      this.queryClient.invalidateQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
      });
    } else if (payload.eventType === "UPDATE") {
      // Update in list cache
      this.queryClient.setQueryData(challengesQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;
        const updated = old.data.map((c: any) =>
          c.id === newRecord?.id ? { ...c, ...newRecord } : c
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
    } else if (payload.eventType === "INSERT") {
      // For new challenges, invalidate all challenge queries
      this.queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.all,
      });
      this.queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.list(),
      });
      this.queryClient.invalidateQueries({
        queryKey: challengesQueryKeys.public(),
      });

      // Invalidate home dashboard so TodaysActionsCard shows new pending check-ins
      this.queryClient.invalidateQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
      });
    }
  }

  /**
   * Handle reconnection with exponential backoff
   * Only called when there's a global connection issue, not individual table failures
   */
  private handleReconnect() {
    // Only reconnect if we have very few successful subscriptions
    const successfulCount = Array.from(this.channels.values()).filter(
      (channel) => channel.state === "joined"
    ).length;

    // If we have some successful subscriptions, don't reconnect globally
    if (successfulCount > 0) {
      console.log(
        `[Realtime] Some subscriptions working (${successfulCount}), skipping global reconnect`
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
        "\n  4. For local dev, restart: supabase stop && supabase start"
      );
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Max 30s
    this.reconnectAttempts++;

    console.log(
      `[Realtime] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
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
   */
  async stop() {
    if (this.channels.size === 0) return;

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

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
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
