/**
 * AI Coach Chat Hook
 *
 * Provides chat functionality with the AI Coach using async background processing.
 * Features:
 * - Async message sending (background processing via Celery)
 * - Manual streaming simulation when response arrives via realtime
 * - Rate limit tracking
 * - Conversation history management
 * - Optimistic UI updates with proper React Query patterns
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequestSSE, SSEConnection } from "@/services/api/base";
import {
  aiCoachService,
  ConversationDetail,
  ConversationSummary,
  ConversationsListResponse,
  StreamEvent
} from "@/services/api/aiCoach";
import { aiCoachQueryKeys } from "./queryKeys";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { useAICoachStore } from "@/stores/aiCoachStore";
import { logger } from "@/services/logger";
import { ROUTES } from "@/lib/routes";

// =====================================================
// TYPES
// =====================================================

export interface Message {
  _id: string;
  text: string;
  createdAt: Date;
  user: {
    _id: string | number;
    name?: string;
    avatar?: string;
  };
  pending?: boolean;
  failed?: boolean;
  errorMessage?: string;
}

// Re-export types from service for convenience
export type {
  ConversationSummary,
  ConversationDetail,
  ConversationsListResponse,
  RateLimitStatus,
  FeatureAccessResponse,
  StreamEvent
} from "@/services/api/aiCoach";

// Pagination constants
const MESSAGES_PER_PAGE = 50;
const CONVERSATIONS_PER_PAGE = 20;

// =====================================================
// HOOKS
// =====================================================

/**
 * Check if user has access to AI Coach feature
 */
