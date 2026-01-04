import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Card } from "@/components/ui/Card";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { EmptyState } from "./EmptyState";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { useMyAchievements, getRarityColor, getBadgeIcon } from "@/hooks/api/useAchievements";
import { UserAchievement } from "@/services/api";

interface AchievementsSectionProps {
  onViewAll?: () => void;
}

export function AchievementsSection({ onViewAll }: AchievementsSectionProps) {
  const styles = useStyles(makeAchievementsSectionStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();

  const { data: achievements, isLoading } = useMyAchievements();

  if (isLoading) {
    return (
      <Card shadow="md" style={styles.card}>
        <SkeletonBox
          width="50%"
          height={toRN(tokens.typography.fontSize.xl)}
          borderRadius={toRN(tokens.borderRadius.base)}
          style={{ marginBottom: toRN(tokens.spacing[4]) }}
        />
        <View style={styles.badgeGrid}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.badgeItem}>
              <SkeletonBox width={48} height={48} borderRadius={toRN(tokens.borderRadius.full)} />
              <SkeletonBox
                width="80%"
                height={toRN(tokens.typography.fontSize.xs)}
                borderRadius={toRN(tokens.borderRadius.base)}
                style={{ marginTop: toRN(tokens.spacing[1]) }}
              />
            </View>
          ))}
        </View>
      </Card>
    );
  }

  // Show latest 3 achievements
  const displayAchievements = achievements?.slice(0, 3) || [];

  if (displayAchievements.length === 0) {
    return (
      <Card shadow="md" style={styles.card}>
        <Text style={styles.title}>{t("home.achievements")}</Text>
        <EmptyState
          icon="ribbon-outline"
          title={t("home.no_achievements")}
          message={t("home.no_achievements_message")}
        />
      </Card>
    );
  }

  return (
    <Card shadow="md" style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("home.achievements")}</Text>
        {achievements && achievements.length > 3 && onViewAll && (
          <TouchableOpacity onPress={onViewAll}>
            <Text style={[styles.viewAll, { color: brandColors.primary }]}>
              {t("common.view_all")}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.badgeGrid}>
        {displayAchievements.map((achievement) => (
          <AchievementBadge key={achievement.id} achievement={achievement} />
        ))}
      </View>

      {/* Total points earned */}
      {achievements && achievements.length > 0 && (
        <View style={styles.pointsContainer}>
          <Text style={styles.pointsLabel}>{t("home.total_points")}</Text>
          <Text style={[styles.pointsValue, { color: brandColors.primary }]}>
            {achievements.reduce((sum, a) => sum + (a.points || 0), 0)}
          </Text>
        </View>
      )}
    </Card>
  );
}

function AchievementBadge({ achievement }: { achievement: UserAchievement }) {
  const styles = useStyles(makeAchievementsSectionStyles);
  const rarityColor = getRarityColor(achievement.rarity);
  const badgeIcon = getBadgeIcon(achievement.badge_key);

  return (
    <View style={styles.badgeItem}>
      <View style={[styles.badgeCircle, { borderColor: rarityColor }]}>
        <Text style={styles.badgeIcon}>{badgeIcon}</Text>
      </View>
      <Text style={styles.badgeName} numberOfLines={1}>
        {achievement.badge_name}
      </Text>
      <Text style={[styles.badgeRarity, { color: rarityColor }]}>{achievement.rarity}</Text>
    </View>
  );
}

const makeAchievementsSectionStyles = (tokens: any, colors: any, brand: any) => ({
  card: {
    marginBottom: toRN(tokens.spacing[4])
  },
  header: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[4])
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: colors.text.primary
  },
  viewAll: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold
  },
  badgeGrid: {
    flexDirection: "row" as const,
    justifyContent: "space-around" as const,
    gap: toRN(tokens.spacing[2])
  },
  badgeItem: {
    alignItems: "center" as const,
    flex: 1
  },
  badgeCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.bg.secondary,
    borderWidth: 3,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  badgeIcon: {
    fontSize: 24
  },
  badgeName: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginTop: toRN(tokens.spacing[1]),
    textAlign: "center" as const
  },
  badgeRarity: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    textTransform: "capitalize" as const
  },
  pointsContainer: {
    flexDirection: "row" as const,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginTop: toRN(tokens.spacing[4]),
    paddingTop: toRN(tokens.spacing[3]),
    borderTopWidth: 1,
    borderTopColor: colors.border.default
  },
  pointsLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    marginRight: toRN(tokens.spacing[2])
  },
  pointsValue: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold
  }
});
