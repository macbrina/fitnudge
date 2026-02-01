import React, { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from "react-native";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { Card } from "@/components/ui/Card";
import { BackButton } from "@/components/ui/BackButton";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { MOBILE_ROUTES } from "@/lib/routes";
import { useNudges, useMarkNudgeRead, useMarkAllNudgesRead } from "@/hooks/api/useNudges";
import { usePartnerAccess } from "@/hooks/api/usePartners";
import { Nudge } from "@/services/api/nudges";
import { formatTimeAgo } from "@/utils/helper";
import Button from "@/components/ui/Button";
import { NudgeIcon, NudgeEmojiType, NUDGE_EMOJI_LIST } from "@/components/icons/NudgeIcons";
import { CARD_PADDING_VALUES } from "@/constants/general";

const NUDGE_TYPE_CONFIG = {
  nudge: {
    icon: "hand-left-outline" as keyof typeof Ionicons.glyphMap,
    color: "#3B82F6",
    label: "Nudge"
  },
  cheer: {
    icon: "heart" as keyof typeof Ionicons.glyphMap,
    color: "#F59E0B",
    label: "Cheer"
  },
  milestone: {
    icon: "trophy-outline" as keyof typeof Ionicons.glyphMap,
    color: "#10B981",
    label: "Milestone"
  },
  competitive: {
    icon: "flame" as keyof typeof Ionicons.glyphMap,
    color: "#EF4444",
    label: "Challenge"
  },
  custom: {
    icon: "chatbubble-outline" as keyof typeof Ionicons.glyphMap,
    color: "#8B5CF6",
    label: "Message"
  }
};

export const ActivityScreen: React.FC = () => {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const [isRefreshing, setIsRefreshing] = useState(false);

  // React Query hooks
  const { data: nudgesData, isLoading, refetch } = useNudges();
  const markReadMutation = useMarkNudgeRead();
  const markAllReadMutation = useMarkAllNudgesRead();

  const nudges: Nudge[] = nudgesData?.data || [];

  // Subscription check - use unified hook for consistency
  const { hasFeature: hasPartnerFeature, openSubscriptionModal } = usePartnerAccess();
  const hasAccess = hasPartnerFeature || nudges.length > 0;

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

    // Navigate ONLY if there's a specific goal to view
    // If no goal, just mark as read - user already sees the message here
    if (nudge.goal_id) {
      router.push(`${MOBILE_ROUTES.GOALS.DETAILS}?id=${nudge.goal_id}`);
    }
    // No redirect for general nudges without goal context
  };

  // Check if emoji is a valid NudgeIcon emoji type
  const isValidNudgeEmoji = (emoji: string | undefined): emoji is NudgeEmojiType => {
    return !!emoji && NUDGE_EMOJI_LIST.includes(emoji as NudgeEmojiType);
  };

  const renderNudgeItem = ({ item }: { item: Nudge }) => {
    const config = NUDGE_TYPE_CONFIG[item.nudge_type];
    const timeAgo = formatTimeAgo(item.created_at, { addSuffix: true });
    const hasNudgeEmoji = isValidNudgeEmoji(item.emoji);

    return (
      <TouchableOpacity onPress={() => handleNudgePress(item)} activeOpacity={0.7}>
        <Card style={[styles.nudgeCard, !item.is_read && styles.nudgeCardUnread]}>
          <View style={styles.nudgeRow}>
            {/* Icon - show NudgeIcon if valid emoji, otherwise fallback to Ionicons */}
            <View style={[styles.iconContainer, { backgroundColor: `${config.color}15` }]}>
              {hasNudgeEmoji ? (
                <NudgeIcon emoji={item.emoji as NudgeEmojiType} size={24} />
              ) : (
                <Ionicons name={config.icon} size={20} color={config.color} />
              )}
            </View>

            {/* Content */}
            <View style={styles.nudgeContent}>
              <View style={styles.nudgeHeader}>
                <Text style={styles.senderName}>{item.sender?.name || "Someone"}</Text>
                <Text style={styles.timeAgo}>{timeAgo}</Text>
              </View>
              <Text style={styles.nudgeMessage}>
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
      <Text style={styles.emptyTitle}>{t("activity.empty_title") || "No activity yet"}</Text>
      <Text style={styles.emptyDescription}>
        {t("activity.empty_description") ||
          "When your partners send you nudges or cheers, they'll appear here."}
      </Text>
    </View>
  );

  const renderPremiumGate = () => (
    <View style={styles.premiumGate}>
      <View style={styles.premiumIconContainer}>
        <Ionicons name="notifications" size={48} color={brandColors.primary} />
      </View>
      <Text style={styles.premiumTitle}>{t("activity.premium_title") || "Partner Activity"}</Text>
      <Text style={styles.premiumDescription}>
        {t("activity.premium_description") ||
          "See nudges and cheers from your accountability partners. Connect with partners to stay motivated together!"}
      </Text>
      <Button
        title={t("common.upgrade") || "Upgrade to Unlock"}
        onPress={openSubscriptionModal}
        style={styles.upgradeButton}
      />
    </View>
  );

  const unreadCount = nudges.filter((n) => !n.is_read).length;

  // Show premium gate if no access (no feature AND no existing nudges)
  if (!isLoading && !hasAccess) {
    return (
      <View style={styles.container}>
        <BackButton
          title={t("activity.title") || "Partner Activity"}
          onPress={() => router.back()}
        />
        {renderPremiumGate()}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <BackButton title={t("activity.title") || "Partner Activity"} onPress={() => router.back()} />

      {/* Mark All Read Header */}
      {nudges.length > 0 && unreadCount > 0 && (
        <View style={styles.actionHeader}>
          <Text style={styles.unreadLabel}>
            {t("activity.unread_count", { count: unreadCount }) || `${unreadCount} unread`}
          </Text>
          <TouchableOpacity onPress={handleMarkAllRead} disabled={markAllReadMutation.isPending}>
            <Text style={styles.markAllRead}>{t("activity.mark_all_read") || "Mark all read"}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Loading State */}
      {isLoading ? (
        <View style={styles.listContent}>
          {[1, 2, 3, 4].map((i) => (
            <SkeletonBox
              key={i}
              width="100%"
              height={75}
              borderRadius={toRN(tokens.borderRadius.xl)}
              inner
              innerPadding={CARD_PADDING_VALUES.SM}
              style={styles.nudgeSkeleton}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  padding: toRN(tokens.spacing[2])
                }}
              >
                <SkeletonBox width={40} height={40} borderRadius={20} />
                <View style={{ flex: 1, gap: 6 }}>
                  <SkeletonBox width="70%" height={14} borderRadius={4} />
                  <SkeletonBox width="50%" height={12} borderRadius={4} />
                </View>
                <SkeletonBox width={40} height={12} borderRadius={4} />
              </View>
            </SkeletonBox>
          ))}
        </View>
      ) : (
        <FlatList
          data={nudges}
          renderItem={renderNudgeItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={brandColors.primary}
            />
          }
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

function getDefaultMessage(type: Nudge["nudge_type"]): string {
  const messages = {
    nudge: "sent you a nudge!",
    cheer: "cheered for you!",
    milestone: "celebrated your milestone!",
    competitive: "sent a competitive nudge!",
    custom: "sent you a message"
  };
  return messages[type];
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  nudgeSkeleton: {
    marginBottom: toRN(tokens.spacing[3]),
    padding: toRN(tokens.spacing[4])
  },
  actionHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[3]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    backgroundColor: colors.bg.card
  },
  unreadLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary
  },
  markAllRead: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: brand.primary
  },
  listContent: {
    padding: toRN(tokens.spacing[4]),
    flexGrow: 1
  },
  nudgeCard: {
    marginBottom: toRN(tokens.spacing[2]),
    padding: toRN(tokens.spacing[4])
  },
  nudgeCardUnread: {
    backgroundColor: `${brand.primary}08`,
    borderLeftWidth: 3,
    borderLeftColor: brand.primary
  },
  nudgeRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginRight: toRN(tokens.spacing[3])
  },
  nudgeContent: {
    flex: 1
  },
  nudgeHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[1])
  },
  senderName: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  timeAgo: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },
  nudgeMessage: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: brand.primary,
    marginLeft: toRN(tokens.spacing[2])
  },
  emptyState: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[8])
  },
  emptyIcon: {
    marginBottom: toRN(tokens.spacing[4])
  },
  emptyTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[2])
  },
  emptyDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    maxWidth: 280
  },
  // Premium gate styles
  premiumGate: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[6])
  },
  premiumIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${brand.primary}15`,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: toRN(tokens.spacing[4])
  },
  premiumTitle: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[2])
  },
  premiumDescription: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    lineHeight: toRN(tokens.typography.fontSize.base) * 1.5,
    marginBottom: toRN(tokens.spacing[6]),
    maxWidth: 300
  },
  upgradeButton: {
    minWidth: 200
  }
});

export default ActivityScreen;
