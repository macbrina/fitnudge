import { ActionSheetOption } from "@/components/ui/ActionSheet";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ModalActionSheet } from "@/components/ui/ModalActionSheet";
import { SearchBar } from "@/components/ui/SearchBar";
import { SkeletonCard } from "@/components/ui/SkeletonBox";
import { TabItem, Tabs } from "@/components/ui/Tabs";
import { useAlertModal } from "@/contexts/AlertModalContext";
import {
  useBatchChallengePlanStatuses,
  useBatchPlanStatuses
} from "@/hooks/api/useActionablePlans";
import { useMyChallenges } from "@/hooks/api/useChallenges";
import { useGoals } from "@/hooks/api/useGoals";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { MOBILE_ROUTES } from "@/lib/routes";
import { toRN } from "@/lib/units";
import { ChallengeCard } from "@/screens/tabs/home/components/ChallengeCard";
import { EmptyState } from "@/screens/tabs/home/components/EmptyState";
import { GoalCard } from "@/screens/tabs/home/components/GoalCard";
import { Challenge } from "@/services/api/challenges";
import { Goal } from "@/services/api/goals";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";

// Extend Goal type to include optional fields used in GoalCard
type GoalWithStreak = Goal & {
  current_streak?: number;
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
  { id: "all", label: "All", icon: "apps-outline" as const },
  { id: "fitness", label: "Fitness", icon: "fitness-outline" as const },
  { id: "nutrition", label: "Nutrition", icon: "nutrition-outline" as const },
  { id: "wellness", label: "Wellness", icon: "leaf-outline" as const },
  { id: "mindfulness", label: "Mindfulness", icon: "flower-outline" as const },
  { id: "sleep", label: "Sleep", icon: "moon-outline" as const }
] as const;

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "recent", label: "Recent" },
  { value: "oldest", label: "Oldest" },
  { value: "alphabetical-asc", label: "A-Z" },
  { value: "alphabetical-desc", label: "Z-A" },
  { value: "streak-high", label: "Streak (High)" },
  { value: "streak-low", label: "Streak (Low)" }
];

