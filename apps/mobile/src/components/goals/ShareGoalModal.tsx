import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { toRN } from "@/lib/units";
import { useStyles, useTheme } from "@/themes";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export type PermissionLevel = "view" | "comment" | "motivate";

interface User {
  id: string;
  name: string;
  username?: string;
  profile_picture_url?: string;
}

interface ShareGoalModalProps {
  visible: boolean;
  goalId: string;
  goalTitle: string;
  onClose: () => void;
  onShare: (userId: string, permissionLevel: PermissionLevel) => Promise<void>;
  searchUsers: (query: string) => Promise<User[]>;
  currentShares?: Array<{ userId: string; permissionLevel: PermissionLevel }>;
}

const PERMISSION_OPTIONS: {
  value: PermissionLevel;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    value: "view",
    label: "View",
    description: "Can see your progress",
    icon: "eye-outline",
  },
  {
    value: "comment",
    label: "Comment",
    description: "Can view and comment",
    icon: "chatbubble-outline",
  },
  {
    value: "motivate",
    label: "Motivate",
    description: "Can view, comment, and send motivation",
    icon: "heart-outline",
  },
];

export function ShareGoalModal({
  visible,
  goalId,
  goalTitle,
  onClose,
  onShare,
  searchUsers,
  currentShares = [],
}: ShareGoalModalProps) {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedPermission, setSelectedPermission] =
    useState<PermissionLevel>("view");
  const [isSearching, setIsSearching] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // Search for users when query changes
  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        setIsSearching(true);
        try {
          const results = await searchUsers(searchQuery);
          // Filter out users who already have access
          const alreadyShared = currentShares.map((s) => s.userId);
          setSearchResults(
            results.filter((u) => !alreadyShared.includes(u.id))
          );
        } catch (error) {
          console.error("Search failed:", error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [searchQuery, searchUsers, currentShares]);

  const handleShare = async () => {
    if (!selectedUser) return;

    setIsSharing(true);
    try {
      await onShare(selectedUser.id, selectedPermission);
      await showAlert({
        title: t("goals.share_success_title"),
        message: t("goals.share_success_message", { name: selectedUser.name }),
        variant: "success",
        confirmLabel: t("common.ok"),
      });
      // Reset state
      setSelectedUser(null);
      setSearchQuery("");
      setSearchResults([]);
      setSelectedPermission("view");
      onClose();
    } catch (error: any) {
      await showAlert({
        title: t("common.error"),
        message: error?.message || t("goals.share_error"),
        variant: "error",
        confirmLabel: t("common.ok"),
      });
    } finally {
      setIsSharing(false);
    }
  };

  const renderUserItem = ({ item }: { item: User }) => {
    const isSelected = selectedUser?.id === item.id;

    return (
      <TouchableOpacity
        style={[styles.userItem, isSelected && styles.userItemSelected]}
        onPress={() => setSelectedUser(item)}
      >
        <View style={styles.userAvatar}>
          {item.profile_picture_url ? (
            <Text style={styles.userAvatarText}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          ) : (
            <Text style={styles.userAvatarText}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          {item.username && (
            <Text style={styles.userUsername}>@{item.username}</Text>
          )}
        </View>
        {isSelected && (
          <Ionicons
            name="checkmark-circle"
            size={24}
            color={brandColors.primary}
          />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} onClose={onClose} title={t("goals.share_goal")}>
      <View style={styles.container}>
        {/* Goal being shared */}
        <View style={styles.goalInfo}>
          <Ionicons
            name="share-social-outline"
            size={20}
            color={colors.text.secondary}
          />
          <Text style={styles.goalTitle} numberOfLines={1}>
            {goalTitle}
          </Text>
        </View>

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
            placeholder={t("goals.search_friends_placeholder")}
            placeholderTextColor={colors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {isSearching && (
            <ActivityIndicator size="small" color={brandColors.primary} />
          )}
        </View>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <FlatList
            data={searchResults}
            renderItem={renderUserItem}
            keyExtractor={(item) => item.id}
            style={styles.userList}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* No results message */}
        {searchQuery.length >= 2 &&
          !isSearching &&
          searchResults.length === 0 && (
            <View style={styles.noResults}>
              <Text style={styles.noResultsText}>
                {t("goals.no_users_found")}
              </Text>
            </View>
          )}

        {/* Permission Selection (show when user is selected) */}
        {selectedUser && (
          <View style={styles.permissionSection}>
            <Text style={styles.sectionTitle}>
              {t("goals.permission_level")}
            </Text>
            {PERMISSION_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.permissionOption,
                  selectedPermission === option.value &&
                    styles.permissionOptionSelected,
                ]}
                onPress={() => setSelectedPermission(option.value)}
              >
                <Ionicons
                  name={option.icon}
                  size={20}
                  color={
                    selectedPermission === option.value
                      ? brandColors.primary
                      : colors.text.secondary
                  }
                />
                <View style={styles.permissionInfo}>
                  <Text
                    style={[
                      styles.permissionLabel,
                      selectedPermission === option.value &&
                        styles.permissionLabelSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text style={styles.permissionDescription}>
                    {option.description}
                  </Text>
                </View>
                {selectedPermission === option.value && (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={brandColors.primary}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Share Button */}
        <View style={styles.buttonContainer}>
          <Button
            title={isSharing ? t("common.sharing") : t("goals.share_with_user")}
            onPress={handleShare}
            disabled={!selectedUser || isSharing}
            loading={isSharing}
          />
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[4]),
  },
  goalInfo: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    padding: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.md),
    marginBottom: toRN(tokens.spacing[4]),
  },
  goalTitle: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.primary,
  },
  searchContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.md),
    paddingHorizontal: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[3]),
  },
  searchIcon: {
    marginRight: toRN(tokens.spacing[2]),
  },
  searchInput: {
    flex: 1,
    height: toRN(44),
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.primary,
  },
  userList: {
    maxHeight: toRN(200),
    marginBottom: toRN(tokens.spacing[3]),
  },
  userItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    padding: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.md),
    marginBottom: toRN(tokens.spacing[2]),
    backgroundColor: colors.bg.surface,
  },
  userItemSelected: {
    backgroundColor: `${brand.primary}15`,
    borderWidth: 1,
    borderColor: brand.primary,
  },
  userAvatar: {
    width: toRN(40),
    height: toRN(40),
    borderRadius: toRN(20),
    backgroundColor: brand.primary,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginRight: toRN(tokens.spacing[3]),
  },
  userAvatarText: {
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
  noResults: {
    padding: toRN(tokens.spacing[4]),
    alignItems: "center" as const,
  },
  noResultsText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
  },
  permissionSection: {
    marginBottom: toRN(tokens.spacing[4]),
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.secondary,
    marginBottom: toRN(tokens.spacing[2]),
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  permissionOption: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    padding: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.md),
    marginBottom: toRN(tokens.spacing[2]),
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  permissionOptionSelected: {
    backgroundColor: `${brand.primary}15`,
    borderColor: brand.primary,
  },
  permissionInfo: {
    flex: 1,
    marginLeft: toRN(tokens.spacing[3]),
  },
  permissionLabel: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.primary,
  },
  permissionLabelSelected: {
    color: brand.primary,
  },
  permissionDescription: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
  },
  buttonContainer: {
    marginTop: toRN(tokens.spacing[2]),
  },
});
