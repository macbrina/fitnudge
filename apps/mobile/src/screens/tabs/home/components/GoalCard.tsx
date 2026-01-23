import React, { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, ViewStyle, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Card } from "@/components/ui/Card";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { MOBILE_ROUTES } from "@/lib/routes";
import {
  Flame,
  CheckCircle,
  Clock,
  Circle,
  MessageCircle,
  ChevronDown,
  Moon,
  XCircle
} from "lucide-react-native";
import { TodayCheckinStatus } from "@/services/api/goals";
import { tokens } from "@/themes/tokens";
import { formatReminderTime } from "@/utils/helper";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  FadeIn,
  LinearTransition
} from "react-native-reanimated";

interface GoalCardProps {
  goal: {
    id: string;
    title: string;
    frequency_type?: string;
    frequency_count?: number;
    current_streak?: number;
    longest_streak?: number;
    total_completions?: number;
    status?: string;
    // V2 additions
    today_checkin_status?: TodayCheckinStatus;
    progress_this_week?: { completed: number; target: number } | null;
    reminder_times?: string[] | null;
  };
  /** Compact mode for horizontal scroll on home screen */
  compact?: boolean;
  onPress?: () => void;
  /** Callback to open AI coach for this specific goal */
  onTalkToBuddy?: (goalId: string) => void;
  style?: ViewStyle;
}

