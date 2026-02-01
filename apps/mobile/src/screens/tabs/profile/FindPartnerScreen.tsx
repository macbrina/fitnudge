import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import CheckmarkCircle from "@/components/ui/CheckmarkCircle";
import { useQueryClient } from "@tanstack/react-query";
import { BackButton } from "@/components/ui/BackButton";
import Button from "@/components/ui/Button";
import { SearchBar } from "@/components/ui/SearchBar";
import { MOBILE_ROUTES } from "@/lib/routes";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Card } from "@/components/ui/Card";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { ApiError } from "@/services/api/base";
import { useTranslation } from "@/lib/i18n";
import { tokens, useStyles, useTheme } from "@/themes";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { partnersQueryKeys } from "@/hooks/api/queryKeys";
import {
  useSearchPartnersInfinite,
  useSuggestedPartnersInfinite,
  useSendPartnerRequest,
  useCancelPartnerRequest,
  useAcceptPartnerRequest,
  usePartnerAccess
} from "@/hooks/api/usePartners";
import { SearchUserResult, RequestStatus } from "@/services/api/partners";
import { getActivityColor, getActivityStatus } from "@/utils/helper";
import { CARD_PADDING_VALUES } from "@/constants/general";

type PartnerTab = "search" | "suggested";

// Activity status based on last_active_at
export const FindPartnerScreen: React.FC = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const { showAlert, showConfirm } = useAlertModal();

  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Tab options for SegmentedControl
  const tabOptions = useMemo(() => [t("social.tabs.search"), t("social.tabs.suggested")], [t]);

  // Map index to tab type
  const activeTab: PartnerTab = activeTabIndex === 0 ? "search" : "suggested";

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
    isLoading: isSearchLoading
  } = useSearchPartnersInfinite(debouncedQuery);

  // Suggested users query
  const {
    data: suggestedData,
    fetchNextPage: fetchNextSuggestedPage,
    hasNextPage: hasNextSuggestedPage,
    isFetchingNextPage: isFetchingNextSuggestedPage,
    isLoading: isSuggestedLoading
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
    limit: partnerLimit
  } = usePartnerAccess();

  // Redirect back if user can't send requests (at limit)
  React.useEffect(() => {
    if (!canSendRequest) {
      router.back();
    }
  }, [canSendRequest, router]);

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
  const isLoading = activeTab === "search" ? isSearchLoading : isSuggestedLoading;
  const isFetchingNextPage =
    activeTab === "search" ? isFetchingNextSearchPage : isFetchingNextSuggestedPage;
  const hasNextPage = activeTab === "search" ? hasNextSearchPage : hasNextSuggestedPage;

  const handleLoadMore = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage) {
      if (activeTab === "search") {
        fetchNextSearchPage();
      } else {
        fetchNextSuggestedPage();
      }
    }
  }, [activeTab, isFetchingNextPage, hasNextPage, fetchNextSearchPage, fetchNextSuggestedPage]);

  const handleRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    try {
      if (activeTab === "search") {
        // Invalidate search query to force fresh fetch
        await queryClient.invalidateQueries({
          queryKey: partnersQueryKeys.searchInfinite(debouncedQuery)
        });
      } else {
        // Invalidate suggested query to force fresh fetch
        await queryClient.invalidateQueries({
          queryKey: partnersQueryKeys.suggestedInfinite()
        });
      }
    } finally {
      setIsManualRefreshing(false);
    }
  }, [activeTab, debouncedQuery, queryClient]);

  const handleSendRequest = useCallback(
    async (user: SearchUserResult) => {
      // Check if user has the feature (from subscription store - updates immediately after purchase)
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

      // Check if user is within limits (combines store limit + cached counts)
      if (!canSendRequest) {
        showAlert({
          title: t("partners.limit_reached_title") || "Partner Limit Reached",
          message:
            t("partners.limit_reached_message", {
              limit: partnerLimit ?? 0,
              accepted: acceptedCount,
              pending: pendingSentCount
            }) ||
            `You have reached your partner limit (${partnerLimit}). You have ${acceptedCount} partners and ${pendingSentCount} pending requests.`,
          variant: "warning",
          confirmLabel: t("common.ok")
        });
        return;
      }

      // Show confirmation modal explaining what accountability partnership means
      const confirmed = await showConfirm({
        title: t("partners.send_request_title") || "Send Partner Request",
        message:
          t("partners.send_request_message") ||
          "By becoming accountability partners, you will both be able to:\n\n• See each other's active goals\n• View each other's progress and streaks\n• Send nudges to motivate each other\n\nThis helps you stay accountable together on your fitness journey.",
        confirmLabel: t("partners.send_request_confirm") || "Send Request",
        cancelLabel: t("partners.send_request_cancel") || "Cancel",
        variant: "info",
        size: "lg",
        messageAlign: "left"
      });

      if (!confirmed) return;

      // Fire-and-forget: optimistic update already happened, send in background
      const sendWithRetry = async (attempt = 0) => {
        try {
          await sendRequestMutation.mutateAsync({
            partner_user_id: user.id
          });
        } catch (error: unknown) {
          if (attempt === 0) {
            // Silent retry once
            sendWithRetry(1);
          } else {
            // Failed after retry - show error (rollback already handled by mutation)
            const errorMessage =
              error instanceof ApiError ? error.message : t("social.request_failed");
            showAlert({
              title: t("common.error"),
              message: errorMessage,
              variant: "error",
              confirmLabel: t("common.ok")
            });
          }
        }
      };

      sendWithRetry();
    },
    [
      sendRequestMutation,
      showAlert,
      showConfirm,
      t,
      hasPartnerFeature,
      canSendRequest,
      partnerLimit,
      acceptedCount,
      pendingSentCount
    ]
  );

  const handleCancelRequest = useCallback(
    (user: SearchUserResult) => {
      if (!user.partnership_id) return;

      const partnershipId = user.partnership_id;

      // Fire-and-forget: optimistic update already happened, send in background
      const cancelWithRetry = async (attempt = 0) => {
        try {
          await cancelRequestMutation.mutateAsync({
            partnershipId,
            userId: user.id
          });
        } catch (error: unknown) {
          if (attempt === 0) {
            // Silent retry once
            cancelWithRetry(1);
          } else {
            // Failed after retry - show error (rollback already handled by mutation)
            const errorMessage =
              error instanceof ApiError ? error.message : t("social.cancel_failed");
            showAlert({
              title: t("common.error"),
              message: errorMessage,
              variant: "error",
              confirmLabel: t("common.ok")
            });
          }
        }
      };

      cancelWithRetry();
    },
    [cancelRequestMutation, showAlert, t]
  );

  const handleAcceptRequest = useCallback(
    (user: SearchUserResult) => {
      if (!user.partnership_id) return;

      const partnershipId = user.partnership_id;

      // Fire-and-forget: optimistic update already happened, send in background
      const acceptWithRetry = async (attempt = 0) => {
        try {
          await acceptRequestMutation.mutateAsync({
            partnershipId,
            userId: user.id
          });
        } catch (error: unknown) {
          if (attempt === 0) {
            // Silent retry once
            acceptWithRetry(1);
          } else {
            // Failed after retry - show error (rollback already handled by mutation)
            const errorMessage =
              error instanceof ApiError ? error.message : t("social.accept_failed");
            showAlert({
              title: t("common.error"),
              message: errorMessage,
              variant: "error",
              confirmLabel: t("common.ok")
            });
          }
        }
      };

      acceptWithRetry();
    },
    [acceptRequestMutation, showAlert, t]
  );

  const renderUserCard = useCallback(
    ({ item }: { item: SearchUserResult }) => {
      const requestStatus = item.request_status || "none";

      // Render action button based on request status
      const renderActionButton = () => {
        switch (requestStatus) {
          case "accepted":
            // Already partners - show badge
            return (
              <View style={styles.partnerBadge}>
                <CheckmarkCircle size={16} color={colors.feedback.success} mr={1} />
                <Text style={styles.partnerBadgeText}>{t("social.partner_badge")}</Text>
              </View>
            );

          case "sent":
            // I sent them a request - show "Requested" with cancel option
            return (
              <TouchableOpacity
                style={styles.requestedButton}
                onPress={() => handleCancelRequest(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="time-outline" size={14} color={colors.text.tertiary} />
                <Text style={styles.requestedButtonText}>{t("social.requested_button")}</Text>
              </TouchableOpacity>
            );

          case "received":
            // They sent me a request - show Accept button
            return (
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={() => handleAcceptRequest(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                <Text style={styles.acceptButtonText}>{t("social.accept_button")}</Text>
              </TouchableOpacity>
            );

          case "none":
          default:
            // No relationship - show Request button
            return (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => handleSendRequest(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="person-add" size={16} color={brandColors.primary} />
                <Text style={styles.addButtonText}>{t("social.request_button")}</Text>
              </TouchableOpacity>
            );
        }
      };

      // Check if this is a suggested user with match data
      const hasMatchData = activeTab === "suggested" && item.match_score !== undefined;
      const matchScore = item.match_score ?? 0;
      const matchReasons = item.match_reasons ?? [];
      const matchedGoals = item.matched_goals ?? [];

      // Get color for match score badge
      const getMatchColor = () => {
        if (matchScore >= 70) return colors.feedback.success;
        if (matchScore >= 40) return "#F59E0B"; // Amber
        return colors.text.tertiary;
      };

      return (
        <Card style={styles.userCard}>
          <View style={styles.userRow}>
            {/* Avatar */}
            <View style={styles.avatarContainer}>
              {item.profile_picture_url ? (
                <Image source={{ uri: item.profile_picture_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: brandColors.primary }]}>
                  <Text style={styles.avatarInitial}>
                    {item.name?.charAt(0)?.toUpperCase() ||
                      item.username?.charAt(0)?.toUpperCase() ||
                      "?"}
                  </Text>
                </View>
              )}
              {/* Activity Indicator - top right of avatar */}
              {item.last_active_at && (
                <View
                  style={[
                    styles.activityIndicator,
                    { backgroundColor: getActivityColor(getActivityStatus(item.last_active_at)) }
                  ]}
                />
              )}
              {/* Match Score Badge on Avatar */}
              {hasMatchData && matchScore > 0 && (
                <View style={[styles.matchScoreBadge, { backgroundColor: getMatchColor() }]}>
                  <Text style={styles.matchScoreText}>{Math.round(matchScore)}%</Text>
                </View>
              )}
            </View>

            {/* User Info */}
            <View style={styles.userInfo}>
              {item.name && (
                <Text style={styles.partnerName} numberOfLines={1}>
                  {item.name || t("common.user")}
                </Text>
              )}
              {item.username && (
                <Text style={styles.partnerUsername} numberOfLines={1}>
                  @{item.username}
                </Text>
              )}

              {/* Match Reasons (for suggested tab) */}
              {hasMatchData && matchReasons.length > 0 && (
                <View style={styles.matchReasonsRow}>
                  {matchReasons.slice(0, 2).map((reason, index) => (
                    <View key={index} style={styles.matchReasonChip}>
                      <Ionicons
                        name={
                          reason.toLowerCase().includes("goal")
                            ? "flag-outline"
                            : reason.toLowerCase().includes("timezone")
                              ? "time-outline"
                              : reason.toLowerCase().includes("schedule")
                                ? "calendar-outline"
                                : "checkmark-circle-outline"
                        }
                        size={10}
                        color={brandColors.primary}
                      />
                      <Text style={styles.matchReasonText} numberOfLines={1}>
                        {reason}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Matched Goals Preview */}
              {hasMatchData && matchedGoals.length > 0 && matchReasons.length === 0 && (
                <Text style={styles.matchedGoalsText} numberOfLines={1}>
                  {t("social.goals_in_common", { count: matchedGoals.length })}
                </Text>
              )}
            </View>

            {/* Action Button */}
            <View style={styles.actionContainer}>{renderActionButton()}</View>
          </View>
        </Card>
      );
    },
    [
      activeTab,
      brandColors,
      colors,
      handleSendRequest,
      handleCancelRequest,
      handleAcceptRequest,
      styles,
      t
    ]
  );

  const renderEmptyState = useCallback(() => {
    if (activeTab === "search" && debouncedQuery.length < 2) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="search" size={48} color={colors.text.tertiary} />
          </View>
          <Text style={styles.emptyTitle}>{t("social.search_for_users")}</Text>
          <Text style={styles.emptyDescription}>{t("social.search_description")}</Text>
        </View>
      );
    }

    if (isLoading) {
      return null;
    }

    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconContainer}>
          <Ionicons name="people-outline" size={48} color={colors.text.tertiary} />
        </View>
        <Text style={styles.emptyTitle}>
          {activeTab === "search" ? t("social.no_users_found") : t("social.no_suggestions")}
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
          <SkeletonBox
            key={i}
            width="100%"
            height={75}
            borderRadius={toRN(tokens.borderRadius.xl)}
            inner
            innerPadding={CARD_PADDING_VALUES.SM}
            style={styles.skeletonCard}
          >
            <SkeletonBox
              width={48}
              height={48}
              borderRadius={24}
              style={{ marginLeft: toRN(tokens.spacing[2]) }}
            />
            <View style={[styles.skeletonContent, { padding: toRN(tokens.spacing[2]) }]}>
              <SkeletonBox width={120} height={16} borderRadius={4} />
              <SkeletonBox width={80} height={12} borderRadius={4} style={{ marginTop: 4 }} />
            </View>
            <SkeletonBox
              width={60}
              height={32}
              borderRadius={16}
              style={{ marginRight: toRN(tokens.spacing[2]) }}
            />
          </SkeletonBox>
        ))}
      </View>
    ),
    [styles]
  );

  // Show skeleton loading for initial load
  const showSkeleton = isLoading && (activeTab === "suggested" || debouncedQuery.length >= 2);

  return (
    <View style={styles.container}>
      {/* Header */}
      <BackButton title={t("social.find_partner")} onPress={() => router.back()} />

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <SegmentedControl
          options={tabOptions}
          selectedIndex={activeTabIndex}
          onChange={setActiveTabIndex}
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
          onPress={() => router.push(MOBILE_ROUTES.PROFILE.REFERRAL)}
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
    backgroundColor: colors.bg.canvas
  },
  tabsContainer: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[4])
  },
  searchContainer: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[4])
  },
  contentWrapper: {
    flex: 1
  },
  listContent: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[8]),
    flexGrow: 1
  },
  separator: {
    height: toRN(tokens.spacing[3])
  },

  // User Card
  userCard: {
    padding: toRN(tokens.spacing[4])
  },
  userRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const
  },
  avatarContainer: {
    marginRight: toRN(tokens.spacing[3]),
    position: "relative" as const
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  activityIndicator: {
    position: "absolute" as const,
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.bg.card
  },
  avatarInitial: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: "#fff"
  },
  matchScoreBadge: {
    position: "absolute" as const,
    bottom: -2,
    right: -2,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.bg.card
  },
  matchScoreText: {
    fontSize: 9,
    fontFamily: fontFamily.bold,
    color: "#FFFFFF"
  },
  userInfo: {
    flex: 1,
    marginRight: toRN(tokens.spacing[3])
  },
  partnerName: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary
  },
  partnerUsername: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[0.5])
  },
  matchReasonsRow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: toRN(tokens.spacing[1]),
    marginTop: toRN(tokens.spacing[1.5])
  },
  matchReasonChip: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: `${brand.primary}12`,
    paddingHorizontal: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[0.5]),
    borderRadius: toRN(tokens.borderRadius.sm),
    gap: toRN(tokens.spacing[1])
  },
  matchReasonText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: brand.primary,
    maxWidth: 100
  },
  matchedGoalsText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[1])
  },
  actionContainer: {
    minWidth: 80,
    alignItems: "flex-end" as const
  },
  addButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    backgroundColor: `${brand.primary}15`,
    borderRadius: toRN(tokens.borderRadius.full),
    gap: toRN(tokens.spacing[1])
  },
  addButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: brand.primary
  },
  partnerBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[2]),
    backgroundColor: `${colors.feedback.success}15`,
    borderRadius: toRN(tokens.borderRadius.full),
    gap: toRN(tokens.spacing[1])
  },
  partnerBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.feedback.success
  },
  pendingBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[2]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.full),
    gap: toRN(tokens.spacing[1])
  },
  pendingBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary
  },
  requestedButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.full),
    gap: toRN(tokens.spacing[1])
  },
  requestedButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary
  },
  acceptButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    backgroundColor: brand.primary,
    borderRadius: toRN(tokens.borderRadius.full),
    gap: toRN(tokens.spacing[1])
  },
  acceptButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: "#FFFFFF"
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[8]),
    paddingVertical: toRN(tokens.spacing[12])
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
    color: colors.text.secondary,
    textAlign: "center" as const,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5
  },

  // Loading
  loadingFooter: {
    flexDirection: "row" as const,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[4]),
    gap: toRN(tokens.spacing[2])
  },
  loadingText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary
  },

  // Skeleton
  skeletonContainer: {
    paddingHorizontal: toRN(tokens.spacing[4])
  },
  skeletonCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[3])
  },
  skeletonContent: {
    flex: 1,
    marginLeft: toRN(tokens.spacing[3]),
    marginRight: toRN(tokens.spacing[3])
  },

  // Invite Section
  inviteSection: {
    padding: toRN(tokens.spacing[4]),
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    marginBottom: toRN(tokens.spacing[3])
  }
});

export default FindPartnerScreen;
