import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "@/lib/i18n";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { MOBILE_ROUTES } from "@/lib/routes";
import { Card } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { ChallengeCard } from "@/screens/tabs/home/components/ChallengeCard";

// Hooks
import {
  usePublicChallenges,
  useMyChallenges,
} from "@/hooks/api/useChallenges";
import { Challenge } from "@/services/api/challenges";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import SubscriptionScreen from "@/screens/onboarding/SubscriptionScreen";

type SocialTab = "posts" | "challenges";

export default function SocialScreen() {
  const styles = useStyles(makeSocialStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { showConfirm } = useAlertModal();

  const [activeTab, setActiveTab] = useState<SocialTab>("posts");
  const [refreshing, setRefreshing] = useState(false);
  const [showSubscriptionScreen, setShowSubscriptionScreen] = useState(false);

  // Check if user can create challenges
  const { hasFeature, canParticipateInChallenge } = useSubscriptionStore();
  const hasChallengeFeature = hasFeature("challenge_create");

  // Data hooks
  const {
    data: publicChallengesData,
    isLoading: loadingChallenges,
    refetch: refetchChallenges,
  } = usePublicChallenges();
  const { data: myChallengesData, refetch: refetchMyChallenges } =
    useMyChallenges();

  const publicChallenges = publicChallengesData?.data || [];
  const myChallenges = myChallengesData?.data || [];

  // Get IDs of challenges user has joined
  const myChallengeIds = useMemo(
    () => new Set(myChallenges.map((c) => c.id)),
    [myChallenges],
  );

  // Filter for active/upcoming challenges user is participating in
  const activeMyChallenges = useMemo(
    () =>
      myChallenges.filter(
        (c) => c.status === "active" || c.status === "upcoming",
      ),
    [myChallenges],
  );

  // Count for limit checking
  const activeChallengeCount = activeMyChallenges.length;
  const canCreateNewChallenge = canParticipateInChallenge(activeChallengeCount);

  // Discovery: Show upcoming/active public challenges that user hasn't joined
  const discoverChallenges = useMemo(() => {
    return publicChallenges.filter(
      (c) =>
        (c.status === "upcoming" || c.status === "active") &&
        !myChallengeIds.has(c.id),
    );
  }, [publicChallenges, myChallengeIds]);

  // Refresh all data
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchChallenges(), refetchMyChallenges()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchChallenges, refetchMyChallenges]);

  // Handle create challenge
  const handleCreateChallenge = useCallback(async () => {
    if (!hasChallengeFeature) {
      setShowSubscriptionScreen(true);
      return;
    }

    if (!canCreateNewChallenge) {
      const confirmed = await showConfirm({
        title: t("challenges.limit_reached_title") || "Challenge Limit Reached",
        message:
          t("challenges.limit_reached_message") ||
          "You've reached your challenge limit. Upgrade your plan to create more challenges.",
        variant: "warning",
        confirmLabel: t("common.upgrade") || "Upgrade",
        cancelLabel: t("common.close") || "Close",
      });
      if (confirmed) {
        setShowSubscriptionScreen(true);
      }
      return;
    }

    router.push(MOBILE_ROUTES.CHALLENGES.CREATE);
  }, [hasChallengeFeature, canCreateNewChallenge, router, showConfirm, t]);

  // Tab configuration
  const tabs: { id: SocialTab; label: string }[] = [
    { id: "posts", label: t("social.tabs.posts") || "Posts" },
    { id: "challenges", label: t("social.tabs.challenges") || "Challenges" },
  ];

  // Header action based on active tab
  const renderHeaderAction = () => {
    if (activeTab === "posts") {
      return (
        <TouchableOpacity style={styles.headerAction} disabled>
          <Ionicons name="add" size={24} color={colors.text.tertiary} />
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={styles.headerAction}
        onPress={handleCreateChallenge}
      >
        <Ionicons name="add" size={24} color={brandColors.primary} />
      </TouchableOpacity>
    );
  };

  // Tab Bar
  const renderTabBar = () => (
    <View style={styles.tabBar}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={[styles.tab, activeTab === tab.id && styles.tabActive]}
          onPress={() => setActiveTab(tab.id)}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === tab.id && styles.tabTextActive,
            ]}
          >
            {tab.label}
          </Text>
          {activeTab === tab.id && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
      ))}
    </View>
  );

  // Posts Tab
  const renderPostsTab = () => (
    <View style={styles.tabContent}>
      {/* Coming Soon Card */}
      <Card style={styles.comingSoonCard}>
        <View style={styles.comingSoonIcon}>
          <Ionicons
            name="newspaper-outline"
            size={32}
            color={brandColors.primary}
          />
        </View>
        <Text style={styles.comingSoonTitle}>
          {t("social.posts_coming_soon_title") || "Social Feed Coming Soon"}
        </Text>
        <Text style={styles.comingSoonText}>
          {t("social.posts_coming_soon_desc") ||
            "Share your progress and connect with others on their fitness journey."}
        </Text>
      </Card>

      {/* AI Motivation Preview */}
      <Card style={styles.motivationCard}>
        <View style={styles.motivationHeader}>
          <View style={styles.motivationAvatar}>
            <Ionicons name="sparkles" size={20} color={brandColors.primary} />
          </View>
          <View style={styles.motivationMeta}>
            <Text style={styles.motivationAuthor}>
              {t("social.ai_motivation") || "FitNudge AI"}
            </Text>
            <Text style={styles.motivationTime}>
              {t("time.just_now") || "Just now"}
            </Text>
          </View>
        </View>
        <Text style={styles.motivationText}>
          {t("social.ai_motivation_placeholder") ||
            "Every step forward is progress. Keep pushing towards your goals!"}
        </Text>
        <View style={styles.postActions}>
          <TouchableOpacity style={styles.postAction}>
            <Ionicons
              name="heart-outline"
              size={22}
              color={colors.text.tertiary}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.postAction}>
            <Ionicons
              name="chatbubble-outline"
              size={20}
              color={colors.text.tertiary}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.postAction}>
            <Ionicons
              name="share-outline"
              size={22}
              color={colors.text.tertiary}
            />
          </TouchableOpacity>
        </View>
      </Card>
    </View>
  );

  // Challenges Tab
  const renderChallengesTab = () => (
    <View style={styles.tabContent}>
      {/* My Challenges Stats */}
      {activeMyChallenges.length > 0 && (
        <TouchableOpacity
          style={styles.statsCard}
          onPress={() =>
            router.push(`${MOBILE_ROUTES.GOALS.LIST}?tab=challenges`)
          }
        >
          <View style={styles.statsLeft}>
            <Ionicons name="trophy" size={24} color={brandColors.primary} />
            <View style={styles.statsText}>
              <Text style={styles.statsTitle}>
                {t("social.my_challenges") || "My Challenges"}
              </Text>
              <Text style={styles.statsSubtitle}>
                {activeMyChallenges.filter((c) => c.status === "active").length}{" "}
                {t("social.active_challenges") || "active"} •{" "}
                {
                  activeMyChallenges.filter((c) => c.status === "upcoming")
                    .length
                }{" "}
                {t("social.upcoming_challenges") || "upcoming"}
              </Text>
            </View>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.text.tertiary}
          />
        </TouchableOpacity>
      )}

      {/* Discover Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {t("social.discover_challenges") || "Discover Challenges"}
        </Text>
      </View>

      {/* Challenge Cards */}
      {loadingChallenges ? (
        <ActivityIndicator
          size="large"
          color={brandColors.primary}
          style={styles.loader}
        />
      ) : discoverChallenges.length > 0 ? (
        discoverChallenges
          .slice(0, 10)
          .map((challenge: Challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              variant="discovery"
            />
          ))
      ) : (
        <View style={styles.emptyState}>
          <Ionicons
            name="trophy-outline"
            size={48}
            color={colors.text.tertiary}
          />
          <Text style={styles.emptyTitle}>
            {t("social.no_challenges_title") || "No challenges found"}
          </Text>
          <Text style={styles.emptyText}>
            {t("social.no_challenges_desc") ||
              "Check back later or create your own challenge!"}
          </Text>
          <Button
            title={t("social.create_challenge") || "Create Challenge"}
            onPress={handleCreateChallenge}
            style={styles.createButton}
          />
        </View>
      )}
    </View>
  );

  // Render content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case "posts":
        return renderPostsTab();
      case "challenges":
        return renderChallengesTab();
      default:
        return renderPostsTab();
    }
  };

  // Subscription Modal
  if (showSubscriptionScreen) {
    return (
      <SubscriptionScreen
        visible
        onClose={() => setShowSubscriptionScreen(false)}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("social.title") || "Social"}</Text>
        <View style={styles.headerActions}>{renderHeaderAction()}</View>
      </View>

      {/* Tab Bar */}
      {renderTabBar()}

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={brandColors.primary}
          />
        }
      >
        {renderContent()}
      </ScrollView>
    </View>
  );
}

const makeSocialStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
  // Header
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.canvas,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  headerTitle: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
  },
  headerActions: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    minWidth: 44,
    height: 44,
    justifyContent: "flex-end" as const,
  },
  headerAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bg.muted,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  // Tab Bar
  tabBar: {
    flexDirection: "row" as const,
    backgroundColor: colors.bg.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  tab: {
    flex: 1,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[3]),
    position: "relative" as const,
  },
  tabActive: {},
  tabText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
  },
  tabTextActive: {
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
  tabIndicator: {
    position: "absolute" as const,
    bottom: 0,
    left: "25%" as const,
    right: "25%" as const,
    height: 2,
    backgroundColor: brand.primary,
    borderRadius: 1,
  },
  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  tabContent: {
    flex: 1,
    padding: toRN(tokens.spacing[4]),
  },
  // Coming Soon Card
  comingSoonCard: {
    alignItems: "center" as const,
    padding: toRN(tokens.spacing[6]),
    marginBottom: toRN(tokens.spacing[4]),
  },
  comingSoonIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${brand.primary}15`,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[3]),
  },
  comingSoonTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[2]),
    textAlign: "center" as const,
  },
  comingSoonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5,
  },
  // Motivation Card
  motivationCard: {
    padding: toRN(tokens.spacing[4]),
  },
  motivationHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[3]),
  },
  motivationAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${brand.primary}15`,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginRight: toRN(tokens.spacing[3]),
  },
  motivationMeta: {
    flex: 1,
  },
  motivationAuthor: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
  motivationTime: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
  },
  motivationText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.base) * 1.5,
    marginBottom: toRN(tokens.spacing[3]),
  },
  postActions: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingTop: toRN(tokens.spacing[3]),
  },
  postAction: {
    marginRight: toRN(tokens.spacing[4]),
  },
  // Stats Card
  statsCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.lg),
    padding: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[4]),
    shadowColor: colors.shadow.sm,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    shadowOpacity: 0.08,
    elevation: 2,
  },
  statsLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  statsText: {
    marginLeft: toRN(tokens.spacing[3]),
  },
  statsTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
  statsSubtitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    marginTop: toRN(tokens.spacing[0.5]),
  },
  // Section
  sectionHeader: {
    marginBottom: toRN(tokens.spacing[3]),
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
  // Loader
  loader: {
    paddingVertical: toRN(tokens.spacing[8]),
  },
  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[8]),
    paddingHorizontal: toRN(tokens.spacing[4]),
  },
  emptyTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginTop: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[2]),
  },
  emptyText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[4]),
    maxWidth: 280,
  },
  createButton: {
    marginTop: toRN(tokens.spacing[2]),
  },
});
