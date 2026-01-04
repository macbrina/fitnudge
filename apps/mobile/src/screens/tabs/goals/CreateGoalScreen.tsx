import { UpgradePrompt } from "@/components/subscription";
import { BackButton } from "@/components/ui/BackButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useMyChallenges } from "@/hooks/api/useChallenges";
import { useActiveGoals } from "@/hooks/api/useGoals";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { toRN } from "@/lib/units";
import SubscriptionScreen from "@/screens/onboarding/SubscriptionScreen";
import { ChallengeForm } from "@/screens/tabs/challenges/components/ChallengeForm";
import { SuggestedGoal } from "@/services/api/onboarding";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { useTheme } from "@/themes";
import { useStyles } from "@/themes/makeStyles";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { AISuggestionsView } from "./components/AISuggestionsView";
import { CustomGoalForm } from "./components/CustomGoalForm";

type TabType = "suggestions" | "custom";
type CreateType = "goal" | "challenge" | null;

export default function CreateGoalScreen() {
  // Get category from navigation params if provided
  const params = useLocalSearchParams<{
    category?: string;
  }>();

  const [activeTab, setActiveTab] = useState<TabType>("suggestions");
  const [selectedSuggestion, setSelectedSuggestion] = useState<SuggestedGoal | null>(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [showSubscriptionScreen, setShowSubscriptionScreen] = useState(false);
  // Track what type of item user wants to create in custom tab
  const [createType, setCreateType] = useState<CreateType>(null);

  const { t } = useTranslation();
  const styles = useStyles(makeCreateGoalScreenStyles);
  const { colors, brandColors, isDark } = useTheme();

  // Check goal limits and challenge limits
  const { canCreateGoal, canParticipateInChallenge, getPlan, hasFeature } = useSubscriptionStore();
  const { data: activeGoalsResponse, isLoading: isLoadingGoals } = useActiveGoals();
  const { data: myChallengesResponse, isLoading: isLoadingChallenges } = useMyChallenges();

  const activeGoalCount = activeGoalsResponse?.data?.length || 0;
  // Only count active/upcoming challenges, not archived/completed ones
  const activeChallengeCount =
    myChallengesResponse?.data?.filter((c: any) => c.status === "active" || c.status === "upcoming")
      .length || 0;

  const canCreateNewGoal = canCreateGoal(activeGoalCount);
  const canCreateNewChallenge = canParticipateInChallenge(activeChallengeCount);
  const hasChallengeFeature = hasFeature("challenge_create");
  const plan = getPlan();

  // Track if we've already checked on initial load
  const hasCheckedInitially = useRef(false);

  // Show upgrade prompt ONLY on initial load if GOAL limit is reached
  // (Goals are available to all users, challenges are gated separately in type selector)
  useEffect(() => {
    // Wait until goals have loaded before checking
    if (isLoadingGoals) return;

    // Only check once on initial mount
    if (hasCheckedInitially.current) return;
    hasCheckedInitially.current = true;

    // Show upgrade prompt only if user can't create goals (the basic option available to all)
    if (!canCreateNewGoal && plan === "free") {
      setShowUpgradePrompt(true);
    }
  }, [isLoadingGoals, canCreateNewGoal, plan]);

  // Handle upgrade button press
  const handleUpgrade = useCallback(() => {
    setShowUpgradePrompt(false);
    setShowSubscriptionScreen(true);
  }, []);

  // Handle upgrade prompt close - go back if they can't create goals
  const handleUpgradePromptClose = useCallback(() => {
    setShowUpgradePrompt(false);
    if (!canCreateNewGoal) {
      router.back();
    }
  }, [canCreateNewGoal]);

  const handleBack = () => {
    router.back();
  };

  const handleUseSuggestion = (goal: SuggestedGoal) => {
    // Set the selected suggestion and switch to custom tab
    setSelectedSuggestion(goal);
    setCreateType("goal"); // Automatically set to goal when using suggestion as goal
    setActiveTab("custom");
  };

  const handleUseAsChallenge = (goal: SuggestedGoal) => {
    // Set the selected suggestion and switch to custom tab with challenge form
    setSelectedSuggestion(goal);
    setCreateType("challenge"); // Set to challenge to show ChallengeForm
    setActiveTab("custom");
  };

  const handleTabChange = (index: number) => {
    const newTab: TabType = index === 0 ? "suggestions" : "custom";
    setActiveTab(newTab);
    // Clear selected suggestion and create type when switching tabs
    if (newTab === "suggestions") {
      setSelectedSuggestion(null);
      setCreateType(null);
    }
  };

  // Handle type selection in custom tab
  const handleSelectCreateType = (type: CreateType) => {
    // Check if user can create this specific type
    if (type === "goal" && !canCreateNewGoal) {
      setShowUpgradePrompt(true);
      return;
    }
    if (type === "challenge" && !canCreateNewChallenge) {
      setShowUpgradePrompt(true);
      return;
    }
    setCreateType(type);
  };

  // Check if goal limit is reached (for display purposes)
  const goalLimitReached = !canCreateNewGoal;
  // Check if challenge is available (feature + limit)
  const challengeFeatureDisabled = !hasChallengeFeature;
  const challengeLimitReached = hasChallengeFeature && !canCreateNewChallenge;

  // Theme-aware colors for type cards
  const goalColor = "#22C55E"; // Green - works for both themes
  const challengeColor = "#3B82F6"; // Blue - works for both themes
  const disabledColor = isDark ? "#6B7280" : "#94A3B8"; // Lighter gray for dark mode
  const disabledBgColor = isDark ? "#6B728020" : "#94A3B815";

  // Render the type selector for custom tab
  const renderTypeSelector = () => (
    <View style={styles.typeSelectorContainer}>
      <Text style={styles.typeSelectorTitle}>{t("goals.create.what_to_create")}</Text>

      {/* Goal Option */}
      <TouchableOpacity
        style={[styles.typeCard, goalLimitReached && styles.typeCardDisabled]}
        onPress={() => handleSelectCreateType("goal")}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.typeIconContainer,
            {
              backgroundColor: goalLimitReached ? disabledBgColor : `${goalColor}15`
            }
          ]}
        >
          <Ionicons
            name="person-outline"
            size={28}
            color={goalLimitReached ? disabledColor : goalColor}
          />
        </View>
        <View style={styles.typeTextContainer}>
          <Text style={[styles.typeCardTitle, goalLimitReached && styles.typeCardTitleDisabled]}>
            {t("goals.create.as_goal")}
          </Text>
          <Text style={styles.typeCardDescription}>
            {goalLimitReached
              ? t("goals.create.goal_limit_reached") || "Goal limit reached"
              : t("goals.create.as_goal_desc")}
          </Text>
        </View>
        {goalLimitReached ? (
          <Ionicons name="lock-closed" size={20} color={disabledColor} />
        ) : (
          <Ionicons name="chevron-forward" size={24} color={colors.text.tertiary} />
        )}
      </TouchableOpacity>

      {/* Challenge Option */}
      <TouchableOpacity
        style={[styles.typeCard, challengeLimitReached && styles.typeCardDisabled]}
        onPress={() => {
          if (challengeFeatureDisabled) {
            // Show subscription modal - hybrid approach
            setShowSubscriptionScreen(true);
            return;
          }
          if (challengeLimitReached) {
            setShowUpgradePrompt(true);
            return;
          }
          handleSelectCreateType("challenge");
        }}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.typeIconContainer,
            {
              backgroundColor: challengeLimitReached ? disabledBgColor : `${challengeColor}15`
            }
          ]}
        >
          <Ionicons
            name="people-outline"
            size={28}
            color={challengeLimitReached ? disabledColor : challengeColor}
          />
        </View>
        <View style={styles.typeTextContainer}>
          <View style={styles.titleRow}>
            <Text
              style={[styles.typeCardTitle, challengeLimitReached && styles.typeCardTitleDisabled]}
            >
              {t("goals.create.as_challenge")}
            </Text>
            {challengeFeatureDisabled && (
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>PRO</Text>
              </View>
            )}
          </View>
          <Text style={styles.typeCardDescription}>
            {challengeLimitReached
              ? t("goals.create.challenge_limit_reached") || "Challenge limit reached"
              : t("goals.create.as_challenge_desc")}
          </Text>
        </View>
        {challengeLimitReached ? (
          <Ionicons name="lock-closed" size={20} color={disabledColor} />
        ) : (
          <Ionicons name="chevron-forward" size={24} color={colors.text.tertiary} />
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <BackButton
        onPress={handleBack}
        title={
          createType === "challenge"
            ? t("challenges.create_title") || "Create Challenge"
            : t("goals.create.title")
        }
        titleCentered={true}
      />

      {/* Segmented Control */}
      <View style={styles.segmentedControlContainer}>
        <SegmentedControl
          options={[t("goals.create.tabs.suggestions"), t("goals.create.tabs.custom")]}
          selectedIndex={activeTab === "suggestions" ? 0 : 1}
          onChange={handleTabChange}
        />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === "suggestions" ? (
          <AISuggestionsView
            onUseSuggestion={handleUseSuggestion}
            onUseAsChallenge={handleUseAsChallenge}
            onSwitchToCustom={() => setActiveTab("custom")}
          />
        ) : createType === null ? (
          // Show type selector first
          renderTypeSelector()
        ) : createType === "goal" ? (
          <CustomGoalForm
            key={selectedSuggestion?.id || "empty"}
            initialData={selectedSuggestion}
          />
        ) : (
          <ChallengeForm
            initialData={
              selectedSuggestion
                ? {
                    title: selectedSuggestion.title,
                    description: selectedSuggestion.description,
                    category: selectedSuggestion.category,
                    frequency: selectedSuggestion.frequency as "daily" | "weekly",
                    target_days: selectedSuggestion.target_days,
                    days_of_week: selectedSuggestion.days_of_week,
                    reminder_times: selectedSuggestion.reminder_times
                  }
                : undefined
            }
          />
        )}
      </View>

      {/* Upgrade Prompt for goal limit */}
      <UpgradePrompt
        visible={showUpgradePrompt}
        onClose={handleUpgradePromptClose}
        onUpgrade={handleUpgrade}
        type="goal_limit"
      />

      {/* Subscription Screen */}
      <SubscriptionScreen
        visible={showSubscriptionScreen}
        onClose={() => setShowSubscriptionScreen(false)}
      />
    </View>
  );
}

