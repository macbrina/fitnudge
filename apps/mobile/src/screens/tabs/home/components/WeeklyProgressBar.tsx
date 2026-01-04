import React from "react";
import { View, Text } from "react-native";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { Ionicons } from "@expo/vector-icons";

interface WeeklyProgressBarProps {
  completed: number;
  total: number;
  percentage: number;
  daysCompleted: boolean[]; // [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
  isLoading?: boolean;
}

export function WeeklyProgressBar({
  completed = 0,
  total = 7,
  percentage = 0,
  daysCompleted = [],
  isLoading = false
}: WeeklyProgressBarProps) {
  const styles = useStyles(makeWeeklyProgressBarStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();

  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

  if (isLoading) {
    return (
      <View style={styles.container}>
        <SkeletonBox width="40%" height={16} borderRadius={toRN(tokens.borderRadius.sm)} />
        <View style={styles.daysRow}>
          {dayLabels.map((_, index) => (
            <SkeletonBox
              key={index}
              width={toRN(tokens.spacing[10])}
              height={toRN(tokens.spacing[10])}
              borderRadius={toRN(tokens.borderRadius.full)}
            />
          ))}
        </View>
      </View>
    );
  }

  // Get today's day index (0 = Monday, 6 = Sunday)
  const todayIndex = (new Date().getDay() + 6) % 7; // Convert from Sunday=0 to Monday=0

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("home.progress.this_week")}</Text>
        <Text style={styles.stats}>
          {completed}/{total} {t("home.streak_days")}
        </Text>
      </View>

      <View style={styles.daysRow}>
        {dayLabels.map((label, index) => {
          const isCompleted = daysCompleted[index];
          const isToday = index === todayIndex;
          const isFuture = index > todayIndex;

          return (
            <View
              key={index}
              style={[
                styles.dayCircle,
                isCompleted && styles.dayCircleCompleted,
                isFuture && styles.dayCircleFuture,
                isToday && styles.dayCircleToday
              ]}
            >
              {isCompleted ? (
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              ) : (
                <Text
                  style={[
                    styles.dayLabel,
                    isFuture && styles.dayLabelFuture,
                    isToday && styles.dayLabelToday
                  ]}
                >
                  {label}
                </Text>
              )}
            </View>
          );
        })}
      </View>

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
        <Text style={styles.percentageText}>{percentage}%</Text>
      </View>
    </View>
  );
}

const makeWeeklyProgressBarStyles = (tokens: any, colors: any, brand: any) => ({
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
  daysRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    marginBottom: toRN(tokens.spacing[3])
  },
  dayCircle: {
    width: toRN(tokens.spacing[10]),
    height: toRN(tokens.spacing[10]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: colors.bg.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 2,
    borderColor: "transparent"
  },
  dayCircleCompleted: {
    backgroundColor: brand.primary,
    borderColor: brand.primary
  },
  dayCircleToday: {
    borderColor: brand.primary,
    borderWidth: 2
  },
  dayCircleFuture: {
    opacity: 0.5
  },
  dayLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.secondary
  },
  dayLabelToday: {
    color: brand.primary
  },
  dayLabelFuture: {
    color: colors.text.disabled
  },
  progressBarContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3])
  },
  progressBarBg: {
    flex: 1,
    height: toRN(tokens.spacing[2]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.full),
    overflow: "hidden" as const
  },
  progressBarFill: {
    height: "100%",
    borderRadius: toRN(tokens.borderRadius.full)
  },
  percentageText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.secondary,
    minWidth: toRN(tokens.spacing[10]),
    textAlign: "right" as const
  }
});
