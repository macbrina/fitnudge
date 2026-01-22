import { NudgeSheet } from "@/components/social/NudgeSheet";
import { ReportUserSheet } from "@/components/social/ReportUserSheet";
import { PartnerDetailSkeleton } from "@/components/skeletons";
import { BackButton } from "@/components/ui/BackButton";
import Button from "@/components/ui/Button";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { ApiError } from "@/services/api/base";
import {
  usePartnerDashboard,
  usePartners,
  useRemovePartner,
  useBlockPartner
} from "@/hooks/api/usePartners";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { MOBILE_ROUTES } from "@/lib/routes";
import { toRN } from "@/lib/units";
import type { PartnerGoalSummary } from "@/services/api/partners";
import { usePartnerAccess } from "@/hooks/api/usePartners";
import { useStyles, useTheme } from "@/themes";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import Svg, {
  Defs,
  Rect,
  Stop,
  Circle as SvgCircle,
  LinearGradient as SvgLinearGradient
} from "react-native-svg";

// Default styling for goals (V2 - no categories)
const DEFAULT_GOAL_COLOR = { primary: "#6366F1", secondary: "#A5B4FC" };

// Gradient background component
const GradientBackground = ({ colors, style }: { colors: string[]; style?: any }) => (
  <Svg style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, style]}>
    <Defs>
      <SvgLinearGradient id="bgGradient" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={colors[0]} stopOpacity="1" />
        <Stop offset="1" stopColor={colors[1]} stopOpacity="1" />
      </SvgLinearGradient>
    </Defs>
    <Rect x="0" y="0" width="100%" height="100%" fill="url(#bgGradient)" />
  </Svg>
);