const makeCreateGoalScreenStyles = (tokens: any, colors: any, brand: any) => {
  return {
    container: {
      flex: 1,
      backgroundColor: colors.bg.canvas
    },
    segmentedControlContainer: {
      paddingHorizontal: toRN(tokens.spacing[6]),
      paddingTop: toRN(tokens.spacing[3]),
      paddingBottom: toRN(tokens.spacing[3]),
      backgroundColor: colors.bg.canvas,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.default
    },
    content: {
      flex: 1
    },
    // Type selector styles
    typeSelectorContainer: {
      flex: 1,
      paddingHorizontal: toRN(tokens.spacing[6]),
      paddingTop: toRN(tokens.spacing[8])
    },
    typeSelectorTitle: {
      fontSize: toRN(tokens.typography.fontSize.xl),
      fontWeight: tokens.typography.fontWeight.bold,
      color: colors.text.primary,
      fontFamily: fontFamily.groteskBold,
      marginBottom: toRN(tokens.spacing[6]),
      textAlign: "center" as const
    },
    typeCard: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      padding: toRN(tokens.spacing[5]),
      borderRadius: toRN(tokens.borderRadius.xl),
      borderWidth: 2,
      borderColor: colors.border.default,
      backgroundColor: colors.bg.surface,
      marginBottom: toRN(tokens.spacing[4])
    },
    typeIconContainer: {
      width: toRN(56),
      height: toRN(56),
      borderRadius: toRN(tokens.borderRadius.lg),
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginRight: toRN(tokens.spacing[4])
    },
    typeTextContainer: {
      flex: 1
    },
    typeCardTitle: {
      fontSize: toRN(tokens.typography.fontSize.lg),
      fontWeight: tokens.typography.fontWeight.semibold,
      color: colors.text.primary,
      fontFamily: fontFamily.groteskSemiBold,
      marginBottom: toRN(tokens.spacing[1])
    },
    typeCardTitleDisabled: {
      color: colors.text.tertiary
    },
    typeCardDescription: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.text.secondary,
      fontFamily: fontFamily.groteskRegular
    },
    typeCardDisabled: {
      opacity: 0.7,
      borderColor: colors.border.muted || colors.border.default
    },
    titleRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      marginBottom: toRN(tokens.spacing[1])
    },
    proBadge: {
      backgroundColor: brand.gradient?.start || "#8B5CF6",
      paddingHorizontal: toRN(tokens.spacing[2]),
      paddingVertical: toRN(2),
      borderRadius: toRN(tokens.borderRadius.sm),
      marginLeft: toRN(tokens.spacing[2])
    },
    proBadgeText: {
      fontSize: toRN(tokens.typography.fontSize.xs),
      fontFamily: fontFamily.bold,
      color: "#FFFFFF",
      textTransform: "uppercase" as const
    }
  };
};
