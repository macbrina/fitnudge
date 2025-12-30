import Button from "@/components/ui/Button";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { toRN } from "@/lib/units";
import { SuggestedGoal } from "@/services/api/onboarding";
import { useTheme } from "@/themes";
import { useStyles } from "@/themes/makeStyles";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  NativeSyntheticEvent,
  Text,
  TextLayoutEventData,
  TouchableOpacity,
  View,
} from "react-native";

// Category info with icons instead of emojis
const CATEGORY_INFO: Record<
  string,
  { icon: keyof typeof Ionicons.glyphMap; label: string; color: string }
> = {
  fitness: { icon: "fitness-outline", label: "Fitness", color: "#FF6B6B" },
  nutrition: {
    icon: "nutrition-outline",
    label: "Nutrition",
    color: "#4ECDC4",
  },
  wellness: { icon: "leaf-outline", label: "Wellness", color: "#9B59B6" },
  mindfulness: {
    icon: "flower-outline",
    label: "Mindfulness",
    color: "#3498DB",
  },
  sleep: { icon: "moon-outline", label: "Sleep", color: "#2C3E50" },
};

// Goal type info
const GOAL_TYPE_INFO: Record<
  string,
  { icon: keyof typeof Ionicons.glyphMap; label: string }
> = {
  habit: { icon: "refresh-outline", label: "Habit" },
  time_challenge: { icon: "calendar-outline", label: "Time Challenge" },
  target_challenge: { icon: "flag-outline", label: "Target Challenge" },
};

interface SuggestionGoalCardProps {
  goal: SuggestedGoal;
  onUseThis: (goal: SuggestedGoal) => void;
}

