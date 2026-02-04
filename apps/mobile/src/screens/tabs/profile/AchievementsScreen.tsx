import React, { useState, useMemo } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useStyles, useTheme } from "@/themes";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import {
  useMyAchievements,
  useAchievementTypes,
  useAchievementStats,
  getRarityColor,
  getBadgeIcon
} from "@/hooks/api/useAchievements";
import { UserAchievement, AchievementType } from "@/services/api";
import { AchievementsSkeleton } from "@/components/skeletons";
import BackButton from "@/components/ui/BackButton";
import { formatDate } from "@/utils/helper";

type TabType = "badges" | "earned";

export default function AchievementsScreen() {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<TabType>("badges");

  const { data: achievements, isLoading: loadingAchievements, refetch } = useMyAchievements();
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);
  const { data: achievementTypes, isLoading: loadingTypes } = useAchievementTypes();
  const { data: stats } = useAchievementStats();

  const isLoading = loadingAchievements || loadingTypes;

  // Create a set of earned achievement type IDs for quick lookup
  const earnedTypeIds = useMemo(() => {
    return new Set(achievements?.map((a) => a.achievement_type_id) || []);
  }, [achievements]);

  // Featured badges (first 3 earned, sorted by most recent)
  const featuredBadges = useMemo(() => {
    if (!achievements) return [];
    return [...achievements]
      .sort((a, b) => new Date(b.unlocked_at).getTime() - new Date(a.unlocked_at).getTime())
      .slice(0, 3);
  }, [achievements]);

  // All achievement types with earned status - earned first, then by sort_order
  const allAchievementsWithStatus = useMemo(() => {
    if (!achievementTypes) return [];
    return achievementTypes
      .filter((type) => type.is_active)
      .map((type) => ({
        ...type,
        isEarned: earnedTypeIds.has(type.id),
        earnedData: achievements?.find((a) => a.achievement_type_id === type.id)
      }))
      .sort((a, b) => {
        // Earned first, then by sort_order within each group
        if (a.isEarned !== b.isEarned) {
          return a.isEarned ? -1 : 1;
        }
        return a.sort_order - b.sort_order;
      });
  }, [achievementTypes, earnedTypeIds, achievements]);

  if (isLoading) {
    return <AchievementsSkeleton />;
  }

  const totalEarned = achievements?.length || 0;
  const totalPoints = achievements?.reduce((sum, a) => sum + (a.points || 0), 0) || 0;

  const tabs = [
    { key: "badges" as TabType, label: t("achievements.badges") || "Badges" },
    { key: "earned" as TabType, label: t("achievements.earned") || "Earned" }
  ];

  return (
    <View style={styles.container}>
      <BackButton title={t("achievements.title")} onPress={() => router.back()} />

      {/* Segmented Control */}
      <View style={styles.tabContainer}>
        <SegmentedControl
          options={tabs.map((tab) => tab.label)}
          selectedIndex={tabs.findIndex((tab) => tab.key === activeTab)}
          onChange={(index) => setActiveTab(tabs[index].key)}
        />
      </View>

      <ScrollView
        style={styles.content}
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
        {activeTab === "badges" ? (
          <BadgesTab
            totalEarned={totalEarned}
            featuredBadges={featuredBadges}
            allAchievements={allAchievementsWithStatus}
            styles={styles}
            colors={colors}
            brandColors={brandColors}
            t={t}
          />
        ) : (
          <EarnedTab
            achievements={achievements || []}
            stats={stats}
            styles={styles}
            colors={colors}
            brandColors={brandColors}
            t={t}
          />
        )}
      </ScrollView>
    </View>
  );
}

// Badges Tab Component
function BadgesTab({
  totalEarned,
  featuredBadges,
  allAchievements,
  styles,
  colors,
  brandColors,
  t
}: {
  totalEarned: number;
  featuredBadges: UserAchievement[];
  allAchievements: (AchievementType & { isEarned: boolean; earnedData?: UserAchievement })[];
  styles: any;
  colors: any;
  brandColors: any;
  t: (key: string) => string;
}) {
  return (
    <>
      {/* Hero Section */}
      <View style={styles.heroSection}>
        <Text style={[styles.heroCount, { color: brandColors.primary }]}>{totalEarned}</Text>
        <Text style={styles.heroLabel}>
          {t("achievements.badges_unlocked") || "Badges Unlocked"}
        </Text>
      </View>

      {/* Featured Badges */}
      {featuredBadges.length > 0 && (
        <View style={styles.featuredSection}>
          <View style={styles.featuredBadges}>
            {featuredBadges.map((badge, index) => (
              <FeaturedBadge
                key={badge.id}
                badge={badge}
                index={index}
                totalBadges={featuredBadges.length}
                styles={styles}
                colors={colors}
                brandColors={brandColors}
              />
            ))}
          </View>
        </View>
      )}

      {/* All Achievements */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t("achievements.all_achievements") || "All Achievements"}
        </Text>

        <View style={styles.achievementsList}>
          {allAchievements.map((achievement) => (
            <AchievementListItem
              key={achievement.id}
              achievement={achievement}
              styles={styles}
              colors={colors}
              brandColors={brandColors}
            />
          ))}
        </View>
      </View>
    </>
  );
}

