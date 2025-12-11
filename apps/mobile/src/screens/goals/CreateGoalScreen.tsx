import React, { useState, useEffect, useCallback } from "react";
import { View } from "react-native";
import { useTranslation } from "@/lib/i18n";
import { toRN } from "@/lib/units";
import { useStyles } from "@/themes/makeStyles";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens } from "@/themes/tokens";
import { useTheme } from "@/themes";
import { router, useLocalSearchParams } from "expo-router";
import { BackButton } from "@/components/ui/BackButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { CustomGoalForm } from "./components/CustomGoalForm";
import { AISuggestionsView } from "./components/AISuggestionsView";
import { SuggestedGoal } from "@/services/api/onboarding";
import { GoalType } from "@/services/api/goals";
import { UpgradePrompt } from "@/components/subscription";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { useActiveGoals } from "@/hooks/api/useGoals";
import SubscriptionScreen from "@/screens/onboarding/SubscriptionScreen";

type TabType = "suggestions" | "custom";

export default function CreateGoalScreen() {
  // Get goal type from navigation params (from GoalTypeSelectionScreen)
  const params = useLocalSearchParams<{
    goalType?: GoalType | "mixed";
    category?: string;
  }>();
  const goalType = params.goalType || "habit"; // Default to habit

  const [activeTab, setActiveTab] = useState<TabType>("suggestions");
  const [selectedSuggestion, setSelectedSuggestion] =
    useState<SuggestedGoal | null>(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [showSubscriptionScreen, setShowSubscriptionScreen] = useState(false);

  const { t } = useTranslation();
  const styles = useStyles(makeCreateGoalScreenStyles);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  // Check goal limits
  const { canCreateGoal, getPlan } = useSubscriptionStore();
  const { data: activeGoalsResponse } = useActiveGoals();
  const activeGoalCount = activeGoalsResponse?.data?.length || 0;
  const canCreate = canCreateGoal(activeGoalCount);
  const plan = getPlan();

  // Show upgrade prompt if user cannot create more goals
  useEffect(() => {
    if (!canCreate && plan === "free") {
      setShowUpgradePrompt(true);
    }
  }, [canCreate, plan]);

  // Handle upgrade button press
  const handleUpgrade = useCallback(() => {
    setShowUpgradePrompt(false);
    setShowSubscriptionScreen(true);
  }, []);

  // Handle upgrade prompt close - go back if they can't create
  const handleUpgradePromptClose = useCallback(() => {
    setShowUpgradePrompt(false);
    if (!canCreate) {
      router.back();
    }
  }, [canCreate]);

  const handleBack = () => {
    router.back();
  };

  const handleUseSuggestion = (goal: SuggestedGoal) => {
    // Set the selected suggestion and switch to custom tab
    // Enhance with goal type info
    const enhancedGoal = {
      ...goal,
      goal_type: (goal as any).goal_type || goalType,
      duration_days: (goal as any).duration_days,
      target_checkins: (goal as any).target_checkins,
    };
    setSelectedSuggestion(enhancedGoal);
    setActiveTab("custom");
  };

  const handleTabChange = (index: number) => {
    const newTab: TabType = index === 0 ? "suggestions" : "custom";
    setActiveTab(newTab);
    // Clear selected suggestion when switching away from custom tab
    if (newTab === "suggestions") {
      setSelectedSuggestion(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <BackButton
        onPress={handleBack}
        title={t("goals.create.title")}
        titleCentered={true}
      />

      {/* Segmented Control */}
      <View style={styles.segmentedControlContainer}>
        <SegmentedControl
          options={[
            t("goals.create.tabs.suggestions"),
            t("goals.create.tabs.custom"),
          ]}
          selectedIndex={activeTab === "suggestions" ? 0 : 1}
          onChange={handleTabChange}
        />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === "suggestions" ? (
          <AISuggestionsView
            onUseSuggestion={handleUseSuggestion}
            onSwitchToCustom={() => setActiveTab("custom")}
            goalType={goalType}
          />
        ) : (
          <CustomGoalForm
            key={selectedSuggestion?.id || "empty"}
            initialData={selectedSuggestion}
            goalType={goalType}
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
      backgroundColor: colors.bg.canvas,
    },
    segmentedControlContainer: {
      paddingHorizontal: toRN(tokens.spacing[6]),
      paddingTop: toRN(tokens.spacing[3]),
      paddingBottom: toRN(tokens.spacing[3]),
      backgroundColor: colors.bg.canvas,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.default,
    },
    content: {
      flex: 1,
    },
  };
};
