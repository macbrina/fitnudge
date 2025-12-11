import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "@/lib/i18n";
import { useRouter } from "expo-router";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { Ionicons } from "@expo/vector-icons";
import { useGoals } from "@/hooks/api/useGoals";
import { GoalCard } from "@/screens/tabs/home/components/GoalCard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Tabs, TabItem } from "@/components/ui/Tabs";
import { SearchBar } from "@/components/ui/SearchBar";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/screens/tabs/home/components/EmptyState";
import { SkeletonBox, SkeletonCard } from "@/components/ui/SkeletonBox";
import { MOBILE_ROUTES } from "@/lib/routes";
import { Goal } from "@/services/api/goals";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { ShareGoalModal } from "@/components/goals/ShareGoalModal";
import { ShareAsChallengeModal } from "@/components/goals/ShareAsChallengeModal";
import { socialService } from "@/services/api/social";
import { useShareGoalAsChallenge } from "@/hooks/api/useChallenges";

// Extend Goal type to include optional fields used in GoalCard
type GoalWithStreak = Goal & {
  current_streak?: number;
  converted_to_challenge_id?: string;
  archived_reason?: string | null;
  is_group_goal?: boolean;
  group_goal_role?: "owner" | "admin" | "member";
  completed_checkins?: number;
};

type StatusFilter = "all" | "active" | "archived";
type GoalTypeFilter = "all" | "habits" | "challenges";
type SortOption =
  | "recent"
  | "oldest"
  | "alphabetical-asc"
  | "alphabetical-desc"
  | "streak-high"
  | "streak-low";

const CATEGORIES = [
  { id: "all", label: "All", emoji: "" },
  { id: "fitness", label: "Fitness", emoji: "💪" },
  { id: "nutrition", label: "Nutrition", emoji: "🥗" },
  { id: "wellness", label: "Wellness", emoji: "🧘" },
  { id: "mindfulness", label: "Mindfulness", emoji: "🧠" },
  { id: "sleep", label: "Sleep", emoji: "😴" },
  { id: "custom", label: "Custom", emoji: "🎯" },
] as const;

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "recent", label: "Recent" },
  { value: "oldest", label: "Oldest" },
  { value: "alphabetical-asc", label: "A-Z" },
  { value: "alphabetical-desc", label: "Z-A" },
  { value: "streak-high", label: "Streak (High)" },
  { value: "streak-low", label: "Streak (Low)" },
];

