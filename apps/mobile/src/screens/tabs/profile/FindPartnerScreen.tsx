import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { BackButton } from "@/components/ui/BackButton";
import Button from "@/components/ui/Button";
import { SearchBar } from "@/components/ui/SearchBar";
import { MOBILE_ROUTES } from "@/lib/routes";
import { Tabs, TabItem } from "@/components/ui/Tabs";
import { Card } from "@/components/ui/Card";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { useTranslation } from "@/lib/i18n";
import { useStyles, useTheme } from "@/themes";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { partnersQueryKeys } from "@/hooks/api/queryKeys";
import {
  useSearchPartnersInfinite,
  useSuggestedPartnersInfinite,
  useSendPartnerRequest,
  useCancelPartnerRequest,
  useAcceptPartnerRequest,
  usePartnerAccess,
} from "@/hooks/api/usePartners";
import { SearchUserResult, RequestStatus } from "@/services/api/partners";

type PartnerTab = "search" | "suggested";

export const FindPartnerScreen: React.FC = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const { showAlert, showConfirm } = useAlertModal();

  const [activeTab, setActiveTab] = useState<PartnerTab>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Build tabs with translations
  const tabs: TabItem[] = useMemo(
    () => [
      { id: "search", label: t("social.tabs.search") },
      { id: "suggested", label: t("social.tabs.suggested") },
    ],
    [t],
  );

  // Debounce search query
  const debounceTimeout = React.useRef<NodeJS.Timeout | null>(null);
  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    debounceTimeout.current = setTimeout(() => {
      setDebouncedQuery(text);
    }, 300);
  }, []);

  // Search query
  const {
    data: searchData,
    fetchNextPage: fetchNextSearchPage,
    hasNextPage: hasNextSearchPage,
    isFetchingNextPage: isFetchingNextSearchPage,
    isLoading: isSearchLoading,
  } = useSearchPartnersInfinite(debouncedQuery);

  // Suggested users query
  const {
    data: suggestedData,
    fetchNextPage: fetchNextSuggestedPage,
    hasNextPage: hasNextSuggestedPage,
    isFetchingNextPage: isFetchingNextSuggestedPage,
    isLoading: isSuggestedLoading,
  } = useSuggestedPartnersInfinite();

  // Mutations
  const sendRequestMutation = useSendPartnerRequest();
  const cancelRequestMutation = useCancelPartnerRequest();
  const acceptRequestMutation = useAcceptPartnerRequest();

  // Partner access - combines subscription store (immediate) + cached limits (accurate counts)
  const {
    hasFeature: hasPartnerFeature,
    canSendRequest,
    acceptedCount,
    pendingSentCount,
    limit: partnerLimit,
  } = usePartnerAccess();

  // Track which users are currently being processed (for showing loading on specific buttons)
  const [processingUsers, setProcessingUsers] = useState<Set<string>>(
    new Set(),
  );

  // Track manual refresh state (don't show RefreshControl for background refetches)
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  // Flatten paginated data
  const searchUsers = useMemo(() => {
    if (!searchData?.pages) return [];
    return searchData.pages.flatMap((page) => page.users);
  }, [searchData]);

  const suggestedUsers = useMemo(() => {
    if (!suggestedData?.pages) return [];
    return suggestedData.pages.flatMap((page) => page.users);
  }, [suggestedData]);

  // Get current data based on active tab
  const currentUsers = activeTab === "search" ? searchUsers : suggestedUsers;
  const isLoading =
    activeTab === "search" ? isSearchLoading : isSuggestedLoading;
  const isFetchingNextPage =
    activeTab === "search"
      ? isFetchingNextSearchPage
      : isFetchingNextSuggestedPage;
  const hasNextPage =
    activeTab === "search" ? hasNextSearchPage : hasNextSuggestedPage;

  const handleLoadMore = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage) {
      if (activeTab === "search") {
        fetchNextSearchPage();
      } else {
        fetchNextSuggestedPage();
      }
    }
  }, [
    activeTab,
    isFetchingNextPage,
    hasNextPage,
    fetchNextSearchPage,
    fetchNextSuggestedPage,
  ]);

  const handleRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    try {
      if (activeTab === "search") {
        // Invalidate search query to force fresh fetch
        await queryClient.invalidateQueries({
          queryKey: partnersQueryKeys.searchInfinite(debouncedQuery),
        });
      } else {
        // Invalidate suggested query to force fresh fetch
        await queryClient.invalidateQueries({
          queryKey: partnersQueryKeys.suggestedInfinite(),
        });
      }
    } finally {
      setIsManualRefreshing(false);
    }
  }, [activeTab, debouncedQuery, queryClient]);

  // Helper to add/remove user from processing set
  const addProcessingUser = useCallback((userId: string) => {
    setProcessingUsers((prev) => new Set(prev).add(userId));
  }, []);

  const removeProcessingUser = useCallback((userId: string) => {
    setProcessingUsers((prev) => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
  }, []);

  const handleSendRequest = useCallback(
    async (user: SearchUserResult) => {
      const userName = user.name || user.username || t("partners.unknown_user");

      // Check if user has the feature (from subscription store - updates immediately after purchase)
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

      // Check if user is within limits (combines store limit + cached counts)
      if (!canSendRequest) {
        showAlert({
          title: t("partners.limit_reached_title") || "Partner Limit Reached",
          message:
            t("partners.limit_reached_message", {
              limit: partnerLimit ?? 0,
              accepted: acceptedCount,
              pending: pendingSentCount,
            }) ||
            `You have reached your partner limit (${partnerLimit}). You have ${acceptedCount} partners and ${pendingSentCount} pending requests.`,
          variant: "warning",
          confirmLabel: t("common.ok"),
        });
        return;
      }

      // Show confirmation modal explaining what accountability partnership means
      const confirmed = await showConfirm({
        title: t("partners.send_request_title") || "Send Partner Request",
        message:
          t("partners.send_request_message") ||
          "By becoming accountability partners, you will both be able to:\n\n• See each other's active goals and challenges\n• View each other's progress and streaks\n• Send nudges to motivate each other\n\nThis helps you stay accountable together on your fitness journey.",
        confirmLabel: t("partners.send_request_confirm") || "Send Request",
        cancelLabel: t("partners.send_request_cancel") || "Cancel",
        variant: "info",
        size: "lg",
        messageAlign: "left",
      });

      if (!confirmed) return;

      addProcessingUser(user.id);
      try {
        await sendRequestMutation.mutateAsync({
          partner_user_id: user.id,
        });
        // No need to refresh - optimistic update handles button state
      } catch (error: any) {
        showAlert({
          title: t("common.error"),
          message: error?.message || t("social.request_failed"),
          variant: "error",
          confirmLabel: t("common.ok"),
        });
      } finally {
        removeProcessingUser(user.id);
      }
    },
    [
      sendRequestMutation,
      showAlert,
      showConfirm,
      t,
      addProcessingUser,
      removeProcessingUser,
      hasPartnerFeature,
      canSendRequest,
      partnerLimit,
      acceptedCount,
      pendingSentCount,
    ],
  );

  const handleCancelRequest = useCallback(
    async (user: SearchUserResult) => {
      if (!user.partnership_id) return;

      addProcessingUser(user.id);
      try {
        await cancelRequestMutation.mutateAsync({
          partnershipId: user.partnership_id,
          userId: user.id,
        });
        // No need to refresh - optimistic update handles button state
      } catch (error: any) {
        showAlert({
          title: t("common.error"),
          message: error?.message || t("social.cancel_failed"),
          variant: "error",
          confirmLabel: t("common.ok"),
        });
      } finally {
        removeProcessingUser(user.id);
      }
    },
    [
      cancelRequestMutation,
      showAlert,
      t,
      addProcessingUser,
      removeProcessingUser,
    ],
  );

  const handleAcceptRequest = useCallback(
    async (user: SearchUserResult) => {
      if (!user.partnership_id) return;

      addProcessingUser(user.id);
      try {
        await acceptRequestMutation.mutateAsync({
          partnershipId: user.partnership_id,
          userId: user.id,
        });
        // No need to refresh - optimistic update handles button state
      } catch (error: any) {
        showAlert({
          title: t("common.error"),
          message: error?.message || t("social.accept_failed"),
          variant: "error",
          confirmLabel: t("common.ok"),
        });
      } finally {
        removeProcessingUser(user.id);
      }
    },
    [
      acceptRequestMutation,
      showAlert,
      t,
      addProcessingUser,
      removeProcessingUser,
    ],
  );

  const renderUserCard = useCallback(
    ({ item }: { item: SearchUserResult }) => {
      const requestStatus = item.request_status || "none";
      const isProcessing = processingUsers.has(item.id);

      // Render action button based on request status
      const renderActionButton = () => {
        switch (requestStatus) {
          case "accepted":
            // Already partners - show badge
            return (
              <View style={styles.partnerBadge}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={colors.feedback.success}
                />
                <Text style={styles.partnerBadgeText}>
                  {t("social.partner_badge")}
                </Text>
              </View>
            );

          case "sent":
            // I sent them a request - show "Requested" with cancel option
            return (
              <TouchableOpacity
                style={styles.requestedButton}
                onPress={() => handleCancelRequest(item)}
                disabled={isProcessing}
                activeOpacity={0.7}
              >
                {isProcessing ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.text.tertiary}
                  />
                ) : (
                  <>
                    <Ionicons
                      name="time-outline"
                      size={14}
                      color={colors.text.tertiary}
                    />
                    <Text style={styles.requestedButtonText}>
                      {t("social.requested_button")}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            );

          case "received":
            // They sent me a request - show Accept button
            return (
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={() => handleAcceptRequest(item)}
                disabled={isProcessing}
                activeOpacity={0.7}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    <Text style={styles.acceptButtonText}>
                      {t("social.accept_button")}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            );

          case "none":
          default:
            // No relationship - show Request button
            return (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => handleSendRequest(item)}
                disabled={isProcessing}
                activeOpacity={0.7}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color={brandColors.primary} />
                ) : (
                  <>
                    <Ionicons
                      name="person-add"
                      size={16}
                      color={brandColors.primary}
                    />
                    <Text style={styles.addButtonText}>
                      {t("social.request_button")}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            );
        }
      };

      return (
        <Card style={styles.userCard}>
          <View style={styles.userRow}>
            {/* Avatar */}
            <View style={styles.avatarContainer}>
              {item.profile_picture_url ? (
                <Image
                  source={{ uri: item.profile_picture_url }}
                  style={styles.avatar}
                />
              ) : (
                <View
                  style={[
                    styles.avatarPlaceholder,
                    { backgroundColor: brandColors.primary },
                  ]}
                >
                  <Text style={styles.avatarInitial}>
                    {item.name?.charAt(0)?.toUpperCase() ||
                      item.username?.charAt(0)?.toUpperCase() ||
                      "?"}
                  </Text>
                </View>
              )}
            </View>

            {/* User Info */}
            <View style={styles.userInfo}>
              {item.username && (
                <Text style={styles.userUsername} numberOfLines={1}>
                  @{item.username}
                </Text>
              )}
              <Text style={styles.userName} numberOfLines={1}>
                {item.name || (item.username ? "" : t("social.unknown_user"))}
              </Text>
            </View>

            {/* Action Button */}
            <View style={styles.actionContainer}>{renderActionButton()}</View>
          </View>
        </Card>
      );
    },
    [
      brandColors,
      colors,
      handleSendRequest,
      handleCancelRequest,
      handleAcceptRequest,
      processingUsers,
      styles,
      t,
    ],
  );

  const renderEmptyState = useCallback(() => {
    if (activeTab === "search" && debouncedQuery.length < 2) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="search" size={48} color={colors.text.tertiary} />
          </View>
          <Text style={styles.emptyTitle}>{t("social.search_for_users")}</Text>
          <Text style={styles.emptyDescription}>
            {t("social.search_description")}
          </Text>
        </View>
      );
    }

    if (isLoading) {
      return null;
    }

    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconContainer}>
          <Ionicons
            name="people-outline"
            size={48}
            color={colors.text.tertiary}
          />
        </View>
        <Text style={styles.emptyTitle}>
          {activeTab === "search"
            ? t("social.no_users_found")
            : t("social.no_suggestions")}
        </Text>
        <Text style={styles.emptyDescription}>
          {activeTab === "search"
            ? t("social.try_different_search")
            : t("social.no_suggestions_description")}
        </Text>
      </View>
    );
  }, [activeTab, debouncedQuery, isLoading, colors, styles, t]);

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={brandColors.primary} />
        <Text style={styles.loadingText}>{t("social.loading_more")}</Text>
      </View>
    );
  }, [isFetchingNextPage, brandColors, styles, t]);

  const renderSkeleton = useCallback(
    () => (
      <View style={styles.skeletonContainer}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={styles.skeletonCard}>
            <SkeletonBox width={48} height={48} borderRadius={24} />
            <View style={styles.skeletonContent}>
              <SkeletonBox width={120} height={16} borderRadius={4} />
              <SkeletonBox
                width={80}
                height={12}
                borderRadius={4}
                style={{ marginTop: 4 }}
              />
            </View>
            <SkeletonBox width={60} height={32} borderRadius={16} />
          </View>
        ))}
      </View>
    ),
    [styles],
  );

  // Show skeleton loading for initial load
  const showSkeleton =
    isLoading && (activeTab === "suggested" || debouncedQuery.length >= 2);

  return (
    <View style={styles.container}>
      {/* Header */}
      <BackButton
        title={t("social.find_partner")}
        onPress={() => router.back()}
      />

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <Tabs
          tabs={tabs}
          selectedId={activeTab}
          onChange={(id) => setActiveTab(id as PartnerTab)}
          variant="underline"
          fullWidth
        />
      </View>

      {/* Search Bar (only in search tab) */}
      {activeTab === "search" && (
        <View style={styles.searchContainer}>
          <SearchBar
            value={searchQuery}
            onChangeText={handleSearchChange}
            placeholder={t("social.search_users_placeholder")}
          />
        </View>
      )}

      {/* Content - wrapped in flex container to keep button at bottom */}
      <View style={styles.contentWrapper}>
        {showSkeleton ? (
          renderSkeleton()
        ) : (
          <FlatList
            data={currentUsers}
            renderItem={renderUserCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            ListEmptyComponent={renderEmptyState}
            ListFooterComponent={renderFooter}
            refreshControl={
              <RefreshControl
                refreshing={isManualRefreshing}
                onRefresh={handleRefresh}
                tintColor={brandColors.primary}
              />
            }
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
      </View>

      {/* Invite Friends Option - sticky at bottom */}
      <View style={styles.inviteSection}>
        <Button
          title={t("social.invite_friends")}
          onPress={() => router.push(MOBILE_ROUTES.SOCIAL.REFERRAL)}
          variant="outline"
          leftIcon="share-outline"
          fullWidth
        />
      </View>
    </View>
  );
};

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
  tabsContainer: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[4]),
  },
  searchContainer: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[4]),
  },
  contentWrapper: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[8]),
    flexGrow: 1,
  },
  separator: {
    height: toRN(tokens.spacing[3]),
  },

  // User Card
  userCard: {
    padding: toRN(tokens.spacing[4]),
  },
  userRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  avatarContainer: {
    marginRight: toRN(tokens.spacing[3]),
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  avatarInitial: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: "#fff",
  },
  userInfo: {
    flex: 1,
    marginRight: toRN(tokens.spacing[3]),
  },
  userName: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
  userUsername: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    marginTop: toRN(tokens.spacing[0.5]),
  },
  actionContainer: {
    minWidth: 80,
    alignItems: "flex-end" as const,
  },
  addButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    backgroundColor: `${brand.primary}15`,
    borderRadius: toRN(tokens.borderRadius.full),
    gap: toRN(tokens.spacing[1]),
  },
  addButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: brand.primary,
  },
  partnerBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[2]),
    backgroundColor: `${colors.feedback.success}15`,
    borderRadius: toRN(tokens.borderRadius.full),
    gap: toRN(tokens.spacing[1]),
  },
  partnerBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.feedback.success,
  },
  pendingBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[2]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.full),
    gap: toRN(tokens.spacing[1]),
  },
  pendingBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
  },
  requestedButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.full),
    gap: toRN(tokens.spacing[1]),
  },
  requestedButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
  },
  acceptButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    backgroundColor: brand.primary,
    borderRadius: toRN(tokens.borderRadius.full),
    gap: toRN(tokens.spacing[1]),
  },
  acceptButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: "#FFFFFF",
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[8]),
    paddingVertical: toRN(tokens.spacing[12]),
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.bg.muted,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[4]),
  },
  emptyTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[2]),
  },
  emptyDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5,
  },

  // Loading
  loadingFooter: {
    flexDirection: "row" as const,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[4]),
    gap: toRN(tokens.spacing[2]),
  },
  loadingText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
  },

  // Skeleton
  skeletonContainer: {
    paddingHorizontal: toRN(tokens.spacing[4]),
  },
  skeletonCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    padding: toRN(tokens.spacing[4]),
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.lg),
    marginBottom: toRN(tokens.spacing[3]),
  },
  skeletonContent: {
    flex: 1,
    marginLeft: toRN(tokens.spacing[3]),
    marginRight: toRN(tokens.spacing[3]),
  },

  // Invite Section
  inviteSection: {
    padding: toRN(tokens.spacing[4]),
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    marginBottom: toRN(tokens.spacing[3]),
  },
});

export default FindPartnerScreen;
