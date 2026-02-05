/**
 * Supabase Realtime Service - V2 with Proper Optimistic Updates
 *
 * Manages real-time subscriptions for instant data updates across the app.
 * Uses optimistic cache updates (setQueryData) for instant UI feedback,
 * with proper cancelQueries + refetchQueries patterns.
 *
 * Critical Features:
 * - Force logout on user status changes (banned/suspended)
 * - Optimistic cache updates for INSERT/UPDATE/DELETE events
 * - Cancel queries before updates to prevent race conditions
 * - Refetch active queries after invalidation
 * - Exponential backoff reconnection strategy
 * - Memory leak prevention via proper cleanup
 * - App state handling for background/foreground transitions
 *
 * Pattern from React Query Guide:
 * 1. cancelQueries before setQueryData (prevent race conditions)
 * 2. setQueryData for optimistic update (instant UI)
 * 3. invalidateQueries to mark stale
 * 4. refetchQueries for active queries (force server truth)
 */

import { supabase } from "@/lib/supabase";
import { QueryClient } from "@tanstack/react-query";
import { AppState, AppStateStatus } from "react-native";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  REALTIME_SUBSCRIBE_STATES
} from "@supabase/supabase-js";
import { logger } from "@/services/logger";
import { handleAutoLogout } from "@/utils/authUtils";
import { useAuthStore } from "@/stores/authStore";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { useAICoachStore } from "@/stores/aiCoachStore";
import { aiCoachQueryKeys } from "@/hooks/api/queryKeys";
import { TokenManager } from "@/services/api/base";
import { achievementsQueryKeys } from "@/hooks/api/queryKeys";
import {
  goalsQueryKeys,
  checkInsQueryKeys,
  partnersQueryKeys,
  nudgesQueryKeys,
  weeklyRecapsQueryKeys,
  userQueryKeys,
  blogQueryKeys
} from "@/hooks/api/queryKeys";
import { notificationHistoryQueryKeys } from "@/hooks/api/queryKeys";
import { broadcastsQueryKeys } from "@/hooks/api/useBroadcasts";
import { useDeletedBroadcastIdsStore } from "@/stores/deletedBroadcastIdsStore";
import { dailyMotivationsQueryKeys } from "@/hooks/api/useDailyMotivations";
import { homeDashboardQueryKeys } from "@/hooks/api/queryKeys";
import { analyticsQueryKeys } from "@/hooks/api/useAnalytics";
import { analyticsService } from "@/services/api/analytics";
import { getLastAnalyticsParams } from "@/hooks/api/useAnalytics";

// Realtime-enabled tables for V2
const REALTIME_TABLES = [
  // Security
  "users",
  // Core
  "check_ins",
  "goals",
  "daily_checkin_summaries",
  "daily_motivations",
  // Subscriptions
  "subscriptions",
  // Notifications
  "notification_history",
  // Social
  "accountability_partners",
  "social_nudges",
  // AI
  "ai_coach_conversations",
  "weekly_recaps",
  "pattern_insights",
  // Achievements
  "user_achievements",
  // Blog
  "blog_posts",
  // Admin broadcasts
  "notifications"
] as const;

type RealtimeTable = (typeof REALTIME_TABLES)[number];

// Connection states
type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

// Singleton instance
let instance: RealtimeService | null = null;

/**
 * Realtime Service Class
 */
class RealtimeService {
  private channel: RealtimeChannel | null = null;
  private queryClient: QueryClient | null = null;
  private connectionState: ConnectionState = "disconnected";
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private userId: string | null = null;
  private appStateSubscription: { remove: () => void } | null = null;
  private lastAppState: AppStateStatus = "active";
  private isReconnecting = false;
  private reconnectDebounceTimeout: ReturnType<typeof setTimeout> | null = null;

  // Track last processed AI coach message to avoid duplicate updates
  private lastProcessedAIMessageAt: string | null = null;

  // Health check to detect stale connections
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private readonly HEALTH_CHECK_INTERVAL_MS = 60000; // Check every 60 seconds
  private lastHealthCheckSuccess: number = Date.now();
  private readonly STALE_THRESHOLD_MS = 120000; // Consider stale after 2 minutes of failed checks

  // User activity tracking for stale refresh
  private lastUserActivity: number = Date.now();
  private readonly INACTIVITY_THRESHOLD_MS = 300000; // 5 minutes of inactivity

  /**
   * Initialize the realtime service with QueryClient
   * Call this once when app starts (before user is authenticated)
   */
  initialize(queryClient: QueryClient) {
    this.queryClient = queryClient;
    this.setupAppStateListener();
  }

  /**
   * Start realtime subscriptions for a user
   * Call this after user is authenticated
   */
  async startForUser(userId: string) {
    if (this.channel && this.userId === userId) {
      logger.debug("[Realtime] Already started for this user");
      return;
    }

    this.cleanup(false);
    this.userId = userId;

    console.info("[Realtime] Starting for user:", userId);
    await this.connect();
  }

  /**
   * Setup AppState listener to handle app backgrounding/foregrounding
   */
  private setupAppStateListener() {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }

    this.appStateSubscription = AppState.addEventListener(
      "change",
      this.handleAppStateChange.bind(this)
    );

