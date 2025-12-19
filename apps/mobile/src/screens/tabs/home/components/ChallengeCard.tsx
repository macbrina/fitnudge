import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Card } from "@/components/ui/Card";
import { BottomMenuSheet } from "@/components/ui/BottomMenuSheet";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { Ionicons } from "@expo/vector-icons";
import { MOBILE_ROUTES } from "@/lib/routes";
import { Challenge } from "@/services/api/challenges";
import { useJoinChallenge } from "@/hooks/api/useChallenges";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { useChallengeMenu } from "@/hooks/useChallengeMenu";

interface ChallengeCardProps {
  challenge: Challenge;
  onPress?: () => void;
  onJoined?: () => void;
  onLeft?: () => void;
  showMenu?: boolean;
  variant?: "default" | "compact" | "discovery"; // Different display modes
  activeChallengesCount?: number; // Current active challenge count for limit checking
  style?: any;
}

export function ChallengeCard({
  challenge,
  onPress,
  onJoined,
  onLeft,
  showMenu = false,
  variant = "default",
  activeChallengesCount = 0,
  style,
}: ChallengeCardProps) {
  const styles = useStyles(makeChallengeCardStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { showAlert, showConfirm } = useAlertModal();

  const [menuVisible, setMenuVisible] = useState(false);

  const joinChallenge = useJoinChallenge();

  // Subscription store for feature access
  const hasFeature = useSubscriptionStore((state) => state.hasFeature);
  const canParticipateInChallenge = useSubscriptionStore(
    (state) => state.canParticipateInChallenge
  );
  const getChallengeLimit = useSubscriptionStore(
    (state) => state.getChallengeLimit
  );

  // Feature checks
  const canJoinChallenges = hasFeature?.("challenge_join") ?? false;
  const challengeLimit = getChallengeLimit?.() ?? 0;
  const canJoinMore =
    canParticipateInChallenge?.(activeChallengesCount) ?? false;

  // Determine challenge status
  const isCreator = challenge.is_creator === true;
  const isParticipant = challenge.is_participant === true;
  const isUpcoming = challenge.status === "upcoming";
  const isActive =
    challenge.status === "active" || challenge.is_active === true;
  const isCompleted = challenge.status === "completed";
  const isCancelled = challenge.status === "cancelled";

  // Challenge menu hook (shared with ChallengeDetailScreen)
  const { menuSections } = useChallengeMenu({
    challenge,
    onClose: () => setMenuVisible(false),
    onLeft,
  });

  // Format dates
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const startDate = formatDate(challenge.start_date);
  const endDate = formatDate(challenge.end_date);

  // Get status badge info
  const getStatusBadge = () => {
    if (isCancelled) {
      return { text: t("challenges.cancelled"), color: colors.feedback.error };
    }
    if (isCompleted) {
      return {
        text: t("challenges.completed"),
        color: colors.feedback.success,
      };
    }
    if (isUpcoming) {
      return { text: t("challenges.upcoming"), color: colors.feedback.warning };
    }
    if (isActive) {
      return { text: t("challenges.active"), color: colors.feedback.success };
    }
    return null;
  };

  // Get challenge type icon
  const getChallengeIcon = () => {
    if (
      challenge.challenge_type === "target" ||
      challenge.challenge_type === "checkin_count"
    ) {
      return "flag";
    }
    return "timer";
  };

  // Handle card press
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(MOBILE_ROUTES.CHALLENGES.DETAILS(challenge.id));
    }
  };

  // Handle join with feature/limit validation
  const handleJoin = async () => {
    // Check if user has challenge_join feature
    if (!canJoinChallenges) {
      showAlert({
        title: t("subscription.feature_locked_title") || "Feature Locked",
        message:
          t("subscription.upgrade_to_join_challenges") ||
          "Upgrade your plan to join challenges.",
        variant: "warning",
        confirmLabel: t("subscription.upgrade") || "Upgrade",
      });
      return;
    }

    // Check if user has reached their challenge limit
    if (!canJoinMore) {
      showAlert({
        title: t("challenges.limit_reached_title") || "Challenge Limit Reached",
        message:
          t("challenges.limit_reached_message", { limit: challengeLimit }) ||
          `You can only have ${challengeLimit} active challenges. Leave an existing challenge to join a new one.`,
        variant: "warning",
        confirmLabel: t("common.ok") || "OK",
      });
      return;
    }

    try {
      await joinChallenge.mutateAsync(challenge.id);
      showAlert({
        title: t("social.challenge_joined_title"),
        message: t("social.challenge_joined_message"),
        variant: "success",
      });
      onJoined?.();
    } catch (error: any) {
      const errorDetail = error?.response?.data?.detail;
      showAlert({
        title: t("common.error"),
        message: errorDetail || t("social.join_challenge_error"),
        variant: "error",
      });
    }
  };

  const statusBadge = getStatusBadge();

  // Compact variant (for discovery/lists)
  if (variant === "compact" || variant === "discovery") {
    return (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
        <Card style={[styles.compactCard, style]}>
          <View style={styles.compactContent}>
            {/* Icon */}
            <View
              style={[
                styles.compactIcon,
                { backgroundColor: `${brandColors.primary}15` },
              ]}
            >
              <Ionicons
                name={getChallengeIcon()}
                size={18}
                color={brandColors.primary}
              />
            </View>

            {/* Info */}
            <View style={styles.compactInfo}>
              <Text style={styles.compactTitle} numberOfLines={1}>
                {challenge.title}
              </Text>
              <View style={styles.compactMeta}>
                <Ionicons
                  name="calendar-outline"
                  size={12}
                  color={colors.text.tertiary}
                />
                <Text style={styles.compactMetaText}>
                  {t("social.starts")} {startDate}
                </Text>
                {challenge.participants_count !== undefined && (
                  <>
                    <Text style={styles.compactMetaDot}>•</Text>
                    <Ionicons
                      name="people-outline"
                      size={12}
                      color={colors.text.tertiary}
                    />
                    <Text style={styles.compactMetaText}>
                      {challenge.participants_count}
                    </Text>
                  </>
                )}
              </View>
            </View>

            {/* Action */}
            {variant === "discovery" && !isParticipant && !isCreator && (
              <TouchableOpacity
                style={[
                  styles.joinButton,
                  {
                    backgroundColor:
                      canJoinChallenges && canJoinMore
                        ? brandColors.primary
                        : colors.bg.muted,
                  },
                ]}
                onPress={handleJoin}
                disabled={joinChallenge.isPending}
              >
                <Text
                  style={[
                    styles.joinButtonText,
                    !(canJoinChallenges && canJoinMore) && {
                      color: colors.text.tertiary,
                    },
                  ]}
                >
                  {!canJoinChallenges || !canJoinMore ? "🔒" : t("social.join")}
                </Text>
              </TouchableOpacity>
            )}

            {(isParticipant || isCreator) && (
              <View style={styles.participantBadge}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={colors.feedback.success}
                />
              </View>
            )}
          </View>
        </Card>
      </TouchableOpacity>
    );
  }

  // Default variant (full card)
  return (
    <>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
        <Card style={[styles.card, style]}>
          {/* Header */}
          <View style={styles.header}>
            {/* Icon */}
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: `${brandColors.primary}15` },
              ]}
            >
              <Ionicons
                name={getChallengeIcon()}
                size={22}
                color={brandColors.primary}
              />
            </View>

            {/* Title & Meta */}
            <View style={styles.titleContainer}>
              <Text style={styles.title} numberOfLines={2}>
                {challenge.title}
              </Text>
              <View style={styles.metaRow}>
                {/* Status badge */}
                {statusBadge && (
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: `${statusBadge.color}15` },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: statusBadge.color },
                      ]}
                    />
                    <Text
                      style={[styles.statusText, { color: statusBadge.color }]}
                    >
                      {statusBadge.text}
                    </Text>
                  </View>
                )}

                {/* Creator badge */}
                {isCreator && (
                  <View style={styles.creatorPill}>
                    <Ionicons
                      name="star"
                      size={10}
                      color={colors.feedback.warning}
                    />
                    <Text style={styles.creatorText}>
                      {t("challenges.creator")}
                    </Text>
                  </View>
                )}

                {/* Public/Private */}
                <View style={styles.visibilityPill}>
                  <Ionicons
                    name={
                      challenge.is_public
                        ? "globe-outline"
                        : "lock-closed-outline"
                    }
                    size={10}
                    color={colors.text.tertiary}
                  />
                  <Text style={styles.visibilityText}>
                    {challenge.is_public
                      ? t("challenges.public")
                      : t("challenges.private")}
                  </Text>
                </View>
              </View>
            </View>

            {/* Menu button */}
            {showMenu && (
              <TouchableOpacity
                style={styles.menuButton}
                onPress={() => setMenuVisible(true)}
              >
                <Ionicons
                  name="ellipsis-horizontal"
                  size={18}
                  color={colors.text.tertiary}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Description */}
          {challenge.description && (
            <Text style={styles.description} numberOfLines={2}>
              {challenge.description}
            </Text>
          )}

          {/* Stats Row */}
          <View style={styles.statsRow}>
            {/* Dates */}
            <View style={styles.statItem}>
              <Ionicons
                name="calendar-outline"
                size={14}
                color={colors.text.tertiary}
              />
              <Text style={styles.statText}>
                {startDate} - {endDate}
              </Text>
            </View>

            {/* Participants */}
            <View style={styles.statItem}>
              <Ionicons
                name="people-outline"
                size={14}
                color={colors.text.tertiary}
              />
              <Text style={styles.statText}>
                {challenge.participants_count || 0}{" "}
                {t("challenges.participants")}
              </Text>
            </View>
          </View>

          {/* Progress (if participating) */}
          {(isParticipant || isCreator) &&
            challenge.my_progress !== undefined && (
              <View style={styles.progressSection}>
                <View style={styles.progressRow}>
                  <Text style={styles.progressLabel}>
                    {t("challenges.your_progress")}
                  </Text>
                  <View style={styles.progressStats}>
                    <Text style={styles.progressValue}>
                      {challenge.my_progress}
                    </Text>
                    {challenge.target_value && (
                      <Text style={styles.progressTotal}>
                        / {challenge.target_value}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Progress bar */}
                {challenge.target_value && (
                  <View style={styles.progressBarContainer}>
                    <View
                      style={[
                        styles.progressBar,
                        {
                          width: `${Math.min(100, ((challenge.my_progress || 0) / challenge.target_value) * 100)}%`,
                          backgroundColor: brandColors.primary,
                        },
                      ]}
                    />
                  </View>
                )}

                {/* Rank */}
                {challenge.my_rank && (
                  <View style={styles.rankRow}>
                    <Ionicons
                      name="trophy"
                      size={14}
                      color={colors.feedback.warning}
                    />
                    <Text style={styles.rankText}>
                      {t("challenges.rank")} #{challenge.my_rank}
                    </Text>
                  </View>
                )}
              </View>
            )}

          {/* Join button (for non-participants) */}
          {!isParticipant && !isCreator && !isCompleted && !isCancelled && (
            <TouchableOpacity
              style={[
                styles.fullJoinButton,
                {
                  backgroundColor:
                    canJoinChallenges && canJoinMore
                      ? brandColors.primary
                      : colors.bg.muted,
                },
              ]}
              onPress={handleJoin}
              disabled={joinChallenge.isPending}
            >
              <Text
                style={[
                  styles.fullJoinButtonText,
                  !(canJoinChallenges && canJoinMore) && {
                    color: colors.text.tertiary,
                  },
                ]}
              >
                {joinChallenge.isPending
                  ? t("common.loading")
                  : !canJoinChallenges
                    ? t("subscription.upgrade") || "Upgrade"
                    : !canJoinMore
                      ? t("challenges.limit_reached") || "Limit Reached"
                      : t("social.join")}
              </Text>
            </TouchableOpacity>
          )}
        </Card>
      </TouchableOpacity>

      {/* Menu */}
      <BottomMenuSheet
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        title={challenge.title}
        sections={menuSections}
      />
    </>
  );
}

