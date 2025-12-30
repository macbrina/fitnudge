import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Card } from "@/components/ui/Card";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { EmptyState } from "./EmptyState";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { CheckIn } from "@/services/api/checkins";
import { PendingCheckIn } from "@/services/api/home";
import type { Challenge, TrackingType } from "@/services/api/challenges";
import type { Goal } from "@/services/api/goals";
import { MOBILE_ROUTES } from "@/lib/routes";

interface TodaysActionsCardProps {
  /** Combined pending check-ins (goals + challenges) from today_pending_checkins */
  pendingCheckIns: PendingCheckIn[];
  isLoading: boolean;
  /** Callback when a check-in item is selected (for checkin tracking_type) */
  onCheckInPress?: (
    checkIn: CheckIn,
    isChallenge: boolean,
    entityId: string,
  ) => void;
  /** Callback when a meal log item is selected */
  onMealLogPress?: (entityId: string, isChallenge: boolean) => void;
  /** Callback when a hydration item is selected */
  onHydrationPress?: (entityId: string, isChallenge: boolean) => void;
}

export function TodaysActionsCard({
  pendingCheckIns,
  isLoading,
  onCheckInPress,
  onMealLogPress,
  onHydrationPress,
}: TodaysActionsCardProps) {
  const styles = useStyles(makeTodaysActionsCardStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  // The backend already filters to only include pending check-ins from active entities
  // This is a safety filter in case any slip through
  const pendingItems = pendingCheckIns.filter((item) => {
    const status = (item.item as any)?.status;
    // Goals: only "active", Challenges: "active" or "upcoming"
    if (item.type === "goal") {
      return status === "active";
    } else {
      return status === "active" || status === "upcoming";
    }
  });

  const totalPending = pendingItems.length;

  if (isLoading) {
    return (
      <Card shadow="md" style={styles.card}>
        <SkeletonBox
          width="60%"
          height={toRN(tokens.typography.fontSize.xl)}
          borderRadius={toRN(tokens.borderRadius.base)}
          style={{ marginBottom: toRN(tokens.spacing[4]) }}
        />
        <View style={styles.checkInsList}>
          {[1, 2].map((i) => (
            <SkeletonBox
              key={i}
              width="100%"
              height={60}
              borderRadius={toRN(tokens.borderRadius.lg)}
              style={{ marginBottom: toRN(tokens.spacing[3]) }}
            />
          ))}
        </View>
      </Card>
    );
  }

  if (totalPending === 0) {
    // Check if there were any check-ins scheduled today (but all completed)
    // Since we only get pending check-ins, we show "no check-ins today" for empty
    return (
      <Card shadow="md" style={styles.card}>
        <Text style={styles.title}>{t("home.today_actions")}</Text>
        <EmptyState
          icon="checkmark-done-outline"
          title={t("home.no_checkins_today")}
          message={t("home.no_checkins_message")}
        />
      </Card>
    );
  }

  const handleItemPress = (item: PendingCheckIn) => {
    // Get tracking_type from the goal or challenge
    const trackingType: TrackingType =
      (item.item as any)?.tracking_type || "checkin";
    const isChallenge = item.type === "challenge";

    if (item.type === "goal") {
      const goal = item.item as Goal;

      switch (trackingType) {
        case "workout":
          router.push(MOBILE_ROUTES.WORKOUT.PLAYER(goal.id));
          break;
        case "meal":
          onMealLogPress?.(goal.id, false);
          break;
        case "hydration":
          onHydrationPress?.(goal.id, false);
          break;
        case "checkin":
        default:
          onCheckInPress?.(item.data as unknown as CheckIn, false, goal.id);
          break;
      }
    } else if (item.type === "challenge") {
      const challenge = item.item as Challenge;

      switch (trackingType) {
        case "workout":
          router.push(MOBILE_ROUTES.WORKOUT.CHALLENGE_PLAYER(challenge.id));
          break;
        case "meal":
          onMealLogPress?.(challenge.id, true);
          break;
        case "hydration":
          onHydrationPress?.(challenge.id, true);
          break;
        case "checkin":
        default:
          onCheckInPress?.(item.data as unknown as CheckIn, true, challenge.id);
          break;
      }
    }
  };

  const getItemTitle = (item: PendingCheckIn): string => {
    if (item.type === "goal") {
      return (item.item as any)?.title || t("common.goal") || "Goal";
    } else {
      return (
        (item.item as Challenge)?.title || t("common.challenge") || "Challenge"
      );
    }
  };

  const getItemIcon = (
    item: PendingCheckIn,
  ): keyof typeof Ionicons.glyphMap => {
    if (item.type === "goal") {
      return "flag-outline";
    } else {
      return "trophy-outline";
    }
  };

  const getItemColor = (item: PendingCheckIn): string => {
    if (item.type === "goal") {
      return brandColors.primary;
    } else {
      return "#F59E0B"; // Amber for challenges
    }
  };

  return (
    <Card shadow="md" style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("home.today_actions")}</Text>
        <Text style={styles.subtitle}>
          {totalPending}{" "}
          {totalPending === 1
            ? t("home.pending_checkin")
            : t("home.pending_checkins")}
        </Text>
      </View>

      <View style={styles.checkInsList}>
        {pendingItems.slice(0, 3).map((item, index) => {
          const title = getItemTitle(item);
          const icon = getItemIcon(item);
          const iconColor = getItemColor(item);
          const key =
            item.type === "goal"
              ? `goal-${(item.data as any).id || index}`
              : `challenge-${(item.item as Challenge).id}`;

          return (
            <TouchableOpacity
              key={key}
              style={styles.checkInItem}
              onPress={() => handleItemPress(item)}
            >
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: `${iconColor}15` },
                ]}
              >
                <Ionicons name={icon} size={18} color={iconColor} />
              </View>
              <View style={styles.checkInContent}>
                <Text style={styles.checkInGoal} numberOfLines={1}>
                  {title}
                </Text>
                <Text style={styles.checkInLabel}>
                  {item.type === "goal"
                    ? t("home.complete_checkin")
                    : t("home.complete_challenge_checkin") ||
                      "Complete check-in"}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.text.tertiary}
              />
            </TouchableOpacity>
          );
        })}

        {totalPending > 3 && (
          <Text style={styles.moreText}>
            {t("home.and_more", { count: totalPending - 3 })}
          </Text>
        )}
      </View>
    </Card>
  );
}

const makeTodaysActionsCardStyles = (tokens: any, colors: any, brand: any) => ({
  card: {
    marginBottom: toRN(tokens.spacing[4]),
  },
  header: {
    marginBottom: toRN(tokens.spacing[4]),
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[1]),
  },
  subtitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
  },
  checkInsList: {
    gap: toRN(tokens.spacing[3]),
  },
  checkInItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.lg),
    gap: toRN(tokens.spacing[3]),
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  checkInContent: {
    flex: 1,
  },
  checkInGoal: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[0.5]),
  },
  checkInLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
  },
  moreText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    textAlign: "center" as const,
    marginTop: toRN(tokens.spacing[2]),
  },
});
