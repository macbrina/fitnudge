import React, { useCallback, useState } from "react";
import {
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BackButton } from "@/components/ui/BackButton";
import { Card } from "@/components/ui/Card";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { toRN } from "@/lib/units";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";

// Hooks
import { useBlockedPartners, useUnblockPartner } from "@/hooks/api/usePartners";
import { Partner } from "@/services/api/partners";

export default function BlockedPartnersScreen() {
  const router = useRouter();
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const { showConfirm, showToast } = useAlertModal();

  const [refreshing, setRefreshing] = useState(false);

  // Data hooks
  const {
    data: blockedData,
    isLoading: loadingBlocked,
    refetch: refetchBlocked
  } = useBlockedPartners();

  // Mutations
  const unblockMutation = useUnblockPartner();

  const blockedPartners = blockedData?.data || [];

  // Refresh data
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchBlocked();
    } finally {
      setRefreshing(false);
    }
  }, [refetchBlocked]);

  // Handle unblock - fire-and-forget with optimistic UI
  const handleUnblock = useCallback(
    async (partner: Partner) => {
      const partnerName = partner.partner?.name || partner.partner?.username || "this user";

      const confirmed = await showConfirm({
        title: t("partners.unblock_title") || "Unblock User",
        message:
          t("partners.unblock_message", { name: partnerName }) ||
          `Are you sure you want to unblock ${partnerName}? They will be able to find you in search again.`,
        variant: "warning",
        confirmLabel: t("common.unblock") || "Unblock",
        cancelLabel: t("common.cancel"),
        size: "md"
      });

      if (!confirmed) return;

      // Fire-and-forget with silent retry
      // useUnblockPartner handles optimistic update in onMutate
      const attemptUnblock = (retryCount: number) => {
        unblockMutation.mutate(partner.id, {
          onError: () => {
            if (retryCount < 1) {
              setTimeout(() => attemptUnblock(retryCount + 1), 1000);
            } else {
              showToast({
                title: t("common.error") || "Error",
                message: t("partners.unblock_error") || "Failed to unblock user",
                variant: "error"
              });
            }
          }
        });
      };

      attemptUnblock(0);
    },
    [showConfirm, showToast, unblockMutation, t]
  );

  // Render blocked partner card
  const renderBlockedPartner = useCallback(
    ({ item }: { item: Partner }) => {
      const partnerInfo = item.partner;
      const name = partnerInfo?.name || partnerInfo?.username || "Unknown";
      const username = partnerInfo?.username;

      return (
        <Card style={styles.partnerCard}>
          <View style={styles.partnerRow}>
            {/* Avatar */}
            <View style={styles.avatarContainer}>
              {partnerInfo?.profile_picture_url ? (
                <Image source={{ uri: partnerInfo.profile_picture_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarInitial}>{name.charAt(0).toUpperCase()}</Text>
                </View>
              )}
            </View>

            {/* Info */}
            <View style={styles.partnerInfo}>
              <Text style={styles.partnerName} numberOfLines={1}>
                {name}
              </Text>
              {username && (
                <Text style={styles.partnerUsername} numberOfLines={1}>
                  @{username}
                </Text>
              )}
            </View>

            {/* Unblock Button */}
            <TouchableOpacity
              style={styles.unblockButton}
              onPress={() => handleUnblock(item)}
              activeOpacity={0.7}
            >
              <Text style={styles.unblockButtonText}>{t("common.unblock") || "Unblock"}</Text>
            </TouchableOpacity>
          </View>
        </Card>
      );
    },
    [styles, handleUnblock, t]
  );

  // Render skeleton loading
  const renderSkeleton = useCallback(
    () => (
      <View style={styles.skeletonContainer}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} style={styles.partnerCard}>
            <View style={styles.partnerRow}>
              <SkeletonBox width={48} height={48} borderRadius={24} />
              <View style={styles.skeletonInfo}>
                <SkeletonBox width={120} height={16} borderRadius={4} />
                <SkeletonBox width={80} height={12} borderRadius={4} style={{ marginTop: 6 }} />
              </View>
              <SkeletonBox width={80} height={36} borderRadius={18} />
            </View>
          </Card>
        ))}
      </View>
    ),
    [styles]
  );

  // Render empty state
  const renderEmptyState = useCallback(
    () => (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconContainer}>
          <Ionicons name="shield-checkmark-outline" size={48} color={colors.text.tertiary} />
        </View>
        <Text style={styles.emptyTitle}>{t("partners.no_blocked") || "No Blocked Users"}</Text>
        <Text style={styles.emptyDescription}>
          {t("partners.no_blocked_description") ||
            "Users you block will appear here. You can unblock them at any time."}
        </Text>
      </View>
    ),
    [styles, colors, t]
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <BackButton
        title={t("partners.blocked_users") || "Blocked Users"}
        onPress={() => router.back()}
      />

      {/* Content */}
      {loadingBlocked ? (
        renderSkeleton()
      ) : blockedPartners.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyScrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={brandColors.primary}
            />
          }
        >
          {renderEmptyState()}
        </ScrollView>
      ) : (
        <FlatList
          data={blockedPartners}
          renderItem={renderBlockedPartner}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={brandColors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  emptyScrollContent: {
    flexGrow: 1
  },

  // List
  listContent: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[8])
  },
  separator: {
    height: toRN(tokens.spacing[3])
  },

  // Partner Card
  partnerCard: {
    padding: toRN(tokens.spacing[4])
  },
  partnerRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const
  },
  avatarContainer: {
    marginRight: toRN(tokens.spacing[3])
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24
  },
  avatarPlaceholder: {
    backgroundColor: brand.primary,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  avatarInitial: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: "#FFFFFF"
  },
  partnerInfo: {
    flex: 1,
    marginRight: toRN(tokens.spacing[3])
  },
  partnerName: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  partnerUsername: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[0.5])
  },
  unblockButton: {
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.full)
  },
  unblockButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary
  },

  // Skeleton Loading
  skeletonContainer: {
    paddingHorizontal: toRN(tokens.spacing[4])
  },
  skeletonInfo: {
    flex: 1,
    marginHorizontal: toRN(tokens.spacing[3])
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[8])
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
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[2])
  },
  emptyDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    textAlign: "center" as const,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5,
    maxWidth: 280
  }
});
