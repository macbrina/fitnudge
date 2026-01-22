import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TextInput } from "@/components/ui/TextInput";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { Ionicons } from "@expo/vector-icons";
import { useReportUser } from "@/hooks/api/usePartners";
import { useAlertModal } from "@/contexts/AlertModalContext";
import * as Haptics from "expo-haptics";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface ReportUserSheetProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  username?: string;
  onSuccess?: () => void;
}

type ReportReason = "inappropriate_username" | "harassment" | "spam" | "other";

interface ReportOption {
  reason: ReportReason;
  labelKey: string;
  label: string;
  icon: string;
  description: string;
}

const REPORT_OPTIONS: ReportOption[] = [
  {
    reason: "inappropriate_username",
    labelKey: "report.reason_inappropriate_username",
    label: "Inappropriate Username",
    icon: "text-outline",
    description: "Username contains offensive or inappropriate content"
  },
  {
    reason: "harassment",
    labelKey: "report.reason_harassment",
    label: "Harassment",
    icon: "alert-circle-outline",
    description: "This user is harassing or bullying me"
  },
  {
    reason: "spam",
    labelKey: "report.reason_spam",
    label: "Spam",
    icon: "mail-unread-outline",
    description: "This user is sending spam or unwanted messages"
  },
  {
    reason: "other",
    labelKey: "report.reason_other",
    label: "Other",
    icon: "ellipsis-horizontal-outline",
    description: "Something else that violates our guidelines"
  }
];

/**
 * ReportUserSheet - Report user modal
 *
 * Features:
 * - Reason selection
 * - Optional details input
 * - Fire-and-forget submission with silent retry
 * - Toast confirmation
 */
