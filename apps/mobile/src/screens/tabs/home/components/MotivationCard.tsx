import React, { useState } from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { useTodayDailyMotivation } from "@/hooks/api/useDailyMotivations";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { DailyMotivationModal } from "./DailyMotivationModal";
import { ChevronRight } from "lucide-react-native";

interface MotivationCardProps {
  currentStreak: number;
}

export function MotivationCard({ currentStreak }: MotivationCardProps) {
  const styles = useStyles(makeMotivationCardStyles);
  const { colors, brandColors, isDark } = useTheme();
  const { t } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);

  const {
    data: dailyMotivation,
    isLoading,
    refetch: refetchMotivation
  } = useTodayDailyMotivation();

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
        <SkeletonBox width="100%" height={120} borderRadius={toRN(tokens.borderRadius.xl)} />
      </View>
    );
  }

  const motivationMessage = dailyMotivation
    ? dailyMotivation.message
    : currentStreak === 0
      ? t("home.motivation_start")
      : currentStreak < 7
        ? t("home.motivation_early", { streak: currentStreak })
        : currentStreak < 30
          ? t("home.motivation_growing", { streak: currentStreak })
          : t("home.motivation_strong", { streak: currentStreak });

  // Card background
  const cardBgColor = isDark ? colors.bg.card : "#ffffff";

  return (
    <>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>
            {t("home.motivation_title")}
          </Text>
          {dailyMotivation && (
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.viewText, { color: colors.text.secondary }]}>
                {t("home.motivation_view")}
              </Text>
              <ChevronRight size={14} color={colors.text.secondary} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>

        {/* Clean Quote Card */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => dailyMotivation && setModalVisible(true)}
          style={[
            styles.card,
            {
              backgroundColor: cardBgColor,
              borderLeftColor: brandColors.primary,
              shadowColor: isDark ? brandColors.primary : "#000"
            }
          ]}
        >
          {/* Decorative Quote Mark */}
          <Text
            style={[styles.quoteMark, { color: brandColors.primary, opacity: isDark ? 0.15 : 0.1 }]}
          >
            "
          </Text>

          {/* Motivation Text */}
          <Text style={[styles.messageText, { color: colors.text.primary }]} numberOfLines={4}>
            {motivationMessage}
          </Text>

          {/* Subtle border */}
          <View
            style={[
              styles.innerBorder,
              {
                borderColor: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)"
              }
            ]}
          />
        </TouchableOpacity>
      </View>

      {dailyMotivation && (
        <DailyMotivationModal
          visible={modalVisible}
          motivation={dailyMotivation}
          onClose={() => setModalVisible(false)}
          onRegenerateComplete={() => {
            refetchMotivation();
          }}
        />
      )}
    </>
  );
}

const makeMotivationCardStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    marginBottom: toRN(tokens.spacing[4])
  },
  header: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[1])
  },
  headerTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.bold
  },
  viewButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4
  },
  viewText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular
  },
  card: {
    borderRadius: toRN(tokens.borderRadius.xl),
    borderLeftWidth: 4,
    paddingVertical: toRN(tokens.spacing[5]),
    paddingHorizontal: toRN(tokens.spacing[5]),
    paddingLeft: toRN(tokens.spacing[6]),
    minHeight: 120,
    justifyContent: "center" as const,
    overflow: "hidden" as const,
    position: "relative" as const,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12
      },
      android: {
        elevation: 4
      }
    })
  },
  quoteMark: {
    position: "absolute" as const,
    top: -10,
    left: 12,
    fontSize: 100,
    fontFamily: fontFamily.bold,
    lineHeight: 100
  },
  innerBorder: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: toRN(tokens.borderRadius.xl),
    borderWidth: 1,
    borderLeftWidth: 0
  },
  messageText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.mediumItalic, // Use italic for quote style
    fontStyle: "italic" as const,
    lineHeight: toRN(tokens.typography.fontSize.base) * 1.6,
    zIndex: 1
  }
});
