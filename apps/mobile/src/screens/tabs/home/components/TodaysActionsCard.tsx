import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "@/components/ui/Card";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { EmptyState } from "./EmptyState";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { CheckInModal } from "./CheckInModal";
import { ChallengeCheckInModal } from "@/screens/tabs/challenges/components/ChallengeCheckInModal";
import { CheckIn } from "@/services/api/checkins";
import { PendingCheckIn } from "@/services/api/home";
import type { Challenge } from "@/services/api/challenges";
import { useQueryClient } from "@tanstack/react-query";
import { homeDashboardQueryKeys } from "@/hooks/api/useHomeDashboard";

interface TodaysActionsCardProps {
  /** Combined pending check-ins (goals + challenges) */
  pendingCheckIns?: PendingCheckIn[];
  /** Legacy: Today's goal check-ins only */
  todayCheckIns?: any[];
  isLoading: boolean;
}

export function TodaysActionsCard({
  pendingCheckIns: combinedPendingCheckIns,
  todayCheckIns,
  isLoading,
}: TodaysActionsCardProps) {
  const styles = useStyles(makeTodaysActionsCardStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // State for modals
  const [selectedGoalCheckIn, setSelectedGoalCheckIn] =
    useState<CheckIn | null>(null);
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(
    null
  );

  // Use combined data if available, fallback to legacy todayCheckIns
  const pendingItems: PendingCheckIn[] =
    combinedPendingCheckIns ||
    todayCheckIns
      ?.filter((c: any) => !c.is_checked_in)
      .map((c: any) => ({
        type: "goal" as const,
        data: c,
        item: c.goal,
      })) ||
    [];

  const totalPending = pendingItems.length;
  const goalPending = pendingItems.filter((i) => i.type === "goal").length;
  const challengePending = pendingItems.filter(
    (i) => i.type === "challenge"
  ).length;

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
    // Check if there are any check-ins at all (completed ones)
    const hasAnyCheckIns = todayCheckIns && todayCheckIns.length > 0;

    if (hasAnyCheckIns) {
      return (
        <Card shadow="md" style={styles.card}>
          <Text style={styles.title}>{t("home.today_actions")}</Text>
          <EmptyState
            icon="✅"
            title={t("home.all_done_title")}
            message={t("home.all_done_message")}
          />
        </Card>
      );
    }

    return (
      <Card shadow="md" style={styles.card}>
        <Text style={styles.title}>{t("home.today_actions")}</Text>
        <EmptyState
          icon="🎯"
          title={t("home.no_checkins_today")}
          message={t("home.no_checkins_message")}
        />
      </Card>
    );
  }

  const handleItemPress = (item: PendingCheckIn) => {
    if (item.type === "goal") {
      // For goal check-ins, the data contains the check-in record
      setSelectedGoalCheckIn(item.data as unknown as CheckIn);
    } else if (item.type === "challenge") {
      // For challenge check-ins, we need to open the modal with the challenge ID
      const challenge = item.item as Challenge;
      setSelectedChallengeId(challenge.id);
    }
  };

  const handleCheckInComplete = () => {
    // Invalidate the dashboard query to refresh data
    queryClient.invalidateQueries({
      queryKey: homeDashboardQueryKeys.dashboard(),
    });
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
    item: PendingCheckIn
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

      {/* Goal Check-in Modal */}
      {selectedGoalCheckIn && (
        <CheckInModal
          visible={!!selectedGoalCheckIn}
          checkIn={selectedGoalCheckIn}
          onClose={() => setSelectedGoalCheckIn(null)}
          onComplete={handleCheckInComplete}
        />
      )}

      {/* Challenge Check-in Modal */}
      {selectedChallengeId && (
        <ChallengeCheckInModal
          visible={!!selectedChallengeId}
          challengeId={selectedChallengeId}
          onClose={() => setSelectedChallengeId(null)}
          onComplete={handleCheckInComplete}
        />
      )}
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