// Circular progress ring component
const ProgressRing = ({
  progress,
  size,
  strokeWidth,
  color
}: {
  progress: number;
  size: number;
  strokeWidth: number;
  color: string;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(progress, 1));

  return (
    <Svg width={size} height={size}>
      <SvgCircle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={`${color}20`}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <SvgCircle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
};

export function PartnerDetailScreen() {
  const params = useLocalSearchParams<{
    partnerUserId?: string;
    partnershipId?: string;
  }>();
  const { partnerUserId, partnershipId } = params;

  const styles = useStyles(makePartnerDetailStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { showConfirm, showAlert, showToast } = useAlertModal();

  const [refreshing, setRefreshing] = useState(false);
  const [showNudgeSheet, setShowNudgeSheet] = useState(false);
  const [showReportSheet, setShowReportSheet] = useState(false);

  // Fetch partner dashboard data
  const {
    data: dashboard,
    isLoading,
    isFetching,
    refetch,
    error
  } = usePartnerDashboard(partnerUserId);

  const removePartner = useRemovePartner();
  const blockPartner = useBlockPartner();

  // Fetch partners list to detect if partnership is removed
  const { data: partnersData } = usePartners();

  // Check if still partners (for real-time detection of partnership removal)
  const isStillPartner = useMemo(() => {
    if (!partnersData?.data || !partnerUserId) return true;
    return partnersData.data.some(
      (p) => p.partner?.id === partnerUserId || p.partner_user_id === partnerUserId
    );
  }, [partnersData?.data, partnerUserId]);

  // Navigate away if partnership is removed (detected via realtime)
  useEffect(() => {
    if (dashboard && !isStillPartner && partnersData?.data) {
      showToast({
        title: t("partners.no_longer_partners") || "Partnership Ended",
        message:
          t("partners.partnership_removed_message") || "You are no longer accountability partners",
        variant: "info"
      });
      router.back();
    }
  }, [isStillPartner, dashboard, partnersData?.data]);

  // Navigate away if 404 (partnership blocked/removed before screen loaded)
  useEffect(() => {
    // Only redirect after loading is complete and we have no dashboard data
    if (!isLoading && !isFetching && !dashboard && error) {
      router.back();
    }
  }, [isLoading, isFetching, dashboard, error, router]);

  // Premium access check - use unified hook for consistency
  const { hasFeature: userHasFeature, openSubscriptionModal } = usePartnerAccess();
  const partnerHasFeature = dashboard?.partner?.has_partner_feature ?? false;
  const hasAccess = userHasFeature || partnerHasFeature;

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleRemovePartner = async () => {
    if (!partnershipId) return;

    const confirmed = await showConfirm({
      title: t("partners.remove_partner_title") || "Remove Partner",
      message:
        t("partners.remove_partner_message") ||
        "Are you sure you want to remove this accountability partner? You will no longer be able to see each other's goals and progress.",
      variant: "warning",
      size: "lg",
      messageAlign: "left",
      confirmLabel: t("common.remove") || "Remove",
      cancelLabel: t("common.cancel")
    });

    if (!confirmed) return;

    try {
      await removePartner.mutateAsync(partnershipId);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof ApiError
          ? error.message
          : t("partners.remove_partner_error") || "Failed to remove partner";
      showAlert({
        title: t("common.error"),
        message: errorMessage,
        variant: "error",
        confirmLabel: t("common.ok")
      });
    }
  };

  const handleNudgePartner = useCallback(() => {
    setShowNudgeSheet(true);
  }, []);

  const handleBlockPartner = useCallback(async () => {
    if (!partnershipId) return;

    const confirmed = await showConfirm({
      title: t("partners.block_partner_title") || "Block Partner",
      message:
        t("partners.block_partner_message") ||
        "Are you sure you want to block this partner? They won't be able to see your activity and won't appear in your suggestions.",
      variant: "warning",
      size: "lg",
      messageAlign: "left",
      confirmLabel: t("common.block") || "Block",
      cancelLabel: t("common.cancel")
    });

    if (!confirmed) return;

    // Fire-and-forget with optimistic update
    // The useBlockPartner hook handles cache update in onMutate
    const attemptBlock = (retryCount: number) => {
      blockPartner.mutate(partnershipId, {
        onError: () => {
          // Silent retry once
          if (retryCount < 1) {
            setTimeout(() => attemptBlock(retryCount + 1), 1000);
          } else {
            // Show error after retry fails
            showAlert({
              title: t("common.error"),
              message: t("partners.block_partner_error") || "Failed to block partner",
              variant: "error",
              confirmLabel: t("common.ok")
            });
          }
        }
      });
    };

    attemptBlock(0);

    // Navigate immediately - optimistic update already removed from cache
    router.back();
  }, [partnershipId, showConfirm, t, blockPartner, router, showAlert]);

  const handleReportUser = useCallback(() => {
    setShowReportSheet(true);
  }, []);

  const handleGoalPress = (goal: PartnerGoalSummary) => {
    router.push(
      `${MOBILE_ROUTES.GOALS.DETAILS}?id=${goal.id}&viewMode=partner&partnerId=${partnerUserId}`
    );
  };

  // Render goal card - premium style
  const renderGoalCard = (goal: PartnerGoalSummary, index: number) => {
    const goalColor = DEFAULT_GOAL_COLOR;
    const isLogged = goal.logged_today;

    return (
      <TouchableOpacity
        key={goal.id}
        style={styles.activityCard}
        onPress={() => handleGoalPress(goal)}
        activeOpacity={0.85}
      >
        {/* Left accent bar with gradient */}
        <View style={styles.cardAccent}>
          <GradientBackground colors={[goalColor.primary, goalColor.secondary]} />
        </View>

        <View style={styles.activityCardContent}>
          {/* Icon with gradient background */}
          <View
            style={[styles.activityIconContainer, { backgroundColor: `${goalColor.primary}12` }]}
          >
            <Ionicons name="flag-outline" size={22} color={goalColor.primary} />
          </View>

          {/* Content */}
          <View style={styles.activityInfo}>
            <Text style={styles.activityTitle} numberOfLines={1}>
              {goal.title}
            </Text>
            <View style={styles.activityMeta}>
              <Text style={styles.activityCategory}>
                {goal.frequency_type === "daily"
                  ? t("goals.schedule_daily")
                  : t("goals.schedule_weekly")}
              </Text>
              {goal.current_streak > 0 && (
                <View style={styles.miniStreakBadge}>
                  <Ionicons name="flame" size={11} color="#F59E0B" />
                  <Text style={styles.miniStreakText}>{goal.current_streak}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Status indicator */}
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: isLogged ? colors.feedback.success : colors.feedback.warning
              }
            ]}
          >
            <Ionicons name={isLogged ? "checkmark" : "time"} size={12} color="#FFFFFF" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Loading state
  if (isLoading) {
    return <PartnerDetailSkeleton />;
  }

  // Error state
  const isPartnerInactive =
    error?.message?.includes("no longer active") || error?.message?.includes("403");

  if (error || !dashboard) {
    return (
      <View style={styles.container}>
        <BackButton
          title={
            isPartnerInactive
              ? t("partners.account_unavailable") || "Account Unavailable"
              : t("partners.partner_details") || "Partner Details"
          }
          onPress={() => router.back()}
        />
        <View style={styles.errorContainer}>
          <View style={styles.errorIconContainer}>
            <Ionicons
              name={isPartnerInactive ? "person-remove-outline" : "alert-circle-outline"}
              size={40}
              color={colors.text.tertiary}
            />
          </View>
          <Text style={styles.errorTitle}>
            {isPartnerInactive
              ? t("partners.account_unavailable") || "Account Unavailable"
              : t("common.error") || "Something went wrong"}
          </Text>
          <Text style={styles.errorText}>
            {isPartnerInactive
              ? t("partners.account_inactive") || "This user's account is no longer active"
              : t("partners.dashboard_error") || "Failed to load partner data"}
          </Text>
          {!isPartnerInactive && (
            <Button
              variant="primary"
              title={t("common.retry") || "Try Again"}
              onPress={() => refetch()}
              loading={isFetching}
              disabled={isFetching}
              style={styles.retryButton}
            />
          )}
        </View>
      </View>
    );
  }

  // Premium gate
  if (!hasAccess) {
    return (
      <View style={styles.container}>
        <BackButton
          title={t("partners.partner_details") || "Partner Details"}
          onPress={() => router.back()}
        />
        <View style={styles.premiumGate}>
          <View style={[styles.premiumIconContainer, { backgroundColor: brandColors.primary }]}>
            <Ionicons name="lock-closed" size={36} color="#FFFFFF" />
          </View>
          <Text style={styles.premiumTitle}>
            {t("partners.premium_required_title") || "Premium Feature"}
          </Text>
          <Text style={styles.premiumDescription}>
            {t("partners.premium_required_description") ||
              "To access accountability partner features, either you or your partner needs a premium subscription."}
          </Text>
          <Button
            title={t("common.upgrade") || "Upgrade to Unlock"}
            onPress={openSubscriptionModal}
            style={styles.upgradeButton}
          />
        </View>
      </View>
    );
  }

  const { partner, goals, overall_streak, logged_today, has_scheduled_today } = dashboard;

  const hasActiveItems = goals.length > 0;

  return (
    <View style={styles.container}>
      <BackButton
        title={partner.name || partner.username || "Partner"}
        titleCentered={false}
        onPress={() => router.back()}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={brandColors.primary}
          />
        }
      >
        {/* Hero Profile Section */}
        <View style={styles.profileSection}>
          {/* Avatar with glow effect */}
          <View style={styles.avatarWrapper}>
            <View style={[styles.avatarGlow, { backgroundColor: `${brandColors.primary}20` }]} />
            {partner.profile_picture_url ? (
              <Image source={{ uri: partner.profile_picture_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: brandColors.primary }]}>
                <Text style={styles.avatarInitial}>
                  {partner.name?.charAt(0)?.toUpperCase() ||
                    partner.username?.charAt(0)?.toUpperCase() ||
                    "?"}
                </Text>
              </View>
            )}
            {/* Activity indicator */}
            {logged_today && (
              <View style={styles.activityBadge}>
                <Ionicons name="checkmark" size={10} color="#FFFFFF" />
              </View>
            )}
          </View>

          {/* Name & Username */}
          {partner.username && <Text style={styles.profileUsername}>@{partner.username}</Text>}
          <Text style={styles.profileName}>{partner.name || t("partners.unknown_user")}</Text>

          {/* Action Buttons Row */}
          <View style={styles.actionButtonsRow}>
            {hasActiveItems && (
              <Button
                title={t("partners.send_nudge") || "Send Nudge"}
                variant="outline"
                size="sm"
                leftIcon="hand-right"
                onPress={handleNudgePartner}
              />
            )}
            <Button
              title={t("partners.remove_partner") || "Remove Partner"}
              variant="dangerOutline"
              size="sm"
              onPress={handleRemovePartner}
              loading={removePartner.isPending}
            />
          </View>

          {/* Secondary Actions - Block & Report */}
          <View style={styles.secondaryActionsRow}>
            <TouchableOpacity
              style={styles.secondaryActionButton}
              onPress={handleBlockPartner}
              activeOpacity={0.7}
            >
              <Ionicons name="ban-outline" size={16} color={colors.text.tertiary} />
              <Text style={styles.secondaryActionText}>{t("partners.block") || "Block"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryActionButton}
              onPress={handleReportUser}
              activeOpacity={0.7}
            >
              <Ionicons name="flag-outline" size={16} color={colors.text.tertiary} />
              <Text style={styles.secondaryActionText}>{t("partners.report") || "Report"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Grid - 2x2 */}
        <View style={styles.statsGrid}>
          {/* Row 1 */}
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{dashboard.total_active_goals}</Text>
            <Text style={styles.statLabel}>{t("partners.active_goals") || "Active Goals"}</Text>
          </View>

          {/* Row 2 */}
          <View style={styles.statCard}>
            <View style={styles.streakValueRow}>
              <Ionicons name="flame" size={20} color="#F59E0B" />
              <Text style={styles.statValue}>{overall_streak}</Text>
            </View>
            <Text style={styles.statLabel}>{t("partners.streak") || "Day Streak"}</Text>
          </View>

          <View style={styles.statCard}>
            {has_scheduled_today === false ? (
              // Rest Day - nothing scheduled today
              <>
                <Ionicons name="moon-outline" size={24} color={colors.text.tertiary} />
                <Text style={styles.statLabel}>{t("partners.rest_day") || "Rest Day"}</Text>
              </>
            ) : (
              // Scheduled day - show Yes/No
              <>
                <Text
                  style={[
                    styles.statValue,
                    {
                      color: logged_today ? colors.feedback.success : colors.feedback.warning
                    }
                  ]}
                >
                  {logged_today ? t("partners.yes") || "Yes" : t("partners.no") || "No"}
                </Text>
                <Text style={styles.statLabel}>{t("partners.logged_today") || "Logged Today"}</Text>
              </>
            )}
          </View>
        </View>

        {/* Goals Section */}
        {goals.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t("partners.their_goals") || "Their Goals"}</Text>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>{goals.length}</Text>
              </View>
            </View>
            <View style={styles.activityList}>
              {goals.map((goal, index) => renderGoalCard(goal, index))}
            </View>
          </View>
        )}

        {/* Empty state */}
        {goals.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="leaf-outline" size={40} color={colors.text.tertiary} />
            </View>
            <Text style={styles.emptyTitle}>
              {t("partners.no_active_items") || "No Active Goals"}
            </Text>
            <Text style={styles.emptyDesc}>
              {t("partners.no_active_items_desc") ||
                "Your partner hasn't set up any active goals yet."}
            </Text>
          </View>
        )}

        {/* How it works - Minimalist Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>
            {t("partners.accountability_info_title") || "How Accountability Works"}
          </Text>
          <View style={styles.infoRow}>
            <View style={styles.infoIconSmall}>
              <Ionicons name="eye-outline" size={16} color={brandColors.primary} />
            </View>
            <Text style={styles.infoTextSmall}>
              {t("partners.info_see_progress") ||
                "You can see each other's goals and daily progress"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoIconSmall}>
              <Ionicons name="hand-right" size={16} color={brandColors.primary} />
            </View>
            <Text style={styles.infoTextSmall}>
              {t("partners.info_nudge") || "Send nudges to encourage them to stay on track"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoIconSmall}>
              <Ionicons name="notifications-outline" size={16} color={brandColors.primary} />
            </View>
            <Text style={styles.infoTextSmall}>
              {t("partners.info_notifications") || "Get notified when they achieve milestones"}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Nudge Sheet */}
      <NudgeSheet
        visible={showNudgeSheet}
        onClose={() => setShowNudgeSheet(false)}
        recipientId={partnerUserId || ""}
        recipientName={partner?.name || partner?.username || t("partners.partner")}
        partnershipId={partnershipId}
      />

      {/* Report User Sheet */}
      <ReportUserSheet
        visible={showReportSheet}
        onClose={() => setShowReportSheet(false)}
        userId={partnerUserId || ""}
        username={partner?.username || partner?.name}
        onSuccess={() => router.back()}
      />
    </View>
  );
}

const makePartnerDetailStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[12])
  },

  // Profile Section
  profileSection: {
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[6])
  },
  avatarWrapper: {
    position: "relative" as const,
    marginBottom: toRN(tokens.spacing[4])
  },
  avatarGlow: {
    position: "absolute" as const,
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 60
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: colors.bg.card
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    borderWidth: 3,
    borderColor: colors.bg.card
  },
  avatarInitial: {
    fontFamily: fontFamily.bold,
    fontSize: toRN(tokens.typography.fontSize["3xl"]),
    color: "#FFFFFF"
  },
  activityBadge: {
    position: "absolute" as const,
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.feedback.success,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    borderWidth: 2,
    borderColor: colors.bg.canvas
  },
  profileUsername: {
    fontFamily: fontFamily.medium,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.tertiary,
    marginBottom: toRN(tokens.spacing[1])
  },
  profileName: {
    fontFamily: fontFamily.bold,
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[4])
  },
  actionButtonsRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3])
  },
  secondaryActionsRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[4]),
    marginTop: toRN(tokens.spacing[3])
  },
  secondaryActionButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1])
  },
  secondaryActionText: {
    fontFamily: fontFamily.medium,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.tertiary
  },

  // Stats Grid - 2x2
  statsGrid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    marginBottom: toRN(tokens.spacing[6]),
    gap: toRN(tokens.spacing[3])
  },
  statCard: {
    width: "47%" as const,
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.xl),
    padding: toRN(tokens.spacing[4]),
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[1]),
    shadowColor: colors.shadow.sm,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    shadowOpacity: 0.06,
    elevation: 2
  },
  streakValueRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1])
  },
  statValue: {
    fontFamily: fontFamily.bold,
    fontSize: toRN(tokens.typography.fontSize.lg),
    color: colors.text.primary
  },
  statLabel: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.xs),
    color: colors.text.tertiary,
    textAlign: "center" as const
  },

  // Section
  section: {
    marginBottom: toRN(tokens.spacing[6])
  },
  sectionHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[3])
  },
  sectionTitle: {
    fontFamily: fontFamily.bold,
    fontSize: toRN(tokens.typography.fontSize.lg),
    color: colors.text.primary,
    flex: 1
  },
  sectionBadge: {
    backgroundColor: `${brand.primary}15`,
    paddingHorizontal: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[1]),
    borderRadius: toRN(tokens.borderRadius.full)
  },
  sectionBadgeText: {
    fontFamily: fontFamily.semiBold,
    fontSize: toRN(tokens.typography.fontSize.xs),
    color: brand.primary
  },

  // Activity Cards
  activityList: {
    gap: toRN(tokens.spacing[3])
  },
  activityCard: {
    flexDirection: "row" as const,
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius["2xl"]),
    overflow: "hidden" as const,
    shadowColor: colors.shadow.sm,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    shadowOpacity: 0.06,
    elevation: 2
  },
  cardAccent: {
    width: 4,
    overflow: "hidden" as const
  },
  activityCardContent: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    padding: toRN(tokens.spacing[3]),
    gap: toRN(tokens.spacing[3])
  },
  activityIconContainer: {
    width: 48,
    height: 48,
    borderRadius: toRN(tokens.borderRadius.xl),
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  challengeIconWrapper: {
    position: "relative" as const,
    width: 48,
    height: 48,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  challengeIconInner: {
    position: "absolute" as const,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  activityInfo: {
    flex: 1
  },
  activityTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: toRN(tokens.typography.fontSize.base),
    color: colors.text.primary,
    marginBottom: 4
  },
  activityMeta: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2])
  },
  activityCategory: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.xs),
    color: colors.text.tertiary,
    textTransform: "capitalize" as const
  },
  miniStreakBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 2,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: toRN(tokens.spacing[1]),
    paddingVertical: 2,
    borderRadius: toRN(tokens.borderRadius.full)
  },
  miniStreakText: {
    fontFamily: fontFamily.semiBold,
    fontSize: 10,
    color: "#F59E0B"
  },
  participantsBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 3
  },
  participantsText: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.xs),
    color: colors.text.tertiary
  },
  progressText: {
    fontFamily: fontFamily.medium,
    fontSize: toRN(tokens.typography.fontSize.xs),
    color: colors.text.secondary
  },
  statusDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },

  // Empty State
  emptyState: {
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[10]),
    paddingHorizontal: toRN(tokens.spacing[6])
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.bg.muted,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[4])
  },
  emptyTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: toRN(tokens.typography.fontSize.lg),
    color: colors.text.primary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[2])
  },
  emptyDesc: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.secondary,
    textAlign: "center" as const,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.6,
    maxWidth: 280
  },

  // Info Card
  infoCard: {
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius["2xl"]),
    padding: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[6])
  },
  infoCardTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[3])
  },
  infoRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[3])
  },
  infoIconSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${brand.primary}10`,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  infoTextSmall: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.4
  },

  // Error & Loading States
  errorContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[8])
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.bg.muted,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[4])
  },
  errorTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: toRN(tokens.typography.fontSize.lg),
    color: colors.text.primary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[2])
  },
  errorText: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.secondary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[6])
  },
  retryButton: {
    minWidth: 160
  },
  // Premium Gate
  premiumGate: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[8])
  },
  premiumIconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[5])
  },
  premiumTitle: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[2]),
    textAlign: "center" as const
  },
  premiumDescription: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    lineHeight: toRN(tokens.typography.fontSize.base) * 1.5,
    marginBottom: toRN(tokens.spacing[6])
  },
  upgradeButton: {
    minWidth: 200
  }
});

export default PartnerDetailScreen;
