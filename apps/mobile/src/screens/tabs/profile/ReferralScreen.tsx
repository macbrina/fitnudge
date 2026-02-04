import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { BackButton } from "@/components/ui/BackButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { useReferralCode, useMyReferrals, useRefreshReferrals } from "@/hooks/api/useReferral";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { toRN } from "@/lib/units";
import { useStyles, useTheme } from "@/themes";
import { Ionicons } from "@expo/vector-icons";
import CheckmarkCircle from "@/components/ui/CheckmarkCircle";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { UserAvatar } from "@/components/avatars";
import {
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import * as Clipboard from "expo-clipboard";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from "react-native-svg";

// Type for referral data
interface ReferralUser {
  id: string;
  username?: string;
  name?: string;
  profile_picture_url?: string | null;
  created_at: string;
  referral_bonus_granted_at?: string | null;
  bonus_days_referrer?: number;
  status?: "pending" | "subscribed" | "processing" | "rewarded" | "failed";
}

// 3D illustration for the hero section
// Download a "3D gift box with coins/rewards" or "3D celebration with gift" from Freepik
// Save as: apps/mobile/assets/images/referral_hero.png
const REFERRAL_HERO_IMAGE = require("@assetsimages/images/referral_hero.png");

export const ReferralScreen: React.FC = () => {
  const router = useRouter();
  const styles = useStyles(makeStyles);
  const { colors, brandColors, isDark } = useTheme();
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();

  const {
    data: referralData,
    isLoading: isLoadingCode,
    isFetching: isFetchingCode
  } = useReferralCode();

  const {
    data: referralsData,
    isLoading: isLoadingReferrals,
    isFetching: isFetchingReferrals
  } = useMyReferrals();

  // Force refresh hook (invalidates cache to ensure network call)
  const refreshReferrals = useRefreshReferrals();
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const referralCode = referralData?.data?.referral_code || "";
  const referralLink = referralData?.data?.referral_link || "";

  // Safely extract referrals array - handle both array response and object with referrals property
  const referralsRaw = referralsData?.data;
  const referrals: ReferralUser[] = Array.isArray(referralsRaw)
    ? referralsRaw
    : Array.isArray((referralsRaw as any)?.referrals)
      ? (referralsRaw as any).referrals
      : [];

  const isLoading = isLoadingCode || isLoadingReferrals;
  const isRefreshing = isFetchingCode || isFetchingReferrals || isManualRefreshing;

  // Calculate stats (use API total when available, else fallback to earnedReferrals * 7)
  const totalReferrals = referrals.length;
  // Use status as primary check, fall back to referral_bonus_granted_at for backward compat
  const earnedReferrals = referrals.filter(
    (r) => r.status === "rewarded" || r.referral_bonus_granted_at
  ).length;
  const totalDaysEarned =
    (referralsData?.data as { total_bonus_days_earned?: number })?.total_bonus_days_earned ??
    earnedReferrals * 7;

  const onRefresh = async () => {
    setIsManualRefreshing(true);
    try {
      await refreshReferrals();
    } finally {
      setIsManualRefreshing(false);
    }
  };

  const handleCopyCode = async () => {
    if (!referralCode) return;
    await Clipboard.setStringAsync(referralCode);
    showAlert({
      title: t("referral.copied_title") || "Copied!",
      message: t("referral.code_copied") || "Referral code copied to clipboard",
      variant: "success",
      confirmLabel: t("common.ok")
    });
  };

  const handleCopyLink = async () => {
    if (!referralLink) return;
    await Clipboard.setStringAsync(referralLink);
    showAlert({
      title: t("referral.copied_title") || "Copied!",
      message: t("referral.link_copied") || "Referral link copied to clipboard",
      variant: "success",
      confirmLabel: t("common.ok")
    });
  };

  const handleShare = async () => {
    if (!referralLink) return;

    try {
      if (Platform.OS === "ios") {
        // iOS: Use url property - iOS will display the link nicely
        // Use a shorter message since iOS appends the URL automatically
        const iosMessage =
          t("referral.share_message_short") ||
          "Join me on FitNudge and start your fitness journey! 💪";

        await Share.share({
          message: iosMessage,
          url: referralLink
        });
      } else {
        // Android: Include link in message (no url property support)
        const message =
          t("referral.share_message", { link: referralLink }) ||
          `Join me on FitNudge! Use my referral link to get started: ${referralLink}`;

        await Share.share({ message });
      }
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const [tabIndex, setTabIndex] = useState(0);
  const tabOptions = [
    t("referral.tab_invite") || "Invite",
    t("referral.tab_how_it_works") || "How It Works",
    t("referral.tab_referrals") || "Referrals"
  ];

  // Skeleton Loading State
  if (isLoading) {
    return (
      <View style={styles.container}>
        <BackButton title={t("referral.title") || "Invite Friends"} onPress={() => router.back()} />
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
          {/* Hero Skeleton */}
          <View style={styles.heroSection}>
            <SkeletonBox width={180} height={180} borderRadius={90} style={{ marginBottom: 16 }} />
            <SkeletonBox width={250} height={28} borderRadius={8} style={{ marginBottom: 8 }} />
            <SkeletonBox width={200} height={16} borderRadius={8} />
          </View>

          {/* Stats Skeleton */}
          <View style={styles.statsContainer}>
            <SkeletonBox width="48%" height={80} borderRadius={16} />
            <SkeletonBox width="48%" height={80} borderRadius={16} />
          </View>

          {/* Code Card Skeleton */}
          <SkeletonBox width="100%" height={120} borderRadius={20} style={{ marginBottom: 16 }} />

          {/* Share Button Skeleton */}
          <SkeletonBox width="100%" height={52} borderRadius={12} style={{ marginBottom: 24 }} />

          {/* How it works Skeleton */}
          <SkeletonBox width={120} height={20} borderRadius={8} style={{ marginBottom: 16 }} />
          <SkeletonBox width="100%" height={180} borderRadius={16} />
        </ScrollView>
      </View>
    );
  }

  const renderTabContent = () => {
    if (tabIndex === 0) {
      return (
        <>
          {/* Tab 1: Hero Section with 3D Image up to Referral Code Card - Premium Design */}
          <View style={styles.heroSection}>
            <View style={styles.heroImageWrapper}>
              <Image source={REFERRAL_HERO_IMAGE} style={styles.heroImage} resizeMode="contain" />
            </View>
            <Text style={styles.heroTitle}>
              {t("referral.hero_title") || "Invite Friends, Earn Rewards"}
            </Text>
            <Text style={styles.heroSubtitle}>
              {t("referral.hero_subtitle") ||
                "Share your referral link and get 7 days free when a friend subscribes!"}
            </Text>
          </View>

          <View style={styles.statsContainer}>
            <View style={[styles.statCard, { backgroundColor: `${brandColors.primary}15` }]}>
              <View style={[styles.statIconCircle, { backgroundColor: brandColors.primary }]}>
                <Ionicons name="people" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.statValue}>{totalReferrals}</Text>
              <Text style={styles.statLabel}>
                {t("referral.stat_friends") || "Friends Invited"}
              </Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: `${colors.feedback.success}15` }]}>
              <View style={[styles.statIconCircle, { backgroundColor: colors.feedback.success }]}>
                <Ionicons name="gift" size={20} color="#FFFFFF" />
              </View>
              <Text style={[styles.statValue, { color: colors.feedback.success }]}>
                {totalDaysEarned}
              </Text>
              <Text style={styles.statLabel}>{t("referral.stat_days") || "Days Earned"}</Text>
            </View>
          </View>

          <View style={styles.codeCardWrapper}>
            <Svg style={styles.codeCardGradient} height="100%" width="100%">
              <Defs>
                <SvgLinearGradient id="codeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop
                    offset="0%"
                    stopColor={brandColors.primary}
                    stopOpacity={isDark ? 0.2 : 0.1}
                  />
                  <Stop
                    offset="100%"
                    stopColor={brandColors.primary}
                    stopOpacity={isDark ? 0.05 : 0.02}
                  />
                </SvgLinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#codeGradient)" rx={20} />
            </Svg>
            <View style={styles.codeCardContent}>
              <Text style={styles.codeLabel}>
                {t("referral.your_code") || "Your Referral Code"}
              </Text>
              <View style={styles.codeContainer}>
                <Text style={styles.codeText}>{referralCode}</Text>
                <TouchableOpacity onPress={handleCopyCode} style={styles.copyIconButton}>
                  <Ionicons name="copy" size={18} color={brandColors.primary} />
                </TouchableOpacity>
              </View>
              <View style={styles.codeActions}>
                <TouchableOpacity onPress={handleCopyLink} style={styles.copyLinkButton}>
                  <Ionicons name="link" size={16} color={brandColors.primary} />
                  <Text style={styles.copyLinkText}>{t("referral.copy_link") || "Copy Link"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <Button
            title={t("referral.share_link") || "Share Referral Link"}
            onPress={handleShare}
            style={styles.shareButton}
            leftIcon="share-social"
            size="md"
          />
        </>
      );
    }

    if (tabIndex === 1) {
      return (
        <View style={styles.howItWorksSection}>
          <Card style={styles.programInfoCard}>
            <Text style={styles.programInfoTitle}>
              {t("referral.program_info_title") || "Program Details"}
            </Text>
            <Text style={[styles.programInfoText, { color: colors.text.secondary }]}>
              {t("referral.program_info_1") ||
                "Users can earn up to 30 free premium days by referring friends."}
            </Text>
            <Text style={[styles.programInfoText, { color: colors.text.secondary }]}>
              {t("referral.program_info_2") ||
                "Each successful referral grants 7 days once the referred user completes a paid subscription."}
            </Text>
            <Text style={[styles.programInfoText, { color: colors.text.secondary }]}>
              {t("referral.program_info_3") || "Free days do not stack beyond the maximum limit."}
            </Text>
          </Card>

          <View style={[styles.pasteTipCard, { backgroundColor: `${brandColors.primary}10` }]}>
            <Ionicons name="information-circle-outline" size={20} color={brandColors.primary} />
            <Text style={[styles.pasteTipText, { color: colors.text.secondary }]}>
              {t("referral.paste_tip") ||
                "Tip: If your friend's link doesn't apply automatically, encourage them to paste your referral code in the \"Have a referral code?\" field on the signup screen."}
            </Text>
          </View>

          <Card style={styles.stepsCard}>
            <View style={styles.stepItem}>
              <View
                style={[styles.stepIconCircle, { backgroundColor: `${brandColors.primary}15` }]}
              >
                <Ionicons name="share-social" size={22} color={brandColors.primary} />
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>
                  {t("referral.step1_title") || "Share Your Link"}
                </Text>
                <Text style={styles.stepDescription}>
                  {t("referral.step1_desc") || "Send your unique referral link to friends"}
                </Text>
              </View>
            </View>

            <View style={styles.stepDivider} />

            <View style={styles.stepItem}>
              <View
                style={[styles.stepIconCircle, { backgroundColor: `${brandColors.primary}15` }]}
              >
                <Ionicons name="person-add" size={22} color={brandColors.primary} />
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>
                  {t("referral.step2_title") || "Friend Joins & Subscribes"}
                </Text>
                <Text style={styles.stepDescription}>
                  {t("referral.step2_desc") || "They sign up and subscribe to premium"}
                </Text>
              </View>
            </View>

            <View style={styles.stepDivider} />

            <View style={styles.stepItem}>
              <View
                style={[styles.stepIconCircle, { backgroundColor: `${colors.feedback.success}15` }]}
              >
                <Ionicons name="gift" size={22} color={colors.feedback.success} />
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>
                  {t("referral.step3_title") || "You Get Rewarded"}
                </Text>
                <Text style={styles.stepDescription}>
                  {t("referral.step3_desc") || "Earn 7 free days added to your subscription!"}
                </Text>
              </View>
            </View>
          </Card>
        </View>
      );
    }

    return (
      <View style={styles.referralsSection}>
        <View style={styles.referralsSectionHeader}>
          <Text style={styles.sectionTitle}>
            {t("referral.your_referrals") || "Your Referrals"}
          </Text>
          {totalReferrals > 0 && (
            <View style={styles.referralsCountBadge}>
              <Text style={styles.referralsCountBadgeText}>{totalReferrals}</Text>
            </View>
          )}
        </View>

        {referrals.length === 0 ? (
          <Card style={styles.emptyReferralsCard}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="people-outline" size={32} color={colors.text.tertiary} />
            </View>
            <Text style={styles.emptyTitle}>
              {t("referral.no_referrals_title") || "No referrals yet"}
            </Text>
            <Text style={styles.emptyDescription}>
              {t("referral.no_referrals_desc") ||
                "Share your link with friends to start earning rewards!"}
            </Text>
          </Card>
        ) : (
          <Card style={styles.referralsListCard}>
            {referrals.map((referral: ReferralUser, index: number) => {
              // Use status as primary check, fall back to referral_bonus_granted_at
              const isRewarded =
                referral.status === "rewarded" || !!referral.referral_bonus_granted_at;

              return (
                <React.Fragment key={referral.id}>
                  <View style={styles.referralItem}>
                    <View style={styles.referralAvatarContainer}>
                      <UserAvatar
                        profilePictureUrl={referral.profile_picture_url}
                        name={referral.name || referral.username}
                        size={44}
                        placeholderColor={
                          isRewarded ? colors.feedback.success : brandColors.primary
                        }
                      />
                    </View>
                    <View style={styles.referralInfo}>
                      <Text style={styles.referralName}>
                        {referral.name || referral.username || "User"}
                      </Text>
                      <Text style={styles.referralDate}>
                        {t("referral.joined_on", {
                          date: formatDate(referral.created_at)
                        }) || `Joined ${formatDate(referral.created_at)}`}
                      </Text>
                    </View>
                    {isRewarded ? (
                      <View style={styles.earnedBadge}>
                        <CheckmarkCircle size={14} color={colors.feedback.success} mr={1} />
                        <Text style={styles.earnedBadgeText}>
                          {t("referral.earned") || "Earned"}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.pendingBadge}>
                        <Ionicons name="time-outline" size={14} color={colors.text.tertiary} />
                        <Text style={styles.pendingBadgeText}>
                          {t("referral.pending") || "Pending"}
                        </Text>
                      </View>
                    )}
                  </View>
                  {index < referrals.length - 1 && <View style={styles.referralDivider} />}
                </React.Fragment>
              );
            })}
          </Card>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <BackButton title={t("referral.title") || "Invite Friends"} onPress={() => router.back()} />

      <View style={styles.tabsWrapper}>
        <SegmentedControl
          options={tabOptions}
          selectedIndex={tabIndex}
          onChange={setTabIndex}
          style={styles.segmentedControl}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={brandColors.primary}
          />
        }
      >
        {renderTabContent()}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
};

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  scrollView: {
    flex: 1
  },
  contentContainer: {
    padding: toRN(tokens.spacing[4]),
    paddingTop: toRN(tokens.spacing[2])
  },
  tabsWrapper: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[3])
  },
  segmentedControl: {
    width: "100%"
  },

  // Hero Section
  heroSection: {
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[5])
  },
  heroImageContainer: {
    width: 180,
    height: 180,
    marginBottom: toRN(tokens.spacing[3])
  },
  heroImageWrapper: {
    width: 200,
    height: 200,
    marginBottom: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius["2xl"]),
    overflow: "hidden" as const,
    backgroundColor: `${brand.primary}08`,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8
  },
  heroImage: {
    width: "100%" as any,
    height: "100%" as any
  },
  heroTitle: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[2])
  },
  heroSubtitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[2]),
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5
  },

  // Stats
  statsContainer: {
    flexDirection: "row" as const,
    gap: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[5])
  },
  statCard: {
    flex: 1,
    borderRadius: toRN(tokens.borderRadius.xl),
    padding: toRN(tokens.spacing[4]),
    alignItems: "center" as const
  },
  statIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: toRN(tokens.spacing[2])
  },
  statValue: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.bold,
    color: brand.primary,
    marginBottom: 2
  },
  statLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
    textAlign: "center" as const
  },

  // Code Card
  codeCardWrapper: {
    position: "relative" as const,
    marginBottom: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.xl),
    overflow: "hidden" as const,
    borderWidth: 1,
    borderColor: `${brand.primary}30`
  },
  codeCardGradient: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  },
  codeCardContent: {
    padding: toRN(tokens.spacing[5]),
    alignItems: "center" as const
  },
  codeLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
    marginBottom: toRN(tokens.spacing[2])
  },
  codeContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[3])
  },
  codeText: {
    fontSize: toRN(tokens.typography.fontSize["3xl"]),
    fontFamily: fontFamily.bold,
    color: brand.primary,
    letterSpacing: 3
  },
  copyIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${brand.primary}15`,
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  codeActions: {
    flexDirection: "row" as const,
    alignItems: "center" as const
  },
  copyLinkButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.lg),
    backgroundColor: `${brand.primary}10`
  },
  copyLinkText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: brand.primary
  },

  // Share Button
  shareButton: {
    marginBottom: toRN(tokens.spacing[6])
  },

  // How It Works
  howItWorksSection: {
    marginBottom: toRN(tokens.spacing[5])
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  stepsCard: {
    padding: toRN(tokens.spacing[4])
  },
  stepItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const
  },
  stepIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginRight: toRN(tokens.spacing[3])
  },
  stepContent: {
    flex: 1
  },
  stepTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: 2
  },
  stepDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.4
  },
  stepDivider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: toRN(tokens.spacing[3]),
    marginLeft: 60
  },
  pasteTipCard: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: toRN(tokens.spacing[2]),
    padding: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.lg),
    marginTop: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[3])
  },
  pasteTipText: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.4
  },
  programInfoCard: {
    padding: toRN(tokens.spacing[4]),
    marginTop: toRN(tokens.spacing[3])
  },
  programInfoTitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[2])
  },
  programInfoText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5,
    marginBottom: toRN(tokens.spacing[2])
  },

  // Referrals Section
  referralsSection: {
    marginBottom: toRN(tokens.spacing[4])
  },
  referralsSectionHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[2])
  },
  referralsCountBadge: {
    marginLeft: toRN(tokens.spacing[2]),
    backgroundColor: brand.primary,
    paddingHorizontal: toRN(tokens.spacing[2]),
    // paddingVertical: toRN(tokens.spacing[1]),
    borderRadius: toRN(tokens.borderRadius.full)
  },
  referralsCountBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: brand.onPrimary
  },

  // Empty State
  emptyReferralsCard: {
    padding: toRN(tokens.spacing[6]),
    alignItems: "center" as const
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.bg.surface,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    alignSelf: "center" as const,
    marginBottom: toRN(tokens.spacing[3])
  },
  emptyTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[1]),
    textAlign: "center" as const
  },
  emptyDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const
  },

  // Referrals List
  referralsListCard: {
    padding: toRN(tokens.spacing[3])
  },
  referralItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[2])
  },
  referralAvatarContainer: {
    marginRight: toRN(tokens.spacing[3])
  },
  referralInfo: {
    flex: 1
  },
  referralName: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.primary,
    marginBottom: 2
  },
  referralDate: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },
  referralDivider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginLeft: 56
  },

  // Badges
  earnedBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    paddingVertical: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[2]),
    backgroundColor: `${colors.feedback.success}15`,
    borderRadius: toRN(tokens.borderRadius.full)
  },
  earnedBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: colors.feedback.success
  },
  pendingBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    paddingVertical: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[2]),
    backgroundColor: colors.bg.surface,
    borderRadius: toRN(tokens.borderRadius.full)
  },
  pendingBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary
  }
});

export default ReferralScreen;
