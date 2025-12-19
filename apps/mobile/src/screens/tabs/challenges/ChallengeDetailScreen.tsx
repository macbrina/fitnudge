import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useTranslation } from "@/lib/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { BackButton } from "@/components/ui/BackButton";
import { Card } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { SkeletonBox, SkeletonCard } from "@/components/ui/SkeletonBox";
import { Ionicons } from "@expo/vector-icons";
import { formatDate } from "@/utils/helper";
import { MOBILE_ROUTES } from "@/lib/routes";
import type { Challenge, ChallengeStatus } from "@/services/api/challenges";

/**
 * Compute challenge status from is_active and dates.
 * This is a frontend fallback if the backend doesn't return status.
 */
function computeChallengeStatus(challenge: Challenge): ChallengeStatus {
  if (challenge.status) {
    return challenge.status;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = challenge.start_date
    ? new Date(challenge.start_date)
    : null;
  const endDate = challenge.end_date ? new Date(challenge.end_date) : null;

  if (startDate) startDate.setHours(0, 0, 0, 0);
  if (endDate) endDate.setHours(0, 0, 0, 0);

  if (challenge.is_active === false) {
    return "cancelled";
  }

  if (endDate && today > endDate) {
    return "completed";
  }

  if (startDate && today < startDate) {
    return "upcoming";
  }

  return "active";
}

import { useAlertModal } from "@/contexts/AlertModalContext";
import {
  useChallenge,
  useChallengeLeaderboard,
  useMyChallengeCheckIns,
  useJoinChallenge,
  useLeaveChallenge,
} from "@/hooks/api/useChallenges";
import { ChallengeProgressSection } from "./components/ChallengeProgressSection";
import { LeaderboardPreview } from "./components/LeaderboardPreview";
import { ChallengePlanSection } from "./components/ChallengePlanSection";
import { ChallengeCheckInModal } from "./components/ChallengeCheckInModal";
import { ParticipantsModal } from "./components/ParticipantsModal";
import { BottomMenuSheet } from "@/components/ui/BottomMenuSheet";
import { useChallengeMenu } from "@/hooks/useChallengeMenu";
import type { ChallengeCheckIn } from "@/services/api/challenges";

// Tab IDs
const TAB_OVERVIEW = "overview";
const TAB_PROGRESS = "progress";
const TAB_PLAN = "plan";

export default function ChallengeDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const challengeId = params.id;
  const styles = useStyles(makeChallengeDetailScreenStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { showAlert, showConfirm, showToast } = useAlertModal();

  const [refreshing, setRefreshing] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [showMenuSheet, setShowMenuSheet] = useState(false);
  const [selectedCheckIn, setSelectedCheckIn] =
    useState<ChallengeCheckIn | null>(null);
  const [activeTab, setActiveTab] = useState(TAB_OVERVIEW);

  // Data hooks
  const {
    data: challengeResponse,
    isLoading: challengeLoading,
    refetch: refetchChallenge,
  } = useChallenge(challengeId || "");

  const {
    data: leaderboardResponse,
    isLoading: leaderboardLoading,
    refetch: refetchLeaderboard,
  } = useChallengeLeaderboard(challengeId || "");

  const {
    data: myCheckInsResponse,
    isLoading: checkInsLoading,
    refetch: refetchCheckIns,
  } = useMyChallengeCheckIns(challengeId || "");

  const challenge = challengeResponse?.data;
  const leaderboard = leaderboardResponse?.data || [];
  const myCheckIns = myCheckInsResponse?.data || [];

  // Mutations
  const joinChallenge = useJoinChallenge();
  const leaveChallenge = useLeaveChallenge();

  // Derived state
  const isLoading = challengeLoading;
  const isCreator = challenge?.is_creator;
  const isParticipant = challenge?.is_participant || isCreator;

  const challengeStatus = challenge
    ? computeChallengeStatus(challenge)
    : undefined;
  const isUpcoming = challengeStatus === "upcoming";
  const isActive = challengeStatus === "active";
  const isCompleted = challengeStatus === "completed";
  const isCancelled = challengeStatus === "cancelled";

  // Challenge menu hook (shared with ChallengeCard)
  const { menuSections } = useChallengeMenu({
    challenge: challenge || ({} as any),
    onClose: () => setShowMenuSheet(false),
    onLeft: () => {
      refetchChallenge();
    },
    onCancelled: () => {
      refetchChallenge();
    },
    isDetailScreen: true,
  });

  // Calculate days remaining
  const daysRemaining = useMemo(() => {
    if (!challenge?.end_date) return null;
    const endDate = new Date(challenge.end_date);
    const today = new Date();
    const diff = Math.ceil(
      (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    return Math.max(0, diff);
  }, [challenge?.end_date]);

  // Define tabs
  const tabs = useMemo(() => {
    const tabList = [
      { id: TAB_OVERVIEW, label: t("challenges.overview") || "Overview" },
      { id: TAB_PROGRESS, label: t("challenges.progress") || "Progress" },
    ];

    // Only show Plan tab if there's a goal_template with actionable_plan
    if (challenge?.goal_template?.actionable_plan) {
      tabList.push({ id: TAB_PLAN, label: t("challenges.plan") || "Plan" });
    }

    return tabList;
  }, [challenge, t]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchChallenge(),
        refetchLeaderboard(),
        refetchCheckIns(),
      ]);
    } catch (error) {
      console.error("Error refreshing challenge:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleJoin = async () => {
    if (!challengeId) return;

    try {
      await joinChallenge.mutateAsync(challengeId);
      showToast({
        title: t("common.success"),
        message: t("social.challenge_joined_message") || "Successfully joined!",
        variant: "success",
      });
    } catch (error) {
      showAlert({
        title: t("common.error"),
        message: t("social.join_challenge_error") || "Failed to join challenge",
        variant: "error",
      });
    }
  };

  const handleLeave = async () => {
    if (!challengeId) return;

    const confirmed = await showConfirm({
      title: t("challenges.leave_title") || "Leave Challenge?",
      message:
        t("challenges.leave_confirm") ||
        "Are you sure you want to leave this challenge? Your progress will be lost.",
      confirmLabel: t("common.leave") || "Leave",
      cancelLabel: t("common.cancel"),
      variant: "warning",
    });

    if (!confirmed) return;

    try {
      await leaveChallenge.mutateAsync(challengeId);
      router.back();
    } catch (error) {
      showAlert({
        title: t("common.error"),
        message: "Failed to leave challenge",
        variant: "error",
      });
    }
  };

  // Find today's check-in (could be pending or completed)
  const todayCheckIn = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return myCheckIns.find((ci) => ci.check_in_date === today);
  }, [myCheckIns]);

  // Check if already checked in today (is_checked_in=true)
  const hasCheckedInToday = todayCheckIn?.is_checked_in === true;

  // Check if today is a scheduled check-in day (has a pre-created record)
  // If there's a todayCheckIn record, today is scheduled
  const isScheduledDay = useMemo(() => {
    // If we have a pre-created record for today, it's a scheduled day
    if (todayCheckIn) {
      return true;
    }
    // Fallback: check days_of_week (for before task has run)
    const daysOfWeek = challenge?.goal_template?.days_of_week;
    if (!daysOfWeek || daysOfWeek.length === 0) {
      return true;
    }
    const todayIndex = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
    return daysOfWeek.includes(todayIndex);
  }, [challenge?.goal_template?.days_of_week, todayCheckIn]);

  // Can check in: scheduled day, active challenge, participant, and not already checked in
  const canCheckIn =
    isScheduledDay && isActive && isParticipant && !hasCheckedInToday;

  const handleCheckIn = () => {
    if (!challengeId || !canCheckIn) return;
    setSelectedCheckIn(null);
    setShowCheckInModal(true);
  };

  const handleCheckInComplete = () => {
    refetchCheckIns();
    refetchLeaderboard();
    setShowCheckInModal(false);
    setSelectedCheckIn(null);
  };

  const handleViewLeaderboard = () => {
    if (challengeId) {
      router.push(MOBILE_ROUTES.CHALLENGES.LEADERBOARD(challengeId));
    }
  };

  // Status badge component
  const StatusBadge = () => {
    const infoColor = "#2563eb";
    let bgColor: string = colors.bg.muted;
    let textColor: string = colors.text.secondary;
    let label = challengeStatus || "unknown";

    if (isUpcoming) {
      bgColor = infoColor + "20";
      textColor = infoColor;
      label = t("challenges.upcoming") || "Upcoming";
    } else if (isActive) {
      bgColor = colors.feedback.success + "20";
      textColor = colors.feedback.success;
      label = t("challenges.active") || "Active";
    } else if (isCompleted) {
      bgColor = brandColors.primary + "20";
      textColor = brandColors.primary;
      label = t("challenges.completed") || "Completed";
    } else if (isCancelled) {
      bgColor = colors.feedback.error + "20";
      textColor = colors.feedback.error;
      label = t("challenges.cancelled") || "Cancelled";
    }

    return (
      <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
        <Text style={[styles.statusBadgeText, { color: textColor }]}>
          {label}
        </Text>
      </View>
    );
  };

  // Render Overview Tab Content
  const renderOverviewTab = () => (
    <>
      {/* Header Card */}
      <Card shadow="md" style={styles.headerCard}>
        <Text style={styles.challengeTitle}>
          {challenge?.title || t("challenges.untitled")}
        </Text>

        {/* Status & Visibility Row */}
        <View style={styles.headerRow}>
          <StatusBadge />
          {challenge?.is_public ? (
            <View style={styles.publicBadge}>
              <Ionicons
                name="globe-outline"
                size={14}
                color={colors.text.tertiary}
              />
              <Text style={styles.publicBadgeText}>
                {t("challenges.public") || "Public"}
              </Text>
            </View>
          ) : (
            <View style={styles.publicBadge}>
              <Ionicons
                name="lock-closed-outline"
                size={14}
                color={colors.text.tertiary}
              />
              <Text style={styles.publicBadgeText}>
                {t("challenges.private") || "Private"}
              </Text>
            </View>
          )}
        </View>

        {/* Creator Info */}
        {challenge?.creator && (
          <View style={styles.creatorRow}>
            <View style={styles.creatorAvatar}>
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {challenge.creator.name?.charAt(0)?.toUpperCase() || "?"}
                </Text>
              </View>
            </View>
            <View style={styles.creatorInfo}>
              <Text style={styles.creatorName}>
                {isCreator
                  ? t("challenges.created_by_you") || "Created by you"
                  : `${t("challenges.created_by") || "Created by"} ${challenge.creator.name || challenge.creator.username}`}
              </Text>
            </View>
            {isCreator && (
              <View style={styles.creatorBadge}>
                <Ionicons
                  name="star"
                  size={12}
                  color={colors.feedback.warning}
                />
              </View>
            )}
          </View>
        )}

        {challenge?.description && (
          <Text style={styles.description}>{challenge.description}</Text>
        )}

        {/* Date Info Row */}
        <View style={styles.dateInfoRow}>
          <View style={styles.dateInfoItem}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color={brandColors.primary}
            />
            <Text style={styles.dateInfoLabel}>
              {t("challenges.start_date") || "Starts"}
            </Text>
            <Text style={styles.dateInfoValue}>
              {challenge?.start_date ? formatDate(challenge.start_date) : "-"}
            </Text>
          </View>

          {challenge?.end_date && (
            <View style={styles.dateInfoItem}>
              <Ionicons
                name="flag-outline"
                size={14}
                color={colors.feedback.warning}
              />
              <Text style={styles.dateInfoLabel}>
                {t("challenges.end_date") || "Ends"}
              </Text>
              <Text style={styles.dateInfoValue}>
                {formatDate(challenge.end_date)}
              </Text>
            </View>
          )}

          {daysRemaining !== null && isActive && (
            <View style={styles.dateInfoItem}>
              <Ionicons
                name="timer-outline"
                size={14}
                color={colors.feedback.success}
              />
              <Text style={styles.dateInfoLabel}>
                {t("challenges.days_left") || "Left"}
              </Text>
              <Text
                style={[
                  styles.dateInfoValue,
                  { color: colors.feedback.success },
                ]}
              >
                {daysRemaining} {t("common.days") || "days"}
              </Text>
            </View>
          )}
        </View>
      </Card>

      {/* Participants Card */}
      <TouchableOpacity
        style={styles.participantsCard}
        onPress={() => setShowParticipantsModal(true)}
        activeOpacity={0.7}
      >
        <View style={styles.participantsCardLeft}>
          <View style={styles.participantsIconContainer}>
            <Ionicons name="people" size={24} color={brandColors.primary} />
          </View>
          <View style={styles.participantsCardContent}>
            <Text style={styles.participantsCardTitle}>
              {challenge?.participants_count || 0}{" "}
              {t("challenges.participants_joined") || "participants joined"}
            </Text>
            <Text style={styles.participantsCardSubtitle}>
              {t("challenges.tap_to_view") || "Tap to see the list"}
            </Text>
          </View>
        </View>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={colors.text.tertiary}
        />
      </TouchableOpacity>

      {/* Scheduled Days */}
      {challenge?.goal_template?.days_of_week &&
        challenge.goal_template.days_of_week.length > 0 && (
          <View style={styles.scheduledDaysCard}>
            <Text style={styles.scheduledDaysLabel}>
              {t("goals.scheduled_days") || "Scheduled Days"}
            </Text>
            <View style={styles.daysRow}>
              {["S", "M", "T", "W", "T", "F", "S"].map((dayLabel, index) => {
                const isDayActive = (
                  challenge.goal_template?.days_of_week || []
                ).includes(index);
                return (
                  <View
                    key={index}
                    style={[
                      styles.dayBadge,
                      isDayActive && styles.dayBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayBadgeText,
                        isDayActive && styles.dayBadgeTextActive,
                      ]}
                    >
                      {dayLabel}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

      {/* Workout Times */}
      {challenge?.goal_template?.reminder_times &&
        challenge.goal_template.reminder_times.length > 0 && (
          <View style={styles.scheduledDaysCard}>
            <Text style={styles.scheduledDaysLabel}>
              {t("goals.reminder_times") || "Workout Times"}
            </Text>
            <View style={styles.reminderTimesRow}>
              {challenge.goal_template.reminder_times.map((time, index) => (
                <View key={index} style={styles.reminderTimeBadge}>
                  <Ionicons
                    name="time-outline"
                    size={14}
                    color={brandColors.primary}
                  />
                  <Text style={styles.reminderTimeText}>{time}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

      {/* Join Deadline Warning */}
      {isUpcoming && challenge?.join_deadline && (
        <Card shadow="sm" style={styles.deadlineCard}>
          <View style={styles.deadlineRow}>
            <Ionicons
              name="time-outline"
              size={24}
              color={colors.feedback.warning}
            />
            <View style={styles.deadlineContent}>
              <Text style={styles.deadlineTitle}>
                {t("challenges.join_deadline") || "Join by"}
              </Text>
              <Text style={styles.deadlineDate}>
                {formatDate(challenge.join_deadline)}
              </Text>
            </View>
          </View>
        </Card>
      )}
    </>
  );

  // Render Progress Tab Content
  const renderProgressTab = () => (
    <>
      {/* My Progress Section */}
      {isParticipant && challenge && (
        <ChallengeProgressSection
          challengeId={challengeId || ""}
          challengeType={challenge.challenge_type}
          targetValue={
            challenge.target_value || challenge.goal_template?.target_checkins
          }
          myProgress={challenge.my_progress || 0}
          myRank={challenge.my_rank}
          totalParticipants={challenge.participants_count || 0}
          startDate={challenge.start_date}
          endDate={challenge.end_date}
          checkIns={myCheckIns}
          daysOfWeek={challenge.goal_template?.days_of_week}
          frequency={
            (challenge.goal_template?.frequency as "daily" | "weekly") ||
            "daily"
          }
          isLoading={checkInsLoading}
        />
      )}

      {/* Not a participant message */}
      {!isParticipant && (
        <Card shadow="sm" style={styles.notParticipantCard}>
          <Ionicons
            name="lock-closed-outline"
            size={32}
            color={colors.text.tertiary}
          />
          <Text style={styles.notParticipantText}>
            {t("challenges.join_to_see_progress") ||
              "Join the challenge to track your progress"}
          </Text>
        </Card>
      )}

      {/* Leaderboard Preview */}
      <LeaderboardPreview
        entries={leaderboard.slice(0, 5)}
        myRank={challenge?.my_rank}
        isLoading={leaderboardLoading}
        onViewAll={handleViewLeaderboard}
      />
    </>
  );

  // Render Plan Tab Content
  const renderPlanTab = () => (
    <>
      {challenge?.goal_template && (
        <ChallengePlanSection
          actionablePlan={challenge.goal_template.actionable_plan}
          category={challenge.goal_template.category}
        />
      )}
    </>
  );

  // Render active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case TAB_OVERVIEW:
        return renderOverviewTab();
      case TAB_PROGRESS:
        return renderProgressTab();
      case TAB_PLAN:
        return renderPlanTab();
      default:
        return renderOverviewTab();
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <BackButton
          title={t("challenges.details") || "Challenge Details"}
          onPress={() => router.back()}
        />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <SkeletonCard width="100%" height={200} />
          <SkeletonCard width="100%" height={150} />
          <SkeletonCard width="100%" height={200} />
        </ScrollView>
      </View>
    );
  }

  if (!challenge) {
    return (
      <View style={styles.container}>
        <BackButton
          title={t("challenges.details") || "Challenge Details"}
          onPress={() => router.back()}
        />
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={colors.text.tertiary}
          />
          <Text style={styles.errorText}>
            {t("challenges.not_found") || "Challenge not found"}
          </Text>
          <Button
            variant="outline"
            title={t("common.go_back") || "Go Back"}
            onPress={() => router.back()}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BackButton
        title={challenge.title}
        titleCentered={false}
        onPress={() => router.back()}
        rightInput={
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setShowMenuSheet(true)}
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={24}
              color={colors.text.primary}
            />
          </TouchableOpacity>
        }
      />

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <Tabs
          tabs={tabs}
          selectedId={activeTab}
          onChange={setActiveTab}
          variant="underline"
          size="md"
          fullWidth
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={brandColors.primary}
          />
        }
      >
        {/* Tab Content */}
        {renderTabContent()}

        {/* Action Section - Always visible */}
        <View style={styles.actionSection}>
          {!isParticipant && isUpcoming && (
            <Button
              variant="primary"
              size="lg"
              title={t("challenges.join") || "Join Challenge"}
              onPress={handleJoin}
              loading={joinChallenge.isPending}
            />
          )}

          {/* Can check in - scheduled day, not checked in yet */}
          {canCheckIn && (
            <Button
              variant="primary"
              title={t("checkin.check_in") || "Check In"}
              onPress={handleCheckIn}
              leftIcon="checkmark-circle"
            />
          )}

          {/* Already checked in today */}
          {isParticipant && isActive && hasCheckedInToday && (
            <View style={styles.checkedInBadge}>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={colors.feedback.success}
              />
              <Text style={styles.checkedInText}>
                {t("checkin.checked_in_today") || "Checked in today"}
              </Text>
            </View>
          )}

          {/* Not a scheduled check-in day */}
          {isParticipant &&
            isActive &&
            !isScheduledDay &&
            !hasCheckedInToday && (
              <View style={styles.noCheckInScheduled}>
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={colors.text.tertiary}
                />
                <Text style={styles.noCheckInScheduledText}>
                  {t("checkin.no_checkin_scheduled") ||
                    "No check-in scheduled for today"}
                </Text>
              </View>
            )}

          {isParticipant && !isCreator && (isUpcoming || isActive) && (
            <Button
              variant="ghost"
              size="md"
              title={t("challenges.leave") || "Leave Challenge"}
              onPress={handleLeave}
              loading={leaveChallenge.isPending}
            />
          )}
        </View>
      </ScrollView>

      {/* Check-In Modal */}
      {challengeId && (
        <ChallengeCheckInModal
          visible={showCheckInModal}
          challengeId={challengeId}
          checkIn={selectedCheckIn}
          onClose={() => {
            setShowCheckInModal(false);
            setSelectedCheckIn(null);
          }}
          onComplete={handleCheckInComplete}
        />
      )}

      {/* Participants Modal */}
      {challengeId && (
        <ParticipantsModal
          visible={showParticipantsModal}
          challengeId={challengeId}
          onClose={() => setShowParticipantsModal(false)}
        />
      )}

      {/* Menu Sheet */}
      {challenge && (
        <BottomMenuSheet
          visible={showMenuSheet}
          onClose={() => setShowMenuSheet(false)}
          title={challenge.title}
          sections={menuSections}
        />
      )}
    </View>
  );
}

const makeChallengeDetailScreenStyles = (
  tokens: any,
  colors: any,
  brand: any
) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
  tabsContainer: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    backgroundColor: colors.bg.canvas,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[8]),
    gap: toRN(tokens.spacing[4]),
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[4]),
    padding: toRN(tokens.spacing[6]),
  },
  errorText: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.base),
    color: colors.text.secondary,
    textAlign: "center" as const,
  },
  menuButton: {
    padding: toRN(tokens.spacing[2]),
  },
  headerCard: {
    padding: toRN(tokens.spacing[4]),
    gap: toRN(tokens.spacing[3]),
  },
  challengeTitle: {
    fontFamily: fontFamily.bold,
    fontSize: toRN(tokens.typography.fontSize.lg),
    color: colors.text.primary,
    lineHeight: toRN(tokens.typography.fontSize.lg * 1.3),
  },
  headerRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
  statusBadge: {
    paddingHorizontal: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[1]),
    borderRadius: toRN(tokens.borderRadius.full),
  },
  statusBadgeText: {
    fontFamily: fontFamily.semiBold,
    fontSize: toRN(tokens.typography.fontSize.xs),
    textTransform: "uppercase" as const,
  },
  publicBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
  },
  publicBadgeText: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.xs),
    color: colors.text.tertiary,
  },
  creatorRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[2]),
    borderTopWidth: 1,
    borderTopColor: colors.border.default + "30",
    marginTop: toRN(tokens.spacing[1]),
  },
  creatorAvatar: {
    width: 36,
    height: 36,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.muted,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  avatarInitial: {
    fontFamily: fontFamily.semiBold,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: brand.primary,
  },
  creatorInfo: {
    flex: 1,
  },
  creatorName: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.secondary,
  },
  creatorBadge: {
    padding: toRN(tokens.spacing[1]),
  },
  description: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm * 1.5),
  },
  scheduledDaysCard: {
    backgroundColor: colors.bg.card,
    padding: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.xl),
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  scheduledDaysLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: colors.text.tertiary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  daysRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    marginTop: toRN(tokens.spacing[2]),
  },
  dayBadge: {
    width: toRN(tokens.spacing[8]),
    height: toRN(tokens.spacing[8]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: colors.bg.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  dayBadgeActive: {
    backgroundColor: brand.primary,
  },
  dayBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: colors.text.tertiary,
  },
  dayBadgeTextActive: {
    color: brand.onPrimary,
  },
  reminderTimesRow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: toRN(tokens.spacing[2]),
    marginTop: toRN(tokens.spacing[2]),
  },
  reminderTimeBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[2]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: colors.bg.muted,
  },
  reminderTimeText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.primary,
  },
  dateInfoRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "flex-start" as const,
    flexWrap: "wrap" as const,
    gap: toRN(tokens.spacing[3]),
    paddingTop: toRN(tokens.spacing[3]),
    marginTop: toRN(tokens.spacing[3]),
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  dateInfoItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1.5]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[2]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.full),
  },
  dateInfoLabel: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.xs),
    color: colors.text.secondary,
  },
  dateInfoValue: {
    fontFamily: fontFamily.semiBold,
    fontSize: toRN(tokens.typography.fontSize.xs),
    color: colors.text.primary,
  },
  participantsCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.xl),
    padding: toRN(tokens.spacing[4]),
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  participantsCardLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
    flex: 1,
  },
  participantsIconContainer: {
    width: 48,
    height: 48,
    borderRadius: toRN(tokens.borderRadius.xl),
    backgroundColor: brand.primary + "15",
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  participantsCardContent: {
    flex: 1,
  },
  participantsCardTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: toRN(tokens.typography.fontSize.base),
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[0.5]),
  },
  participantsCardSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.tertiary,
  },
  deadlineCard: {
    padding: toRN(tokens.spacing[4]),
    backgroundColor: colors.feedback.warning + "10",
    borderWidth: 1,
    borderColor: colors.feedback.warning + "30",
  },
  deadlineRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
  },
  deadlineContent: {
    flex: 1,
  },
  deadlineTitle: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.secondary,
  },
  deadlineDate: {
    fontFamily: fontFamily.semiBold,
    fontSize: toRN(tokens.typography.fontSize.base),
    color: colors.feedback.warning,
  },
  notParticipantCard: {
    padding: toRN(tokens.spacing[6]),
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
  },
  notParticipantText: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.base),
    color: colors.text.secondary,
    textAlign: "center" as const,
  },
  actionSection: {
    gap: toRN(tokens.spacing[3]),
    marginTop: toRN(tokens.spacing[4]),
  },
  checkedInBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    backgroundColor: colors.feedback.success + "15",
    borderRadius: toRN(tokens.borderRadius.xl),
  },
  checkedInText: {
    fontFamily: fontFamily.medium,
    fontSize: toRN(tokens.typography.fontSize.base),
    color: colors.feedback.success,
  },
  noCheckInScheduled: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.xl),
  },
  noCheckInScheduledText: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.tertiary,
  },
});
