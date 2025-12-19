import AILoadingAnimation from "@/components/onboarding/AILoadingAnimation";
import Button from "@/components/ui/Button";
import { useAlertModal } from "@/contexts/AlertModalContext";
import {
  useRegenerateSuggestedGoals,
  useRequestSuggestedGoals,
  useSuggestedGoalsStatus,
  type GoalTypeOption,
} from "@/hooks/api/useSuggestedGoals";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { toRN } from "@/lib/units";
import SubscriptionScreen from "@/screens/onboarding/SubscriptionScreen";
import { SuggestedGoal } from "@/services/api/onboarding";
import { logger } from "@/services/logger";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { useTheme } from "@/themes";
import { useStyles } from "@/themes/makeStyles";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SuggestionGoalCard } from "./SuggestionGoalCard";

// Goal type options for the selector
const GOAL_TYPE_OPTIONS: {
  id: GoalTypeOption;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: "mixed", icon: "color-palette-outline" },
  { id: "habit", icon: "refresh-outline" },
  { id: "time_challenge", icon: "calendar-outline" },
  { id: "target_challenge", icon: "flag-outline" },
];

// Goal types that require premium (challenges)
const requiresPremium = (type: GoalTypeOption): boolean => {
  return type !== "habit"; // Only habit is free, everything else needs premium
};

interface AISuggestionsViewProps {
  onUseSuggestion: (goal: SuggestedGoal) => void;
  onSwitchToCustom?: () => void;
  goalType?: "habit" | "time_challenge" | "target_challenge" | "mixed";
}

