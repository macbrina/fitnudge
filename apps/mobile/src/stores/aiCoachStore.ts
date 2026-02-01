/**
 * AI Coach Store
 *
 * Manages global state for the AI Coach modal including:
 * - Modal visibility
 * - User preferences (language, etc.)
 * - Conversation context
 * - Pending message streaming (for realtime updates)
 *
 * This allows the AI Coach to maintain state across sessions
 * and be accessible from anywhere in the app via the floating button.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Pending AI response that arrived via realtime
 * Used to trigger manual streaming in the UI
 */
export interface PendingAIResponse {
  conversationId: string;
  content: string;
  messageIndex: number;
  status: "pending" | "completed" | "failed";
}

interface AICoachState {
  // Modal visibility
  isModalVisible: boolean;

  // User preferences
  selectedLanguage: string;

  // Conversation context
  currentConversationId: string | null;

  // Focused goal ID (when opened from a specific goal)
  focusedGoalId: string | null;

  // Pending AI response for manual streaming
  // When realtime detects a new AI response, it sets this
  // The UI then consumes it and triggers manual character-by-character streaming
  pendingAIResponse: PendingAIResponse | null;

  // Actions
  openModal: (goalId?: string) => void;
  closeModal: () => void;
  setSelectedLanguage: (language: string) => void;
  setCurrentConversationId: (id: string | null) => void;
  setFocusedGoalId: (id: string | null) => void;

  // Streaming actions
  setPendingAIResponse: (response: PendingAIResponse | null) => void;
  clearPendingAIResponse: () => void;

  // Reset
  resetState: () => void;
}

const initialState = {
  isModalVisible: false,
  selectedLanguage: "en",
  currentConversationId: null,
  focusedGoalId: null,
  pendingAIResponse: null
};

export const useAICoachStore = create<AICoachState>()(
  persist(
    (set) => ({
      ...initialState,

      openModal: (goalId?: string) => {
        set({ isModalVisible: true, focusedGoalId: goalId || null });
      },

      closeModal: () => {
        set({ isModalVisible: false, focusedGoalId: null });
      },

      setSelectedLanguage: (language: string) => {
        set({ selectedLanguage: language });
      },

      setCurrentConversationId: (id: string | null) => {
        set({ currentConversationId: id });
      },

      setFocusedGoalId: (id: string | null) => {
        set({ focusedGoalId: id });
      },

      setPendingAIResponse: (response: PendingAIResponse | null) => {
        set({ pendingAIResponse: response });
      },

      clearPendingAIResponse: () => {
        set({ pendingAIResponse: null });
      },

      resetState: () => {
        set(initialState);
      }
    }),
    {
      name: "ai-coach-store",
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist preferences, not modal visibility or pending responses
      partialize: (state) => ({
        selectedLanguage: state.selectedLanguage,
        currentConversationId: state.currentConversationId
      })
    }
  )
);

export default useAICoachStore;
