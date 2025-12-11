import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { Card } from "@/components/ui/Card";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  useNudges,
  useMarkNudgeRead,
  useMarkAllNudgesRead,
} from "@/hooks/api/useNudges";
import { Nudge } from "@/services/api/nudges";
import { formatTimeAgo } from "@/utils/helper";

const NUDGE_TYPE_CONFIG = {
  nudge: {
    icon: "hand-left-outline" as keyof typeof Ionicons.glyphMap,
    color: "#3B82F6",
    label: "Nudge",
  },
  cheer: {
    icon: "heart" as keyof typeof Ionicons.glyphMap,
    color: "#F59E0B",
    label: "Cheer",
  },
  milestone: {
    icon: "trophy-outline" as keyof typeof Ionicons.glyphMap,
    color: "#10B981",
    label: "Milestone",
  },
  competitive: {
    icon: "flame" as keyof typeof Ionicons.glyphMap,
    color: "#EF4444",
    label: "Challenge",
  },
  custom: {
    icon: "chatbubble-outline" as keyof typeof Ionicons.glyphMap,
    color: "#8B5CF6",
    label: "Message",
  },
};

export const NudgesScreen: React.FC = () => {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const [isRefreshing, setIsRefreshing] = useState(false);

  // React Query hooks
  const { data: nudgesData, isLoading, refetch } = useNudges();
  const markReadMutation = useMarkNudgeRead();
  const markAllReadMutation = useMarkAllNudgesRead();

  const nudges = nudgesData?.data || [];

  const onRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllReadMutation.mutateAsync();
    } catch (error) {
      console.error("Failed to mark all read:", error);
    }
  };

  const handleNudgePress = async (nudge: Nudge) => {
    // Mark as read if unread
    if (!nudge.is_read) {
      try {
        await markReadMutation.mutateAsync(nudge.id);
      } catch (error) {
        console.error("Failed to mark nudge as read:", error);
      }
    }

    // Navigate based on context
    if (nudge.challenge_id) {
      router.push(`/(user)/challenges/${nudge.challenge_id}`);
    } else if (nudge.goal_id) {
      router.push(`/(user)/(goals)/details?id=${nudge.goal_id}`);
    } else if (nudge.partnership_id) {
      router.push("/(user)/social/partners");
    }
  };

  const renderNudgeItem = ({ item }: { item: Nudge }) => {
    const config = NUDGE_TYPE_CONFIG[item.nudge_type];
    const timeAgo = formatTimeAgo(item.created_at, { addSuffix: true });

    return (
      <TouchableOpacity
        onPress={() => handleNudgePress(item)}
        activeOpacity={0.7}
      >
        <Card
          style={[styles.nudgeCard, !item.is_read && styles.nudgeCardUnread]}
        >
          <View style={styles.nudgeRow}>
            {/* Icon */}
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: `${config.color}15` },
              ]}
            >
              <Ionicons name={config.icon} size={20} color={config.color} />
            </View>

            {/* Content */}
            <View style={styles.nudgeContent}>
              <View style={styles.nudgeHeader}>
                <Text style={styles.senderName}>
                  {item.sender?.name || "Someone"}
                </Text>
                <Text style={styles.timeAgo}>{timeAgo}</Text>
              </View>
              <Text style={styles.nudgeMessage}>
                {item.emoji && `${item.emoji} `}
                {item.message || getDefaultMessage(item.nudge_type)}
              </Text>
            </View>

            {/* Unread indicator */}
            {!item.is_read && <View style={styles.unreadDot} />}
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons
        name="notifications-outline"
        size={64}
        color={colors.text.tertiary}
        style={styles.emptyIcon}
      />
      <Text style={styles.emptyTitle}>{t("social.no_nudges_title")}</Text>
      <Text style={styles.emptyDescription}>
        {t("social.no_nudges_description")}
      </Text>
    </View>
  );

  const unreadCount = nudges.filter((n) => !n.is_read).length;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={brandColors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with Mark All Read */}
      {nudges.length > 0 && unreadCount > 0 && (
        <View style={styles.header}>
          <Text style={styles.unreadLabel}>
            {t("social.unread_nudges", { count: unreadCount })}
          </Text>
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markAllRead}>{t("social.mark_all_read")}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Nudges List */}
      <FlatList
        data={nudges}
        renderItem={renderNudgeItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

function getDefaultMessage(type: Nudge["nudge_type"]): string {
  const messages = {
    nudge: "sent you a nudge!",
    cheer: "cheered for you!",
    milestone: "celebrated your milestone!",
    competitive: "sent a competitive nudge!",
    custom: "sent you a message",
  };
  return messages[type];
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.default,
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
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[3]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  unreadLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
  },
  markAllRead: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: brand.primary,
  },
  listContent: {
    padding: toRN(tokens.spacing[4]),
    flexGrow: 1,
  },
  nudgeCard: {
    marginBottom: toRN(tokens.spacing[2]),
  },
  nudgeCardUnread: {
    backgroundColor: `${brand.primary}08`,
    borderLeftWidth: 3,
    borderLeftColor: brand.primary,
  },
  nudgeRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  iconContainer: {
    width: toRN(40),
    height: toRN(40),
    borderRadius: toRN(20),
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginRight: toRN(tokens.spacing[3]),
  },
  nudgeContent: {
    flex: 1,
  },
  nudgeHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[1]),
  },
  senderName: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
  timeAgo: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
  },
  nudgeMessage: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
  },
  unreadDot: {
    width: toRN(8),
    height: toRN(8),
    borderRadius: toRN(4),
    backgroundColor: brand.primary,
    marginLeft: toRN(tokens.spacing[2]),
  },
  emptyState: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[8]),
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
  },
});

export default NudgesScreen;
