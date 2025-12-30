import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { Card } from "@/components/ui/Card";
import { useRouter } from "expo-router";
import { MOBILE_ROUTES } from "@/lib/routes";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { ActiveItem } from "@/services/api/home";
import { Ionicons } from "@expo/vector-icons";
import Button from "@/components/ui/Button";
import { useGoals } from "@/hooks/api/useGoals";

interface ActiveItemsSummaryProps {
  items: ActiveItem[];
  isLoading: boolean;
}

/**
 * ActiveItemsSummary - Shows a summary card of active goals, challenges, and group goals
 * with a "View All" CTA to navigate to the Goals screen.
 */
export function ActiveItemsSummary({
  items,
  isLoading,
}: ActiveItemsSummaryProps) {
  const styles = useStyles(makeActiveItemsSummaryStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  // Check if user has any goals at all (including archived)
  const { data: goalsResponse } = useGoals();
  const hasAnyGoals = (goalsResponse?.data?.length ?? 0) > 0;

  // Count items by type
  const counts = React.useMemo(() => {
    const result = { goals: 0, challenges: 0 };
    items.forEach((item) => {
      if (item.type === "goal") result.goals++;
      else if (item.type === "challenge") result.challenges++;
    });
    return result;
  }, [items]);

  // Get preview names (first 2-3 items)
  const previewNames = React.useMemo(() => {
    return items.slice(0, 3).map((item) => item.data.title);
  }, [items]);

  const totalCount = items.length;
  const remainingCount = Math.max(0, totalCount - 3);

  const handleViewAll = () => {
    router.push(MOBILE_ROUTES.GOALS.LIST);
  };

  const handleCreate = () => {
    router.push(MOBILE_ROUTES.GOALS.CREATE);
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Card shadow="sm" style={styles.card}>
          <View style={styles.header}>
            <SkeletonBox
              width={40}
              height={40}
              borderRadius={toRN(tokens.borderRadius.lg)}
            />
            <View style={styles.headerText}>
              <SkeletonBox
                width="60%"
                height={20}
                borderRadius={toRN(tokens.borderRadius.sm)}
              />
              <SkeletonBox
                width="40%"
                height={14}
                borderRadius={toRN(tokens.borderRadius.sm)}
                style={{ marginTop: toRN(tokens.spacing[1]) }}
              />
            </View>
          </View>
          <SkeletonBox
            width="100%"
            height={40}
            borderRadius={toRN(tokens.borderRadius.lg)}
            style={{ marginTop: toRN(tokens.spacing[3]) }}
          />
        </Card>
      </View>
    );
  }

  // Empty state - for both goals and challenges
  if (!items || items.length === 0) {
    return (
      <View style={styles.container}>
        <Card shadow="sm" style={styles.card}>
          <View style={styles.emptyContent}>
            <View style={styles.emptyIconContainer}>
              <Ionicons
                name="rocket-outline"
                size={toRN(tokens.typography.fontSize["3xl"])}
                color={brandColors.primary}
              />
            </View>
            <Text style={styles.emptyTitle}>{t("home.no_items_title")}</Text>
            <Text style={styles.emptyMessage}>
              {t("home.no_items_message")}
            </Text>
            <Button
              variant="primary"
              size="sm"
              onPress={handleCreate}
              title={
                hasAnyGoals ? t("home.create_goal") : t("home.get_started")
              }
              leftIcon="add"
            />
          </View>
        </Card>
      </View>
    );
  }

  // Build count badges
  const badges: { icon: string; count: number; label: string }[] = [];
  if (counts.goals > 0) {
    badges.push({ icon: "🎯", count: counts.goals, label: "Goals" });
  }
  if (counts.challenges > 0) {
    badges.push({ icon: "🏆", count: counts.challenges, label: "Challenges" });
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={handleViewAll} activeOpacity={0.8}>
        <Card shadow="sm" style={styles.card}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons
                name="fitness-outline"
                size={toRN(tokens.typography.fontSize["2xl"])}
                color={brandColors.primary}
              />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>
                {t("home.active_goals_title")} ({totalCount})
              </Text>
              <Text style={styles.preview} numberOfLines={1}>
                {previewNames.join(", ")}
                {remainingCount > 0 && ` +${remainingCount} more`}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={toRN(tokens.typography.fontSize.xl)}
              color={colors.text.tertiary}
            />
          </View>

          {/* Type badges */}
          <View style={styles.badgesContainer}>
            {badges.map((badge) => (
              <View key={badge.label} style={styles.badge}>
                <Text style={styles.badgeIcon}>{badge.icon}</Text>
                <Text style={styles.badgeText}>
                  {badge.count} {badge.label}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      </TouchableOpacity>
    </View>
  );
}

const makeActiveItemsSummaryStyles = (
  tokens: any,
  colors: any,
  brand: any,
) => ({
  container: {
    marginBottom: toRN(tokens.spacing[4]),
  },
  card: {
    padding: toRN(tokens.spacing[4]),
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  iconContainer: {
    width: toRN(tokens.spacing[12]),
    height: toRN(tokens.spacing[12]),
    borderRadius: toRN(tokens.borderRadius.lg),
    backgroundColor: brand.primary + "15",
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginRight: toRN(tokens.spacing[3]),
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
  },
  preview: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    marginTop: toRN(tokens.spacing[0.5]),
  },
  badgesContainer: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: toRN(tokens.spacing[2]),
    marginTop: toRN(tokens.spacing[3]),
    paddingTop: toRN(tokens.spacing[3]),
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  badge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: colors.bg.muted,
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.full),
  },
  badgeIcon: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    marginRight: toRN(tokens.spacing[1]),
  },
  badgeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
  },
  emptyContent: {
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[4]),
  },
  emptyIconContainer: {
    width: toRN(tokens.spacing[16]),
    height: toRN(tokens.spacing[16]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: colors.bg.muted,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[3]),
  },
  emptyIcon: {
    fontSize: toRN(tokens.typography.fontSize["3xl"]),
  },
  emptyTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[1]),
  },
  emptyMessage: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[4]),
  },
  createButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: brand.primary,
    paddingVertical: toRN(tokens.spacing[2.5]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.full),
    gap: toRN(tokens.spacing[1]),
  },
  createButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: brand.onPrimary,
  },
});
