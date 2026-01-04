import React, { useEffect, useMemo, useState } from "react";
import {
  Modal as RNModal,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  Easing,
  StatusBar,
  FlatList,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useChallengeParticipants } from "@/hooks/api/useChallenges";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import type { ChallengeParticipant } from "@/services/api/challenges";

interface ParticipantsModalProps {
  visible: boolean;
  challengeId: string;
  onClose: () => void;
}

export function ParticipantsModal({ visible, challengeId, onClose }: ParticipantsModalProps) {
  const styles = useStyles(makeParticipantsModalStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get("window").height;

  const [searchQuery, setSearchQuery] = useState("");

  // Fetch all participants with user info
  const { data: participantsResponse, isLoading } = useChallengeParticipants(challengeId);

  const participants = participantsResponse?.data || [];

  // Filter and sort participants - higher ranks (lower number) first
  const filteredParticipants = useMemo(() => {
    let result = participants;

    // Filter by search query if provided
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = participants.filter(
        (p) =>
          p.user?.name?.toLowerCase().includes(query) ||
          p.user?.username?.toLowerCase().includes(query)
      );
    }

    // Sort: ranked participants first (by rank ascending), then unranked
    return [...result].sort((a, b) => {
      // If both have ranks, sort by rank (lower = better)
      if (a.rank && b.rank) {
        return a.rank - b.rank;
      }
      // Ranked participants come before unranked
      if (a.rank && !b.rank) return -1;
      if (!a.rank && b.rank) return 1;
      // Both unranked - sort by points, then by joined_at
      if (a.points !== b.points) {
        return b.points - a.points;
      }
      return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
    });
  }, [participants, searchQuery]);

  // Animation
  const translateY = useMemo(() => new Animated.Value(screenHeight), []);
  const [internalVisible, setInternalVisible] = useState(visible);

  useEffect(() => {
    if (visible) {
      setInternalVisible(true);
      setSearchQuery("");
      Animated.spring(translateY, {
        toValue: 0,
        damping: 20,
        mass: 1,
        stiffness: 120,
        useNativeDriver: true
      }).start();
    } else if (internalVisible) {
      Animated.timing(translateY, {
        toValue: screenHeight,
        duration: 300,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true
      }).start(() => {
        setInternalVisible(false);
      });
    }
  }, [visible, translateY, screenHeight, internalVisible]);

  const getRankBadge = (rank: number | null | undefined) => {
    if (rank === 1) return { emoji: "🥇", color: "#FFD700" };
    if (rank === 2) return { emoji: "🥈", color: "#C0C0C0" };
    if (rank === 3) return { emoji: "🥉", color: "#CD7F32" };
    return null;
  };

  const renderParticipant = ({ item }: { item: ChallengeParticipant }) => {
    const rankBadge = item.rank ? getRankBadge(item.rank) : null;

    return (
      <View style={styles.participantCard}>
        {/* Rank */}
        <View style={styles.rankContainer}>
          {rankBadge ? (
            <Text style={styles.rankEmoji}>{rankBadge.emoji}</Text>
          ) : item.rank ? (
            <Text style={styles.rankNumber}>#{item.rank}</Text>
          ) : (
            <Text style={styles.rankNumber}>-</Text>
          )}
        </View>

        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {item.user?.profile_picture_url ? (
            <Image source={{ uri: item.user.profile_picture_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>
                {item.user?.name?.charAt(0)?.toUpperCase() ||
                  item.user?.username?.charAt(0)?.toUpperCase() ||
                  "?"}
              </Text>
            </View>
          )}
        </View>

        {/* User Info */}
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {item.user?.name || item.user?.username || t("common.user")}
          </Text>
          {item.user?.username && item.user?.name && (
            <Text style={styles.userUsername} numberOfLines={1}>
              @{item.user.username}
            </Text>
          )}
        </View>

        {/* Points */}
        <View style={styles.pointsContainer}>
          <Text style={styles.pointsValue}>{item.points}</Text>
          <Text style={styles.pointsLabel}>{t("challenges.points") || "pts"}</Text>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="people-outline" size={48} color={colors.text.tertiary} />
      <Text style={styles.emptyStateText}>
        {searchQuery
          ? t("challenges.no_participants_found") || "No participants found"
          : t("challenges.no_participants") || "No participants yet"}
      </Text>
    </View>
  );

  const renderLoadingSkeleton = () => (
    <View style={styles.loadingContainer}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <SkeletonBox width={32} height={32} borderRadius={16} />
          <SkeletonBox width={48} height={48} borderRadius={24} />
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonBox width="60%" height={16} borderRadius={4} />
            <SkeletonBox width="40%" height={12} borderRadius={4} />
          </View>
          <SkeletonBox width={40} height={32} borderRadius={8} />
        </View>
      ))}
    </View>
  );

  if (!internalVisible && !visible) {
    return null;
  }

  return (
    <RNModal
      visible={internalVisible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [{ translateY }]
            }
          ]}
        >
          <View
            style={[
              styles.contentContainer,
              {
                paddingTop: insets.top + toRN(tokens.spacing[4]),
                paddingBottom: insets.bottom + toRN(tokens.spacing[4])
              }
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>{t("challenges.participants") || "Participants"}</Text>
              <Text style={styles.subtitle}>
                {participants.length} {t("challenges.participants_joined") || "joined"}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                accessibilityLabel={t("common.close")}
                accessibilityRole="button"
              >
                <Ionicons
                  name="close"
                  size={toRN(tokens.typography.fontSize["2xl"])}
                  color={colors.text.primary}
                />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchContainer}>
              <Ionicons name="search-outline" size={20} color={colors.text.tertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder={t("challenges.search_participants") || "Search participants..."}
                placeholderTextColor={colors.text.tertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={20} color={colors.text.tertiary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Participants List */}
            {isLoading ? (
              renderLoadingSkeleton()
            ) : (
              <FlatList
                data={filteredParticipants}
                renderItem={renderParticipant}
                keyExtractor={(item) => item.user_id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={renderEmptyState}
                keyboardShouldPersistTaps="handled"
              />
            )}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

const makeParticipantsModalStyles = (tokens: any, colors: any, brand: any) => ({
  keyboardView: {
    flex: 1
  },
  modalContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg.canvas
  },
  contentContainer: {
    flex: 1,
    width: "100%"
  },
  header: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[4]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[1])
  },
  subtitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary
  },
  closeButton: {
    position: "absolute" as const,
    top: 0,
    right: toRN(tokens.spacing[4]),
    width: toRN(tokens.spacing[10]),
    height: toRN(tokens.spacing[10]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: colors.bg.muted,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  searchContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.xl),
    marginHorizontal: toRN(tokens.spacing[4]),
    marginVertical: toRN(tokens.spacing[4]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[3]),
    gap: toRN(tokens.spacing[2])
  },
  searchInput: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.primary,
    padding: 0
  },
  listContent: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[6]),
    gap: toRN(tokens.spacing[3])
  },
  participantCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.xl),
    padding: toRN(tokens.spacing[3]),
    gap: toRN(tokens.spacing[3]),
    borderWidth: 1,
    borderColor: colors.border.subtle
  },
  rankContainer: {
    width: 32,
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  rankEmoji: {
    fontSize: 20
  },
  rankNumber: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.bold,
    color: colors.text.secondary
  },
  avatarContainer: {
    width: 48,
    height: 48
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
    backgroundColor: brand.primary + "20",
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  avatarInitial: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: brand.primary
  },
  userInfo: {
    flex: 1,
    gap: toRN(tokens.spacing[0.5])
  },
  userName: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  userUsername: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },
  pointsContainer: {
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[2])
  },
  pointsValue: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: brand.primary
  },
  pointsLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },
  emptyState: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: toRN(tokens.spacing[12]),
    gap: toRN(tokens.spacing[3])
  },
  emptyStateText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const
  },
  loadingContainer: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    gap: toRN(tokens.spacing[3])
  },
  skeletonCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.xl),
    padding: toRN(tokens.spacing[3]),
    gap: toRN(tokens.spacing[3])
  }
});
