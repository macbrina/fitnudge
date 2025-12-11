import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
} from "react-native";
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Rect,
} from "react-native-svg";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { useTodayDailyMotivation } from "@/hooks/api/useDailyMotivations";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { DailyMotivationModal } from "./DailyMotivationModal";
import { Ionicons } from "@expo/vector-icons";
import { getContrastingTextColor } from "@/utils/helper";

interface MotivationCardProps {
  currentStreak: number;
}

export function MotivationCard({ currentStreak }: MotivationCardProps) {
  const styles = useStyles(makeMotivationCardStyles);
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);

  const {
    data: dailyMotivation,
    isLoading,
    error,
    refetch: refetchMotivation,
  } = useTodayDailyMotivation();

  // Calculate card width accounting for container padding (spacing[4] on each side)
  const screenWidth = Dimensions.get("window").width;
  const containerPadding = toRN(tokens.spacing[4]) * 2;
  const calculatedCardWidth = screenWidth - containerPadding;

  // Fallback gradient colors if API doesn't provide them
  const getFallbackGradient = (style: string): string[] => {
    switch (style) {
      case "gradient_sunset":
        return ["#FF9A9E", "#FECFEF", "#FECFEF"];
      case "gradient_mountain":
        return ["#E0C3FC", "#C8A8FF", "#9B7BFF"];
      case "gradient_ocean":
        return ["#667EEA", "#764BA2", "#667EEA"];
      case "gradient_forest":
        return ["#84FAB0", "#8FD3F4", "#84FAB0"];
      case "gradient_purple":
        return ["#A8EDEA", "#FED6E3", "#D299C2"];
      case "gradient_pink":
        return ["#FFECD2", "#FCB69F", "#FF9A9E"];
      default:
        return ["#FF9A9E", "#FECFEF", "#FECFEF"];
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <SkeletonBox
            width={120}
            height={toRN(tokens.typography.fontSize.lg)}
            borderRadius={toRN(tokens.borderRadius.base)}
          />
          <SkeletonBox
            width={60}
            height={toRN(tokens.typography.fontSize.base)}
            borderRadius={toRN(tokens.borderRadius.base)}
          />
        </View>
        <View style={styles.gradientCard}>
          <SkeletonBox
            width="100%"
            height={200}
            borderRadius={toRN(tokens.borderRadius.base)}
          />
        </View>
      </View>
    );
  }

  // Get gradient colors
  const gradientColors =
    dailyMotivation &&
    dailyMotivation.background_colors &&
    dailyMotivation.background_colors.length > 0
      ? dailyMotivation.background_colors
      : dailyMotivation
        ? getFallbackGradient(dailyMotivation.background_style)
        : ["#FF9A9E", "#FECFEF", "#FECFEF"];

  const motivationMessage = dailyMotivation
    ? dailyMotivation.message
    : currentStreak === 0
      ? t("home.motivation_start")
      : currentStreak < 7
        ? t("home.motivation_early", { streak: currentStreak })
        : currentStreak < 30
          ? t("home.motivation_growing", { streak: currentStreak })
          : t("home.motivation_strong", { streak: currentStreak });

  // Calculate contrasting text color based on gradient
  const textColor = getContrastingTextColor(gradientColors);

  return (
    <>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t("home.motivation_title")}</Text>
          {dailyMotivation && (
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.viewText}>{t("home.motivation_view")}</Text>
              <Ionicons
                name="chevron-forward"
                size={toRN(tokens.typography.fontSize.base)}
                color={colors.text.secondary}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Gradient Card with Motivation */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => dailyMotivation && setModalVisible(true)}
          style={styles.cardContainer}
        >
          <View style={styles.gradientCard}>
            {/* SVG Gradient Background */}
            <Svg
              width={calculatedCardWidth}
              height={200}
              style={StyleSheet.absoluteFill}
            >
              <Defs>
                <SvgLinearGradient
                  id="motivationGradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  {gradientColors.map((color, index) => (
                    <Stop
                      key={index}
                      offset={`${(index / (gradientColors.length - 1)) * 100}%`}
                      stopColor={color}
                      stopOpacity="1"
                    />
                  ))}
                </SvgLinearGradient>
              </Defs>
              <Rect
                width={calculatedCardWidth}
                height={200}
                rx={toRN(tokens.borderRadius.xl)}
                fill="url(#motivationGradient)"
              />
            </Svg>

            {/* Motivation Text */}
            <View style={styles.messageContainer}>
              <Text
                style={[styles.messageText, { color: textColor }]}
                numberOfLines={3}
              >
                {motivationMessage}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {dailyMotivation && (
        <DailyMotivationModal
          visible={modalVisible}
          motivation={dailyMotivation}
          onClose={() => setModalVisible(false)}
          onRegenerateComplete={() => {
            // Refetch the motivation after regeneration
            refetchMotivation();
          }}
        />
      )}
    </>
  );
}

const makeMotivationCardStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    marginBottom: toRN(tokens.spacing[4]),
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[1]),
  },
  headerTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
  },
  viewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: toRN(tokens.spacing[1]),
  },
  viewText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
  },
  cardContainer: {
    marginHorizontal: 0,
  },
  gradientCard: {
    width: "100%",
    minHeight: 200,
    borderRadius: toRN(tokens.borderRadius.xl),
    overflow: "hidden",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  messageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: toRN(tokens.spacing[6]),
    paddingVertical: toRN(tokens.spacing[8]),
  },
  messageText: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    // color is set dynamically based on gradient luminance
    textAlign: "center",
    lineHeight: toRN(tokens.typography.fontSize.lg) * 1.5,
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
