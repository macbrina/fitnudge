import AILoadingAnimation from "@/components/onboarding/AILoadingAnimation";
import Button from "@/components/ui/Button";
import { useCreateGoal } from "@/hooks/api/useGoals";
import { useGoals } from "@/hooks/useGoals";
import { usePostHog } from "@/hooks/usePostHog";
import { usePricing } from "@/hooks/usePricing";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { MOBILE_ROUTES } from "@/lib/routes";
import { toRN } from "@/lib/units";
import { onboardingApi, SuggestedGoal } from "@/services/api/onboarding";
import { logger } from "@/services/logger";
import { useAuthStore } from "@/stores/authStore";
import { useTheme } from "@/themes";
import { useStyles } from "@/themes/makeStyles";
import { STORAGE_KEYS, storageUtil } from "@/utils/storageUtil";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SuggestedGoalsScreen() {
  const [suggestedGoals, setSuggestedGoals] = useState<SuggestedGoal[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showAILoading, setShowAILoading] = useState(true);
  const [apiCompleted, setApiCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(
    new Set()
  );
  const [expandedMatchReasons, setExpandedMatchReasons] = useState<Set<string>>(
    new Set()
  );

  // Ref to prevent duplicate API calls
  const isLoadingRef = useRef(false);
  const hasLoadedRef = useRef(false);

  const { t } = useTranslation();
  const styles = useStyles(makeSuggestedGoalsScreenStyles);
  const insets = useSafeAreaInsets();
  const { colors, brandColors } = useTheme();
  const { capture } = usePostHog();
  const createGoal = useCreateGoal();
  const { user } = useAuthStore();
  const { canCreateGoal: pricingCanCreateGoal, isLoading: pricingLoading } =
    usePricing();
  const {
    getCurrentGoalCount,
    createGoal: createGoalInStore,
    isLoading: goalsLoading,
  } = useGoals();

  useEffect(() => {
    // Prevent duplicate calls - only load if not already loading and not already loaded
    if (!isLoadingRef.current && !hasLoadedRef.current) {
      console.log("loadSuggestedGoals - initiating");
      loadSuggestedGoals();
    } else {
      console.log("loadSuggestedGoals - skipped (already loading or loaded)", {
        isLoading: isLoadingRef.current,
        hasLoaded: hasLoadedRef.current,
      });
    }

    // Cleanup on unmount
    return () => {
      isLoadingRef.current = false;
    };
  }, []);

  const loadSuggestedGoals = async (forceRetry: boolean = false) => {
    // Prevent duplicate simultaneous calls (unless forced retry)
    if (isLoadingRef.current && !forceRetry) {
      console.log("loadSuggestedGoals - already in progress, skipping");
      return;
    }

    try {
      isLoadingRef.current = true;
      if (forceRetry) {
        hasLoadedRef.current = false; // Reset on manual retry
      }
      setIsLoading(true);
      setShowAILoading(true);
      setApiCompleted(false); // Reset API completion state
      setError(null);

      const response = await onboardingApi.getSuggestedGoals();

      if (response.data && Array.isArray(response.data)) {
        const goals = response.data;
        setSuggestedGoals(goals);
        hasLoadedRef.current = true; // Mark as loaded
        setApiCompleted(true); // Signal that API has completed

        capture("goal_suggestions_loaded", {
          count: goals.length,
          source: "onboarding",
        });
      } else {
        const errorMessage =
          response.error || t("onboarding.suggested_goals.error_loading");
        throw new Error(errorMessage);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Check if it's a timeout error
      const isTimeoutError =
        errorMessage.toLowerCase().includes("timeout") ||
        errorMessage.toLowerCase().includes("timed out") ||
        errorMessage.toLowerCase().includes("25 seconds");

      logger.error("Failed to load suggested goals", {
        error: errorMessage,
        isTimeout: isTimeoutError,
      });

      // Use timeout-specific message if detected, otherwise generic error
      setError(
        isTimeoutError
          ? t("onboarding.suggested_goals.error_timeout")
          : errorMessage || t("onboarding.suggested_goals.error_loading")
      );
      setApiCompleted(true); // Signal API completion even on error
      setShowAILoading(false);
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  };

  const handleAILoadingComplete = () => {
    setShowAILoading(false);
  };

  const { getGoalLimit } = usePricing();

  const getRemainingGoalSlots = () => {
    const planId = user?.plan || "free";
    const currentGoalCount = getCurrentGoalCount();
    const goalLimit = getGoalLimit(planId);

    // If unlimited, return a large number
    if (goalLimit === null) {
      return 999; // Effectively unlimited
    }

    return Math.max(0, goalLimit - currentGoalCount);
  };

  const canSelectMoreGoals = () => {
    const remaining = getRemainingGoalSlots();
    return selectedGoals.size < remaining;
  };

  const handleGoalSelect = (goal: SuggestedGoal, event?: any) => {
    // If clicking on expand button, don't toggle selection
    if (event?.target?.dataset?.action === "expand") {
      return;
    }

    setSelectedGoals((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(goal.id)) {
        newSet.delete(goal.id);
        capture("goal_suggestion_deselected", {
          goal_id: goal.id,
          goal_title: goal.title,
        });
      } else {
        // Check if they can select more goals
        const remaining = getRemainingGoalSlots();
        if (newSet.size >= remaining) {
          // Show alert that they've reached their limit
          Alert.alert(
            t("common.error"),
            t("onboarding.suggested_goals.goal_limit_reached", {
              limit: remaining,
            })
          );
          return prev;
        }
        newSet.add(goal.id);
        capture("goal_suggestion_selected", {
          goal_id: goal.id,
          goal_title: goal.title,
          selected_count: newSet.size,
        });
      }
      return newSet;
    });
  };

  const toggleDescriptionExpanded = (goalId: string, event: any) => {
    event.stopPropagation();
    setExpandedDescriptions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(goalId)) {
        newSet.delete(goalId);
      } else {
        newSet.add(goalId);
      }
      return newSet;
    });
  };

  const toggleMatchReasonExpanded = (goalId: string, event: any) => {
    event.stopPropagation();
    setExpandedMatchReasons((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(goalId)) {
        newSet.delete(goalId);
      } else {
        newSet.add(goalId);
      }
      return newSet;
    });
  };

  const shouldTruncate = (text: string, maxLength: number = 120) => {
    return text && text.length > maxLength;
  };

  const handleCreateGoal = async () => {
    if (selectedGoals.size === 0) return;

    // Get selected goals in order
    const goalsToCreate = suggestedGoals.filter((goal) =>
      selectedGoals.has(goal.id)
    );

    if (goalsToCreate.length === 0) return;

    // Validate we can create all selected goals
    const remaining = getRemainingGoalSlots();
    if (goalsToCreate.length > remaining) {
      Alert.alert(
        t("common.error"),
        t("onboarding.suggested_goals.too_many_goals_selected", {
          selected: goalsToCreate.length,
          limit: remaining,
        })
      );
      return;
    }

    try {
      setIsCreating(true);

      // Create goals one by one
      let successCount = 0;
      for (const goal of goalsToCreate) {
        try {
          const goalData = {
            title: goal.title,
            description: goal.description,
            category: goal.category as
              | "fitness"
              | "nutrition"
              | "wellness"
              | "mindfulness"
              | "sleep"
              | "custom",
            frequency: goal.frequency as
              | "daily"
              | "weekly"
              | "monthly"
              | "custom",
            target_days: goal.target_days || 7,
            reminder_times: goal.reminder_times,
          };

          const createdGoal = await createGoal.mutateAsync(goalData);

          if (createdGoal) {
            await createGoalInStore(goalData);
            successCount++;
          }
        } catch (error) {
          logger.error("Failed to create goal from suggestion", {
            error: error instanceof Error ? error.message : String(error),
            goal_id: goal.id,
            goal_title: goal.title,
          });
        }
      }

      if (successCount > 0) {
        capture("goals_created_from_suggestions", {
          count: successCount,
          total_selected: goalsToCreate.length,
          source: "onboarding_suggestion",
        });

        await storageUtil.setItem(STORAGE_KEYS.HAS_SEEN_SUGGESTED_GOALS, false);
        router.push(MOBILE_ROUTES.ONBOARDING.SUBSCRIPTION);
      } else {
        Alert.alert(
          t("common.error"),
          t("onboarding.suggested_goals.error_creating")
        );
      }
    } catch (error) {
      logger.error("Failed to create goals from suggestions", {
        error: error instanceof Error ? error.message : String(error),
      });

      Alert.alert(
        t("common.error"),
        t("onboarding.suggested_goals.error_creating")
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateCustomGoal = async () => {
    capture("goal_custom_creation_started", {
      source: "onboarding_suggestion",
    });

    await storageUtil.setItem(STORAGE_KEYS.HAS_SEEN_SUGGESTED_GOALS, false);
    router.push(MOBILE_ROUTES.GOALS.CREATE);
  };

  const handleSkip = async () => {
    capture("goal_suggestions_skipped", {
      source: "onboarding",
    });

    await storageUtil.setItem(STORAGE_KEYS.HAS_SEEN_SUGGESTED_GOALS, true);
    router.push(MOBILE_ROUTES.ONBOARDING.SUBSCRIPTION);
  };

  const handleChangePreferences = async () => {
    capture("goal_preferences_changed", {
      source: "suggested_goals",
    });

    router.push(MOBILE_ROUTES.ONBOARDING.PERSONALIZATION);
  };

  const handleBack = () => {
    router.push(MOBILE_ROUTES.ONBOARDING.PERSONALIZATION);
  };

  // Show error state
  if (error && !isLoading) {
    return (
      <View style={styles.container}>
        <View style={[styles.errorContainer, { paddingTop: insets.top + 60 }]}>
          <Button
            title=""
            variant="ghost"
            size="sm"
            icon="chevron-back"
            iconOnly
            onPress={handleBack}
            style={styles.errorBackButton}
            accessibilityLabel={t("common.back")}
          />
          <View style={styles.errorContent}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>
              {t("onboarding.suggested_goals.error_title")}
            </Text>
            <Text style={styles.errorMessage}>
              {error || t("onboarding.suggested_goals.error_loading")}
            </Text>
            <Button
              title={t("common.retry")}
              onPress={() => loadSuggestedGoals(true)}
              disabled={isLoading}
              loading={isLoading}
              variant="primary"
              size="lg"
              fullWidth
              style={styles.errorRetryButton}
            />
            <Button
              title={t("onboarding.suggested_goals.create_custom")}
              onPress={handleCreateCustomGoal}
              disabled={isLoading}
              variant="outline"
              size="lg"
              fullWidth
              style={styles.errorCustomButton}
            />
          </View>
        </View>
      </View>
    );
  }

  // Show AI loading animation - only wait for suggested goals, not pricing/goals
  // Pricing and goals can load in parallel; validation happens on selection
  if (showAILoading || isLoading) {
    return (
      <View style={styles.container}>
        <AILoadingAnimation
          onComplete={handleAILoadingComplete}
          apiCompleted={apiCompleted}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {t("onboarding.suggested_goals.title")}
          </Text>
          <Text style={styles.subtitle}>
            {t("onboarding.suggested_goals.subtitle")}
          </Text>
        </View>
      </View>

      {/* Goals List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {suggestedGoals.length > 0 ? (
          suggestedGoals.map((goal) => {
            const isSelected = selectedGoals.has(goal.id);
            const isDescriptionExpanded = expandedDescriptions.has(goal.id);
            const isMatchReasonExpanded = expandedMatchReasons.has(goal.id);
            const descriptionNeedsTruncation = shouldTruncate(
              goal.description || ""
            );
            const matchReasonNeedsTruncation = shouldTruncate(
              goal.match_reason || "",
              100
            );
            const canSelect = canSelectMoreGoals() || isSelected;

            return (
              <View
                key={goal.id}
                style={[
                  styles.goalCard,
                  isSelected && styles.goalCardSelected,
                  !canSelect && !isSelected && styles.goalCardDisabled,
                ]}
              >
                <TouchableOpacity
                  onPress={() => handleGoalSelect(goal)}
                  activeOpacity={0.7}
                  style={styles.goalCardPressable}
                  disabled={!canSelect && !isSelected}
                >
                  {/* Selection Indicator */}
                  <View style={styles.selectionIndicator}>
                    {isSelected && (
                      <View style={styles.selectionCheckmark}>
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color={brandColors.primary}
                        />
                      </View>
                    )}
                  </View>

                  {/* Goal Header */}
                  <View style={styles.goalHeader}>
                    <View style={styles.goalTitleContainer}>
                      <Text style={styles.goalTitle} numberOfLines={2}>
                        {goal.title}
                      </Text>
                    </View>
                  </View>

                  {/* Goal Description */}
                  {goal.description && (
                    <View style={styles.descriptionContainer}>
                      <Text
                        style={styles.goalDescription}
                        numberOfLines={isDescriptionExpanded ? undefined : 2}
                      >
                        {goal.description}
                      </Text>
                      {descriptionNeedsTruncation && (
                        <TouchableOpacity
                          onPress={(e) => toggleDescriptionExpanded(goal.id, e)}
                          style={styles.expandButton}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Text style={styles.expandButtonText}>
                            {isDescriptionExpanded
                              ? t("common.read_less")
                              : t("common.read_more")}
                          </Text>
                          <Ionicons
                            name={
                              isDescriptionExpanded
                                ? "chevron-up"
                                : "chevron-down"
                            }
                            size={14}
                            color={brandColors.primary}
                            style={styles.expandIcon}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* Goal Details */}
                  <View style={styles.goalDetails}>
                    <View style={styles.goalDetailItem}>
                      <Ionicons
                        name="calendar-outline"
                        size={16}
                        color={colors.text.secondary}
                        style={styles.detailIcon}
                      />
                      <Text style={styles.goalFrequency}>
                        {t(`goals.frequency.${goal.frequency}`)}
                      </Text>
                    </View>
                    {goal.target_days && (
                      <View style={styles.goalDetailItem}>
                        <Ionicons
                          name="time-outline"
                          size={16}
                          color={colors.text.secondary}
                          style={styles.detailIcon}
                        />
                        <Text style={styles.goalTargetDays}>
                          {t("goals.target_days", { days: goal.target_days })}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>

                {/* Match Reason - Separate from main card press */}
                {goal.match_reason && (
                  <View style={styles.matchReasonContainer}>
                    <Ionicons
                      name="bulb-outline"
                      size={18}
                      color={brandColors.primary}
                      style={styles.matchReasonIcon}
                    />
                    <Text
                      style={styles.matchReason}
                      numberOfLines={isMatchReasonExpanded ? undefined : 2}
                    >
                      {goal.match_reason}
                    </Text>
                    {matchReasonNeedsTruncation && (
                      <TouchableOpacity
                        onPress={(e) => toggleMatchReasonExpanded(goal.id, e)}
                        style={styles.matchReasonExpand}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text style={styles.expandButtonText}>
                          {isMatchReasonExpanded
                            ? t("common.read_less")
                            : t("common.read_more")}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Ionicons
              name="flag-outline"
              size={48}
              color={colors.text.secondary}
              style={styles.emptyStateIcon}
            />
            <Text style={styles.emptyStateText}>
              {t("onboarding.suggested_goals.no_goals")}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Actions Footer */}
      <View style={[styles.actions, { paddingBottom: insets.bottom }]}>
        <Button
          title={
            isCreating
              ? t("common.creating")
              : selectedGoals.size > 1
                ? t("onboarding.suggested_goals.create_goals", {
                    count: selectedGoals.size,
                  })
                : t("onboarding.suggested_goals.create_goal")
          }
          onPress={handleCreateGoal}
          disabled={selectedGoals.size === 0 || isCreating}
          loading={isCreating}
          variant="primary"
          size="md"
          fullWidth
          style={styles.primaryButton}
        />

        <Button
          title={t("onboarding.suggested_goals.create_custom")}
          onPress={handleCreateCustomGoal}
          variant="outline"
          size="md"
          fullWidth
          style={styles.secondaryButton}
        />

        <View style={styles.footerLinks}>
          <Button
            title={t("onboarding.suggested_goals.skip")}
            onPress={handleSkip}
            variant="text"
            size="md"
            style={styles.textLink}
          />
          <View style={styles.linkSeparator} />
          <Button
            title={t("onboarding.suggested_goals.change_preferences")}
            onPress={handleChangePreferences}
            variant="text"
            size="md"
            style={styles.textLink}
          />
        </View>
      </View>
    </View>
  );
}

const makeSuggestedGoalsScreenStyles = (
  tokens: any,
  colors: any,
  brand: any
) => {
  return {
    container: {
      flex: 1,
      backgroundColor: colors.bg.canvas,
    },
    headerWrapper: {
      position: "relative" as const,
      paddingHorizontal: toRN(tokens.spacing[6]),
      paddingBottom: toRN(tokens.spacing[5]),
    },
    backButton: {
      position: "absolute" as const,
      left: toRN(tokens.spacing[6]),
      top: "auto" as const,
      zIndex: 1,
    },
    header: {
      paddingTop: toRN(tokens.spacing[10]),
      alignItems: "center" as const,
    },
    title: {
      fontSize: toRN(tokens.typography.fontSize["2xl"]),
      fontWeight: tokens.typography.fontWeight.bold,
      color: colors.text.primary,
      textAlign: "center" as const,
      marginBottom: toRN(tokens.spacing[2]),
      fontFamily: fontFamily.groteskBold,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: toRN(tokens.typography.fontSize.base),
      color: colors.text.secondary,
      textAlign: "center" as const,
      fontFamily: fontFamily.groteskRegular,
      paddingHorizontal: toRN(tokens.spacing[4]),
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: toRN(tokens.spacing[6]),
      paddingBottom: toRN(tokens.spacing[6]),
    },
    goalCard: {
      backgroundColor: colors.bg.surface,
      borderRadius: toRN(tokens.borderRadius.xl),
      marginBottom: toRN(tokens.spacing[4]),
      borderWidth: 2,
      borderColor: colors.border.default,
      overflow: "hidden" as const,
      shadowColor: colors.shadow.default,
      shadowOffset: { width: 0, height: toRN(2) },
      shadowOpacity: 0.08,
      shadowRadius: toRN(8),
      elevation: 3,
    },
    goalCardPressable: {
      padding: toRN(tokens.spacing[6]),
    },
    goalCardSelected: {
      borderColor: brand.primary,
      backgroundColor: brand.primary + "08",
      shadowColor: brand.primary,
      shadowOpacity: 0.15,
      shadowRadius: toRN(12),
      elevation: 5,
    },
    selectionIndicator: {
      position: "absolute" as const,
      top: toRN(tokens.spacing[4]),
      right: toRN(tokens.spacing[4]),
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border.default,
      backgroundColor: colors.bg.surface,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      zIndex: 1,
    },
    selectionCheckmark: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: brand.primary + "15",
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    goalHeader: {
      marginBottom: toRN(tokens.spacing[3]),
      paddingRight: toRN(tokens.spacing[8]),
    },
    goalTitleContainer: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      flexWrap: "wrap" as const,
      gap: toRN(tokens.spacing[2]),
    },
    goalTitle: {
      fontSize: toRN(tokens.typography.fontSize.xl),
      fontWeight: tokens.typography.fontWeight.bold,
      color: colors.text.primary,
      fontFamily: fontFamily.groteskBold,
      flex: 1,
      minWidth: 0,
    },
    premiumBadge: {
      backgroundColor: brand.primary,
      borderRadius: toRN(tokens.borderRadius.sm),
      paddingHorizontal: toRN(tokens.spacing[2]),
      paddingVertical: toRN(tokens.spacing[1]),
      alignSelf: "flex-start" as const,
    },
    premiumText: {
      fontSize: toRN(tokens.typography.fontSize.xs),
      fontWeight: tokens.typography.fontWeight.bold,
      color: colors.text.inverse,
      fontFamily: fontFamily.groteskBold,
      letterSpacing: 0.5,
    },
    descriptionContainer: {
      marginBottom: toRN(tokens.spacing[4]),
    },
    goalDescription: {
      fontSize: toRN(tokens.typography.fontSize.base),
      color: colors.text.secondary,
      fontFamily: fontFamily.groteskRegular,
      lineHeight: toRN(tokens.typography.fontSize.base * 1.5),
    },
    expandButton: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      marginTop: toRN(tokens.spacing[2]),
      alignSelf: "flex-start" as const,
    },
    expandButtonText: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: brand.primary,
      fontFamily: fontFamily.groteskMedium,
    },
    expandIcon: {
      marginLeft: toRN(tokens.spacing[1]),
    },
    goalDetails: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: toRN(tokens.spacing[3]),
      // marginBottom: toRN(tokens.spacing[3]),
    },
    goalDetailItem: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: colors.bg.muted,
      paddingHorizontal: toRN(tokens.spacing[3]),
      paddingVertical: toRN(tokens.spacing[1.5]),
      borderRadius: toRN(tokens.borderRadius.md),
    },
    detailIcon: {
      marginRight: toRN(tokens.spacing[2]),
    },
    goalCardDisabled: {
      opacity: 0.5,
    },
    goalFrequency: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.text.secondary,
      fontFamily: fontFamily.groteskMedium,
    },
    goalTargetDays: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.text.secondary,
      fontFamily: fontFamily.groteskMedium,
    },
    matchReasonContainer: {
      flexDirection: "column" as const,
      backgroundColor: brand.primary + "10",
      padding: toRN(tokens.spacing[3]),
      borderRadius: toRN(tokens.borderRadius.md),
      marginLeft: toRN(tokens.spacing[6]),
      marginRight: toRN(tokens.spacing[6]),
      // marginTop: toRN(tokens.spacing[2]),
      marginBottom: toRN(tokens.spacing[2]),
    },
    matchReasonIcon: {
      marginBottom: toRN(tokens.spacing[2]),
    },
    matchReason: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: brand.primary,
      fontFamily: fontFamily.groteskMedium,
      lineHeight: toRN(tokens.typography.fontSize.sm * 1.4),
      marginBottom: toRN(tokens.spacing[1]),
    },
    matchReasonExpand: {
      alignSelf: "flex-start" as const,
      marginTop: toRN(tokens.spacing[1]),
    },
    actions: {
      paddingHorizontal: toRN(tokens.spacing[6]),
      paddingTop: toRN(tokens.spacing[4]),
      backgroundColor: colors.bg.canvas,
      borderTopWidth: 1,
      borderTopColor: colors.border.default,
    },
    primaryButton: {
      marginBottom: toRN(tokens.spacing[3]),
    },
    secondaryButton: {
      marginBottom: toRN(tokens.spacing[4]),
    },
    footerLinks: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    textLink: {
      paddingHorizontal: toRN(tokens.spacing[3]),
    },
    linkSeparator: {
      width: 1,
      height: toRN(tokens.spacing[4]),
      backgroundColor: colors.border.default,
      marginHorizontal: toRN(tokens.spacing[2]),
    },
    emptyState: {
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingVertical: toRN(tokens.spacing[12]),
    },
    emptyStateIcon: {
      marginBottom: toRN(tokens.spacing[4]),
      opacity: 0.5,
    },
    emptyStateText: {
      fontSize: toRN(tokens.typography.fontSize.base),
      color: colors.text.secondary,
      textAlign: "center" as const,
      fontFamily: fontFamily.groteskRegular,
    },
    errorContainer: {
      flex: 1,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingHorizontal: toRN(tokens.spacing[6]),
      position: "relative" as const,
    },
    errorBackButton: {
      position: "absolute" as const,
      top: 0,
      left: toRN(tokens.spacing[6]),
      zIndex: 1,
    },
    errorContent: {
      alignItems: "center" as const,
      justifyContent: "center" as const,
      maxWidth: 400,
      width: "100%",
    },
    errorIcon: {
      fontSize: 64,
      marginBottom: toRN(tokens.spacing[4]),
      textAlign: "center" as const,
      alignSelf: "center" as const,
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
    errorCustomButton: {
      // No additional styles needed - fullWidth prop handles width
    },
  };
};