// Earned Tab Component
function EarnedTab({
  achievements,
  stats,
  styles,
  colors,
  brandColors,
  t
}: {
  achievements: UserAchievement[];
  stats: any;
  styles: any;
  colors: any;
  brandColors: any;
  t: (key: string) => string;
}) {
  const totalPoints = achievements.reduce((sum, a) => sum + (a.points || 0), 0);

  // Sort by most recent
  const sortedAchievements = [...achievements].sort(
    (a, b) => new Date(b.unlocked_at).getTime() - new Date(a.unlocked_at).getTime()
  );

  return (
    <>
      {/* Stats Card */}
      <Card shadow="md" style={styles.statsCard}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: brandColors.primary }]}>
              {achievements.length}
            </Text>
            <Text style={styles.statLabel}>{t("achievements.badges_earned")}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: brandColors.primary }]}>{totalPoints}</Text>
            <Text style={styles.statLabel}>{t("achievements.total_points")}</Text>
          </View>
        </View>

        {/* Rarity breakdown */}
        {stats?.rarity_breakdown && (
          <View style={styles.rarityRow}>
            <RarityBadge
              rarity="common"
              count={stats.rarity_breakdown.common || 0}
              styles={styles}
              colors={colors}
              brandColors={brandColors}
            />
            <RarityBadge
              rarity="rare"
              count={stats.rarity_breakdown.rare || 0}
              styles={styles}
              colors={colors}
              brandColors={brandColors}
            />
            <RarityBadge
              rarity="epic"
              count={stats.rarity_breakdown.epic || 0}
              styles={styles}
              colors={colors}
              brandColors={brandColors}
            />
            <RarityBadge
              rarity="legendary"
              count={stats.rarity_breakdown.legendary || 0}
              styles={styles}
              colors={colors}
              brandColors={brandColors}
            />
          </View>
        )}
      </Card>

      {/* Earned Badges List */}
      {sortedAchievements.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("achievements.your_badges")}</Text>
          <View style={styles.earnedList}>
            {sortedAchievements.map((achievement) => (
              <EarnedBadgeItem
                key={achievement.id}
                achievement={achievement}
                styles={styles}
                colors={colors}
                brandColors={brandColors}
              />
            ))}
          </View>
        </View>
      ) : (
        <Card shadow="md" style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🏆</Text>
          <Text style={styles.emptyTitle}>{t("achievements.no_achievements")}</Text>
          <Text style={styles.emptyMessage}>{t("achievements.no_achievements_message")}</Text>
        </Card>
      )}
    </>
  );
}

// Featured Badge Component
function FeaturedBadge({
  badge,
  index,
  totalBadges,
  styles,
  colors,
  brandColors
}: {
  badge: UserAchievement;
  index: number;
  totalBadges: number;
  styles: any;
  colors: any;
  brandColors: any;
}) {
  const { t } = useTranslation();
  const badgeIcon = getBadgeIcon(badge.badge_key);
  const rarityColor = getRarityColor(badge.rarity, { colors, brandColors });
  const earnedDate = formatDate(badge.unlocked_at, "short");
  const badgeName = t(`achievements.badge_list.${badge.badge_key}.name`, {
    defaultValue: badge.badge_name
  });

  // Determine if this badge should be elevated (center/featured)
  // For 3 badges: middle (index 1) is elevated
  // For 2 badges: first (index 0) is elevated (most recent)
  // For 1 badge: it's elevated (centered and large)
  const isElevated =
    totalBadges === 1 || (totalBadges === 2 && index === 0) || (totalBadges === 3 && index === 1);

  return (
    <View
      style={[
        styles.featuredBadgeItem,
        isElevated ? styles.featuredBadgeCenter : styles.featuredBadgeSide
      ]}
    >
      <View
        style={[
          styles.featuredBadgeCircle,
          isElevated && styles.featuredBadgeCircleCenter,
          { borderColor: rarityColor }
        ]}
      >
        <Text style={[styles.featuredBadgeIcon, isElevated && styles.featuredBadgeIconCenter]}>
          {badgeIcon}
        </Text>
      </View>
      <Text style={styles.featuredBadgeName} numberOfLines={2}>
        {badgeName}
      </Text>
      <Text style={styles.featuredBadgeTime}>{earnedDate}</Text>
    </View>
  );
}