    console.log("[Realtime] 📱 AppState listener initialized");
  }

  /**
   * Handle app state changes (foreground/background)
   * Only reconnect when coming from "background" state, not "inactive" (Control Center, notifications, etc.)
   */
  private async handleAppStateChange(nextAppState: AppStateStatus) {
    const previousState = this.lastAppState;
    this.lastAppState = nextAppState;

    // Only reconnect when transitioning from "background" to "active"
    // "inactive" -> "active" transitions (Control Center, notifications) should NOT trigger reconnection
    if (nextAppState === "active" && previousState === "background") {
      console.log(`[Realtime] 📱 App came to foreground (was: ${previousState})`);

      // Clear any pending debounce
      if (this.reconnectDebounceTimeout) {
        clearTimeout(this.reconnectDebounceTimeout);
        this.reconnectDebounceTimeout = null;
      }

      // Debounce reconnection to prevent rapid reconnections
      this.reconnectDebounceTimeout = setTimeout(async () => {
        if (this.userId && this.connectionState !== "connected" && !this.isReconnecting) {
          console.log("[Realtime] 🔄 Connection lost, reconnecting...");
          await this.reconnectAfterBackground();
        }
        this.reconnectDebounceTimeout = null;
      }, 500); // 500ms debounce
    }
  }

  /**
   * Reconnect after app comes back from background
   */
  private async reconnectAfterBackground() {
    if (!this.userId || this.isReconnecting) return;

    // Prevent multiple simultaneous reconnection attempts
    this.isReconnecting = true;

    // Save userId before stopping (stop() clears it by default)
    const savedUserId = this.userId;

    console.log("[Realtime] 🔄 Reconnecting after background for user:", savedUserId);

    try {
      // Refresh auth token first
      try {
        const accessToken = await TokenManager.getAccessToken();
        const refreshToken = await TokenManager.getRefreshToken();

        if (accessToken && supabase) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || ""
          });
        }
      } catch (error) {
        console.log("[Realtime] ⚠️ Token refresh error, continuing anyway:", error);
      }

      // Stop connection but preserve userId (pass false)
      this.stop(false);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Use saved userId to reconnect
      await this.startForUser(savedUserId);
    } catch (error) {
      console.error("[Realtime] ❌ Reconnection failed:", error);
    } finally {
      this.isReconnecting = false;
    }
  }

  /**
   * Connect to realtime channels
   * Note: We use a single channel with multiple filters instead of per-table subscriptions
   * to reduce connection overhead
   */
  private async connect() {
    if (!this.userId) {
      logger.warn("[Realtime] No user ID, skipping connection");
      return;
    }

    this.connectionState = "connecting";

    try {
      if (!supabase) {
        logger.error("[Realtime] Supabase client not initialized");
        return;
      }

      // Set the user's session on Supabase client for RLS
      try {
        const accessToken = await TokenManager.getAccessToken();
        const refreshToken = await TokenManager.getRefreshToken();

        if (accessToken && supabase) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || ""
          });

          if (error) {
            logger.warn("[Realtime] Failed to set session, continuing anyway:", {
              error: error.message
            });
          } else {
            logger.info("[Realtime] Session set successfully for RLS");
          }
        }
      } catch (error) {
        logger.warn("[Realtime] Session setup error, continuing anyway:", {
          error: String(error)
        });
      }

      // Create channel with subscriptions for each table
      // NOTE: We do NOT use filters because Supabase realtime filters
      // don't work reliably for DELETE events (old record doesn't include user_id)
      // Instead, RLS on the server side ensures we only receive our own events
      this.channel = supabase
        .channel(`user-${this.userId}`)
        // Subscribe to each table without filters - RLS handles security
        .on("postgres_changes", { event: "*", schema: "public", table: "goals" }, (payload) =>
          this.handleChange("goals", payload)
        )
        .on("postgres_changes", { event: "*", schema: "public", table: "check_ins" }, (payload) =>
          this.handleChange("check_ins", payload)
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "daily_checkin_summaries" },
          (payload) => this.handleChange("daily_checkin_summaries", payload)
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "daily_motivations" },
          (payload) => this.handleChange("daily_motivations", payload)
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "subscriptions" },
          (payload) => this.handleChange("subscriptions", payload)
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notification_history" },
          (payload) => this.handleChange("notification_history", payload)
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "accountability_partners" },
          (payload) => this.handleChange("accountability_partners", payload)
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "social_nudges" },
          (payload) => this.handleChange("social_nudges", payload)
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "ai_coach_conversations" },
          (payload) => this.handleChange("ai_coach_conversations", payload)
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "weekly_recaps" },
          (payload) => this.handleChange("weekly_recaps", payload)
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "pattern_insights" },
          (payload) => this.handleChange("pattern_insights", payload)
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_achievements" },
          (payload) => this.handleChange("user_achievements", payload)
        )
        .on("postgres_changes", { event: "*", schema: "public", table: "blog_posts" }, (payload) =>
          this.handleChange("blog_posts", payload)
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications" },
          (payload) => this.handleChange("notifications", payload)
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "users", filter: `id=eq.${this.userId}` },
          (payload) => this.handleUserChange(payload)
        )
        .subscribe((status) => {
          this.handleSubscriptionStatus(status);
        });

      logger.info("[Realtime] Channel created with table subscriptions");
    } catch (error) {
      logger.error("[Realtime] Connection error", { error: String(error) });
      this.connectionState = "error";
      this.scheduleReconnect();
    }
  }

  /**
   * Handle subscription status changes
   */
  private handleSubscriptionStatus(status: `${REALTIME_SUBSCRIBE_STATES}`) {
    logger.debug("[Realtime] Subscription status", { status });

    switch (status) {
      case "SUBSCRIBED":
        this.connectionState = "connected";
        this.reconnectAttempts = 0;
        this.startHealthCheck();
        logger.info("[Realtime] Connected successfully");
        break;
      case "CHANNEL_ERROR":
      case "TIMED_OUT":
        this.connectionState = "error";
        this.scheduleReconnect();
        break;
      case "CLOSED":
        this.connectionState = "disconnected";
        break;
    }
  }

  /**
   * Handle database changes - route to specific handlers
   */
  private handleChange(table: RealtimeTable, payload: RealtimePostgresChangesPayload<any>) {
    logger.debug("[Realtime] Change received:", { table, event: payload.eventType });

    if (!this.queryClient) {
      console.warn(
        "[Realtime] ⚠️ QueryClient not initialized! Call realtimeService.initialize(queryClient) before start().",
        "Event ignored:",
        { table, event: payload.eventType }
      );
      return;
    }

    switch (table) {
      case "goals":
        this.handleGoalsChange(payload);
        break;
      case "check_ins":
        this.handleCheckInsChange(payload);
        break;
      case "daily_checkin_summaries":
        this.handleDailyCheckinSummariesChange(payload);
        break;
      case "daily_motivations":
        this.handleDailyMotivationsChange(payload);
        break;
      case "subscriptions":
        this.handleSubscriptionChange(payload);
        break;
      case "notification_history":
        this.handleNotificationHistoryChange(payload);
        break;
      case "accountability_partners":
        this.handleAccountabilityPartnersChange(payload);
        break;
      case "social_nudges":
        this.handleSocialNudgesChange(payload);
        break;
      case "ai_coach_conversations":
        this.handleAICoachConversationsChange(payload);
        break;
      case "weekly_recaps":
        this.handleWeeklyRecapsChange(payload);
        break;
      case "pattern_insights":
        this.handlePatternInsightsChange(payload);
        break;
      case "user_achievements":
        this.handleUserAchievementsChange(payload);
        break;
      case "blog_posts":
        this.handleBlogPostsChange(payload);
        break;
      case "notifications":
        this.handleNotificationsChange(payload);
        break;
    }
  }

  // ========================================
  // USER STATUS CHANGES (SECURITY CRITICAL)
  // ========================================

  /**
   * Handle user record changes - force logout if banned/suspended
   */
  private async handleUserChange(payload: RealtimePostgresChangesPayload<any>) {
    const oldRecord = payload.old as any;
    const newRecord = payload.new as any;

    // Handle DELETE - force logout
    if (payload.eventType === "DELETE") {
      console.log(`[Realtime] 🚨 User deleted, forcing logout`);
      await handleAutoLogout("disabled");
      return;
    }

    // Handle UPDATE
    const oldStatus = oldRecord?.status;
    const newStatus = newRecord?.status;

    // Check for ban/suspend
    if (oldStatus === "active" && (newStatus === "disabled" || newStatus === "suspended")) {
      console.log(`[Realtime] 🚨 User status changed to ${newStatus}, forcing logout`);
      await handleAutoLogout(newStatus as "disabled" | "suspended");
      return;
    }

    // Handle plan changes
    const oldPlan = oldRecord?.plan;
    const newPlan = newRecord?.plan;
    if (newPlan && oldPlan !== newPlan) {
      const currentUser = useAuthStore.getState().user;
      if (currentUser && currentUser.plan !== newPlan) {
        console.log(`[Realtime] 📝 User plan updated: ${oldPlan} → ${newPlan}`);
        useAuthStore.getState().updateUser({ plan: newPlan });
        useSubscriptionStore.getState().refresh();
      }
    }

    // Invalidate user query for any update
    if (this.queryClient) {
      await this.queryClient.cancelQueries({ queryKey: userQueryKeys.currentUser });
      this.queryClient.invalidateQueries({ queryKey: userQueryKeys.currentUser });
      this.queryClient.refetchQueries({ queryKey: userQueryKeys.currentUser, type: "active" });
    }
  }

  // ========================================
  // GOALS - Optimistic updates with proper patterns
  // ========================================

  private async handleGoalsChange(payload: RealtimePostgresChangesPayload<any>) {
    if (!this.queryClient) return;

    const newRecord = payload.new as any;
    const oldRecord = payload.old as any;
    const goalId = newRecord?.id || oldRecord?.id;

    console.log(`[Realtime] 🎯 Goals ${payload.eventType}`, { goalId: goalId?.substring(0, 8) });

    // =====================================================
    // CRITICAL: Cancel queries before any cache updates
    // This prevents race conditions from in-flight requests
    // =====================================================
    await this.queryClient.cancelQueries({ queryKey: goalsQueryKeys.list() });
    await this.queryClient.cancelQueries({ queryKey: goalsQueryKeys.active() });
    await this.queryClient.cancelQueries({ queryKey: goalsQueryKeys.archived() });
    await this.queryClient.cancelQueries({ queryKey: goalsQueryKeys.summary() });
    if (goalId) {
      await this.queryClient.cancelQueries({ queryKey: goalsQueryKeys.detail(goalId) });
    }

    if (payload.eventType === "INSERT") {
      // Add to goals list cache if not already there
      this.queryClient.setQueryData(goalsQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;

        // Skip if already exists (from optimistic update by mutation)
        const existsById = old.data.some((g: any) => g.id === newRecord?.id);
        if (existsById) {
          console.log(`[Realtime]   ⏭️ Skipping - already exists`);
          return old;
        }

        // Skip if temp-ID exists (mutation in progress, let it handle replacement)
        const hasTempId = old.data.some((g: any) => g.id?.startsWith?.("temp-"));
        if (hasTempId) {
          const idx = old.data.findIndex((g: any) => g.id?.startsWith?.("temp-"));
          if (idx >= 0) {
            const next = [...old.data];
            next[idx] = newRecord;
            console.log(`[Realtime]   ✅ Replacing temp-ID in goals list`);
            return { ...old, data: next };
          }
          return old;
        }

        console.log(`[Realtime]   ✅ Adding to goals list cache`);
        return { ...old, data: [newRecord, ...old.data] };
      });

      // Add to active goals if active
      if (newRecord?.status === "active") {
        this.queryClient.setQueryData(goalsQueryKeys.active(), (old: any) => {
          if (!old?.data) return old;
          const existsById = old.data.some((g: any) => g.id === newRecord?.id);
          if (existsById) return old;
          const hasTempId = old.data.some((g: any) => g.id?.startsWith?.("temp-"));
          if (hasTempId) {
            const idx = old.data.findIndex((g: any) => g.id?.startsWith?.("temp-"));
            if (idx >= 0) {
              const next = [...old.data];
              next[idx] = newRecord;
              return { ...old, data: next };
            }
            return old;
          }
          return { ...old, data: [newRecord, ...old.data] };
        });
      }

      // Invalidate to get server-computed fields
      this.queryClient.invalidateQueries({ queryKey: goalsQueryKeys.all });
      this.queryClient.invalidateQueries({ queryKey: goalsQueryKeys.summary() });
      this.queryClient.invalidateQueries({ queryKey: userQueryKeys.userStats() });
      this.queryClient.invalidateQueries({ queryKey: homeDashboardQueryKeys.dashboard() });
      // Invalidate analytics - new goal affects goal comparison
      this.queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.all });

      // Force refetch active queries for immediate update
      this.queryClient.refetchQueries({ queryKey: goalsQueryKeys.list(), type: "active" });
      this.queryClient.refetchQueries({ queryKey: goalsQueryKeys.active(), type: "active" });
      this.queryClient.refetchQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
        type: "active"
      });
    } else if (payload.eventType === "UPDATE") {
      const statusChanged = oldRecord?.status !== newRecord?.status;

      // Get complete goal from cache BEFORE updating (realtime newRecord may be partial)
      const listData = this.queryClient.getQueryData(goalsQueryKeys.list()) as any;
      const existingGoal = listData?.data?.find((g: any) => g.id === newRecord?.id);
      const completeGoal = existingGoal ? { ...existingGoal, ...newRecord } : newRecord;

      // Update in goals list cache
      // Also handle temp ID replacement and duplicate prevention
      this.queryClient.setQueryData(goalsQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;

        let found = false;
        const updated = {
          ...old,
          data: old.data
            .map((g: any) => {
              // If this is the exact goal being updated (by real ID), update it
              if (g.id === newRecord?.id) {
                found = true;
                return { ...g, ...newRecord };
              }
              // Also check if this is a temp ID that should be replaced (optimistic update)
              // Match by checking if we have a temp goal and the real goal matches it
              if (g.id?.startsWith?.("temp-")) {
                // If the realtime UPDATE is for a goal that was just created, replace the temp ID
                // We can't match by date/field like check-ins, so we'll replace the first temp ID
                // The mutation's onSuccess should handle this, but this is a safety net
                found = true;
                return { ...g, ...newRecord };
              }
              // Remove any other entries with the same real ID (duplicates) - but keep temp IDs
              if (g.id === newRecord?.id && !g.id?.startsWith?.("temp-")) {
                return null; // Mark for removal
              }
              return g;
            })
            .filter((g: any) => g !== null) // Remove nulls (duplicates)
        };

        return updated;
      });

      // Handle status changes for active/archived caches
      if (statusChanged) {
        console.log(`[Realtime]   🔄 Status changed: ${oldRecord?.status} → ${newRecord?.status}`);

        if (newRecord?.status === "active") {
          // Add to active goals, remove from archived and completed
          this.queryClient.setQueryData(goalsQueryKeys.active(), (old: any) => {
            if (!old?.data) return old;
            const exists = old.data.some((g: any) => g.id === newRecord?.id);
            if (exists) {
              return {
                ...old,
                data: old.data.map((g: any) =>
                  g.id === newRecord?.id ? { ...g, ...newRecord } : g
                )
              };
            }
            return { ...old, data: [...old.data, completeGoal] };
          });
          this.queryClient.setQueryData(goalsQueryKeys.archived(), (old: any) => {
            if (!old?.data) return old;
            return { ...old, data: old.data.filter((g: any) => g.id !== newRecord?.id) };
          });
          this.queryClient.setQueryData(goalsQueryKeys.completed(), (old: any) => {
            if (!old?.data) return old;
            return { ...old, data: old.data.filter((g: any) => g.id !== newRecord?.id) };
          });
        } else if (newRecord?.status === "archived") {
          // Remove from active, add to archived
          this.queryClient.setQueryData(goalsQueryKeys.active(), (old: any) => {
            if (!old?.data) return old;
            return { ...old, data: old.data.filter((g: any) => g.id !== newRecord?.id) };
          });
          this.queryClient.setQueryData(goalsQueryKeys.completed(), (old: any) => {
            if (!old?.data) return old;
            return { ...old, data: old.data.filter((g: any) => g.id !== newRecord?.id) };
          });
          this.queryClient.setQueryData(goalsQueryKeys.archived(), (old: any) => {
            if (!old?.data) return { data: [completeGoal], status: 200 };
            const exists = old.data.some((g: any) => g.id === newRecord?.id);
            if (exists) {
              return {
                ...old,
                data: old.data.map((g: any) =>
                  g.id === newRecord?.id ? { ...g, ...newRecord } : g
                )
              };
            }
            return { ...old, data: [...old.data, completeGoal] };
          });
        } else if (newRecord?.status === "completed") {
          // Remove from active and archived, add to completed
          this.queryClient.setQueryData(goalsQueryKeys.active(), (old: any) => {
            if (!old?.data) return old;
            return { ...old, data: old.data.filter((g: any) => g.id !== newRecord?.id) };
          });
          this.queryClient.setQueryData(goalsQueryKeys.archived(), (old: any) => {
            if (!old?.data) return old;
            return { ...old, data: old.data.filter((g: any) => g.id !== newRecord?.id) };
          });
          this.queryClient.setQueryData(goalsQueryKeys.completed(), (old: any) => {
            if (!old?.data) return { data: [completeGoal], status: 200 };
            const exists = old.data.some((g: any) => g.id === newRecord?.id);
            if (exists) {
              return {
                ...old,
                data: old.data.map((g: any) =>
                  g.id === newRecord?.id ? { ...g, ...newRecord } : g
                )
              };
            }
            return { ...old, data: [...old.data, completeGoal] };
          });
        } else {
          // Paused status - remove from both active, archived, and completed
          this.queryClient.setQueryData(goalsQueryKeys.active(), (old: any) => {
            if (!old?.data) return old;
            return { ...old, data: old.data.filter((g: any) => g.id !== newRecord?.id) };
          });
          this.queryClient.setQueryData(goalsQueryKeys.archived(), (old: any) => {
            if (!old?.data) return old;
            return { ...old, data: old.data.filter((g: any) => g.id !== newRecord?.id) };
          });
          this.queryClient.setQueryData(goalsQueryKeys.completed(), (old: any) => {
            if (!old?.data) return old;
            return { ...old, data: old.data.filter((g: any) => g.id !== newRecord?.id) };
          });
        }
      } else {
        // Just update in place if no status change
        // Also handle temp ID replacement and duplicate prevention
        this.queryClient.setQueryData(goalsQueryKeys.active(), (old: any) => {
          if (!old?.data) return old;
          let found = false;
          const updated = {
            ...old,
            data: old.data
              .map((g: any) => {
                if (g.id === newRecord?.id) {
                  found = true;
                  return { ...g, ...newRecord };
                }
                // Replace temp ID if this is the real goal
                if (g.id?.startsWith?.("temp-")) {
                  found = true;
                  return { ...g, ...newRecord };
                }
                // Remove duplicates
                if (g.id === newRecord?.id && !g.id?.startsWith?.("temp-")) {
                  return null;
                }
                return g;
              })
              .filter((g: any) => g !== null)
          };
          return updated;
        });
        this.queryClient.setQueryData(goalsQueryKeys.archived(), (old: any) => {
          if (!old?.data) return old;
          let found = false;
          const updated = {
            ...old,
            data: old.data
              .map((g: any) => {
                if (g.id === newRecord?.id) {
                  found = true;
                  return { ...g, ...newRecord };
                }
                // Replace temp ID if this is the real goal
                if (g.id?.startsWith?.("temp-")) {
                  found = true;
                  return { ...g, ...newRecord };
                }
                // Remove duplicates
                if (g.id === newRecord?.id && !g.id?.startsWith?.("temp-")) {
                  return null;
                }
                return g;
              })
              .filter((g: any) => g !== null)
          };
          return updated;
        });
        this.queryClient.setQueryData(goalsQueryKeys.completed(), (old: any) => {
          if (!old?.data) return old;
          let found = false;
          const updated = {
            ...old,
            data: old.data
              .map((g: any) => {
                if (g.id === newRecord?.id) {
                  found = true;
                  return { ...g, ...newRecord };
                }
                // Replace temp ID if this is the real goal
                if (g.id?.startsWith?.("temp-")) {
                  found = true;
                  return { ...g, ...newRecord };
                }
                // Remove duplicates
                if (g.id === newRecord?.id && !g.id?.startsWith?.("temp-")) {
                  return null;
                }
                return g;
              })
              .filter((g: any) => g !== null)
          };
          return updated;
        });
      }

      // Update detail cache if exists
      this.queryClient.setQueryData(goalsQueryKeys.detail(goalId), (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: { ...old.data, ...newRecord } };
      });

      // Invalidate related queries
      this.queryClient.invalidateQueries({ queryKey: goalsQueryKeys.all });
      this.queryClient.invalidateQueries({ queryKey: goalsQueryKeys.summary() });
      this.queryClient.invalidateQueries({ queryKey: userQueryKeys.userStats() });
      this.queryClient.invalidateQueries({ queryKey: homeDashboardQueryKeys.dashboard() });

      // Force refetch for status changes
      if (statusChanged) {
        this.queryClient.refetchQueries({ queryKey: goalsQueryKeys.list(), type: "active" });
        this.queryClient.refetchQueries({ queryKey: goalsQueryKeys.active(), type: "active" });
        this.queryClient.refetchQueries({ queryKey: goalsQueryKeys.archived(), type: "active" });
        this.queryClient.refetchQueries({ queryKey: goalsQueryKeys.completed(), type: "active" });
      }
      this.queryClient.refetchQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
        type: "active"
      });
    } else if (payload.eventType === "DELETE") {
      // Remove from all goal lists
      this.queryClient.setQueryData(goalsQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.filter((g: any) => g.id !== oldRecord?.id) };
      });

      this.queryClient.setQueryData(goalsQueryKeys.active(), (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.filter((g: any) => g.id !== oldRecord?.id) };
      });

      this.queryClient.setQueryData(goalsQueryKeys.archived(), (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.filter((g: any) => g.id !== oldRecord?.id) };
      });

      // Remove detail and stats cache
      this.queryClient.removeQueries({ queryKey: goalsQueryKeys.detail(oldRecord?.id) });
      this.queryClient.removeQueries({ queryKey: goalsQueryKeys.stats(oldRecord?.id) });

      // Invalidate and refetch related queries
      this.queryClient.invalidateQueries({ queryKey: goalsQueryKeys.all });
      this.queryClient.invalidateQueries({ queryKey: goalsQueryKeys.summary() });
      this.queryClient.invalidateQueries({ queryKey: userQueryKeys.userStats() });
      this.queryClient.invalidateQueries({ queryKey: homeDashboardQueryKeys.dashboard() });
      this.queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.all });
      // Invalidate analytics - goal deletion affects goal comparison
      this.queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.all });

      this.queryClient.refetchQueries({ queryKey: goalsQueryKeys.list(), type: "active" });
      this.queryClient.refetchQueries({ queryKey: goalsQueryKeys.active(), type: "active" });
      this.queryClient.refetchQueries({ queryKey: goalsQueryKeys.archived(), type: "active" });
      this.queryClient.refetchQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
        type: "active"
      });
    }
  }

  // ========================================
  // CHECK-INS - Optimistic updates
  // ========================================

  private async prefetchLatestAnalytics() {
    if (!this.queryClient) return;
    const { hasFeature } = useSubscriptionStore.getState();
    if (!hasFeature("advanced_analytics")) return;
    let params = getLastAnalyticsParams();

    // If user hasn't visited Analytics yet, fall back to first active goal + 30d
    if (!params) {
      const activeGoalsCache = this.queryClient.getQueryData(goalsQueryKeys.active()) as any;
      const listGoalsCache = this.queryClient.getQueryData(goalsQueryKeys.list()) as any;
      const activeGoals = activeGoalsCache?.data ?? [];
      const listGoals = listGoalsCache?.data ?? [];
      const firstGoalId = activeGoals[0]?.id ?? listGoals[0]?.id;
      if (!firstGoalId) return;
      params = { goalId: firstGoalId, days: 30 };
    }

    const { goalId, days } = params;
    const ranges: Array<30 | 90 | 180> = [30, 90, 180];

    try {
      for (const range of ranges) {
        // Skip Redis cache so background refresh is truly fresh
        const response = await analyticsService.getDashboard(goalId, range, true);

        if (response.error || !response.data) {
          throw new Error(response.error || "Failed to fetch analytics");
        }
        // Force-update cache even if previous data was still fresh
        this.queryClient.setQueryData(analyticsQueryKeys.dashboard(goalId, range), response.data);
      }
    } catch (error) {
      logger.debug("[Realtime] Analytics prefetch failed", { error });
    }
  }

  private async handleCheckInsChange(payload: RealtimePostgresChangesPayload<any>) {
    if (!this.queryClient) return;

    const newRecord = payload.new as any;
    const oldRecord = payload.old as any;
    const checkInId = newRecord?.id || oldRecord?.id;

    // For DELETE events, Supabase only exposes `id` in oldRecord
    // Look up goal_id from cached data before removal
    let goalId = newRecord?.goal_id || oldRecord?.goal_id;

    if (!goalId && payload.eventType === "DELETE" && oldRecord?.id) {
      // Try to find goalId from today's check-ins cache first
      const todayCache = this.queryClient.getQueryData(checkInsQueryKeys.today()) as any;
      const cachedCheckIn = todayCache?.data?.find((c: any) => c.id === oldRecord.id);
      goalId = cachedCheckIn?.goal_id;

      // If not in today's cache, search all goal-specific check-in caches
      if (!goalId) {
        const allQueries = this.queryClient.getQueriesData({ queryKey: checkInsQueryKeys.all });
        for (const [, data] of allQueries) {
          const queryData = data as any;
          const found = queryData?.data?.find?.((c: any) => c.id === oldRecord.id);
          if (found?.goal_id) {
            goalId = found.goal_id;
            break;
          }
        }
      }
    }

    console.log(`[Realtime] ✅ Check-ins ${payload.eventType}`, {
      checkInId: checkInId?.substring(0, 8),
      goalId: goalId?.substring(0, 8)
    });

    const skipInsightsRefresh =
      !!goalId &&
      (() => {
        const cached = this.queryClient.getQueryData(goalsQueryKeys.insights(goalId)) as any;
        return (
          cached?.data?.status === "insufficient_data" &&
          typeof cached?.data?.checkins_count === "number"
        );
      })();

    // Cancel queries before updates
    await this.queryClient.cancelQueries({ queryKey: checkInsQueryKeys.today() });
    await this.queryClient.cancelQueries({ queryKey: checkInsQueryKeys.stats() });
    if (goalId) {
      await this.queryClient.cancelQueries({ queryKey: checkInsQueryKeys.list(goalId) });
      await this.queryClient.cancelQueries({ queryKey: checkInsQueryKeys.streak(goalId) });
      await this.queryClient.cancelQueries({ queryKey: goalsQueryKeys.detail(goalId) });
    }

    if (payload.eventType === "INSERT") {
      // Add to today's check-ins cache
      this.queryClient.setQueryData(checkInsQueryKeys.today(), (old: any) => {
        if (!old?.data) return old;

        const existsById = old.data.some((c: any) => c.id === newRecord?.id);
        if (existsById) return old;

        const hasTempId = old.data.some((c: any) => c.id?.startsWith?.("temp-"));
        if (hasTempId) {
          const idx = old.data.findIndex((c: any) => c.id?.startsWith?.("temp-"));
          if (idx >= 0) {
            const next = [...old.data];
            next[idx] = newRecord;
            return { ...old, data: next };
          }
          return old;
        }

        return { ...old, data: [newRecord, ...old.data] };
      });

      // Add to goal-specific check-ins if applicable
      if (goalId) {
        this.queryClient.setQueryData(checkInsQueryKeys.list(goalId), (old: any) => {
          if (!old?.data) return old;
          // Skip if this exact ID already exists
          const existsById = old.data.some((c: any) => c.id === newRecord?.id);
          if (existsById) return old;
          // Skip if there's an optimistic (temp) check-in - onSuccess will handle replacement
          const hasTempId = old.data.some((c: any) => c.id?.startsWith?.("temp-"));
          if (hasTempId) {
            const idx = old.data.findIndex((c: any) => c.id?.startsWith?.("temp-"));
            if (idx >= 0) {
              const next = [...old.data];
              next[idx] = newRecord;
              return { ...old, data: next };
            }
            return old;
          }
          return { ...old, data: [newRecord, ...old.data] };
        });
      }

      // Invalidate related queries
      this.queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.all });
      this.queryClient.invalidateQueries({ queryKey: goalsQueryKeys.list() });
      this.queryClient.invalidateQueries({ queryKey: goalsQueryKeys.active() });
      this.queryClient.invalidateQueries({ queryKey: homeDashboardQueryKeys.dashboard() });
      // Invalidate analytics - check-ins affect all analytics metrics
      this.queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.all });
      // Note: Partner invalidation is handled by DB trigger → accountability_partners → handleAccountabilityPartnersChange
      if (goalId) {
        this.queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.streak(goalId) });
        this.queryClient.invalidateQueries({ queryKey: goalsQueryKeys.detail(goalId) });
        // Invalidate insights - new check-ins may trigger insight generation
        if (!skipInsightsRefresh) {
          this.queryClient.invalidateQueries({ queryKey: goalsQueryKeys.insights(goalId) });
        }
      }

      // Force refetch for immediate UI update
      this.queryClient.refetchQueries({ queryKey: checkInsQueryKeys.today(), type: "active" });
      this.queryClient.refetchQueries({ queryKey: checkInsQueryKeys.all, type: "active" });
      this.queryClient.refetchQueries({ queryKey: goalsQueryKeys.list(), type: "active" });
      this.queryClient.refetchQueries({ queryKey: goalsQueryKeys.active(), type: "active" });
      this.queryClient.refetchQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
        type: "active"
      });
      this.queryClient.refetchQueries({ queryKey: analyticsQueryKeys.all, type: "active" });
      await this.prefetchLatestAnalytics();
      if (goalId) {
        this.queryClient.refetchQueries({
          queryKey: goalsQueryKeys.detail(goalId),
          type: "active"
        });
        if (!skipInsightsRefresh) {
          this.queryClient.refetchQueries({
            queryKey: goalsQueryKeys.insights(goalId),
            type: "active"
          });
        }
      }
    } else if (payload.eventType === "UPDATE") {
      console.log(`[Realtime] 🔄 Check-in UPDATE - Starting`, {
        checkInId: checkInId?.substring(0, 8),
        goalId: goalId?.substring(0, 8),
        newRecordDate: newRecord?.check_in_date,
        newRecordStatus: newRecord?.status
      });

      // Update in today's check-ins
      this.queryClient.setQueryData(checkInsQueryKeys.today(), (old: any) => {
        if (!old?.data) {
          console.log(`[Realtime]   📅 Today check-ins: no old data`);
          return old;
        }
        const beforeCount = old.data.length;

        // First try to find by real ID
        let found = false;
        const updated = {
          ...old,
          data: old.data.map((c: any) => {
            if (c.id === newRecord?.id) {
              found = true;
              return { ...c, ...newRecord };
            }
            // Also check if this is a temp ID for the same date+goal (optimistic update)
            if (
              c.id?.startsWith?.("temp-") &&
              c.check_in_date === newRecord?.check_in_date &&
              c.goal_id === newRecord?.goal_id
            ) {
              found = true;
              console.log(`[Realtime]   📅 Replacing temp ID with real ID:`, {
                tempId: c.id?.substring(0, 8),
                realId: newRecord?.id?.substring(0, 8),
                date: newRecord?.check_in_date
              });
              return { ...c, ...newRecord };
            }
            return c;
          })
        };

        // If not found, add it (shouldn't happen, but handle edge case)
        if (!found) {
          console.log(`[Realtime]   📅 Check-in not found in cache, adding:`, {
            id: newRecord?.id?.substring(0, 8),
            date: newRecord?.check_in_date
          });
          updated.data.push(newRecord);
        }

        const afterCount = updated.data.length;
        console.log(`[Realtime]   📅 Today check-ins: ${beforeCount} → ${afterCount}`, {
          beforeIds: old.data.map((c: any) => c.id?.substring(0, 8)),
          afterIds: updated.data.map((c: any) => c.id?.substring(0, 8)),
          dates: updated.data.map((c: any) => c.check_in_date)
        });
        return updated;
      });

      // Update in goal-specific check-ins
      if (goalId) {
        this.queryClient.setQueryData(checkInsQueryKeys.list(goalId), (old: any) => {
          if (!old?.data) {
            console.log(`[Realtime]   📋 Goal check-ins list: no old data`);
            return old;
          }
          const beforeCount = old.data.length;
          const beforeIds = old.data.map((c: any) => c.id?.substring(0, 8));
          const beforeDates = old.data.map((c: any) => c.check_in_date);

          // Log all temp IDs in cache before update
          const tempIds = old.data
            .filter((c: any) => c.id?.startsWith?.("temp-"))
            .map((c: any) => ({
              id: c.id?.substring(0, 8),
              date: c.check_in_date,
              goalId: c.goal_id?.substring(0, 8)
            }));
          if (tempIds.length > 0) {
            console.log(`[Realtime]   📋 Temp IDs in cache before update:`, tempIds);
          }

          // First try to find by real ID, then by temp ID + date+goal match
          // Also check for duplicates with the same real ID and remove them
          let found = false;
          let replacedTempId = false;
          const updated = {
            ...old,
            data: old.data
              .map((c: any) => {
                // If this is the exact check-in being updated (by real ID), update it
                if (c.id === newRecord?.id) {
                  found = true;
                  return { ...c, ...newRecord };
                }
                // Also check if this is a temp ID for the same date+goal (optimistic update)
                if (
                  c.id?.startsWith?.("temp-") &&
                  c.check_in_date === newRecord?.check_in_date &&
                  c.goal_id === newRecord?.goal_id
                ) {
                  found = true;
                  replacedTempId = true;
                  console.log(`[Realtime]   📋 Replacing temp ID with real ID:`, {
                    tempId: c.id?.substring(0, 8),
                    realId: newRecord?.id?.substring(0, 8),
                    date: newRecord?.check_in_date,
                    tempDate: c.check_in_date,
                    tempGoalId: c.goal_id?.substring(0, 8),
                    newGoalId: newRecord?.goal_id?.substring(0, 8)
                  });
                  return { ...c, ...newRecord };
                }
                // Remove any other entries with the same real ID (duplicates) - but keep temp IDs
                if (c.id === newRecord?.id && !c.id?.startsWith?.("temp-")) {
                  console.log(`[Realtime]   📋 Removing duplicate check-in:`, {
                    id: c.id?.substring(0, 8),
                    date: c.check_in_date
                  });
                  return null; // Mark for removal
                }
                return c;
              })
              .filter((c: any) => c !== null) // Remove nulls (duplicates)
          };

          // If not found, add it (shouldn't happen, but handle edge case)
          if (!found) {
            updated.data.push(newRecord);
          }

          const afterCount = updated.data.length;
          const afterIds = updated.data.map((c: any) => c.id?.substring(0, 8));
          const afterDates = updated.data.map((c: any) => c.check_in_date);

          // Check if any check-ins were removed
          const removedIds = beforeIds.filter((id: string) => !afterIds.includes(id));
          const removedDates = beforeDates.filter(
            (date: string, idx: number) => !afterDates.includes(date)
          );

          return updated;
        });

        this.queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.streak(goalId) });
        this.queryClient.invalidateQueries({ queryKey: goalsQueryKeys.detail(goalId) });
        // Invalidate insights - check-in updates may affect insights
        if (!skipInsightsRefresh) {
          this.queryClient.invalidateQueries({ queryKey: goalsQueryKeys.insights(goalId) });
        }
      }

      // Invalidate related queries
      console.log(`[Realtime]   🔄 Invalidating related queries`);
      this.queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.stats() });
      this.queryClient.invalidateQueries({ queryKey: goalsQueryKeys.list() });
      this.queryClient.invalidateQueries({ queryKey: goalsQueryKeys.active() });
      this.queryClient.invalidateQueries({ queryKey: homeDashboardQueryKeys.dashboard() });
      // Invalidate analytics - check-in updates affect metrics
      this.queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.all });
      // Note: Partner invalidation is handled by DB trigger → accountability_partners → handleAccountabilityPartnersChange

      // Refetch everything SingleGoalScreen uses: check-ins (list + dateRange), goal detail, insights
      console.log(`[Realtime]   🔄 Starting refetchQueries for all active queries`);

      // Log cache state before refetch
      if (goalId) {
        const cacheBeforeRefetch = this.queryClient.getQueryData(
          checkInsQueryKeys.list(goalId)
        ) as any;
        console.log(`[Realtime]   📋 Cache BEFORE refetch:`, {
          count: cacheBeforeRefetch?.data?.length || 0,
          ids: cacheBeforeRefetch?.data?.map((c: any) => c.id?.substring(0, 8)) || [],
          dates: cacheBeforeRefetch?.data?.map((c: any) => c.check_in_date) || []
        });
      }

      this.queryClient.refetchQueries({ queryKey: checkInsQueryKeys.all, type: "active" });
      this.queryClient.refetchQueries({ queryKey: goalsQueryKeys.list(), type: "active" });
      this.queryClient.refetchQueries({ queryKey: goalsQueryKeys.active(), type: "active" });
      this.queryClient.refetchQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
        type: "active"
      });
      this.queryClient.refetchQueries({ queryKey: analyticsQueryKeys.all, type: "active" });
      await this.prefetchLatestAnalytics();
      if (goalId) {
        this.queryClient.refetchQueries({
          queryKey: goalsQueryKeys.detail(goalId),
          type: "active"
        });
        if (!skipInsightsRefresh) {
          this.queryClient.refetchQueries({
            queryKey: goalsQueryKeys.insights(goalId),
            type: "active"
          });
        }

        // Log cache state after refetch (with a small delay to catch async updates)
        setTimeout(() => {
          if (!this.queryClient || !goalId) return;
          const cacheAfterRefetch = this.queryClient.getQueryData(
            checkInsQueryKeys.list(goalId)
          ) as any;
          if (cacheAfterRefetch) {
            console.log(`[Realtime]   📋 Cache AFTER refetch:`, {
              count: cacheAfterRefetch.data?.length || 0,
              ids: cacheAfterRefetch.data?.map((c: any) => c.id?.substring(0, 8)) || [],
              dates: cacheAfterRefetch.data?.map((c: any) => c.check_in_date) || []
            });
          }
        }, 100);
      }

      console.log(`[Realtime]   ✅ Check-in UPDATE - Completed`);
    } else if (payload.eventType === "DELETE") {
      // Remove from today's check-ins
      this.queryClient.setQueryData(checkInsQueryKeys.today(), (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.filter((c: any) => c.id !== oldRecord?.id) };
      });

      // Remove from goal-specific check-ins
      if (goalId) {
        this.queryClient.setQueryData(checkInsQueryKeys.list(goalId), (old: any) => {
          if (!old?.data) return old;
          return { ...old, data: old.data.filter((c: any) => c.id !== oldRecord?.id) };
        });
        // Remove from any cached dateRange queries (used by SingleGoalScreen stats)
        const dateRangeQueries = this.queryClient.getQueriesData({
          queryKey: checkInsQueryKeys.all
        });
        for (const [key] of dateRangeQueries) {
          const k = key as unknown as (string | undefined)[];
          if (k[0] !== "checkIns" || k[1] !== "dateRange") continue;
          const rangeGoalId = k[4] as string | undefined;
          if (rangeGoalId !== goalId) continue;
          this.queryClient.setQueryData(key, (old: any) => {
            if (!old?.data) return old;
            return { ...old, data: old.data.filter((c: any) => c.id !== oldRecord?.id) };
          });
        }
        this.queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.streak(goalId) });
        this.queryClient.invalidateQueries({ queryKey: goalsQueryKeys.detail(goalId) });
        // Invalidate insights - check-in deletion may affect insights
        if (!skipInsightsRefresh) {
          this.queryClient.invalidateQueries({ queryKey: goalsQueryKeys.insights(goalId) });
        }
        // Optimistically decrement insights checkins_count if present
        this.queryClient.setQueryData(goalsQueryKeys.insights(goalId), (old: any) => {
          if (!old?.data) return old;
          if (typeof old.data.checkins_count !== "number") return old;
          return {
            ...old,
            data: {
              ...old.data,
              checkins_count: Math.max(0, old.data.checkins_count - 1)
            }
          };
        });
      }

      // Invalidate related queries
      this.queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.all });
      this.queryClient.invalidateQueries({ queryKey: goalsQueryKeys.list() });
      this.queryClient.invalidateQueries({ queryKey: goalsQueryKeys.active() });
      this.queryClient.invalidateQueries({ queryKey: homeDashboardQueryKeys.dashboard() });
      // Invalidate analytics - check-in deletion affects all metrics
      this.queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.all });
      // Note: Partner invalidation is handled by DB trigger → accountability_partners → handleAccountabilityPartnersChange

      // Refetch everything SingleGoalScreen uses: check-ins (today, list, dateRange), goal detail, insights
      this.queryClient.refetchQueries({ queryKey: checkInsQueryKeys.all, type: "active" });
      this.queryClient.refetchQueries({ queryKey: goalsQueryKeys.list(), type: "active" });
      this.queryClient.refetchQueries({ queryKey: goalsQueryKeys.active(), type: "active" });
      this.queryClient.refetchQueries({
        queryKey: homeDashboardQueryKeys.dashboard(),
        type: "active"
      });
      this.queryClient.refetchQueries({ queryKey: analyticsQueryKeys.all, type: "active" });
      await this.prefetchLatestAnalytics();
      if (goalId) {
        this.queryClient.refetchQueries({
          queryKey: goalsQueryKeys.detail(goalId),
          type: "active"
        });
        if (!skipInsightsRefresh) {
          this.queryClient.refetchQueries({
            queryKey: goalsQueryKeys.insights(goalId),
            type: "active"
          });
        }
      }
    }
  }

  // ========================================
  // DAILY CHECK-IN SUMMARIES
  // ========================================

  private async handleDailyCheckinSummariesChange(payload: RealtimePostgresChangesPayload<any>) {
    if (!this.queryClient) return;

    console.log(`[Realtime] 📊 Daily check-in summaries ${payload.eventType}`);

    // These are trigger-maintained - invalidate and refetch
    await this.queryClient.cancelQueries({ queryKey: homeDashboardQueryKeys.dashboard() });
    await this.queryClient.cancelQueries({ queryKey: goalsQueryKeys.all });

    this.queryClient.invalidateQueries({ queryKey: homeDashboardQueryKeys.dashboard() });
    this.queryClient.invalidateQueries({ queryKey: goalsQueryKeys.all });

    this.queryClient.refetchQueries({
      queryKey: homeDashboardQueryKeys.dashboard(),
      type: "active"
    });
    this.queryClient.refetchQueries({ queryKey: goalsQueryKeys.list(), type: "active" });
  }

  // ========================================
  // DAILY MOTIVATIONS
  // ========================================

  private async handleDailyMotivationsChange(payload: RealtimePostgresChangesPayload<any>) {
    if (!this.queryClient) return;

    const newRecord = payload.new as any;

    console.log(`[Realtime] 💡 Daily motivations ${payload.eventType}`);

    await this.queryClient.cancelQueries({ queryKey: dailyMotivationsQueryKeys.all });

    if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
      // Update cache directly for instant UI update
      this.queryClient.setQueryData(dailyMotivationsQueryKeys.today(), (old: any) => {
        if (!old) return newRecord;
        return { ...old, ...newRecord };
      });
    }

    // Invalidate to ensure fresh data
    this.queryClient.invalidateQueries({ queryKey: dailyMotivationsQueryKeys.all });
    this.queryClient.refetchQueries({
      queryKey: dailyMotivationsQueryKeys.today(),
      type: "active"
    });
  }

  // ========================================
  // SUBSCRIPTIONS (RevenueCat updates)
  // ========================================

  private async handleSubscriptionChange(payload: RealtimePostgresChangesPayload<any>) {
    const newRecord = payload.new as any;
    const oldRecord = payload.old as any;
    const newStatus = newRecord?.status;
    const newPlan = newRecord?.plan;

    console.log(`[Realtime] 💳 Subscription ${payload.eventType}:`, {
      oldStatus: oldRecord?.status,
      newStatus: newStatus,
      newPlan: newPlan
    });

    // IMPORTANT: Await refresh to ensure new features are loaded before continuing
    // This ensures hasFeature() returns correct values when components re-render
    await useSubscriptionStore.getState().refresh();
    console.log(`[Realtime]   ✅ Subscription store refreshed`);

    // Update user's plan based on subscription status
    const currentUser = useAuthStore.getState().user;
    if (currentUser) {
      if (newStatus === "active" && newPlan) {
        if (currentUser.plan !== newPlan) {
          console.log(
            `[Realtime]   📝 Subscription active, updating plan: ${currentUser.plan} → ${newPlan}`
          );
          useAuthStore.getState().updateUser({ plan: newPlan });
        }
      } else if (newStatus === "expired") {
        if (currentUser.plan !== "free") {
          console.log(`[Realtime]   📝 Subscription expired, downgrading to free`);
          useAuthStore.getState().updateUser({ plan: "free" });
        }
      }
    }

    // NOTE: No query invalidation needed here.
    // The subscriptionStore.refresh() above updates hasFeature() values.
    // Premium queries use enabled: hasFeature(...) which auto-fetches when enabled changes.
    // This avoids the bug where invalidateQueries() was emptying the pricingStore.
  }

  // ========================================
  // NOTIFICATION HISTORY - Optimistic updates
  // ========================================

  private async handleNotificationHistoryChange(payload: RealtimePostgresChangesPayload<any>) {
    if (!this.queryClient) return;

    const newRecord = payload.new as any;
    const oldRecord = payload.old as any;

    console.log(`[Realtime] 🔔 Notification history ${payload.eventType}`, {
      id: newRecord?.id?.substring(0, 8) || oldRecord?.id?.substring(0, 8)
    });

    await this.queryClient.cancelQueries({ queryKey: notificationHistoryQueryKeys.all });

    if (payload.eventType === "INSERT") {
      // Add to notification list (infinite query format)
      this.queryClient.setQueriesData(
        { queryKey: notificationHistoryQueryKeys.list() },
        (old: { pages: any[][]; pageParams: number[] } | undefined) => {
          if (!old?.pages) return undefined;
          const firstPage = old.pages[0] || [];
          const exists = firstPage.some((n: any) => n.id === newRecord?.id);
          if (exists) return old;
          return {
            ...old,
            pages: [[newRecord, ...firstPage], ...old.pages.slice(1)]
          };
        }
      );

      // Update unread count
      this.queryClient.setQueryData(
        notificationHistoryQueryKeys.unreadCount(),
        (old: any[] | undefined) => {
          if (!old) return [newRecord];
          const exists = old.some((n: any) => n.id === newRecord?.id);
          if (exists) return old;
          return [newRecord, ...old];
        }
      );

      // Force refetch for accurate counts
      this.queryClient.refetchQueries({ queryKey: notificationHistoryQueryKeys.unreadCount() });
      this.queryClient.refetchQueries({
        queryKey: notificationHistoryQueryKeys.list(),
        type: "active"
      });
    } else if (payload.eventType === "UPDATE") {
      // Update in infinite query pages
      this.queryClient.setQueriesData(
        { queryKey: notificationHistoryQueryKeys.list() },
        (old: { pages: any[][]; pageParams: number[] } | undefined) => {
          if (!old?.pages) return undefined;
          return {
            ...old,
            pages: old.pages.map((page: any[]) =>
              page.map((n: any) => (n.id === newRecord?.id ? { ...n, ...newRecord } : n))
            )
          };
        }
      );

      // Refresh unread count if opened_at changed
      if (newRecord?.opened_at) {
        this.queryClient.refetchQueries({ queryKey: notificationHistoryQueryKeys.unreadCount() });
      }
    } else if (payload.eventType === "DELETE") {
      // Remove from infinite query pages
      this.queryClient.setQueriesData(
        { queryKey: notificationHistoryQueryKeys.list() },
        (old: { pages: any[][]; pageParams: number[] } | undefined) => {
          if (!old?.pages) return undefined;
          return {
            ...old,
            pages: old.pages.map((page: any[]) => page.filter((n: any) => n.id !== oldRecord?.id))
          };
        }
      );

      // Refresh unread count
      this.queryClient.refetchQueries({ queryKey: notificationHistoryQueryKeys.unreadCount() });
    }
  }

  // ========================================
  // ACCOUNTABILITY PARTNERS - Optimistic updates
  // ========================================

  private async handleAccountabilityPartnersChange(payload: RealtimePostgresChangesPayload<any>) {
    if (!this.queryClient) return;

    const newRecord = payload.new as any;
    const oldRecord = payload.old as any;
    const partnershipId = newRecord?.id || oldRecord?.id;
    const status = newRecord?.status;

    console.log(`[Realtime] 👥 Partners ${payload.eventType}`, {
      id: partnershipId?.substring(0, 8),
      status
    });

    // Cancel queries before updates
    await this.queryClient.cancelQueries({ queryKey: partnersQueryKeys.all });

    if (payload.eventType === "DELETE") {
      // Look up partner from cache BEFORE removing (Supabase DELETE only provides id)
      const cachedList = this.queryClient.getQueryData(partnersQueryKeys.list()) as any;
      const deletedPartner = cachedList?.data?.find((p: any) => p.id === partnershipId);
      const partnerUserId = deletedPartner?.partner_user_id;

      // Remove dashboard cache for the deleted partner
      if (partnerUserId) {
        this.queryClient.removeQueries({ queryKey: partnersQueryKeys.dashboard(partnerUserId) });
      }

      // Remove from all partner caches (including blocked)
      this.queryClient.setQueryData(partnersQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.filter((p: any) => p.id !== partnershipId) };
      });

      this.queryClient.setQueryData(partnersQueryKeys.listWithGoals(), (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.filter((p: any) => p.id !== partnershipId) };
      });

      this.queryClient.setQueryData(partnersQueryKeys.pending(), (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.filter((p: any) => p.id !== partnershipId) };
      });

      this.queryClient.setQueryData(partnersQueryKeys.sent(), (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.filter((p: any) => p.id !== partnershipId) };
      });

      this.queryClient.setQueryData(partnersQueryKeys.blocked(), (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.filter((p: any) => p.id !== partnershipId) };
      });

      // Force refetch all partner-related queries
      // This includes search/suggested since blocked status affects visibility
      this.queryClient.invalidateQueries({ queryKey: partnersQueryKeys.all });
      this.queryClient.refetchQueries({ queryKey: partnersQueryKeys.list(), type: "active" });
      this.queryClient.refetchQueries({
        queryKey: partnersQueryKeys.listWithGoals(),
        type: "active"
      });
      this.queryClient.refetchQueries({ queryKey: partnersQueryKeys.pending(), type: "active" });
      this.queryClient.refetchQueries({ queryKey: partnersQueryKeys.sent(), type: "active" });
      this.queryClient.refetchQueries({ queryKey: partnersQueryKeys.blocked(), type: "active" });
      // Invalidate and refetch search/suggested - cancelled/rejected users should appear again
      this.queryClient.invalidateQueries({ queryKey: partnersQueryKeys.suggestedInfinite() });
      this.queryClient.invalidateQueries({ queryKey: partnersQueryKeys.searchInfinite("") });
      this.queryClient.refetchQueries({
        queryKey: partnersQueryKeys.suggestedInfinite(),
        type: "all"
      });
    } else if (payload.eventType === "UPDATE") {
      if (status === "accepted") {
        // Get partner info from pending/sent before removing
        const pendingData = this.queryClient.getQueryData(partnersQueryKeys.pending()) as any;
        const sentData = this.queryClient.getQueryData(partnersQueryKeys.sent()) as any;
        const currentUserId = useAuthStore.getState().user?.id;

        const existingFromPending = pendingData?.data?.find((p: any) => p.id === partnershipId);
        const existingFromSent = sentData?.data?.find((p: any) => p.id === partnershipId);

        // Build partner object from metadata if not in cache
        let partnerFromMetadata = null;
        if (newRecord?.partner_user_id === currentUserId) {
          // I am partner_user_id, so "partner" is user_*
          partnerFromMetadata = {
            id: newRecord.user_id,
            name: newRecord.user_name,
            username: newRecord.user_username,
            profile_picture_url: newRecord.user_profile_picture_url
          };
        } else {
          // I am user_id, so "partner" is partner_*
          partnerFromMetadata = {
            id: newRecord.partner_user_id,
            name: newRecord.partner_name,
            username: newRecord.partner_username,
            profile_picture_url: newRecord.partner_profile_picture_url
          };
        }

        // Normalize partner_user_id to always be the OTHER person (not current user)
        // This matches what the API returns and what navigation expects
        const normalizedPartnerUserId =
          newRecord?.partner_user_id === currentUserId
            ? newRecord.user_id
            : newRecord.partner_user_id;

        const mergedRecord = {
          ...(existingFromPending || existingFromSent || {}),
          ...newRecord,
          // Normalized partner_user_id - always the other person
          partner_user_id: normalizedPartnerUserId,
          // Use existing partner or build from metadata
          partner: existingFromPending?.partner || existingFromSent?.partner || partnerFromMetadata
        };

        // Remove from pending/sent
        this.queryClient.setQueryData(partnersQueryKeys.pending(), (old: any) => {
          if (!old?.data) return old;
          return { ...old, data: old.data.filter((p: any) => p.id !== partnershipId) };
        });

        this.queryClient.setQueryData(partnersQueryKeys.sent(), (old: any) => {
          if (!old?.data) return old;
          return { ...old, data: old.data.filter((p: any) => p.id !== partnershipId) };
        });

        // Add to partners list
        this.queryClient.setQueryData(partnersQueryKeys.list(), (old: any) => {
          if (!old?.data) return { data: [mergedRecord] };
          const existingInList = old.data.find((p: any) => p.id === partnershipId);
          if (existingInList) {
            return {
              ...old,
              data: old.data.map((p: any) =>
                p.id === partnershipId ? { ...p, ...mergedRecord } : p
              )
            };
          }
          return { ...old, data: [...old.data, mergedRecord] };
        });
      } else if (status === "rejected") {
        // Remove from pending and sent
        this.queryClient.setQueryData(partnersQueryKeys.pending(), (old: any) => {
          if (!old?.data) return old;
          return { ...old, data: old.data.filter((p: any) => p.id !== partnershipId) };
        });

        this.queryClient.setQueryData(partnersQueryKeys.sent(), (old: any) => {
          if (!old?.data) return old;
          return { ...old, data: old.data.filter((p: any) => p.id !== partnershipId) };
        });
      } else if (status === "blocked") {
        // Get partner info from partners list before removing
        const partnersListData = this.queryClient.getQueryData(partnersQueryKeys.list()) as any;
        const existingPartner = partnersListData?.data?.find((p: any) => p.id === partnershipId);
        const currentUserId = useAuthStore.getState().user?.id;
        const blockedBy = newRecord?.blocked_by;

        // Remove from partners lists (for both blocker and blocked user)
        this.queryClient.setQueryData(partnersQueryKeys.list(), (old: any) => {
          if (!old?.data) return old;
          return { ...old, data: old.data.filter((p: any) => p.id !== partnershipId) };
        });

        this.queryClient.setQueryData(partnersQueryKeys.listWithGoals(), (old: any) => {
          if (!old?.data) return old;
          return { ...old, data: old.data.filter((p: any) => p.id !== partnershipId) };
        });

        // Only add to blocked list if current user is the blocker
        if (blockedBy === currentUserId) {
          // Build partner object from metadata if not in cache
          let partnerFromMetadata = null;
          if (newRecord?.partner_user_id === currentUserId) {
            partnerFromMetadata = {
              id: newRecord.user_id,
              name: newRecord.user_name,
              username: newRecord.user_username,
              profile_picture_url: newRecord.user_profile_picture_url
            };
          } else {
            partnerFromMetadata = {
              id: newRecord.partner_user_id,
              name: newRecord.partner_name,
              username: newRecord.partner_username,
              profile_picture_url: newRecord.partner_profile_picture_url
            };
          }

          const mergedRecord = {
            ...(existingPartner || {}),
            ...newRecord,
            partner: existingPartner?.partner || partnerFromMetadata
          };

          // Add to blocked list (optimistic) - only for the blocker
          this.queryClient.setQueryData(partnersQueryKeys.blocked(), (old: any) => {
            if (!old?.data) return { data: [mergedRecord] };
            const exists = old.data.some((p: any) => p.id === partnershipId);
            if (exists) return old;
            return { ...old, data: [mergedRecord, ...old.data] };
          });

          // Invalidate blocked list to get fresh data with partner info
          this.queryClient.invalidateQueries({ queryKey: partnersQueryKeys.blocked() });
        }

        // Remove dashboard cache for the blocked partner (for both users)
        const partnerUserId = existingPartner?.partner_user_id;
        if (partnerUserId) {
          this.queryClient.removeQueries({ queryKey: partnersQueryKeys.dashboard(partnerUserId) });
        }

        // Invalidate suggested and search - blocked user should no longer appear (for both users)
        this.queryClient.invalidateQueries({ queryKey: partnersQueryKeys.suggestedInfinite() });
        this.queryClient.invalidateQueries({ queryKey: partnersQueryKeys.searchInfinite("") });
        this.queryClient.refetchQueries({
          queryKey: partnersQueryKeys.suggestedInfinite(),
          type: "all"
        });
      }

      // Invalidate to refresh
      this.queryClient.invalidateQueries({ queryKey: partnersQueryKeys.all });
      this.queryClient.refetchQueries({ queryKey: partnersQueryKeys.list(), type: "active" });
      this.queryClient.refetchQueries({
        queryKey: partnersQueryKeys.listWithGoals(),
        type: "active"
      });

      // Invalidate partner dashboard for the OTHER user (the partner whose data changed)
      // This handles the case when a partner's check-in triggers an update to accountability_partners
      const currentUserId = useAuthStore.getState().user?.id;
      if (newRecord) {
        // Figure out who the "partner" is (the other user in this partnership)
        const partnerUserId =
          newRecord.partner_user_id === currentUserId
            ? newRecord.user_id
            : newRecord.partner_user_id;
        if (partnerUserId) {
          this.queryClient.invalidateQueries({
            queryKey: partnersQueryKeys.dashboard(partnerUserId)
          });
          this.queryClient.refetchQueries({
            queryKey: partnersQueryKeys.dashboard(partnerUserId),
            type: "active"
          });
        }
      }
    } else if (payload.eventType === "INSERT") {
      // For pending requests, add to the correct cache
      if (newRecord?.status === "pending") {
        const currentUserId = useAuthStore.getState().user?.id;
        const partnerId = newRecord?.partner_user_id;
        const userId = newRecord?.user_id;

        // Transform the record to include the partner object from metadata
        // The DB trigger populates user_* and partner_* fields
        const enrichedRecord = { ...newRecord };

        // I am recipient (partner_user_id) - "partner" is the sender (user_*)
        if (partnerId === currentUserId) {
          enrichedRecord.partner = {
            id: newRecord.user_id,
            name: newRecord.user_name,
            username: newRecord.user_username,
            profile_picture_url: newRecord.user_profile_picture_url
          };
          this.queryClient.setQueryData(partnersQueryKeys.pending(), (old: any) => {
            if (!old?.data) return { data: [enrichedRecord] };
            const exists = old.data.some((p: any) => p.id === partnershipId);
            if (exists) return old;
            return { ...old, data: [enrichedRecord, ...old.data] };
          });
        }

        // I am sender (user_id) - "partner" is the receiver (partner_*)
        if (userId === currentUserId) {
          enrichedRecord.partner = {
            id: newRecord.partner_user_id,
            name: newRecord.partner_name,
            username: newRecord.partner_username,
            profile_picture_url: newRecord.partner_profile_picture_url
          };
          this.queryClient.setQueryData(partnersQueryKeys.sent(), (old: any) => {
            if (!old?.data) return { data: [enrichedRecord] };
            const exists = old.data.some((p: any) => p.id === partnershipId);
            if (exists) return old;
            return { ...old, data: [enrichedRecord, ...old.data] };
          });
        }
      }

      // Invalidate and refetch to get full partner info
      this.queryClient.invalidateQueries({ queryKey: partnersQueryKeys.all });
      this.queryClient.refetchQueries({ queryKey: partnersQueryKeys.pending(), type: "all" });
      this.queryClient.refetchQueries({ queryKey: partnersQueryKeys.sent(), type: "all" });
      this.queryClient.refetchQueries({ queryKey: partnersQueryKeys.list(), type: "all" });
      this.queryClient.refetchQueries({ queryKey: partnersQueryKeys.listWithGoals(), type: "all" });
    }
  }

  // ========================================
  // SOCIAL NUDGES - Optimistic updates
  // ========================================

  private async handleSocialNudgesChange(payload: RealtimePostgresChangesPayload<any>) {
    if (!this.queryClient) return;

    const newRecord = payload.new as any;
    const oldRecord = payload.old as any;
    const nudgeId = newRecord?.id || oldRecord?.id;

    console.log(`[Realtime] 💬 Social nudge ${payload.eventType}`, {
      id: nudgeId?.substring(0, 8)
    });

    await this.queryClient.cancelQueries({ queryKey: nudgesQueryKeys.all });

    if (payload.eventType === "INSERT") {
      // Try to get sender info from partners cache as fallback
      let senderInfoFromPartners: any = null;
      try {
        const partnersData = this.queryClient.getQueryData(partnersQueryKeys.list()) as any;
        if (partnersData?.data) {
          // Partners list contains partner_user info - find the one matching sender_id
          const partnerEntry = partnersData.data.find((p: any) => {
            const partnerInfo = p.partner_user || p.user;
            return partnerInfo?.id === newRecord?.sender_id;
          });
          if (partnerEntry) {
            const partnerUser = partnerEntry.partner_user || partnerEntry.user;
            if (partnerUser) {
              senderInfoFromPartners = {
                id: partnerUser.id,
                name: partnerUser.name,
                username: partnerUser.username,
                profile_picture_url: partnerUser.profile_picture_url
              };
            }
          }
        }
      } catch (e) {
        console.log(`[Realtime]   ⚠️ Could not get sender from partners cache`);
      }

      // Optimistically add to nudges list caches (both filtered variants)
      // useNudges() uses listFiltered(false) by default
      const updateNudgesList = (old: any) => {
        if (!old?.data) return old;

        // Check if already exists (from optimistic update by mutation)
        const existsById = old.data.some((n: any) => n.id === newRecord?.id);
        if (existsById) {
          console.log(`[Realtime]   ⏭️ Skipping - nudge already exists in cache`);
          return old;
        }

        // Enrich newRecord with sender info
        const enrichedRecord = { ...newRecord };

        // 1. Try to get sender from existing nudge in cache (same sender_id)
        const existingNudgeFromSameSender = old.data.find(
          (n: any) => n.sender_id === newRecord?.sender_id && n.sender
        );
        if (existingNudgeFromSameSender?.sender) {
          enrichedRecord.sender = existingNudgeFromSameSender.sender;
          console.log(`[Realtime]   ✅ Enriched nudge with sender info from nudges cache`);
        }
        // 2. Fallback: Use sender info from partners cache
        else if (senderInfoFromPartners) {
          enrichedRecord.sender = senderInfoFromPartners;
          console.log(`[Realtime]   ✅ Enriched nudge with sender info from partners cache`);
        }

        console.log(`[Realtime]   ✅ Adding nudge to cache optimistically`);
        return { ...old, data: [enrichedRecord, ...old.data] };
      };

      // Update all nudge list variants
      this.queryClient.setQueryData(nudgesQueryKeys.list(), updateNudgesList);
      this.queryClient.setQueryData(nudgesQueryKeys.listFiltered(false), updateNudgesList);
      this.queryClient.setQueryData(nudgesQueryKeys.listFiltered(true), updateNudgesList);

      // Invalidate to get full data with sender info on next mount/refetch
      this.queryClient.invalidateQueries({ queryKey: nudgesQueryKeys.all });

      // Force refetch for active queries
      this.queryClient.refetchQueries({ queryKey: nudgesQueryKeys.list(), type: "active" });
      this.queryClient.refetchQueries({
        queryKey: nudgesQueryKeys.listFiltered(false),
        type: "active"
      });
      this.queryClient.refetchQueries({ queryKey: nudgesQueryKeys.unreadCount(), type: "active" });
    } else if (payload.eventType === "UPDATE") {
      // Update in list cache
      this.queryClient.setQueryData(nudgesQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((n: any) => (n.id === newRecord?.id ? { ...n, ...newRecord } : n))
        };
      });

      // Refresh unread count if is_read changed
      if (newRecord?.is_read !== oldRecord?.is_read) {
        this.queryClient.refetchQueries({ queryKey: nudgesQueryKeys.unreadCount() });
      }
    } else if (payload.eventType === "DELETE") {
      // Remove from caches
      this.queryClient.setQueryData(nudgesQueryKeys.list(), (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.filter((n: any) => n.id !== oldRecord?.id) };
      });

      this.queryClient.setQueryData(nudgesQueryKeys.sent(), (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.filter((n: any) => n.id !== oldRecord?.id) };
      });

      this.queryClient.invalidateQueries({ queryKey: nudgesQueryKeys.all });
    }
  }

  // ========================================
  // AI COACH CONVERSATIONS
  // ========================================

  private async handleAICoachConversationsChange(payload: RealtimePostgresChangesPayload<any>) {
    if (!this.queryClient) return;

    const newRecord = payload.new as any;
    const oldRecord = payload.old as any;
    const conversationId = newRecord?.id || oldRecord?.id;

    console.log(`[Realtime] 🤖 AI Coach conversation ${payload.eventType}`, {
      conversationId: conversationId?.substring(0, 8)
    });

    await this.queryClient.cancelQueries({ queryKey: aiCoachQueryKeys.all });

    if (payload.eventType === "UPDATE") {
      // Check if there's a new assistant message
      const messages = newRecord?.messages;

      if (messages) {
        try {
          const parsedMessages = typeof messages === "string" ? JSON.parse(messages) : messages;

          if (Array.isArray(parsedMessages) && parsedMessages.length > 0) {
            const lastMessage = parsedMessages[parsedMessages.length - 1];
            const lastMessageAt = lastMessage?.created_at;

            // Check if it's a NEW assistant message with completed status
            if (
              lastMessage?.role === "assistant" &&
              lastMessage?.status === "completed" &&
              lastMessageAt &&
              lastMessageAt !== this.lastProcessedAIMessageAt
            ) {
              this.lastProcessedAIMessageAt = lastMessageAt;

              console.log(`[Realtime] 🤖 New AI response detected`);

              // Get the current conversation user is viewing
              const currentConversationId = useAICoachStore.getState().currentConversationId;

              // Only update UI if user is viewing this conversation
              if (currentConversationId === conversationId) {
                useAICoachStore.getState().setPendingAIResponse({
                  conversationId,
                  content: lastMessage.content || "",
                  messageIndex: parsedMessages.length - 1,
                  status: "completed"
                });
              }

              // Only invalidate conversations list
              this.queryClient.invalidateQueries({ queryKey: aiCoachQueryKeys.conversations() });
              return;
            }
          }
        } catch (e) {
          console.warn("[Realtime] Failed to parse AI Coach messages:", e);
        }
      }

      // For other updates (title change, etc.), just invalidate
      this.queryClient.invalidateQueries({ queryKey: aiCoachQueryKeys.conversations() });
    } else if (payload.eventType === "INSERT") {
      this.queryClient.invalidateQueries({ queryKey: aiCoachQueryKeys.conversations() });
      this.queryClient.invalidateQueries({ queryKey: aiCoachQueryKeys.currentConversation() });
    } else if (payload.eventType === "DELETE") {
      console.log(`[Realtime] 🗑️ AI Coach conversation deleted`);

      this.queryClient.invalidateQueries({ queryKey: aiCoachQueryKeys.all });

      if (conversationId) {
        this.queryClient.removeQueries({ queryKey: aiCoachQueryKeys.conversation(conversationId) });
      }

      this.queryClient.refetchQueries({
        queryKey: aiCoachQueryKeys.conversations(),
        type: "active"
      });
      this.queryClient.refetchQueries({
        queryKey: aiCoachQueryKeys.currentConversation(),
        type: "active"
      });

      useAICoachStore.getState().clearPendingAIResponse();

      if (useAICoachStore.getState().currentConversationId === conversationId) {
        useAICoachStore.getState().setCurrentConversationId(null);
      }
    }
  }

  // ========================================
  // WEEKLY RECAPS
  // ========================================

  private async handleWeeklyRecapsChange(payload: RealtimePostgresChangesPayload<any>) {
    if (!this.queryClient) return;

    const newRecord = payload.new as any;

    console.log(`[Realtime] 📅 Weekly recaps ${payload.eventType}`);

    await this.queryClient.cancelQueries({ queryKey: weeklyRecapsQueryKeys.all });

    if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
      // Update current recap if this is the most recent
      this.queryClient.setQueryData(weeklyRecapsQueryKeys.current(), (old: any) => {
        if (!old) return newRecord;
        // Compare dates to determine if this is newer
        if (new Date(newRecord?.created_at) > new Date(old?.created_at)) {
          return newRecord;
        }
        return old;
      });
    }

    // Invalidate to ensure list is fresh
    this.queryClient.invalidateQueries({ queryKey: weeklyRecapsQueryKeys.all });
    this.queryClient.refetchQueries({ queryKey: weeklyRecapsQueryKeys.current(), type: "active" });
  }

  // ========================================
  // PATTERN INSIGHTS (AI-generated)
  // ========================================

  private async handlePatternInsightsChange(payload: RealtimePostgresChangesPayload<any>) {
    if (!this.queryClient) return;

    const newRecord = payload.new as any;
    const goalId = newRecord?.goal_id;
    const status = newRecord?.status;

    console.log(`[Realtime] 🧠 Pattern insights ${payload.eventType}`, {
      goalId: goalId?.substring(0, 8),
      status
    });

    // Invalidate goal insights query for this specific goal
    if (goalId) {
      await this.queryClient.cancelQueries({ queryKey: goalsQueryKeys.insights(goalId) });

      // Optimistically update the cache with the new status immediately
      // This gives instant UI feedback without waiting for refetch
      this.queryClient.setQueryData(goalsQueryKeys.insights(goalId), (old: any) => {
        // Handle INSERT event (new record) - create new data structure
        if (payload.eventType === "INSERT" && (!old || !old.data)) {
          return {
            data: {
              goal_id: goalId,
              goal_title: newRecord.goal_title || "",
              status: status || "pending",
              insights: newRecord.insights || [],
              nudge_config: newRecord.nudge_config || {},
              current_metrics: newRecord.current_metrics,
              previous_metrics: newRecord.previous_metrics,
              checkins_count: newRecord.checkins_analyzed,
              min_required: newRecord.min_required,
              generated_at: newRecord.generated_at,
              summary: newRecord.summary
            },
            status: 200
          };
        }

        // For INSERT events with existing data, merge the new data
        if (payload.eventType === "INSERT" && old?.data) {
          // If INSERT comes in but we already have data, merge it (upsert behavior)
          // This can happen if the query was already fetched
          console.log(`[Realtime]   🔄 INSERT with existing data, merging`);
          // Fall through to UPDATE logic below
        }

        // For UPDATE events, need existing data
        if (!old?.data) return old;

        // FLICKER PREVENTION: Multiple scenarios to prevent flicker
        // 1. If already "generating" from optimistic update and new status is "generating", skip update
        // 2. If currently "completed" and new status is "generating", DON'T overwrite (insights already exist)
        //    This prevents clearing completed insights when backend regenerates
        if (status === "generating") {
          // Scenario 1: Already generating from optimistic update
          if (old.data.status === "generating") {
            // Only update checkins_count if it's different (to avoid unnecessary re-renders)
            const currentCount = old.data.checkins_count;
            const newCount = newRecord.checkins_analyzed;

            if (newCount !== undefined && newCount !== currentCount) {
              // Only update if count actually changed
              return {
                ...old,
                data: {
                  ...old.data,
                  checkins_count: newCount
                }
              };
            }

            // No changes needed - return old data unchanged to prevent flicker
            return old;
          }

          // Scenario 2: Currently "completed" - don't overwrite with "generating"
          // This prevents clearing completed insights when backend starts regenerating
          if (old.data.status === "completed") {
            // Return old data unchanged - don't clear completed insights
            return old;
          }
        }

        // Only log if status actually changed (not already generating)
        const oldStatus = old.data.status || "undefined";
        if (oldStatus !== status) {
          console.log(
            `[Realtime]   🔄 Optimistically updating insights status: ${oldStatus} → ${status}`
          );
        }

        // When status becomes "completed", merge in any new data from the payload
        if (status === "completed") {
          // Always update current_metrics if provided (even if it's the same, to trigger re-render)
          const updatedData: any = {
            ...old.data,
            status: status,
            // Merge in new insights data if provided in payload
            ...(newRecord.insights && { insights: newRecord.insights }),
            ...(newRecord.summary && { summary: newRecord.summary }),
            ...(newRecord.nudge_config && { nudge_config: newRecord.nudge_config }),
            // Always update current_metrics if provided in payload (force new object reference to trigger re-render)
            ...(newRecord.current_metrics !== undefined && {
              current_metrics:
                newRecord.current_metrics && typeof newRecord.current_metrics === "object"
                  ? { ...newRecord.current_metrics } // Create new object reference
                  : newRecord.current_metrics // Handle null or primitive values
            }),
            ...(newRecord.previous_metrics !== undefined && {
              previous_metrics:
                newRecord.previous_metrics && typeof newRecord.previous_metrics === "object"
                  ? { ...newRecord.previous_metrics } // Create new object reference
                  : newRecord.previous_metrics // Handle null or primitive values
            }),
            // Update generated_at
            generated_at: newRecord.generated_at || new Date().toISOString(),
            // Update checkins_analyzed if provided, otherwise preserve old value
            checkins_count:
              newRecord.checkins_analyzed !== undefined
                ? newRecord.checkins_analyzed
                : old.data.checkins_count,
            // Preserve min_required from old data (needed for useCheckIns logic)
            min_required: old.data.min_required
          };

          // Return new object structure to ensure React Query detects the change
          // This is critical - React Query uses shallow comparison, so we need new references
          return {
            ...old,
            data: {
              ...updatedData // Already a new object, but ensure it's spread
            }
          };
        }

        // For "generating" status (status changed TO generating, not already generating)
        if (status === "generating") {
          return {
            ...old,
            data: {
              ...old.data,
              status: status,
              insights: [], // Clear old insights when generating new ones
              // Update current_metrics if provided (backend might update metrics during generation)
              ...(newRecord.current_metrics !== undefined && {
                current_metrics: newRecord.current_metrics
              }),
              // Update checkins_analyzed if provided, otherwise preserve old value
              checkins_count:
                newRecord.checkins_analyzed !== undefined
                  ? newRecord.checkins_analyzed
                  : old.data.checkins_count,
              // Preserve min_required from old data
              min_required: old.data.min_required
            }
          };
        }

        // For other statuses (including insufficient_data), update status and preserve min_required
        return {
          ...old,
          data: {
            ...old.data,
            status: status,
            // Update current_metrics if provided (might be updated even in other statuses)
            ...(newRecord.current_metrics !== undefined && {
              current_metrics: newRecord.current_metrics
            }),
            // Update checkins_analyzed if provided, otherwise preserve old value
            checkins_count:
              newRecord.checkins_analyzed !== undefined
                ? newRecord.checkins_analyzed
                : old.data.checkins_count,
            // Preserve or update min_required
            min_required:
              newRecord.min_required !== undefined ? newRecord.min_required : old.data.min_required
          }
        };
      });

      // If status changed to 'completed', log it
      if (status === "completed") {
        console.log(`[Realtime]   ✅ Insights completed for goal ${goalId.substring(0, 8)}`);
      }

      // Don't immediately refetch - the optimistic update above already provides the data
      // Refetching immediately causes flicker because:
      // 1. Optimistic update sets the data
      // 2. Refetch might get stale/incomplete data
      // 3. UI flickers between states
      // Instead, mark as stale so it refetches on next mount/refocus, but keep current data visible
      // Only invalidate (mark stale) without forcing immediate refetch
      this.queryClient.invalidateQueries({
        queryKey: goalsQueryKeys.insights(goalId),
        refetchType: "none" // Don't refetch immediately, just mark as stale
      });
    }
  }

  // ========================================
  // USER ACHIEVEMENTS
  // ========================================

  private async handleUserAchievementsChange(payload: RealtimePostgresChangesPayload<any>) {
    if (!this.queryClient) return;

    const newRecord = payload.new as any;

    console.log(`[Realtime] 🏆 User achievements ${payload.eventType}`, {
      type: newRecord?.achievement_type_id
    });

    await this.queryClient.cancelQueries({ queryKey: achievementsQueryKeys.all });

    if (payload.eventType === "INSERT") {
      // New achievement unlocked - invalidate to show new badge
      this.queryClient.invalidateQueries({ queryKey: achievementsQueryKeys.myAchievements() });
      this.queryClient.invalidateQueries({ queryKey: achievementsQueryKeys.stats() });
      this.queryClient.refetchQueries({
        queryKey: achievementsQueryKeys.myAchievements(),
        type: "active"
      });
    }
  }

  // ========================================
  // BLOG POSTS
  // ========================================

  private async handleBlogPostsChange(payload: RealtimePostgresChangesPayload<any>) {
    if (!this.queryClient) return;

    const newRecord = payload.new as any;

    console.log(`[Realtime] 📰 Blog posts ${payload.eventType}`, {
      status: newRecord?.status
    });

    // Only care about published posts
    if (newRecord?.status !== "published" && payload.eventType !== "DELETE") {
      return;
    }

    await this.queryClient.cancelQueries({ queryKey: blogQueryKeys.all });

    // Invalidate and refetch blog queries
    this.queryClient.invalidateQueries({ queryKey: blogQueryKeys.posts() });
    this.queryClient.invalidateQueries({ queryKey: blogQueryKeys.featured(3) });
    this.queryClient.invalidateQueries({ queryKey: blogQueryKeys.featured(4) });

    this.queryClient.refetchQueries({ queryKey: blogQueryKeys.posts(), type: "active" });
  }

  // ========================================
  // NOTIFICATIONS (admin broadcasts)
  // ========================================

  private async handleNotificationsChange(payload: RealtimePostgresChangesPayload<any>) {
    if (!this.queryClient) return;
    const eventType = payload.eventType;
    const oldRecord = payload.old as { id?: string } | undefined;

    if (eventType === "DELETE" && oldRecord?.id) {
      const deletedId = String(oldRecord.id);
      logger.debug("[Realtime] 📢 Broadcast deleted, removing from cache + queue", {
        id: deletedId.substring(0, 8)
      });
      this.queryClient.setQueryData(broadcastsQueryKeys.active(), (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return (old as { id: string }[]).filter((b) => b.id !== deletedId);
      });
      useDeletedBroadcastIdsStore.getState().add(deletedId);
      return;
    }

    if (eventType === "INSERT" || eventType === "UPDATE") {
      logger.debug(`[Realtime] 📢 Broadcast ${eventType}, invalidating active list`);
      await this.queryClient.cancelQueries({ queryKey: broadcastsQueryKeys.all });
      this.queryClient.invalidateQueries({ queryKey: broadcastsQueryKeys.active() });
      await this.queryClient.refetchQueries({
        queryKey: broadcastsQueryKeys.active(),
        type: "active"
      });
    }
  }

  // ========================================
  // RECONNECTION LOGIC
  // ========================================

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error("[Realtime] Max reconnect attempts reached");
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    logger.info(
      `[Realtime] Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`
    );

    this.reconnectTimeout = setTimeout(async () => {
      this.cleanup(false);
      await this.connect();
    }, delay);
  }

  // ========================================
  // HEALTH CHECK - Detect stale connections
  // ========================================

  /**
   * Start periodic health check to detect stale connections
   * WebSocket can appear connected but actually be dead (silent disconnect)
   */
  private startHealthCheck() {
    this.stopHealthCheck();

    console.log("[Realtime] 🏥 Starting health check interval");
    this.lastHealthCheckSuccess = Date.now();

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL_MS);
  }

  /**
   * Stop health check interval
   */
  private stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Perform health check by verifying channel state and optionally pinging
   */
  private async performHealthCheck() {
    // Skip if not supposed to be connected
    if (!this.userId || this.connectionState !== "connected") {
      return;
    }

    try {
      // Check if channel exists and is in subscribed state
      const channelState = this.channel?.state;

      if (channelState !== "joined") {
        console.warn(
          `[Realtime] 🏥 Health check: Channel state is ${channelState}, expected 'joined'`
        );
        await this.forceReconnect("Channel state invalid");
        return;
      }

      // Verify we can still communicate - check if supabase client is healthy
      // by attempting to get realtime presence (lightweight operation)
      if (supabase) {
        const channels = supabase.getChannels();
        if (channels.length === 0) {
          console.warn("[Realtime] 🏥 Health check: No active channels found");
          await this.forceReconnect("No active channels");
          return;
        }
      }

      // Check for stale connection (no successful health check in threshold period)
      const timeSinceLastSuccess = Date.now() - this.lastHealthCheckSuccess;
      if (timeSinceLastSuccess > this.STALE_THRESHOLD_MS) {
        console.warn(
          `[Realtime] 🏥 Health check: Connection appears stale (${timeSinceLastSuccess}ms since last success)`
        );
        await this.forceReconnect("Connection stale");
        return;
      }

      // All checks passed
      this.lastHealthCheckSuccess = Date.now();
      console.log("[Realtime] 🏥 Health check passed");
    } catch (error) {
      console.error("[Realtime] 🏥 Health check failed:", error);
      await this.forceReconnect("Health check exception");
    }
  }

  /**
   * Force reconnection when stale connection detected
   */
  private async forceReconnect(reason: string) {
    console.log(`[Realtime] 🔄 Force reconnecting: ${reason}`);

    const savedUserId = this.userId;
    if (!savedUserId) return;

    this.stop(false);
    await new Promise((resolve) => setTimeout(resolve, 500));
    await this.startForUser(savedUserId);

    // Invalidate all queries to ensure fresh data after reconnect
    if (this.queryClient) {
      console.log("[Realtime] 🔄 Invalidating all queries after reconnect");
      await this.queryClient.cancelQueries();
      this.queryClient.invalidateQueries();
      this.queryClient.refetchQueries({ type: "active" });
    }
  }

  // ========================================
  // USER ACTIVITY TRACKING - Refresh stale data on activity
  // ========================================

  /**
   * Track user activity - call this on significant user interactions
   * If user has been inactive and then becomes active, refresh data
   */
  trackUserActivity() {
    const now = Date.now();
    const timeSinceLastActivity = now - this.lastUserActivity;

    // If user was inactive for threshold period, refresh data
    if (timeSinceLastActivity > this.INACTIVITY_THRESHOLD_MS) {
      console.log(
        `[Realtime] 👆 User active after ${Math.round(timeSinceLastActivity / 1000)}s inactivity, refreshing data`
      );

      // Force health check
      this.performHealthCheck();

      // Invalidate all queries to ensure fresh data
      if (this.queryClient) {
        this.queryClient.invalidateQueries();
        this.queryClient.refetchQueries({ type: "active" });
      }
    }

    this.lastUserActivity = now;
  }

  /**
   * Get time since last user activity (for debugging)
   */
  getTimeSinceLastActivity(): number {
    return Date.now() - this.lastUserActivity;
  }

  // ========================================
  // PUBLIC API
  // ========================================

  /**
   * Cleanup resources
   * NOTE: We intentionally do NOT clear queryClient here.
   * The queryClient is a stable reference from React Query that persists
   * throughout the app lifecycle. Clearing it causes race conditions where
   * realtime events arrive but queryClient is null (initialize() was called
   * before cleanup(), and doesn't run again after cleanup clears it).
   */
  cleanup(full = true) {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Clear debounce timeout
    if (this.reconnectDebounceTimeout) {
      clearTimeout(this.reconnectDebounceTimeout);
      this.reconnectDebounceTimeout = null;
    }

    // Reset reconnecting flag
    this.isReconnecting = false;

    // Stop health check interval
    this.stopHealthCheck();

    if (this.channel && supabase) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }

    if (full) {
      if (this.appStateSubscription) {
        this.appStateSubscription.remove();
        this.appStateSubscription = null;
      }
      // NOTE: Do NOT clear queryClient - it's stable and should persist
      // this.queryClient = null;  // REMOVED - causes race condition
      this.userId = null;
      this.reconnectAttempts = 0;
    }

    this.connectionState = "disconnected";
    logger.info("[Realtime] Cleaned up");
  }

  /**
   * Start subscriptions for a user (alias for startForUser)
   */
  async start(userId: string) {
    await this.startForUser(userId);
  }

  /**
   * Stop subscriptions
   */
  stop(clearUserId = true) {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Clear debounce timeout
    if (this.reconnectDebounceTimeout) {
      clearTimeout(this.reconnectDebounceTimeout);
      this.reconnectDebounceTimeout = null;
    }

    // Reset reconnecting flag
    this.isReconnecting = false;

    // Stop health check interval
    this.stopHealthCheck();

    if (this.channel && supabase) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }

    if (clearUserId) {
      this.userId = null;
    }

    this.connectionState = "disconnected";
    logger.info("[Realtime] Stopped");
  }

  /**
   * Get connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Get connection status (for UI/debugging)
   */
  getConnectionStatus() {
    return {
      isConnected: this.connectionState === "connected",
      channelCount: this.channel ? 1 : 0,
      reconnectAttempts: this.reconnectAttempts,
      lastHealthCheckSuccess: this.lastHealthCheckSuccess,
      timeSinceHealthCheck: Date.now() - this.lastHealthCheckSuccess,
      lastUserActivity: this.lastUserActivity,
      timeSinceActivity: Date.now() - this.lastUserActivity
    };
  }
}

/**
 * Get singleton instance
 */
export function getRealtimeService(): RealtimeService {
  if (!instance) {
    instance = new RealtimeService();
  }
  return instance;
}

// Export singleton instance for direct usage
export const realtimeService = getRealtimeService();

/**
 * Initialize realtime service
 */
export function initializeRealtime(queryClient: QueryClient) {
  getRealtimeService().initialize(queryClient);
}

/**
 * Start realtime for a user
 */
export async function startRealtimeForUser(userId: string) {
  await getRealtimeService().startForUser(userId);
}

/**
 * Cleanup realtime service
 */
export function cleanupRealtime() {
  if (instance) {
    instance.cleanup();
    instance = null;
  }
}

export default RealtimeService;