export default function GoalsScreen() {
  const styles = useStyles(makeGoalsScreenStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [typeFilter, setTypeFilter] = useState<GoalTypeFilter>("all");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["all"]);
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [refreshing, setRefreshing] = useState(false);

  // Handle tab query param (e.g., from Social screen)
  useEffect(() => {
    if (params.tab === "challenges") {
      setStatusFilter("active");
      setTypeFilter("challenges");
    } else if (params.tab === "my_goals") {
      setStatusFilter("active");
      setTypeFilter("my_goals");
    } else if (params.tab === "archived") {
      setStatusFilter("archived");
      setTypeFilter("all");
    }
  }, [params.tab]);

  const {
    data: goalsResponse,
    isLoading: isLoadingGoals,
    refetch: refetchGoals,
    error: goalsError
  } = useGoals();
  const {
    data: challengesResponse,
    isLoading: isLoadingChallenges,
    refetch: refetchChallenges,
    error: challengesError
  } = useMyChallenges(); // Fetch challenges user has created or joined
  // Dedupe goals and challenges to prevent duplicate key errors
  // This can happen if realtime INSERT races with mutation optimistic update
  const goals = useMemo(() => {
    const data = (goalsResponse?.data || []) as GoalWithStreak[];
    const seen = new Set<string>();
    return data.filter((g) => {
      if (seen.has(g.id)) return false;
      seen.add(g.id);
      return true;
    });
  }, [goalsResponse?.data]);

  const challenges = useMemo(() => {
    const data = (challengesResponse?.data || []) as Challenge[];
    const seen = new Set<string>();
    return data.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }, [challengesResponse?.data]);

  // Get all goal IDs for batch plan status fetch
  // Filter out temp IDs from optimistic updates - they don't have plan status yet
  const goalIds = useMemo(
    () => goals.filter((g) => !g.id.startsWith("temp-")).map((g) => g.id),
    [goals]
  );

  // Get all challenge IDs for batch plan status fetch (only for participated challenges)
  // Filter out temp IDs from optimistic updates - they don't have plan status yet
  const participatedChallengeIds = useMemo(
    () =>
      challenges
        .filter((c) => (c.is_creator || c.is_participant) && !c.id.startsWith("temp-"))
        .map((c) => c.id),
    [challenges]
  );

  // Batch fetch all plan statuses at once (instead of each GoalCard fetching individually)
  const { planStatusMap, isLoading: isLoadingPlanStatuses } = useBatchPlanStatuses(goalIds);

  // Batch fetch challenge plan statuses
  const { planStatusMap: challengePlanStatusMap, isLoading: isLoadingChallengePlanStatuses } =
    useBatchChallengePlanStatuses(participatedChallengeIds);

  // Combined loading state
  // Only show loading skeleton on initial fetch (when we have no data yet)
  // Don't show loading for subsequent refetches to avoid flicker after optimistic updates
  // Plan status loading should not block the main list display - goals/challenges
  // can show immediately with a "generating" badge on their cards
  const hasNoGoalsData = !goalsResponse?.data;
  const hasNoChallengesData = !challengesResponse?.data;

  const isLoading =
    (isLoadingGoals && hasNoGoalsData) ||
    ((typeFilter === "all" || typeFilter === "challenges") &&
      isLoadingChallenges &&
      hasNoChallengesData);

  // Refetch both data sources
  const refetch = useCallback(async () => {
    await Promise.all([refetchGoals(), refetchChallenges()]);
  }, [refetchGoals, refetchChallenges]);

  // Count active goals for limit checking
  const activeGoalsCount = useMemo(
    () => goals.filter((g) => g.status === "active").length,
    [goals]
  );

  // Filter and sort challenges (separate from goals)
  const filteredAndSortedChallenges = useMemo(() => {
    let filteredChallenges = [...challenges];

    // Status filter for challenges
    if (statusFilter === "active") {
      filteredChallenges = filteredChallenges.filter(
        (c) => c.status === "active" || c.status === "upcoming"
      );
    } else if (statusFilter === "archived") {
      filteredChallenges = filteredChallenges.filter(
        (c) => c.status === "completed" || c.status === "cancelled"
      );
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filteredChallenges = filteredChallenges.filter(
        (c) => c.title.toLowerCase().includes(query) || c.description?.toLowerCase().includes(query)
      );
    }

    // Sort challenges
    switch (sortBy) {
      case "recent":
        filteredChallenges.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        break;
      case "oldest":
        filteredChallenges.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
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
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
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
      filtered = filtered.filter((g) => g.status === "active");
    } else if (statusFilter === "archived") {
      filtered = filtered.filter(
        (g) => g.status === "archived" || g.status === "paused" || g.status === "completed"
      );
    }

    // Category filter
    if (selectedCategories.length > 0 && !selectedCategories.includes("all")) {
      filtered = filtered.filter((g) => selectedCategories.includes(g.category));
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (g) => g.title.toLowerCase().includes(query) || g.description?.toLowerCase().includes(query)
      );
    }

    // Sort
    switch (sortBy) {
      case "recent":
        filtered.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        break;
      case "oldest":
        filtered.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        break;
      case "alphabetical-asc":
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "alphabetical-desc":
        filtered.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case "streak-high":
        filtered.sort((a, b) => (b.current_streak || 0) - (a.current_streak || 0));
        break;
      case "streak-low":
        filtered.sort((a, b) => (a.current_streak || 0) - (b.current_streak || 0));
        break;
    }

    return filtered;
  }, [goals, challenges, statusFilter, typeFilter, selectedCategories, searchQuery, sortBy]);

  // Combined list for "all" filter - merges goals and challenges
  const combinedList = useMemo((): CombinedListItem[] => {
    if (typeFilter !== "all") return [];

    // Create combined list
    const items: CombinedListItem[] = [
      ...filteredAndSortedGoals.map((g): CombinedListItem => ({ type: "goal", data: g })),
      ...filteredAndSortedChallenges.map((c): CombinedListItem => ({ type: "challenge", data: c }))
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
    const activeGoals = goals.filter((g) => g.status === "active").length;
    const archivedGoals = goals.filter((g) => g.status !== "active").length;
    const myGoals = goals.filter((g) => g.status === "active").length;

    // Challenges breakdown
    const activeChallenges = challenges.filter(
      (c) => c.status === "active" || c.status === "upcoming"
    ).length;
    const archivedChallenges = challenges.filter(
      (c) => c.status === "completed" || c.status === "cancelled"
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
      total: goals.length + challenges.length
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

  // Combined filter tabs (merges status + type into one clean row)
  // Memoized to ensure proper re-render when stats change
  const filterTabs: TabItem[] = useMemo(
    () => [
      {
        id: "active",
        label: t("goals.active") || "Active",
        badge: stats.active > 0 ? stats.active : undefined
      },
      { id: "my_goals", label: t("goals.my_goals") || "My Goals" },
      { id: "challenges", label: t("goals.challenges") || "Challenges" },
      {
        id: "archived",
        label: t("goals.archived") || "Archived",
        badge: stats.archived > 0 ? stats.archived : undefined
      }
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
    label: cat.label,
    icon: selectedCategories[0] === cat.id ? ("checkmark-circle" as const) : cat.icon,
    onPress: () => handleCategoryToggle(cat.id)
  }));

  // Sort options for ActionSheet
  const sortOptions: ActionSheetOption[] = SORT_OPTIONS.map((opt) => ({
    id: opt.value,
    label: opt.label,
    icon: sortBy === opt.value ? ("checkmark-circle" as const) : undefined,
    onPress: () => setSortBy(opt.value)
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
        <TouchableOpacity style={styles.createButton} onPress={handleCreateGoal}>
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
            style={[styles.filterChip, selectedCategories[0] !== "all" && styles.filterChipActive]}
            onPress={() => setShowCategorySheet(true)}
          >
            <Ionicons
              name="funnel-outline"
              size={14}
              color={selectedCategories[0] !== "all" ? brandColors.primary : colors.text.secondary}
            />
            <Text
              style={[
                styles.filterChipText,
                selectedCategories[0] !== "all" && styles.filterChipTextActive
              ]}
            >
              {selectedCategories[0] === "all"
                ? t("goals.category") || "Category"
                : CATEGORIES.find((c) => c.id === selectedCategories[0])?.label ||
                  selectedCategories[0]}
            </Text>
            <Ionicons
              name="chevron-down"
              size={12}
              color={selectedCategories[0] !== "all" ? brandColors.primary : colors.text.secondary}
            />
          </TouchableOpacity>

          {/* Sort Button */}
          <TouchableOpacity style={styles.sortButton} onPress={() => setShowSortSheet(true)}>
            <Ionicons name="swap-vertical-outline" size={14} color={colors.text.secondary} />
            <Text style={styles.sortButtonText}>
              {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
            </Text>
            <Ionicons name="chevron-down" size={12} color={colors.text.secondary} />
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
                icon="flag-outline"
                title={searchQuery ? t("goals.no_results_title") : t("goals.no_goals_title")}
                message={searchQuery ? t("goals.no_results_message") : t("goals.no_goals_message")}
              />
              {!searchQuery && (
                <Button
                  title={goals.length === 0 ? t("goals.create_first_goal") : t("goals.create_goal")}
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
                    style={styles.goalCard}
                  />
                ) : (
                  <ChallengeCard
                    key={`challenge-${item.data.id}`}
                    challenge={item.data}
                    planStatus={challengePlanStatusMap[item.data.id]}
                    onPress={() => handleChallengePress(item.data)}
                    showMenu={true}
                    activeChallengesCount={
                      challenges.filter((c) => c.status === "active" || c.status === "upcoming")
                        .length
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
                icon="trophy-outline"
                title={
                  searchQuery ? t("goals.no_results_title") : t("challenges.no_challenges_title")
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
                  planStatus={challengePlanStatusMap[challenge.id]}
                  onPress={() => handleChallengePress(challenge)}
                  showMenu={true}
                  activeChallengesCount={
                    challenges.filter((c) => c.status === "active" || c.status === "upcoming")
                      .length
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
              icon="flag-outline"
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
            {!searchQuery && selectedCategories.includes("all") && statusFilter !== "archived" && (
              <Button
                title={goals.length === 0 ? t("goals.create_first_goal") : t("goals.create_goal")}
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
                style={styles.goalCard}
              />
            ))}
          </View>
        )}
      </ScrollView>

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
    backgroundColor: colors.bg.canvas
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[4]),
    backgroundColor: colors.bg.canvas,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[1])
  },
  stats: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary
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
    elevation: 4
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: toRN(tokens.spacing[6])
  },
  searchContainer: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[4])
  },
  tabsContainer: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[3])
  },
  filterRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[3]),
    gap: toRN(tokens.spacing[3])
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
    borderColor: colors.border.default
  },
  filterChipActive: {
    backgroundColor: brand.primary + "10",
    borderColor: brand.primary
  },
  filterChipText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary
  },
  filterChipTextActive: {
    color: brand.primary
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
    borderColor: colors.border.default
  },
  sortButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary
  },
  loadingContainer: {
    paddingHorizontal: toRN(tokens.spacing[4])
  },
  goalsList: {
    paddingHorizontal: toRN(tokens.spacing[4])
  },
  goalCard: {
    width: "100%",
    marginRight: 0,
    marginBottom: toRN(tokens.spacing[3])
  },
  emptyCard: {
    marginHorizontal: toRN(tokens.spacing[4]),
    padding: toRN(tokens.spacing[6]),
    alignItems: "center"
  }
});