// Achievement List Item (for All Achievements)
function AchievementListItem({
  achievement,
  styles,
  colors,
  brandColors
}: {
  achievement: AchievementType & { isEarned: boolean; earnedData?: UserAchievement };
  styles: any;
  colors: any;
  brandColors: any;
}) {
  const { t } = useTranslation();
  const badgeIcon = getBadgeIcon(achievement.badge_key);
  const rarityColor = getRarityColor(achievement.rarity, { colors, brandColors });
  const badgeName = t(`achievements.badge_list.${achievement.badge_key}.name`, {
    defaultValue: achievement.badge_name
  });
  const badgeDescription = t(`achievements.badge_list.${achievement.badge_key}.description`, {
    defaultValue: achievement.badge_description || ""
  });

  return (
    <Card style={[styles.achievementCard, !achievement.isEarned && styles.achievementCardLocked]}>
      <View style={styles.achievementCardContent}>
        {/* Icon */}
        <View
          style={[
            styles.achievementIcon,
            { borderColor: achievement.isEarned ? rarityColor : colors.border.default }
          ]}
        >
          {achievement.isEarned ? (
            <Text style={styles.achievementIconText}>{badgeIcon}</Text>
          ) : (
            <Ionicons name="help" size={20} color={colors.text.tertiary} />
          )}
        </View>

        {/* Info */}
        <View style={styles.achievementInfo}>
          <Text
            style={[styles.achievementName, !achievement.isEarned && styles.achievementNameLocked]}
          >
            {badgeName}
          </Text>
          <Text style={styles.achievementDescription} numberOfLines={1}>
            {badgeDescription ||
              `${achievement.unlock_condition.type}: ${achievement.unlock_condition.value}`}
          </Text>
        </View>

        {/* Status */}
        <View style={styles.achievementStatus}>
          {achievement.isEarned ? (
            <View style={[styles.earnedBadge, { backgroundColor: `${brandColors.primary}15` }]}>
              <Ionicons name="checkmark" size={16} color={brandColors.primary} />
            </View>
          ) : (
            <View style={styles.lockedBadge}>
              <Ionicons name="lock-closed" size={14} color={colors.text.tertiary} />
            </View>
          )}
        </View>
      </View>
    </Card>
  );
}

