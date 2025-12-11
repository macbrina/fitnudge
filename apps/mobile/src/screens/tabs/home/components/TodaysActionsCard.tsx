import React, { useState } from "react";
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
import { CheckInModal } from "./CheckInModal";
import { CheckIn } from "@/services/api/checkins";
import { useTodayCheckIns } from "@/hooks/api/useCheckIns";

interface TodaysActionsCardProps {
  todayCheckIns: any[];
  isLoading: boolean;
}

export function TodaysActionsCard({
  todayCheckIns,
  isLoading,
}: TodaysActionsCardProps) {
  const styles = useStyles(makeTodaysActionsCardStyles);
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { refetch: refetchTodayCheckIns } = useTodayCheckIns();
  const [selectedCheckIn, setSelectedCheckIn] = useState<CheckIn | null>(null);

  // Filter by is_checked_in (user has responded yes or no)
  // not by completed (which just means they did the goal)
  const pendingCheckIns =
    todayCheckIns?.filter((checkIn) => !checkIn.is_checked_in) || [];
  const checkedInCount =
    todayCheckIns?.filter((checkIn) => checkIn.is_checked_in).length || 0;

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

  if (pendingCheckIns.length === 0 && checkedInCount === 0) {
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

  if (pendingCheckIns.length === 0) {
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

  const handleCheckInPress = (checkIn: any) => {
    setSelectedCheckIn(checkIn as CheckIn);
  };

  const handleCheckInComplete = () => {
    refetchTodayCheckIns();
  };

  return (
    <Card shadow="md" style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("home.today_actions")}</Text>
        <Text style={styles.subtitle}>
          {pendingCheckIns.length}{" "}
          {pendingCheckIns.length === 1
            ? t("home.pending_checkin")
            : t("home.pending_checkins")}
        </Text>
      </View>
      <View style={styles.checkInsList}>
        {pendingCheckIns.slice(0, 3).map((checkIn) => {
          const goalTitle = checkIn.goal?.title || t("common.goal") || "Goal";
          return (
            <TouchableOpacity
              key={checkIn.id}
              style={styles.checkInItem}
              onPress={() => handleCheckInPress(checkIn)}
            >
              <View style={styles.checkInContent}>
                <Text style={styles.checkInGoal}>{goalTitle}</Text>
                <Text style={styles.checkInLabel}>
                  {t("home.complete_checkin")}
                </Text>
              </View>
              <Text style={styles.arrow}>→</Text>
            </TouchableOpacity>
          );
        })}
        {pendingCheckIns.length > 3 && (
          <Text style={styles.moreText}>
            {t("home.and_more", { count: pendingCheckIns.length - 3 })}
          </Text>
        )}
      </View>

      {selectedCheckIn && (
        <CheckInModal
          visible={!!selectedCheckIn}
          checkIn={selectedCheckIn}
          onClose={() => setSelectedCheckIn(null)}
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.lg),
  },
  checkInContent: {
    flex: 1,
  },
  checkInGoal: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[1]),
  },
  checkInLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
  },
  arrow: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    color: brand.primary,
  },
  moreText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    textAlign: "center",
    marginTop: toRN(tokens.spacing[2]),
  },
});
