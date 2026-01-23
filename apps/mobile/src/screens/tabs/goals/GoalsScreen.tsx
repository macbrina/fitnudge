import React, { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";

import Button from "@/components/ui/Button";
import { SkeletonCard } from "@/components/ui/SkeletonBox";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useAllGoals } from "@/hooks/api/useGoals";
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

type TabType = "active" | "archived";

export default function GoalsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { brandColors, colors } = useTheme();
  const tabBarInsets = useTabBarInsets();

  const [activeTab, setActiveTab] = useState<TabType>("active");
  const [isRefreshing, setIsRefreshing] = useState(false);
  // AI Coach modal - for goal-specific conversations
  const { openModal: openAICoach } = useAICoachStore();

  // Fetch all goals (active + archived)
  const { data: goalsData, isLoading: goalsLoading, refetch: refetchGoals } = useAllGoals();

  const goals: Goal[] = useMemo(() => {
    return goalsData?.data || [];
  }, [goalsData]);

  // Filter goals by status
  const activeGoals = useMemo(() => {
    return goals.filter((g) => g.status === "active");
  }, [goals]);

  const archivedGoals = useMemo(() => {
    return goals.filter((g) => g.status === "archived");
  }, [goals]);

  const displayedGoals = activeTab === "active" ? activeGoals : archivedGoals;

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
    `${t("goals.tabs.archived")} (${archivedGoals.length})`
  ];
  const selectedIndex = activeTab === "active" ? 0 : 1;

  // Loading state
  if (goalsLoading && !goals.length) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t("goals.screen_title")}</Text>
        </View>
        <View style={styles.content}>
          <SkeletonCard height={120} style={{ marginBottom: 12 }} />
          <SkeletonCard height={120} style={{ marginBottom: 12 }} />
          <SkeletonCard height={120} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t("goals.screen_title")}</Text>
        <TouchableOpacity onPress={handleCreateGoal} style={styles.addButton}>
          <Plus size={24} color={brandColors.onPrimary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <SegmentedControl
          options={tabOptions}
          selectedIndex={selectedIndex}
          onChange={(index) => setActiveTab(index === 0 ? "active" : "archived")}
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
              icon={activeTab === "active" ? "flag-outline" : "archive-outline"}
              title={
                activeTab === "active"
                  ? t("goals.empty.active_title")
                  : t("goals.empty.archived_title")
              }
              message={
                activeTab === "active"
                  ? t("goals.empty.active_description")
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