// Earned Badge Item (for Earned tab list)
function EarnedBadgeItem({
  achievement,
  styles,
  colors,
  brandColors
}: {
  achievement: UserAchievement;
  styles: any;
  colors: any;
  brandColors: any;
}) {
  const { t } = useTranslation();
  const badgeIcon = getBadgeIcon(achievement.badge_key);
  const rarityColor = getRarityColor(achievement.rarity, { colors, brandColors });
  const earnedDate = formatDate(achievement.unlocked_at, "short");
  const badgeName = t(`achievements.badge_list.${achievement.badge_key}.name`, {
    defaultValue: achievement.badge_name
  });
  const badgeDescription = t(`achievements.badge_list.${achievement.badge_key}.description`, {
    defaultValue: achievement.badge_description || ""
  });

  return (
    <Card style={styles.earnedCard}>
      <View style={styles.earnedCardContent}>
        {/* Icon */}
        <View style={[styles.earnedIcon, { borderColor: rarityColor }]}>
          <Text style={styles.earnedIconText}>{badgeIcon}</Text>
        </View>

        {/* Info */}
        <View style={styles.earnedInfo}>
          <Text style={styles.earnedName}>{badgeName}</Text>
          <Text style={styles.earnedDescription} numberOfLines={2}>
            {badgeDescription}
          </Text>
          <View style={styles.earnedMeta}>
            <Text style={[styles.earnedRarity, { color: rarityColor }]}>{achievement.rarity}</Text>
            <Text style={styles.earnedDot}>•</Text>
            <Text style={styles.earnedTime}>{earnedDate}</Text>
            <Text style={styles.earnedDot}>•</Text>
            <Text style={styles.earnedPoints}>+{achievement.points} pts</Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

// Rarity Badge Component
function RarityBadge({
  rarity,
  count,
  styles,
  colors,
  brandColors
}: {
  rarity: string;
  count: number;
  styles: any;
  colors: any;
  brandColors: any;
}) {
  const color = getRarityColor(rarity, { colors, brandColors });

  return (
    <View style={styles.rarityItem}>
      <View style={[styles.rarityDot, { backgroundColor: color }]} />
      <Text style={styles.rarityCount}>{count}</Text>
      <Text style={styles.rarityLabel}>{rarity}</Text>
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  tabContainer: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[3])
  },
  content: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[8])
  },

  // Hero Section
  heroSection: {
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[6])
  },
  heroCount: {
    fontSize: 64,
    fontFamily: fontFamily.bold
  },
  heroLabel: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
    marginTop: toRN(tokens.spacing[1])
  },

  // Featured Section - Podium style (^ shape)
  featuredSection: {
    marginBottom: toRN(tokens.spacing[6]),
    alignItems: "center" as const
  },
  featuredBadges: {
    flexDirection: "row" as const,
    justifyContent: "center" as const,
    alignItems: "flex-start" as const, // Align to top so we can push sides down
    gap: toRN(tokens.spacing[4])
  },
  featuredBadgeItem: {
    alignItems: "center" as const,
    width: 110
  },
  // Side badges - pushed down to create ^ effect
  featuredBadgeSide: {
    marginTop: toRN(tokens.spacing[6]) // Push down to be lower than center
  },
  // Center/Elevated badge - stays at top
  featuredBadgeCenter: {
    marginTop: 0
  },
  featuredBadgeCircle: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.bg.card,
    borderWidth: 2,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  featuredBadgeCircleCenter: {
    width: 88,
    height: 88,
    borderRadius: 22
  },
  featuredBadgeIcon: {
    fontSize: 28
  },
  featuredBadgeIconCenter: {
    fontSize: 40
  },
  featuredBadgeName: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    textAlign: "center" as const,
    marginTop: toRN(tokens.spacing[2])
  },
  featuredBadgeTime: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[0.5])
  },

  // Section
  section: {
    marginBottom: toRN(tokens.spacing[4])
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[3])
  },

  // Achievement List Item
  achievementsList: {
    gap: toRN(tokens.spacing[2])
  },
  achievementCard: {
    padding: toRN(tokens.spacing[3])
  },
  achievementCardLocked: {
    opacity: 0.7
  },
  achievementCardContent: {
    flexDirection: "row" as const,
    alignItems: "center" as const
  },
  achievementIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.bg.secondary,
    borderWidth: 2,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  achievementIconText: {
    fontSize: 20
  },
  achievementInfo: {
    flex: 1,
    marginLeft: toRN(tokens.spacing[3])
  },
  achievementName: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  achievementNameLocked: {
    color: colors.text.secondary
  },
  achievementDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[0.5])
  },
  achievementStatus: {
    marginLeft: toRN(tokens.spacing[2])
  },
  earnedBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  lockedBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bg.muted,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },

  // Stats Card
  statsCard: {
    marginBottom: toRN(tokens.spacing[4])
  },
  statsRow: {
    flexDirection: "row" as const,
    justifyContent: "space-around" as const,
    alignItems: "center" as const
  },
  statItem: {
    alignItems: "center" as const,
    flex: 1
  },
  statValue: {
    fontSize: toRN(tokens.typography.fontSize["3xl"]),
    fontFamily: fontFamily.bold
  },
  statLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    marginTop: toRN(tokens.spacing[1])
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border.default
  },
  rarityRow: {
    flexDirection: "row" as const,
    justifyContent: "space-around" as const,
    marginTop: toRN(tokens.spacing[4]),
    paddingTop: toRN(tokens.spacing[3]),
    borderTopWidth: 1,
    borderTopColor: colors.border.default
  },
  rarityItem: {
    alignItems: "center" as const
  },
  rarityDot: {
    width: 12,
    height: 12,
    borderRadius: 6
  },
  rarityCount: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    marginTop: toRN(tokens.spacing[1])
  },
  rarityLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    textTransform: "capitalize" as const
  },

  // Earned List
  earnedList: {
    gap: toRN(tokens.spacing[3])
  },
  earnedCard: {
    padding: toRN(tokens.spacing[4])
  },
  earnedCardContent: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const
  },
  earnedIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.bg.secondary,
    borderWidth: 2,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  earnedIconText: {
    fontSize: 24
  },
  earnedInfo: {
    flex: 1,
    marginLeft: toRN(tokens.spacing[3])
  },
  earnedName: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  earnedDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    marginTop: toRN(tokens.spacing[1])
  },
  earnedMeta: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginTop: toRN(tokens.spacing[2])
  },
  earnedRarity: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    textTransform: "capitalize" as const
  },
  earnedDot: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    color: colors.text.tertiary,
    marginHorizontal: toRN(tokens.spacing[1])
  },
  earnedTime: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },
  earnedPoints: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary
  },

  // Empty State
  emptyCard: {
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[8])
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: toRN(tokens.spacing[3])
  },
  emptyTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[2])
  },
  emptyMessage: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[4])
  }
});