export function AISuggestionsView({
  onUseSuggestion,
  onSwitchToCustom,
  goalType = "habit",
}: AISuggestionsViewProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeAISuggestionsViewStyles);
  const { colors, brandColors } = useTheme();
  const { showAlert, showConfirm } = useAlertModal();
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showGoalTypeSelector, setShowGoalTypeSelector] = useState(false);

  // Get subscription store for feature checks
  const subscriptionStoreInstance = useSubscriptionStore();

  // Check if user has premium access based on their features (fetched by minimum_tier)
  // challenge_create = Starter+ - grants access to non-habit goal types
  const hasPremiumAccess =
    subscriptionStoreInstance.hasFeature("challenge_create");

  // Default to "mixed" for all users during testing
  const [selectedGoalType, setSelectedGoalType] = useState<GoalTypeOption>(
    hasPremiumAccess ? "mixed" : "habit"
  );

  const statusQuery = useSuggestedGoalsStatus(true);
  const requestSuggestedGoals = useRequestSuggestedGoals();
  const regenerateSuggestedGoals = useRegenerateSuggestedGoals();

  const hasRequestedRef = useRef(false);

  // Get generation limit from subscription store
  // Free users: feature_value = 2 (2 total generations)
  // Starter+: feature_value = null (unlimited)
  const generationLimit = subscriptionStoreInstance.getFeatureValue(
    "ai_goal_generations"
  );

  const statusData = statusQuery.data;
  const status = statusData?.status ?? "not_started";

  // CRITICAL: When status is "pending", ignore any goals in the data
  // This prevents showing stale goals during regeneration
  const currentGoals = status === "pending" ? undefined : statusData?.goals;

  // Auto-request suggestions if not started
  // Uses the goalType prop (defaults to "habit") for initial generation
  useEffect(() => {
    if (statusQuery.isLoading) {
      return;
    }

    if (
      status === "not_started" &&
      !hasRequestedRef.current &&
      !requestSuggestedGoals.isPending
    ) {
      hasRequestedRef.current = true;
      // Use the goalType prop for initial request (defaults to "habit")
      requestSuggestedGoals.mutate(goalType as GoalTypeOption);
    }
  }, [status, statusQuery.isLoading, requestSuggestedGoals, goalType]);

  // Open goal type selector before regenerating
  const handleRegenerateClick = () => {
    setShowGoalTypeSelector(true);
  };

  // Handle goal type selection
  const handleGoalTypeSelect = (type: GoalTypeOption) => {
    // Check premium access for non-habit types
    if (requiresPremium(type) && !hasPremiumAccess) {
      setShowGoalTypeSelector(false);
      setShowSubscriptionModal(true);
      return;
    }
    setSelectedGoalType(type);
  };

  // Confirm and regenerate with selected type
  const handleConfirmRegenerate = async () => {
    setShowGoalTypeSelector(false);
    await handleRegenerate();
  };

  const handleRegenerate = async () => {
    try {
      // Check generation limit
      const currentCount = statusData?.regeneration_count ?? 0;

      // Check if user has reached their limit
      if (generationLimit !== null && currentCount >= generationLimit) {
        // Show upgrade prompt
        const confirmed = await showConfirm({
          title: t("goals.create.suggestions.upgrade_title"),
          message: t("goals.create.suggestions.upgrade_message"),
          confirmLabel: t("goals.create.suggestions.upgrade_now"),
          cancelLabel: t("common.cancel"),
          variant: "info",
          showCloseIcon: true,
        });

        if (confirmed) {
          // Show subscription modal
          setShowSubscriptionModal(true);
        }
        // If not confirmed (close/cancel), just return without action
        return;
      }

      // Call the regenerate endpoint with selected goal type
      hasRequestedRef.current = true;
      await regenerateSuggestedGoals.mutateAsync(selectedGoalType);
    } catch (error) {
      // Check if it's a 403 error (limit reached from backend)
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (errorMessage.includes("403") || errorMessage.includes("Upgrade")) {
        // Backend rejected due to limit, show upgrade prompt
        const confirmed = await showConfirm({
          title: t("goals.create.suggestions.upgrade_title"),
          message: t("goals.create.suggestions.upgrade_message"),
          confirmLabel: t("goals.create.suggestions.upgrade_now"),
          cancelLabel: t("common.cancel"),
          variant: "info",
          showCloseIcon: true,
        });

        if (confirmed) {
          setShowSubscriptionModal(true);
        }
        // If not confirmed (close/cancel), just return without action
        return;
      }

      // Only log actual errors (not expected limit-reached scenarios)
      logger.error("Failed to regenerate suggestions", {
        error: errorMessage,
      });
      await showAlert({
        title: t("common.error"),
        message: t("goals.create.suggestions.regenerate_error"),
        variant: "error",
        confirmLabel: t("common.ok"),
      });
      // Reset ref on error so user can retry
      hasRequestedRef.current = false;
    }
  };

  // Render goal type selector modal
  const renderGoalTypeSelector = () => (
    <Modal
      visible={showGoalTypeSelector}
      transparent
      animationType="fade"
      onRequestClose={() => setShowGoalTypeSelector(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowGoalTypeSelector(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalContent}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.modalTitle}>
            {t("goals.create.suggestions.select_type_title") ||
              "What kind of goals?"}
          </Text>
          <Text style={styles.modalSubtitle}>
            {t("goals.create.suggestions.select_type_subtitle") ||
              "Choose the type of suggestions you want"}
          </Text>

          <View style={styles.typeOptionsContainer}>
            {GOAL_TYPE_OPTIONS.map((option) => {
              const isSelected = selectedGoalType === option.id;
              const isLocked = requiresPremium(option.id) && !hasPremiumAccess;

              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.typeOption,
                    isSelected && styles.typeOptionSelected,
                    isLocked && styles.typeOptionLocked,
                  ]}
                  onPress={() => handleGoalTypeSelect(option.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={option.icon}
                    size={24}
                    color={
                      isSelected
                        ? brandColors.primary
                        : isLocked
                          ? colors.text.tertiary
                          : colors.text.secondary
                    }
                  />
                  <Text
                    style={[
                      styles.typeOptionLabel,
                      isSelected && styles.typeOptionLabelSelected,
                      isLocked && styles.typeOptionLabelLocked,
                    ]}
                  >
                    {t(`goals.types.${option.id}.title`) || option.id}
                  </Text>
                  {isLocked && (
                    <Ionicons
                      name="lock-closed"
                      size={14}
                      color={colors.text.tertiary}
                      style={styles.lockIcon}
                    />
                  )}
                  {isSelected && !isLocked && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={brandColors.primary}
                      style={styles.checkIcon}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.modalActions}>
            <Button
              title={t("common.cancel")}
              onPress={() => setShowGoalTypeSelector(false)}
              variant="ghost"
              size="md"
              style={styles.modalCancelButton}
            />
            <Button
              title={t("goals.create.suggestions.regenerate")}
              onPress={handleConfirmRegenerate}
              variant="primary"
              size="md"
              leftIcon="refresh"
              style={styles.modalConfirmButton}
            />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

  const handleRetry = () => {
    hasRequestedRef.current = false;
    // Use stored goal_type from failed request, fallback to prop
    const storedGoalType = statusData?.goal_type || goalType;
    requestSuggestedGoals.mutate(storedGoalType as GoalTypeOption);
  };

  const isInitialLoading = statusQuery.isLoading && !statusData;
  const isPendingGeneration =
    status === "pending" ||
    requestSuggestedGoals.isPending ||
    regenerateSuggestedGoals.isPending;
  const showLoadingState = isInitialLoading || isPendingGeneration;
  const showErrorState = status === "failed";

  // CRITICAL: Never show ready state if status is pending, even if old goals exist in cache
  // Only show ready state when status is explicitly "ready" and we have goals
  const showReadyState =
    status === "ready" &&
    currentGoals &&
    currentGoals.length > 0 &&
    !showLoadingState;

  // Loading State - Contained within parent, no full-screen background
  if (showLoadingState) {
    return (
      <View style={styles.loadingContainer}>
        <AILoadingAnimation />
        <Text style={styles.loadingTitle}>
          {t("goals.create.suggestions.generating_title")}
        </Text>
        <Text style={styles.loadingMessage}>
          {t("goals.create.suggestions.generating_message")}
        </Text>
      </View>
    );
  }

  // Error State - Contained within parent, no full-screen background
  if (showErrorState) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorContent}>
          <Ionicons
            name="alert-circle-outline"
            size={64}
            color={colors.feedback.error}
            style={styles.errorIcon}
          />
          <Text style={styles.errorTitle}>
            {t("goals.create.suggestions.error_title")}
          </Text>
          <Text style={styles.errorMessage}>
            {statusData?.error || t("goals.create.suggestions.error_message")}
          </Text>
          <Button
            title={t("common.retry")}
            onPress={handleRetry}
            disabled={requestSuggestedGoals.isPending}
            loading={requestSuggestedGoals.isPending}
            variant="primary"
            size="lg"
            fullWidth
            style={styles.errorRetryButton}
          />
          <Button
            title={t("goals.create.suggestions.create_custom_fallback")}
            onPress={() => onSwitchToCustom?.()}
            variant="outline"
            size="lg"
            fullWidth
            style={styles.errorCustomButton}
          />
        </View>
      </View>
    );
  }

  // Ready State - Only show when status is "ready" and we have goals
  if (showReadyState && currentGoals && currentGoals.length > 0) {
    return (
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header with Regenerate */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>
                {t("goals.create.suggestions.title")}
              </Text>
              <Text style={styles.headerSubtitle}>
                {t("goals.create.suggestions.subtitle", {
                  count: currentGoals.length,
                })}
              </Text>
            </View>
            <Button
              title={t("goals.create.suggestions.regenerate")}
              onPress={handleRegenerateClick}
              disabled={regenerateSuggestedGoals.isPending}
              loading={regenerateSuggestedGoals.isPending}
              variant="ghost"
              size="sm"
              leftIcon="refresh"
              style={styles.regenerateButton}
            />
          </View>

          {/* Suggestions List */}
          {currentGoals.map((goal) => (
            <SuggestionGoalCard
              key={goal.id}
              goal={goal}
              onUseThis={onUseSuggestion}
            />
          ))}
        </ScrollView>

        {/* Goal Type Selector Modal */}
        {renderGoalTypeSelector()}

        {/* Subscription Modal */}
        <SubscriptionScreen
          visible={showSubscriptionModal}
          onClose={() => setShowSubscriptionModal(false)}
        />
      </View>
    );
  }

  // Not Started / Empty State - Contained within parent, no full-screen background
  return (
    <View style={styles.emptyContainer}>
      <Ionicons
        name="bulb-outline"
        size={64}
        color={colors.text.secondary}
        style={styles.emptyIcon}
      />
      <Text style={styles.emptyTitle}>
        {t("goals.create.suggestions.empty_title")}
      </Text>
      <Text style={styles.emptyMessage}>
        {t("goals.create.suggestions.empty_message")}
      </Text>
      <Button
        title={t("goals.create.suggestions.generate")}
        onPress={() => {
          hasRequestedRef.current = true;
          requestSuggestedGoals.mutate(goalType as GoalTypeOption);
        }}
        disabled={requestSuggestedGoals.isPending}
        loading={requestSuggestedGoals.isPending}
        variant="primary"
        size="lg"
        fullWidth
        style={styles.generateButton}
      />

      {/* Subscription Modal */}
      <SubscriptionScreen
        visible={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
      />
    </View>
  );
}

const makeAISuggestionsViewStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: toRN(tokens.spacing[6]),
    paddingBottom: toRN(tokens.spacing[6]),
  },
  header: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[5]),
    marginTop: toRN(tokens.spacing[3]),
    paddingBottom: toRN(tokens.spacing[4]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  headerContent: {
    flex: 1,
    marginRight: toRN(tokens.spacing[3]),
  },
  headerTitle: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontWeight: tokens.typography.fontWeight.bold,
    color: colors.text.primary,
    fontFamily: fontFamily.groteskBold,
    marginBottom: toRN(tokens.spacing[1]),
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.tertiary,
    fontFamily: fontFamily.groteskRegular,
    lineHeight: toRN(tokens.typography.fontSize.sm * 1.4),
  },
  regenerateButton: {
    alignSelf: "center" as const,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[6]),
    paddingVertical: toRN(tokens.spacing[8]),
  },
  loadingTitle: {
    marginTop: toRN(tokens.spacing[4]),
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontWeight: tokens.typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: "center" as const,
    fontFamily: fontFamily.groteskBold,
  },
  loadingMessage: {
    marginTop: toRN(tokens.spacing[3]),
    fontSize: toRN(tokens.typography.fontSize.base),
    color: colors.text.secondary,
    textAlign: "center" as const,
    lineHeight: toRN(tokens.typography.fontSize.base * 1.5),
    fontFamily: fontFamily.groteskRegular,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[6]),
  },
  errorContent: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
    maxWidth: 400,
    width: "100%",
  },
  errorIcon: {
    marginBottom: toRN(tokens.spacing[4]),
  },
  errorTitle: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontWeight: tokens.typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[3]),
    fontFamily: fontFamily.groteskBold,
  },
  errorMessage: {
    fontSize: toRN(tokens.typography.fontSize.base),
    color: colors.text.secondary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[6]),
    fontFamily: fontFamily.groteskRegular,
    lineHeight: toRN(tokens.spacing[6]),
  },
  errorRetryButton: {
    marginBottom: toRN(tokens.spacing[3]),
  },
  errorCustomButton: {},
  emptyContainer: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[6]),
  },
  emptyIcon: {
    marginBottom: toRN(tokens.spacing[4]),
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontWeight: tokens.typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[3]),
    fontFamily: fontFamily.groteskBold,
  },
  emptyMessage: {
    fontSize: toRN(tokens.typography.fontSize.base),
    color: colors.text.secondary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[6]),
    fontFamily: fontFamily.groteskRegular,
    lineHeight: toRN(tokens.typography.fontSize.base * 1.5),
  },
  generateButton: {
    maxWidth: 300,
  },
  // Goal Type Selector Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center" as const,
    alignItems: "center" as const,
    padding: toRN(tokens.spacing[4]),
  },
  modalContent: {
    backgroundColor: colors.bg.surface,
    borderRadius: toRN(tokens.borderRadius.xl),
    padding: toRN(tokens.spacing[6]),
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[2]),
  },
  modalSubtitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[5]),
  },
  typeOptionsContainer: {
    gap: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[5]),
  },
  typeOption: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    padding: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.lg),
    borderWidth: 2,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.canvas,
    gap: toRN(tokens.spacing[3]),
  },
  typeOptionSelected: {
    borderColor: brand.primary,
    backgroundColor: brand.primary + "08",
  },
  typeOptionLocked: {
    opacity: 0.6,
  },
  typeOptionLabel: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.primary,
  },
  typeOptionLabelSelected: {
    color: brand.primary,
  },
  typeOptionLabelLocked: {
    color: colors.text.tertiary,
  },
  lockIcon: {
    marginLeft: "auto" as const,
  },
  checkIcon: {
    marginLeft: "auto" as const,
  },
  modalActions: {
    flexDirection: "row" as const,
    gap: toRN(tokens.spacing[3]),
  },
  modalCancelButton: {
    flex: 1,
  },
  modalConfirmButton: {
    flex: 1,
  },
});
