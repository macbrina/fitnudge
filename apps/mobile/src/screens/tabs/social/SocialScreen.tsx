import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "@/lib/i18n";
import { useStyles, useTheme } from "@/themes";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { MOBILE_ROUTES } from "@/lib/routes";
import { Card } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { ChallengeCard } from "@/screens/tabs/home/components/ChallengeCard";

// Hooks
import {
  usePartners,
  usePendingPartnerRequests,
} from "@/hooks/api/usePartners";
import {
  usePublicChallenges,
  useMyChallenges,
  useJoinChallenge,
} from "@/hooks/api/useChallenges";
import { useNudges, useUnreadNudgesCount } from "@/hooks/api/useNudges";
import { Partner } from "@/services/api/partners";
import { Challenge } from "@/services/api/challenges";
import { Nudge } from "@/services/api/nudges";
import { useAlertModal } from "@/contexts/AlertModalContext";

type SocialTab = "posts" | "challenges" | "partners" | "activity";

export default function SocialScreen() {
  const styles = useStyles(makeSocialStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { showAlert } = useAlertModal();

  const [activeTab, setActiveTab] = useState<SocialTab>("posts");
  const [refreshing, setRefreshing] = useState(false);

  // Data hooks
  const {
    data: partnersData,
    isLoading: loadingPartners,
    refetch: refetchPartners,
  } = usePartners();
  const { data: pendingData, refetch: refetchPending } =
    usePendingPartnerRequests();
  const {
    data: publicChallengesData,
    isLoading: loadingChallenges,
    refetch: refetchChallenges,
  } = usePublicChallenges();
  const { data: myChallengesData, refetch: refetchMyChallenges } =
    useMyChallenges(); // Challenges user created or joined
  const {
    data: nudgesData,
    isLoading: loadingNudges,
    refetch: refetchNudges,
  } = useNudges();
  const { data: unreadCountData } = useUnreadNudgesCount();
  const joinChallenge = useJoinChallenge();

  const partners = partnersData?.data || [];
  const pendingRequests = pendingData?.data || [];
  const publicChallenges = publicChallengesData?.data || [];
  const myChallenges = myChallengesData?.data || [];
  const nudges = nudgesData?.data || [];
  const unreadCount = unreadCountData?.data?.unread_count || 0;

  // Filter upcoming public challenges
  const upcomingChallenges = useMemo(() => {
    const myChallengeIds = new Set(myChallenges.map((c) => c.id));
    return publicChallenges.filter(
      (c) =>
        !myChallengeIds.has(c.id) &&
        (c.status === "upcoming" || c.status === "active")
    );
  }, [publicChallenges, myChallenges]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchPartners(),
        refetchPending(),
        refetchChallenges(),
        refetchMyChallenges(),
        refetchNudges(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [
    refetchPartners,
    refetchPending,
    refetchChallenges,
    refetchMyChallenges,
    refetchNudges,
  ]);

  const handleJoinChallenge = useCallback(
    async (challengeId: string) => {
      try {
        await joinChallenge.mutateAsync(challengeId);
        showAlert({
          title: t("social.challenge_joined_title"),
          message: t("social.challenge_joined_message"),
          variant: "success",
          confirmLabel: t("common.ok"),
        });
      } catch (error) {
        showAlert({
          title: t("common.error"),
          message: t("social.join_challenge_error"),
          variant: "error",
          confirmLabel: t("common.ok"),
        });
      }
    },
    [joinChallenge, showAlert, t]
  );

  // Tab configuration - Posts first
  const tabs: { id: SocialTab; label: string; badge?: number }[] = [
    { id: "posts", label: t("social.tabs.posts") },
    { id: "challenges", label: t("social.tabs.challenges") },
    { id: "partners", label: t("social.tabs.partners") },
    {
      id: "activity",
      label: t("social.tabs.activity"),
      badge: unreadCount,
    },
  ];

  // === Partner Stories Row (like Instagram) ===
  const renderPartnerStories = () => {
    if (partners.length === 0 && pendingRequests.length === 0) return null;

    return (
      <View style={styles.storiesContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storiesContent}
        >
          {/* Add Partner Button */}
          <TouchableOpacity
            style={styles.storyItem}
            onPress={() => router.push(MOBILE_ROUTES.SOCIAL.FIND_PARTNER)}
          >
            <View style={styles.addStoryCircle}>
              <Ionicons name="add" size={24} color={brandColors.primary} />
            </View>
            <Text style={styles.storyName} numberOfLines={1}>
              {t("social.add")}
            </Text>
          </TouchableOpacity>

          {/* Partner Avatars */}
          {partners.slice(0, 10).map((partner: Partner) => (
            <TouchableOpacity
              key={partner.id}
              style={styles.storyItem}
              onPress={() => router.push(MOBILE_ROUTES.SOCIAL.PARTNERS)}
            >
              <View style={styles.storyCircle}>
                {partner.partner?.profile_picture_url ? (
                  <Image
                    source={{ uri: partner.partner.profile_picture_url }}
                    style={styles.storyImage}
                  />
                ) : (
                  <View style={styles.storyPlaceholder}>
                    <Text style={styles.storyInitial}>
                      {partner.partner?.name?.charAt(0)?.toUpperCase() || "?"}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.storyName} numberOfLines={1}>
                {partner.partner?.name?.split(" ")[0] || "Partner"}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  // === Tab Bar (simple text tabs like Instagram) ===
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
          {tab.badge && tab.badge > 0 ? (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>
                {tab.badge > 99 ? "99+" : tab.badge}
              </Text>
            </View>
          ) : null}
          {activeTab === tab.id && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
      ))}
    </View>
  );

  // === Posts Tab ===
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
          {t("social.posts_coming_soon_title")}
        </Text>
        <Text style={styles.comingSoonText}>
          {t("social.posts_coming_soon_desc")}
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
              {t("social.ai_motivation")}
            </Text>
            <Text style={styles.motivationTime}>{t("time.just_now")}</Text>
          </View>
        </View>
        <Text style={styles.motivationText}>
          {t("social.ai_motivation_placeholder")}
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

  // === Challenges Tab ===
  const renderChallengesTab = () => (
    <View style={styles.tabContent}>
      {/* My Challenges Stats */}
      {myChallenges.length > 0 && (
        <TouchableOpacity
          style={styles.statsCard}
          onPress={() => router.push(MOBILE_ROUTES.CHALLENGES.LIST)}
        >
          <View style={styles.statsLeft}>
            <Ionicons name="trophy" size={24} color={brandColors.primary} />
            <View style={styles.statsText}>
              <Text style={styles.statsTitle}>{t("social.my_challenges")}</Text>
              <Text style={styles.statsSubtitle}>
                {myChallenges.filter((c) => c.status === "active").length}{" "}
                {t("social.active_challenges")} •{" "}
                {myChallenges.filter((c) => c.status === "upcoming").length}{" "}
                {t("social.upcoming_challenges")}
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

      {/* Create Challenge CTA */}
      <Card style={styles.createCTA}>
        <View style={styles.createCTAContent}>
          <Ionicons name="add-circle" size={28} color={brandColors.primary} />
          <View style={styles.createCTAText}>
            <Text style={styles.createCTATitle}>
              {t("social.create_challenge_title")}
            </Text>
            <Text style={styles.createCTASubtitle}>
              {t("social.create_challenge_desc")}
            </Text>
          </View>
        </View>
        <Button
          title={t("social.create_challenge")}
          onPress={() => router.push(MOBILE_ROUTES.CHALLENGES.CREATE)}
          size="sm"
        />
      </Card>

      {/* Discover Section Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {t("social.discover_challenges")}
        </Text>
      </View>

      {/* Challenge Cards */}
      {loadingChallenges ? (
        <ActivityIndicator
          size="large"
          color={brandColors.primary}
          style={styles.loader}
        />
      ) : upcomingChallenges.length > 0 ? (
        upcomingChallenges
          .slice(0, 5)
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
            {t("social.no_challenges_title")}
          </Text>
          <Text style={styles.emptyText}>{t("social.no_challenges_desc")}</Text>
        </View>
      )}
    </View>
  );

  // === Partners Tab ===
  const renderPartnersTab = () => (
    <View style={styles.tabContent}>
      {/* Stats Row */}
      <View style={styles.partnerStats}>
        <View style={styles.partnerStatItem}>
          <Text style={styles.partnerStatNumber}>{partners.length}</Text>
          <Text style={styles.partnerStatLabel}>
            {t("social.partners_count")}
          </Text>
        </View>
        <View style={styles.partnerStatDivider} />
        <View style={styles.partnerStatItem}>
          <Text
            style={[
              styles.partnerStatNumber,
              pendingRequests.length > 0 && styles.partnerStatHighlight,
            ]}
          >
            {pendingRequests.length}
          </Text>
          <Text style={styles.partnerStatLabel}>
            {t("social.pending_requests")}
          </Text>
        </View>
      </View>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <TouchableOpacity
          style={styles.pendingCard}
          onPress={() => router.push(MOBILE_ROUTES.SOCIAL.PARTNERS)}
        >
          <View style={styles.pendingLeft}>
            <View style={styles.pendingIcon}>
              <Ionicons
                name="mail-unread"
                size={20}
                color={brandColors.primary}
              />
            </View>
            <Text style={styles.pendingText}>
              {t("social.pending_requests_preview", {
                count: pendingRequests.length,
              })}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.text.tertiary}
          />
        </TouchableOpacity>
      )}

      {/* Partners List */}
      {partners.length > 0 ? (
        partners.map((partner: Partner) => (
          <TouchableOpacity
            key={partner.id}
            style={styles.partnerItem}
            onPress={() => router.push(MOBILE_ROUTES.SOCIAL.PARTNERS)}
          >
            <View style={styles.partnerAvatar}>
              {partner.partner?.profile_picture_url ? (
                <Image
                  source={{ uri: partner.partner.profile_picture_url }}
                  style={styles.partnerAvatarImage}
                />
              ) : (
                <Text style={styles.partnerAvatarText}>
                  {partner.partner?.name?.charAt(0)?.toUpperCase() || "?"}
                </Text>
              )}
            </View>
            <View style={styles.partnerDetails}>
              <Text style={styles.partnerName}>
                {partner.partner?.name || "Partner"}
              </Text>
              {partner.partner?.username && (
                <Text style={styles.partnerUsername}>
                  @{partner.partner.username}
                </Text>
              )}
            </View>
            <TouchableOpacity style={styles.nudgeButton}>
              <Ionicons
                name="hand-right"
                size={18}
                color={brandColors.primary}
              />
            </TouchableOpacity>
          </TouchableOpacity>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Ionicons
            name="people-outline"
            size={48}
            color={colors.text.tertiary}
          />
          <Text style={styles.emptyTitle}>{t("social.no_partners_title")}</Text>
          <Text style={styles.emptyText}>{t("social.no_partners_desc")}</Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.partnerActions}>
        <Button
          title={t("social.find_partners")}
          onPress={() => router.push(MOBILE_ROUTES.SOCIAL.FIND_PARTNER)}
          leftIcon="person-add"
        />
      </View>
    </View>
  );

  // === Activity Tab ===
  const renderActivityTab = () => (
    <View style={styles.tabContent}>
      {/* Unread Banner */}
      {unreadCount > 0 && (
        <View style={styles.unreadBanner}>
          <Text style={styles.unreadText}>
            {t("social.unread_nudges", { count: unreadCount })}
          </Text>
          <TouchableOpacity
            onPress={() => router.push(MOBILE_ROUTES.SOCIAL.NUDGES)}
          >
            <Text style={styles.viewAllLink}>{t("common.view_all")}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Activity List */}
      {loadingNudges ? (
        <ActivityIndicator
          size="large"
          color={brandColors.primary}
          style={styles.loader}
        />
      ) : nudges.length > 0 ? (
        nudges.slice(0, 15).map((nudge: Nudge) => (
          <View
            key={nudge.id}
            style={[
              styles.activityItem,
              !nudge.is_read && styles.activityUnread,
            ]}
          >
            <View
              style={[
                styles.activityIcon,
                { backgroundColor: getNudgeIconBg(nudge.nudge_type, colors) },
              ]}
            >
              <Ionicons
                name={getNudgeIcon(nudge.nudge_type)}
                size={16}
                color="#fff"
              />
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityText}>
                <Text style={styles.activitySender}>
                  {nudge.sender?.name || t("social.someone")}
                </Text>{" "}
                {nudge.message || getNudgeDefaultMessage(nudge.nudge_type, t)}
              </Text>
              <Text style={styles.activityTime}>
                {getRelativeTime(nudge.created_at, t)}
              </Text>
            </View>
            {nudge.emoji && (
              <Text style={styles.activityEmoji}>{nudge.emoji}</Text>
            )}
          </View>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Ionicons
            name="notifications-off-outline"
            size={48}
            color={colors.text.tertiary}
          />
          <Text style={styles.emptyTitle}>{t("social.no_activity_title")}</Text>
          <Text style={styles.emptyText}>{t("social.no_activity_desc")}</Text>
        </View>
      )}
    </View>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "posts":
        return renderPostsTab();
      case "challenges":
        return renderChallengesTab();
      case "partners":
        return renderPartnersTab();
      case "activity":
        return renderActivityTab();
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("social.title")}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push(MOBILE_ROUTES.SOCIAL.NUDGES)}
          >
            <Ionicons
              name="notifications-outline"
              size={24}
              color={colors.text.primary}
            />
            {unreadCount > 0 && <View style={styles.headerBadge} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Partner Stories */}
      {renderPartnerStories()}

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
            tintColor={colors.text.tertiary}
          />
        }
      >
        {renderContent()}
      </ScrollView>
    </View>
  );
}

// Helper functions
function getNudgeIcon(type: string): any {
  switch (type) {
    case "cheer":
      return "happy";
    case "reminder":
      return "alarm";
    case "milestone":
      return "trophy";
    case "challenge":
      return "flag";
    default:
      return "hand-right";
  }
}

function getNudgeIconBg(type: string, colors: any): string {
  switch (type) {
    case "cheer":
      return colors.feedback.success;
    case "reminder":
      return colors.feedback.warning;
    case "milestone":
      return "#8B5CF6"; // Purple for milestones
    default:
      return colors.feedback.success;
  }
}

function getNudgeDefaultMessage(type: string, t: any): string {
  switch (type) {
    case "cheer":
      return t("social.nudge_cheer_default");
    case "reminder":
      return t("social.nudge_reminder_default");
    case "milestone":
      return t("social.nudge_milestone_default");
    default:
      return t("social.nudge_default");
  }
}

function getRelativeTime(dateStr: string, t: any): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t("time.just_now");
  if (diffMins < 60) return t("time.minutes_ago", { count: diffMins });
  if (diffHours < 24) return t("time.hours_ago", { count: diffHours });
  if (diffDays < 7) return t("time.days_ago", { count: diffDays });
  return date.toLocaleDateString();
}

// Styles
const makeSocialStyles = (tokens: any, colors: any, brandColors: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
  // Header
  header: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
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
    gap: toRN(tokens.spacing[2]),
  },
  headerButton: {
    position: "relative" as const,
    padding: toRN(tokens.spacing[2]),
  },
  headerBadge: {
    position: "absolute" as const,
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.feedback.error,
  },
  // Stories
  storiesContainer: {
    backgroundColor: colors.bg.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  storiesContent: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[3]),
    gap: toRN(tokens.spacing[4]),
  },
  storyItem: {
    alignItems: "center" as const,
    width: 64,
  },
  addStoryCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: brandColors.primary,
    borderStyle: "dashed" as const,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    backgroundColor: colors.bg.muted,
  },
  storyCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: brandColors.primary,
    padding: 2,
  },
  storyImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  storyPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: brandColors.primary,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  storyInitial: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: "#fff",
  },
  storyName: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
    marginTop: toRN(tokens.spacing[1]),
    textAlign: "center" as const,
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
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: toRN(tokens.spacing[3]),
    position: "relative" as const,
    gap: toRN(tokens.spacing[1]),
  },
  tabActive: {},
  tabText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
  },
  tabTextActive: {
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
  tabBadge: {
    backgroundColor: colors.feedback.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: fontFamily.bold,
  },
  tabIndicator: {
    position: "absolute" as const,
    bottom: 0,
    left: "25%" as const,
    right: "25%" as const,
    height: 2,
    backgroundColor: brandColors.primary,
    borderRadius: 1,
  },
  // Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: toRN(tokens.spacing[8]),
  },
  tabContent: {
    padding: toRN(tokens.spacing[4]),
    gap: toRN(tokens.spacing[3]),
  },
  // Posts Tab
  comingSoonCard: {
    padding: toRN(tokens.spacing[6]),
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
  },
  comingSoonIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${brandColors.primary}15`,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  comingSoonTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    textAlign: "center" as const,
  },
  comingSoonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    textAlign: "center" as const,
    maxWidth: 280,
  },
  motivationCard: {
    padding: toRN(tokens.spacing[4]),
  },
  motivationHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[3]),
  },
  motivationAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${brandColors.primary}15`,
    justifyContent: "center" as const,
    alignItems: "center" as const,
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
    color: colors.text.primary,
    lineHeight: 22,
    marginBottom: toRN(tokens.spacing[3]),
  },
  postActions: {
    flexDirection: "row" as const,
    gap: toRN(tokens.spacing[4]),
    paddingTop: toRN(tokens.spacing[2]),
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  postAction: {
    padding: toRN(tokens.spacing[1]),
  },
  // Challenges Tab
  statsCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    backgroundColor: colors.bg.card,
    padding: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.lg),
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  statsLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
    flex: 1,
  },
  statsText: {
    flex: 1,
  },
  statsTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
  statsSubtitle: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[0.5]),
  },
  createCTA: {
    padding: toRN(tokens.spacing[4]),
  },
  createCTAContent: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[3]),
  },
  createCTAText: {
    flex: 1,
  },
  createCTATitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
  createCTASubtitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[0.5]),
  },
  sectionHeader: {
    marginTop: toRN(tokens.spacing[2]),
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
  challengeCard: {
    padding: toRN(tokens.spacing[4]),
  },
  challengeHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
  },
  challengeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${brandColors.primary}15`,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  challengeInfo: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
  challengeMeta: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
    marginTop: toRN(tokens.spacing[0.5]),
  },
  challengeMetaText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
  },
  challengeMetaDot: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    color: colors.text.tertiary,
  },
  challengeDesc: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    marginTop: toRN(tokens.spacing[3]),
  },
  // Partners Tab
  partnerStats: {
    flexDirection: "row" as const,
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.lg),
    padding: toRN(tokens.spacing[4]),
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  partnerStatItem: {
    flex: 1,
    alignItems: "center" as const,
  },
  partnerStatDivider: {
    width: 1,
    backgroundColor: colors.border.subtle,
    marginHorizontal: toRN(tokens.spacing[4]),
  },
  partnerStatNumber: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
  },
  partnerStatHighlight: {
    color: brandColors.primary,
  },
  partnerStatLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[0.5]),
  },
  pendingCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    backgroundColor: `${brandColors.primary}10`,
    padding: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.lg),
    borderWidth: 1,
    borderColor: `${brandColors.primary}30`,
  },
  pendingLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
  },
  pendingIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.card,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  pendingText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: brandColors.primary,
  },
  partnerItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: colors.bg.card,
    padding: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.lg),
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  partnerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: brandColors.primary,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  partnerAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  partnerAvatarText: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: "#fff",
  },
  partnerDetails: {
    flex: 1,
    marginLeft: toRN(tokens.spacing[3]),
  },
  partnerName: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
  partnerUsername: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
  },
  nudgeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${brandColors.primary}15`,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  partnerActions: {
    marginTop: toRN(tokens.spacing[2]),
  },
  // Activity Tab
  unreadBanner: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    backgroundColor: `${brandColors.primary}10`,
    padding: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.lg),
  },
  unreadText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: brandColors.primary,
  },
  viewAllLink: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: brandColors.primary,
  },
  activityItem: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    backgroundColor: colors.bg.card,
    padding: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.lg),
    gap: toRN(tokens.spacing[3]),
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  activityUnread: {
    borderLeftWidth: 3,
    borderLeftColor: brandColors.primary,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  activitySender: {
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
  activityTime: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[1]),
  },
  activityEmoji: {
    fontSize: 24,
  },
  // Empty State
  emptyState: {
    alignItems: "center" as const,
    padding: toRN(tokens.spacing[8]),
    gap: toRN(tokens.spacing[2]),
  },
  emptyTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    textAlign: "center" as const,
  },
  emptyText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    textAlign: "center" as const,
    maxWidth: 280,
  },
  loader: {
    padding: toRN(tokens.spacing[8]),
  },
});
