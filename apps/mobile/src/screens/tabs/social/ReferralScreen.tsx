import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { BackButton } from "@/components/ui/BackButton";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { useReferralCode, useMyReferrals } from "@/hooks/api/useReferral";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { toRN } from "@/lib/units";
import { useStyles, useTheme } from "@/themes";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";

export const ReferralScreen: React.FC = () => {
  const router = useRouter();
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();

  const {
    data: referralData,
    isLoading: isLoadingCode,
    refetch: refetchCode,
  } = useReferralCode();

  const {
    data: referralsData,
    isLoading: isLoadingReferrals,
    refetch: refetchReferrals,
  } = useMyReferrals();

  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const referralCode = referralData?.data?.referral_code || "";
  const referralLink = referralData?.data?.referral_link || "";
  const referrals = referralsData?.data || [];
  const isLoading = isLoadingCode || isLoadingReferrals;

  const onRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetchCode(), refetchReferrals()]);
    setIsRefreshing(false);
  };

  const handleCopyCode = async () => {
    if (!referralCode) return;
    await Clipboard.setStringAsync(referralCode);
    showAlert({
      title: t("referral.copied_title") || "Copied!",
      message: t("referral.code_copied") || "Referral code copied to clipboard",
      variant: "success",
      confirmLabel: t("common.ok"),
    });
  };

  const handleCopyLink = async () => {
    if (!referralLink) return;
    await Clipboard.setStringAsync(referralLink);
    showAlert({
      title: t("referral.copied_title") || "Copied!",
      message: t("referral.link_copied") || "Referral link copied to clipboard",
      variant: "success",
      confirmLabel: t("common.ok"),
    });
  };

  const handleShare = async () => {
    if (!referralLink) return;

    const message =
      t("referral.share_message", { link: referralLink }) ||
      `Join me on FitNudge! Use my referral link to get started: ${referralLink}`;

    try {
      await Share.share({
        message,
        url: Platform.OS === "ios" ? referralLink : undefined,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading && !referralCode) {
    return (
      <View style={styles.container}>
        <BackButton
          title={t("referral.title") || "Invite Friends"}
          onPress={() => router.back()}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={brandColors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BackButton
        title={t("referral.title") || "Invite Friends"}
        onPress={() => router.back()}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={brandColors.primary}
          />
        }
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.iconCircle}>
            <Ionicons name="gift" size={40} color={brandColors.primary} />
          </View>
          <Text style={styles.heroTitle}>
            {t("referral.hero_title") || "Invite Friends, Earn Rewards"}
          </Text>
          <Text style={styles.heroSubtitle}>
            {t("referral.hero_subtitle") ||
              "Share your referral link and get 7 days free when a friend joins!"}
          </Text>
        </View>

        {/* Referral Code Card */}
        <Card style={styles.codeCard}>
          <Text style={styles.codeLabel}>
            {t("referral.your_code") || "Your Referral Code"}
          </Text>
          <View style={styles.codeContainer}>
            <Text style={styles.codeText}>{referralCode}</Text>
            <TouchableOpacity
              onPress={handleCopyCode}
              style={styles.copyButton}
            >
              <Ionicons
                name="copy-outline"
                size={20}
                color={brandColors.primary}
              />
            </TouchableOpacity>
          </View>
        </Card>

        {/* Share Section */}
        <View style={styles.shareSection}>
          <Button
            title={t("referral.share_link") || "Share Referral Link"}
            onPress={handleShare}
            style={styles.shareButton}
            leftIcon="share-outline"
          />
          <TouchableOpacity
            onPress={handleCopyLink}
            style={styles.copyLinkButton}
          >
            <Ionicons
              name="link-outline"
              size={18}
              color={brandColors.primary}
            />
            <Text style={styles.copyLinkText}>
              {t("referral.copy_link") || "Copy Link"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* How it Works */}
        <View style={styles.howItWorksSection}>
          <Text style={styles.sectionTitle}>
            {t("referral.how_it_works") || "How It Works"}
          </Text>

          <View style={styles.stepRow}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>
                {t("referral.step1_title") || "Share Your Link"}
              </Text>
              <Text style={styles.stepDescription}>
                {t("referral.step1_desc") ||
                  "Send your unique referral link to friends"}
              </Text>
            </View>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>
                {t("referral.step2_title") || "Friend Signs Up"}
              </Text>
              <Text style={styles.stepDescription}>
                {t("referral.step2_desc") ||
                  "When they create an account using your link"}
              </Text>
            </View>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>
                {t("referral.step3_title") || "Both Get Rewarded"}
              </Text>
              <Text style={styles.stepDescription}>
                {t("referral.step3_desc") ||
                  "You get 7 days free, they get 3 extra days!"}
              </Text>
            </View>
          </View>
        </View>

        {/* Referrals List */}
        {referrals.length > 0 && (
          <View style={styles.referralsSection}>
            <Text style={styles.sectionTitle}>
              {t("referral.your_referrals") || "Your Referrals"}
            </Text>
            <Text style={styles.referralsCount}>
              {t("referral.referrals_count", { count: referrals.length }) ||
                `${referrals.length} friend(s) joined`}
            </Text>

            {referrals.map((referral) => (
              <Card key={referral.id} style={styles.referralCard}>
                <View style={styles.referralRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(referral.name || referral.username || "U")
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.referralInfo}>
                    <Text style={styles.referralName}>
                      {referral.name || referral.username || "User"}
                    </Text>
                    <Text style={styles.referralDate}>
                      {t("referral.joined_on", {
                        date: formatDate(referral.created_at),
                      }) || `Joined ${formatDate(referral.created_at)}`}
                    </Text>
                  </View>
                  {referral.referral_bonus_granted_at && (
                    <View style={styles.bonusBadge}>
                      <Ionicons
                        name="checkmark-circle"
                        size={14}
                        color={colors.feedback.success}
                      />
                      <Text style={styles.bonusText}>
                        {t("referral.bonus_earned") || "+7 days"}
                      </Text>
                    </View>
                  )}
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: toRN(tokens.spacing[4]),
  },
  heroSection: {
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[6]),
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${brand.primary}15`,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[4]),
  },
  heroTitle: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[2]),
  },
  heroSubtitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    lineHeight: toRN(tokens.typography.fontSize.base) * 1.5,
  },
  codeCard: {
    marginBottom: toRN(tokens.spacing[4]),
    alignItems: "center" as const,
  },
  codeLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
    marginBottom: toRN(tokens.spacing[2]),
  },
  codeContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
  },
  codeText: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.bold,
    color: brand.primary,
    letterSpacing: 2,
  },
  copyButton: {
    padding: toRN(tokens.spacing[2]),
  },
  shareSection: {
    marginBottom: toRN(tokens.spacing[6]),
    alignItems: "center" as const,
  },
  shareButton: {
    width: "100%" as any,
    marginBottom: toRN(tokens.spacing[3]),
  },
  copyLinkButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
    padding: toRN(tokens.spacing[2]),
  },
  copyLinkText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: brand.primary,
  },
  howItWorksSection: {
    marginBottom: toRN(tokens.spacing[6]),
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[4]),
  },
  stepRow: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    marginBottom: toRN(tokens.spacing[4]),
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: brand.primary,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginRight: toRN(tokens.spacing[3]),
  },
  stepNumberText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.bold,
    color: "#FFFFFF",
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  stepDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.4,
  },
  referralsSection: {
    marginBottom: toRN(tokens.spacing[4]),
  },
  referralsCount: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginBottom: toRN(tokens.spacing[3]),
    marginTop: -toRN(tokens.spacing[2]),
  },
  referralCard: {
    marginBottom: toRN(tokens.spacing[2]),
  },
  referralRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  avatar: {
    width: toRN(40),
    height: toRN(40),
    borderRadius: toRN(20),
    backgroundColor: brand.primary,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginRight: toRN(tokens.spacing[3]),
  },
  avatarText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.bold,
    color: "#FFFFFF",
  },
  referralInfo: {
    flex: 1,
  },
  referralName: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.primary,
  },
  referralDate: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
  },
  bonusBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    paddingVertical: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[2]),
    backgroundColor: `${colors.feedback.success}15`,
    borderRadius: toRN(tokens.borderRadius.full),
  },
  bonusText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.feedback.success,
  },
});

export default ReferralScreen;