export function useAICoachAccess() {
  return useQuery({
    queryKey: aiCoachQueryKeys.access(),
    queryFn: () => aiCoachService.checkAccess(),
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
}

/**
 * Get rate limit status
 * PREMIUM FEATURE: Only fetch if user has ai_coach_chat feature.
 */
export function useAICoachRateLimit(enabled: boolean = true) {
  return useQuery({
    queryKey: aiCoachQueryKeys.rateLimit(),
    queryFn: () => aiCoachService.getRateLimit(),
    enabled,
    staleTime: 30 * 1000 // 30 seconds
  });
}

/**
 * List conversations
 * PREMIUM FEATURE: Only fetch if user has ai_coach_chat feature.
 */
export function useAICoachConversations(limit = 20, offset = 0, enabled: boolean = true) {
  return useQuery({
    queryKey: aiCoachQueryKeys.conversations(),
    queryFn: () => aiCoachService.listConversations(limit, offset),
    enabled,
    staleTime: 60 * 1000 // 1 minute
  });
}

/**
 * Get current conversation
 * PREMIUM FEATURE: Only fetch if user has ai_coach_chat feature.
 */
export function useCurrentConversation(enabled: boolean = true) {
  return useQuery({
    queryKey: aiCoachQueryKeys.currentConversation(),
    queryFn: () => aiCoachService.getCurrentConversation(),
    enabled,
    staleTime: 30 * 1000
  });
}

/**
 * Get specific conversation
 * PREMIUM FEATURE: Only fetch if user has ai_coach_chat feature.
 */
export function useConversation(id: string, enabled: boolean = true) {
  return useQuery({
    queryKey: aiCoachQueryKeys.conversation(id),
    queryFn: () => aiCoachService.getConversation(id),
    enabled: enabled && !!id,
    staleTime: 30 * 1000
  });
}

// NOTE: useStartNewConversation and useDeleteConversation are handled
// inside useAICoachChat with proper optimistic updates

/**
 * Main AI Coach Chat Hook with Async Background Processing
 *
 * Uses async endpoint for message sending (Celery background processing).
 * When AI response arrives via realtime, simulates character-by-character streaming.
 */
export function useAICoachChat() {
  const queryClient = useQueryClient();
  const { hasFeature } = useSubscriptionStore();
  const {
    selectedLanguage,
    currentConversationId: storeConversationId,
    setCurrentConversationId: setStoreConversationId,
    pendingAIResponse,
    clearPendingAIResponse
  } = useAICoachStore();

  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);

  // Pagination state for messages
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);
  const [totalMessages, setTotalMessages] = useState(0);
  const messageOffsetRef = useRef(0);

  // Track failed message for retry
  const failedMessageRef = useRef<{ text: string; userMessageId: string; language: string } | null>(
    null
  );

  // Track the pending assistant message ID for updates
  const pendingAssistantMessageIdRef = useRef<string | null>(null);

  // Streaming animation ref
  const streamingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Track if next message should force create a new conversation
  const forceNewChatRef = useRef(false);

  // Check feature access
  const hasAccess = hasFeature("ai_coach_chat");

  // Convert API messages to GiftedChat format (defined early for use in effects)
  const convertToGiftedMessages = useCallback(
    (apiMessages: ConversationDetail["messages"]): Message[] => {
      return apiMessages
        .map((msg, index) => ({
          _id: `msg-${index}-${msg.created_at || Date.now()}`,
          text: msg.content,
          createdAt: msg.created_at ? new Date(msg.created_at) : new Date(),
          user: {
            _id: msg.role === "user" ? 1 : 2,
            name: msg.role === "user" ? "You" : "Coach Nudge"
          }
        }))
        .reverse(); // GiftedChat expects newest first
    },
    []
  );

  // Timeout ref for recovery check when waiting too long
  const recoveryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear recovery timeout
  const clearRecoveryTimeout = useCallback(() => {
    if (recoveryTimeoutRef.current) {
      clearTimeout(recoveryTimeoutRef.current);
      recoveryTimeoutRef.current = null;
    }
  }, []);

  // Recovery check - fetches conversation to see if AI responded
  const checkForAIResponse = useCallback(
    async (convId: string) => {
      console.log(
        "[AI Coach] 🔍 Recovery check - fetching conversation to check for AI response..."
      );
      try {
        const response = await aiCoachService.getConversation(convId);
        if (response.data) {
          const msgs = response.data.messages;
          const lastMessage = msgs[msgs.length - 1];

          if (lastMessage?.role === "assistant") {
            console.log("[AI Coach] ✅ Recovery found AI response, updating UI");
            const freshMessages = convertToGiftedMessages(msgs);
            setMessages(freshMessages);
            setIsWaitingForResponse(false);
            setError(null);
            pendingAssistantMessageIdRef.current = null;
            failedMessageRef.current = null;
            clearRecoveryTimeout();

            // Refetch rate limit since AI responded
            queryClient.refetchQueries({
              queryKey: aiCoachQueryKeys.rateLimit()
            });
            return true;
          }
        }
      } catch (err) {
        console.warn("[AI Coach] Recovery check failed:", err);
      }
      return false;
    },
    [convertToGiftedMessages, queryClient, clearRecoveryTimeout]
  );

  // Start recovery timeout - will check conversation after delay
  const startRecoveryTimeout = useCallback(
    (convId: string, delayMs: number = 30000) => {
      clearRecoveryTimeout();
      console.log(`[AI Coach] ⏱️ Starting recovery timeout (${delayMs / 1000}s)`);
      recoveryTimeoutRef.current = setTimeout(async () => {
        const found = await checkForAIResponse(convId);
        if (!found) {
          console.log("[AI Coach] ⚠️ Recovery timeout - no AI response found, showing error");
          setError("Response taking too long. Please try again.");
          setIsWaitingForResponse(false);
          // Mark message as failed
          setMessages((prev) =>
            prev.map((msg) =>
              msg.pending && msg.user._id !== 1
                ? {
                    ...msg,
                    pending: false,
                    failed: true,
                    errorMessage: "Response timed out. Tap to retry."
                  }
                : msg
            )
          );
        }
      }, delayMs);
    },
    [checkForAIResponse, clearRecoveryTimeout]
  );

  // Clean up recovery timeout on unmount
  useEffect(() => {
    return () => {
      clearRecoveryTimeout();
    };
  }, [clearRecoveryTimeout]);

  // Sync conversation ID with store for realtime to detect
  useEffect(() => {
    if (conversationId !== storeConversationId) {
      setStoreConversationId(conversationId);
    }
  }, [conversationId, storeConversationId, setStoreConversationId]);

  // Track app state for background/foreground transitions
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const wasWaitingRef = useRef(false);
  const hadErrorRef = useRef(false);

  // Update refs when state changes
  useEffect(() => {
    wasWaitingRef.current = isWaitingForResponse;
  }, [isWaitingForResponse]);

  useEffect(() => {
    hadErrorRef.current = !!error;
  }, [error]);

  // Handle app state changes - reload conversation when returning from background
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      // App coming back to foreground
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === "active" &&
        conversationId &&
        hasAccess
      ) {
        console.log("[AI Coach] 📱 App returned to foreground", {
          wasWaiting: wasWaitingRef.current,
          hadError: hadErrorRef.current,
          conversationId: conversationId?.substring(0, 8)
        });

        // Reload conversation if:
        // 1. We were waiting for a response (normal case)
        // 2. There was an error (network failed but backend may have succeeded)
        if (wasWaitingRef.current || hadErrorRef.current) {
          console.log("[AI Coach] 🔄 Reloading conversation to check for new messages...");

          try {
            // Fetch fresh conversation data
            const response = await aiCoachService.getConversation(conversationId);
            if (response.data) {
              const freshMessages = convertToGiftedMessages(response.data.messages);

              // Check if we now have an AI response (last message is from assistant)
              const lastMessage = response.data.messages[response.data.messages.length - 1];
              if (lastMessage?.role === "assistant") {
                console.log("[AI Coach] ✅ Found AI response, updating messages");
                setMessages(freshMessages);
                setIsWaitingForResponse(false);
                setError(null); // Clear any previous error

                // Remove pending message ref
                pendingAssistantMessageIdRef.current = null;
                failedMessageRef.current = null;

                // Refetch rate limit - AI responded so rate limit was decremented
                queryClient.refetchQueries({
                  queryKey: aiCoachQueryKeys.rateLimit()
                });
              }
            }
          } catch (err) {
            console.error("[AI Coach] Failed to reload conversation after foreground:", err);
          }
        }
      }

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [conversationId, hasAccess, convertToGiftedMessages, queryClient]);

  // Handle pending AI response from realtime - SIMPLE: just update the UI directly
  useEffect(() => {
    if (!pendingAIResponse) return;

    // Only process if it's for the current conversation
    if (pendingAIResponse.conversationId !== conversationId) {
      clearPendingAIResponse();
      return;
    }

    const fullText = pendingAIResponse.content || "";

    console.log("[AI Coach] 📬 Received AI response from realtime, updating UI directly", {
      contentLength: fullText.length,
      conversationId: conversationId?.substring(0, 8)
    });

    // SIMPLE: Just update the pending assistant message with the full response immediately
    setMessages((prev) =>
      prev.map((msg) => {
        // Find the pending assistant message and replace it with the actual response
        if (msg.pending && msg.user._id !== 1) {
          return { ...msg, text: fullText, pending: false };
        }
        return msg;
      })
    );

    // Clear waiting states and recovery timeout
    setIsWaitingForResponse(false);
    setIsStreaming(false);
    setStreamingText("");
    pendingAssistantMessageIdRef.current = null;
    failedMessageRef.current = null;
    clearRecoveryTimeout();

    // Force refetch rate limit - AI responded successfully so rate limit was decremented
    queryClient.refetchQueries({
      queryKey: aiCoachQueryKeys.rateLimit()
    });

    // Clear the pending response
    clearPendingAIResponse();

    console.log("[AI Coach] ✅ UI updated with AI response");
  }, [
    pendingAIResponse,
    conversationId,
    clearPendingAIResponse,
    queryClient,
    clearRecoveryTimeout
  ]);

  // Load conversation history (most recent or by ID)
  // Uses React Query cache for specific conversations
  const loadConversation = useCallback(
    async (specificConversationId?: string) => {
      // Don't fetch if user doesn't have access
      if (!hasAccess) {
        setConversationId(null);
        setMessages([]);
        setHasMoreMessages(false);
        setTotalMessages(0);
        return;
      }

      // Clear force new flag when loading an existing conversation
      forceNewChatRef.current = false;

      // Reset pagination state for new conversation load
      messageOffsetRef.current = 0;

      setIsLoadingConversation(true);
      setError(null);
      try {
        let conversation: ConversationDetail | null = null;

        if (specificConversationId) {
          // Check cache first for specific conversation
          const cachedData = queryClient.getQueryData<{ data: ConversationDetail }>(
            aiCoachQueryKeys.conversation(specificConversationId)
          );

          if (cachedData?.data) {
            // Use cached data immediately
            conversation = cachedData.data;
          } else {
            // Fetch and cache - get first page of messages
            const response = await aiCoachService.getConversation(
              specificConversationId,
              MESSAGES_PER_PAGE,
              0
            );
            conversation = response.data ?? null;
            // Cache the result
            if (conversation) {
              queryClient.setQueryData(aiCoachQueryKeys.conversation(specificConversationId), {
                data: conversation
              });
            }
          }
        } else {
          // Load most recent conversation (always fetch to get latest)
          const response = await aiCoachService.getCurrentConversation(MESSAGES_PER_PAGE, 0);
          conversation = response.data ?? null;
        }

        if (conversation) {
          setConversationId(conversation.id);
          setMessages(convertToGiftedMessages(conversation.messages));
          setHasMoreMessages(conversation.has_more_messages ?? false);
          setTotalMessages(conversation.total_messages ?? conversation.messages.length);
          messageOffsetRef.current = conversation.messages.length;
        } else {
          // No conversation found, reset state
          setConversationId(null);
          setMessages([]);
          setHasMoreMessages(false);
          setTotalMessages(0);
        }
      } catch (err: unknown) {
        // Don't log 403 errors to Sentry - they're expected for free users (premium feature)
        const apiErr = err as { status?: number };
        if (apiErr.status !== 403) {
          logger.error("Failed to load conversation", err as Record<string, unknown>);
        }
        // Reset state on any error
        setConversationId(null);
        setMessages([]);
        setHasMoreMessages(false);
        setTotalMessages(0);
      } finally {
        setIsLoadingConversation(false);
      }
    },
    [convertToGiftedMessages, hasAccess, queryClient]
  );

  // Load more (older) messages for infinite scroll
  const loadMoreMessages = useCallback(async () => {
    if (!conversationId || !hasMoreMessages || isLoadingMoreMessages || isLoadingConversation) {
      return;
    }

    setIsLoadingMoreMessages(true);

    try {
      const response = await aiCoachService.getConversation(
        conversationId,
        MESSAGES_PER_PAGE,
        messageOffsetRef.current
      );

      if (response.data) {
        const olderMessages = convertToGiftedMessages(response.data.messages);

        // Append older messages to the end (since list is inverted, end = top = older)
        setMessages((prev) => [...prev, ...olderMessages]);

        // Update pagination state
        setHasMoreMessages(response.data.has_more_messages ?? false);
        messageOffsetRef.current += response.data.messages.length;
      }
    } catch (err) {
      logger.error("Failed to load more messages", err as Record<string, unknown>);
    } finally {
      setIsLoadingMoreMessages(false);
    }
  }, [
    conversationId,
    hasMoreMessages,
    isLoadingMoreMessages,
    isLoadingConversation,
    convertToGiftedMessages
  ]);

  // Start a new conversation (local only - no API call)
  // Conversation is created by backend when first message is sent
  const startNewChat = useCallback(() => {
    // Just reset local state - don't create in DB yet
    // The conversation will be created when the first message is sent
    setConversationId(null);
    setMessages([]);
    setError(null);
    setStreamingText("");
    setHasMoreMessages(false);
    setTotalMessages(0);
    messageOffsetRef.current = 0;
    // Mark that next message should force a new conversation
    forceNewChatRef.current = true;
  }, []);

  // Reference to SSE connection for cleanup (legacy streaming, kept for fallback)
  const sseConnectionRef = useRef<SSEConnection | null>(null);

  // Goal ID for focused conversations (when opened from a specific goal)
  const [focusedGoalId, setFocusedGoalId] = useState<string | null>(null);

  // Send message using async endpoint (background processing via Celery)
  // Response arrives via realtime subscription, then manual streaming is triggered
  const sendMessage = useCallback(
    async (text: string, language: string = "en", isRetry = false, goalId?: string | null) => {
      if (!text.trim() || isStreaming || isWaitingForResponse) return;

      setError(null);
      setIsWaitingForResponse(true);

      const userMessageId = `user-${Date.now()}`;

      // Only add user message if not a retry (retry reuses existing user message)
      if (!isRetry) {
        const userMessage: Message = {
          _id: userMessageId,
          text: text.trim(),
          createdAt: new Date(),
          user: { _id: 1, name: "You" }
        };
        setMessages((prev) => [userMessage, ...prev]);
      }

      // Remove any previous failed assistant message before adding new pending one
      setMessages((prev) => prev.filter((msg) => !msg.failed));

      // Track this message for potential retry
      failedMessageRef.current = { text: text.trim(), userMessageId, language };

      // Add pending assistant message
      const assistantMessageId = `assistant-${Date.now()}`;
      pendingAssistantMessageIdRef.current = assistantMessageId;

      const pendingMessage: Message = {
        _id: assistantMessageId,
        text: "",
        createdAt: new Date(),
        user: {
          _id: 2,
          name: "Coach Nudge"
        },
        pending: true
      };
      setMessages((prev) => [pendingMessage, ...prev]);

      // Check if we should force a new conversation
      const shouldForceNew = forceNewChatRef.current;

      console.log("[AI Coach] 📤 Sending chat request via async endpoint...", {
        messageLength: text.trim().length,
        conversationId: conversationId?.substring(0, 8),
        language,
        forceNew: shouldForceNew
      });

      try {
        // Use focused goal ID if not explicitly provided
        const effectiveGoalId = goalId !== undefined ? goalId : focusedGoalId;

        // Call async endpoint - returns immediately with pending status
        const response = await aiCoachService.sendMessageAsync({
          message: text.trim(),
          conversation_id: conversationId,
          language: language,
          is_retry: isRetry,
          force_new: shouldForceNew,
          goal_id: effectiveGoalId
        });

        // Clear force new flag after sending (only needs to apply to first message)
        forceNewChatRef.current = false;

        if (response.data) {
          const { conversation_id: newConversationId } = response.data;

          console.log("[AI Coach] ✅ Message queued for processing", {
            conversationId: newConversationId?.substring(0, 8),
            messageIndex: response.data.message_index
          });

          // Update conversation ID if this was a new conversation
          if (newConversationId && newConversationId !== conversationId) {
            setConversationId(newConversationId);
            // Invalidate conversations list to show new chat in sidebar
            queryClient.invalidateQueries({
              queryKey: aiCoachQueryKeys.conversations()
            });
          }

          // Start recovery timeout - if no realtime response in 30s, check conversation
          const convIdForRecovery = newConversationId || conversationId;
          if (convIdForRecovery) {
            startRecoveryTimeout(convIdForRecovery, 30000);
          }

          // Now we wait for realtime to notify us when the response is ready
          // The useEffect listening to pendingAIResponse will handle the streaming
        } else {
          throw new Error("No response data from async endpoint");
        }
      } catch (err: any) {
        // Be specific about what constitutes a network/timeout error
        // Avoid matching generic errors like "cyclical structure in JSON object"
        const errorMessage = (err.message || "").toLowerCase();
        const isNetworkOrTimeoutError =
          errorMessage.includes("network request failed") ||
          errorMessage.includes("failed to fetch") ||
          errorMessage.includes("timeout") ||
          errorMessage.includes("timed out") ||
          errorMessage.includes("ssl") ||
          errorMessage.includes("tls") ||
          errorMessage.includes("connection refused") ||
          errorMessage.includes("connection reset") ||
          errorMessage.includes("econnrefused") ||
          errorMessage.includes("econnreset") ||
          errorMessage.includes("unable to resolve host") ||
          err.name === "AbortError";

        if (isNetworkOrTimeoutError) {
          // For network/timeout errors, the backend may have processed the message
          // Keep waiting state, but start recovery timeout
          console.warn(
            "[AI Coach] ⚠️ Network/timeout error during async send - backend may have processed the message.",
            { error: err.message }
          );

          // Start recovery timeout to check if message was processed
          if (conversationId) {
            startRecoveryTimeout(conversationId, 15000); // Check sooner for network errors
          }
          return;
        }

        // For other errors, immediately check if message was already processed
        // (e.g., JSON serialization errors that happen after the request was sent)
        if (conversationId) {
          console.log("[AI Coach] 🔍 Checking if message was processed despite error...");
          const wasProcessed = await checkForAIResponse(conversationId);
          if (wasProcessed) {
            return; // UI already updated by checkForAIResponse
          }
        }

        // Message was not processed, show the error
        console.error("[AI Coach] 💥 Async send failed", err);
        setError(err.message || "Failed to send message");
        setIsWaitingForResponse(false);

        // Update pending message to show failed state
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === assistantMessageId
              ? {
                  ...msg,
                  text: "",
                  pending: false,
                  failed: true,
                  errorMessage: err.message || "Failed to send message"
                }
              : msg
          )
        );
        pendingAssistantMessageIdRef.current = null;
      }
    },
    [
      conversationId,
      isStreaming,
      isWaitingForResponse,
      queryClient,
      focusedGoalId,
      startRecoveryTimeout,
      checkForAIResponse
    ]
  );

  // Retry failed message or regenerate response for unanswered message
  const retryLastMessage = useCallback(() => {
    if (isStreaming || isWaitingForResponse) return;

    // Case 1: Explicit failed message (error during sending)
    if (failedMessageRef.current) {
      const { text, language } = failedMessageRef.current;
      sendMessage(text, language, true);
      return;
    }

    // Case 2: Last message has no AI response (e.g., connection dropped)
    // Find the last user message and regenerate
    const lastUserMessage = messages.find((msg) => msg.user._id === 1);
    if (lastUserMessage && !lastUserMessage.pending) {
      // Use stored language or default to 'en'
      sendMessage(lastUserMessage.text, selectedLanguage, true);
    }
  }, [sendMessage, isStreaming, isWaitingForResponse, messages, selectedLanguage]);

  // Cancel streaming or waiting
  const cancelStream = useCallback(() => {
    // Clear streaming interval if active
    if (streamingIntervalRef.current) {
      clearInterval(streamingIntervalRef.current);
      streamingIntervalRef.current = null;
    }

    // Close SSE connection if active (legacy fallback)
    if (sseConnectionRef.current) {
      sseConnectionRef.current.close();
      sseConnectionRef.current = null;
    }

    // Clear recovery timeout
    clearRecoveryTimeout();

    setIsStreaming(false);
    setIsWaitingForResponse(false);
    setStreamingText("");

    // Remove the pending message
    setMessages((prev) => prev.filter((msg) => !msg.pending));
    failedMessageRef.current = null;
    pendingAssistantMessageIdRef.current = null;
  }, [clearRecoveryTimeout]);

  // Clear/delete conversation with optimistic UI update
  const clearConversation = useCallback(async () => {
    const conversationToDelete = conversationId;

    // Immediately clear local state (optimistic)
    setMessages([]);
    setConversationId(null);
    setError(null);

    // Force new chat on next message since there's no active conversation
    forceNewChatRef.current = true;

    if (conversationToDelete && hasAccess) {
      // Optimistically remove from conversations list cache
      const previousConversations = queryClient.getQueryData<{ data: ConversationSummary[] }>(
        aiCoachQueryKeys.conversations()
      );

      if (previousConversations?.data) {
        queryClient.setQueryData(aiCoachQueryKeys.conversations(), {
          ...previousConversations,
          data: previousConversations.data.filter((c) => c.id !== conversationToDelete)
        });
      }

      // Remove from conversation detail cache
      queryClient.removeQueries({
        queryKey: aiCoachQueryKeys.conversation(conversationToDelete)
      });

      try {
        // Make API call in background
        await aiCoachService.deleteConversation(conversationToDelete);
        // Invalidate to ensure sync with server
        queryClient.invalidateQueries({
          queryKey: aiCoachQueryKeys.currentConversation()
        });
      } catch (err: unknown) {
        logger.error("Failed to clear conversation", err as Record<string, unknown>);
        // Rollback on error - restore the conversation to cache
        if (previousConversations) {
          queryClient.setQueryData(aiCoachQueryKeys.conversations(), previousConversations);
        }
        // Refetch to ensure accurate state
        queryClient.invalidateQueries({ queryKey: aiCoachQueryKeys.conversations() });
      }
    }
  }, [conversationId, queryClient, hasAccess]);

  return {
    // State
    messages,
    isStreaming,
    isWaitingForResponse, // True when message sent but AI hasn't responded yet
    streamingText,
    conversationId,
    error,
    hasAccess,
    isLoadingConversation,

    // Pagination state
    hasMoreMessages, // True if there are older messages to load
    isLoadingMoreMessages, // True while fetching older messages
    totalMessages, // Total count of messages in the conversation

    // Goal focus state (for goal-specific conversations)
    focusedGoalId,
    setFocusedGoalId,

    // Actions
    sendMessage,
    retryLastMessage,
    cancelStream,
    loadConversation,
    loadMoreMessages, // Load older messages (for infinite scroll)
    startNewChat,
    clearConversation,
    setMessages
  };
}
