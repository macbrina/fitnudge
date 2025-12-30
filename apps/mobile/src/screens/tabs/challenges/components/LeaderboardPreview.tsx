import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { useTranslation } from "@/lib/i18n";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { Card } from "@/components/ui/Card";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { Ionicons } from "@expo/vector-icons";
import { LeaderboardEntry } from "@/services/api/challenges";

interface LeaderboardPreviewProps {
  entries: LeaderboardEntry[];
  myRank?: number;
  isLoading?: boolean;
  onViewAll: () => void;
}

export function LeaderboardPreview({
  entries,
  myRank,
  isLoading,
  onViewAll,
}: LeaderboardPreviewProps) {
  const styles = useStyles(makeLeaderboardPreviewStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();

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
        return colors.text.tertiary;
    }
  };

  // Rank icon for top 3
  const getRankDisplay = (rank: number) => {
    if (rank <= 3) {
      return (
        <View
          style={[
            styles.medalContainer,
            { backgroundColor: getMedalColor(rank) },
          ]}
        >
          <Text style={styles.medalText}>{rank}</Text>
        </View>
      );
    }
    return <Text style={styles.rankNumber}>#{rank}</Text>;
  };

  if (isLoading) {
    return (
      <Card shadow="md" style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.sectionTitle}>
            {t("challenges.leaderboard") || "Leaderboard"}
          </Text>
        </View>
        {[1, 2, 3].map((i) => (
          <View key={i} style={styles.entryRow}>
            <SkeletonBox width={24} height={24} borderRadius={12} />
            <SkeletonBox width={36} height={36} borderRadius={18} />
            <View style={styles.entryContent}>
              <SkeletonBox width={100} height={14} />
              <SkeletonBox width={60} height={12} />
            </View>
            <SkeletonBox width={40} height={20} />
          </View>
        ))}
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card shadow="md" style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons
              name="podium-outline"
              size={20}
              color={brandColors.primary}
            />
            <Text style={styles.sectionTitle}>
              {t("challenges.leaderboard") || "Leaderboard"}
            </Text>
          </View>
        </View>

        {/* Empty State */}
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Ionicons
              name="trophy-outline"
              size={40}
              color={colors.text.tertiary}
            />
          </View>
          <Text style={styles.emptyTitle}>
            {t("challenges.no_participants_yet") || "No Participants Yet"}
          </Text>
          <Text style={styles.emptyText}>
            {t("challenges.be_first_to_join") ||
              "Be the first to join and claim the top spot!"}
          </Text>
        </View>
      </Card>
    );
  }

  return (
    <Card shadow="md" style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons
            name="podium-outline"
            size={20}
            color={brandColors.primary}
          />
          <Text style={styles.sectionTitle}>
            {t("challenges.leaderboard") || "Leaderboard"}
          </Text>
        </View>
        <TouchableOpacity onPress={onViewAll} style={styles.viewAllButton}>
          <Text style={styles.viewAllText}>
            {t("common.view_all") || "View All"}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={brandColors.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Leaderboard Entries */}
      <View style={styles.entriesContainer}>
        {entries.map((entry, index) => {
          const isMe = myRank === entry.rank;

          return (
            <View
              key={entry.user_id}
              style={[
                styles.entryRow,
                isMe && styles.entryRowHighlighted,
                index < entries.length - 1 && styles.entryRowBorder,
              ]}
            >
              {/* Rank */}
              <View style={styles.rankContainer}>
                {getRankDisplay(entry.rank)}
              </View>

              {/* Avatar */}
              <View style={styles.avatarContainer}>
                {entry.user?.profile_picture_url ? (
                  <Image
                    source={{ uri: entry.user.profile_picture_url }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitial}>
                      {entry.user?.name?.charAt(0)?.toUpperCase() || "?"}
                    </Text>
                  </View>
                )}
                {isMe && (
                  <View style={styles.meBadge}>
                    <Text style={styles.meBadgeText}>You</Text>
                  </View>
                )}
              </View>

              {/* User Info */}
              <View style={styles.entryContent}>
                <Text
                  style={[styles.userName, isMe && styles.userNameHighlighted]}
                  numberOfLines={1}
                >
                  {entry.user?.name || t("social.someone") || "Unknown"}
                </Text>
                <Text style={styles.checkInsCount}>
                  {entry.total_check_ins}{" "}
                  {t("checkin.check_ins") || "check-ins"}
                </Text>
              </View>

              {/* Points */}
              <View style={styles.pointsContainer}>
                <Text style={[styles.points, isMe && styles.pointsHighlighted]}>
                  {entry.points}
                </Text>
                <Text style={styles.pointsLabel}>
                  {t("challenges.points") || "pts"}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* My Position (if not in top 5) */}
      {myRank && myRank > 5 && (
        <View style={styles.myPositionCard}>
          <View style={styles.myPositionDots}>
            <Text style={styles.dots}>• • •</Text>
          </View>
          <View style={styles.myPositionRow}>
            <Text style={styles.myPositionLabel}>
              {t("challenges.your_position") || "Your Position"}
            </Text>
            <View style={styles.myPositionBadge}>
              <Text style={styles.myPositionRank}>#{myRank}</Text>
            </View>
          </View>
        </View>
      )}
    </Card>
  );
}

const makeLeaderboardPreviewStyles = (
  tokens: any,
  colors: any,
  brand: any,
) => ({
  container: {
    padding: toRN(tokens.spacing[4]),
    gap: toRN(tokens.spacing[3]),
  },
  header: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
  headerLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
  },
  sectionTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: toRN(tokens.typography.fontSize.base),
    color: colors.text.primary,
  },
  viewAllButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
  },
  viewAllText: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: brand.primary,
  },
  entriesContainer: {
    gap: 0,
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
  entryRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  rankContainer: {
    width: 32,
    alignItems: "center" as const,
  },
  medalContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.secondary,
  },
  avatarContainer: {
    position: "relative" as const,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg.muted,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  avatarInitial: {
    fontFamily: fontFamily.semiBold,
    fontSize: toRN(tokens.typography.fontSize.base),
    color: colors.text.secondary,
  },
  meBadge: {
    position: "absolute" as const,
    bottom: -4,
    right: -4,
    backgroundColor: brand.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.bg.card,
  },
  meBadgeText: {
    fontFamily: fontFamily.semiBold,
    fontSize: 8,
    color: "#fff",
    textTransform: "uppercase" as const,
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
  checkInsCount: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.xs),
    color: colors.text.tertiary,
  },
  pointsContainer: {
    alignItems: "flex-end" as const,
  },
  points: {
    fontFamily: fontFamily.semiBold,
    fontSize: toRN(tokens.typography.fontSize.lg),
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
  myPositionCard: {
    marginTop: toRN(tokens.spacing[2]),
    gap: toRN(tokens.spacing[1]),
  },
  myPositionDots: {
    alignItems: "center" as const,
  },
  dots: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.tertiary,
    letterSpacing: 4,
  },
  myPositionRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    padding: toRN(tokens.spacing[3]),
    backgroundColor: brand.primary + "10",
    borderRadius: toRN(tokens.borderRadius.lg),
  },
  myPositionLabel: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.secondary,
  },
  myPositionBadge: {
    backgroundColor: brand.primary,
    paddingHorizontal: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[1]),
    borderRadius: toRN(tokens.borderRadius.full),
  },
  myPositionRank: {
    fontFamily: fontFamily.semiBold,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: "#fff",
  },
  emptyState: {
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[6]),
    gap: toRN(tokens.spacing[2]),
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.bg.muted,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[2]),
  },
  emptyTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: toRN(tokens.typography.fontSize.base),
    color: colors.text.primary,
  },
  emptyText: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.secondary,
    textAlign: "center" as const,
  },
});
