/**
 * AI Coach Chat Modal
 *
 * Interactive AI coaching chatbot for personalized fitness guidance.
 * Full-screen modal with streaming responses and conversation memory.
 *
 * Features:
 * - Real-time streaming responses
 * - Conversation history
 * - Premium gate for free users
 * - Voice input with permission handling
 * - Multi-language support
 * - Markdown rendering for AI responses
 */

import Button from "@/components/ui/Button";
import CheckmarkCircle from "@/components/ui/CheckmarkCircle";
import { getAdUnitId } from "@/constants/adUnits";
import { LANGUAGES } from "@/constants/localization";
import { AlertOverlay, useAlertModal } from "@/contexts/AlertModalContext";
import { aiCoachQueryKeys } from "@/hooks/api/queryKeys";
import {
  useAICoachChat,
  useAICoachConversations,
  useAICoachRateLimit,
  type ConversationSummary,
  type Message
} from "@/hooks/api/useAICoach";
import { useMediaPermissions } from "@/hooks/media/useMediaPermissions";
import { useSpeechRecognition } from "@/hooks/media/useSpeechRecognition";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { toRN } from "@/lib/units";
import { aiCoachService } from "@/services/api/aiCoach";
import { useAdMobStore } from "@/stores/adMobStore";
import { useAICoachStore } from "@/stores/aiCoachStore";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { formatTimeAgo as formatTimeAgoUtil } from "@/utils/helper";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

const Bot3DImage = require("@assetsimages/images/3d_bot.png");

// =====================================================
// ANIMATED AUDIO BARS COMPONENT
// =====================================================

interface AnimatedAudioBarsProps {
  color?: string;
  barCount?: number;
  barWidth?: number;
  barHeight?: number;
  gap?: number;
}

// Bouncing 3-dot indicator (no i18n, used for initial loading)
function BouncingDots({
  color = "#FFFFFF",
  dotSize = 8,
  gap = 4
}: {
  color?: string;
  dotSize?: number;
  gap?: number;
}) {
  const anims = useRef(Array.from({ length: 3 }, () => new Animated.Value(0))).current;

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const loops: Animated.CompositeAnimation[] = [];
    anims.forEach((anim, i) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 400,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true
          })
        ])
      );
      loops.push(loop);
      const t = setTimeout(() => loop.start(), i * 120);
      timeouts.push(t);
    });
    return () => {
      timeouts.forEach((t) => clearTimeout(t));
      loops.forEach((l) => l.stop());
    };
  }, [anims]);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap }}>
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: color,
            transform: [
              {
                translateY: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -6]
                })
              }
            ]
          }}
        />
      ))}
    </View>
  );
}

function AnimatedAudioBars({
  color = "#FFFFFF",
  barCount = 4,
  barWidth = 3,
  barHeight = 14,
  gap = 2
}: AnimatedAudioBarsProps) {
  const animations = useRef(
    Array.from({ length: barCount }, () => new Animated.Value(0.3))
  ).current;

  useEffect(() => {
    const animateBars = () => {
      const barAnimations = animations.map((anim, index) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration: 300 + index * 100,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true
            }),
            Animated.timing(anim, {
              toValue: 0.3,
              duration: 300 + index * 100,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true
            })
          ])
        );
      });

      Animated.parallel(barAnimations).start();
    };

    animateBars();

    return () => {
      animations.forEach((anim) => anim.stopAnimation());
    };
  }, [animations]);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap }}>
      {animations.map((anim, index) => (
        <Animated.View
          key={index}
          style={{
            width: barWidth,
            height: barHeight,
            backgroundColor: color,
            borderRadius: barWidth / 2,
            transform: [{ scaleY: anim }]
          }}
        />
      ))}
    </View>
  );
}
import { useRewardedAd } from "react-native-google-mobile-ads";
import Markdown from "react-native-markdown-display";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// =====================================================
// TYPES
// =====================================================

interface AICoachModalProps {
  visible: boolean;
  onClose: () => void;
  /** Optional goal ID to focus the conversation on a specific goal */
  goalId?: string | null;
}

// =====================================================
// COMPONENT
// =====================================================

