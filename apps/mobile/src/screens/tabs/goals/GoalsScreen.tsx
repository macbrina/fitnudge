import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useTranslation } from "@/lib/i18n";
import { useRouter } from "expo-router";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { Ionicons } from "@expo/vector-icons";
import { useGoals } from "@/hooks/api/useGoals";
import {
  useMyChallenges,
  useShareGoalAsChallenge,
} from "@/hooks/api/useChallenges";
import { GoalCard } from "@/screens/tabs/home/components/GoalCard";
import { ChallengeCard } from "@/screens/tabs/home/components/ChallengeCard";
import { Tabs, TabItem } from "@/components/ui/Tabs";
import { SearchBar } from "@/components/ui/SearchBar";
import { Card } from "@/components/ui/Card";
import { ModalActionSheet } from "@/components/ui/ModalActionSheet";
import { ActionSheetOption } from "@/components/ui/ActionSheet";
import { EmptyState } from "@/screens/tabs/home/components/EmptyState";
import { SkeletonCard } from "@/components/ui/SkeletonBox";
import { MOBILE_ROUTES } from "@/lib/routes";
import { Goal } from "@/services/api/goals";
import { Challenge } from "@/services/api/challenges";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { ShareGoalModal } from "@/components/goals/ShareGoalModal";
import { ShareAsChallengeModal } from "@/components/goals/ShareAsChallengeModal";
import { socialService } from "@/services/api/social";
import Button from "@/components/ui/Button";
import { useBatchPlanStatuses } from "@/hooks/api/useActionablePlans";

// Extend Goal type to include optional fields used in GoalCard
type GoalWithStreak = Goal & {
  current_streak?: number;
  converted_to_challenge_id?: string;
  archived_reason?: string | null;
  completed_checkins?: number;
  // Challenge-specific fields (when viewing challenges)
  is_challenge?: boolean;
  challenge_status?: "upcoming" | "active" | "completed" | "cancelled";
  participants_count?: number;
  my_rank?: number;
  my_progress?: number;
  start_date?: string;
  end_date?: string;
};

// Union type for combined list (goals + challenges)
type CombinedListItem =
  | { type: "goal"; data: GoalWithStreak }
  | { type: "challenge"; data: Challenge };

