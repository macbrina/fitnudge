import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import {
  usePartners,
  usePendingPartnerRequests,
} from "@/hooks/api/usePartners";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { MOBILE_ROUTES } from "@/lib/routes";
import { toRN } from "@/lib/units";
import { Partner } from "@/services/api/partners";
import SubscriptionScreen from "@/screens/onboarding/SubscriptionScreen";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { useStyles, useTheme } from "@/themes";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";

interface PartnersCardProps {
  isLoading?: boolean;
}

export const PartnersCard: React.FC<PartnersCardProps> = ({ isLoading }) => {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  const { data: partnersData, isLoading: loadingPartners } = usePartners();
  const { data: pendingData } = usePendingPartnerRequests();

  // Check if user has social accountability feature
  const { hasFeature, getFeatureValue } = useSubscriptionStore();
  const hasSocialAccountability = hasFeature("social_accountability");
  const partnerLimit = getFeatureValue("accountability_partner_limit");

  const partners = partnersData?.data || [];
  const pendingRequests = pendingData?.data || [];
  const pendingCount = pendingRequests.length;

  // Check if user has reached partner limit
  const hasReachedPartnerLimit =
    partnerLimit !== null && partners.length >= partnerLimit;

  const handlePress = () => {
    router.push(MOBILE_ROUTES.SOCIAL.FEED);
  };

  const handleFindPartners = () => {
    // Check if user has social accountability feature
    if (!hasSocialAccountability) {
      setShowSubscriptionModal(true);
      return;
    }
    // Check if user has reached partner limit
    if (hasReachedPartnerLimit) {
      setShowSubscriptionModal(true);
      return;
    }
    router.push(MOBILE_ROUTES.SOCIAL.FIND_PARTNER);
  };

  // Show loading skeleton
  if (isLoading || loadingPartners) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingHeader}>
            <SkeletonBox width={140} height={20} borderRadius={8} />
            <SkeletonBox width={80} height={32} borderRadius={16} />
          </View>
          <View style={styles.loadingAvatars}>
            {[1, 2, 3].map((i) => (
              <SkeletonBox
                key={i}
                width={48}
                height={48}
                borderRadius={24}
                style={{ marginLeft: i > 1 ? -12 : 0 }}
              />
            ))}
          </View>
        </View>
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
              <Text style={styles.emptyTitle}>
                {t("social.no_partners_title") || "No Partners Yet"}
              </Text>
              <Text style={styles.emptyDescription}>
                {t("social.no_partners_description") ||
                  "Find a friend to keep each other accountable on your fitness journey."}
              </Text>
            </View>

            {/* CTA Button */}
            <View style={styles.ctaContainer}>
              <Button
                variant="primary"
                size="sm"
                title={t("social.find_partner") || "Find a Partner"}
                onPress={handleFindPartners}
                leftIcon="person-add-outline"
              />
              {!hasSocialAccountability && (
                <View style={styles.proBadge}>
                  <Text style={styles.proBadgeText}>PRO</Text>
                </View>
              )}
            </View>
          </View>
        </Card>

        {/* Subscription Modal */}
        <SubscriptionScreen
          visible={showSubscriptionModal}
          onClose={() => setShowSubscriptionModal(false)}
        />
      </View>
    );
  }

  // Has partners state
  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
      <Card style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.iconContainer}>
              <Ionicons name="people" size={18} color={brandColors.primary} />
            </View>
            <View>
              <Text style={styles.title}>
                {t("social.accountability_partners") ||
                  "Accountability Partners"}
              </Text>
              <Text style={styles.subtitle}>
                {partners.length}{" "}
                {partners.length === 1 ? "partner" : "partners"}
                {pendingCount > 0 && (
                  <Text style={styles.pendingText}>
                    {" "}
                    • {pendingCount} pending
                  </Text>
                )}
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            {pendingCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{pendingCount}</Text>
              </View>
            )}
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.text.tertiary}
            />
          </View>
        </View>

        {/* Partner Avatars Row */}
        <View style={styles.partnersRow}>
          <View style={styles.avatarsContainer}>
            {partners.slice(0, 4).map((partner: Partner, index: number) => (
              <View
                key={partner.id}
                style={[
                  styles.avatarWrapper,
                  { marginLeft: index > 0 ? -14 : 0, zIndex: 10 - index },
                ]}
              >
                {partner.partner?.profile_picture_url ? (
                  <Image
                    source={{ uri: partner.partner.profile_picture_url }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <View
                    style={[
                      styles.avatarPlaceholder,
                      { backgroundColor: getAvatarColor(index) },
                    ]}
                  >
                    <Text style={styles.avatarInitial}>
                      {partner.partner?.name?.charAt(0)?.toUpperCase() || "?"}
                    </Text>
                  </View>
                )}
                {/* Online indicator (optional - for future) */}
                {/* <View style={styles.onlineIndicator} /> */}
              </View>
            ))}
            {partners.length > 4 && (
              <View
                style={[
                  styles.avatarWrapper,
                  styles.avatarMore,
                  { marginLeft: -14 },
                ]}
              >
                <Text style={styles.avatarMoreText}>
                  +{partners.length - 4}
                </Text>
              </View>
            )}
          </View>

          {/* Quick action */}
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleFindPartners}
            activeOpacity={0.7}
          >
            <Ionicons name="person-add" size={16} color={brandColors.primary} />
            {(!hasSocialAccountability || hasReachedPartnerLimit) && (
              <View style={styles.addButtonBadge}>
                <Text style={styles.addButtonBadgeText}>PRO</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </Card>

      {/* Subscription Modal */}
      <SubscriptionScreen
        visible={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
      />
    </TouchableOpacity>
  );
};

// Helper function for avatar colors
const getAvatarColor = (index: number): string => {
  const colors = [
    "#6366F1", // Indigo
    "#8B5CF6", // Violet
    "#EC4899", // Pink
    "#F59E0B", // Amber
    "#10B981", // Emerald
  ];
  return colors[index % colors.length];
};

const makeStyles = (tokens: any, colors: any, brandColors: any) => ({
  container: {
    marginBottom: toRN(tokens.spacing[6]),
  },
  card: {
    padding: toRN(tokens.spacing[4]),
  },
  loadingContainer: {
    gap: toRN(tokens.spacing[4]),
  },
  loadingHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
  loadingAvatars: {
    flexDirection: "row" as const,
  },

  // Empty state styles
  emptyCard: {
    marginBottom: 0,
  },
  gradientBackground: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradientSvg: {
    position: "absolute" as const,
  },
  emptyContent: {
    padding: toRN(tokens.spacing[6]),
    alignItems: "center" as const,
  },
  emptyIllustration: {
    position: "relative" as const,
    marginBottom: toRN(tokens.spacing[4]),
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${brandColors.primary}15`,
    justifyContent: "center" as const,
    alignItems: "center" as const,
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
    borderColor: colors.bg.card,
  },
  emptyTextContent: {
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[5]),
  },
  emptyTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[2]),
    textAlign: "center" as const,
  },
  emptyDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5,
    maxWidth: 280,
  },

  // Has partners state styles
  header: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
  headerLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
    flex: 1,
  },
  headerRight: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: `${brandColors.primary}12`,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    marginTop: toRN(tokens.spacing[0.5]),
  },
  pendingText: {
    color: brandColors.primary,
    fontFamily: fontFamily.medium,
  },
  notificationBadge: {
    backgroundColor: colors.feedback.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: 6,
  },
  notificationBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: fontFamily.bold,
  },

  // Partners row
  partnersRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginTop: toRN(tokens.spacing[4]),
    paddingTop: toRN(tokens.spacing[4]),
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  avatarsContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  avatarWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: colors.bg.card,
    overflow: "hidden" as const,
  },
  avatarImage: {
    width: "100%" as const,
    height: "100%" as const,
  },
  avatarPlaceholder: {
    width: "100%" as const,
    height: "100%" as const,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  avatarInitial: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: "#fff",
  },
  avatarMore: {
    backgroundColor: colors.bg.muted,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  avatarMoreText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.bold,
    color: colors.text.secondary,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${brandColors.primary}12`,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    borderWidth: 1,
    borderColor: `${brandColors.primary}25`,
    borderStyle: "dashed" as const,
    position: "relative" as const,
  },
  addButtonBadge: {
    position: "absolute" as const,
    top: -4,
    right: -4,
    backgroundColor: brandColors.gradient?.start || "#8B5CF6",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  addButtonBadgeText: {
    fontSize: 8,
    fontFamily: fontFamily.bold,
    color: "#FFFFFF",
    textTransform: "uppercase" as const,
  },
  ctaContainer: {
    position: "relative" as const,
    alignItems: "center" as const,
  },
  proBadge: {
    position: "absolute" as const,
    top: -6,
    right: -6,
    backgroundColor: brandColors.gradient?.start || "#8B5CF6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  proBadgeText: {
    fontSize: 9,
    fontFamily: fontFamily.bold,
    color: "#FFFFFF",
    textTransform: "uppercase" as const,
  },
});

export default PartnersCard;
