import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { usePartnerAccess, usePartnersWithTodayGoals } from "@/hooks/api/usePartners";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { MOBILE_ROUTES } from "@/lib/routes";
import { toRN } from "@/lib/units";
import { Partner, PartnerTodayGoal } from "@/services/api/partners";
import { useStyles, useTheme } from "@/themes";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Flame, CheckCircle, Circle } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Text,
  TouchableOpacity,
  View
} from "react-native";

const CARD_WIDTH = 280;
const CARD_GAP = 12;

interface PartnersCardProps {
  isLoading?: boolean;
}

export const PartnersCard: React.FC<PartnersCardProps> = ({ isLoading }) => {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { data: partnersData, isLoading: loadingPartners } = usePartnersWithTodayGoals();

  const {
    hasFeature: hasPartnerFeature,
    canSendRequest,
    openSubscriptionModal
  } = usePartnerAccess();

  const [activePartnerIndex, setActivePartnerIndex] = useState(0);

  const partners = partnersData?.data || [];

  const handleFindPartners = () => {
    if (!canSendRequest) {
      openSubscriptionModal();
      return;
    }
    router.push(MOBILE_ROUTES.PROFILE.FIND_PARTNER);
  };

  const handlePartnerPress = (partner: Partner) => {
    router.push(MOBILE_ROUTES.PROFILE.PARTNER_DETAIL(partner.partner_user_id, partner.id));
  };

  const handleSendCheer = (partner: Partner) => {
    // Navigate to partner activity or send cheer modal
    router.push(MOBILE_ROUTES.PROFILE.PARTNER_DETAIL(partner.partner_user_id, partner.id));
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / (CARD_WIDTH + CARD_GAP));
    setActivePartnerIndex(index);
  };

  // Render partner card content (shared between full and compact)
  const renderPartnerCardContent = useCallback(
    (partner: Partner, index: number, isCompact: boolean) => {
      const partnerInfo = partner.partner;
      const streak = partner.overall_streak || 0;
      const todayGoals = partner.today_goals || [];
      const loggedToday = partner.logged_today || false;

      // Filter to show only scheduled goals (max 3 for compact, more for full)
      const maxGoals = isCompact ? 3 : 5;
      const scheduledGoals = todayGoals.filter((g) => g.is_scheduled_today).slice(0, maxGoals);
      const totalScheduled = todayGoals.filter((g) => g.is_scheduled_today).length;

      return (
        <>
          {/* Header: Avatar + Name + Streak */}
          <View style={styles.cardHeader}>
            <View style={styles.avatarContainer}>
              {partnerInfo?.profile_picture_url ? (
                <Image
                  source={{ uri: partnerInfo.profile_picture_url }}
                  style={isCompact ? styles.avatar : styles.avatarFull}
                />
              ) : (
                <View
                  style={[
                    isCompact ? styles.avatarPlaceholder : styles.avatarPlaceholderFull,
                    { backgroundColor: getAvatarColor(index) }
                  ]}
                >
                  <Text style={isCompact ? styles.avatarInitial : styles.avatarInitialFull}>
                    {partnerInfo?.name?.charAt(0)?.toUpperCase() || "?"}
                  </Text>
                </View>
              )}
              {/* Logged today indicator */}
              {loggedToday && (
                <View style={isCompact ? styles.loggedIndicator : styles.loggedIndicatorFull}>
                  <CheckCircle
                    size={isCompact ? 14 : 16}
                    color="#fff"
                    fill={colors.feedback.success}
                  />
                </View>
              )}
            </View>

            <View style={styles.nameContainer}>
              <Text
                style={isCompact ? styles.partnerName : styles.partnerNameFull}
                numberOfLines={1}
              >
                {partnerInfo?.name || t("social.partner")}
              </Text>
              {partnerInfo?.username && (
                <Text style={styles.partnerUsername} numberOfLines={1}>
                  @{partnerInfo.username}
                </Text>
              )}
              {streak > 0 && (
                <View style={styles.streakBadge}>
                  <Flame size={isCompact ? 12 : 14} color={brandColors.primary} />
                  <Text style={isCompact ? styles.streakText : styles.streakTextFull}>
                    {streak} {t("goals.day_streak")}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Today's Goals Section */}
          <View style={styles.goalsSection}>
            <Text style={styles.todayLabel}>{t("social.today")}:</Text>

            {scheduledGoals.length === 0 ? (
              <Text style={styles.noGoalsText}>{t("social.no_goals_scheduled")}</Text>
            ) : (
              <View style={styles.goalsList}>
                {scheduledGoals.map((goal: PartnerTodayGoal) => (
                  <View key={goal.id} style={styles.goalItem}>
                    {goal.logged_today ? (
                      <CheckCircle size={14} color={colors.feedback.success} />
                    ) : (
                      <Circle size={14} color={colors.text.tertiary} />
                    )}
                    <Text
                      style={[styles.goalTitle, goal.logged_today && styles.goalTitleCompleted]}
                      numberOfLines={1}
                    >
                      {goal.title}
                    </Text>
                  </View>
                ))}
                {totalScheduled > maxGoals && (
                  <Text style={styles.moreGoalsText}>
                    +{totalScheduled - maxGoals} {t("common.more")}
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Send Cheer Button */}
          <TouchableOpacity
            style={styles.cheerButton}
            onPress={() => handleSendCheer(partner)}
            activeOpacity={0.7}
          >
            <Text style={styles.cheerButtonText}>👏 {t("social.send_cheer")}</Text>
          </TouchableOpacity>
        </>
      );
    },
    [colors, brandColors, t, styles, handleSendCheer]
  );

  // Render compact partner card for horizontal scroll (multiple partners)
  const renderCompactPartnerCard = useCallback(
    ({ item: partner, index }: { item: Partner; index: number }) => {
      return (
        <TouchableOpacity
          onPress={() => handlePartnerPress(partner)}
          activeOpacity={0.7}
          key={partner.id}
        >
          <Card style={styles.partnerCard}>{renderPartnerCardContent(partner, index, true)}</Card>
        </TouchableOpacity>
      );
    },
    [styles, handlePartnerPress, renderPartnerCardContent]
  );

  // Show loading skeleton
  if (isLoading || loadingPartners) {
    return (
      <View style={styles.container}>
        <Card style={styles.skeletonCard}>
          <SkeletonBox width={200} height={24} />
          <SkeletonBox width={150} height={16} style={{ marginTop: 8 }} />
          <SkeletonBox width="100%" height={60} style={{ marginTop: 16 }} />
        </Card>
      </View>
    );
  }

  // Empty state - no partners
  if (partners.length === 0) {
    return (
      <View style={styles.container}>
        <Card shadow="md" style={styles.emptyCard}>
          <View style={styles.emptyContent}>
            {/* Illustration */}
            <View style={styles.emptyIllustration}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="people" size={32} color={brandColors.primary} />
              </View>
              <View style={styles.emptyIconBadge}>
                <Ionicons name="add" size={14} color="#fff" />
              </View>
            </View>

            {/* Text Content */}
            <View style={styles.emptyTextContent}>
              <Text style={styles.emptyTitle}>{t("social.no_partners_title")}</Text>
              <Text style={styles.emptyDescription}>{t("social.no_partners_description")}</Text>
            </View>

            {/* CTA Button */}
            <View style={styles.ctaContainer}>
              <Button
                variant="primary"
                size="sm"
                title={t("social.find_partner")}
                onPress={handleFindPartners}
                leftIcon="person-add-outline"
              />
              {!hasPartnerFeature && (
                <View style={styles.proBadge}>
                  <Text style={styles.proBadgeText}>{t("common.pro")}</Text>
                </View>
              )}
            </View>
          </View>
        </Card>
      </View>
    );
  }

  // Single partner - show full width card
  if (partners.length === 1) {
    const partner = partners[0];
    return (
      <View style={styles.container}>
        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t("social.accountability_partners")}</Text>
        </View>

        {/* Full width partner card */}
        <TouchableOpacity onPress={() => handlePartnerPress(partner)} activeOpacity={0.7}>
          <Card style={styles.partnerCardFull}>{renderPartnerCardContent(partner, 0, false)}</Card>
        </TouchableOpacity>
      </View>
    );
  }

  // Multiple partners - show horizontal scroll
  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t("social.accountability_partners")}</Text>
        <TouchableOpacity onPress={() => router.push(MOBILE_ROUTES.PROFILE.PARTNERS)}>
          <Text style={styles.seeAllText}>{t("common.see_all")}</Text>
        </TouchableOpacity>
      </View>

      {/* Horizontal scrolling partner cards */}
      <FlatList
        data={partners}
        renderItem={renderCompactPartnerCard}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + CARD_GAP}
        decelerationRate="fast"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
      />

      {/* Pagination dots */}
      <View style={styles.paginationDots}>
        {partners.map((_, index) => (
          <View
            key={index}
            style={[styles.dot, index === activePartnerIndex && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
};

// Helper function for avatar colors
const getAvatarColor = (index: number): string => {
  const colors = [
    "#6366F1", // Indigo
    "#8B5CF6", // Violet
    "#EC4899", // Pink
    "#F59E0B", // Amber
    "#10B981" // Emerald
  ];
  return colors[index % colors.length];
};

const makeStyles = (tokens: any, colors: any, brandColors: any) => ({
  container: {
    marginBottom: toRN(tokens.spacing[4])
  },

  // Section header
  sectionHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    // paddingHorizontal: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[3])
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary
  },
  seeAllText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary
  },

  // Scroll content
  scrollContent: {
    paddingRight: toRN(tokens.spacing[4])
  },

  // Partner card styles (compact - for horizontal scroll)
  partnerCard: {
    padding: toRN(tokens.spacing[4]),
    width: CARD_WIDTH,
    marginRight: CARD_GAP
  },
  // Partner card styles (full width - for single partner)
  partnerCardFull: {
    padding: toRN(tokens.spacing[4])
  },
  cardHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[3])
  },
  avatarContainer: {
    marginRight: toRN(tokens.spacing[3]),
    position: "relative" as const
  },
  // Compact avatar styles
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  loggedIndicator: {
    position: "absolute" as const,
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.feedback.success,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    borderWidth: 2,
    borderColor: colors.bg.card
  },
  avatarInitial: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: "#fff"
  },
  // Full-width avatar styles (larger)
  avatarFull: {
    width: 56,
    height: 56,
    borderRadius: 28
  },
  avatarPlaceholderFull: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  loggedIndicatorFull: {
    position: "absolute" as const,
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.feedback.success,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    borderWidth: 2,
    borderColor: colors.bg.card
  },
  avatarInitialFull: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: "#fff"
  },
  nameContainer: {
    flex: 1
  },
  // Compact name styles
  partnerName: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  // Full-width name styles
  partnerNameFull: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary
  },
  // Username style
  partnerUsername: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginBottom: toRN(tokens.spacing[0.5])
  },
  streakBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1])
  },
  // Compact streak text
  streakText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: brandColors.primary
  },
  // Full-width streak text
  streakTextFull: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: brandColors.primary
  },

  // Goals section
  goalsSection: {
    marginBottom: toRN(tokens.spacing[3]),
    paddingTop: toRN(tokens.spacing[3]),
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle
  },
  todayLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
    marginBottom: toRN(tokens.spacing[2])
  },
  noGoalsText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    fontStyle: "italic" as const
  },
  goalsList: {
    gap: toRN(tokens.spacing[2])
  },
  goalItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2])
  },
  goalTitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    flex: 1
  },
  goalTitleCompleted: {
    color: colors.feedback.success,
    textDecorationLine: "line-through" as const
  },
  moreGoalsText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },

  // Cheer button
  cheerButton: {
    backgroundColor: `${colors.text.primary}15`,
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.lg),
    alignItems: "center" as const
  },
  cheerButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.primary
  },

  // Pagination dots
  paginationDots: {
    flexDirection: "row" as const,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginTop: toRN(tokens.spacing[3]),
    gap: toRN(tokens.spacing[1.5])
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.bg.muted
  },
  dotActive: {
    backgroundColor: brandColors.primary,
    width: 18
  },

  // Empty state styles
  emptyCard: {
    marginBottom: 0
  },
  emptyContent: {
    padding: toRN(tokens.spacing[6]),
    alignItems: "center" as const
  },
  emptyIllustration: {
    position: "relative" as const,
    marginBottom: toRN(tokens.spacing[4])
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${brandColors.primary}15`,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  emptyIconBadge: {
    position: "absolute" as const,
    bottom: 0,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: brandColors.primary,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    borderWidth: 2,
    borderColor: colors.bg.card
  },
  emptyTextContent: {
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[5])
  },
  emptyTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[2]),
    textAlign: "center" as const
  },
  emptyDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5,
    maxWidth: 280
  },
  ctaContainer: {
    position: "relative" as const,
    alignItems: "center" as const
  },
  proBadge: {
    position: "absolute" as const,
    top: -6,
    right: -6,
    backgroundColor: brandColors.gradient?.start || "#8B5CF6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  proBadgeText: {
    fontSize: 9,
    fontFamily: fontFamily.bold,
    color: "#FFFFFF",
    textTransform: "uppercase" as const
  },

  // Skeleton styles
  skeletonCard: {
    padding: toRN(tokens.spacing[4])
  }
});

export default PartnersCard;
