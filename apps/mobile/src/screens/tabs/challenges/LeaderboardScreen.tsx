import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
} from "react-native";
import { useTranslation } from "@/lib/i18n";
import { router, useLocalSearchParams } from "expo-router";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { BackButton } from "@/components/ui/BackButton";
import { Card } from "@/components/ui/Card";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { Ionicons } from "@expo/vector-icons";
import {
  useChallenge,
  useChallengeLeaderboard,
} from "@/hooks/api/useChallenges";
import { LeaderboardEntry } from "@/services/api/challenges";
import { useAuthStore } from "@/stores/authStore";

type SortOption = "points" | "check_ins" | "rank";

export default function LeaderboardScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const challengeId = params.id;
  const styles = useStyles(makeLeaderboardScreenStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuthStore();

  const [sortBy, setSortBy] = useState<SortOption>("rank");
  const [refreshing, setRefreshing] = useState(false);

  // Data hooks
  const { data: challengeResponse, isLoading: challengeLoading } = useChallenge(
    challengeId || "",
  );

  const {
    data: leaderboardResponse,
    isLoading: leaderboardLoading,
    refetch: refetchLeaderboard,
  } = useChallengeLeaderboard(challengeId || "");

  const challenge = challengeResponse?.data;
  const leaderboard = leaderboardResponse?.data || [];

  // Find current user in leaderboard
  const myEntry = useMemo(() => {
    return leaderboard.find((entry) => entry.user_id === user?.id);
  }, [leaderboard, user?.id]);

  // Sort leaderboard based on selected option
  const sortedLeaderboard = useMemo(() => {
    const sorted = [...leaderboard];
    switch (sortBy) {
      case "points":
        sorted.sort((a, b) => b.points - a.points);
        break;
      case "check_ins":
        sorted.sort((a, b) => b.total_check_ins - a.total_check_ins);
        break;
      case "rank":
      default:
        sorted.sort((a, b) => a.rank - b.rank);
        break;
    }
    return sorted;
  }, [leaderboard, sortBy]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchLeaderboard();
    } catch (error) {
      console.error("Error refreshing leaderboard:", error);
    } finally {
      setRefreshing(false);
    }
  };

  // Medal colors for top 3
  const getMedalColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "#FFD700"; // Gold
      case 2:
        return "#C0C0C0"; // Silver
      case 3:
        return "#CD7F32"; // Bronze
      default:
        return null;
    }
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Challenge Info */}
      {challenge && (
        <Card shadow="sm" style={styles.challengeCard}>
          <Text style={styles.challengeTitle} numberOfLines={1}>
            {challenge.title}
          </Text>
          <View style={styles.challengeStats}>
            <View style={styles.statBadge}>
              <Ionicons
                name="people-outline"
                size={14}
                color={colors.text.tertiary}
              />
              <Text style={styles.statBadgeText}>
                {challenge.participants_count || 0} participants
              </Text>
            </View>
            <View style={styles.statBadge}>
              <Ionicons
                name="trophy-outline"
                size={14}
                color={colors.text.tertiary}
              />
              <Text style={styles.statBadgeText}>{challenge.status}</Text>
            </View>
          </View>
        </Card>
      )}

      {/* My Position Card (sticky) */}
      {myEntry && (
        <Card shadow="md" style={styles.myPositionCard}>
          <View style={styles.myPositionContent}>
            <View style={styles.myPositionLeft}>
              <View style={styles.myRankBadge}>
                <Text style={styles.myRankText}>#{myEntry.rank}</Text>
              </View>
              <View>
                <Text style={styles.myPositionLabel}>
                  {t("challenges.your_position") || "Your Position"}
                </Text>
                <Text style={styles.myPositionSubtext}>
                  {myEntry.points} {t("challenges.points") || "pts"} •{" "}
                  {myEntry.total_check_ins}{" "}
                  {t("checkin.check_ins") || "check-ins"}
                </Text>
              </View>
            </View>
            {myEntry.rank <= 3 && (
              <Ionicons
                name="medal"
                size={32}
                color={getMedalColor(myEntry.rank) || undefined}
              />
            )}
          </View>
        </Card>
      )}

      {/* Sort Options */}
      <View style={styles.sortContainer}>
        <Text style={styles.sortLabel}>{t("goals.sort") || "Sort by"}:</Text>
        <View style={styles.sortOptions}>
          {[
            { value: "rank" as SortOption, label: "Rank" },
            { value: "points" as SortOption, label: "Points" },
            { value: "check_ins" as SortOption, label: "Check-ins" },
          ].map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.sortOption,
                sortBy === option.value && styles.sortOptionActive,
              ]}
              onPress={() => setSortBy(option.value)}
            >
              <Text
                style={[
                  styles.sortOptionText,
                  sortBy === option.value && styles.sortOptionTextActive,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const renderEntry = ({
    item,
    index,
  }: {
    item: LeaderboardEntry;
    index: number;
  }) => {
    const isMe = item.user_id === user?.id;
    const medalColor = getMedalColor(item.rank);

    return (
      <View style={[styles.entryRow, isMe && styles.entryRowHighlighted]}>
        {/* Rank */}
        <View style={styles.rankContainer}>
          {medalColor ? (
            <View
              style={[styles.medalContainer, { backgroundColor: medalColor }]}
            >
              <Text style={styles.medalText}>{item.rank}</Text>
            </View>
          ) : (
            <Text style={styles.rankNumber}>#{item.rank}</Text>
          )}
        </View>

        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {item.user?.profile_picture_url ? (
            <Image
              source={{ uri: item.user.profile_picture_url }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>
                {item.user?.name?.charAt(0)?.toUpperCase() || "?"}
              </Text>
            </View>
          )}
        </View>

        {/* User Info */}
        <View style={styles.entryContent}>
          <Text
            style={[styles.userName, isMe && styles.userNameHighlighted]}
            numberOfLines={1}
          >
            {item.user?.name || t("social.someone") || "Unknown"}
            {isMe && " (You)"}
          </Text>
          <Text style={styles.userStats}>
            {item.total_check_ins} {t("checkin.check_ins") || "check-ins"}
          </Text>
        </View>

        {/* Points */}
        <View style={styles.pointsContainer}>
          <Text style={[styles.points, isMe && styles.pointsHighlighted]}>
            {item.points}
          </Text>
          <Text style={styles.pointsLabel}>
            {t("challenges.points") || "pts"}
          </Text>
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="podium-outline" size={48} color={colors.text.tertiary} />
      <Text style={styles.emptyTitle}>
        {t("challenges.no_participants") || "No participants yet"}
      </Text>
      <Text style={styles.emptyMessage}>
        {t("challenges.be_first") || "Be the first to join this challenge!"}
      </Text>
    </View>
  );

  if (leaderboardLoading) {
    return (
      <View style={styles.container}>
        <BackButton title={t("challenges.leaderboard") || "Leaderboard"} />
        <View style={styles.loadingContainer}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={styles.entryRow}>
              <SkeletonBox width={32} height={32} borderRadius={16} />
              <SkeletonBox width={40} height={40} borderRadius={20} />
              <View style={{ flex: 1, gap: 4 }}>
                <SkeletonBox width={120} height={14} />
                <SkeletonBox width={80} height={12} />
              </View>
              <SkeletonBox width={50} height={24} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BackButton
        title={t("challenges.leaderboard") || "Leaderboard"}
        onPress={() => router.back()}
      />

      <FlatList
        data={sortedLeaderboard}
        keyExtractor={(item) => item.user_id}
        renderItem={renderEntry}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={brandColors.primary}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const makeLeaderboardScreenStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
  loadingContainer: {
    padding: toRN(tokens.spacing[4]),
    gap: toRN(tokens.spacing[3]),
  },
  listContent: {
    padding: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[8]),
  },
  headerContainer: {
    gap: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[4]),
  },
  challengeCard: {
    padding: toRN(tokens.spacing[3]),
    gap: toRN(tokens.spacing[2]),
  },
  challengeTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: toRN(tokens.typography.fontSize.base),
    color: colors.text.primary,
  },
  challengeStats: {
    flexDirection: "row" as const,
    gap: toRN(tokens.spacing[3]),
  },
  statBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
  },
  statBadgeText: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.xs),
    color: colors.text.tertiary,
  },
  myPositionCard: {
    padding: toRN(tokens.spacing[4]),
    backgroundColor: brand.primary + "10",
    borderWidth: 1,
    borderColor: brand.primary + "30",
  },
  myPositionContent: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
  myPositionLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
  },
  myRankBadge: {
    backgroundColor: brand.primary,
    paddingHorizontal: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[2]),
    borderRadius: toRN(tokens.borderRadius.lg),
  },
  myRankText: {
    fontFamily: fontFamily.semiBold,
    fontSize: toRN(tokens.typography.fontSize.lg),
    color: "#fff",
  },
  myPositionLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.primary,
  },
  myPositionSubtext: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.xs),
    color: colors.text.secondary,
  },
  sortContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
  },
  sortLabel: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.secondary,
  },
  sortOptions: {
    flexDirection: "row" as const,
    gap: toRN(tokens.spacing[2]),
    flex: 1,
  },
  sortOption: {
    paddingHorizontal: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[2]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: colors.bg.muted,
  },
  sortOptionActive: {
    backgroundColor: brand.primary,
  },
  sortOptionText: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.xs),
    color: colors.text.secondary,
  },
  sortOptionTextActive: {
    color: "#fff",
  },
  entryRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[3]),
    gap: toRN(tokens.spacing[3]),
  },
  entryRowHighlighted: {
    backgroundColor: brand.primary + "10",
    marginHorizontal: -toRN(tokens.spacing[4]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.lg),
  },
  separator: {
    height: 1,
    backgroundColor: colors.border.default,
  },
  rankContainer: {
    width: 40,
    alignItems: "center" as const,
  },
  medalContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  medalText: {
    fontFamily: fontFamily.semiBold,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: "#fff",
  },
  rankNumber: {
    fontFamily: fontFamily.semiBold,
    fontSize: toRN(tokens.typography.fontSize.base),
    color: colors.text.secondary,
  },
  avatarContainer: {},
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bg.muted,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  avatarInitial: {
    fontFamily: fontFamily.semiBold,
    fontSize: toRN(tokens.typography.fontSize.lg),
    color: colors.text.secondary,
  },
  entryContent: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontFamily: fontFamily.semiBold,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.primary,
  },
  userNameHighlighted: {
    color: brand.primary,
  },
  userStats: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.xs),
    color: colors.text.tertiary,
  },
  pointsContainer: {
    alignItems: "flex-end" as const,
  },
  points: {
    fontFamily: fontFamily.semiBold,
    fontSize: toRN(tokens.typography.fontSize.xl),
    color: colors.text.primary,
  },
  pointsHighlighted: {
    color: brand.primary,
  },
  pointsLabel: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.xs),
    color: colors.text.tertiary,
  },
  emptyContainer: {
    padding: toRN(tokens.spacing[8]),
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
  },
  emptyTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: toRN(tokens.typography.fontSize.lg),
    color: colors.text.primary,
    textAlign: "center" as const,
  },
  emptyMessage: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.secondary,
    textAlign: "center" as const,
  },
});
