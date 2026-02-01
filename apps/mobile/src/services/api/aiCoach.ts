/**
 * AI Coach API Service
 *
 * Handles API calls for AI Coach chat functionality.
 */

import {
  BaseApiService,
  ApiResponse,
  apiRequestSSE,
  SSEConnection,
  SSEEventHandlers
} from "./base";
import { ROUTES } from "@/lib/routes";

// ============================================================================
// Types
// ============================================================================

export interface ConversationSummary {
  id: string;
  title?: string;
  message_count: number;
  last_message_at?: string;
  created_at: string;
}

export interface ConversationMessage {
  message_id?: string;
  request_id?: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  status?: "pending" | "completed" | "failed" | "generating";
}

export interface ConversationDetail {
  id: string;
  title?: string;
  messages: ConversationMessage[];
  message_count: number;
  last_message_at?: string;
  created_at: string;
  has_more_messages?: boolean; // True if there are older messages to load
  total_messages?: number; // Total count of all messages
}

export interface ConversationsListResponse {
  conversations: ConversationSummary[];
  has_more: boolean; // True if there are more conversations to load
  total_count: number; // Total number of conversations
}

export interface RateLimitStatus {
  can_send: boolean;
  remaining_messages: number;
  daily_limit: number;
  resets_at: string;
}

export interface FeatureAccessResponse {
  has_access: boolean;
  reason?: string;
}

export interface StreamEvent {
  type: "start" | "chunk" | "end" | "error";
  content?: string;
  conversation_id?: string;
  full_response?: string;
  tokens_used?: number;
  message?: string;
}

/** Redis SSE stream event payload (meta | chunk | done | error) */
export interface RedisStreamEvent {
  type: "meta" | "chunk" | "done" | "error";
  /** Set on meta event when backend sends source (e.g. "redis") */
  source?: string;
  content?: string;
  message?: string;
}

export interface AsyncChatRequest {
  message: string;
  conversation_id?: string | null;
  language?: string;
  is_retry?: boolean;
  force_new?: boolean;
  goal_id?: string | null;
}

export interface AsyncChatResponse {
  success: boolean;
  conversation_id?: string;
  message_status?: "pending" | "processing" | "completed" | "failed";
  task_id?: string;
  request_id?: string;
  user_message_id?: string;
  assistant_message_id?: string;
  error?: string;
}

export interface UnlockMessageRequest {
  reward_type: "ai_message";
  reward_amount: number;
}

export interface UnlockMessageResponse {
  success: boolean;
  messages_unlocked: number;
  remaining_messages: number;
  daily_limit: number;
}

// ============================================================================
// API Service
// ============================================================================

class AICoachService extends BaseApiService {
  /**
   * Check if user has access to AI Coach feature
   */
  async checkAccess(): Promise<ApiResponse<FeatureAccessResponse>> {
    return this.get<FeatureAccessResponse>(ROUTES.AI_COACH.ACCESS);
  }

  /**
   * Get rate limit status for AI Coach
   */
  async getRateLimit(): Promise<ApiResponse<RateLimitStatus>> {
    return this.get<RateLimitStatus>(ROUTES.AI_COACH.RATE_LIMIT);
  }

  /**
   * List user's conversations with pagination
   */
  async listConversations(
    limit: number = 20,
    offset: number = 0
  ): Promise<ApiResponse<ConversationsListResponse>> {
    return this.get<ConversationsListResponse>(
      `${ROUTES.AI_COACH.CONVERSATIONS}?limit=${limit}&offset=${offset}`
    );
  }

  /**
   * Get a specific conversation by ID with paginated messages
   * @param id Conversation ID
   * @param messageLimit Max number of messages to return (default 50)
   * @param messageOffset Offset from most recent messages for pagination
   */
  async getConversation(
    id: string,
    messageLimit: number = 50,
    messageOffset: number = 0
  ): Promise<ApiResponse<ConversationDetail>> {
    const params = new URLSearchParams({
      message_limit: messageLimit.toString(),
      message_offset: messageOffset.toString()
    });
    return this.get<ConversationDetail>(`${ROUTES.AI_COACH.CONVERSATION(id)}?${params}`);
  }

  /**
   * Get the current (most recent) conversation with paginated messages.
   * When goalId is set, returns the persistent goal-specific thread (or null if none yet).
   * @param messageLimit Max number of messages to return (default 50)
   * @param messageOffset Offset from most recent messages for pagination
   * @param goalId Optional goal ID to load the goal-scoped thread
   */
  async getCurrentConversation(
    messageLimit: number = 50,
    messageOffset: number = 0,
    goalId?: string | null
  ): Promise<ApiResponse<ConversationDetail | null>> {
    const params = new URLSearchParams({
      message_limit: messageLimit.toString(),
      message_offset: messageOffset.toString()
    });
    if (goalId) params.set("goal_id", goalId);
    return this.get<ConversationDetail | null>(`${ROUTES.AI_COACH.CURRENT_CONVERSATION}?${params}`);
  }

  /**
   * Start a new conversation
   */
  async startNewConversation(): Promise<ApiResponse<ConversationSummary>> {
    return this.post<ConversationSummary>(ROUTES.AI_COACH.NEW_CONVERSATION, {});
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(id: string): Promise<ApiResponse<void>> {
    return this.delete<void>(ROUTES.AI_COACH.CONVERSATION(id));
  }

  /**
   * Send a message asynchronously (background processing via Celery)
   * Returns immediately with pending status. Response is processed in background
   * and will be available via realtime subscription or next conversation fetch.
   */
  async sendMessageAsync(request: AsyncChatRequest): Promise<ApiResponse<AsyncChatResponse>> {
    return this.post<AsyncChatResponse>(ROUTES.AI_COACH.CHAT_ASYNC, request);
  }

  /**
   * Stream AI response via SSE (Redis pub/sub). Connect after sendMessageAsync.
   * Only works when AI_COACH_STREAM_VIA_REDIS is enabled on backend.
   * Falls back to Realtime when 501 or on error.
   */
  streamResponse(
    requestId: string,
    handlers: SSEEventHandlers<RedisStreamEvent>,
    conversationId?: string
  ): Promise<SSEConnection> {
    const endpoint = ROUTES.AI_COACH.STREAM(requestId, conversationId);
    return apiRequestSSE<RedisStreamEvent>(endpoint, { method: "GET" }, handlers);
  }

  /**
   * Unlock additional message(s) after watching a rewarded ad.
   * For free users only - allows them to get extra messages beyond the daily limit.
   */
  async unlockMessage(rewardAmount: number = 1): Promise<ApiResponse<UnlockMessageResponse>> {
    return this.post<UnlockMessageResponse>(ROUTES.AI_COACH.UNLOCK_MESSAGE, {
      reward_type: "ai_message",
      reward_amount: rewardAmount
    });
  }
}

// Export singleton instance
export const aiCoachService = new AICoachService();