export default function AICoachModal({ visible, onClose, goalId }: AICoachModalProps) {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { hasFeature, getPlan, openModal: openSubscriptionModal } = useSubscriptionStore();
  const queryClient = useQueryClient();
  const { microphoneStatus } = useMediaPermissions();
  const { showAlert, showConfirm, showToast } = useAlertModal();

  // AI Coach store for persisted preferences
  const { selectedLanguage, setSelectedLanguage } = useAICoachStore();

  // Track text that existed before starting to speak (for appending)
  const textBeforeSpeakingRef = useRef("");

  // Speech recognition for voice input (must be after selectedLanguage is defined)
  const { isListening, startListening, stopListening } = useSpeechRecognition({
    locale: selectedLanguage || "en-US",
    onTranscriptChange: (text) => {
      // Append new speech to existing text (with space separator)
      const prefix = textBeforeSpeakingRef.current;
      const newText = prefix ? `${prefix} ${text}` : text;
      setInputText(newText);
    },
    onError: (error) => {
      console.warn("[AICoachScreen] Speech recognition error:", error);
    }
  });

  // Feature check
  const hasAccess = hasFeature("ai_coach_chat");

  // Chat state
  const {
    messages,
    isStreaming,
    isWaitingForResponse,
    error,
    conversationId,
    sendMessage,
    retryLastMessage,
    cancelStream,
    loadConversation,
    loadMoreMessages,
    startNewChat,
    clearConversation,
    clearLocalStateOnly,
    isLoadingConversation,
    hasMoreMessages,
    setFocusedGoalId,
    isLoadingMoreMessages
  } = useAICoachChat();

  // Combined loading state (waiting for response or streaming)
  const isProcessing = isStreaming || isWaitingForResponse;

  // Check if user is on free plan (has limited messages)
  const isFreeUser = getPlan() === "free";

  // Get AI coach message limit from subscription store (updates immediately when plan changes)
  const getFeatureValue = useSubscriptionStore((state) => state.getFeatureValue);
  const storeLimit = getFeatureValue("ai_coach_chat");
  const dailyLimitFromStore =
    typeof storeLimit === "number" ? storeLimit : storeLimit === null ? 9999 : 3;

  // Fetch usage and bonus from backend (backend tracks actual messages sent today)
  const {
    data: rateLimitResponse,
    refetch: refetchRateLimit,
    isLoading: isLoadingRateLimit
  } = useAICoachRateLimit(hasAccess);
  const backendRateLimit = rateLimitResponse?.data;

  // Calculate rate limit using store's daily limit + backend's usage tracking
  // This ensures limit updates immediately with subscription while usage stays accurate
  const rateLimit = useMemo(() => {
    if (!backendRateLimit) {
      // Backend not loaded yet - use store limit with optimistic values
      return {
        can_send: true,
        remaining_messages: dailyLimitFromStore,
        daily_limit: dailyLimitFromStore,
        resets_at: ""
      };
    }

    // Extract usage from backend: used = backend_daily_limit - backend_remaining
    // This gives us the actual messages sent today regardless of what limit backend used
    const messagesUsed = backendRateLimit.daily_limit - backendRateLimit.remaining_messages;

    // Calculate remaining using the store's limit (which reflects current subscription)
    const remainingMessages = Math.max(0, dailyLimitFromStore - messagesUsed);
    const canSend = remainingMessages > 0;

    return {
      can_send: canSend,
      remaining_messages: remainingMessages,
      daily_limit: dailyLimitFromStore,
      resets_at: backendRateLimit.resets_at
    };
  }, [backendRateLimit, dailyLimitFromStore]);

  // Check if AdMob is initialized before using rewarded ads
  const isAdMobInitialized = useAdMobStore((state) => state.isInitialized);

  // Rewarded ad for unlocking additional messages (free users only)
  // Only pass ad unit ID if AdMob is initialized AND user is free
  const {
    isLoaded: isAdLoaded,
    load: loadAd,
    show: showAd,
    isEarnedReward,
    isClosed: isAdClosed
  } = useRewardedAd(isFreeUser && isAdMobInitialized ? getAdUnitId("AI_MESSAGE") : null, {
    requestNonPersonalizedAdsOnly: false
  });

  // State for showing limit reached modal
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [isUnlockingMessage, setIsUnlockingMessage] = useState(false);
  const rewardProcessedRef = useRef(false);

  // Load ad when component mounts and user is on free plan (only after AdMob initialized)
  useEffect(() => {
    if (visible && isFreeUser && isAdMobInitialized && !isAdLoaded) {
      loadAd();
    }
  }, [visible, isFreeUser, isAdMobInitialized, isAdLoaded, loadAd]);

  // Handle ad reward completion when user earns a reward
  useEffect(() => {
    const handleRewardEarned = async () => {
      // Prevent duplicate processing - only process after ad is closed and reward is earned
      if (rewardProcessedRef.current || !isEarnedReward || !isAdClosed) return;
      rewardProcessedRef.current = true;

      setIsUnlockingMessage(true);
      setShowLimitModal(false);

      try {
        // Call API to unlock additional message (backend tracks bonus messages)
        const response = await aiCoachService.unlockMessage(1);

        if (response.data?.success) {
          // Refetch rate limit to get updated usage/bonus from backend
          await refetchRateLimit();

          // Invalidate rate limit query to ensure fresh data
          queryClient.invalidateQueries({ queryKey: aiCoachQueryKeys.rateLimit() });

          await showAlert({
            title: t("ai_coach.message_unlocked") || "Message Unlocked!",
            message:
              t("ai_coach.message_unlocked_desc") ||
              "You've earned 1 additional message. Keep chatting!",
            variant: "success",
            confirmLabel: t("common.continue") || "Continue"
          });

          // Load another ad for future use
          loadAd();
        }
      } catch (err) {
        console.error("[AI Coach] Failed to unlock message:", err);
        await showAlert({
          title: t("common.error") || "Error",
          message: t("ai_coach.unlock_failed") || "Failed to unlock message. Please try again.",
          variant: "error",
          confirmLabel: t("common.ok") || "OK"
        });
      } finally {
        setIsUnlockingMessage(false);
        // Reset for next ad watch
        rewardProcessedRef.current = false;
      }
    };

    handleRewardEarned();
  }, [isEarnedReward, isAdClosed, refetchRateLimit, loadAd, showAlert, t]);

  // Handle watch ad button press
  const handleWatchAd = useCallback(async () => {
    if (!isAdLoaded) {
      await showAlert({
        title: t("ai_coach.ad_not_ready") || "Ad Not Ready",
        message: t("ai_coach.ad_loading") || "Please wait a moment and try again.",
        variant: "info",
        confirmLabel: t("common.ok") || "OK"
      });
      loadAd();
      return;
    }

    // Reset processed flag before showing new ad
    rewardProcessedRef.current = false;

    // Show the rewarded ad
    showAd();
  }, [isAdLoaded, showAd, showAlert, loadAd, t]);

  // Conversations list for drawer - only fetch if user has access
  const {
    data: conversationsResponse,
    refetch: refetchConversations,
    isLoading: isLoadingConversations
  } = useAICoachConversations(20, 0, hasAccess);

  // Handle new response format (conversations are now in a nested object)
  const conversationsData = conversationsResponse?.data;
  const conversations = conversationsData?.conversations ?? [];
  const hasMoreConversations = conversationsData?.has_more ?? false;

  // Pagination state for conversations drawer
  const [allConversations, setAllConversations] = useState<ConversationSummary[]>([]);
  const [conversationsOffset, setConversationsOffset] = useState(0);
  const [isLoadingMoreConversations, setIsLoadingMoreConversations] = useState(false);
  const [hasMoreConvos, setHasMoreConvos] = useState(false);

  // Sync initial conversations data
  useEffect(() => {
    if (conversations.length > 0 && conversationsOffset === 0) {
      setAllConversations(conversations);
      setHasMoreConvos(hasMoreConversations);
    }
  }, [conversations, hasMoreConversations, conversationsOffset]);

  // Sync focused goal with modal context (goalId from layout = store's focusedGoalId)
  useEffect(() => {
    if (visible) {
      setFocusedGoalId(goalId ?? null);
    } else {
      setFocusedGoalId(null);
    }
  }, [visible, goalId, setFocusedGoalId]);

  // Input state
  const [inputText, setInputText] = useState("");
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showPrivacyInfo, setShowPrivacyInfo] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);

  // Get current language name
  const currentLanguage = LANGUAGES.find((l) => l.code === selectedLanguage) || LANGUAGES[0];

  // Check if input is empty
  const isInputEmpty = !inputText.trim();

  // Check if the last message has no AI response (user message at top of inverted list)
  // This happens when connection drops during streaming or response doesn't save
  const showRegenerateBanner = useMemo(() => {
    if (isProcessing || isLoadingConversation || isLoadingRateLimit || messages.length === 0)
      return false;
    // Messages are inverted, so first item is the most recent
    const lastMessage = messages[0];

    // Show regenerate if:
    // 1. Last message is from user (no AI response after it)
    // 2. Not in a failed/error state (already shown separately)
    // 3. Not pending
    return lastMessage.user._id === 1 && !lastMessage.pending && !lastMessage.failed && !error;
  }, [messages, isStreaming, isLoadingConversation, isLoadingRateLimit, error]);
  // Thinking messages that cycle while waiting (memoized to avoid effect re-runs)
  const thinkingMessages = useMemo(
    () => (t("ai_coach.thinking_messages", { returnObjects: true }) as string[]) || [],
    [t]
  );
  const [currentThinkingMessage, setCurrentThinkingMessage] = useState("");
  const thinkingMessageRef = useRef<string>("");

  // Loading UX: bouncing dots for first 5-6s, then typing indicator (cycling thinking messages)
  const [showTypingIndicator, setShowTypingIndicator] = useState(false);
  const pendingTransitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // FlatList ref for scrolling
  const flatListRef = useRef<FlatList<Message>>(null);

  // Pulsing dot animation
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Start pulsing animation when processing
  useEffect(() => {
    if (isProcessing) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 600,
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true
          })
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isProcessing, pulseAnim]);

  // Loading UX: show bouncing dots for first 5-6s, then switch to typing indicator
  const hasPendingAssistant = messages.some((m) => m.user._id !== 1 && m.pending && !m.text);
  useEffect(() => {
    if (pendingTransitionTimerRef.current) {
      clearTimeout(pendingTransitionTimerRef.current);
      pendingTransitionTimerRef.current = null;
    }
    if (isProcessing && hasPendingAssistant) {
      setShowTypingIndicator(false);
      pendingTransitionTimerRef.current = setTimeout(() => {
        setShowTypingIndicator(true);
        pendingTransitionTimerRef.current = null;
      }, 5000);
    } else {
      setShowTypingIndicator(false);
    }
    return () => {
      if (pendingTransitionTimerRef.current) {
        clearTimeout(pendingTransitionTimerRef.current);
        pendingTransitionTimerRef.current = null;
      }
    };
  }, [isProcessing, hasPendingAssistant]);

  // Clear transition state when conversation changes
  useEffect(() => {
    setShowTypingIndicator(false);
    if (pendingTransitionTimerRef.current) {
      clearTimeout(pendingTransitionTimerRef.current);
      pendingTransitionTimerRef.current = null;
    }
  }, [conversationId]);

  // Cycle through thinking messages while processing
  useEffect(() => {
    if (isProcessing && Array.isArray(thinkingMessages) && thinkingMessages.length > 0) {
      const getRandomMessage = () =>
        thinkingMessages[Math.floor(Math.random() * thinkingMessages.length)];

      // Only set initial message if not already set (handleSend may have set it)
      if (!thinkingMessageRef.current) {
        const initial = getRandomMessage();
        setCurrentThinkingMessage(initial);
        thinkingMessageRef.current = initial;
      }
      // When ref exists, handleSend already set state - skip setState to avoid re-render loop

      // Cycle every 3 seconds
      const interval = setInterval(() => {
        const newMessage = getRandomMessage();
        setCurrentThinkingMessage(newMessage);
        thinkingMessageRef.current = newMessage;
      }, 3000);

      return () => clearInterval(interval);
    } else if (!isProcessing) {
      // Clear the ref when not processing so next time starts fresh
      thinkingMessageRef.current = "";
    }
  }, [isProcessing, thinkingMessages]);

  // Markdown styles
  const markdownStyles = useMemo(
    () => ({
      body: {
        fontSize: toRN(tokens.typography.fontSize.sm),
        fontFamily: fontFamily.regular,
        color: colors.text.primary,
        lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5
      },
      paragraph: {
        marginBottom: toRN(tokens.spacing[2]),
        marginTop: 0
      },
      strong: {
        fontFamily: fontFamily.semiBold,
        color: colors.text.primary
      },
      em: {
        fontFamily: fontFamily.regularItalic
      },
      bullet_list: {
        marginBottom: toRN(tokens.spacing[2]),
        marginTop: toRN(tokens.spacing[1])
      },
      bullet_list_icon: {
        color: colors.text.primary,
        fontSize: toRN(tokens.typography.fontSize.base),
        lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5,
        marginRight: toRN(tokens.spacing[2]),
        marginLeft: toRN(tokens.spacing[1])
      },
      ordered_list: {
        marginBottom: toRN(tokens.spacing[2]),
        marginTop: toRN(tokens.spacing[1])
      },
      ordered_list_icon: {
        color: colors.text.primary,
        fontSize: toRN(tokens.typography.fontSize.base),
        lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5,
        marginRight: toRN(tokens.spacing[2]),
        marginLeft: toRN(tokens.spacing[1])
      },
      list_item: {
        marginBottom: toRN(tokens.spacing[1])
      },
      heading1: {
        fontSize: toRN(tokens.typography.fontSize.sm),
        fontFamily: fontFamily.bold,
        color: colors.text.primary,
        marginBottom: toRN(tokens.spacing[1]),
        marginTop: toRN(tokens.spacing[2])
      },
      heading2: {
        fontSize: toRN(tokens.typography.fontSize.sm),
        fontFamily: fontFamily.semiBold,
        color: colors.text.primary,
        marginBottom: toRN(tokens.spacing[1]),
        marginTop: toRN(tokens.spacing[2])
      },
      heading3: {
        fontSize: toRN(tokens.typography.fontSize.sm),
        fontFamily: fontFamily.semiBold,
        color: colors.text.primary,
        marginBottom: toRN(tokens.spacing[1]),
        marginTop: toRN(tokens.spacing[1])
      },
      code_inline: {
        fontFamily: fontFamily.regular,
        backgroundColor: colors.bg.surface,
        paddingHorizontal: toRN(tokens.spacing[1]),
        borderRadius: toRN(tokens.borderRadius.sm)
      }
    }),
    [colors]
  );

  // On open: load conversation for current context (general vs goal).
  // General (goalId null): most recent conversation. Goal: goal-scoped thread or empty.
  // loadConversation now handles caching internally - no need to clear every time.
  useEffect(() => {
    if (!visible || !hasAccess) return;
    loadConversation(undefined, goalId ?? undefined);
  }, [visible, hasAccess, goalId, loadConversation]);

  // Voice recording handler
  const handleSpeakPress = async () => {
    // If already listening, stop
    if (isListening) {
      await stopListening();
      return;
    }

    // Check permission status first (before triggering speech recognition check)
    if (microphoneStatus === "denied") {
      // Permission denied, redirect to settings
      const openSettings = await showConfirm({
        title: t("ai_coach.microphone_required") || "Microphone Required",
        message:
          t("ai_coach.microphone_permission_denied") ||
          "Please enable microphone access in your device settings to use voice input.",
        variant: "warning",
        confirmLabel: t("common.open_settings") || "Open Settings",
        cancelLabel: t("common.cancel") || "Cancel"
      });
      if (openSettings) {
        if (Platform.OS === "ios") {
          Linking.openURL("app-settings:");
        } else {
          Linking.openSettings();
        }
      }
      return;
    }

    // Save current text before starting (so we can append to it)
    textBeforeSpeakingRef.current = inputText.trim();

    // Start listening - the voice library handles permission requests internally
    // It will prompt for both microphone and speech recognition permissions if needed
    const started = await startListening();
    if (!started) {
      // Show error message - could be permissions denied or speech recognition unavailable
      await showAlert({
        title: t("ai_coach.voice_error") || "Voice Error",
        message:
          t("ai_coach.voice_unavailable_desc") ||
          "Speech recognition is not available. Please check your permissions in Settings or try typing instead.",
        variant: "warning",
        confirmLabel: t("common.ok") || "OK"
      });
    }
  };

  // Send message handler
  const handleSend = useCallback(async () => {
    if (!inputText.trim() || isProcessing) return;

    // Check if user has access
    if (!hasAccess) {
      // Dismiss keyboard before showing the modal
      Keyboard.dismiss();
      const upgrade = await showConfirm({
        title: t("ai_coach.upgrade_required") || "Upgrade Required",
        message:
          t("ai_coach.upgrade_to_chat") ||
          "Upgrade to Pro or restore your subscription to chat with Coach Nudge.",
        variant: "info",
        confirmLabel: t("common.upgrade") || "Upgrade",
        cancelLabel: t("common.cancel") || "Cancel"
      });
      if (upgrade) {
        onClose();
        openSubscriptionModal();
      }
      return;
    }

    // Check rate limit
    if (rateLimit && !rateLimit.can_send) {
      Keyboard.dismiss();

      if (isFreeUser) {
        // Free users: show modal with ad option
        setShowLimitModal(true);
      } else {
        // Premium users: show soft info alert (100 msgs/day is generous)
        await showAlert({
          title: t("ai_coach.premium_limit_title") || "Daily Limit Reached",
          message:
            t("ai_coach.premium_limit_desc") ||
            `You've used all ${rateLimit.daily_limit} messages for today. Your limit resets at midnight. This is to ensure quality service for all users.`,
          variant: "info",
          confirmLabel: t("common.ok") || "OK"
        });
      }
      return;
    }

    const text = inputText.trim();
    setInputText("");
    Keyboard.dismiss();

    // Set thinking message IMMEDIATELY before sending so it shows right away
    if (Array.isArray(thinkingMessages) && thinkingMessages.length > 0) {
      const initialThinking = thinkingMessages[Math.floor(Math.random() * thinkingMessages.length)];
      thinkingMessageRef.current = initialThinking;
      setCurrentThinkingMessage(initialThinking);
    }

    sendMessage(text, selectedLanguage);

    // Scroll to bottom (top for inverted list) after sending
    setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, 100);
  }, [
    inputText,
    isProcessing,
    sendMessage,
    selectedLanguage,
    hasAccess,
    isFreeUser,
    rateLimit,
    t,
    onClose,
    openSubscriptionModal,
    showConfirm,
    thinkingMessages
  ]);

  // Reset handler
  const handleReset = useCallback(() => {
    setInputText("");
  }, []);

  // Load more conversations for drawer infinite scroll
  const handleLoadMoreConversations = useCallback(async () => {
    if (!hasAccess || isLoadingMoreConversations || !hasMoreConvos) return;

    setIsLoadingMoreConversations(true);
    try {
      const newOffset = conversationsOffset + 20;
      const response = await aiCoachService.listConversations(20, newOffset);
      if (response.data) {
        const newConversations = response.data.conversations ?? [];
        setAllConversations((prev) => [...prev, ...newConversations]);
        setConversationsOffset(newOffset);
        setHasMoreConvos(response.data.has_more ?? false);
      }
    } catch (err) {
      console.error("Failed to load more conversations:", err);
    } finally {
      setIsLoadingMoreConversations(false);
    }
  }, [hasAccess, isLoadingMoreConversations, hasMoreConvos, conversationsOffset]);

  // Open drawer - only refetch if user has access
  const handleOpenDrawer = useCallback(() => {
    if (hasAccess) {
      // Reset pagination and refetch first page
      setConversationsOffset(0);
      refetchConversations();
    }
    setShowDrawer(true);
  }, [refetchConversations, hasAccess]);

  // Close drawer
  const handleCloseDrawer = useCallback(() => {
    setShowDrawer(false);
  }, []);

  // Select a conversation from drawer - only load if user has access
  const handleSelectConversation = useCallback(
    async (id: string) => {
      setShowDrawer(false);
      if (hasAccess) {
        setFocusedGoalId(null);
        loadConversation(id);
      } else {
        // Show upgrade prompt for non-premium users
        const upgrade = await showConfirm({
          title: t("ai_coach.upgrade_required") || "Upgrade Required",
          message:
            t("ai_coach.upgrade_to_chat") ||
            "Upgrade to Pro or restore your subscription to chat with Coach Nudge.",
          variant: "info",
          confirmLabel: t("common.upgrade") || "Upgrade",
          cancelLabel: t("common.cancel") || "Cancel"
        });
        if (upgrade) {
          onClose();
          openSubscriptionModal();
        }
      }
    },
    [loadConversation, hasAccess, setFocusedGoalId, showConfirm, t, onClose, openSubscriptionModal]
  );

  // Start new chat from drawer - only if user has access
  const handleNewChat = useCallback(async () => {
    setShowDrawer(false);
    if (hasAccess) {
      startNewChat();
    } else {
      // Show upgrade prompt for non-premium users
      const upgrade = await showConfirm({
        title: t("ai_coach.upgrade_required") || "Upgrade Required",
        message:
          t("ai_coach.upgrade_to_chat") ||
          "Upgrade to Pro or restore your subscription to chat with Coach Nudge.",
        variant: "info",
        confirmLabel: t("common.upgrade") || "Upgrade",
        cancelLabel: t("common.cancel") || "Cancel"
      });
      if (upgrade) {
        onClose();
        openSubscriptionModal();
      }
    }
  }, [startNewChat, hasAccess, showConfirm, t, onClose, openSubscriptionModal]);

  // Delete current conversation (from header menu)
  const handleDeleteCurrentConversation = useCallback(async () => {
    if (!conversationId) {
      // No conversation to delete, just clear messages
      clearConversation();
      return;
    }

    const confirmed = await showConfirm({
      title: t("ai_coach.delete_conversation") || "Delete conversation",
      message:
        t("ai_coach.delete_conversation_confirm") ||
        "Are you sure you want to delete this conversation?",
      variant: "error",
      confirmLabel: t("common.delete") || "Delete",
      cancelLabel: t("common.cancel") || "Cancel"
    });

    if (confirmed) {
      clearConversation();
      refetchConversations();
    }
  }, [conversationId, clearConversation, refetchConversations, showConfirm, t]);

  // Show privacy info modal
  const handleShowPrivacyInfo = useCallback(() => {
    setShowPrivacyInfo(true);
  }, []);

  // Format time ago for conversation list
  const formatTimeAgo = useCallback((dateString: string | null | undefined) => {
    if (!dateString) return "";
    return formatTimeAgoUtil(dateString, { addSuffix: true });
  }, []);

  const handleCopyMessage = useCallback(
    async (text: string) => {
      if (!text?.trim()) return;
      await Clipboard.setStringAsync(text.trim());
      showToast({
        title: t("ai_coach.copied") || "Copied to clipboard",
        variant: "success"
      });
    },
    [showToast, t]
  );

  // Render message bubble
  const renderMessage = useCallback(
    ({ item }: { item: Message }) => {
      const isUser = item.user._id === 1;
      const isPending = item.pending && !item.text;

      // Handle failed message with retry
      if (item.failed) {
        // Show user-friendly message for common errors
        let displayError = item.errorMessage ?? t("ai_coach.error_retry");
        const lowerError = displayError.toLowerCase();
        if (
          lowerError.includes("no response body") ||
          lowerError.includes("network") ||
          lowerError.includes("ssl") ||
          lowerError.includes("timeout") ||
          lowerError.includes("connection")
        ) {
          displayError = t("ai_coach.message_failed") || "Message failed. Tap to retry.";
        }

        return (
          <TouchableOpacity
            onPress={retryLastMessage}
            style={[styles.messageBubble, styles.assistantBubble]}
            activeOpacity={0.7}
          >
            <View style={styles.avatarContainer}>
              <View style={[styles.coachAvatar, styles.coachAvatarError]}>
                <Ionicons name="alert-circle" size={16} color="#FFFFFF" />
              </View>
            </View>
            <View style={[styles.messageContent, styles.failedContent]}>
              <View style={styles.failedRow}>
                <Ionicons name="refresh" size={16} color="#EF4444" />
                <Text style={styles.failedText}>{displayError}</Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      }

      const canCopy = !item.pending && !item.failed && !!item.text?.trim();

      return (
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          <View style={styles.messageColumn}>
            <View
              style={[
                styles.messageContent,
                isUser
                  ? styles.userContent
                  : isPending
                    ? styles.typingContent
                    : styles.assistantContent
              ]}
            >
              {isUser ? (
                <Text style={styles.userMessageText}>{item.text}</Text>
              ) : isPending ? (
                <View style={styles.typingIndicator}>
                  {showTypingIndicator ? (
                    <>
                      <Animated.View
                        style={[
                          styles.pulsingDot,
                          { backgroundColor: brandColors.primary, opacity: pulseAnim }
                        ]}
                      />
                      <Text style={styles.typingText}>
                        {currentThinkingMessage ||
                          thinkingMessageRef.current ||
                          t("ai_coach.typing")}
                      </Text>
                    </>
                  ) : (
                    <BouncingDots color={brandColors.primary} dotSize={8} gap={4} />
                  )}
                </View>
              ) : (
                <Markdown style={markdownStyles}>{item.text}</Markdown>
              )}
            </View>
            {canCopy && (
              <TouchableOpacity
                onPress={() => handleCopyMessage(item.text)}
                style={[
                  styles.copyButton,
                  isUser ? styles.copyButtonUser : styles.copyButtonAssistant
                ]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel={t("ai_coach.copy") || "Copy message"}
              >
                <Ionicons name="copy-outline" size={16} color={colors.text.tertiary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    },
    [
      styles,
      markdownStyles,
      brandColors.primary,
      colors.text.tertiary,
      t,
      retryLastMessage,
      pulseAnim,
      currentThinkingMessage,
      handleCopyMessage,
      showTypingIndicator
    ]
  );

  // Chat UI - available to all users (send blocked for non-premium)
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Gradient Header Background - Uses primary blue colors */}
        {/* <Svg
          height={insets.top + 60}
          width="100%"
          style={{ position: "absolute", top: 0, left: 0, right: 0 }}
        >
          <Defs>
            <SvgLinearGradient id="headerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#60a5fa" stopOpacity={0.9} />
              <Stop offset="100%" stopColor="#3b82f6" stopOpacity={0.9} />
            </SvgLinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#headerGradient)" />
        </Svg> */}

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + toRN(tokens.spacing[2]) }]}>
          {/* Left side: Menu */}
          <TouchableOpacity onPress={handleOpenDrawer} style={styles.headerIconButton}>
            <Ionicons name="menu-outline" size={24} color={colors.text.primary} />
          </TouchableOpacity>

          {/* Center: Pro Badge for free users, Rate Limit for premium users */}
          {hasAccess ? (
            rateLimit && (
              <View style={styles.rateLimitBadge}>
                <Text style={styles.rateLimitText}>
                  {rateLimit.can_send ? (
                    <>
                      {rateLimit.remaining_messages}/{rateLimit.daily_limit}{" "}
                      <Text style={styles.rateLimitLabel}>{t("ai_coach.daily")}</Text>
                    </>
                  ) : (
                    t("ai_coach.limit_reached")
                  )}
                </Text>
              </View>
            )
          ) : (
            <TouchableOpacity
              style={styles.proBadge}
              onPress={() => {
                onClose();
                openSubscriptionModal();
              }}
            >
              <Ionicons name="diamond" size={14} color={brandColors.primary} />
              <Text style={styles.proBadgeText}>{t("common.pro")}</Text>
            </TouchableOpacity>
          )}

          {/* Right side: More Options, Close */}
          <View style={styles.headerRightActions}>
            {/* Hide options menu when loading conversation or rate limit */}
            {!isLoadingConversation && !isLoadingRateLimit && (
              <TouchableOpacity
                onPress={() => setShowOptionsMenu(!showOptionsMenu)}
                style={styles.headerSmallButton}
              >
                <Ionicons name="ellipsis-horizontal" size={22} color={colors.text.secondary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} style={styles.headerSmallButton}>
              <Ionicons name="chevron-down" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Options Dropdown Menu */}
          {showOptionsMenu && (
            <>
              <TouchableOpacity
                style={styles.optionsBackdrop}
                activeOpacity={1}
                onPress={() => setShowOptionsMenu(false)}
              />
              <View style={[styles.optionsMenu, { top: insets.top + 50 }]}>
                <TouchableOpacity
                  style={styles.optionsMenuItem}
                  onPress={() => {
                    setShowOptionsMenu(false);
                    handleShowPrivacyInfo();
                  }}
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={20}
                    color={colors.text.primary}
                  />
                  <Text style={styles.optionsMenuText}>{t("ai_coach.chat_info")}</Text>
                </TouchableOpacity>
                {hasAccess && (
                  <TouchableOpacity
                    style={[styles.optionsMenuItem, styles.optionsMenuItemDanger]}
                    onPress={() => {
                      setShowOptionsMenu(false);
                      handleDeleteCurrentConversation();
                    }}
                  >
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    <Text style={[styles.optionsMenuText, styles.optionsMenuTextDanger]}>
                      {t("ai_coach.delete_chat")}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </View>

        {/* Chat History Drawer */}
        <Modal
          visible={showDrawer}
          animationType="none"
          transparent={true}
          onRequestClose={handleCloseDrawer}
        >
          <View style={styles.drawerOverlay}>
            <TouchableOpacity
              style={styles.drawerBackdrop}
              activeOpacity={1}
              onPress={handleCloseDrawer}
            />
            <View style={[styles.drawerContainer, { paddingTop: insets.top }]}>
              {/* Drawer Header */}
              <View style={styles.drawerHeader}>
                <Text style={styles.drawerTitle}>{t("ai_coach.chat_history")}</Text>
                <TouchableOpacity onPress={handleNewChat} style={styles.newChatButton}>
                  <Ionicons name="create-outline" size={22} color={colors.text.primary} />
                </TouchableOpacity>
              </View>

              {/* Conversations List */}
              {isLoadingConversations ? (
                <View style={styles.drawerLoading}>
                  <ActivityIndicator size="small" color={brandColors.primary} />
                  <Text style={styles.drawerLoadingText}>{t("ai_coach.loading_history")}</Text>
                </View>
              ) : (
                <FlatList
                  data={allConversations}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.drawerList}
                  showsVerticalScrollIndicator={false}
                  onEndReached={hasMoreConvos ? handleLoadMoreConversations : undefined}
                  onEndReachedThreshold={0.3}
                  ListEmptyComponent={
                    <View style={styles.drawerEmpty}>
                      <Text style={styles.drawerEmptyText}>{t("ai_coach.no_conversations")}</Text>
                      <Text style={styles.drawerEmptySubtext}>{t("ai_coach.start_chatting")}</Text>
                    </View>
                  }
                  ListFooterComponent={
                    isLoadingMoreConversations ? (
                      <View style={styles.drawerLoadingMore}>
                        <ActivityIndicator size="small" color={brandColors.primary} />
                        <Text style={styles.drawerLoadingMoreText}>
                          {t("ai_coach.loading_more_conversations")}
                        </Text>
                      </View>
                    ) : null
                  }
                  renderItem={({ item }: { item: ConversationSummary }) => (
                    <TouchableOpacity
                      style={[
                        styles.drawerItem,
                        item.id === conversationId && styles.drawerItemActive
                      ]}
                      onPress={() => handleSelectConversation(item.id)}
                    >
                      <Text style={styles.drawerItemTime}>
                        {formatTimeAgo(item.last_message_at || item.created_at).toUpperCase()}
                      </Text>
                      <Text style={styles.drawerItemTitle} numberOfLines={1}>
                        {item.title || t("ai_coach.new_conversation")}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          </View>
        </Modal>

        {/* Messages */}
        <KeyboardAvoidingView
          style={styles.chatContainer}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          {isLoadingConversation || isLoadingRateLimit ? (
            // Loading state for conversation or rate limit
            <View style={styles.loadingContainer}>
              <View style={styles.loadingContent}>
                <View style={styles.loadingIconContainer}>
                  <Image
                    source={Bot3DImage}
                    style={{ width: 80, height: 80 }}
                    resizeMode="contain"
                  />
                </View>
                <ActivityIndicator
                  size="large"
                  color={brandColors.primary}
                  style={styles.loadingSpinner}
                />
                <Text style={styles.loadingText}>{t("ai_coach.loading_conversation")}</Text>
              </View>
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              {/* Center content */}
              <View style={styles.emptyCenter}>
                <View style={styles.emptyIconContainer}>
                  <Image
                    source={Bot3DImage}
                    style={{ width: 100, height: 100 }}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.emptyTitle}>{t("ai_coach.empty_title")}</Text>
                <Text style={styles.emptyDescription}>{t("ai_coach.empty_description")}</Text>
              </View>

              {/* Horizontal suggestion chips at bottom */}
              <View style={styles.suggestionsBottom}>
                {/* Row 1 */}
                <FlatList
                  data={[
                    { key: "motivation", text: t("ai_coach.suggestions.motivation") },
                    { key: "patterns", text: t("ai_coach.suggestions.patterns") },
                    { key: "why", text: t("ai_coach.suggestions.why") },
                    { key: "consistency", text: t("ai_coach.suggestions.consistency") }
                  ]}
                  keyExtractor={(item) => item.key}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.suggestionsRow}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.suggestionChip}
                      onPress={() => setInputText(item.text)}
                    >
                      <Text style={styles.suggestionText}>{item.text}</Text>
                    </TouchableOpacity>
                  )}
                />
                {/* Row 2 */}
                <FlatList
                  data={[
                    { key: "progress", text: t("ai_coach.suggestions.progress") },
                    { key: "setback", text: t("ai_coach.suggestions.setback") },
                    { key: "streak", text: t("ai_coach.suggestions.streak") },
                    { key: "goals", text: t("ai_coach.suggestions.goals") }
                  ]}
                  keyExtractor={(item) => item.key}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.suggestionsRow}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.suggestionChip}
                      onPress={() => setInputText(item.text)}
                    >
                      <Text style={styles.suggestionText}>{item.text}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item._id}
              inverted
              contentContainerStyle={styles.messagesList}
              showsVerticalScrollIndicator={false}
              onEndReached={hasMoreMessages ? loadMoreMessages : undefined}
              onEndReachedThreshold={0.3}
              ListFooterComponent={
                isLoadingMoreMessages ? (
                  <View style={styles.loadMoreContainer}>
                    <ActivityIndicator size="small" color={brandColors.primary} />
                    <Text style={styles.loadMoreText}>{t("ai_coach.loading_messages")}</Text>
                  </View>
                ) : hasMoreMessages ? (
                  <TouchableOpacity style={styles.loadMoreButton} onPress={loadMoreMessages}>
                    <Text style={styles.loadMoreButtonText}>{t("ai_coach.load_older")}</Text>
                  </TouchableOpacity>
                ) : null
              }
            />
          )}

          {/* Error Message - Tappable for retry */}
          {error && (
            <TouchableOpacity
              style={styles.errorBanner}
              onPress={retryLastMessage}
              activeOpacity={0.7}
            >
              <Ionicons name="warning" size={16} color="#EF4444" />
              <Text style={styles.errorText}>
                {error.includes("No response body")
                  ? t("ai_coach.message_failed") || "Message failed. Tap to retry."
                  : error}
              </Text>
              <Ionicons name="refresh" size={16} color="#EF4444" />
            </TouchableOpacity>
          )}

          {/* Regenerate Banner - Shows when last message has no AI response */}
          {showRegenerateBanner && (
            <TouchableOpacity
              style={styles.regenerateBanner}
              onPress={retryLastMessage}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-outline" size={16} color={brandColors.primary} />
              <Text style={styles.regenerateText}>
                {t("ai_coach.no_response") || "No response received. Tap to regenerate."}
              </Text>
            </TouchableOpacity>
          )}

          {/* Input Area - hidden when loading conversation or rate limit */}
          {!isLoadingConversation && !isLoadingRateLimit && (
            <View
              style={[
                styles.inputContainer,
                { paddingBottom: insets.bottom + toRN(tokens.spacing[2]) }
              ]}
            >
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.textInput}
                  placeholder={t("ai_coach.placeholder") || "Ask anything"}
                  placeholderTextColor={colors.text.tertiary}
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  maxLength={2000}
                  editable={!isProcessing}
                />
              </View>

              {/* Bottom Actions */}
              <View style={styles.inputActions}>
                {isProcessing && !isListening ? (
                  // Waiting for AI response: show Cancel button
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={cancelStream}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close-circle-outline" size={18} color={colors.text.secondary} />
                    <Text style={styles.cancelButtonText}>
                      {t("ai_coach.cancel") || "Cancel"}
                    </Text>
                  </TouchableOpacity>
                ) : isListening ? (
                  // Currently listening: Stop+bars (left) + Send icon (right)
                  <>
                    <TouchableOpacity
                      style={[styles.iconButton, styles.iconButtonRecording]}
                      onPress={handleSpeakPress}
                    >
                      <Ionicons name="stop" size={18} color="#FFFFFF" />
                      <AnimatedAudioBars
                        color="#FFFFFF"
                        barCount={4}
                        barWidth={3}
                        barHeight={14}
                        gap={2}
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.iconButtonSend}
                      onPress={async () => {
                        // Stop recording and send immediately
                        await stopListening();
                        // Small delay to ensure transcript is finalized
                        setTimeout(() => {
                          if (inputText.trim()) {
                            handleSend();
                          }
                        }, 100);
                      }}
                      disabled={isProcessing}
                    >
                      <Ionicons name="arrow-up" size={18} color="#000000" />
                    </TouchableOpacity>
                  </>
                ) : isInputEmpty ? (
                  // Not listening, no text: Language selector + Speak icon
                  <>
                    <TouchableOpacity
                      style={styles.languageButton}
                      onPress={() => setShowLanguageSelector(!showLanguageSelector)}
                    >
                      <Ionicons name="globe-outline" size={18} color={colors.text.secondary} />
                      <Text style={styles.languageButtonText}>
                        {currentLanguage.name.toUpperCase()}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.iconButton} onPress={handleSpeakPress}>
                      <Ionicons name="mic-outline" size={18} color={colors.text.primary} />
                    </TouchableOpacity>
                  </>
                ) : (
                  // Not listening, has text: Reset (left) + Speak & Send icons (right)
                  <>
                    <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
                      <Ionicons name="refresh-outline" size={18} color={colors.text.secondary} />
                      <Text style={styles.resetButtonText}>{t("ai_coach.reset") || "Reset"}</Text>
                    </TouchableOpacity>

                    <View style={styles.rightActions}>
                      <TouchableOpacity style={styles.iconButton} onPress={handleSpeakPress}>
                        <Ionicons name="mic-outline" size={18} color={colors.text.primary} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.iconButtonSend}
                        onPress={handleSend}
                        disabled={isProcessing}
                      >
                        <Ionicons name="arrow-up" size={18} color={colors.text.primary} />
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>
          )}

          {/* Language Selector Dropdown - positioned above input */}
          {showLanguageSelector && (
            <>
              {/* Backdrop to close dropdown */}
              <TouchableOpacity
                style={styles.languageBackdrop}
                activeOpacity={1}
                onPress={() => setShowLanguageSelector(false)}
              />
              <View style={[styles.languageDropdown, { bottom: insets.bottom + 110 }]}>
                <FlatList
                  data={LANGUAGES}
                  keyExtractor={(item) => item.code}
                  showsVerticalScrollIndicator={true}
                  bounces={false}
                  renderItem={({ item: lang, index }) => (
                    <TouchableOpacity
                      style={[
                        styles.languageOption,
                        selectedLanguage === lang.code && styles.languageOptionSelected,
                        index === LANGUAGES.length - 1 && styles.languageOptionLast
                      ]}
                      onPress={() => {
                        setSelectedLanguage(lang.code);
                        setShowLanguageSelector(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.languageOptionText,
                          selectedLanguage === lang.code && styles.languageOptionTextSelected
                        ]}
                      >
                        {lang.name}
                      </Text>
                      {selectedLanguage === lang.code && (
                        <Ionicons name="checkmark" size={18} color={brandColors.primary} />
                      )}
                    </TouchableOpacity>
                  )}
                />
              </View>
            </>
          )}
        </KeyboardAvoidingView>

        {/* Privacy Info Modal */}
        <Modal
          visible={showPrivacyInfo}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowPrivacyInfo(false)}
        >
          <View style={styles.privacyOverlay}>
            <View style={[styles.privacyModal, { marginTop: insets.top + 60 }]}>
              <View style={styles.privacyHeader}>
                <View style={styles.privacyIconContainer}>
                  <Ionicons name="shield-checkmark" size={24} color={brandColors.primary} />
                </View>
                <Text style={styles.privacyTitle}>{t("ai_coach.privacy_title")}</Text>
                <TouchableOpacity
                  onPress={() => setShowPrivacyInfo(false)}
                  style={styles.privacyCloseButton}
                >
                  <Ionicons name="close" size={24} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.privacyContent}>
                <Text style={styles.privacyDescription}>{t("ai_coach.privacy_description")}</Text>

                <View style={styles.privacySection}>
                  <Text style={styles.privacySectionTitle}>
                    {t("ai_coach.privacy_what_we_share")}
                  </Text>
                  <View style={styles.privacyItem}>
                    <CheckmarkCircle size={18} mr={2} />
                    <Text style={styles.privacyItemText}>{t("ai_coach.privacy_share_goals")}</Text>
                  </View>
                  <View style={styles.privacyItem}>
                    <CheckmarkCircle size={18} mr={2} />
                    <Text style={styles.privacyItemText}>
                      {t("ai_coach.privacy_share_progress")}
                    </Text>
                  </View>
                  <View style={styles.privacyItem}>
                    <CheckmarkCircle size={18} mr={2} />
                    <Text style={styles.privacyItemText}>
                      {t("ai_coach.privacy_share_preferences")}
                    </Text>
                  </View>
                </View>

                <View style={styles.privacySection}>
                  <Text style={styles.privacySectionTitle}>
                    {t("ai_coach.privacy_what_we_dont")}
                  </Text>
                  <View style={styles.privacyItem}>
                    <Ionicons name="close-circle" size={18} color="#EF4444" />
                    <Text style={styles.privacyItemText}>{t("ai_coach.privacy_no_personal")}</Text>
                  </View>
                  <View style={styles.privacyItem}>
                    <Ionicons name="close-circle" size={18} color="#EF4444" />
                    <Text style={styles.privacyItemText}>
                      {t("ai_coach.privacy_no_third_party")}
                    </Text>
                  </View>
                </View>

                <Text style={styles.privacyFooter}>{t("ai_coach.privacy_footer")}</Text>
              </View>

              <TouchableOpacity
                style={styles.privacyDoneButton}
                onPress={() => setShowPrivacyInfo(false)}
              >
                <Text style={styles.privacyDoneText}>{t("common.done")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Limit Reached Modal - Free users only */}
        <Modal
          visible={showLimitModal}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowLimitModal(false)}
        >
          <View style={styles.limitModalOverlay}>
            <View style={styles.limitModalContainer}>
              <View style={styles.limitModalHeader}>
                <View style={styles.limitModalIconContainer}>
                  <Ionicons name="chatbubbles-outline" size={32} color={brandColors.primary} />
                </View>
                <TouchableOpacity
                  onPress={() => setShowLimitModal(false)}
                  style={styles.limitModalCloseButton}
                >
                  <Ionicons name="close" size={24} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.limitModalTitle}>
                {t("ai_coach.limit_reached_title") || "Daily Limit Reached"}
              </Text>
              <Text style={styles.limitModalDescription}>
                {t("ai_coach.limit_reached_desc") ||
                  `You've used all ${rateLimit?.daily_limit || 3} free messages for today. Watch a short ad to unlock 1 more message, or upgrade for unlimited access.`}
              </Text>

              {/* Reset time info */}
              <View style={styles.limitModalResetInfo}>
                <Ionicons name="time-outline" size={16} color={colors.text.tertiary} />
                <Text style={styles.limitModalResetText}>
                  {t("ai_coach.limit_resets_at") || "Resets at midnight"}
                </Text>
              </View>

              {/* Watch Ad Button */}
              <Button
                title={
                  isAdLoaded
                    ? t("ai_coach.watch_ad_unlock") || "Watch Ad → +1 Message"
                    : t("ai_coach.loading_ad") || "Loading Ad..."
                }
                onPress={handleWatchAd}
                variant="primary"
                size="sm"
                fullWidth
                leftIcon="play-circle"
                loading={isUnlockingMessage}
                disabled={!isAdLoaded || isUnlockingMessage}
                style={{ marginBottom: toRN(tokens.spacing[3]) }}
              />

              {/* Upgrade Button */}
              <Button
                title={t("ai_coach.go_premium_unlimited") || "Go Premium → Unlimited Messages"}
                onPress={() => {
                  setShowLimitModal(false);
                  openSubscriptionModal();
                  // Delay onClose to prevent black screen (likely ad-related view conflict)
                  setTimeout(() => {
                    onClose();
                  }, 500);
                }}
                variant="outline"
                size="sm"
                fullWidth
                leftIcon="diamond"
              />
            </View>
          </View>
        </Modal>

        {/* Alert Overlay - renders alerts on top of this modal */}
        <AlertOverlay visible={visible} />
      </View>
    </Modal>
  );
}

