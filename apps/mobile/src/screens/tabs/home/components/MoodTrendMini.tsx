import React from "react";
import { View, Text } from "react-native";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { SkeletonBox } from "@/components/ui/SkeletonBox";

interface MoodData {
  date: string;
  mood: number; // 1-5
}

interface MoodTrendMiniProps {
  data: MoodData[];
  days?: number;
  isLoading?: boolean;
}

const MOOD_EMOJIS = ["😞", "😐", "😊", "😄", "🤩"];

export function MoodTrendMini({
  data = [],
  days = 7,
  isLoading = false,
}: MoodTrendMiniProps) {
  const styles = useStyles(makeMoodTrendMiniStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();

  // Calculate average mood
  const validMoods = data.filter((d) => d.mood >= 1 && d.mood <= 5);
  const avgMood =
    validMoods.length > 0
      ? validMoods.reduce((sum, d) => sum + d.mood, 0) / validMoods.length
      : 0;

  const avgMoodRounded = Math.round(avgMood);
  const avgMoodEmoji =
    avgMoodRounded > 0 ? MOOD_EMOJIS[avgMoodRounded - 1] : "😐";

  // Determine trend
  let trendIcon = "→";
  let trendText = t("home.progress.mood_stable");
  let trendColor: string = colors.text.secondary;

  if (validMoods.length >= 2) {
    const firstHalf = validMoods
      .slice(0, Math.ceil(validMoods.length / 2))
      .reduce((sum, d) => sum + d.mood, 0);
    const secondHalf = validMoods
      .slice(Math.ceil(validMoods.length / 2))
      .reduce((sum, d) => sum + d.mood, 0);

    const firstAvg = firstHalf / Math.ceil(validMoods.length / 2);
    const secondAvg =
      secondHalf / Math.floor(validMoods.length - validMoods.length / 2);

    if (secondAvg > firstAvg + 0.3) {
      trendIcon = "↗";
      trendText = t("home.progress.mood_improving");
      trendColor = colors.feedback.success as string;
    } else if (secondAvg < firstAvg - 0.3) {
      trendIcon = "↘";
      trendText = t("home.progress.mood_declining");
      trendColor = colors.feedback.warning as string;
    }
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <SkeletonBox
          width="40%"
          height={16}
          borderRadius={toRN(tokens.borderRadius.sm)}
        />
        <View style={styles.moodRow}>
          {[...Array(7)].map((_, index) => (
            <SkeletonBox
              key={index}
              width={toRN(tokens.spacing[8])}
              height={toRN(tokens.spacing[8])}
              borderRadius={toRN(tokens.borderRadius.md)}
            />
          ))}
        </View>
      </View>
    );
  }

  if (validMoods.length === 0) {
    return null; // Don't show if no mood data
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("home.progress.mood_trend")}</Text>
        <View style={styles.avgContainer}>
          <Text style={styles.avgEmoji}>{avgMoodEmoji}</Text>
          <Text style={styles.avgText}>
            {Number.isInteger(avgMood) ? avgMood : avgMood.toFixed(1)}/5
          </Text>
        </View>
      </View>

      <View style={styles.moodRow}>
        {data.slice(-7).map((day, index) => (
          <View key={index} style={styles.moodCell}>
            {day.mood ? (
              <Text style={styles.moodEmoji}>{MOOD_EMOJIS[day.mood - 1]}</Text>
            ) : (
              <View style={styles.emptyMood} />
            )}
          </View>
        ))}
      </View>

      <View style={styles.trendContainer}>
        <Text style={[styles.trendIcon, { color: trendColor }]}>
          {trendIcon}
        </Text>
        <Text style={[styles.trendText, { color: trendColor }]}>
          {trendText}
        </Text>
      </View>
    </View>
  );
}

const makeMoodTrendMiniStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    marginBottom: toRN(tokens.spacing[4]),
  },
  header: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[3]),
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary,
  },
  avgContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
  },
  avgEmoji: {
    fontSize: toRN(tokens.typography.fontSize.lg),
  },
  avgText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskBold,
    color: brand.primary,
  },
  moodRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    marginBottom: toRN(tokens.spacing[3]),
  },
  moodCell: {
    width: toRN(tokens.spacing[8]),
    height: toRN(tokens.spacing[8]),
    borderRadius: toRN(tokens.borderRadius.md),
    backgroundColor: colors.bg.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  moodEmoji: {
    fontSize: toRN(tokens.typography.fontSize.lg),
  },
  emptyMood: {
    width: toRN(tokens.spacing[2]),
    height: toRN(tokens.spacing[2]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: colors.border.default,
  },
  trendContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.md),
  },
  trendIcon: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskBold,
  },
  trendText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskMedium,
  },
});