export function SuggestionGoalCard({
  goal,
  onUseThis,
}: SuggestionGoalCardProps) {
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isMatchReasonExpanded, setIsMatchReasonExpanded] = useState(false);
  const [descriptionNeedsTruncation, setDescriptionNeedsTruncation] =
    useState(false);
  const [matchReasonNeedsTruncation, setMatchReasonNeedsTruncation] =
    useState(false);

  const { t } = useTranslation();
  const styles = useStyles(makeSuggestionGoalCardStyles);
  const { colors, brandColors } = useTheme();

  // Detect if description text is actually truncated based on line count
  const handleDescriptionLayout = (
    event: NativeSyntheticEvent<TextLayoutEventData>,
  ) => {
    // Only check when not expanded - if more than 2 lines, it needs truncation
    if (!isDescriptionExpanded && event.nativeEvent.lines.length > 2) {
      setDescriptionNeedsTruncation(true);
    }
  };

  // Detect if match reason text is actually truncated based on line count
  const handleMatchReasonLayout = (
    event: NativeSyntheticEvent<TextLayoutEventData>,
  ) => {
    // Only check when not expanded - if more than 2 lines, it needs truncation
    if (!isMatchReasonExpanded && event.nativeEvent.lines.length > 2) {
      setMatchReasonNeedsTruncation(true);
    }
  };

  // Get category and goal type info
  const categoryInfo = CATEGORY_INFO[goal.category] || CATEGORY_INFO.wellness;
  const goalType = goal.goal_type || "habit";
  const goalTypeInfo = GOAL_TYPE_INFO[goalType] || GOAL_TYPE_INFO.habit;

  return (
    <View style={styles.goalCard}>
      {/* Category & Goal Type Badges */}
      <View style={styles.badgesRow}>
        {/* Category Badge */}
        <View
          style={[
            styles.categoryBadge,
            { backgroundColor: categoryInfo.color + "20" },
          ]}
        >
          <Ionicons
            name={categoryInfo.icon}
            size={14}
            color={categoryInfo.color}
          />
          <Text style={[styles.categoryLabel, { color: categoryInfo.color }]}>
            {categoryInfo.label}
          </Text>
        </View>

        {/* Goal Type Badge */}
        <View
          style={[
            styles.goalTypeBadge,
            goalType !== "habit" && styles.challengeBadge,
          ]}
        >
          <Ionicons
            name={goalTypeInfo.icon}
            size={14}
            color={
              goalType !== "habit" ? brandColors.primary : colors.text.tertiary
            }
          />
          <Text
            style={[
              styles.goalTypeLabel,
              goalType !== "habit" && { color: brandColors.primary },
            ]}
          >
            {goalTypeInfo.label}
          </Text>
        </View>
      </View>

      {/* Goal Header */}
      <View style={styles.goalHeader}>
        <View style={styles.goalTitleContainer}>
          <Text style={styles.goalTitle} numberOfLines={2}>
            {goal.title}
          </Text>
        </View>
      </View>

      {/* Goal Description */}
      {goal.description && (
        <View style={styles.descriptionContainer}>
          {/* Hidden text for measuring actual line count */}
          {!isDescriptionExpanded && !descriptionNeedsTruncation && (
            <Text
              style={[styles.goalDescription, styles.hiddenMeasureText]}
              onTextLayout={handleDescriptionLayout}
            >
              {goal.description}
            </Text>
          )}
          <Text
            style={styles.goalDescription}
            numberOfLines={isDescriptionExpanded ? undefined : 2}
          >
            {goal.description}
          </Text>
          {descriptionNeedsTruncation && (
            <TouchableOpacity
              onPress={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
              style={styles.expandButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.expandButtonText}>
                {isDescriptionExpanded
                  ? t("common.read_less")
                  : t("common.read_more")}
              </Text>
              <Ionicons
                name={isDescriptionExpanded ? "chevron-up" : "chevron-down"}
                size={14}
                color={brandColors.primary}
                style={styles.expandIcon}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Goal Details */}
      <View style={styles.goalDetails}>
        <View style={styles.goalDetailItem}>
          <Ionicons
            name="calendar-outline"
            size={16}
            color={colors.text.secondary}
            style={styles.detailIcon}
          />
          <Text style={styles.goalFrequency}>
            {t(`goals.frequency.${goal.frequency}`)}
          </Text>
        </View>
        {goal.target_days && (
          <View style={styles.goalDetailItem}>
            <Ionicons
              name="time-outline"
              size={16}
              color={colors.text.secondary}
              style={styles.detailIcon}
            />
            <Text style={styles.goalTargetDays}>
              {t("goals.target_days", { days: goal.target_days })}
            </Text>
          </View>
        )}
      </View>

      {/* Match Reason */}
      {goal.match_reason && (
        <View style={styles.matchReasonContainer}>
          <Ionicons
            name="bulb-outline"
            size={18}
            color={brandColors.primary}
            style={styles.matchReasonIcon}
          />
          {/* Hidden text for measuring actual line count */}
          {!isMatchReasonExpanded && !matchReasonNeedsTruncation && (
            <Text
              style={[styles.matchReason, styles.hiddenMeasureText]}
              onTextLayout={handleMatchReasonLayout}
            >
              {goal.match_reason}
            </Text>
          )}
          <Text
            style={styles.matchReason}
            numberOfLines={isMatchReasonExpanded ? undefined : 2}
          >
            {goal.match_reason}
          </Text>
          {matchReasonNeedsTruncation && (
            <TouchableOpacity
              onPress={() => setIsMatchReasonExpanded(!isMatchReasonExpanded)}
              style={styles.matchReasonExpand}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.expandButtonText}>
                {isMatchReasonExpanded
                  ? t("common.read_less")
                  : t("common.read_more")}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Use This Button */}
      <View style={styles.actionContainer}>
        <Button
          title={t("goals.create.use_this_suggestion")}
          onPress={() => onUseThis(goal)}
          variant="primary"
          size="md"
          fullWidth
          borderRadius="lg"
        />
      </View>
    </View>
  );
}

const makeSuggestionGoalCardStyles = (
  tokens: any,
  colors: any,
  brand: any,
) => ({
  goalCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: toRN(tokens.borderRadius.xl),
    marginBottom: toRN(tokens.spacing[4]),
    borderWidth: 2,
    borderColor: colors.border.default,
    overflow: "hidden" as const,
    shadowColor: colors.shadow.default,
    shadowOffset: { width: 0, height: toRN(2) },
    shadowOpacity: 0.08,
    shadowRadius: toRN(8),
    elevation: 3,
    padding: toRN(tokens.spacing[6]),
  },
  badgesRow: {
    flexDirection: "row" as const,
    gap: toRN(tokens.spacing[2]),
    marginBottom: toRN(tokens.spacing[3]),
  },
  categoryBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[1]),
    borderRadius: toRN(tokens.borderRadius.md),
    gap: toRN(tokens.spacing[1]),
  },
  categoryLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskMedium,
  },
  goalTypeBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[1]),
    borderRadius: toRN(tokens.borderRadius.md),
    backgroundColor: colors.bg.muted,
    gap: toRN(tokens.spacing[1]),
  },
  challengeBadge: {
    backgroundColor: brand.primary + "15",
  },
  goalTypeLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.tertiary,
  },
  goalHeader: {
    marginBottom: toRN(tokens.spacing[3]),
  },
  goalTitleContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    flexWrap: "wrap" as const,
    gap: toRN(tokens.spacing[2]),
  },
  goalTitle: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontWeight: tokens.typography.fontWeight.bold,
    color: colors.text.primary,
    fontFamily: fontFamily.groteskBold,
    flex: 1,
    minWidth: 0,
  },
  descriptionContainer: {
    marginBottom: toRN(tokens.spacing[4]),
  },
  goalDescription: {
    fontSize: toRN(tokens.typography.fontSize.base),
    color: colors.text.secondary,
    fontFamily: fontFamily.groteskRegular,
    lineHeight: toRN(tokens.typography.fontSize.base * 1.5),
  },
  hiddenMeasureText: {
    position: "absolute" as const,
    opacity: 0,
    pointerEvents: "none" as const,
  },
  expandButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginTop: toRN(tokens.spacing[2]),
    alignSelf: "flex-start" as const,
  },
  expandButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: brand.primary,
    fontFamily: fontFamily.groteskMedium,
  },
  expandIcon: {
    marginLeft: toRN(tokens.spacing[1]),
  },
  goalDetails: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[4]),
  },
  goalDetailItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: colors.bg.muted,
    paddingHorizontal: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[1.5]),
    borderRadius: toRN(tokens.borderRadius.md),
  },
  detailIcon: {
    marginRight: toRN(tokens.spacing[2]),
  },
  goalFrequency: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.secondary,
    fontFamily: fontFamily.groteskMedium,
  },
  goalTargetDays: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.secondary,
    fontFamily: fontFamily.groteskMedium,
  },
  matchReasonContainer: {
    flexDirection: "column" as const,
    backgroundColor: brand.primary + "10",
    padding: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.md),
    marginBottom: toRN(tokens.spacing[4]),
  },
  matchReasonIcon: {
    marginBottom: toRN(tokens.spacing[2]),
  },
  matchReason: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: brand.primary,
    fontFamily: fontFamily.groteskMedium,
    lineHeight: toRN(tokens.typography.fontSize.sm * 1.4),
    marginBottom: toRN(tokens.spacing[1]),
  },
  matchReasonExpand: {
    alignSelf: "flex-start" as const,
    marginTop: toRN(tokens.spacing[1]),
  },
  actionContainer: {
    marginTop: toRN(tokens.spacing[2]),
  },
});
