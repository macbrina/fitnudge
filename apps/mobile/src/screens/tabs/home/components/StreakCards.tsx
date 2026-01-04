import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from "react-native-svg";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { SkeletonBox } from "@/components/ui/SkeletonBox";

interface StreakCardsProps {
  currentStreak: number;
  longestStreak: number;
  isLoading?: boolean;
}

export function StreakCards({ currentStreak, longestStreak, isLoading = false }: StreakCardsProps) {
  const styles = useStyles(makeStreakCardsStyles);
  const { colors } = useTheme();
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <SkeletonBox width="48%" height={120} borderRadius={toRN(tokens.borderRadius.xl)} />
        <SkeletonBox width="48%" height={120} borderRadius={toRN(tokens.borderRadius.xl)} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Current Streak Card */}
      <View style={styles.card}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgLinearGradient id="currentStreakGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#FF6B6B" stopOpacity="1" />
              <Stop offset="100%" stopColor="#FF8E53" stopOpacity="1" />
            </SvgLinearGradient>
          </Defs>
          <Rect
            width="100%"
            height="100%"
            rx={toRN(tokens.borderRadius.xl)}
            fill="url(#currentStreakGradient)"
          />
        </Svg>
        <View style={styles.cardContent}>
          <Text style={styles.label}>{t("home.progress.current_streak")}</Text>
          <Text style={styles.value}>{currentStreak}</Text>
          <Text style={styles.unit}>
            {currentStreak === 1 ? t("home.streak_day") : t("home.streak_days")}
          </Text>
        </View>
      </View>

      {/* Longest Streak Card */}
      <View style={styles.card}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgLinearGradient id="longestStreakGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#FFD700" stopOpacity="1" />
              <Stop offset="100%" stopColor="#FFA500" stopOpacity="1" />
            </SvgLinearGradient>
          </Defs>
          <Rect
            width="100%"
            height="100%"
            rx={toRN(tokens.borderRadius.xl)}
            fill="url(#longestStreakGradient)"
          />
        </Svg>
        <View style={styles.cardContent}>
          <Text style={styles.label}>{t("home.progress.longest_streak")}</Text>
          <Text style={styles.value}>{longestStreak}</Text>
          <Text style={styles.unit}>
            {longestStreak === 1 ? t("home.streak_day") : t("home.streak_days")}
          </Text>
        </View>
      </View>
    </View>
  );
}

const makeStreakCardsStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flexDirection: "row" as const,
    gap: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[4])
  },
  card: {
    flex: 1,
    borderRadius: toRN(tokens.borderRadius.xl),
    minHeight: 120,
    position: "relative" as const,
    overflow: "hidden" as const,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6
  },
  cardContent: {
    flex: 1,
    padding: toRN(tokens.spacing[4]),
    alignItems: "center" as const,
    justifyContent: "center" as const,
    position: "relative" as const,
    zIndex: 1
  },
  icon: {
    fontSize: toRN(tokens.typography.fontSize["3xl"]),
    marginBottom: toRN(tokens.spacing[2])
  },
  label: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskMedium,
    color: "#FFFFFF",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: toRN(tokens.spacing[1]),
    textAlign: "center" as const
  },
  value: {
    fontSize: toRN(tokens.typography.fontSize["4xl"]),
    fontFamily: fontFamily.groteskBold,
    color: "#FFFFFF",
    lineHeight: toRN(tokens.typography.fontSize["4xl"]) * 1.1
  },
  unit: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskMedium,
    color: "#FFFFFF",
    opacity: 0.9
  }
});
