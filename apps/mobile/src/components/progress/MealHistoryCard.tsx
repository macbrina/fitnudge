/**
 * MealHistoryCard - Individual meal card for the meal history list
 *
 * Shows:
 * - Photo thumbnail (if available, tappable to view full-size)
 * - Meal type icon
 * - Meal name and description
 * - Calories, protein, health rating
 * - Time logged
 */

import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/lib/i18n";
import { useStyles, useTheme } from "@/themes";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { MealLog, HealthRating, MealType } from "@/services/api/mealLogs";

interface MealHistoryCardProps {
  meal: MealLog;
  onPhotoPress?: (photoUrl: string) => void;
}

// Meal type icons and labels
const MEAL_TYPE_INFO: Record<MealType, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  breakfast: { icon: "sunny-outline", label: "Breakfast" },
  lunch: { icon: "restaurant-outline", label: "Lunch" },
  dinner: { icon: "moon-outline", label: "Dinner" },
  snack: { icon: "cafe-outline", label: "Snack" },
  other: { icon: "fast-food-outline", label: "Other" }
};

// Health rating colors and labels
const HEALTH_RATING_INFO: Record<HealthRating, { color: string; label: string }> = {
  healthy: { color: "#22C55E", label: "Healthy" },
  okay: { color: "#F59E0B", label: "Okay" },
  unhealthy: { color: "#EF4444", label: "Unhealthy" }
};

export function MealHistoryCard({ meal, onPhotoPress }: MealHistoryCardProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();

  const mealTypeInfo = MEAL_TYPE_INFO[meal.meal_type] || MEAL_TYPE_INFO.other;
  const healthRatingInfo = meal.health_rating ? HEALTH_RATING_INFO[meal.health_rating] : null;

  // Format time (e.g., "8:30 AM")
  const formattedTime = meal.logged_time ? formatTime(meal.logged_time) : null;

  return (
    <View style={styles.container}>
      {/* Photo thumbnail (if available) */}
      {meal.photo_url ? (
        <TouchableOpacity
          style={styles.photoContainer}
          onPress={() => onPhotoPress?.(meal.photo_url!)}
          activeOpacity={0.8}
        >
          <Image source={{ uri: meal.photo_url }} style={styles.photo} resizeMode="cover" />
        </TouchableOpacity>
      ) : (
        <View style={styles.noPhotoContainer}>
          <Ionicons name={mealTypeInfo.icon} size={24} color={colors.text.tertiary} />
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        {/* Header: Meal type + time */}
        <View style={styles.header}>
          <View style={styles.mealTypeRow}>
            <Ionicons name={mealTypeInfo.icon} size={14} color={brandColors.primary} />
            <Text style={styles.mealTypeText}>{mealTypeInfo.label}</Text>
          </View>
          {formattedTime && <Text style={styles.timeText}>{formattedTime}</Text>}
        </View>

        {/* Meal name */}
        <Text style={styles.mealName} numberOfLines={1}>
          {meal.meal_name || t("meals.unnamed_meal") || "Meal"}
        </Text>

        {/* Description (truncated) */}
        {meal.meal_description && (
          <Text style={styles.description} numberOfLines={1}>
            {meal.meal_description}
          </Text>
        )}

        {/* Stats row: calories, protein, health rating */}
        <View style={styles.statsRow}>
          {meal.estimated_calories != null && (
            <Text style={styles.statText}>
              {meal.estimated_calories} {t("meals.calories") || "cal"}
            </Text>
          )}
          {meal.estimated_protein != null && (
            <>
              <Text style={styles.statDivider}>•</Text>
              <Text style={styles.statText}>
                {meal.estimated_protein}g {t("meals.protein") || "protein"}
              </Text>
            </>
          )}
          {healthRatingInfo && (
            <>
              <Text style={styles.statDivider}>•</Text>
              <View
                style={[styles.healthBadge, { backgroundColor: healthRatingInfo.color + "20" }]}
              >
                {/* <View
                  style={[
                    styles.healthDot,
                    { backgroundColor: healthRatingInfo.color },
                  ]}
                /> */}
                <Text style={[styles.healthText, { color: healthRatingInfo.color }]}>
                  {healthRatingInfo.label}
                </Text>
              </View>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

// Helper to format time string (HH:MM:SS -> h:mm AM/PM)
function formatTime(timeString: string): string {
  try {
    const [hours, minutes] = timeString.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
  } catch {
    return timeString;
  }
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flexDirection: "row" as const,
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.lg),
    padding: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[2]),
    borderWidth: 1,
    borderColor: colors.border.subtle
  },
  photoContainer: {
    width: toRN(60),
    height: toRN(60),
    borderRadius: toRN(tokens.borderRadius.md),
    overflow: "hidden" as const,
    marginRight: toRN(tokens.spacing[3])
  },
  photo: {
    width: "100%" as const,
    height: "100%" as const
  },
  noPhotoContainer: {
    width: toRN(60),
    height: toRN(60),
    borderRadius: toRN(tokens.borderRadius.md),
    backgroundColor: colors.bg.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginRight: toRN(tokens.spacing[3])
  },
  content: {
    flex: 1,
    justifyContent: "center" as const
  },
  header: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[1])
  },
  mealTypeRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1])
  },
  mealTypeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: brand.primary
  },
  timeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },
  mealName: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[0.5])
  },
  description: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    marginBottom: toRN(tokens.spacing[1])
  },
  statsRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    flexWrap: "wrap" as const
  },
  statText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },
  statDivider: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    color: colors.text.tertiary,
    marginHorizontal: toRN(tokens.spacing[1])
  },
  healthBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[1.5]),
    paddingVertical: toRN(2),
    borderRadius: toRN(tokens.borderRadius.full),
    gap: toRN(tokens.spacing[0.5])
  },
  healthDot: {
    width: toRN(6),
    height: toRN(6),
    borderRadius: toRN(3)
  },
  healthText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium
  }
});

export default MealHistoryCard;