const makeChallengeCardStyles = (tokens: any, colors: any, brand: any) => ({
  // Default card
  card: {
    marginBottom: toRN(tokens.spacing[3]),
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
  },
  iconContainer: {
    width: toRN(44),
    height: toRN(44),
    borderRadius: toRN(tokens.borderRadius.lg),
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginRight: toRN(tokens.spacing[3]),
  },
  titleContainer: {
    flex: 1,
    paddingRight: toRN(tokens.spacing[2]),
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    lineHeight: toRN(tokens.typography.fontSize.base) * 1.3,
    marginBottom: toRN(tokens.spacing[1.5] || 6),
  },
  metaRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    flexWrap: "wrap" as const,
    gap: toRN(tokens.spacing[1.5] || 6),
  },
  menuButton: {
    padding: toRN(tokens.spacing[1]),
    marginLeft: toRN(tokens.spacing[1]),
  },
  // Status badge
  statusPill: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    paddingHorizontal: toRN(tokens.spacing[2]),
    paddingVertical: 3,
    borderRadius: toRN(tokens.borderRadius.full),
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
  },
  // Creator badge
  creatorPill: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 3,
    paddingHorizontal: toRN(tokens.spacing[2]),
    paddingVertical: 3,
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: `${colors.feedback.warning}15`,
  },
  creatorText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.feedback.warning,
  },
  // Visibility badge
  visibilityPill: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 3,
    paddingHorizontal: toRN(tokens.spacing[2]),
    paddingVertical: 3,
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: colors.bg.muted,
  },
  visibilityText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
  },
  // Description
  description: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    marginTop: toRN(tokens.spacing[2]),
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.4,
  },
  // Stats row
  statsRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginTop: toRN(tokens.spacing[3]),
    paddingTop: toRN(tokens.spacing[3]),
    borderTopWidth: 1,
    borderTopColor: colors.border.default + "40",
    gap: toRN(tokens.spacing[4]),
  },
  statItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
  },
  statText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
  },
  // Progress section
  progressSection: {
    marginTop: toRN(tokens.spacing[3]),
    paddingTop: toRN(tokens.spacing[3]),
    borderTopWidth: 1,
    borderTopColor: colors.border.default + "40",
  },
  progressRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    marginBottom: toRN(tokens.spacing[2]),
  },
  progressLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
  },
  progressStats: {
    flexDirection: "row" as const,
    alignItems: "baseline" as const,
  },
  progressValue: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
  },
  progressTotal: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: colors.bg.muted,
    borderRadius: 3,
    overflow: "hidden" as const,
  },
  progressBar: {
    height: "100%" as const,
    borderRadius: 3,
  },
  rankRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
    marginTop: toRN(tokens.spacing[2]),
  },
  rankText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.feedback.warning,
  },
  // Join button (full width)
  fullJoinButton: {
    marginTop: toRN(tokens.spacing[3]),
    paddingVertical: toRN(10),
    borderRadius: toRN(tokens.borderRadius.md),
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  fullJoinButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: "#FFFFFF",
  },

  // Compact card styles
  compactCard: {
    marginBottom: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[3]),
  },
  compactContent: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  compactIcon: {
    width: toRN(36),
    height: toRN(36),
    borderRadius: toRN(tokens.borderRadius.md),
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginRight: toRN(tokens.spacing[3]),
  },
  compactInfo: {
    flex: 1,
  },
  compactTitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  compactMeta: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
  },
  compactMetaText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
  },
  compactMetaDot: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    color: colors.text.tertiary,
  },
  joinButton: {
    paddingHorizontal: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[1.5] || 6),
    borderRadius: toRN(tokens.borderRadius.md),
  },
  joinButtonText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: "#FFFFFF",
  },
  participantBadge: {
    padding: toRN(tokens.spacing[1]),
  },
});
