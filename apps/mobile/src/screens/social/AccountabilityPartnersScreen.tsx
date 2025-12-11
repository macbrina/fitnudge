import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAlertModal } from "@/contexts/AlertModalContext";
import {
  useAcceptPartnerRequest,
  usePartners,
  usePendingPartnerRequests,
  useRejectPartnerRequest,
  useRemovePartner,
} from "@/hooks/api/usePartners";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { toRN } from "@/lib/units";
import { Partner } from "@/services/api/partners";
import { useStyles, useTheme } from "@/themes";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export const AccountabilityPartnersScreen: React.FC = () => {
  const router = useRouter();
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const { showConfirm, showAlert } = useAlertModal();

  // Use React Query hooks
  const {
    data: partnersData,
    isLoading: isLoadingPartners,
    refetch: refetchPartners,
  } = usePartners();

  const {
    data: pendingData,
    isLoading: isLoadingPending,
    refetch: refetchPending,
  } = usePendingPartnerRequests();

  const acceptMutation = useAcceptPartnerRequest();
  const rejectMutation = useRejectPartnerRequest();
  const removeMutation = useRemovePartner();

  const partners = partnersData?.data || [];
  const pendingRequests = pendingData?.data || [];
  const isLoading = isLoadingPartners || isLoadingPending;

  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    await Promise.all([refetchPartners(), refetchPending()]);
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await handleRefresh();
    setIsRefreshing(false);
  };

  const handleAcceptRequest = async (partnerId: string) => {
    try {
      await acceptMutation.mutateAsync(partnerId);
      showAlert({
        title: t("social.partner_accepted_title"),
        message: t("social.partner_accepted_message"),
        variant: "success",
        confirmLabel: t("common.ok"),
      });
    } catch (error) {
      showAlert({
        title: t("common.error"),
        message: t("social.accept_partner_error"),
        variant: "error",
        confirmLabel: t("common.ok"),
      });
    }
  };

  const handleRejectRequest = async (partnerId: string) => {
    const confirmed = await showConfirm({
      title: t("social.reject_partner_title"),
      message: t("social.reject_partner_message"),
      variant: "warning",
      confirmLabel: t("common.reject"),
      cancelLabel: t("common.cancel"),
    });

    if (confirmed) {
      try {
        await rejectMutation.mutateAsync(partnerId);
      } catch (error) {
        showAlert({
          title: t("common.error"),
          message: t("social.reject_partner_error"),
          variant: "error",
          confirmLabel: t("common.ok"),
        });
      }
    }
  };

  const handleRemovePartner = async (
    partnerId: string,
    partnerName: string
  ) => {
    const confirmed = await showConfirm({
      title: t("social.remove_partner_title"),
      message: t("social.remove_partner_message", { name: partnerName }),
      variant: "error",
      confirmLabel: t("common.remove"),
      cancelLabel: t("common.cancel"),
    });

    if (confirmed) {
      try {
        await removeMutation.mutateAsync(partnerId);
      } catch (error) {
        showAlert({
          title: t("common.error"),
          message: t("social.remove_partner_error"),
          variant: "error",
          confirmLabel: t("common.ok"),
        });
      }
    }
  };

  const handleFindPartner = () => {
    router.push("/(user)/social/find-partner");
  };

  const renderPartnerCard = (partner: Partner) => {
    const partnerInfo = partner.partner;
    const isIncoming =
      partner.status === "pending" &&
      partner.initiated_by_user_id !== partner.user_id;

    return (
      <Card key={partner.id} style={styles.partnerCard}>
        <View style={styles.partnerHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {partnerInfo?.name?.charAt(0)?.toUpperCase() || "?"}
            </Text>
          </View>
          <View style={styles.partnerInfo}>
            <Text style={styles.partnerName}>
              {partnerInfo?.name || "Unknown"}
            </Text>
            {partnerInfo?.username && (
              <Text style={styles.partnerUsername}>
                @{partnerInfo.username}
              </Text>
            )}
          </View>
          {partner.status === "accepted" && (
            <TouchableOpacity
              onPress={() =>
                handleRemovePartner(
                  partner.id,
                  partnerInfo?.name || "this partner"
                )
              }
              style={styles.menuButton}
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={20}
                color={colors.text.secondary}
              />
            </TouchableOpacity>
          )}
        </View>

        {partner.status === "accepted" && (
          <View style={styles.partnerStats}>
            <View style={styles.statItem}>
              <Ionicons
                name="flag-outline"
                size={16}
                color={colors.text.tertiary}
              />
              <Text style={styles.statText}>3 goals</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="flame" size={16} color="#F59E0B" />
              <Text style={styles.statText}>7 day streak</Text>
            </View>
          </View>
        )}

        {partner.status === "pending" && isIncoming && (
          <View style={styles.actionButtons}>
            <Button
              title={t("common.accept")}
              onPress={() => handleAcceptRequest(partner.id)}
              size="sm"
              style={styles.acceptButton}
            />
            <Button
              title={t("common.decline")}
              onPress={() => handleRejectRequest(partner.id)}
              size="sm"
              variant="outline"
              style={styles.declineButton}
            />
          </View>
        )}

        {partner.status === "pending" && !isIncoming && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingText}>
              {t("social.request_pending")}
            </Text>
          </View>
        )}
      </Card>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons
        name="people-outline"
        size={64}
        color={colors.text.tertiary}
        style={styles.emptyIcon}
      />
      <Text style={styles.emptyTitle}>{t("social.no_partners_title")}</Text>
      <Text style={styles.emptyDescription}>
        {t("social.no_partners_description")}
      </Text>
      <Button
        title={t("social.find_partner")}
        onPress={handleFindPartner}
        style={styles.findPartnerButton}
      />
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={brandColors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {t("social.accountability_partners")}
        </Text>
        <TouchableOpacity onPress={handleFindPartner} style={styles.addButton}>
          <Ionicons
            name="person-add-outline"
            size={24}
            color={brandColors.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("social.pending_requests")}
          </Text>
          {pendingRequests.map(renderPartnerCard)}
        </View>
      )}

      {/* Active Partners */}
      {partners.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("social.your_partners")}</Text>
          {partners.map(renderPartnerCard)}
        </View>
      ) : (
        pendingRequests.length === 0 && renderEmptyState()
      )}

      {/* How it works section */}
      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>{t("social.how_partners_work")}</Text>
        <View style={styles.infoItem}>
          <View style={styles.infoIcon}>
            <Ionicons
              name="eye-outline"
              size={20}
              color={brandColors.primary}
            />
          </View>
          <Text style={styles.infoText}>{t("social.partners_can_see")}</Text>
        </View>
        <View style={styles.infoItem}>
          <View style={styles.infoIcon}>
            <Ionicons
              name="heart-outline"
              size={20}
              color={brandColors.primary}
            />
          </View>
          <Text style={styles.infoText}>
            {t("social.partners_can_motivate")}
          </Text>
        </View>
        <View style={styles.infoItem}>
          <View style={styles.infoIcon}>
            <Ionicons
              name="notifications-outline"
              size={20}
              color={brandColors.primary}
            />
          </View>
          <Text style={styles.infoText}>
            {t("social.partners_get_notified")}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.default,
  },
  contentContainer: {
    padding: toRN(tokens.spacing[4]),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    backgroundColor: colors.bg.default,
  },
  header: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[4]),
  },
  headerTitle: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
  },
  addButton: {
    padding: toRN(tokens.spacing[2]),
  },
  section: {
    marginBottom: toRN(tokens.spacing[6]),
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.secondary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: toRN(tokens.spacing[3]),
  },
  partnerCard: {
    marginBottom: toRN(tokens.spacing[3]),
  },
  partnerHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  avatar: {
    width: toRN(48),
    height: toRN(48),
    borderRadius: toRN(24),
    backgroundColor: brand.primary,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginRight: toRN(tokens.spacing[3]),
  },
  avatarText: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: "#FFFFFF",
  },
  partnerInfo: {
    flex: 1,
  },
  partnerName: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
  partnerUsername: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
  },
  menuButton: {
    padding: toRN(tokens.spacing[2]),
  },
  partnerStats: {
    flexDirection: "row" as const,
    marginTop: toRN(tokens.spacing[3]),
    paddingTop: toRN(tokens.spacing[3]),
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    gap: toRN(tokens.spacing[4]),
  },
  statItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
  },
  statText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
  },
  actionButtons: {
    flexDirection: "row" as const,
    gap: toRN(tokens.spacing[2]),
    marginTop: toRN(tokens.spacing[3]),
  },
  acceptButton: {
    flex: 1,
  },
  declineButton: {
    flex: 1,
  },
  pendingBadge: {
    marginTop: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[2]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.sm),
    alignSelf: "flex-start" as const,
  },
  pendingText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
  },
  emptyState: {
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[8]),
  },
  emptyIcon: {
    marginBottom: toRN(tokens.spacing[4]),
  },
  emptyTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[2]),
  },
  emptyDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[4]),
    maxWidth: toRN(280),
  },
  findPartnerButton: {
    minWidth: toRN(200),
  },
  infoSection: {
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.lg),
    padding: toRN(tokens.spacing[4]),
    marginTop: toRN(tokens.spacing[4]),
  },
  infoTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[3]),
  },
  infoItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[3]),
  },
  infoIcon: {
    width: toRN(32),
    height: toRN(32),
    borderRadius: toRN(16),
    backgroundColor: `${brand.primary}15`,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginRight: toRN(tokens.spacing[3]),
  },
  infoText: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
  },
});

export default AccountabilityPartnersScreen;