export default function GoalsScreen() {
  const styles = useStyles(makeGoalsScreenStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { showAlert, showToast } = useAlertModal();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [typeFilter, setTypeFilter] = useState<GoalTypeFilter>("all");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    "all",
  ]);
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Modal states
  const [shareGoalModalVisible, setShareGoalModalVisible] = useState(false);
  const [shareAsChallengeModalVisible, setShareAsChallengeModalVisible] =
    useState(false);
  const [selectedGoalForAction, setSelectedGoalForAction] =
    useState<GoalWithStreak | null>(null);

  const { data: goalsResponse, isLoading, refetch } = useGoals();
  const goals = (goalsResponse?.data || []) as GoalWithStreak[];
  const shareGoalAsChallenge = useShareGoalAsChallenge();

  // Count active goals for limit checking
  const activeGoalsCount = useMemo(
    () => goals.filter((g) => g.is_active).length,
    [goals]
  );

  // Filter and sort goals
  const filteredAndSortedGoals = useMemo(() => {
    let filtered = [...goals];

    // Status filter
    if (statusFilter === "active") {
      filtered = filtered.filter((g) => g.is_active === true);
    } else if (statusFilter === "archived") {
      filtered = filtered.filter((g) => g.is_active === false);
    }

    // Goal type filter
    if (typeFilter === "habits") {
      filtered = filtered.filter(
        (g) => !g.goal_type || g.goal_type === "habit"
      );
    } else if (typeFilter === "challenges") {
      filtered = filtered.filter(
        (g) =>
          g.goal_type === "time_challenge" || g.goal_type === "target_challenge"
      );
    }

    // Category filter
    if (selectedCategories.length > 0 && !selectedCategories.includes("all")) {
      filtered = filtered.filter((g) =>
        selectedCategories.includes(g.category)
      );
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (g) =>
          g.title.toLowerCase().includes(query) ||
          g.description?.toLowerCase().includes(query)
      );
    }

    // Sort
    switch (sortBy) {
      case "recent":
        filtered.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        break;
      case "oldest":
        filtered.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        break;
      case "alphabetical-asc":
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "alphabetical-desc":
        filtered.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case "streak-high":
        filtered.sort(
          (a, b) => (b.current_streak || 0) - (a.current_streak || 0)
        );
        break;
      case "streak-low":
        filtered.sort(
          (a, b) => (a.current_streak || 0) - (b.current_streak || 0)
        );
        break;
    }

    return filtered;
  }, [
    goals,
    statusFilter,
    typeFilter,
    selectedCategories,
    searchQuery,
    sortBy,
  ]);

  // Calculate stats
  const stats = useMemo(() => {
    const active = goals.filter((g) => g.is_active).length;
    const archived = goals.filter((g) => !g.is_active).length;
    const habits = goals.filter(
      (g) => !g.goal_type || g.goal_type === "habit"
    ).length;
    const challenges = goals.filter(
      (g) =>
        g.goal_type === "time_challenge" || g.goal_type === "target_challenge"
    ).length;
    return { active, archived, habits, challenges, total: goals.length };
  }, [goals]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch (error) {
      console.error("Error refreshing goals:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategories([categoryId]);
  };

  const handleGoalPress = (goalId: string) => {
    router.push(`${MOBILE_ROUTES.GOALS.DETAILS}?id=${goalId}`);
  };

  const handleCreateGoal = () => {
    router.push(MOBILE_ROUTES.GOALS.CREATE);
  };

  // === Menu Action Handlers ===

  // Share Goal (for habits)
  const handleShareGoal = useCallback((goal: GoalWithStreak) => {
    setSelectedGoalForAction(goal);
    setShareGoalModalVisible(true);
  }, []);

  // Share as Challenge (for time/target challenges)
  const handleShareAsChallenge = useCallback((goal: GoalWithStreak) => {
    setSelectedGoalForAction(goal);
    setShareAsChallengeModalVisible(true);
  }, []);

  // View Challenge (navigate to converted challenge)
  const handleViewChallenge = useCallback(
    (goal: GoalWithStreak) => {
      if (goal.converted_to_challenge_id) {
        router.push(
          MOBILE_ROUTES.CHALLENGES.DETAILS(goal.converted_to_challenge_id)
        );
      }
    },
    [router]
  );

  // Invite Members (group goals - TODO: Create dedicated screen)
  const handleInviteMembers = useCallback(
    async (goal: GoalWithStreak) => {
      // TODO: Navigate to invite members screen when implemented
      await showAlert({
        title: t("common.coming_soon") || "Coming Soon",
        message:
          t("goals.invite_members_coming_soon") ||
          "Invite members feature will be available soon.",
        variant: "info",
        confirmLabel: t("common.ok"),
      });
    },
    [showAlert, t]
  );

  // View Members (group goals - TODO: Create dedicated screen)
  const handleViewMembers = useCallback(
    async (goal: GoalWithStreak) => {
      // TODO: Navigate to view members screen when implemented
      await showAlert({
        title: t("common.coming_soon") || "Coming Soon",
        message:
          t("goals.view_members_coming_soon") ||
          "View members feature will be available soon.",
        variant: "info",
        confirmLabel: t("common.ok"),
      });
    },
    [showAlert, t]
  );

  // Leave Group (group goals - TODO: Implement API call)
  const handleLeaveGroup = useCallback(
    async (goal: GoalWithStreak) => {
      // TODO: Implement leave group functionality
      await showAlert({
        title: t("common.coming_soon") || "Coming Soon",
        message:
          t("goals.leave_group_coming_soon") ||
          "Leave group feature will be available soon.",
        variant: "info",
        confirmLabel: t("common.ok"),
      });
    },
    [showAlert, t]
  );

  // Search users for sharing
  const handleSearchUsers = useCallback(async (query: string) => {
    try {
      const response = await socialService.searchUsers(query);
      return response.data || [];
    } catch (error) {
      console.error("Error searching users:", error);
      return [];
    }
  }, []);

  // Share goal with user
  const handleShareGoalWithUser = useCallback(
    async (
      userId: string,
      permissionLevel: "view" | "comment" | "motivate"
    ) => {
      if (!selectedGoalForAction) return;
      // TODO: Implement goal sharing API
      console.log("Sharing goal with user:", {
        goalId: selectedGoalForAction.id,
        userId,
        permissionLevel,
      });
    },
    [selectedGoalForAction]
  );

  // Status options for SegmentedControl
  const statusOptions = [
    t("goals.all"),
    t("goals.active"),
    t("goals.archived") || "Archived",
  ];
  const statusIndex =
    statusFilter === "all" ? 0 : statusFilter === "active" ? 1 : 2;

  // Type filter options
  const typeOptions = [
    t("goals.all"),
    t("goals.habits") || "Habits",
    t("goals.challenges") || "Challenges",
  ];
  const typeIndex = typeFilter === "all" ? 0 : typeFilter === "habits" ? 1 : 2;

  // Category tabs configuration
  const categoryTabs: TabItem[] = CATEGORIES.map((cat) => ({
    id: cat.id,
    label: cat.emoji ? `${cat.emoji} ${cat.label}` : cat.label,
  }));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t("goals.title")}</Text>
          <Text style={styles.stats}>
            {stats.active} {t("goals.active")} • {stats.archived}{" "}
            {t("goals.archived") || "Archived"}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreateGoal}
        >
          <Ionicons
            name="add"
            size={toRN(tokens.typography.fontSize.xl)}
            color={colors.text.onPrimary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.text.tertiary}
            colors={[colors.text.tertiary]}
          />
        }
      >
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t("goals.search_placeholder")}
          />
        </View>

        {/* Status Segmented Control */}
        <View style={styles.tabsContainer}>
          <SegmentedControl
            options={statusOptions}
            selectedIndex={statusIndex}
            onChange={(index) => {
              const filterMap: StatusFilter[] = ["all", "active", "archived"];
              setStatusFilter(filterMap[index]);
            }}
          />
        </View>

        {/* Type Filter */}
        <View style={styles.typeFilterContainer}>
          <SegmentedControl
            options={typeOptions}
            selectedIndex={typeIndex}
            onChange={(index) => {
              const filterMap: GoalTypeFilter[] = [
                "all",
                "habits",
                "challenges",
              ];
              setTypeFilter(filterMap[index]);
            }}
          />
        </View>

        {/* Category Tabs */}
        <View style={styles.categoriesContainer}>
          <Tabs
            tabs={categoryTabs}
            selectedId={selectedCategories[0] || "all"}
            onChange={(id) => handleCategoryToggle(id)}
            variant="default"
            size="sm"
            scrollable={true}
          />
        </View>

        {/* Sort */}
        <View style={styles.sortContainer}>
          <TouchableOpacity
            style={styles.sortButton}
            onPress={() => setShowSortMenu(!showSortMenu)}
          >
            <Text style={styles.sortButtonText}>
              {t("goals.sort")}:{" "}
              {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
            </Text>
            <Ionicons
              name={showSortMenu ? "chevron-up" : "chevron-down"}
              size={toRN(tokens.typography.fontSize.base)}
              color={colors.text.secondary}
            />
          </TouchableOpacity>
        </View>

        {/* Sort Menu */}
        {showSortMenu && (
          <Card shadow="md" style={styles.sortMenu}>
            {SORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.sortMenuItem,
                  sortBy === option.value && styles.sortMenuItemSelected,
                ]}
                onPress={() => {
                  setSortBy(option.value);
                  setShowSortMenu(false);
                }}
              >
                <Text
                  style={[
                    styles.sortMenuItemText,
                    sortBy === option.value && styles.sortMenuItemTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
                {sortBy === option.value && (
                  <Ionicons
                    name="checkmark"
                    size={toRN(tokens.typography.fontSize.base)}
                    color={brandColors.primary}
                  />
                )}
              </TouchableOpacity>
            ))}
          </Card>
        )}

        {/* Goals List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            {[1, 2, 3].map((i) => (
              <SkeletonCard
                key={i}
                width="100%"
                height={120}
                padding={toRN(tokens.spacing[4])}
                style={{ marginBottom: toRN(tokens.spacing[3]) }}
              />
            ))}
          </View>
        ) : filteredAndSortedGoals.length === 0 ? (
          <Card shadow="md" style={styles.emptyCard}>
            <EmptyState
              icon="🎯"
              title={
                searchQuery || selectedCategories.length > 0
                  ? t("goals.no_results_title")
                  : t("goals.no_goals_title")
              }
              message={
                searchQuery || selectedCategories.length > 0
                  ? t("goals.no_results_message")
                  : t("goals.no_goals_message")
              }
            />
            {!searchQuery &&
              selectedCategories.includes("all") &&
              statusFilter === "all" && (
                <TouchableOpacity
                  style={styles.createButtonLarge}
                  onPress={handleCreateGoal}
                >
                  <Text style={styles.createButtonLargeText}>
                    {t("goals.create_first_goal")}
                  </Text>
                </TouchableOpacity>
              )}
          </Card>
        ) : (
          <View style={styles.goalsList}>
            {filteredAndSortedGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onPress={() => handleGoalPress(goal.id)}
                showMenu={true}
                activeGoalsCount={activeGoalsCount}
                onShareGoal={() => handleShareGoal(goal)}
                onShareAsChallenge={() => handleShareAsChallenge(goal)}
                onViewChallenge={() => handleViewChallenge(goal)}
                onInviteMembers={() => handleInviteMembers(goal)}
                onViewMembers={() => handleViewMembers(goal)}
                onLeaveGroup={() => handleLeaveGroup(goal)}
                style={styles.goalCard}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Share Goal Modal */}
      {selectedGoalForAction && (
        <ShareGoalModal
          visible={shareGoalModalVisible}
          goalId={selectedGoalForAction.id}
          goalTitle={selectedGoalForAction.title}
          onClose={() => {
            setShareGoalModalVisible(false);
            setSelectedGoalForAction(null);
          }}
          onShare={handleShareGoalWithUser}
          searchUsers={handleSearchUsers}
        />
      )}

      {/* Share as Challenge Modal */}
      {selectedGoalForAction && (
        <ShareAsChallengeModal
          visible={shareAsChallengeModalVisible}
          goal={selectedGoalForAction}
          onClose={() => {
            setShareAsChallengeModalVisible(false);
            setSelectedGoalForAction(null);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const makeGoalsScreenStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[4]),
    backgroundColor: colors.bg.canvas,
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize["3xl"]),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[1]),
  },
  stats: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
  },
  createButton: {
    backgroundColor: brand.primary,
    width: toRN(tokens.spacing[12]),
    height: toRN(tokens.spacing[12]),
    borderRadius: toRN(tokens.borderRadius.full),
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.shadow?.md || "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    shadowOpacity: 0.12,
    elevation: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: toRN(tokens.spacing[6]),
  },
  searchContainer: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[4]),
  },
  tabsContainer: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[3]),
  },
  typeFilterContainer: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[4]),
  },
  categoriesContainer: {
    marginBottom: toRN(tokens.spacing[4]),
  },
  sortContainer: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[4]),
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: toRN(tokens.spacing[2]),
  },
  sortButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
  },
  sortMenu: {
    marginHorizontal: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[4]),
    padding: toRN(tokens.spacing[2]),
  },
  sortMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.base),
  },
  sortMenuItemSelected: {
    backgroundColor: brand.primary + "10",
  },
  sortMenuItemText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.primary,
  },
  sortMenuItemTextSelected: {
    fontFamily: fontFamily.semiBold,
    color: brand.primary,
  },
  loadingContainer: {
    paddingHorizontal: toRN(tokens.spacing[4]),
  },
  goalsList: {
    paddingHorizontal: toRN(tokens.spacing[4]),
  },
  goalCard: {
    width: "100%",
    marginRight: 0,
    marginBottom: toRN(tokens.spacing[3]),
  },
  emptyCard: {
    marginHorizontal: toRN(tokens.spacing[4]),
    padding: toRN(tokens.spacing[6]),
    alignItems: "center",
  },
  createButtonLarge: {
    backgroundColor: brand.primary,
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[6]),
    borderRadius: toRN(tokens.borderRadius.full),
    marginTop: toRN(tokens.spacing[4]),
  },
  createButtonLargeText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.onPrimary,
  },
});