// =====================================================
// STYLES
// =====================================================

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },

  // Header
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[3]),
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle
  },
  headerIconButton: {
    width: 40,
    height: 40,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  // PRO Badge (for free users - tappable)
  proBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[1.5]),
    backgroundColor: colors.bg.surface,
    borderRadius: toRN(tokens.borderRadius.full),
    borderWidth: 1,
    borderColor: brand.primary
  },
  proBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.bold,
    color: brand.primary
  },
  // Rate Limit Badge (for premium users)
  rateLimitBadge: {
    paddingHorizontal: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[1.5]),
    backgroundColor: colors.bg.surface,
    borderRadius: toRN(tokens.borderRadius.full),
    borderWidth: 1,
    borderColor: colors.border.subtle
  },
  rateLimitText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  rateLimitLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary
  },
  // Header right actions
  headerRightActions: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1])
  },
  headerSmallButton: {
    width: 36,
    height: 36,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },

  // Options Dropdown Menu
  optionsBackdrop: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: -1000, // Extend far below to cover screen
    zIndex: 99
  },
  optionsMenu: {
    position: "absolute" as const,
    right: toRN(tokens.spacing[4]),
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.lg),
    borderWidth: 1,
    borderColor: colors.border.subtle,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
    minWidth: 180,
    overflow: "hidden" as const
  },
  optionsMenuItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[4])
  },
  optionsMenuItemDanger: {
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle
  },
  optionsMenuText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.primary
  },
  optionsMenuTextDanger: {
    color: "#EF4444"
  },

  // Chat Container
  chatContainer: {
    flex: 1
  },

  // Messages List
  messagesList: {
    padding: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[2])
  },

  // Load More (for infinite scroll)
  loadMoreContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: toRN(tokens.spacing[4]),
    gap: toRN(tokens.spacing[2])
  },
  loadMoreText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },
  loadMoreButton: {
    alignSelf: "center" as const,
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginVertical: toRN(tokens.spacing[2]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.full)
  },
  loadMoreButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary
  },

  // Message Bubble
  messageBubble: {
    flexDirection: "row" as const,
    marginBottom: toRN(tokens.spacing[3]),
    maxWidth: "85%" as any
  },
  userBubble: {
    alignSelf: "flex-end" as const
  },
  assistantBubble: {
    alignSelf: "flex-start" as const
  },
  avatarContainer: {
    marginRight: toRN(tokens.spacing[2])
  },
  coachAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#58c8dd",
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  messageContent: {
    borderRadius: toRN(tokens.borderRadius.lg),
    padding: toRN(tokens.spacing[3]),
    maxWidth: "100%" as any
  },
  messageColumn: {
    flexDirection: "column" as const,
    maxWidth: "100%" as any
  },
  copyButton: {
    marginTop: toRN(tokens.spacing[2]),
    padding: toRN(tokens.spacing[1])
  },
  copyButtonUser: {
    alignSelf: "flex-end" as const
  },
  copyButtonAssistant: {
    alignSelf: "flex-start" as const
  },
  userContent: {
    backgroundColor: colors.bg.muted
  },
  assistantContent: {
    backgroundColor: `${brand.primary}15`,
    borderWidth: 1,
    borderColor: `${brand.primary}20`
  },
  typingContent: {
    backgroundColor: "transparent"
  },
  failedContent: {
    flex: 1,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECACA"
  },
  failedRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2])
  },
  failedText: {
    flex: 1,
    minWidth: 0,
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: "#EF4444"
  },
  coachAvatarError: {
    backgroundColor: "#EF4444"
  },
  userMessageText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.primary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5
  },

  // Typing Indicator
  typingIndicator: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3])
  },
  pulsingDot: {
    width: 12,
    height: 12,
    borderRadius: 6
  },
  typingText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary
  },

  // Loading State
  loadingContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  loadingContent: {
    alignItems: "center" as const,
    padding: toRN(tokens.spacing[6])
  },
  loadingIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${brand.primary}15`,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[4])
  },
  loadingSpinner: {
    marginBottom: toRN(tokens.spacing[3])
  },
  loadingText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary
  },

  // Empty State Container
  emptyStateContainer: {
    flex: 1,
    justifyContent: "space-between" as const
  },
  emptyCenter: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[6])
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${brand.primary}15`,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[4])
  },
  emptyTitle: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[2]),
    textAlign: "center" as const
  },
  emptyDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5
  },

  // Suggestions at bottom (horizontal rows)
  suggestionsBottom: {
    paddingBottom: toRN(tokens.spacing[2])
  },
  suggestionsRow: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[1]),
    gap: toRN(tokens.spacing[2])
  },
  suggestionChip: {
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: toRN(tokens.borderRadius.full),
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginRight: toRN(tokens.spacing[2])
  },
  suggestionText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.primary
  },

  // Error Banner
  errorBanner: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    backgroundColor: "#FEE2E2",
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginHorizontal: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.md)
  },
  errorText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: "#EF4444",
    flex: 1
  },
  regenerateBanner: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[2]),
    backgroundColor: colors.bg.surface,
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginHorizontal: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[2]),
    borderRadius: toRN(tokens.borderRadius.md),
    borderWidth: 1,
    borderColor: colors.border.default,
    borderStyle: "dashed" as const
  },
  regenerateText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary
  },

  // Input Area
  inputContainer: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingTop: toRN(tokens.spacing[2]),
    backgroundColor: colors.bg.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle
  },
  inputRow: {
    marginBottom: toRN(tokens.spacing[2])
  },
  textInput: {
    backgroundColor: colors.bg.canvas,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: toRN(tokens.borderRadius.xl),
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[3]),
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.primary,
    maxHeight: 100,
    minHeight: 44
  },
  inputActions: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingBottom: toRN(tokens.spacing[2])
  },

  // Language Button
  languageButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1.5]),
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.full),
    borderWidth: 1,
    borderColor: colors.border.subtle
  },
  languageButtonText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: colors.text.secondary
  },

  // Speak Button
  speakButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1.5]),
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.full),
    borderWidth: 1,
    borderColor: colors.border.subtle
  },
  speakButtonRecording: {
    backgroundColor: "#EF4444",
    borderColor: "#EF4444"
  },
  speakButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.primary
  },
  speakButtonTextRecording: {
    color: "#FFFFFF"
  },

  // Icon-only buttons (no text)
  iconButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[1.5]),
    width: 44,
    height: 44,
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.full),
    borderWidth: 1,
    borderColor: colors.border.subtle
  },
  iconButtonRecording: {
    backgroundColor: colors.bg.destructive,
    borderColor: "#EF4444",
    width: "auto" as const,
    paddingHorizontal: toRN(tokens.spacing[3])
  },
  iconButtonSend: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
    width: 44,
    height: 44,
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.full)
  },
  rightActions: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2])
  },

  // Reset Button
  resetButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1.5]),
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.full),
    borderWidth: 1,
    borderColor: colors.border.subtle
  },
  resetButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary
  },

  // Cancel button (when waiting for AI response)
  cancelButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1.5]),
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.full),
    borderWidth: 1,
    borderColor: colors.border.subtle
  },
  cancelButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary
  },

  // Send Button Pill
  sendButtonPill: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1.5]),
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.full)
  },
  sendButtonPillText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.secondary
  },

  // Language Dropdown Backdrop
  languageBackdrop: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent"
  },

  // Language Dropdown
  languageDropdown: {
    position: "absolute" as const,
    left: toRN(tokens.spacing[4]),
    width: 180,
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.lg),
    borderWidth: 1,
    borderColor: colors.border.subtle,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    maxHeight: 280,
    overflow: "hidden" as const
  },
  languageOption: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle
  },
  languageOptionLast: {
    borderBottomWidth: 0
  },
  languageOptionSelected: {
    backgroundColor: `${brand.primary}10`
  },
  languageOptionText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.primary
  },
  languageOptionTextSelected: {
    fontFamily: fontFamily.semiBold,
    color: brand.primary
  },

  // Chat History Drawer
  drawerOverlay: {
    flex: 1,
    flexDirection: "row" as const
  },
  drawerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)"
  },
  drawerContainer: {
    position: "absolute" as const,
    left: 0,
    top: 0,
    bottom: 0,
    width: "65%" as any,
    backgroundColor: colors.bg.canvas,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10
  },
  drawerHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[4]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle
  },
  drawerTitle: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: colors.text.primary
  },
  newChatButton: {
    width: 40,
    height: 40,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  drawerList: {
    paddingVertical: toRN(tokens.spacing[2])
  },
  drawerEmpty: {
    padding: toRN(tokens.spacing[6]),
    alignItems: "center" as const
  },
  drawerEmptyText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
    marginBottom: toRN(tokens.spacing[1])
  },
  drawerEmptySubtext: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    textAlign: "center" as const
  },
  drawerLoading: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[8])
  },
  drawerLoadingText: {
    marginTop: toRN(tokens.spacing[3]),
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary
  },
  drawerLoadingMore: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: toRN(tokens.spacing[4]),
    gap: toRN(tokens.spacing[2])
  },
  drawerLoadingMoreText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },
  drawerItem: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[3]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle
  },
  drawerItemActive: {
    backgroundColor: `${brand.primary}10`
  },
  drawerItemTime: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
    marginBottom: toRN(tokens.spacing[0.5]),
    letterSpacing: 0.5
  },
  drawerItemTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.primary
  },

  // Privacy Info Modal
  privacyOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-start" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[4])
  },
  privacyModal: {
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.xl),
    width: "100%" as any,
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10
  },
  privacyHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[4]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle
  },
  privacyIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${brand.primary}15`,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginRight: toRN(tokens.spacing[3])
  },
  privacyTitle: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: colors.text.primary
  },
  privacyCloseButton: {
    width: 36,
    height: 36,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  privacyContent: {
    padding: toRN(tokens.spacing[4])
  },
  privacyDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5,
    marginBottom: toRN(tokens.spacing[4])
  },
  privacySection: {
    marginBottom: toRN(tokens.spacing[4])
  },
  privacySectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[2])
  },
  privacyItem: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: toRN(tokens.spacing[2]),
    marginBottom: toRN(tokens.spacing[2])
  },
  privacyItemText: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.4
  },
  privacyFooter: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    textAlign: "center" as const,
    marginTop: toRN(tokens.spacing[2])
  },
  privacyDoneButton: {
    margin: toRN(tokens.spacing[4]),
    marginTop: 0,
    paddingVertical: toRN(tokens.spacing[3]),
    backgroundColor: brand.primary,
    borderRadius: toRN(tokens.borderRadius.lg),
    alignItems: "center" as const
  },
  privacyDoneText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: "#FFFFFF"
  },

  // Limit Reached Modal
  limitModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[4])
  },
  limitModalContainer: {
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.xl),
    width: "100%" as any,
    maxWidth: 360,
    padding: toRN(tokens.spacing[5]),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15
  },
  limitModalHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "flex-start" as const,
    marginBottom: toRN(tokens.spacing[3])
  },
  limitModalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${brand.primary}15`,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  limitModalCloseButton: {
    padding: toRN(tokens.spacing[1])
  },
  limitModalTitle: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[2])
  },
  limitModalDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5,
    marginBottom: toRN(tokens.spacing[3])
  },
  limitModalResetInfo: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1.5]),
    marginBottom: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.md)
  },
  limitModalResetText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary
  }
});