export function GoalCard({ goal, compact = false, onPress, onTalkToBuddy, style }: GoalCardProps) {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push({
        pathname: MOBILE_ROUTES.GOALS.DETAILS,
        params: { id: goal.id }
      });
    }
  };

  const handleTalkToBuddy = () => {
    if (onTalkToBuddy) {
      onTalkToBuddy(goal.id);
    }
  };

  const currentStreak = goal.current_streak || 0;
  const isArchived = goal.status === "archived";
  const todayStatus = goal.today_checkin_status;
  const hasCheckedInToday = todayStatus != null;

  // Render status icon based on today's check-in status
  const renderStatusIcon = (size: number = 20) => {
    switch (todayStatus) {
      case "completed":
        return <CheckCircle size={size} color={colors.feedback.success} />;
      case "rest_day":
        return <Moon size={size} color={brandColors.primary} />;
      case "skipped":
        return <XCircle size={size} color={colors.feedback.error} />;
      default:
        return <Circle size={size} color={colors.text.tertiary} />;
    }
  };

  // Format frequency text
  const frequencyText =
    goal.frequency_type === "daily"
      ? t("goals.frequency.daily")
      : `${goal.frequency_count || 3}x/${t("goals.frequency.week")}`;

  const nextReminder = goal.reminder_times?.[0];

  // Weekly progress text
  const weeklyProgressText =
    goal.frequency_type === "weekly" && goal.progress_this_week
      ? `${goal.progress_this_week.completed}/${goal.progress_this_week.target} ${t("goals.this_week")}`
      : null;

  // Collapsible compact card state and animation
  const [isExpanded, setIsExpanded] = useState(false);
  const rotation = useSharedValue(0);

  const toggleExpand = useCallback(() => {
    rotation.value = withTiming(isExpanded ? 0 : 180, { duration: 300 });
    setIsExpanded((prev) => !prev);
  }, [isExpanded, rotation]);

  const chevronStyle = useAnimatedStyle(() => {
    "worklet";
    return {
      transform: [{ rotate: `${rotation.value}deg` }]
    };
  });

  // Check if there's expandable content
  const hasExpandableContent =
    weeklyProgressText || currentStreak > 0 || (!hasCheckedInToday && nextReminder);

  if (compact) {
    // Collapsible compact card for home screen list
    return (
      <Animated.View layout={LinearTransition.duration(400)}>
        <Card style={[styles.compactContainer, isArchived && styles.archived, style]}>
          {/* Always visible row: Status + Title + Actions */}
          <View style={styles.compactMainRow}>
            {/* Status indicator */}
            {renderStatusIcon(20)}

            {/* Title + Frequency - tappable to go to details */}
            <Pressable style={styles.compactTitleSection} onPress={handlePress}>
              <Text style={styles.compactTitle} numberOfLines={1} ellipsizeMode="tail">
                {goal.title}
              </Text>
              <Text style={styles.compactFrequency}>{frequencyText}</Text>
            </Pressable>

            {/* Action buttons */}
            <View style={styles.compactActions}>
              {/* Talk to buddy button */}
              {onTalkToBuddy && (
                <TouchableOpacity
                  style={styles.compactActionButton}
                  onPress={handleTalkToBuddy}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MessageCircle size={18} color={colors.text.tertiary} />
                </TouchableOpacity>
              )}

              {/* Expand toggle (only if there's content to show) */}
              {hasExpandableContent && (
                <TouchableOpacity
                  style={styles.compactActionButton}
                  onPress={toggleExpand}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Animated.View style={chevronStyle}>
                    <ChevronDown size={18} color={colors.text.tertiary} />
                  </Animated.View>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Expandable content - fades in when expanded */}
          {isExpanded && hasExpandableContent && (
            <Animated.View entering={FadeIn.duration(400)} style={styles.compactExpandedContent}>
              {/* Weekly Progress */}
              {weeklyProgressText && (
                <View style={styles.compactDetailRow}>
                  <Text style={styles.compactDetailText}>{weeklyProgressText}</Text>
                </View>
              )}

              {/* Streak */}
              <View style={styles.compactDetailRow}>
                <Flame size={14} color={brandColors.primary} />
                <Text style={[styles.compactDetailText, { color: brandColors.primary }]}>
                  {currentStreak} {t("goals.day_streak")}
                </Text>
              </View>

              {/* Reminder Time - show if no check-in today */}
              {!hasCheckedInToday && nextReminder && (
                <View style={styles.compactDetailRow}>
                  <Clock size={14} color={colors.text.tertiary} />
                  <Text style={styles.compactDetailText}>
                    {t("goals.check_in_at")} {formatReminderTime(nextReminder)}
                  </Text>
                </View>
              )}
            </Animated.View>
          )}
        </Card>
      </Animated.View>
    );
  }

  // Full card (original layout for goals list)
  const totalCompletions = goal.total_completions || 0;

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
      <Card style={[styles.container, isArchived && styles.archived, style]}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
              {goal.title}
            </Text>
            <Text style={styles.frequency}>{frequencyText}</Text>
          </View>

          {/* Today's status indicator */}
          {renderStatusIcon(24)}
        </View>

        <View style={styles.statsRow}>
          {/* Streak */}
          <View style={styles.statItem}>
            <Flame
              size={16}
              color={currentStreak > 0 ? brandColors.primary : colors.text.tertiary}
            />
            <Text style={[styles.statValue, currentStreak > 0 && { color: brandColors.primary }]}>
              {currentStreak}
            </Text>
            <Text style={styles.statLabel}>{t("goals.stats.streak")}</Text>
          </View>

          {/* Completions */}
          <View style={styles.statItem}>
            <CheckCircle size={16} color={colors.feedback.success} />
            <Text style={styles.statValue}>{totalCompletions}</Text>
            <Text style={styles.statLabel}>{t("goals.stats.done")}</Text>
          </View>

          {/* Longest Streak */}
          <View style={styles.statItem}>
            <Flame size={16} color={colors.text.secondary} />
            <Text style={styles.statValue}>{goal.longest_streak || 0}</Text>
            <Text style={styles.statLabel}>{t("goals.stats.best")}</Text>
          </View>
        </View>

        {/* Talk to buddy button */}
        {onTalkToBuddy && !isArchived && (
          <TouchableOpacity
            style={styles.fullCardTalkButton}
            onPress={handleTalkToBuddy}
            activeOpacity={0.7}
          >
            <MessageCircle size={16} color={colors.text.primary} />
            <Text style={styles.fullCardTalkButtonText}>{t("home.talk_to_buddy")}</Text>
          </TouchableOpacity>
        )}

        {isArchived && (
          <View style={styles.archivedBadge}>
            <Text style={styles.archivedText}>{t("goals.archived")}</Text>
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );
}

/**
 * Skeleton loading state for GoalCard (compact mode)
 * Matches the collapsible compact card layout
 */
interface GoalCardSkeletonProps {
  style?: ViewStyle;
}

export function GoalCardSkeleton({ style }: GoalCardSkeletonProps) {
  const styles = useStyles(makeStyles);

  return (
    <Card style={[styles.compactContainer, style]}>
      <View style={styles.compactMainRow}>
        {/* Status icon skeleton */}
        <SkeletonBox width={20} height={20} borderRadius={10} />

        {/* Title section skeleton */}
        <View style={styles.compactTitleSection}>
          <SkeletonBox
            width={160}
            height={toRN(tokens.typography.fontSize.base)}
            borderRadius={toRN(tokens.borderRadius.base)}
          />
          <SkeletonBox
            width={60}
            height={toRN(tokens.typography.fontSize.xs)}
            borderRadius={toRN(tokens.borderRadius.base)}
          />
        </View>

        {/* Action buttons skeleton */}
        <View style={styles.compactActions}>
          <SkeletonBox width={34} height={34} borderRadius={17} />
          <SkeletonBox width={34} height={34} borderRadius={17} />
        </View>
      </View>
    </Card>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  // Full card styles
  container: {
    padding: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[4])
  },
  archived: {
    opacity: 0.8
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[3]),
    gap: toRN(tokens.spacing[3])
  },
  titleContainer: {
    flex: 1
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontWeight: tokens.typography.fontWeight.semibold,
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[0.5])
  },
  frequency: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.tertiary,
    fontFamily: fontFamily.groteskRegular
  },
  statsRow: {
    flexDirection: "row" as const,
    justifyContent: "space-around" as const,
    paddingTop: toRN(tokens.spacing[3]),
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle
  },
  statItem: {
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[0.5])
  },
  statValue: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontWeight: tokens.typography.fontWeight.bold,
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary
  },
  statLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    color: colors.text.tertiary,
    fontFamily: fontFamily.groteskRegular
  },
  archivedBadge: {
    position: "absolute" as const,
    top: toRN(tokens.spacing[2]),
    right: toRN(tokens.spacing[8]),
    backgroundColor: colors.bg.muted,
    paddingHorizontal: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[1]),
    borderRadius: toRN(tokens.borderRadius.sm)
  },
  archivedText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    color: colors.text.tertiary,
    fontFamily: fontFamily.groteskMedium
  },

  // Compact card styles (collapsible list item for home screen)
  compactContainer: {
    padding: toRN(tokens.spacing[4])
  },
  compactMainRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3])
  },
  compactTitleSection: {
    flex: 1,
    gap: toRN(tokens.spacing[0.5])
  },
  compactTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontWeight: tokens.typography.fontWeight.semibold,
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary
  },
  compactFrequency: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    color: colors.text.tertiary,
    fontFamily: fontFamily.groteskRegular
  },
  compactActions: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1])
  },
  compactActionButton: {
    padding: toRN(tokens.spacing[2]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: colors.bg.muted
  },
  compactExpandedContent: {
    marginTop: toRN(tokens.spacing[3]),
    paddingTop: toRN(tokens.spacing[3]),
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    gap: toRN(tokens.spacing[2])
  },
  compactDetailRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2])
  },
  compactDetailText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.secondary,
    fontFamily: fontFamily.groteskRegular
  },

  // Full card talk button styles
  fullCardTalkButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[2]),
    marginTop: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.md),
    backgroundColor: colors.bg.muted
  },
  fullCardTalkButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.primary
  }
});
