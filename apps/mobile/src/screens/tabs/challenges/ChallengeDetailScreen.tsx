import React, { useState, useMemo, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
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

import { useAlertModal } from "@/contexts/AlertModalContext";
import {
  useChallenge,
  useChallengeLeaderboard,
  useMyChallengeCheckIns,
  useJoinChallenge,
  useLeaveChallenge
} from "@/hooks/api/useChallenges";
import { usePartners } from "@/hooks/api/usePartners";
import { useChallengePlanStatus, useChallengePlan } from "@/hooks/api/useActionablePlans";
import { ChallengeProgressSection } from "./components/ChallengeProgressSection";
import { LeaderboardPreview } from "./components/LeaderboardPreview";
import { PlanSection } from "@/screens/tabs/goals/components/PlanSection";
import { CheckInModal } from "@/screens/tabs/home/components/CheckInModal";
import { HydrationModal } from "@/components/tracking/HydrationModal";
import { MealLogModal } from "@/components/tracking/MealLogModal";
import { ParticipantsModal } from "./components/ParticipantsModal";
import { BottomMenuSheet } from "@/components/ui/BottomMenuSheet";
import { useChallengeMenu } from "@/hooks/useChallengeMenu";
import { NotFoundState } from "@/components/ui/NotFoundState";
import type { ChallengeCheckIn } from "@/services/api/challenges";

// Tab IDs
const TAB_OVERVIEW = "overview";
const TAB_PROGRESS = "progress";
const TAB_PLAN = "plan";

export default function ChallengeDetailScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    viewMode?: string;
    partnerId?: string;
  }>();
  const { id: challengeId, viewMode, partnerId } = params;
  const isPartnerView = viewMode === "partner";

  const styles = useStyles(makeChallengeDetailScreenStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { showAlert, showConfirm, showToast } = useAlertModal();

  // For partner view - verify partnership exists
  const { data: partnersData } = usePartners();
  const isValidPartner = useMemo(() => {
    if (!isPartnerView) return true; // Not partner view, always valid
    if (!partnersData?.data || !partnerId) return true; // Still loading, assume valid
    return partnersData.data.some(
      (p) => p.partner?.id === partnerId || p.partner_user_id === partnerId
    );
  }, [partnersData?.data, partnerId, isPartnerView]);

  // Navigate away if partner view but not valid partner
  useEffect(() => {
    if (isPartnerView && partnersData?.data && !isValidPartner) {
      showAlert({
        title: t("partners.access_denied") || "Access Denied",
        message: t("partners.not_partners_anymore") || "You are no longer accountability partners",
        variant: "error",
        confirmLabel: t("common.ok")
      });
      router.back();
    }
  }, [isPartnerView, isValidPartner, partnersData?.data]);

  const [refreshing, setRefreshing] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showHydrationModal, setShowHydrationModal] = useState(false);
  const [showMealLogModal, setShowMealLogModal] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [showMenuSheet, setShowMenuSheet] = useState(false);
  const [selectedCheckIn, setSelectedCheckIn] = useState<ChallengeCheckIn | null>(null);
  const [activeTab, setActiveTab] = useState(TAB_OVERVIEW);

  // Data hooks
  const {
    data: challengeResponse,
    isLoading: challengeLoading,
    refetch: refetchChallenge
  } = useChallenge(challengeId || "");

  const {
    data: leaderboardResponse,
    isLoading: leaderboardLoading,
    refetch: refetchLeaderboard
  } = useChallengeLeaderboard(challengeId || "");

  const {
    data: myCheckInsResponse,
    isLoading: checkInsLoading,
    refetch: refetchCheckIns
  } = useMyChallengeCheckIns(challengeId || "");

  const challenge = challengeResponse?.data;
  const leaderboard = leaderboardResponse?.data || [];
  const myCheckIns = myCheckInsResponse?.data || [];

  // Get challenge's category (direct on challenge for standalone challenges)
  const challengeCategory = challenge?.category;

  // Plan status hook - only fetch if challenge has a category (plan was generated)
  const { data: planStatusData } = useChallengePlanStatus(challengeId, !!challengeCategory);
  const planStatus = planStatusData?.status;

  // Fetch full plan data to get targets (for meal tracking)
  const { data: challengePlanData } = useChallengePlan(challengeId, planStatus === "completed");

  // Extract meal targets from plan for MealLogModal
  const mealPlanTargets = useMemo(() => {
    const structure = challengePlanData?.plan?.structured_data?.structure;
    if (!structure) return { calorieTarget: undefined, proteinTarget: undefined };

    const dailyTargets = structure.daily_targets || {};
    const nutritionalTargets = structure.nutritional_targets || {}; // Legacy fallback

    return {
      calorieTarget: dailyTargets.calories || nutritionalTargets.calories,
      proteinTarget: dailyTargets.protein_grams || nutritionalTargets.protein
    };
  }, [challengePlanData]);

  // Mutations
  const joinChallenge = useJoinChallenge();
  const leaveChallenge = useLeaveChallenge();

  // Derived state
  const isLoading = challengeLoading;
  const isCreator = challenge?.is_creator;
  const isParticipant = challenge?.is_participant || isCreator;

  const challengeStatus = challenge?.status;
  const isUpcoming = challengeStatus === "upcoming";
  const isActive = challengeStatus === "active";
  const isCompleted = challengeStatus === "completed";
  const isCancelled = challengeStatus === "cancelled";

  // Tracking type logic
  const trackingType = challenge?.tracking_type || "manual";
  const isWorkoutTracking = trackingType === "workout";
  const isMealTracking = trackingType === "meal";
  const isHydrationTracking = trackingType === "hydration";
  const isManualTracking = !isWorkoutTracking && !isMealTracking && !isHydrationTracking;

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
    isDetailScreen: true
  });

  // Calculate days remaining
  const daysRemaining = useMemo(() => {
    if (!challenge?.end_date) return null;
    const endDate = new Date(challenge.end_date);
    const today = new Date();
    const diff = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  }, [challenge?.end_date]);

  // Define tabs
  const tabs = useMemo(() => {
    const tabList = [
      { id: TAB_OVERVIEW, label: t("challenges.overview") || "Overview" },
      { id: TAB_PROGRESS, label: t("challenges.progress") || "Progress" }
    ];

    // Show Plan tab if challenge has a category (plan was/is being generated)
    // or plan status exists (pending, generating, completed, failed)
    const hasPlan = challengeCategory || planStatus;

    if (hasPlan) {
      tabList.push({ id: TAB_PLAN, label: t("challenges.plan") || "Plan" });
    }

    return tabList;
  }, [challenge, challengeCategory, planStatus, t]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchChallenge(), refetchLeaderboard(), refetchCheckIns()]);
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
        variant: "success"
      });
    } catch (error) {
      showAlert({
        title: t("common.error"),
        message: t("social.join_challenge_error") || "Failed to join challenge",
        variant: "error"
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
      variant: "warning"
    });

    if (!confirmed) return;

    try {
      await leaveChallenge.mutateAsync(challengeId);
      router.back();
    } catch (error) {
      showAlert({
        title: t("common.error"),
        message: "Failed to leave challenge",
        variant: "error"
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

  // Get challenge fields (direct on challenge for standalone challenges)
  const challengeDaysOfWeek = challenge?.days_of_week;
  const challengeFrequency = challenge?.frequency || "daily";
  const challengeTargetCheckins = challenge?.target_checkins;
  const challengeReminderTimes = challenge?.reminder_times;

  // Check if today is a scheduled check-in day (has a pre-created record)
  // If there's a todayCheckIn record, today is scheduled
  const isScheduledDay = useMemo(() => {
    // If we have a pre-created record for today, it's a scheduled day
    if (todayCheckIn) {
      return true;
    }
    // Fallback: check days_of_week (for before task has run)
    if (!challengeDaysOfWeek || challengeDaysOfWeek.length === 0) {
      return true;
    }
    const todayIndex = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
    return challengeDaysOfWeek.includes(todayIndex);
  }, [challengeDaysOfWeek, todayCheckIn]);

  // Can check in: scheduled day, active challenge, participant, and not already checked in
  const canCheckIn = isScheduledDay && isActive && isParticipant && !hasCheckedInToday;

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
        <Text style={[styles.statusBadgeText, { color: textColor }]}>{label}</Text>
      </View>
    );
  };

  // Render Overview Tab Content
  const renderOverviewTab = () => (
    <>
      {/* Header Card */}
      <Card shadow="md" style={styles.headerCard}>
        <Text style={styles.challengeTitle}>{challenge?.title || t("challenges.untitled")}</Text>

        {/* Status & Visibility Row */}
        <View style={styles.headerRow}>
          <StatusBadge />
          {challenge?.is_public ? (
            <View style={styles.publicBadge}>
              <Ionicons name="globe-outline" size={14} color={colors.text.tertiary} />
              <Text style={styles.publicBadgeText}>{t("challenges.public") || "Public"}</Text>
            </View>
          ) : (
            <View style={styles.publicBadge}>
              <Ionicons name="lock-closed-outline" size={14} color={colors.text.tertiary} />
              <Text style={styles.publicBadgeText}>{t("challenges.private") || "Private"}</Text>
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
                <Ionicons name="star" size={12} color={colors.feedback.warning} />
              </View>
            )}
          </View>
        )}

        {challenge?.description && <Text style={styles.description}>{challenge.description}</Text>}

        {/* Date Info Row */}
        <View style={styles.dateInfoRow}>
          <View style={styles.dateInfoItem}>
            <Ionicons name="calendar-outline" size={14} color={brandColors.primary} />
            <Text style={styles.dateInfoLabel}>{t("challenges.start_date") || "Starts"}</Text>
            <Text style={styles.dateInfoValue}>
              {challenge?.start_date ? formatDate(challenge.start_date) : "-"}
            </Text>
          </View>

          {challenge?.end_date && (
            <View style={styles.dateInfoItem}>
              <Ionicons name="flag-outline" size={14} color={colors.feedback.warning} />
              <Text style={styles.dateInfoLabel}>{t("challenges.end_date") || "Ends"}</Text>
              <Text style={styles.dateInfoValue}>{formatDate(challenge.end_date)}</Text>
            </View>
          )}

          {daysRemaining !== null && isActive && (
            <View style={styles.dateInfoItem}>
              <Ionicons name="timer-outline" size={14} color={colors.feedback.success} />
              <Text style={styles.dateInfoLabel}>{t("challenges.days_left") || "Left"}</Text>
              <Text style={[styles.dateInfoValue, { color: colors.feedback.success }]}>
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
        <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
      </TouchableOpacity>

      {/* Leaderboard Preview */}
      <LeaderboardPreview
        entries={leaderboard.slice(0, 5)}
        myRank={challenge?.my_rank}
        isLoading={leaderboardLoading}
        onViewAll={handleViewLeaderboard}
      />

      {/* Scheduled Days */}
      {challengeDaysOfWeek && challengeDaysOfWeek.length > 0 && (
        <View style={styles.scheduledDaysCard}>
          <Text style={styles.scheduledDaysLabel}>
            {t("goals.scheduled_days") || "Scheduled Days"}
          </Text>
          <View style={styles.daysRow}>
            {["S", "M", "T", "W", "T", "F", "S"].map((dayLabel, index) => {
              const isDayActive = challengeDaysOfWeek.includes(index);
              return (
                <View key={index} style={[styles.dayBadge, isDayActive && styles.dayBadgeActive]}>
                  <Text style={[styles.dayBadgeText, isDayActive && styles.dayBadgeTextActive]}>
                    {dayLabel}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Workout Times */}
      {challengeReminderTimes && challengeReminderTimes.length > 0 && (
        <View style={styles.scheduledDaysCard}>
          <Text style={styles.scheduledDaysLabel}>
            {t("goals.reminder_times") || "Workout Times"}
          </Text>
          <View style={styles.reminderTimesRow}>
            {challengeReminderTimes.map((time, index) => (
              <View key={index} style={styles.reminderTimeBadge}>
                <Ionicons name="time-outline" size={14} color={brandColors.primary} />
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
            <Ionicons name="time-outline" size={24} color={colors.feedback.warning} />
            <View style={styles.deadlineContent}>
              <Text style={styles.deadlineTitle}>{t("challenges.join_deadline") || "Join by"}</Text>
              <Text style={styles.deadlineDate}>{formatDate(challenge.join_deadline)}</Text>
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
          targetValue={challenge.target_value || challengeTargetCheckins}
          myProgress={challenge.my_progress || 0}
          myRank={challenge.my_rank}
          totalParticipants={challenge.participants_count || 0}
          startDate={challenge.start_date}
          endDate={challenge.end_date}
          checkIns={myCheckIns}
          daysOfWeek={challengeDaysOfWeek}
          frequency={(challengeFrequency as "daily" | "weekly") || "daily"}
          trackingType={(challenge.tracking_type as any) || "checkin"}
          isLoading={checkInsLoading}
          isPartnerView={effectivePartnerView}
        />
      )}

      {/* Not a participant message */}
      {!isParticipant && (
        <Card shadow="sm" style={styles.notParticipantCard}>
          <Ionicons name="lock-closed-outline" size={32} color={colors.text.tertiary} />
          <Text style={styles.notParticipantText}>
            {t("challenges.join_to_see_progress") || "Join the challenge to track your progress"}
          </Text>
        </Card>
      )}
    </>
  );

  // Render Plan Tab Content
  const renderPlanTab = () => (
    <>
      {challengeId && (
        <PlanSection
          challengeId={challengeId}
          planStatus={planStatusData}
          entityStatus={challenge?.status}
          isScheduledDay={isScheduledDay}
          isPartnerView={effectivePartnerView}
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
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
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
        <NotFoundState
          title={t("errors.challenge_not_found_title")}
          description={t("errors.challenge_not_found_description")}
          icon="trophy-outline"
        />
      </View>
    );
  }

  // Access guard: Show cancelled message for cancelled challenges
  if (isCancelled && !isCreator) {
    return (
      <View style={styles.container}>
        <BackButton
          title={t("challenges.details") || "Challenge Details"}
          onPress={() => router.back()}
        />
        <View style={styles.errorContainer}>
          <Ionicons name="close-circle-outline" size={48} color={colors.text.tertiary} />
          <Text style={styles.errorText}>
            {t("challenges.cancelled_message") ||
              "This challenge has been cancelled and is no longer available."}
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

  // Access guard: Private challenges require participation or partner access
  // Backend handles access control - if we have challenge data, we have access
  // is_partner_view from backend indicates partner viewing (read-only)
  const isPartnerViewFromBackend = challenge.is_partner_view === true;
  const effectivePartnerView = isPartnerView || isPartnerViewFromBackend;

  // Only show access denied if private, not participant, AND not partner view
  if (!challenge.is_public && !isParticipant && !effectivePartnerView) {
    return (
      <View style={styles.container}>
        <BackButton
          title={t("challenges.details") || "Challenge Details"}
          onPress={() => router.back()}
        />
        <View style={styles.errorContainer}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.text.tertiary} />
          <Text style={styles.errorText}>
            {t("challenges.private_access_denied") ||
              "This is a private challenge. You need an invitation to participate."}
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
          <TouchableOpacity style={styles.menuButton} onPress={() => setShowMenuSheet(true)}>
            <Ionicons name="ellipsis-horizontal" size={24} color={colors.text.primary} />
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
        {/* Partner View Banner */}
        {effectivePartnerView && (
          <View style={styles.partnerBanner}>
            <Ionicons name="eye-outline" size={18} color={brandColors.primary} />
            <Text style={styles.partnerBannerText}>
              {t("partners.viewing_partner_challenge") || "Viewing partner's challenge (read-only)"}
            </Text>
          </View>
        )}

        {/* Tab Content */}
        {renderTabContent()}

        {/* Action Section - Always visible (hidden in partner view) */}
        {!effectivePartnerView && (
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

            {/* Action Buttons - Based on tracking type and scheduled day */}
            {isParticipant && isActive && isScheduledDay && (
              <>
                {/* Manual/Checkin tracking - show Check In button */}
                {isManualTracking && canCheckIn && (
                  <Button
                    variant="primary"
                    title={t("checkin.check_in") || "Check In"}
                    onPress={handleCheckIn}
                    leftIcon="checkmark-circle"
                  />
                )}

                {/* Meal tracking - show Log Meal button */}
                {isMealTracking && !hasCheckedInToday && (
                  <Button
                    variant="primary"
                    title={t("meals.log_meal") || "Log Meal"}
                    onPress={() => setShowMealLogModal(true)}
                    leftIcon="restaurant"
                  />
                )}

                {/* Hydration tracking - show Log Water button */}
                {isHydrationTracking && !hasCheckedInToday && (
                  <Button
                    variant="primary"
                    title={t("hydration.log_water") || "Log Water"}
                    onPress={() => setShowHydrationModal(true)}
                    leftIcon="water"
                  />
                )}

                {/* Workout tracking - hint to go to Plan tab */}
                {isWorkoutTracking && planStatus === "completed" && (
                  <View style={styles.workoutHint}>
                    <Ionicons name="fitness-outline" size={20} color={brandColors.primary} />
                    <Text style={styles.workoutHintText}>
                      {t("goals.start_workout_hint") || "Go to the Plan tab to start your workout"}
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* Already checked in today */}
            {isParticipant && isActive && hasCheckedInToday && (
              <View style={styles.checkedInBadge}>
                <Ionicons name="checkmark-circle" size={20} color={colors.feedback.success} />
                <Text style={styles.checkedInText}>
                  {t("checkin.checked_in_today") || "Checked in today"}
                </Text>
              </View>
            )}

            {/* Rest day - not a scheduled day for any tracking type */}
            {isParticipant && isActive && !isScheduledDay && !hasCheckedInToday && (
              <View style={styles.noCheckInScheduled}>
                <Ionicons name="moon-outline" size={20} color={colors.text.tertiary} />
                <Text style={styles.noCheckInScheduledText}>
                  {t("goals.rest_day") || "Rest day - no action scheduled for today"}
                </Text>
              </View>
            )}

            {/* Challenge is not active - show status message */}
            {!isActive && !isUpcoming && challenge?.status && (
              <View style={styles.inactiveChallengeCard}>
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color={colors.text.tertiary}
                />
                <Text style={styles.inactiveChallengeText}>
                  {isCancelled
                    ? t("challenges.challenge_cancelled") || "This challenge has been cancelled"
                    : isCompleted
                      ? t("challenges.challenge_completed") || "This challenge is completed"
                      : t("challenges.challenge_not_active") || "This challenge is not active"}
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
        )}
      </ScrollView>

      {/* Action Modals - Only show when not in partner view */}
      {!effectivePartnerView && (
        <>
          {/* Check-In Modal - using unified CheckInModal */}
          {challengeId && (
            <CheckInModal
              visible={showCheckInModal}
              challengeId={challengeId}
              challengeCheckIn={selectedCheckIn}
              onClose={() => {
                setShowCheckInModal(false);
                setSelectedCheckIn(null);
              }}
              onComplete={handleCheckInComplete}
            />
          )}

          {/* Meal Log Modal */}
          {challengeId && (
            <MealLogModal
              visible={showMealLogModal}
              onClose={() => setShowMealLogModal(false)}
              challengeId={challengeId}
              calorieTarget={mealPlanTargets.calorieTarget}
              proteinTarget={mealPlanTargets.proteinTarget}
              onSuccess={() => {
                refetchCheckIns();
                refetchLeaderboard();
              }}
            />
          )}

          {/* Hydration Modal */}
          {challengeId && (
            <HydrationModal
              visible={showHydrationModal}
              onClose={() => setShowHydrationModal(false)}
              challengeId={challengeId}
              onSuccess={() => {
                refetchCheckIns();
                refetchLeaderboard();
              }}
            />
          )}
        </>
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

const makeChallengeDetailScreenStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  tabsContainer: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    backgroundColor: colors.bg.canvas
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    padding: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[8]),
    gap: toRN(tokens.spacing[4])
  },
  // Partner view banner
  partnerBanner: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[2]),
    backgroundColor: `${brand.primary}15`,
    borderRadius: toRN(tokens.borderRadius.lg),
    borderWidth: 1,
    borderColor: `${brand.primary}30`
  },
  partnerBannerText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: brand.primary,
    flex: 1
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[4]),
    padding: toRN(tokens.spacing[6])
  },
  errorText: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.base),
    color: colors.text.secondary,
    textAlign: "center" as const
  },
  menuButton: {
    padding: toRN(tokens.spacing[2])
  },
  headerCard: {
    padding: toRN(tokens.spacing[4]),
    gap: toRN(tokens.spacing[3])
  },
  challengeTitle: {
    fontFamily: fontFamily.bold,
    fontSize: toRN(tokens.typography.fontSize.lg),
    color: colors.text.primary,
    lineHeight: toRN(tokens.typography.fontSize.lg * 1.3)
  },
  headerRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const
  },
  statusBadge: {
    paddingHorizontal: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[1]),
    borderRadius: toRN(tokens.borderRadius.full)
  },
  statusBadgeText: {
    fontFamily: fontFamily.semiBold,
    fontSize: toRN(tokens.typography.fontSize.xs),
    textTransform: "uppercase" as const
  },
  publicBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1])
  },
  publicBadgeText: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.xs),
    color: colors.text.tertiary
  },
  creatorRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[2]),
    borderTopWidth: 1,
    borderTopColor: colors.border.default + "30",
    marginTop: toRN(tokens.spacing[1])
  },
  creatorAvatar: {
    width: 36,
    height: 36
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.muted,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  avatarInitial: {
    fontFamily: fontFamily.semiBold,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: brand.primary
  },
  creatorInfo: {
    flex: 1
  },
  creatorName: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.secondary
  },
  creatorBadge: {
    padding: toRN(tokens.spacing[1])
  },
  description: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm * 1.5)
  },
  scheduledDaysCard: {
    backgroundColor: colors.bg.card,
    padding: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.xl),
    borderWidth: 1,
    borderColor: colors.border.subtle
  },
  scheduledDaysLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: colors.text.tertiary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5
  },
  daysRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    marginTop: toRN(tokens.spacing[2])
  },
  dayBadge: {
    width: toRN(tokens.spacing[8]),
    height: toRN(tokens.spacing[8]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: colors.bg.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  dayBadgeActive: {
    backgroundColor: brand.primary
  },
  dayBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: colors.text.tertiary
  },
  dayBadgeTextActive: {
    color: brand.onPrimary
  },
  reminderTimesRow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: toRN(tokens.spacing[2]),
    marginTop: toRN(tokens.spacing[2])
  },
  reminderTimeBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[2]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: colors.bg.muted
  },
  reminderTimeText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.primary
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
    borderTopColor: colors.border.subtle
  },
  dateInfoItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1.5]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[2]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.full)
  },
  dateInfoLabel: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.xs),
    color: colors.text.secondary
  },
  dateInfoValue: {
    fontFamily: fontFamily.semiBold,
    fontSize: toRN(tokens.typography.fontSize.xs),
    color: colors.text.primary
  },
  participantsCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.xl),
    padding: toRN(tokens.spacing[4]),
    borderWidth: 1,
    borderColor: colors.border.subtle
  },
  participantsCardLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
    flex: 1
  },
  participantsIconContainer: {
    width: 48,
    height: 48,
    borderRadius: toRN(tokens.borderRadius.xl),
    backgroundColor: brand.primary + "15",
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  participantsCardContent: {
    flex: 1
  },
  participantsCardTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: toRN(tokens.typography.fontSize.base),
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[0.5])
  },
  participantsCardSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.tertiary
  },
  deadlineCard: {
    padding: toRN(tokens.spacing[4]),
    backgroundColor: colors.feedback.warning + "10",
    borderWidth: 1,
    borderColor: colors.feedback.warning + "30"
  },
  deadlineRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3])
  },
  deadlineContent: {
    flex: 1
  },
  deadlineTitle: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.secondary
  },
  deadlineDate: {
    fontFamily: fontFamily.semiBold,
    fontSize: toRN(tokens.typography.fontSize.base),
    color: colors.feedback.warning
  },
  notParticipantCard: {
    padding: toRN(tokens.spacing[6]),
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3])
  },
  notParticipantText: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.base),
    color: colors.text.secondary,
    textAlign: "center" as const
  },
  actionSection: {
    gap: toRN(tokens.spacing[3]),
    marginTop: toRN(tokens.spacing[4])
  },
  checkedInBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    backgroundColor: colors.feedback.success + "15",
    borderRadius: toRN(tokens.borderRadius.xl)
  },
  checkedInText: {
    fontFamily: fontFamily.medium,
    fontSize: toRN(tokens.typography.fontSize.base),
    color: colors.feedback.success
  },
  noCheckInScheduled: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.xl)
  },
  noCheckInScheduledText: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.tertiary
  },
  workoutHint: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: brand.primary + "15",
    padding: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.xl),
    gap: toRN(tokens.spacing[2])
  },
  workoutHintText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: brand.primary
  },
  inactiveChallengeCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: colors.bg.muted,
    padding: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.xl),
    gap: toRN(tokens.spacing[2])
  },
  inactiveChallengeText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  }
});
