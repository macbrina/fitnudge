import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { Ionicons } from "@expo/vector-icons";
import { useSendNudge } from "@/hooks/api/useNudges";
import { NudgeType } from "@/services/api/nudges";
import { NudgeIcon, NudgeEmojiType } from "@/components/icons/NudgeIcons";
import {
  NUDGE_TYPE_CONFIGS,
  QUICK_REACTION_EMOJIS,
  NudgeTypeConfig,
  NudgeMessage
} from "@/constants/nudges";
import { useAlertModal } from "@/contexts/AlertModalContext";
import * as Haptics from "expo-haptics";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface NudgeSheetProps {
  visible: boolean;
  onClose: () => void;
  recipientId: string;
  recipientName: string;
  goalId?: string;
  challengeId?: string;
  partnershipId?: string;
  onSuccess?: () => void;
}

type SheetState = "type" | "message" | "custom";

/**
 * NudgeSheet - Premium nudge selection experience
 *
 * Inspired by Instagram reactions and TikTok interactions.
 * Features:
 * - Smooth animated transitions
 * - Quick emoji reactions
 * - Predefined messages per nudge type
 * - Custom message input
 * - Haptic feedback
 */
export function NudgeSheet({
  visible,
  onClose,
  recipientId,
  recipientName,
  goalId,
  challengeId,
  partnershipId,
  onSuccess
}: NudgeSheetProps) {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlertModal();

  // Animation values
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // State
  const [sheetState, setSheetState] = useState<SheetState>("type");
  const [selectedType, setSelectedType] = useState<NudgeTypeConfig | null>(null);
  const [customMessage, setCustomMessage] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState<NudgeEmojiType | null>(null);

  // Mutation
  const sendNudgeMutation = useSendNudge();

  // Animation effect
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true
        })
      ]).start();
    }
  }, [visible, slideAnim, fadeAnim]);

  // Reset state when sheet closes
  useEffect(() => {
    if (!visible) {
      setTimeout(() => {
        setSheetState("type");
        setSelectedType(null);
        setCustomMessage("");
        setSelectedEmoji(null);
      }, 300);
    }
  }, [visible]);

  // Handlers
  const handleTypeSelect = useCallback((config: NudgeTypeConfig) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedType(config);
    setSheetState("message");
  }, []);

  const handleQuickReaction = useCallback(
    async (emoji: NudgeEmojiType) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSelectedEmoji(emoji);

      try {
        await sendNudgeMutation.mutateAsync({
          recipient_id: recipientId,
          nudge_type: "cheer",
          emoji,
          goal_id: goalId,
          challenge_id: challengeId,
          partnership_id: partnershipId
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onClose();
        onSuccess?.();
      } catch (error: any) {
        showAlert({
          title: t("common.error"),
          message: error?.response?.data?.detail || t("social.nudge_error"),
          variant: "error",
          confirmLabel: t("common.ok")
        });
      }
    },
    [
      recipientId,
      goalId,
      challengeId,
      partnershipId,
      sendNudgeMutation,
      onClose,
      onSuccess,
      showAlert,
      t
    ]
  );

  const handleMessageSelect = useCallback(
    async (message: NudgeMessage) => {
      if (!selectedType) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      try {
        await sendNudgeMutation.mutateAsync({
          recipient_id: recipientId,
          nudge_type: selectedType.type,
          message: message.message,
          emoji: message.emoji,
          goal_id: goalId,
          challenge_id: challengeId,
          partnership_id: partnershipId
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onClose();
        onSuccess?.();
      } catch (error: any) {
        showAlert({
          title: t("common.error"),
          message: error?.response?.data?.detail || t("social.nudge_error"),
          variant: "error",
          confirmLabel: t("common.ok")
        });
      }
    },
    [
      selectedType,
      recipientId,
      goalId,
      challengeId,
      partnershipId,
      sendNudgeMutation,
      onClose,
      onSuccess,
      showAlert,
      t
    ]
  );

  const handleCustomSubmit = useCallback(async () => {
    if (!customMessage.trim()) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await sendNudgeMutation.mutateAsync({
        recipient_id: recipientId,
        nudge_type: "custom",
        message: customMessage.trim(),
        emoji: selectedEmoji || undefined,
        goal_id: goalId,
        challenge_id: challengeId,
        partnership_id: partnershipId
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
      onSuccess?.();
    } catch (error: any) {
      showAlert({
        title: t("common.error"),
        message: error?.response?.data?.detail || t("social.nudge_error"),
        variant: "error",
        confirmLabel: t("common.ok")
      });
    }
  }, [
    customMessage,
    selectedEmoji,
    recipientId,
    goalId,
    challengeId,
    partnershipId,
    sendNudgeMutation,
    onClose,
    onSuccess,
    showAlert,
    t
  ]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (sheetState === "message" || sheetState === "custom") {
      setSheetState("type");
      setSelectedType(null);
    }
  }, [sheetState]);

  const handleCustomPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSheetState("custom");
  }, []);

  if (!visible) return null;

  const isSending = sendNudgeMutation.isPending;

  return (
    <View style={styles.overlay}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <TouchableOpacity style={styles.backdropTouchable} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [{ translateY: slideAnim }],
              paddingBottom: insets.bottom + toRN(tokens.spacing[4])
            }
          ]}
        >
          {/* Handle bar */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            {sheetState !== "type" && (
              <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
                <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            )}
            <Text style={styles.headerTitle}>
              {sheetState === "type" &&
                (t("nudge.send_to", { name: recipientName }) || `Send to ${recipientName}`)}
              {sheetState === "message" && (selectedType?.label || "Select Message")}
              {sheetState === "custom" && (t("nudge.custom_message") || "Custom Message")}
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Quick Reactions Row */}
          {sheetState === "type" && (
            <View style={styles.quickReactionsSection}>
              <Text style={styles.sectionLabel}>
                {t("nudge.quick_reactions") || "Quick Reactions"}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickReactionsContainer}
              >
                {QUICK_REACTION_EMOJIS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={[
                      styles.quickReactionButton,
                      selectedEmoji === emoji && styles.quickReactionButtonActive
                    ]}
                    onPress={() => handleQuickReaction(emoji)}
                    activeOpacity={0.7}
                    disabled={isSending}
                  >
                    {isSending && selectedEmoji === emoji ? (
                      <ActivityIndicator size="small" color={brandColors.primary} />
                    ) : (
                      <NudgeIcon emoji={emoji} size={32} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Type Selection */}
          {sheetState === "type" && (
            <View style={styles.typeSection}>
              <Text style={styles.sectionLabel}>{t("nudge.nudge_types") || "Nudge Types"}</Text>
              <View style={styles.typeGrid}>
                {NUDGE_TYPE_CONFIGS.map((config) => (
                  <TouchableOpacity
                    key={config.type}
                    style={[styles.typeCard, { borderColor: `${config.color}30` }]}
                    onPress={() => handleTypeSelect(config)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[styles.typeIconContainer, { backgroundColor: `${config.color}15` }]}
                    >
                      <NudgeIcon emoji={config.icon} size={28} />
                    </View>
                    <Text style={styles.typeLabel}>{t(config.labelKey) || config.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Custom Message Option */}
              <TouchableOpacity
                style={styles.customButton}
                onPress={handleCustomPress}
                activeOpacity={0.7}
              >
                <Ionicons name="create-outline" size={20} color={brandColors.primary} />
                <Text style={styles.customButtonText}>
                  {t("nudge.write_custom") || "Write a custom message"}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Message Selection */}
          {sheetState === "message" && selectedType && (
            <ScrollView style={styles.messagesScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.messagesContainer}>
                {selectedType.messages.map((message, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[styles.messageCard, { borderLeftColor: selectedType.color }]}
                    onPress={() => handleMessageSelect(message)}
                    activeOpacity={0.7}
                    disabled={isSending}
                  >
                    <View style={styles.messageContent}>
                      <NudgeIcon emoji={message.emoji} size={36} />
                      <Text style={styles.messageText}>
                        {t(message.messageKey) || message.message}
                      </Text>
                    </View>
                    {isSending ? (
                      <ActivityIndicator size="small" color={selectedType.color} />
                    ) : (
                      <Ionicons name="send" size={18} color={selectedType.color} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          {/* Custom Message Input */}
          {sheetState === "custom" && (
            <View style={styles.customSection}>
              {/* Emoji Picker Row */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.emojiPickerContainer}
              >
                {QUICK_REACTION_EMOJIS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={[
                      styles.emojiPickerButton,
                      selectedEmoji === emoji && styles.emojiPickerButtonActive
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedEmoji(selectedEmoji === emoji ? null : emoji);
                    }}
                    activeOpacity={0.7}
                  >
                    <NudgeIcon emoji={emoji} size={28} />
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Text Input */}
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder={t("nudge.type_message") || "Type your message..."}
                  placeholderTextColor={colors.text.tertiary}
                  value={customMessage}
                  onChangeText={setCustomMessage}
                  multiline
                  maxLength={200}
                  textAlignVertical="top"
                />
                <Text style={styles.charCount}>{customMessage.length}/200</Text>
              </View>

              {/* Send Button */}
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!customMessage.trim() || isSending) && styles.sendButtonDisabled
                ]}
                onPress={handleCustomSubmit}
                activeOpacity={0.7}
                disabled={!customMessage.trim() || isSending}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    {selectedEmoji && (
                      <View style={styles.sendButtonEmoji}>
                        <NudgeIcon emoji={selectedEmoji} size={20} />
                      </View>
                    )}
                    <Text style={styles.sendButtonText}>{t("nudge.send") || "Send"}</Text>
                    <Ionicons name="send" size={18} color="#FFFFFF" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  overlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end" as const,
    zIndex: 1000
  },
  backdrop: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)"
  },
  backdropTouchable: {
    flex: 1
  },
  keyboardView: {
    flex: 1,
    justifyContent: "flex-end" as const
  },
  sheet: {
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: toRN(tokens.borderRadius["3xl"]),
    borderTopRightRadius: toRN(tokens.borderRadius["3xl"]),
    maxHeight: SCREEN_HEIGHT * 0.85
  },
  handleContainer: {
    alignItems: "center" as const,
    paddingTop: toRN(tokens.spacing[3]),
    paddingBottom: toRN(tokens.spacing[2])
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.default
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[4]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default
  },
  backButton: {
    position: "absolute" as const,
    left: toRN(tokens.spacing[4]),
    width: 32,
    height: 32,
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  headerTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    textAlign: "center" as const,
    flex: 1,
    paddingHorizontal: toRN(tokens.spacing[10])
  },
  closeButton: {
    position: "absolute" as const,
    right: toRN(tokens.spacing[4]),
    width: 32,
    height: 32,
    alignItems: "center" as const,
    justifyContent: "center" as const
  },

  // Quick Reactions
  quickReactionsSection: {
    paddingTop: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[2])
  },
  sectionLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: colors.text.tertiary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[3])
  },
  quickReactionsContainer: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    gap: toRN(tokens.spacing[2])
  },
  quickReactionButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.bg.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  quickReactionButtonActive: {
    backgroundColor: `${brand.primary}20`,
    borderWidth: 2,
    borderColor: brand.primary
  },

  // Type Selection
  typeSection: {
    padding: toRN(tokens.spacing[4])
  },
  typeGrid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: toRN(tokens.spacing[3])
  },
  typeCard: {
    width: "47%" as any,
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.xl),
    padding: toRN(tokens.spacing[4]),
    alignItems: "center" as const,
    borderWidth: 1
  },
  typeIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: toRN(tokens.spacing[2])
  },
  typeLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    textAlign: "center" as const
  },
  customButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[2]),
    marginTop: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.lg),
    backgroundColor: colors.bg.muted
  },
  customButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: brand.primary,
    flex: 1
  },

  // Messages
  messagesScroll: {
    maxHeight: SCREEN_HEIGHT * 0.45
  },
  messagesContainer: {
    padding: toRN(tokens.spacing[4]),
    gap: toRN(tokens.spacing[3])
  },
  messageCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.xl),
    padding: toRN(tokens.spacing[4]),
    borderLeftWidth: 3
  },
  messageContent: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3])
  },
  messageText: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.primary
  },

  // Custom Message
  customSection: {
    padding: toRN(tokens.spacing[4])
  },
  emojiPickerContainer: {
    paddingBottom: toRN(tokens.spacing[4]),
    gap: toRN(tokens.spacing[2])
  },
  emojiPickerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bg.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  emojiPickerButtonActive: {
    backgroundColor: `${brand.primary}20`,
    borderWidth: 2,
    borderColor: brand.primary
  },
  inputContainer: {
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.xl),
    padding: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[4])
  },
  textInput: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.primary,
    minHeight: 80,
    maxHeight: 120
  },
  charCount: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    textAlign: "right" as const,
    marginTop: toRN(tokens.spacing[2])
  },
  sendButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[2]),
    backgroundColor: brand.primary,
    borderRadius: toRN(tokens.borderRadius.xl),
    paddingVertical: toRN(tokens.spacing[4])
  },
  sendButtonDisabled: {
    opacity: 0.5
  },
  sendButtonEmoji: {
    marginRight: toRN(tokens.spacing[1])
  },
  sendButtonText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: "#FFFFFF"
  }
});

export default NudgeSheet;