export function ReportUserSheet({
  visible,
  onClose,
  userId,
  username,
  onSuccess
}: ReportUserSheetProps) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlertModal();

  // Animation values
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // State
  const [selectedReason, setSelectedReason] = useState<ReportOption | null>(null);
  const [details, setDetails] = useState("");

  // Mutation
  const reportUser = useReportUser();

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
        setSelectedReason(null);
        setDetails("");
      }, 300);
    }
  }, [visible]);

  // Details required for "other" reason
  const detailsRequired = selectedReason?.reason === "other";
  const canSubmit = selectedReason && (!detailsRequired || details.trim().length > 0);

  // Fire-and-forget submit with silent retry
  const submitReport = useCallback(
    (blockPartner: boolean) => {
      if (!selectedReason) return;

      const attemptSubmit = (retryCount: number) => {
        reportUser.mutate(
          {
            userId,
            reason: selectedReason.reason,
            details: details.trim() || undefined,
            blockPartner
          },
          {
            onError: () => {
              // Silent retry once
              if (retryCount < 1) {
                setTimeout(() => attemptSubmit(retryCount + 1), 1000);
              } else if (blockPartner) {
                // If block failed after retry, show error alert
                showAlert({
                  title: t("common.error") || "Error",
                  message: t("report.block_failed") || "Failed to block user. Please try again.",
                  variant: "error",
                  confirmLabel: t("common.ok") || "OK"
                });
              }
            }
          }
        );
      };
      attemptSubmit(0);
    },
    [userId, selectedReason, details, reportUser, showAlert, t]
  );

  // Handle "Report" only (no block, stay on screen)
  const handleReportOnly = useCallback(() => {
    if (!canSubmit) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();

    showAlert({
      title: t("report.submitted") || "Report Submitted",
      message:
        t("report.submitted_message") || "Thank you for your report. We'll review it shortly.",
      variant: "success",
      confirmLabel: t("common.ok") || "OK"
    });

    // Fire-and-forget without blocking
    submitReport(false);
  }, [canSubmit, onClose, showAlert, t, submitReport]);

  // Handle "Report & Block" (block partner, navigate away immediately)
  const handleReportAndBlock = useCallback(() => {
    if (!canSubmit) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();

    // Fire-and-forget with blocking - MUST happen BEFORE navigation
    // so the optimistic update removes the user from cache first
    submitReport(true);

    // Navigate away after optimistic update has been applied
    onSuccess?.();

    showAlert({
      title: t("report.submitted_blocked") || "Reported & Blocked",
      message: t("report.submitted_blocked_message") || "User has been reported and blocked.",
      variant: "success",
      confirmLabel: t("common.ok") || "OK"
    });
  }, [canSubmit, onClose, onSuccess, showAlert, t, submitReport]);

  const handleReasonSelect = useCallback((option: ReportOption) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedReason(option);
  }, []);

  if (!visible) return null;

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
            <Text style={styles.headerTitle}>{t("report.title") || "Report User"}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            {t("report.subtitle", { username: username || "this user" }) ||
              `Why are you reporting ${username || "this user"}?`}
          </Text>

          {/* Reason Options */}
          <View style={styles.optionsContainer}>
            {REPORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.reason}
                style={[
                  styles.optionCard,
                  selectedReason?.reason === option.reason && styles.optionCardSelected
                ]}
                onPress={() => handleReasonSelect(option)}
                activeOpacity={0.7}
              >
                <View style={styles.optionIcon}>
                  <Ionicons
                    name={option.icon as any}
                    size={20}
                    color={
                      selectedReason?.reason === option.reason
                        ? colors.text.primary
                        : colors.text.secondary
                    }
                  />
                </View>
                <View style={styles.optionContent}>
                  <Text
                    style={[
                      styles.optionLabel,
                      selectedReason?.reason === option.reason && styles.optionLabelSelected
                    ]}
                  >
                    {t(option.labelKey) || option.label}
                  </Text>
                </View>
                {selectedReason?.reason === option.reason && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.feedback.success} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Details Input (optional) */}
          <View style={styles.detailsContainer}>
            <TextInput
              label={
                detailsRequired
                  ? `${t("report.details_required") || "Please describe the issue"} *`
                  : t("report.details_label") || "Additional details (optional)"
              }
              placeholder={t("report.details_placeholder") || "Provide more context..."}
              value={details}
              onChangeText={setDetails}
              multiline
              numberOfLines={4}
              maxLength={500}
              error={detailsRequired && !details.trim() ? " " : undefined}
              containerStyle={styles.detailsInputContainer}
            />
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {/* Report Only */}
            <TouchableOpacity
              style={[styles.reportButton, !canSubmit && styles.buttonDisabled]}
              onPress={handleReportOnly}
              activeOpacity={0.7}
              disabled={!canSubmit}
            >
              <Ionicons name="flag-outline" size={18} color={colors.text.primary} />
              <Text style={styles.reportButtonText}>{t("report.submit") || "Report"}</Text>
            </TouchableOpacity>

            {/* Report & Block */}
            <TouchableOpacity
              style={[styles.reportBlockButton, !canSubmit && styles.buttonDisabled]}
              onPress={handleReportAndBlock}
              activeOpacity={0.7}
              disabled={!canSubmit}
            >
              <Ionicons name="ban" size={18} color="#FFFFFF" />
              <Text style={styles.reportBlockButtonText}>
                {t("report.submit_block") || "Report & Block"}
              </Text>
            </TouchableOpacity>
          </View>
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
    paddingBottom: toRN(tokens.spacing[2])
  },
  headerTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    textAlign: "center" as const,
    flex: 1
  },
  closeButton: {
    position: "absolute" as const,
    right: toRN(tokens.spacing[4]),
    width: 44,
    height: 44,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    zIndex: 10
  },
  subtitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[6]),
    marginBottom: toRN(tokens.spacing[4])
  },
  optionsContainer: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    gap: toRN(tokens.spacing[2])
  },
  optionCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.lg),
    padding: toRN(tokens.spacing[3]),
    borderWidth: 1,
    borderColor: "transparent"
  },
  optionCardSelected: {
    borderColor: brand.primary,
    backgroundColor: `${brand.primary}10`
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: toRN(tokens.borderRadius.md),
    backgroundColor: colors.bg.secondary,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginRight: toRN(tokens.spacing[3])
  },
  optionContent: {
    flex: 1
  },
  optionLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.primary
  },
  optionLabelSelected: {
    fontFamily: fontFamily.semiBold
  },
  detailsContainer: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginTop: toRN(tokens.spacing[4])
  },
  detailsInputContainer: {
    marginBottom: 0
  },
  detailsLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
    marginBottom: toRN(tokens.spacing[2])
  },
  requiredAsterisk: {
    color: colors.feedback.error
  },
  detailsInput: {
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.lg),
    padding: toRN(tokens.spacing[3]),
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.primary,
    minHeight: 80,
    maxHeight: 120
  },
  detailsInputRequired: {
    borderWidth: 1,
    borderColor: colors.feedback.error + "50"
  },
  buttonContainer: {
    flexDirection: "row" as const,
    gap: toRN(tokens.spacing[3]),
    marginHorizontal: toRN(tokens.spacing[4]),
    marginTop: toRN(tokens.spacing[4])
  },
  reportButton: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[2]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.xl),
    paddingVertical: toRN(tokens.spacing[3])
  },
  reportButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  reportBlockButton: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[2]),
    backgroundColor: colors.feedback.error,
    borderRadius: toRN(tokens.borderRadius.xl),
    paddingVertical: toRN(tokens.spacing[3])
  },
  reportBlockButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: "#FFFFFF"
  },
  buttonDisabled: {
    opacity: 0.5
  }
});

export default ReportUserSheet;
