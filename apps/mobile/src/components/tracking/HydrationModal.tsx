import {
  HYDRATION_TYPES,
  HydrationIcon,
  type HydrationType,
} from "@/components/icons/HydrationIcons";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import TextInput from "@/components/ui/TextInput";
import { AlertOverlay, useAlertModal } from "@/contexts/AlertModalContext";
import {
  HYDRATION_PRESETS,
  useLogHydration,
  useTodaysHydrationSummary,
} from "@/hooks/api/useHydrationLogs";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { useStyles, useTheme } from "@/themes";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

interface HydrationModalProps {
  visible: boolean;
  onClose: () => void;
  goalId?: string;
  challengeId?: string;
  onSuccess?: () => void;
}

// HYDRATION_TYPES imported from HydrationIcons (replaces emoji-based PRESETS)

export function HydrationModal({
  visible,
  onClose,
  goalId,
  challengeId,
  onSuccess,
}: HydrationModalProps) {
  const styles = useStyles(makeHydrationModalStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const { showAlert, showToast } = useAlertModal();

  // State
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [isSubmittingCustom, setIsSubmittingCustom] = useState(false);

  // Queries and mutations
  const { data: todaySummary, refetch: refetchSummary } =
    useTodaysHydrationSummary(goalId, challengeId);
  const logHydrationMutation = useLogHydration();

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedPreset(null);
      setCustomAmount("");
      setShowCustomInput(false);
      setIsSubmittingCustom(false);
      refetchSummary();
    }
  }, [visible]);

  const handlePresetSelect = async (preset: (typeof HYDRATION_TYPES)[0]) => {
    // Prevent multiple submissions
    if (isLoading) return;

    setSelectedPreset(preset.key);
    setShowCustomInput(false);

    try {
      await logHydrationMutation.mutateAsync({
        amount_ml: preset.amount,
        goal_id: goalId,
        challenge_id: challengeId,
      });

      // Only proceed if modal is still visible
      if (visible) {
        refetchSummary();
        onSuccess?.();

        showToast({
          title: t("common.success"),
          message: t("hydration.logged_success") || "Water logged!",
          variant: "success",
          duration: 1500,
        });

        onClose();
      }
    } catch (error) {
      // Reset selection state
      setSelectedPreset(null);
      // Use alert for errors
      showAlert({
        title: t("common.error"),
        message:
          t("hydration.log_error") || "Failed to log water. Please try again.",
        variant: "error",
        confirmLabel: t("common.ok"),
      });
    }
  };

  const handleCustomSubmit = async () => {
    const amount = parseInt(customAmount, 10);

    if (!amount || amount <= 0) {
      // Use alert for validation errors
      await showAlert({
        title: t("hydration.invalid_amount_title") || "Invalid Amount",
        message:
          t("hydration.invalid_amount_message") ||
          "Please enter a valid amount in ml",
        variant: "warning",
        confirmLabel: t("common.ok"),
      });
      return;
    }

    setIsSubmittingCustom(true);

    try {
      await logHydrationMutation.mutateAsync({
        amount_ml: amount,
        goal_id: goalId,
        challenge_id: challengeId,
      });

      refetchSummary();
      onSuccess?.();

      showToast({
        title: t("common.success"),
        message: t("hydration.logged_success") || "Water logged!",
        variant: "success",
        duration: 1500,
      });

      onClose();
    } catch (error) {
      // Use alert for errors
      await showAlert({
        title: t("common.error"),
        message:
          t("hydration.log_error") || "Failed to log water. Please try again.",
        variant: "error",
        confirmLabel: t("common.ok"),
      });
    } finally {
      setIsSubmittingCustom(false);
    }
  };

  const isLoading = logHydrationMutation.isPending;
  const progressPercentage = todaySummary?.progress_percentage || 0;
  const totalAmount = todaySummary?.total_amount_ml || 0;
  const targetAmount = todaySummary?.target_ml || 2000;
  const glassesLogged = Math.floor(totalAmount / HYDRATION_PRESETS.glass);

  // Determine if we're submitting a preset (loading + preset selected)
  const isSubmittingPreset =
    isLoading && selectedPreset !== null && !isSubmittingCustom;
  // Presets are disabled when ANY submission is in progress
  const presetsDisabled = isLoading;
  // Custom is disabled only when a preset is being submitted
  const customDisabled = isSubmittingPreset;

  return (
    <Modal visible={visible} onClose={onClose} title={t("hydration.title")}>
      <View style={styles.container}>
        {/* Daily Progress */}
        <View style={styles.progressCard}>
          <Text style={styles.progressTitle}>
            {t("hydration.daily_progress")}
          </Text>

          {/* Progress Bar */}
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min(progressPercentage, 100)}%` },
              ]}
            />
          </View>

          <View style={styles.progressInfo}>
            <Text style={styles.progressText}>
              {totalAmount} / {targetAmount} ml
            </Text>
            <Text style={styles.glassesText}>
              {t("hydration.glasses_logged", { count: glassesLogged })}
            </Text>
          </View>

          {progressPercentage >= 100 && (
            <View style={styles.targetReachedBadge}>
              <Text style={styles.targetReachedText}>
                {t("hydration.target_reached")}
              </Text>
            </View>
          )}
        </View>

        {/* Quick Add Presets */}
        <Text style={styles.sectionTitle}>{t("hydration.quick_add")}</Text>

        <View style={styles.presetsGrid}>
          {HYDRATION_TYPES.map((preset) => {
            const isSelected = selectedPreset === preset.key;
            const isThisLoading = isLoading && isSelected;
            const isDisabled = presetsDisabled && !isSelected;
            return (
              <TouchableOpacity
                key={preset.key}
                style={[
                  styles.presetButton,
                  isSelected && styles.presetButtonSelected,
                  isDisabled && styles.presetButtonDisabled,
                ]}
                onPress={() => handlePresetSelect(preset)}
                disabled={presetsDisabled}
                activeOpacity={isDisabled ? 1 : 0.7}
              >
                <>
                  <View
                    style={[
                      styles.presetContent,
                      isDisabled && styles.presetContentDisabled,
                      isThisLoading && styles.presetContentLoading,
                    ]}
                  >
                    <View style={styles.presetIconContainer}>
                      <HydrationIcon
                        type={preset.key as HydrationType}
                        size={32}
                        selected={isSelected}
                      />
                    </View>
                    <Text
                      style={[
                        styles.presetLabel,
                        isDisabled && styles.presetLabelDisabled,
                      ]}
                    >
                      {preset.label}
                    </Text>
                    <Text
                      style={[
                        styles.presetSublabel,
                        isDisabled && styles.presetSublabelDisabled,
                      ]}
                    >
                      {preset.sublabel}
                    </Text>
                  </View>
                  {isThisLoading && (
                    <View style={styles.loadingOverlay}>
                      <ActivityIndicator
                        color={brandColors.primary}
                        size="small"
                      />
                    </View>
                  )}
                </>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Custom Amount Toggle */}
        <TouchableOpacity
          style={[
            styles.customToggle,
            customDisabled && styles.customToggleDisabled,
          ]}
          onPress={() =>
            !customDisabled && setShowCustomInput(!showCustomInput)
          }
          disabled={customDisabled}
          activeOpacity={customDisabled ? 1 : 0.7}
        >
          <Ionicons
            name={showCustomInput ? "chevron-up" : "chevron-down"}
            size={16}
            color={customDisabled ? colors.text.tertiary : brandColors.primary}
          />
          <Text
            style={[
              styles.customToggleText,
              customDisabled && styles.customToggleTextDisabled,
            ]}
          >
            {t("hydration.custom")}
          </Text>
        </TouchableOpacity>

        {/* Custom Input */}
        {showCustomInput && (
          <View style={styles.customInputContainer}>
            <TextInput
              label={t("hydration.custom_amount")}
              value={customAmount}
              onChangeText={setCustomAmount}
              placeholder="e.g., 350"
              keyboardType="numeric"
              containerStyle={styles.customInput}
            />
            <Button
              title={t("hydration.log_water")}
              onPress={handleCustomSubmit}
              disabled={isSubmittingCustom || !customAmount}
              loading={isSubmittingCustom}
            />
          </View>
        )}
      </View>
      {/* AlertOverlay renders inside Modal so toasts/alerts appear on top */}
      <AlertOverlay visible={visible} />
    </Modal>
  );
}

const makeHydrationModalStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    paddingBottom: toRN(tokens.spacing[4]),
  },
  progressCard: {
    backgroundColor: colors.bg.card,
    padding: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.xl),
    marginBottom: toRN(tokens.spacing[5]),
  },
  progressTitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[3]),
    textAlign: "center" as const,
  },
  progressBar: {
    height: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.md),
    backgroundColor: colors.border.default,
    overflow: "hidden" as const,
    marginBottom: toRN(tokens.spacing[2]),
  },
  progressFill: {
    height: "100%" as const,
    borderRadius: toRN(tokens.borderRadius.md),
    backgroundColor: brand.primary,
  },
  progressInfo: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
  progressText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
  glassesText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
  },
  targetReachedBadge: {
    marginTop: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    backgroundColor: colors.feedback.success,
    borderRadius: toRN(tokens.borderRadius.full),
    alignSelf: "center" as const,
  },
  targetReachedText: {
    color: colors.text.onSuccess,
    fontFamily: fontFamily.semiBold,
    fontSize: toRN(tokens.typography.fontSize.sm),
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[3]),
  },
  presetsGrid: {
    flexDirection: "row" as const,
    gap: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[4]),
  },
  presetButton: {
    flex: 1,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[4]),
    paddingHorizontal: toRN(tokens.spacing[2]),
    borderRadius: toRN(tokens.borderRadius.xl),
    borderWidth: 1,
    borderColor: colors.border.default,
    // backgroundColor: colors.bg.card,
    minHeight: 100,
    justifyContent: "center" as const,
  },
  presetButtonSelected: {
    backgroundColor: brand.primary + "10", // 12% opacity for subtle tint
    borderColor: brand.primary,
    borderWidth: 2,
  },
  presetButtonDisabled: {
    opacity: 0.4,
  },
  presetContent: {
    alignItems: "center" as const,
  },
  presetContentDisabled: {
    opacity: 0.6,
  },
  presetContentLoading: {
    opacity: 0.5,
  },
  loadingOverlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    backgroundColor: brand.primary + "15", // very subtle overlay
    borderRadius: toRN(tokens.borderRadius.xl),
  },
  presetIconContainer: {
    marginBottom: toRN(tokens.spacing[2]),
  },
  presetLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    textAlign: "center" as const,
  },

  presetLabelDisabled: {
    color: colors.text.tertiary,
  },
  presetSublabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    textAlign: "center" as const,
    marginTop: toRN(tokens.spacing[0.5]),
  },

  presetSublabelDisabled: {
    color: colors.text.tertiary,
  },
  customToggle: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[1]),
    paddingVertical: toRN(tokens.spacing[2]),
  },
  customToggleText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: brand.primary,
  },
  customToggleDisabled: {
    opacity: 0.5,
  },
  customToggleTextDisabled: {
    color: colors.text.tertiary,
  },
  customInputContainer: {
    marginTop: toRN(tokens.spacing[3]),
    gap: toRN(tokens.spacing[3]),
  },
  customInput: {
    marginBottom: 0,
  },
});

export default HydrationModal;