type StatusFilter = "all" | "active" | "archived";
type GoalTypeFilter = "all" | "my_goals" | "challenges";
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
  const [refreshing, setRefreshing] = useState(false);

  // Modal states
  const [shareGoalModalVisible, setShareGoalModalVisible] = useState(false);
  const [shareAsChallengeModalVisible, setShareAsChallengeModalVisible] =
    useState(false);
  const [selectedGoalForAction, setSelectedGoalForAction] =
    useState<GoalWithStreak | null>(null);

  const {
    data: goalsResponse,
    isLoading: isLoadingGoals,
    refetch: refetchGoals,
    error: goalsError,
  } = useGoals();
  const {
    data: challengesResponse,
    isLoading: isLoadingChallenges,
    refetch: refetchChallenges,
    error: challengesError,
  } = useMyChallenges(); // Fetch challenges user has created or joined
  const goals = (goalsResponse?.data || []) as GoalWithStreak[];
  const challenges = (challengesResponse?.data || []) as Challenge[];
  const shareGoalAsChallenge = useShareGoalAsChallenge();

  // Get all goal IDs for batch plan status fetch
  const goalIds = useMemo(() => goals.map((g) => g.id), [goals]);

  // Batch fetch all plan statuses at once (instead of each GoalCard fetching individually)
  const { planStatusMap, isLoading: isLoadingPlanStatuses } =
    useBatchPlanStatuses(goalIds);

  // Combined loading state
  // When viewing "all" (Active tab) or "challenges", we need to wait for challenges too
  // Also wait for plan statuses when viewing goals
  const isLoading =
    isLoadingGoals ||
    ((typeFilter === "all" || typeFilter === "challenges") &&
      isLoadingChallenges) ||
    ((typeFilter === "all" || typeFilter === "my_goals") &&
      goals.length > 0 &&
      isLoadingPlanStatuses);

  // Refetch both data sources
  const refetch = useCallback(async () => {
    await Promise.all([refetchGoals(), refetchChallenges()]);
  }, [refetchGoals, refetchChallenges]);

  // Count active goals for limit checking
  const activeGoalsCount = useMemo(
    () => goals.filter((g) => g.is_active).length,
    [goals]
  );

  // Filter and sort challenges (separate from goals)
  const filteredAndSortedChallenges = useMemo(() => {
    let filteredChallenges = [...challenges];

    // Status filter for challenges
    if (statusFilter === "active") {
      filteredChallenges = filteredChallenges.filter(
        (c) =>
          c.status === "active" ||
          c.status === "upcoming" ||
          c.is_active === true
      );
    } else if (statusFilter === "archived") {
      filteredChallenges = filteredChallenges.filter(
        (c) =>
          c.status === "completed" ||
          c.status === "cancelled" ||
          c.is_active === false
      );
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filteredChallenges = filteredChallenges.filter(
        (c) =>
          c.title.toLowerCase().includes(query) ||
          c.description?.toLowerCase().includes(query)
      );
    }

    // Sort challenges
    switch (sortBy) {
      case "recent":
        filteredChallenges.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        break;
      case "oldest":
        filteredChallenges.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        break;
      case "alphabetical-asc":
        filteredChallenges.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "alphabetical-desc":
        filteredChallenges.sort((a, b) => b.title.localeCompare(a.title));
        break;
      default:
        filteredChallenges.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }

    return filteredChallenges;
  }, [challenges, statusFilter, searchQuery, sortBy]);

  // Filter and sort goals
  const filteredAndSortedGoals = useMemo(() => {
    // For goals (my_goals, all)
    let filtered = [...goals];

    // Status filter
    if (statusFilter === "active") {
      filtered = filtered.filter((g) => g.is_active === true);
    } else if (statusFilter === "archived") {
      filtered = filtered.filter((g) => g.is_active === false);
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
    challenges,
    statusFilter,
    typeFilter,
    selectedCategories,
    searchQuery,
    sortBy,
  ]);

  // Combined list for "all" filter - merges goals and challenges
  const combinedList = useMemo((): CombinedListItem[] => {
    if (typeFilter !== "all") return [];

    // Create combined list
    const items: CombinedListItem[] = [
      ...filteredAndSortedGoals.map(
        (g): CombinedListItem => ({ type: "goal", data: g })
      ),
      ...filteredAndSortedChallenges.map(
        (c): CombinedListItem => ({ type: "challenge", data: c })
      ),
    ];

    // Sort combined list by created_at (most recent first)
    items.sort((a, b) => {
      const dateA = new Date(a.data.created_at).getTime();
      const dateB = new Date(b.data.created_at).getTime();
      return sortBy === "oldest" ? dateA - dateB : dateB - dateA;
    });

    return items;
  }, [typeFilter, filteredAndSortedGoals, filteredAndSortedChallenges, sortBy]);

  // Calculate stats
  const stats = useMemo(() => {
    // Goals breakdown
    const activeGoals = goals.filter((g) => g.is_active).length;
    const archivedGoals = goals.filter((g) => !g.is_active).length;
    const myGoals = goals.filter((g) => g.is_active).length;

    // Challenges breakdown
    const activeChallenges = challenges.filter(
      (c) =>
        c.status === "active" || c.status === "upcoming" || c.is_active === true
    ).length;
    const archivedChallenges = challenges.filter(
      (c) =>
        c.status === "completed" ||
        c.status === "cancelled" ||
        c.is_active === false
    ).length;

    // Combined counts (goals + challenges)
    const totalActive = activeGoals + activeChallenges;
    const totalArchived = archivedGoals + archivedChallenges;

    return {
      active: totalActive,
      archived: totalArchived,
      activeGoals,
      archivedGoals,
      myGoals,
      challenges: challenges.length,
      activeChallenges,
      archivedChallenges,
      total: goals.length + challenges.length,
    };
  }, [goals, challenges]);

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

  // Navigate to the correct screen based on item type
  const handleGoalPress = (goal: GoalWithStreak) => {
    router.push(`${MOBILE_ROUTES.GOALS.DETAILS}?id=${goal.id}`);
  };

  const handleChallengePress = (challenge: Challenge) => {
    router.push(MOBILE_ROUTES.CHALLENGES.DETAILS(challenge.id));
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

  // Combined filter tabs (merges status + type into one clean row)
  // Memoized to ensure proper re-render when stats change
  const filterTabs: TabItem[] = useMemo(
    () => [
      {
        id: "active",
        label: t("goals.active") || "Active",
        badge: stats.active > 0 ? stats.active : undefined,
      },
      { id: "my_goals", label: t("goals.my_goals") || "My Goals" },
      { id: "challenges", label: t("goals.challenges") || "Challenges" },
      {
        id: "archived",
        label: t("goals.archived") || "Archived",
        badge: stats.archived > 0 ? stats.archived : undefined,
      },
    ],
    [stats.active, stats.archived, t]
  );

  // Active filter state (combined status + type)
  const activeFilterId =
    statusFilter === "archived"
      ? "archived"
      : typeFilter === "my_goals"
        ? "my_goals"
        : typeFilter === "challenges"
          ? "challenges"
          : "active";

  const handleFilterChange = (id: string) => {
    if (id === "archived") {
      setStatusFilter("archived");
      setTypeFilter("all");
    } else if (id === "my_goals") {
      setStatusFilter("active");
      setTypeFilter("my_goals");
    } else if (id === "challenges") {
      setStatusFilter("active");
      setTypeFilter("challenges");
    } else {
      setStatusFilter("active");
      setTypeFilter("all");
    }
  };

  // ActionSheet states
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [showSortSheet, setShowSortSheet] = useState(false);

  // Category options for ActionSheet
  const categoryOptions: ActionSheetOption[] = CATEGORIES.map((cat) => ({
    id: cat.id,
    label: cat.emoji ? `${cat.emoji} ${cat.label}` : cat.label,
    icon:
      selectedCategories[0] === cat.id
        ? ("checkmark-circle" as const)
        : undefined,
    onPress: () => handleCategoryToggle(cat.id),
  }));

  // Sort options for ActionSheet
  const sortOptions: ActionSheetOption[] = SORT_OPTIONS.map((opt) => ({
    id: opt.value,
    label: opt.label,
    icon: sortBy === opt.value ? ("checkmark-circle" as const) : undefined,
    onPress: () => setSortBy(opt.value),
  }));

  return (
    <View style={styles.container}>
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

        {/* Primary Filter Tabs */}
        <View style={styles.tabsContainer}>
          <Tabs
            tabs={filterTabs}
            selectedId={activeFilterId}
            onChange={handleFilterChange}
            variant="underline"
            size="md"
            scrollable
          />
        </View>

        {/* Sort & Filter Row */}
        <View style={styles.filterRow}>
          {/* Category Filter Chip */}
          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedCategories[0] !== "all" && styles.filterChipActive,
            ]}
            onPress={() => setShowCategorySheet(true)}
          >
            <Ionicons
              name="funnel-outline"
              size={14}
              color={
                selectedCategories[0] !== "all"
                  ? brandColors.primary
                  : colors.text.secondary
              }
            />
            <Text
              style={[
                styles.filterChipText,
                selectedCategories[0] !== "all" && styles.filterChipTextActive,
              ]}
            >
              {selectedCategories[0] === "all"
                ? t("goals.category") || "Category"
                : CATEGORIES.find((c) => c.id === selectedCategories[0])
                    ?.label || selectedCategories[0]}
            </Text>
            <Ionicons
              name="chevron-down"
              size={12}
              color={
                selectedCategories[0] !== "all"
                  ? brandColors.primary
                  : colors.text.secondary
              }
            />
          </TouchableOpacity>

          {/* Sort Button */}
          <TouchableOpacity
            style={styles.sortButton}
            onPress={() => setShowSortSheet(true)}
          >
            <Ionicons
              name="swap-vertical-outline"
              size={14}
              color={colors.text.secondary}
            />
            <Text style={styles.sortButtonText}>
              {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
            </Text>
            <Ionicons
              name="chevron-down"
              size={12}
              color={colors.text.secondary}
            />
          </TouchableOpacity>
        </View>

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
        ) : typeFilter === "all" ? (
          // Render Combined List (Goals + Challenges)
          combinedList.length === 0 ? (
            <Card shadow="md" style={styles.emptyCard}>
              <EmptyState
                icon="🎯"
                title={
                  searchQuery
                    ? t("goals.no_results_title")
                    : t("goals.no_goals_title")
                }
                message={
                  searchQuery
                    ? t("goals.no_results_message")
                    : t("goals.no_goals_message")
                }
              />
              {!searchQuery && (
                <Button
                  title={t("goals.create_first_goal")}
                  onPress={handleCreateGoal}
                  variant="primary"
                  borderRadius="full"
                />
              )}
            </Card>
          ) : (
            <View style={styles.goalsList}>
              {combinedList.map((item) =>
                item.type === "goal" ? (
                  <GoalCard
                    key={`goal-${item.data.id}`}
                    goal={item.data}
                    planStatus={planStatusMap[item.data.id]}
                    onPress={() => handleGoalPress(item.data)}
                    showMenu={true}
                    activeGoalsCount={activeGoalsCount}
                    onShareGoal={() => handleShareGoal(item.data)}
                    onShareAsChallenge={() => handleShareAsChallenge(item.data)}
                    onViewChallenge={() => handleViewChallenge(item.data)}
                    onInviteMembers={() => handleInviteMembers(item.data)}
                    onViewMembers={() => handleViewMembers(item.data)}
                    onLeaveGroup={() => handleLeaveGroup(item.data)}
                    style={styles.goalCard}
                  />
                ) : (
                  <ChallengeCard
                    key={`challenge-${item.data.id}`}
                    challenge={item.data}
                    onPress={() => handleChallengePress(item.data)}
                    showMenu={true}
                    activeChallengesCount={
                      challenges.filter(
                        (c) => c.status === "active" || c.status === "upcoming"
                      ).length
                    }
                    style={styles.goalCard}
                  />
                )
              )}
            </View>
          )
        ) : typeFilter === "challenges" ? (
          // Render Challenges only
          filteredAndSortedChallenges.length === 0 ? (
            <Card shadow="md" style={styles.emptyCard}>
              <EmptyState
                icon="🏆"
                title={
                  searchQuery
                    ? t("goals.no_results_title")
                    : t("challenges.no_challenges_title")
                }
                message={
                  searchQuery
                    ? t("goals.no_results_message")
                    : t("challenges.no_challenges_description")
                }
              />
              {!searchQuery && (
                <Button
                  title={t("social.create_challenge")}
                  onPress={handleCreateGoal}
                  variant="primary"
                  borderRadius="full"
                />
              )}
            </Card>
          ) : (
            <View style={styles.goalsList}>
              {filteredAndSortedChallenges.map((challenge) => (
                <ChallengeCard
                  key={challenge.id}
                  challenge={challenge}
                  onPress={() => handleChallengePress(challenge)}
                  showMenu={true}
                  activeChallengesCount={
                    challenges.filter(
                      (c) => c.status === "active" || c.status === "upcoming"
                    ).length
                  }
                  style={styles.goalCard}
                />
              ))}
            </View>
          )
        ) : filteredAndSortedGoals.length === 0 ? (
          // Render Goals empty state
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
              statusFilter !== "archived" && (
                <Button
                  title={t("goals.create_first_goal")}
                  onPress={handleCreateGoal}
                  variant="primary"
                  borderRadius="full"
                />
              )}
          </Card>
        ) : (
          // Render Goals
          <View style={styles.goalsList}>
            {filteredAndSortedGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                planStatus={planStatusMap[goal.id]}
                onPress={() => handleGoalPress(goal)}
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

      {/* Category ActionSheet */}
      <ModalActionSheet
        visible={showCategorySheet}
        title={t("goals.select_category") || "Select Category"}
        options={categoryOptions}
        onClose={() => setShowCategorySheet(false)}
      />

      {/* Sort ActionSheet */}
      <ModalActionSheet
        visible={showSortSheet}
        title={t("goals.sort_by") || "Sort By"}
        options={sortOptions}
        onClose={() => setShowSortSheet(false)}
      />
    </View>
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
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
  filterRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[3]),
    gap: toRN(tokens.spacing[3]),
  },
  filterChip: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1.5]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[2]),
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.full),
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  filterChipActive: {
    backgroundColor: brand.primary + "10",
    borderColor: brand.primary,
  },
  filterChipText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
  },
  filterChipTextActive: {
    color: brand.primary,
  },
  sortButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1.5]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[2]),
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.full),
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  sortButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
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
});
