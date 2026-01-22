import { BackButton } from "@/components/ui/BackButton";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { NudgeSheet } from "@/components/social/NudgeSheet";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { ApiError } from "@/services/api/base";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { MOBILE_ROUTES } from "@/lib/routes";
import { toRN } from "@/lib/units";
import { useStyles, useTheme } from "@/themes";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState, useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

// Hooks
import {
  useAcceptPartnerRequest,
  useCancelPartnerRequest,
  usePartnerAccess,
  usePartners,
  usePendingPartnerRequests,
  useRejectPartnerRequest,
  useSentPartnerRequests
} from "@/hooks/api/usePartners";
import { Partner } from "@/services/api/partners";

type PartnerSubTab = "partners" | "received" | "sent";

export default function PartnersScreen() {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { showAlert, showConfirm, showToast } = useAlertModal();
  const { tab } = useLocalSearchParams<{ tab?: string }>();

  // Determine initial tab from URL param (e.g., ?tab=received)
  const getInitialTab = (): PartnerSubTab => {
    if (tab === "received" || tab === "sent") {
      return tab;
    }
    return "partners";
  };

  const [activeTab, setActiveTab] = useState<PartnerSubTab>(getInitialTab);

  // Update tab when URL param changes (e.g., navigating from different notifications)
  useEffect(() => {
    if (tab === "received" || tab === "sent") {
      setActiveTab(tab);
    }
  }, [tab]);

  const [refreshing, setRefreshing] = useState(false);
  const [nudgeTarget, setNudgeTarget] = useState<Partner | null>(null);

  // Data hooks
  const {
    data: partnersData,
    isLoading: loadingPartners,
    refetch: refetchPartners
  } = usePartners();
  const { data: pendingData, refetch: refetchPending } = usePendingPartnerRequests();
  const { data: sentData, refetch: refetchSent } = useSentPartnerRequests();

  // Access check - use unified hook for consistency
  const {
    hasFeature: hasPartnerFeature,
    canSendRequest,
    openSubscriptionModal
  } = usePartnerAccess();

  // Mutations
  const cancelRequestMutation = useCancelPartnerRequest();
  const acceptRequestMutation = useAcceptPartnerRequest();
  const rejectRequestMutation = useRejectPartnerRequest();

  const partners = partnersData?.data || [];
  const pendingRequests = pendingData?.data || [];
  const sentRequests = sentData?.data || [];

  // Premium access check - user has access if:
  // 1. They have the feature, OR
  // 2. They have active partners or pending requests (someone with feature invited them)
  const hasAccess = hasPartnerFeature || partners.length > 0 || pendingRequests.length > 0;

  // Refresh all data
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchPartners(), refetchPending(), refetchSent()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchPartners, refetchPending, refetchSent]);

  // Handle accept request
  const handleAcceptRequest = useCallback(
    async (request: Partner) => {
      // Show confirmation modal
      const confirmed = await showConfirm({
        title: t("partners.accept_request_title") || "Accept Partner Request",
        message:
          t("partners.accept_request_message") ||
          "By accepting, you and this person will become accountability partners. You'll be able to see each other's active goals, and send nudges to keep each other on track.",
        variant: "info",
        confirmLabel: t("common.accept") || "Accept",
        cancelLabel: t("common.cancel"),
        size: "lg",
        messageAlign: "left"
      });

      if (!confirmed) return;

      try {
        await acceptRequestMutation.mutateAsync({
          partnershipId: request.id,
          userId: request.partner_user_id
        });
      } catch (error: unknown) {
        const errorMessage =
          error instanceof ApiError
            ? error.message
            : t("partners.accept_error") || "Failed to accept request";
        showAlert({
          title: t("common.error"),
          message: errorMessage,
          variant: "error",
          confirmLabel: t("common.ok")
        });
      }
    },
    [acceptRequestMutation, showAlert, showConfirm, showToast, t]
  );

  // Handle reject request
  const handleRejectRequest = useCallback(
    async (request: Partner) => {
      const confirmed = await showConfirm({
        title: t("partners.decline_request_title") || "Decline Request",
        message:
          t("partners.decline_request_message") ||
          "Are you sure you want to decline this partner request?",
        variant: "warning",
        confirmLabel: t("common.decline") || "Decline",
        cancelLabel: t("common.cancel")
      });

      if (!confirmed) return;

      try {
        await rejectRequestMutation.mutateAsync(request.id);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof ApiError
            ? error.message
            : t("partners.reject_error") || "Failed to decline request";
        showAlert({
          title: t("common.error"),
          message: errorMessage,
          variant: "error",
          confirmLabel: t("common.ok")
        });
      }
    },
    [rejectRequestMutation, showConfirm, showAlert, t]
  );

  // Handle cancel sent request
  const handleCancelRequest = useCallback(
    async (request: Partner) => {
      const confirmed = await showConfirm({
        title: t("partners.cancel_request_title") || "Cancel Request",
        message:
          t("partners.cancel_request_message") ||
          "Are you sure you want to cancel this partner request?",
        variant: "warning",
        confirmLabel: t("common.cancel_request") || "Cancel Request",
        cancelLabel: t("common.keep") || "Keep"
      });

      if (!confirmed) return;

      try {
        await cancelRequestMutation.mutateAsync({
          partnershipId: request.id,
          userId: request.partner_user_id
        });
      } catch (error: unknown) {
        const errorMessage =
          error instanceof ApiError
            ? error.message
            : t("partners.cancel_error") || "Failed to cancel request";
        showAlert({
          title: t("common.error"),
          message: errorMessage,
          variant: "error",
          confirmLabel: t("common.ok")
        });
      }
    },
    [cancelRequestMutation, showConfirm, showAlert, t]
  );

  // Handle nudge - opens NudgeSheet
  const handleNudge = useCallback((partner: Partner) => {
    setNudgeTarget(partner);
  }, []);

  const handleNudgeSuccess = useCallback(() => {
    if (!nudgeTarget) return;

    setNudgeTarget(null);
  }, [nudgeTarget, showToast, t]);

  // Navigate to partner detail
  const handlePartnerPress = useCallback(
    (partner: Partner) => {
      router.push(MOBILE_ROUTES.PROFILE.PARTNER_DETAIL(partner.partner_user_id, partner.id));
    },
    [router]
  );

  // Navigate to find partner
  const handleFindPartner = useCallback(() => {
    if (!hasPartnerFeature) {
      showAlert({
        title: t("common.premium_feature") || "Premium Feature",
        message:
          t("partners.feature_required") ||
          "Accountability partners require a subscription. Upgrade to connect with others!",
        variant: "warning",
        confirmLabel: t("common.ok")
      });
      return;
    }
    // Check if user has reached their partner limit
    if (!canSendRequest) {
      openSubscriptionModal();
      return;
    }
    router.push(MOBILE_ROUTES.PROFILE.FIND_PARTNER);
  }, [hasPartnerFeature, canSendRequest, router, showAlert, openSubscriptionModal, t]);

  // Render partner card
  const renderPartnerCard = ({ item }: { item: Partner }) => (
    <TouchableOpacity onPress={() => handlePartnerPress(item)} activeOpacity={0.7}>
      <Card style={styles.partnerCard}>
        <View style={styles.partnerRow}>
          {/* Avatar */}
          {item.partner?.profile_picture_url ? (
            <Image source={{ uri: item.partner.profile_picture_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>
                {item.partner?.name?.charAt(0)?.toUpperCase() || "?"}
              </Text>
            </View>
          )}

          {/* Info */}
          <View style={styles.partnerInfo}>
            {item.partner?.name && (
              <Text style={styles.partnerName} numberOfLines={1}>
                {item.partner?.name || t("common.user")}
              </Text>
            )}
            {item.partner?.username && (
              <Text style={styles.partnerUsername} numberOfLines={1}>
                @{item.partner.username}
              </Text>
            )}
          </View>

          {/* Nudge Button - only show if partner has active goals */}
          {item.has_active_items && (
            <TouchableOpacity style={styles.nudgeButton} onPress={() => handleNudge(item)}>
              <Ionicons name="hand-right" size={14} color={brandColors.primary} />
              <Text style={styles.nudgeButtonText}>{t("partners.nudge") || "Nudge"}</Text>
            </TouchableOpacity>
          )}

          {/* Chevron */}
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.text.tertiary}
            style={styles.chevron}
          />
        </View>
      </Card>
    </TouchableOpacity>
  );

  // Render received request card
  const renderReceivedCard = ({ item }: { item: Partner }) => (
    <Card style={styles.requestCard}>
      <View style={styles.requestRow}>
        {/* Avatar */}
        {item.partner?.profile_picture_url ? (
          <Image source={{ uri: item.partner.profile_picture_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>
              {item.partner?.name?.charAt(0)?.toUpperCase() || "?"}
            </Text>
          </View>
        )}

        {/* Info */}
        <View style={styles.requestInfo}>
          {item.partner?.name && (
            <Text style={styles.partnerName} numberOfLines={1}>
              {item.partner?.name || t("common.user")}
            </Text>
          )}
          {item.partner?.username && (
            <Text style={styles.partnerUsername} numberOfLines={1}>
              @{item.partner.username}
            </Text>
          )}
          <Text style={styles.requestMessage}>
            {t("partners.wants_to_connect") || "wants to be your partner"}
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.requestActions}>
        <TouchableOpacity
          style={styles.declineButton}
          onPress={() => handleRejectRequest(item)}
          disabled={rejectRequestMutation.isPending}
        >
          {rejectRequestMutation.isPending ? (
            <ActivityIndicator size="small" color={colors.text.tertiary} />
          ) : (
            <Ionicons name="close" size={20} color={colors.text.tertiary} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => handleAcceptRequest(item)}
          disabled={acceptRequestMutation.isPending}
        >
          {acceptRequestMutation.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              <Text style={styles.acceptButtonText}>{t("common.accept") || "Accept"}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </Card>
  );

  // Render sent request card
  const renderSentCard = ({ item }: { item: Partner }) => (
    <Card style={styles.requestCard}>
      <View style={styles.requestRow}>
        {/* Avatar */}
        {item.partner?.profile_picture_url ? (
          <Image source={{ uri: item.partner.profile_picture_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>
              {item.partner?.name?.charAt(0)?.toUpperCase() || "?"}
            </Text>
          </View>
        )}

        {/* Info */}
        <View style={styles.requestInfo}>
          {item.partner?.name && (
            <Text style={styles.partnerName} numberOfLines={1}>
              {item.partner?.name || t("common.user")}
            </Text>
          )}
          {item.partner?.username && (
            <Text style={styles.partnerUsername} numberOfLines={1}>
              @{item.partner.username}
            </Text>
          )}
        </View>

        {/* Cancel Button */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => handleCancelRequest(item)}
          disabled={cancelRequestMutation.isPending}
        >
          {cancelRequestMutation.isPending ? (
            <ActivityIndicator size="small" color={colors.text.tertiary} />
          ) : (
            <Text style={styles.cancelButtonText}>{t("common.cancel") || "Cancel"}</Text>
          )}
        </TouchableOpacity>
      </View>
    </Card>
  );

  // Render empty state
  const renderEmptyState = () => {
    const emptyConfig = {
      partners: {
        icon: "people-outline" as keyof typeof Ionicons.glyphMap,
        title: t("partners.no_partners_title") || "No partners yet",
        description:
          t("partners.no_partners_description") ||
          "Find accountability partners to stay motivated together."
      },
      received: {
        icon: "mail-open-outline" as keyof typeof Ionicons.glyphMap,
        title: t("partners.no_requests_title") || "No requests",
        description:
          t("partners.no_requests_description") ||
          "When someone sends you a partner request, it will appear here."
      },
      sent: {
        icon: "paper-plane-outline" as keyof typeof Ionicons.glyphMap,
        title: t("partners.no_sent_title") || "No pending requests",
        description:
          t("partners.no_sent_description") ||
          "Requests you send will appear here until they're accepted."
      }
    };

    const config = emptyConfig[activeTab];

    return (
      <View style={styles.emptyState}>
        <Ionicons name={config.icon} size={64} color={colors.text.tertiary} />
        <Text style={styles.emptyTitle}>{config.title}</Text>
        <Text style={styles.emptyDescription}>{config.description}</Text>
        {activeTab === "partners" && (
          <Button
            title={t("partners.find_partner") || "Find Partners"}
            onPress={handleFindPartner}
            style={styles.findPartnerButton}
          />
        )}
      </View>
    );
  };

  // Render premium gate for users without access
  const renderPremiumGate = () => (
    <View style={styles.premiumGate}>
      <View style={styles.premiumIconContainer}>
        <Ionicons name="people" size={48} color={brandColors.primary} />
      </View>
      <Text style={styles.premiumTitle}>
        {t("partners.premium_title") || "Accountability Partners"}
      </Text>
      <Text style={styles.premiumDescription}>
        {t("partners.premium_description") ||
          "Connect with accountability partners to stay motivated together. Send nudges, track each other's progress, and achieve your goals as a team."}
      </Text>
      <Button
        title={t("common.upgrade") || "Upgrade to Unlock"}
        onPress={openSubscriptionModal}
        style={styles.upgradeButton}
      />
    </View>
  );

  // Tab options for SegmentedControl
  const tabOptions = [
    `${t("partners.tab_partners") || "Partners"}${partners.length > 0 ? ` (${partners.length})` : ""}`,
    `${t("partners.tab_received") || "Received"}${pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ""}`,
    `${t("partners.tab_sent") || "Sent"}${sentRequests.length > 0 ? ` (${sentRequests.length})` : ""}`
  ];

  const tabKeys: PartnerSubTab[] = ["partners", "received", "sent"];
  const selectedTabIndex = tabKeys.indexOf(activeTab);

  const handleTabChange = (index: number) => {
    setActiveTab(tabKeys[index]);
  };

  // Current data based on tab
  const currentData =
    activeTab === "partners" ? partners : activeTab === "received" ? pendingRequests : sentRequests;

  const isLoading = loadingPartners;

  return (
    <View style={styles.container}>
      {/* Header */}
      <BackButton
        title={t("partners.title") || "My Partners"}
        onPress={() => router.back()}
        rightInput={
          hasAccess ? (
            <TouchableOpacity style={styles.headerAction} onPress={handleFindPartner}>
              <Ionicons name="person-add" size={22} color={brandColors.primary} />
            </TouchableOpacity>
          ) : null
        }
      />

      {/* Premium gate for users without access */}
      {!hasAccess ? (
        renderPremiumGate()
      ) : (
        <>
          {/* Sub-tabs */}
          <View style={styles.tabBarContainer}>
            <SegmentedControl
              options={tabOptions}
              selectedIndex={selectedTabIndex}
              onChange={handleTabChange}
            />
          </View>

          {/* Content */}
          {isLoading ? (
            <View style={styles.listContent}>
              {[1, 2, 3].map((i) => (
                <Card key={i} style={styles.cardSkeleton}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <SkeletonBox width={48} height={48} borderRadius={24} />
                    <View style={{ flex: 1, gap: 8 }}>
                      <SkeletonBox width="60%" height={16} borderRadius={4} />
                      <SkeletonBox width="40%" height={12} borderRadius={4} />
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          ) : (
            <FlatList
              data={currentData}
              renderItem={
                activeTab === "partners"
                  ? renderPartnerCard
                  : activeTab === "received"
                    ? renderReceivedCard
                    : renderSentCard
              }
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={brandColors.primary}
                />
              }
              ListEmptyComponent={renderEmptyState}
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      )}

      {/* Nudge Sheet */}
      <NudgeSheet
        visible={!!nudgeTarget}
        onClose={() => setNudgeTarget(null)}
        recipientId={nudgeTarget?.partner_user_id || ""}
        recipientName={
          nudgeTarget?.partner?.name || nudgeTarget?.partner?.username || t("partners.partner")
        }
        partnershipId={nudgeTarget?.id}
        onSuccess={handleNudgeSuccess}
      />
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingRight: toRN(tokens.spacing[4])
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${brand.primary}15`,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  // Tab Bar Container
  tabBarContainer: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.canvas
  },
  // Skeleton Card
  cardSkeleton: {
    marginBottom: toRN(tokens.spacing[3]),
    padding: toRN(tokens.spacing[4])
  },
  // List
  listContent: {
    padding: toRN(tokens.spacing[4]),
    flexGrow: 1
  },
  // Partner Card
  partnerCard: {
    marginBottom: toRN(tokens.spacing[3]),
    padding: toRN(tokens.spacing[4])
  },
  partnerRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: toRN(tokens.spacing[3])
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: brand.primary,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginRight: toRN(tokens.spacing[3])
  },
  avatarInitial: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: "#FFFFFF"
  },
  partnerInfo: {
    flex: 1,
    marginRight: toRN(tokens.spacing[2])
  },
  partnerUsername: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },
  partnerName: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary
  },
  nudgeButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[1.5]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    backgroundColor: `${brand.primary}15`,
    borderRadius: toRN(tokens.borderRadius.full),
    gap: toRN(tokens.spacing[1]),
    marginRight: toRN(tokens.spacing[2])
  },
  nudgeButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: brand.primary
  },
  chevron: {
    marginLeft: toRN(tokens.spacing[1])
  },
  // Request Card
  requestCard: {
    marginBottom: toRN(tokens.spacing[3]),
    padding: toRN(tokens.spacing[4])
  },
  requestRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const
  },
  requestInfo: {
    flex: 1
  },
  requestMessage: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[1])
  },
  requestActions: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "flex-end" as const,
    marginTop: toRN(tokens.spacing[3]),
    gap: toRN(tokens.spacing[2])
  },
  declineButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg.muted,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  acceptButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    backgroundColor: brand.primary,
    borderRadius: toRN(tokens.borderRadius.full),
    gap: toRN(tokens.spacing[1])
  },
  acceptButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: "#FFFFFF"
  },
  cancelButton: {
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.full)
  },
  cancelButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary
  },
  pendingBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginTop: toRN(tokens.spacing[1]),
    gap: toRN(tokens.spacing[1])
  },
  pendingBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary
  },
  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[8])
  },
  emptyTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginTop: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[2])
  },
  emptyDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    textAlign: "center" as const,
    maxWidth: 280,
    marginBottom: toRN(tokens.spacing[4])
  },
  findPartnerButton: {
    marginTop: toRN(tokens.spacing[2])
  },
  // Premium Gate
  premiumGate: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[8])
  },
  premiumIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: `${brand.primary}15`,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[4])
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
