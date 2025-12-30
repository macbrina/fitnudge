import { BackButton } from "@/components/ui/BackButton";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { useSendNudge } from "@/hooks/api/useNudges";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { MOBILE_ROUTES } from "@/lib/routes";
import { toRN } from "@/lib/units";
import { useStyles, useTheme } from "@/themes";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// Hooks
import {
  useAcceptPartnerRequest,
  useCancelPartnerRequest,
  usePartnerAccess,
  usePartners,
  usePendingPartnerRequests,
  useRejectPartnerRequest,
  useSentPartnerRequests,
} from "@/hooks/api/usePartners";
import { Partner } from "@/services/api/partners";

type PartnerSubTab = "partners" | "received" | "sent";

export default function PartnersScreen() {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { showAlert, showConfirm, showToast } = useAlertModal();

  const [activeTab, setActiveTab] = useState<PartnerSubTab>("partners");
  const [refreshing, setRefreshing] = useState(false);

  // Data hooks
  const {
    data: partnersData,
    isLoading: loadingPartners,
    refetch: refetchPartners,
  } = usePartners();
  const { data: pendingData, refetch: refetchPending } =
    usePendingPartnerRequests();
  const { data: sentData, refetch: refetchSent } = useSentPartnerRequests();

  // Access check
  const { hasFeature: hasPartnerFeature, canSendRequest } = usePartnerAccess();

  // Mutations
  const cancelRequestMutation = useCancelPartnerRequest();
  const acceptRequestMutation = useAcceptPartnerRequest();
  const rejectRequestMutation = useRejectPartnerRequest();
  const nudgeMutation = useSendNudge();

  const partners = partnersData?.data || [];
  const pendingRequests = pendingData?.data || [];
  const sentRequests = sentData?.data || [];

  // Premium access check - user has access if:
  // 1. They have the feature, OR
  // 2. They have active partners or pending requests (someone with feature invited them)
  const { hasFeature } = useSubscriptionStore();
  const userHasFeature = hasFeature("social_accountability");
  const hasAccess =
    userHasFeature || partners.length > 0 || pendingRequests.length > 0;

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
          "By accepting, you and this person will become accountability partners. You'll be able to see each other's active goals and challenges, and send nudges to keep each other on track.",
        variant: "info",
        confirmLabel: t("common.accept") || "Accept",
        cancelLabel: t("common.cancel"),
        size: "lg",
        messageAlign: "left",
      });

      if (!confirmed) return;

      try {
        await acceptRequestMutation.mutateAsync({
          partnershipId: request.id,
          userId: request.partner_user_id,
        });
      } catch (error) {
        showAlert({
          title: t("common.error"),
          message: t("partners.accept_error") || "Failed to accept request",
          variant: "error",
          confirmLabel: t("common.ok"),
        });
      }
    },
    [acceptRequestMutation, showAlert, showConfirm, showToast, t],
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
        cancelLabel: t("common.cancel"),
      });

      if (!confirmed) return;

      try {
        await rejectRequestMutation.mutateAsync(request.id);
      } catch (error) {
        showAlert({
          title: t("common.error"),
          message: t("partners.reject_error") || "Failed to decline request",
          variant: "error",
          confirmLabel: t("common.ok"),
        });
      }
    },
    [rejectRequestMutation, showConfirm, showAlert, t],
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
        cancelLabel: t("common.keep") || "Keep",
      });

      if (!confirmed) return;

      try {
        await cancelRequestMutation.mutateAsync({
          partnershipId: request.id,
          userId: request.partner_user_id,
        });
      } catch (error) {
        showAlert({
          title: t("common.error"),
          message: t("partners.cancel_error") || "Failed to cancel request",
          variant: "error",
          confirmLabel: t("common.ok"),
        });
      }
    },
    [cancelRequestMutation, showConfirm, showAlert, t],
  );

  // Handle nudge
  const handleNudge = useCallback(
    async (partner: Partner) => {
      try {
        await nudgeMutation.mutateAsync({
          recipient_id: partner.partner_user_id,
          partnership_id: partner.id,
          nudge_type: "nudge",
        });
        showToast({
          title: t("partners.nudge_sent") || "Nudge Sent",
          message:
            t("partners.nudge_sent_message", {
              name: partner.partner?.name,
            }) || `You nudged ${partner.partner?.name}!`,
          variant: "success",
        });
      } catch (error) {
        showAlert({
          title: t("common.error"),
          message: t("partners.nudge_error") || "Failed to send nudge",
          variant: "error",
          confirmLabel: t("common.ok"),
        });
      }
    },
    [nudgeMutation, showToast, showAlert, t],
  );

  // Navigate to partner detail
  const handlePartnerPress = useCallback(
    (partner: Partner) => {
      router.push(
        MOBILE_ROUTES.PROFILE.PARTNER_DETAIL(
          partner.partner_user_id,
          partner.id,
        ),
      );
    },
    [router],
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
        confirmLabel: t("common.ok"),
      });
      return;
    }
    router.push(MOBILE_ROUTES.PROFILE.FIND_PARTNER);
  }, [hasPartnerFeature, router, showAlert, t]);

  // Render partner card
  const renderPartnerCard = ({ item }: { item: Partner }) => (
    <TouchableOpacity
      onPress={() => handlePartnerPress(item)}
      activeOpacity={0.7}
    >
      <Card style={styles.partnerCard}>
        <View style={styles.partnerRow}>
          {/* Avatar */}
          {item.partner?.profile_picture_url ? (
            <Image
              source={{ uri: item.partner.profile_picture_url }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>
                {item.partner?.name?.charAt(0)?.toUpperCase() || "?"}
              </Text>
            </View>
          )}

          {/* Info */}
          <View style={styles.partnerInfo}>
            {item.partner?.username && (
              <Text style={styles.partnerUsername} numberOfLines={1}>
                @{item.partner.username}
              </Text>
            )}
            <Text style={styles.partnerName} numberOfLines={1}>
              {item.partner?.name || t("common.user")}
            </Text>
          </View>

          {/* Nudge Button */}
          <TouchableOpacity
            style={styles.nudgeButton}
            onPress={() => handleNudge(item)}
            disabled={nudgeMutation.isPending}
          >
            {nudgeMutation.isPending ? (
              <ActivityIndicator size="small" color={brandColors.primary} />
            ) : (
              <>
                <Ionicons
                  name="hand-right"
                  size={14}
                  color={brandColors.primary}
                />
                <Text style={styles.nudgeButtonText}>
                  {t("partners.nudge") || "Nudge"}
                </Text>
              </>
            )}
          </TouchableOpacity>

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
          <Image
            source={{ uri: item.partner.profile_picture_url }}
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>
              {item.partner?.name?.charAt(0)?.toUpperCase() || "?"}
            </Text>
          </View>
        )}

        {/* Info */}
        <View style={styles.requestInfo}>
          {item.partner?.username && (
            <Text style={styles.partnerUsername} numberOfLines={1}>
              @{item.partner.username}
            </Text>
          )}
          <Text style={styles.partnerName} numberOfLines={1}>
            {item.partner?.name || t("common.user")}
          </Text>
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
              <Text style={styles.acceptButtonText}>
                {t("common.accept") || "Accept"}
              </Text>
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
          <Image
            source={{ uri: item.partner.profile_picture_url }}
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>
              {item.partner?.name?.charAt(0)?.toUpperCase() || "?"}
            </Text>
          </View>
        )}

        {/* Info */}
        <View style={styles.requestInfo}>
          {item.partner?.username && (
            <Text style={styles.partnerUsername} numberOfLines={1}>
              @{item.partner.username}
            </Text>
          )}
          <Text style={styles.partnerName} numberOfLines={1}>
            {item.partner?.name || t("common.user")}
          </Text>
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
            <Text style={styles.cancelButtonText}>
              {t("common.cancel") || "Cancel"}
            </Text>
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
          "Find accountability partners to stay motivated together.",
      },
      received: {
        icon: "mail-open-outline" as keyof typeof Ionicons.glyphMap,
        title: t("partners.no_requests_title") || "No requests",
        description:
          t("partners.no_requests_description") ||
          "When someone sends you a partner request, it will appear here.",
      },
      sent: {
        icon: "paper-plane-outline" as keyof typeof Ionicons.glyphMap,
        title: t("partners.no_sent_title") || "No pending requests",
        description:
          t("partners.no_sent_description") ||
          "Requests you send will appear here until they're accepted.",
      },
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
        onPress={() => router.push(MOBILE_ROUTES.ONBOARDING.SUBSCRIPTION)}
        style={styles.upgradeButton}
      />
    </View>
  );

  // Tab data
  const tabs = [
    {
      id: "partners",
      label: t("partners.tab_partners") || "Partners",
      count: partners.length,
    },
    {
      id: "received",
      label: t("partners.tab_received") || "Received",
      count: pendingRequests.length,
    },
    {
      id: "sent",
      label: t("partners.tab_sent") || "Sent",
      count: sentRequests.length,
    },
  ];

  // Current data based on tab
  const currentData =
    activeTab === "partners"
      ? partners
      : activeTab === "received"
        ? pendingRequests
        : sentRequests;

  const isLoading = loadingPartners;

  return (
    <View style={styles.container}>
      {/* Header */}
      <BackButton
        title={t("partners.title") || "My Partners"}
        onPress={() => router.back()}
        rightInput={
          hasAccess ? (
            <TouchableOpacity
              style={styles.headerAction}
              onPress={handleFindPartner}
            >
              <Ionicons
                name="person-add"
                size={22}
                color={brandColors.primary}
              />
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
          <View style={styles.tabBar}>
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tab, activeTab === tab.id && styles.tabActive]}
                onPress={() => setActiveTab(tab.id as PartnerSubTab)}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === tab.id && styles.tabTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
                {tab.count > 0 && (
                  <View
                    style={[
                      styles.tabBadge,
                      activeTab === tab.id && styles.tabBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabBadgeText,
                        activeTab === tab.id && styles.tabBadgeTextActive,
                      ]}
                    >
                      {tab.count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Content */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={brandColors.primary} />
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
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingRight: toRN(tokens.spacing[4]),
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${brand.primary}15`,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  // Tab Bar
  tabBar: {
    flexDirection: "row" as const,
    backgroundColor: colors.bg.card,
    paddingHorizontal: toRN(tokens.spacing[4]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  tab: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    marginRight: toRN(tokens.spacing[2]),
    gap: toRN(tokens.spacing[1.5]),
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: brand.primary,
  },
  tabText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
  },
  tabTextActive: {
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
  tabBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.bg.muted,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[1.5]),
  },
  tabBadgeActive: {
    backgroundColor: brand.primary,
  },
  tabBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: colors.text.secondary,
  },
  tabBadgeTextActive: {
    color: "#FFFFFF",
  },
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  // List
  listContent: {
    padding: toRN(tokens.spacing[4]),
    flexGrow: 1,
  },
  // Partner Card
  partnerCard: {
    marginBottom: toRN(tokens.spacing[3]),
    padding: toRN(tokens.spacing[4]),
  },
  partnerRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: toRN(tokens.spacing[3]),
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: brand.primary,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginRight: toRN(tokens.spacing[3]),
  },
  avatarInitial: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: "#FFFFFF",
  },
  partnerInfo: {
    flex: 1,
    marginRight: toRN(tokens.spacing[2]),
  },
  partnerUsername: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
  },
  partnerName: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
  nudgeButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[1.5]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    backgroundColor: `${brand.primary}15`,
    borderRadius: toRN(tokens.borderRadius.full),
    gap: toRN(tokens.spacing[1]),
    marginRight: toRN(tokens.spacing[2]),
  },
  nudgeButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: brand.primary,
  },
  chevron: {
    marginLeft: toRN(tokens.spacing[1]),
  },
  // Request Card
  requestCard: {
    marginBottom: toRN(tokens.spacing[3]),
    padding: toRN(tokens.spacing[4]),
  },
  requestRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  requestInfo: {
    flex: 1,
  },
  requestMessage: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[1]),
  },
  requestActions: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "flex-end" as const,
    marginTop: toRN(tokens.spacing[3]),
    gap: toRN(tokens.spacing[2]),
  },
  declineButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg.muted,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  acceptButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    backgroundColor: brand.primary,
    borderRadius: toRN(tokens.borderRadius.full),
    gap: toRN(tokens.spacing[1]),
  },
  acceptButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: "#FFFFFF",
  },
  cancelButton: {
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.full),
  },
  cancelButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
  },
  pendingBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginTop: toRN(tokens.spacing[1]),
    gap: toRN(tokens.spacing[1]),
  },
  pendingBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
  },
  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[8]),
  },
  emptyTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginTop: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[2]),
  },
  emptyDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    textAlign: "center" as const,
    maxWidth: 280,
    marginBottom: toRN(tokens.spacing[4]),
  },
  findPartnerButton: {
    marginTop: toRN(tokens.spacing[2]),
  },
  // Premium Gate
  premiumGate: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[8]),
  },
  premiumIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: `${brand.primary}15`,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[4]),
  },
  premiumTitle: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[2]),
    textAlign: "center" as const,
  },
  premiumDescription: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    lineHeight: toRN(tokens.typography.fontSize.base) * 1.5,
    marginBottom: toRN(tokens.spacing[6]),
  },
  upgradeButton: {
    minWidth: 200,
  },
});
