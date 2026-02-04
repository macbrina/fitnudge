import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Plus } from "lucide-react-native";

import Button from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { GoalsScreenSkeleton } from "@/screens/tabs/goals/GoalsScreenSkeleton";
import { useAllGoals, useArchivedGoals, useCompletedGoals } from "@/hooks/api/useGoals";
import { useTabBarInsets } from "@/hooks/useTabBarInsets";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { MOBILE_ROUTES } from "@/lib/routes";
import { toRN } from "@/lib/units";
import { EmptyState } from "@/screens/tabs/home/components/EmptyState";
import { GoalCard } from "@/screens/tabs/home/components/GoalCard";
import { Goal } from "@/services/api/goals";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import useAICoachStore from "@/stores/aiCoachStore";

type TabType = "active" | "completed" | "archived";

export default function GoalsScreen() {
  const router = useRouter();
  const { status } = useLocalSearchParams<{ status?: string }>();
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { brandColors, colors } = useTheme();
  const tabBarInsets = useTabBarInsets();

  const [activeTab, setActiveTab] = useState<TabType>("active");
  const [isRefreshing, setIsRefreshing] = useState(false);
  // AI Coach modal - for goal-specific conversations
  const { openModal: openAICoach } = useAICoachStore();

  // Fetch all goals (active + archived + completed)
  const { data: goalsData, isLoading: goalsLoading, refetch: refetchGoals } = useAllGoals();

  const goals: Goal[] = useMemo(() => {
    return goalsData?.data || [];
  }, [goalsData]);

  // Filter goals by status
  const activeGoals = useMemo(() => {
    return goals.filter((g) => g.status === "active");
  }, [goals]);

  const completedGoals = useMemo(() => {
    return goals.filter((g) => g.status === "completed");
  }, [goals]);

  const archivedGoals = useMemo(() => {
    return goals.filter((g) => g.status === "archived");
  }, [goals]);

  const displayedGoals =
    activeTab === "active"
      ? activeGoals
      : activeTab === "completed"
        ? completedGoals
        : archivedGoals;

  useEffect(() => {
    if (status === "active" || status === "completed" || status === "archived") {
      setActiveTab(status);
    } else if (status) {
      setActiveTab("active");
    }
  }, [status]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetchGoals();
    setIsRefreshing(false);
  }, [refetchGoals]);

  // Handle goal press
  const handleGoalPress = useCallback(
    (goal: Goal) => {
      router.push({
        pathname: MOBILE_ROUTES.GOALS.DETAILS,
        params: { id: goal.id }
      });
    },
    [router]
  );

  // Open AI Coach for a specific goal
  const handleTalkToBuddy = useCallback(
    (goalId: string) => {
      openAICoach(goalId);
    },
    [openAICoach]
  );

  // Handle create goal
  const handleCreateGoal = useCallback(() => {
    router.push(MOBILE_ROUTES.GOALS.CREATE);
  }, [router]);

  // Tab options for segmented control
  const tabOptions = [
    `${t("goals.tabs.active")} (${activeGoals.length})`,
    `${t("goals.tabs.completed")} (${completedGoals.length})`,
    `${t("goals.tabs.archived")} (${archivedGoals.length})`
  ];
  const selectedIndex = activeTab === "active" ? 0 : activeTab === "completed" ? 1 : 2;

  // Loading state
  if (goalsLoading && !goals.length) {
    return <GoalsScreenSkeleton />;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t("goals.screen_title")}</Text>
        <TouchableOpacity
          onPress={handleCreateGoal}
          style={styles.addButton}
          accessibilityLabel={t("common.add")}
          accessibilityRole="button"
        >
          <Plus size={24} color={brandColors.onPrimary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <SegmentedControl
          options={tabOptions}
          selectedIndex={selectedIndex}
          onChange={(index) =>
            setActiveTab(index === 0 ? "active" : index === 1 ? "completed" : "archived")
          }
        />
      </View>

      {/* Goals List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarInsets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={brandColors.primary}
          />
        }
      >
        {displayedGoals.length === 0 ? (
          <View style={styles.emptyContainer}>
            <EmptyState
              icon={
                activeTab === "active"
                  ? "flag-outline"
                  : activeTab === "completed"
                    ? "checkmark-circle-outline"
                    : "archive-outline"
              }
              title={
                activeTab === "active"
                  ? t("goals.empty.active_title")
                  : activeTab === "completed"
                    ? t("goals.empty.completed_title")
                    : t("goals.empty.archived_title")
              }
              message={
                activeTab === "active"
                  ? t("goals.empty.active_description")
                  : activeTab === "completed"
                    ? t("goals.empty.completed_description")
                    : t("goals.empty.archived_description")
              }
            />
            {activeTab === "active" && (
              <Button
                onPress={handleCreateGoal}
                title={t("goals.empty.create_goal")}
                variant="primary"
                size="md"
              />
            )}
          </View>
        ) : (
          displayedGoals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onPress={() => handleGoalPress(goal)}
              onTalkToBuddy={() => handleTalkToBuddy(goal.id)}
              style={{ marginBottom: toRN(tokens.spacing[3]) }}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  header: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingTop: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[2]),
    marginBottom: toRN(tokens.spacing[4]),
    borderBottomWidth: 2,
    borderBottomColor: colors.border.subtle
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.bold,
    color: colors.text.primary
  },
  addButton: {
    width: toRN(tokens.spacing[10]),
    height: toRN(tokens.spacing[10]),
    backgroundColor: brand.primary,
    borderRadius: toRN(tokens.borderRadius.full),
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.shadow.default,
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  tabsContainer: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[3])
  },
  content: {
    flex: 1,
    paddingHorizontal: toRN(tokens.spacing[4])
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: toRN(tokens.spacing[4])
  },
  emptyContainer: {
    alignItems: "center" as const,
    paddingTop: toRN(tokens.spacing[8])
  }
});
