import { Card } from "@/components/ui/Card";
import { useAlertModal } from "@/contexts/AlertModalContext";
import {
  useSearchPartners,
  useSendPartnerRequest,
} from "@/hooks/api/usePartners";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { toRN } from "@/lib/units";
import { SearchUserResult } from "@/services/api/partners";
import { useStyles, useTheme } from "@/themes";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export const PartnerRequestScreen: React.FC = () => {
  const router = useRouter();
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const { showAlert, showConfirm } = useAlertModal();

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);

  // Debounced search query
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Use React Query for search
  const {
    data: searchData,
    isLoading: isSearching,
    refetch: refetchSearch,
  } = useSearchPartners(debouncedQuery);

  const searchResults = searchData?.data || [];

  // Send partner request mutation
  const sendRequestMutation = useSendPartnerRequest();

  const handleSendRequest = async (user: SearchUserResult) => {
    const userName = user.name || user.username || "User";

    if (user.is_partner) {
      showAlert({
        title: t("social.already_partner_title"),
        message: t("social.already_partner_message", { name: userName }),
        variant: "info",
        confirmLabel: t("common.ok"),
      });
      return;
    }

    if (user.has_pending_request) {
      showAlert({
        title: t("social.request_pending_title"),
        message: t("social.request_pending_message", { name: userName }),
        variant: "info",
        confirmLabel: t("common.ok"),
      });
      return;
    }

    const confirmed = await showConfirm({
      title: t("social.send_partner_request_title"),
      message: t("social.send_partner_request_message", { name: userName }),
      variant: "info",
      confirmLabel: t("social.send_request"),
      cancelLabel: t("common.cancel"),
    });

    if (confirmed) {
      setSendingRequest(user.id);
      try {
        await sendRequestMutation.mutateAsync({
          partner_user_id: user.id,
        });

        // Refetch search results to update the pending state
        refetchSearch();

        showAlert({
          title: t("social.request_sent_title"),
          message: t("social.request_sent_message", { name: userName }),
          variant: "success",
          confirmLabel: t("common.ok"),
        });
      } catch (error) {
        showAlert({
          title: t("common.error"),
          message: t("social.send_request_error"),
          variant: "error",
          confirmLabel: t("common.ok"),
        });
      } finally {
        setSendingRequest(null);
      }
    }
  };

  const renderUserItem = ({ item }: { item: SearchUserResult }) => {
    const isSending = sendingRequest === item.id;
    const displayName = item.name || item.username || "User";

    return (
      <Card style={styles.userCard}>
        <View style={styles.userRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{displayName}</Text>
            {item.username && (
              <Text style={styles.userUsername}>@{item.username}</Text>
            )}
          </View>
          {item.is_partner ? (
            <View style={styles.partnerBadge}>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={brandColors.primary}
              />
              <Text style={styles.partnerBadgeText}>{t("social.partner")}</Text>
            </View>
          ) : item.has_pending_request ? (
            <View style={styles.pendingBadge}>
              <Ionicons
                name="time-outline"
                size={16}
                color={colors.text.tertiary}
              />
              <Text style={styles.pendingBadgeText}>{t("social.pending")}</Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => handleSendRequest(item)}
              style={styles.addButton}
              disabled={isSending}
            >
              {isSending ? (
                <ActivityIndicator size="small" color={brandColors.primary} />
              ) : (
                <Ionicons
                  name="person-add"
                  size={20}
                  color={brandColors.primary}
                />
              )}
            </TouchableOpacity>
          )}
        </View>
      </Card>
    );
  };

  const renderEmptyState = () => {
    if (searchQuery.length < 2) {
      return (
        <View style={styles.emptyState}>
          <Ionicons
            name="search-outline"
            size={48}
            color={colors.text.tertiary}
            style={styles.emptyIcon}
          />
          <Text style={styles.emptyTitle}>
            {t("social.search_for_friends")}
          </Text>
          <Text style={styles.emptyDescription}>
            {t("social.search_instructions")}
          </Text>
        </View>
      );
    }

    if (!isSearching && searchResults.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons
            name="person-outline"
            size={48}
            color={colors.text.tertiary}
            style={styles.emptyIcon}
          />
          <Text style={styles.emptyTitle}>{t("social.no_users_found")}</Text>
          <Text style={styles.emptyDescription}>
            {t("social.try_different_search")}
          </Text>
        </View>
      );
    }

    return null;
  };

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search-outline"
          size={20}
          color={colors.text.tertiary}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder={t("social.search_placeholder")}
          placeholderTextColor={colors.text.tertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons
              name="close-circle"
              size={20}
              color={colors.text.tertiary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Search Results */}
      {isSearching ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={brandColors.primary} />
        </View>
      ) : (
        <FlatList
          data={searchResults}
          renderItem={renderUserItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Invite Friends Option */}
      <View style={styles.inviteSection}>
        <TouchableOpacity style={styles.inviteButton}>
          <Ionicons
            name="share-outline"
            size={20}
            color={brandColors.primary}
          />
          <Text style={styles.inviteText}>{t("social.invite_friends")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.default,
  },
  searchContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.lg),
    paddingHorizontal: toRN(tokens.spacing[3]),
    margin: toRN(tokens.spacing[4]),
  },
  searchIcon: {
    marginRight: toRN(tokens.spacing[2]),
  },
  searchInput: {
    flex: 1,
    height: toRN(48),
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  listContent: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    flexGrow: 1,
  },
  userCard: {
    marginBottom: toRN(tokens.spacing[2]),
  },
  userRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  avatar: {
    width: toRN(44),
    height: toRN(44),
    borderRadius: toRN(22),
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
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.primary,
  },
  userUsername: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
  },
  addButton: {
    width: toRN(40),
    height: toRN(40),
    borderRadius: toRN(20),
    backgroundColor: `${brand.primary}15`,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  partnerBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
    paddingVertical: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[2]),
    backgroundColor: `${brand.primary}15`,
    borderRadius: toRN(tokens.borderRadius.full),
  },
  partnerBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: brand.primary,
  },
  pendingBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
    paddingVertical: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[2]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.full),
  },
  pendingBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[8]),
  },
  emptyIcon: {
    marginBottom: toRN(tokens.spacing[3]),
  },
  emptyTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[2]),
    textAlign: "center" as const,
  },
  emptyDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const,
  },
  inviteSection: {
    padding: toRN(tokens.spacing[4]),
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  inviteButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[3]),
    backgroundColor: `${brand.primary}10`,
    borderRadius: toRN(tokens.borderRadius.lg),
  },
  inviteText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: brand.primary,
  },
});

export default PartnerRequestScreen;
