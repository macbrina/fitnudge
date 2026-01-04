import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { SkeletonBox } from "@/components/ui/SkeletonBox";

export interface HabitChainDay {
  date: string;
  completed: boolean;
  isFuture?: boolean;
}

interface HabitChainCompactProps {
  data: HabitChainDay[];
  days?: number;
  isLoading?: boolean;
  onDayPress?: (day: HabitChainDay) => void;
}

export function HabitChainCompact({
  data = [],
  days = 30,
  isLoading = false,
  onDayPress
}: HabitChainCompactProps) {
  const styles = useStyles(makeHabitChainCompactStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();

  // Calculate stats
  const completedCount = data.filter((day) => day.completed && !day.isFuture).length;
  const totalPastDays = data.filter((day) => !day.isFuture).length;
  const percentage = totalPastDays > 0 ? Math.round((completedCount / totalPastDays) * 100) : 0;

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <SkeletonBox width="40%" height={16} borderRadius={toRN(tokens.borderRadius.sm)} />
          <SkeletonBox width="25%" height={16} borderRadius={toRN(tokens.borderRadius.sm)} />
        </View>
        <SkeletonBox
          width="100%"
          height={40}
          borderRadius={toRN(tokens.borderRadius.md)}
          style={{ marginTop: toRN(tokens.spacing[2]) }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {t("goals.progress.last_days", { days }) || `Last ${days} days`}
        </Text>
        <Text style={styles.stats}>
          {completedCount}/{totalPastDays} ({percentage}%)
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chainContent}
      >
        {data.map((day, index) => {
          const isToday = index === data.length - 1 && !day.isFuture;

          return (
            <TouchableOpacity
              key={`${day.date}-${index}`}
              onPress={() => onDayPress?.(day)}
              style={[
                styles.dayDot,
                day.isFuture && styles.dayDotFuture,
                day.completed && !day.isFuture && styles.dayDotCompleted,
                !day.completed && !day.isFuture && styles.dayDotMissed,
                isToday && styles.dayDotToday
              ]}
              activeOpacity={0.7}
              disabled={day.isFuture}
            >
              {isToday && <View style={styles.todayIndicator} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${percentage}%`, backgroundColor: brandColors.primary }
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const makeHabitChainCompactStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    marginBottom: toRN(tokens.spacing[4])
  },
  header: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[3])
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary
  },
  stats: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.secondary
  },
  chainContent: {
    gap: toRN(tokens.spacing[1]),
    paddingVertical: toRN(tokens.spacing[2])
  },
  dayDot: {
    width: toRN(tokens.spacing[2]),
    height: toRN(tokens.spacing[6]),
    borderRadius: toRN(tokens.borderRadius.sm),
    position: "relative" as const
  },
  dayDotCompleted: {
    backgroundColor: brand.primary
  },
  dayDotMissed: {
    backgroundColor: colors.feedback.error,
    opacity: 0.3
  },
  dayDotFuture: {
    backgroundColor: colors.bg.muted,
    opacity: 0.5
  },
  dayDotToday: {
    borderWidth: 2,
    borderColor: brand.primary,
    backgroundColor: brand.primary
  },
  todayIndicator: {
    position: "absolute" as const,
    bottom: -8,
    left: "50%" as any,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: brand.primary,
    marginLeft: -2
  },
  progressBarContainer: {
    marginTop: toRN(tokens.spacing[3])
  },
  progressBarBg: {
    height: toRN(tokens.spacing[2]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.full),
    overflow: "hidden" as const
  },
  progressBarFill: {
    height: "100%",
    borderRadius: toRN(tokens.borderRadius.full)
  }
});
