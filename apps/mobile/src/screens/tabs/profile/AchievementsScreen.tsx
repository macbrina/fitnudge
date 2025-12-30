import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { Card } from "@/components/ui/Card";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import {
  useMyAchievements,
  useAchievementStats,
  getRarityColor,
  getBadgeIcon,
} from "@/hooks/api/useAchievements";
import { UserAchievement } from "@/services/api";

export default function AchievementsScreen() {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();

  const {
    data: achievements,
    isLoading,
    refetch,
    isRefetching,
  } = useMyAchievements();

  const { data: stats } = useAchievementStats();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("achievements.title")}</Text>
          <View style={styles.backButton} />
        </View>
        <ScrollView style={styles.content}>
          <Card shadow="md" style={styles.statsCard}>
            <SkeletonBox width="100%" height={80} />
          </Card>
          <View style={styles.badgeGrid}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <View key={i} style={styles.badgeItem}>
                <SkeletonBox
                  width={72}
                  height={72}
                  borderRadius={toRN(tokens.borderRadius.full)}
                />
                <SkeletonBox
                  width="80%"
                  height={14}
                  borderRadius={toRN(tokens.borderRadius.base)}
                  style={{ marginTop: toRN(tokens.spacing[2]) }}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  const totalPoints =
    achievements?.reduce((sum, a) => sum + (a.points || 0), 0) || 0;
  const totalAchievements = achievements?.length || 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("achievements.title")}</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={brandColors.primary}
          />
        }
      >
        {/* Stats Card */}
        <Card shadow="md" style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: brandColors.primary }]}>
                {totalAchievements}
              </Text>
              <Text style={styles.statLabel}>
                {t("achievements.badges_earned")}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: brandColors.primary }]}>
                {totalPoints}
              </Text>
              <Text style={styles.statLabel}>
                {t("achievements.total_points")}
              </Text>
            </View>
          </View>

          {/* Rarity breakdown */}
          {stats?.by_rarity && (
            <View style={styles.rarityRow}>
              <RarityBadge
                rarity="common"
                count={stats.by_rarity.common || 0}
              />
              <RarityBadge rarity="rare" count={stats.by_rarity.rare || 0} />
              <RarityBadge rarity="epic" count={stats.by_rarity.epic || 0} />
              <RarityBadge
                rarity="legendary"
                count={stats.by_rarity.legendary || 0}
              />
            </View>
          )}
        </Card>

        {/* Achievements Grid */}
        {achievements && achievements.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("achievements.your_badges")}
            </Text>
            <View style={styles.badgeGrid}>
              {achievements.map((achievement) => (
                <AchievementBadge
                  key={achievement.id}
                  achievement={achievement}
                />
              ))}
            </View>
          </View>
        ) : (
          <Card shadow="md" style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🏆</Text>
            <Text style={styles.emptyTitle}>
              {t("achievements.no_achievements")}
            </Text>
            <Text style={styles.emptyMessage}>
              {t("achievements.no_achievements_message")}
            </Text>
          </Card>
        )}

        {/* Bottom spacing */}
        <View style={{ height: toRN(tokens.spacing[8]) }} />
      </ScrollView>
    </View>
  );
}

function AchievementBadge({ achievement }: { achievement: UserAchievement }) {
  const styles = useStyles(makeStyles);
  const rarityColor = getRarityColor(achievement.rarity);
  const badgeIcon = getBadgeIcon(achievement.badge_key);

  return (
    <View style={styles.badgeItem}>
      <View style={[styles.badgeCircle, { borderColor: rarityColor }]}>
        <Text style={styles.badgeIcon}>{badgeIcon}</Text>
      </View>
      <Text style={styles.badgeName} numberOfLines={2}>
        {achievement.badge_name}
      </Text>
      <Text style={[styles.badgeRarity, { color: rarityColor }]}>
        {achievement.rarity}
      </Text>
      <Text style={styles.badgePoints}>+{achievement.points} pts</Text>
    </View>
  );
}

function RarityBadge({ rarity, count }: { rarity: string; count: number }) {
  const styles = useStyles(makeStyles);
  const color = getRarityColor(rarity);

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
    backgroundColor: colors.bg.canvas,
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[3]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  headerTitle: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingTop: toRN(tokens.spacing[4]),
  },
  statsCard: {
    marginBottom: toRN(tokens.spacing[4]),
  },
  statsRow: {
    flexDirection: "row" as const,
    justifyContent: "space-around" as const,
    alignItems: "center" as const,
  },
  statItem: {
    alignItems: "center" as const,
    flex: 1,
  },
  statValue: {
    fontSize: toRN(tokens.typography.fontSize["3xl"]),
    fontFamily: fontFamily.bold,
  },
  statLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    marginTop: toRN(tokens.spacing[1]),
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border.default,
  },
  rarityRow: {
    flexDirection: "row" as const,
    justifyContent: "space-around" as const,
    marginTop: toRN(tokens.spacing[4]),
    paddingTop: toRN(tokens.spacing[3]),
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  rarityItem: {
    alignItems: "center" as const,
  },
  rarityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  rarityCount: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    marginTop: toRN(tokens.spacing[1]),
  },
  rarityLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    textTransform: "capitalize" as const,
  },
  section: {
    marginBottom: toRN(tokens.spacing[4]),
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[3]),
  },
  badgeGrid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    justifyContent: "flex-start" as const,
    gap: toRN(tokens.spacing[3]),
  },
  badgeItem: {
    width: "30%" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[2]),
  },
  badgeCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.bg.secondary,
    borderWidth: 3,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  badgeIcon: {
    fontSize: 32,
  },
  badgeName: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginTop: toRN(tokens.spacing[2]),
    textAlign: "center" as const,
  },
  badgeRarity: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    textTransform: "capitalize" as const,
    marginTop: toRN(tokens.spacing[0.5]),
  },
  badgePoints: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[0.5]),
  },
  emptyCard: {
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[8]),
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: toRN(tokens.spacing[3]),
  },
  emptyTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[2]),
  },
  emptyMessage: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
  },
});
