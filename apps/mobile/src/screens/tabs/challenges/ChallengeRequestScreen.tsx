import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
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
import { partnersQueryKeys, challengeInvitesQueryKeys } from "@/hooks/api/queryKeys";
import { useSearchPartnersInfinite, useSuggestedPartnersInfinite } from "@/hooks/api/usePartners";
import {
  useReceivedChallengeInvites,
  useSentChallengeInvites,
  useAcceptChallengeInvite,
  useDeclineChallengeInvite,
  useCancelChallengeInvite,
  useSendChallengeInvite,
  useChallenge
} from "@/hooks/api/useChallenges";
import { SearchUserResult } from "@/services/api/partners";
import { ChallengeInvite } from "@/services/api/challenges";

type RequestTab = "search" | "received" | "sent";

export const ChallengeRequestScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ challengeId?: string }>();
  const challengeId = params.challengeId;
  const queryClient = useQueryClient();

  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();

  const [activeTab, setActiveTab] = useState<RequestTab>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Get challenge info if challengeId provided
  const { data: challengeData } = useChallenge(challengeId || "");
  const challenge = challengeData?.data;

  // Check if challenge allows invites
  const canSendInvites = useMemo(() => {
    if (!challenge) return false;

    // Challenge must be active or upcoming
    const validStatus = challenge.status === "active" || challenge.status === "upcoming";
    if (!validStatus) return false;

    // Check join deadline
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const deadlineStr = challenge.join_deadline || challenge.start_date;
    if (deadlineStr) {
      const deadline = new Date(deadlineStr);
      deadline.setHours(23, 59, 59, 999);
      if (today > deadline) return false;
    }

    return true;
  }, [challenge]);

  // Build tabs with translations
  const tabs: TabItem[] = useMemo(
    () => [
      { id: "search", label: t("challenges.invite_users") },
      { id: "received", label: t("challenges.received") },
      { id: "sent", label: t("challenges.pending") }
    ],
    [t]
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

  // Received/Sent invites
  const { data: receivedData, isLoading: isLoadingReceived } = useReceivedChallengeInvites();

  const { data: sentData, isLoading: isLoadingSent } = useSentChallengeInvites();

  // Mutations
  const sendInviteMutation = useSendChallengeInvite();
  const acceptMutation = useAcceptChallengeInvite();
  const declineMutation = useDeclineChallengeInvite();
  const cancelMutation = useCancelChallengeInvite();

  // Track which users are currently being processed (for showing loading on specific buttons)
  const [processingUsers, setProcessingUsers] = useState<Set<string>>(new Set());

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

  // Get current data based on active tab and search query
  const currentUsers = debouncedQuery.length >= 2 ? searchUsers : suggestedUsers;
  const isLoading = debouncedQuery.length >= 2 ? isSearchLoading : isSuggestedLoading;
  const isFetchingNextPage =
    debouncedQuery.length >= 2 ? isFetchingNextSearchPage : isFetchingNextSuggestedPage;
  const hasNextPage = debouncedQuery.length >= 2 ? hasNextSearchPage : hasNextSuggestedPage;

  const receivedInvites = receivedData?.data || [];
  const sentInvites = sentData?.data || [];

  // Filter sent invites: only show pending invites (for the Pending tab)
  // If challengeId provided, also filter by challenge
  const filteredSentInvites = sentInvites.filter(
    (inv) => inv.status === "pending" && (!challengeId || inv.challenge_id === challengeId)
  );

  // Check if user already has pending invite for this challenge
  const hasInvitePending = useCallback(
    (userId: string) => {
      if (!challengeId) return false;
      return filteredSentInvites.some(
        (inv) => inv.invited_user_id === userId && inv.status === "pending"
      );
    },
    [challengeId, filteredSentInvites]
  );

  // Get the invite for a specific user (for cancellation)
  const getInviteForUser = useCallback(
    (userId: string): ChallengeInvite | undefined => {
      if (!challengeId) return undefined;
      return filteredSentInvites.find(
        (inv) => inv.invited_user_id === userId && inv.status === "pending"
      );
    },
    [challengeId, filteredSentInvites]
  );

  const handleLoadMore = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage) {
      if (debouncedQuery.length >= 2) {
        fetchNextSearchPage();
      } else {
        fetchNextSuggestedPage();
      }
    }
  }, [
    debouncedQuery,
    isFetchingNextPage,
    hasNextPage,
    fetchNextSearchPage,
    fetchNextSuggestedPage
  ]);

  const handleRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    try {
      if (activeTab === "search") {
        // Invalidate both search and suggested queries to force fresh fetch
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: partnersQueryKeys.searchInfinite(debouncedQuery)
          }),
          queryClient.invalidateQueries({
            queryKey: partnersQueryKeys.suggestedInfinite()
          })
        ]);
      } else if (activeTab === "received") {
        await queryClient.invalidateQueries({
          queryKey: challengeInvitesQueryKeys.received()
        });
      } else {
        await queryClient.invalidateQueries({
          queryKey: challengeInvitesQueryKeys.sent()
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

  // Handle cancel invite from user card (in search results)
  // Same pattern as handleCancelRequest in FindPartnerScreen
  const handleCancelInviteForUser = useCallback(
    async (userId: string, pendingInviteId?: string | null) => {
      // Try to get invite from sent list, or use the pendingInviteId from user data
      const invite = getInviteForUser(userId);
      const inviteId = invite?.id || pendingInviteId;

      if (!inviteId) return;

      addProcessingUser(userId);
      try {
        await cancelMutation.mutateAsync(inviteId);
        // No need to show alert - optimistic update handles UI
      } catch (error: any) {
        showAlert({
          title: t("common.error"),
          message: error?.message || t("challenges.cancel_invite_error"),
          variant: "error",
          confirmLabel: t("common.ok")
        });
      } finally {
        removeProcessingUser(userId);
      }
    },
    [getInviteForUser, cancelMutation, showAlert, t, addProcessingUser, removeProcessingUser]
  );

  const handleSendInvite = useCallback(
    async (user: SearchUserResult) => {
      if (!challengeId) {
        showAlert({
          title: t("common.error"),
          message: t("challenges.no_challenge_selected"),
          variant: "error",
          confirmLabel: t("common.ok")
        });
        return;
      }

      // Check if challenge allows invites (status + deadline)
      if (!canSendInvites) {
        showAlert({
          title: t("common.error"),
          message:
            t("challenges.invite_not_allowed") ||
            "Invites are no longer allowed for this challenge",
          variant: "error",
          confirmLabel: t("common.ok")
        });
        return;
      }

      if (hasInvitePending(user.id)) {
        return; // Already invited
      }

      addProcessingUser(user.id);
      try {
        await sendInviteMutation.mutateAsync({
          challengeId,
          userId: user.id,
          userInfo: {
            name: user.name,
            username: user.username,
            profile_picture_url: user.profile_picture_url
          },
          challengeInfo: {
            title: challenge?.title
          }
        });
        // No need to refresh - optimistic update handles button state
      } catch (error: any) {
        showAlert({
          title: t("common.error"),
          message: error?.message || t("challenges.send_invite_error"),
          variant: "error",
          confirmLabel: t("common.ok")
        });
      } finally {
        removeProcessingUser(user.id);
      }
    },
    [
      challengeId,
      challenge,
      canSendInvites,
      hasInvitePending,
      sendInviteMutation,
      showAlert,
      t,
      addProcessingUser,
      removeProcessingUser
    ]
  );

  const handleAcceptInvite = useCallback(
    async (invite: ChallengeInvite) => {
      // Check if challenge is still joinable
      const challengeStatus = invite.challenge?.status;
      if (challengeStatus && !["active", "upcoming"].includes(challengeStatus)) {
        showAlert({
          title: t("common.error"),
          message:
            t("challenges.invite_challenge_ended") || "This challenge is no longer available",
          variant: "error",
          confirmLabel: t("common.ok")
        });
        return;
      }

      addProcessingUser(invite.id);
      try {
        await acceptMutation.mutateAsync(invite.id);
        // No need to show alert - optimistic update handles UI
      } catch (error: any) {
        showAlert({
          title: t("common.error"),
          message: error?.message || t("challenges.accept_invite_error"),
          variant: "error",
          confirmLabel: t("common.ok")
        });
      } finally {
        removeProcessingUser(invite.id);
      }
    },
    [acceptMutation, showAlert, t, addProcessingUser, removeProcessingUser]
  );

  const handleDeclineInvite = useCallback(
    async (invite: ChallengeInvite) => {
      addProcessingUser(invite.id);
      try {
        await declineMutation.mutateAsync(invite.id);
        // No need to show alert - optimistic update handles UI
      } catch (error: any) {
        showAlert({
          title: t("common.error"),
          message: error?.message || t("challenges.decline_invite_error"),
          variant: "error",
          confirmLabel: t("common.ok")
        });
      } finally {
        removeProcessingUser(invite.id);
      }
    },
    [declineMutation, showAlert, t, addProcessingUser, removeProcessingUser]
  );

  const handleCancelInvite = useCallback(
    async (invite: ChallengeInvite) => {
      addProcessingUser(invite.id);
      try {
        await cancelMutation.mutateAsync(invite.id);
        // No need to show alert - optimistic update handles UI
      } catch (error: any) {
        showAlert({
          title: t("common.error"),
          message: error?.message || t("challenges.cancel_invite_error"),
          variant: "error",
          confirmLabel: t("common.ok")
        });
      } finally {
        removeProcessingUser(invite.id);
      }
    },
    [cancelMutation, showAlert, t, addProcessingUser, removeProcessingUser]
  );

  const handleViewChallenge = useCallback(
    (id: string) => {
      router.push(MOBILE_ROUTES.CHALLENGES.DETAILS(id));
    },
    [router]
  );

  const formatDate = useCallback((dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    });
  }, []);

  const renderUserCard = useCallback(
    ({ item }: { item: SearchUserResult }) => {
      const isProcessing = processingUsers.has(item.id);
      // Check challenge_invite_status from user data (same pattern as FindPartnerScreen uses request_status)
      const challengeInviteStatus = (item as any).challenge_invite_status || "none";
      const pendingChallengeInviteId = (item as any).pending_challenge_invite_id || null;
      const alreadyInvited = challengeInviteStatus === "sent" || hasInvitePending(item.id);
      const displayName = item.name || item.username || t("common.user");

      // Render action button based on invite status (same pattern as FindPartnerScreen)
      const renderActionButton = () => {
        if (alreadyInvited) {
          // Already invited - show "Requested" button that can be cancelled
          return (
            <TouchableOpacity
              style={styles.requestedButton}
              onPress={() => handleCancelInviteForUser(item.id, pendingChallengeInviteId)}
              disabled={isProcessing}
              activeOpacity={0.7}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={colors.text.tertiary} />
              ) : (
                <>
                  <Ionicons name="time-outline" size={14} color={colors.text.tertiary} />
                  <Text style={styles.requestedButtonText}>{t("challenges.requested")}</Text>
                </>
              )}
            </TouchableOpacity>
          );
        }

        // No invite - show "Invite" button
        const isButtonDisabled = isProcessing || !challengeId || !canSendInvites;
        return (
          <TouchableOpacity
            style={[styles.addButton, isButtonDisabled && { opacity: 0.5 }]}
            onPress={() => handleSendInvite(item)}
            disabled={isButtonDisabled}
            activeOpacity={0.7}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={brandColors.primary} />
            ) : (
              <>
                <Ionicons
                  name="person-add"
                  size={16}
                  color={!isButtonDisabled ? brandColors.primary : colors.text.tertiary}
                />
                <Text
                  style={[
                    styles.addButtonText,
                    isButtonDisabled && { color: colors.text.tertiary }
                  ]}
                >
                  {t("challenges.invite")}
                </Text>
              </>
            )}
          </TouchableOpacity>
        );
      };

      return (
        <Card style={styles.userCard}>
          <View style={styles.userRow}>
            {/* Avatar */}
            <View style={styles.avatarContainer}>
              <View style={[styles.avatarPlaceholder, { backgroundColor: brandColors.primary }]}>
                <Text style={styles.avatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
              </View>
            </View>

            {/* User Info */}
            <View style={styles.userInfo}>
              {item.username && (
                <Text style={styles.userUsername} numberOfLines={1}>
                  @{item.username}
                </Text>
              )}
              <Text style={styles.userName} numberOfLines={1}>
                {item.name || (item.username ? "" : t("common.user"))}
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
      challengeId,
      canSendInvites,
      handleSendInvite,
      handleCancelInviteForUser,
      hasInvitePending,
      processingUsers,
      styles,
      t
    ]
  );

  const renderReceivedInviteCard = useCallback(
    ({ item: invite }: { item: ChallengeInvite }) => {
      const isProcessing = processingUsers.has(invite.id);
      const inviterName = invite.inviter?.name || invite.inviter?.username || t("common.user");

      return (
        <Card style={styles.inviteCard}>
          <TouchableOpacity
            onPress={() => invite.challenge_id && handleViewChallenge(invite.challenge_id)}
            activeOpacity={0.7}
          >
            <View style={styles.inviteHeader}>
              <View style={[styles.iconContainer, { backgroundColor: `${brandColors.primary}15` }]}>
                <Ionicons name="trophy" size={22} color={brandColors.primary} />
              </View>
              <View style={styles.inviteInfo}>
                <Text style={styles.challengeTitle} numberOfLines={2}>
                  {invite.challenge?.title || t("challenges.title")}
                </Text>
                <Text style={styles.inviterText}>
                  {t("challenges.invited_by", { name: inviterName })}
                </Text>
                {invite.challenge?.start_date && (
                  <Text style={styles.dateText}>
                    {t("challenges.starts")} {formatDate(invite.challenge.start_date)}
                  </Text>
                )}
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => handleAcceptInvite(invite)}
              disabled={isProcessing}
              activeOpacity={0.7}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  <Text style={styles.acceptButtonText}>{t("common.accept")}</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.declineButton}
              onPress={() => handleDeclineInvite(invite)}
              disabled={isProcessing}
              activeOpacity={0.7}
            >
              <Text style={styles.declineButtonText}>{t("common.decline")}</Text>
            </TouchableOpacity>
          </View>
        </Card>
      );
    },
    [
      brandColors,
      colors,
      formatDate,
      handleAcceptInvite,
      handleDeclineInvite,
      handleViewChallenge,
      processingUsers,
      styles,
      t
    ]
  );

  const renderSentInviteCard = useCallback(
    ({ item: invite }: { item: ChallengeInvite }) => {
      const isProcessing = processingUsers.has(invite.id);
      const inviteeName = invite.invitee?.name || invite.invitee?.username || t("common.user");

      return (
        <Card style={styles.inviteCard}>
          <TouchableOpacity
            onPress={() => invite.challenge_id && handleViewChallenge(invite.challenge_id)}
            activeOpacity={0.7}
          >
            <View style={styles.inviteHeader}>
              <View style={[styles.iconContainer, { backgroundColor: `${brandColors.primary}15` }]}>
                <Ionicons name="trophy" size={22} color={brandColors.primary} />
              </View>
              <View style={styles.inviteInfo}>
                <Text style={styles.challengeTitle} numberOfLines={2}>
                  {invite.challenge?.title || t("challenges.title")}
                </Text>
                <Text style={styles.inviterText}>
                  {t("challenges.invited_user", { name: inviteeName })}
                </Text>
                {invite.challenge?.start_date && (
                  <Text style={styles.dateText}>
                    {t("challenges.starts")} {formatDate(invite.challenge.start_date)}
                  </Text>
                )}
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.cancelRequestButton}
              onPress={() => handleCancelInvite(invite)}
              disabled={isProcessing}
              activeOpacity={0.7}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={colors.feedback.error} />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={16} color={colors.feedback.error} />
                  <Text style={styles.cancelRequestButtonText}>
                    {t("challenges.cancel_request")}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Card>
      );
    },
    [
      brandColors,
      colors,
      formatDate,
      handleCancelInvite,
      handleViewChallenge,
      processingUsers,
      styles,
      t
    ]
  );

  const renderEmptyState = useCallback(() => {
    if (activeTab === "search") {
      // Typing but less than 2 chars
      if (debouncedQuery.length < 2 && debouncedQuery.length > 0) {
        return (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="search" size={48} color={colors.text.tertiary} />
            </View>
            <Text style={styles.emptyTitle}>{t("challenges.search_users_title")}</Text>
            <Text style={styles.emptyDescription}>{t("challenges.search_users_description")}</Text>
          </View>
        );
      }

      if (isLoading) {
        return null;
      }

      // Searched but no results
      if (debouncedQuery.length >= 2) {
        return (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="person-outline" size={48} color={colors.text.tertiary} />
            </View>
            <Text style={styles.emptyTitle}>{t("challenges.no_users_to_invite")}</Text>
            <Text style={styles.emptyDescription}>{t("challenges.no_users_to_invite_desc")}</Text>
          </View>
        );
      }

      // No search query - showing suggestions (empty)
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="people-outline" size={48} color={colors.text.tertiary} />
          </View>
          <Text style={styles.emptyTitle}>{t("challenges.no_suggestions_challenge")}</Text>
          <Text style={styles.emptyDescription}>
            {t("challenges.no_suggestions_challenge_desc")}
          </Text>
        </View>
      );
    }

    if (activeTab === "received") {
      if (isLoadingReceived) return null;
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="mail-open-outline" size={48} color={colors.text.tertiary} />
          </View>
          <Text style={styles.emptyTitle}>{t("challenges.no_received_invites")}</Text>
          <Text style={styles.emptyDescription}>{t("challenges.no_received_invites_desc")}</Text>
        </View>
      );
    }

    // Pending tab
    if (isLoadingSent) return null;
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconContainer}>
          <Ionicons name="time-outline" size={48} color={colors.text.tertiary} />
        </View>
        <Text style={styles.emptyTitle}>{t("challenges.no_pending_requests")}</Text>
        <Text style={styles.emptyDescription}>{t("challenges.no_pending_requests_desc")}</Text>
      </View>
    );
  }, [activeTab, debouncedQuery, isLoading, isLoadingReceived, isLoadingSent, colors, styles, t]);

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
              <SkeletonBox width={80} height={12} borderRadius={4} style={{ marginTop: 4 }} />
            </View>
            <SkeletonBox width={60} height={32} borderRadius={16} />
          </View>
        ))}
      </View>
    ),
    [styles]
  );

  // Show skeleton loading for initial load
  const showSkeleton =
    isLoading &&
    activeTab === "search" &&
    (debouncedQuery.length >= 2 || debouncedQuery.length === 0);

  // Get current list data based on tab
  const getListData = () => {
    if (activeTab === "search") return currentUsers;
    if (activeTab === "received") return receivedInvites;
    return filteredSentInvites;
  };

  const getRenderItem = () => {
    if (activeTab === "search") return renderUserCard;
    if (activeTab === "received") return renderReceivedInviteCard;
    return renderSentInviteCard;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <BackButton
        title={challenge?.title || t("challenges.invite_to_challenge")}
        onPress={() => router.back()}
      />

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <Tabs
          tabs={tabs}
          selectedId={activeTab}
          onChange={(id) => setActiveTab(id as RequestTab)}
          variant="underline"
          fullWidth
        />
      </View>

      {/* Warning Banner when invites not allowed */}
      {activeTab === "search" && challengeId && !canSendInvites && challenge && (
        <View style={styles.warningBanner}>
          <Ionicons name="warning-outline" size={18} color={colors.feedback.warning} />
          <Text style={styles.warningText}>
            {challenge.status === "completed" || challenge.status === "cancelled"
              ? t("challenges.invite_disabled_ended") || "This challenge has ended"
              : t("challenges.invite_disabled_deadline") || "Join deadline has passed"}
          </Text>
        </View>
      )}

      {/* Search Bar (only in search tab) */}
      {activeTab === "search" && (
        <View style={styles.searchContainer}>
          <SearchBar
            value={searchQuery}
            onChangeText={handleSearchChange}
            placeholder={t("challenges.search_users_placeholder")}
          />
        </View>
      )}

      {/* Content - wrapped in flex container to keep button at bottom */}
      <View style={styles.contentWrapper}>
        {showSkeleton ? (
          renderSkeleton()
        ) : (
          <FlatList
            data={getListData()}
            renderItem={getRenderItem() as any}
            keyExtractor={(item: any) => item.id}
            contentContainerStyle={[
              styles.listContent,
              getListData().length === 0 && styles.emptyListContent
            ]}
            showsVerticalScrollIndicator={false}
            onEndReached={activeTab === "search" ? handleLoadMore : undefined}
            onEndReachedThreshold={0.3}
            ListEmptyComponent={renderEmptyState}
            ListFooterComponent={activeTab === "search" ? renderFooter : null}
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
  warningBanner: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    marginHorizontal: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    backgroundColor: `${colors.feedback.warning}15`,
    borderRadius: toRN(tokens.borderRadius.md),
    borderWidth: 1,
    borderColor: `${colors.feedback.warning}30`
  },
  warningText: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.feedback.warning
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
  emptyListContent: {
    flex: 1
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
    marginRight: toRN(tokens.spacing[3])
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  avatarInitial: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: "#fff"
  },
  userInfo: {
    flex: 1,
    marginRight: toRN(tokens.spacing[3])
  },
  userName: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  userUsername: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    marginTop: toRN(tokens.spacing[0.5])
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
  invitedBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[2]),
    backgroundColor: `${colors.feedback.success}15`,
    borderRadius: toRN(tokens.borderRadius.full),
    gap: toRN(tokens.spacing[1])
  },
  invitedBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.feedback.success
  },

  // Invite Card
  inviteCard: {
    padding: toRN(tokens.spacing[4])
  },
  inviteHeader: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: toRN(tokens.borderRadius.lg),
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginRight: toRN(tokens.spacing[3])
  },
  inviteInfo: {
    flex: 1,
    marginRight: toRN(tokens.spacing[3])
  },
  challengeTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: 2
  },
  inviterText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    marginBottom: 2
  },
  dateText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },
  inviteeName: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  challengeSubtitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    marginTop: 2
  },
  pendingBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
    marginTop: toRN(tokens.spacing[1])
  },
  pendingBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary
  },

  // Action Buttons
  actionButtons: {
    flexDirection: "row" as const,
    gap: toRN(tokens.spacing[2]),
    marginTop: toRN(tokens.spacing[3])
  },
  acceptButton: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
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
  declineButton: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.full)
  },
  declineButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary
  },
  cancelRequestButton: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    backgroundColor: `${colors.feedback.error}15`,
    borderRadius: toRN(tokens.borderRadius.full),
    gap: toRN(tokens.spacing[1])
  },
  cancelRequestButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.feedback.error
  },
  cancelButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${colors.feedback.error}15`,
    alignItems: "center" as const,
    justifyContent: "center" as const
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
    padding: toRN(tokens.spacing[4]),
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.lg),
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
    borderTopColor: colors.border.default
  }
});

export default ChallengeRequestScreen;
