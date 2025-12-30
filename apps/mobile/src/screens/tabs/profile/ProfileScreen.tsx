import React from "react";
import { View, Text, ScrollView, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/stores/authStore";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { useTranslation } from "@/lib/i18n";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { MOBILE_ROUTES } from "@/lib/routes";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAlertModal } from "@/contexts/AlertModalContext";
import SubscriptionScreen from "@/screens/onboarding/SubscriptionScreen";
import {
  usePartners,
  usePendingPartnerRequests,
} from "@/hooks/api/usePartners";
import { useNudges } from "@/hooks/api/useNudges";

interface MenuItem {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  route?: string;
  action?: () => void;
  badge?: number;
  premium?: boolean;
}

export default function ProfileScreen() {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { user, logout, isLoggingOut } = useAuthStore();
  const { getPlan, hasFeature } = useSubscriptionStore();
  const { t } = useTranslation();
  const router = useRouter();
  const { showAlert } = useAlertModal();

  // Data for badges
  const { data: partnersData } = usePartners();
  const { data: pendingData } = usePendingPartnerRequests();
  const { data: nudgesData } = useNudges();

  const partnersCount = partnersData?.data?.length || 0;
  const pendingRequestsCount = pendingData?.data?.length || 0;
  const unreadNudgesCount =
    nudgesData?.data?.filter((n) => !n.is_read).length || 0;

  const plan = getPlan();
  const isOnHighestPlan = plan === "elite";
  const [showSubscription, setShowSubscription] = React.useState(false);

  const handleLogout = async () => {
    const success = await logout();
    if (success) {
      router.replace(MOBILE_ROUTES.AUTH.LOGIN);
    }
  };

  const handleLinkingPress = async () => {
    await showAlert({
      title: t("auth.social.coming_soon"),
      message: t("profile.linking_unavailable"),
      variant: "info",
      confirmLabel: t("common.ok"),
    });
  };

  // Menu items organized by sections
  const socialMenuItems: MenuItem[] = [
    {
      id: "partners",
      icon: "people",
      label: t("profile.my_partners") || "My Partners",
      description:
        partnersCount > 0
          ? t("profile.partners_count", { count: partnersCount }) ||
            `${partnersCount} partners`
          : t("profile.find_accountability_partners") ||
            "Find accountability partners",
      route: MOBILE_ROUTES.PROFILE.PARTNERS,
      badge: pendingRequestsCount,
    },
    {
      id: "activity",
      icon: "notifications",
      label: t("profile.partner_activity") || "Partner Activity",
      description:
        t("profile.nudges_and_cheers") || "Nudges and cheers from partners",
      route: MOBILE_ROUTES.PROFILE.ACTIVITY,
      badge: unreadNudgesCount,
    },
  ];

  const insightsMenuItems: MenuItem[] = [
    {
      id: "weekly_recaps",
      icon: "analytics",
      label: t("profile.weekly_recaps") || "Weekly Recaps",
      description:
        t("profile.weekly_recaps_description") ||
        "AI-powered progress summaries",
      route: MOBILE_ROUTES.PROFILE.WEEKLY_RECAPS,
      premium: !hasFeature("weekly_recap"),
    },
    {
      id: "achievements",
      icon: "trophy",
      label: t("profile.achievements") || "Achievements",
      description:
        t("profile.achievements_description") || "Your milestones and badges",
      route: MOBILE_ROUTES.PROFILE.ACHIEVEMENTS,
    },
  ];

  const settingsMenuItems: MenuItem[] = [
    {
      id: "edit_profile",
      icon: "person",
      label: t("profile.edit_profile"),
      route: MOBILE_ROUTES.PROFILE.EDIT,
    },
    {
      id: "notifications",
      icon: "notifications-outline",
      label: t("profile.notifications"),
      route: MOBILE_ROUTES.PROFILE.NOTIFICATION_SETTINGS,
    },
    {
      id: "settings",
      icon: "settings-outline",
      label: t("profile.settings"),
      route: MOBILE_ROUTES.PROFILE.SETTINGS,
    },
  ];

  const supportMenuItems: MenuItem[] = [
    {
      id: "help",
      icon: "help-circle-outline",
      label: t("profile.help_center"),
      action: () => {
        // TODO: Open help center
      },
    },
    {
      id: "contact",
      icon: "mail-outline",
      label: t("profile.contact_us"),
      action: () => {
        // TODO: Open contact form
      },
    },
    {
      id: "referral",
      icon: "share-outline",
      label: t("profile.invite_friends") || "Invite Friends",
      route: MOBILE_ROUTES.SOCIAL.REFERRAL,
    },
  ];

  const renderMenuItem = (item: MenuItem) => {
    const handlePress = () => {
      if (item.route) {
        router.push(item.route as any);
      } else if (item.action) {
        item.action();
      }
    };

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.menuItem}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <View style={styles.menuItemLeft}>
          <View
            style={[
              styles.menuIcon,
              { backgroundColor: `${brandColors.primary}10` },
            ]}
          >
            <Ionicons name={item.icon} size={20} color={brandColors.primary} />
          </View>
          <View style={styles.menuItemContent}>
            <Text style={styles.menuItemLabel}>{item.label}</Text>
            {item.description && (
              <Text style={styles.menuItemDescription} numberOfLines={1}>
                {item.description}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.menuItemRight}>
          {item.badge !== undefined && item.badge > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {item.badge > 99 ? "99+" : item.badge}
              </Text>
            </View>
          )}
          {item.premium && (
            <View style={styles.premiumBadge}>
              <Ionicons name="star" size={12} color="#F59E0B" />
            </View>
          )}
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.text.tertiary}
          />
        </View>
      </TouchableOpacity>
    );
  };

  const renderSection = (
    title: string,
    items: MenuItem[],
    showTitle: boolean = true,
  ) => (
    <View style={styles.section}>
      {showTitle && <Text style={styles.sectionTitle}>{title}</Text>}
      <Card style={styles.menuCard}>
        {items.map((item, index) => (
          <React.Fragment key={item.id}>
            {renderMenuItem(item)}
            {index < items.length - 1 && <View style={styles.divider} />}
          </React.Fragment>
        ))}
      </Card>
    </View>
  );

  const providerLabels: Record<string, string> = {
    password: t("auth.social.providers.password"),
    email: t("auth.social.providers.password"),
    google: t("auth.social.providers.google"),
    apple: t("auth.social.providers.apple"),
  };

  const linkedProviders = user?.linked_providers ?? [];
  const primaryProvider = user?.auth_provider;

  const getPlanLabel = () => {
    switch (plan) {
      case "elite":
        return t("profile.elite_plan") || "Elite";
      case "pro":
        return t("profile.pro_plan") || "Pro";
      case "starter":
        return t("profile.starter_plan") || "Starter";
      default:
        return t("profile.free_plan") || "Free";
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header / User Info */}
        <View style={styles.header}>
          <View style={styles.profileRow}>
            {/* Avatar */}
            {user?.profile_picture_url ? (
              <Image
                source={{ uri: user.profile_picture_url }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </Text>
              </View>
            )}

            {/* Info */}
            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                {user?.name || t("common.user")}
              </Text>
              {user?.username && (
                <Text style={styles.userUsername}>@{user.username}</Text>
              )}
              <View style={styles.planBadge}>
                <Text style={styles.planText}>{getPlanLabel()}</Text>
              </View>
            </View>

            {/* Edit Button */}
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => router.push(MOBILE_ROUTES.PROFILE.EDIT)}
            >
              <Ionicons name="pencil" size={16} color={brandColors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Upgrade Banner - show if not on highest plan */}
        {!isOnHighestPlan && (
          <View style={styles.upgradeSection}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowSubscription(true)}
            >
              <Card style={styles.upgradeCard}>
                <View style={styles.upgradeContent}>
                  <View style={styles.upgradeIconContainer}>
                    <Ionicons
                      name="rocket"
                      size={20}
                      color={brandColors.primary}
                    />
                  </View>
                  <Text style={styles.upgradeTitle}>
                    {t("onboarding.subscription.upgrade_banner.title")}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={colors.text.tertiary}
                  />
                </View>
              </Card>
            </TouchableOpacity>
          </View>
        )}

        {/* Social Section */}
        {renderSection(
          t("profile.social_section") || "Social",
          socialMenuItems,
        )}

        {/* Insights Section */}
        {renderSection(
          t("profile.insights_section") || "Insights",
          insightsMenuItems,
        )}

        {/* Linked Accounts Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("profile.linked_accounts")}
          </Text>
          <Card style={styles.menuCard}>
            <Text style={styles.primaryProviderText}>
              {t("profile.primary_provider_notice", {
                provider:
                  providerLabels[
                    primaryProvider as keyof typeof providerLabels
                  ] || primaryProvider,
              })}
            </Text>
            {["google", "apple"].map((provider) => {
              const isPrimary = primaryProvider === provider;
              const isLinked = isPrimary || linkedProviders.includes(provider);
              return (
                <View key={provider} style={styles.linkedRow}>
                  <View style={styles.linkedInfo}>
                    <Text style={styles.linkedProviderLabel}>
                      {providerLabels[provider]}
                    </Text>
                    <Text
                      style={[
                        styles.linkedStatus,
                        isLinked
                          ? styles.linkedStatusActive
                          : styles.linkedStatusInactive,
                      ]}
                    >
                      {isLinked ? t("profile.linked") : t("profile.not_linked")}
                    </Text>
                  </View>
                  <Button
                    title={
                      isLinked
                        ? t("profile.unlink_account")
                        : t("profile.link_account")
                    }
                    size="sm"
                    variant={isLinked ? "secondary" : "primary"}
                    onPress={handleLinkingPress}
                    disabled={isPrimary}
                  />
                </View>
              );
            })}
          </Card>
        </View>

        {/* Settings Section */}
        {renderSection(
          t("profile.settings_section") || "Settings",
          settingsMenuItems,
        )}

        {/* Support Section */}
        {renderSection(
          t("profile.support_section") || "Support",
          supportMenuItems,
        )}

        {/* Logout Button */}
        <Button
          title={t("common.logout")}
          variant="danger"
          onPress={handleLogout}
          loading={isLoggingOut}
          disabled={isLoggingOut}
          style={styles.logoutButton}
        />
      </ScrollView>

      {/* Subscription Modal */}
      <SubscriptionScreen
        visible={showSubscription}
        onClose={() => setShowSubscription(false)}
      />
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: toRN(tokens.spacing[8]),
  },
  // Header
  header: {
    padding: toRN(tokens.spacing[4]),
    backgroundColor: colors.bg.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    marginBottom: toRN(tokens.spacing[4]),
  },
  profileRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: toRN(tokens.spacing[4]),
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: brand.primary,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginRight: toRN(tokens.spacing[4]),
  },
  avatarText: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.bold,
    color: "#FFFFFF",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
  },
  userUsername: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    marginTop: toRN(tokens.spacing[0.5]),
  },
  planBadge: {
    alignSelf: "flex-start" as const,
    paddingVertical: toRN(tokens.spacing[0.5]),
    paddingHorizontal: toRN(tokens.spacing[2]),
    backgroundColor: `${brand.primary}15`,
    borderRadius: toRN(tokens.borderRadius.full),
    marginTop: toRN(tokens.spacing[1]),
  },
  planText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: brand.primary,
  },
  // Upgrade Section
  upgradeSection: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[4]),
  },
  upgradeCard: {
    backgroundColor: `${brand.primary}10`,
    borderWidth: 1,
    borderColor: `${brand.primary}25`,
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[4]),
  },
  upgradeContent: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  upgradeIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${brand.primary}20`,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginRight: toRN(tokens.spacing[3]),
  },
  upgradeTitle: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${brand.primary}15`,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  // Sections
  section: {
    marginBottom: toRN(tokens.spacing[4]),
    paddingHorizontal: toRN(tokens.spacing[4]),
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.tertiary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: toRN(tokens.spacing[2]),
    marginLeft: toRN(tokens.spacing[1]),
  },
  menuCard: {
    padding: 0,
    overflow: "hidden" as const,
  },
  // Menu Item
  menuItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[4]),
  },
  menuItemLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    flex: 1,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginRight: toRN(tokens.spacing[3]),
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemLabel: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.primary,
  },
  menuItemDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[0.5]),
  },
  menuItemRight: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: brand.primary,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[1.5]),
  },
  badgeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.bold,
    color: "#FFFFFF",
  },
  premiumBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#F59E0B20",
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginLeft: 52 + toRN(tokens.spacing[4]),
  },
  // Linked Accounts
  primaryProviderText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingTop: toRN(tokens.spacing[3]),
    paddingBottom: toRN(tokens.spacing[2]),
  },
  linkedRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  linkedInfo: {
    flex: 1,
    marginRight: toRN(tokens.spacing[3]),
  },
  linkedProviderLabel: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.primary,
  },
  linkedStatus: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    marginTop: toRN(tokens.spacing[0.5]),
  },
  linkedStatusActive: {
    color: colors.feedback.success,
  },
  linkedStatusInactive: {
    color: colors.feedback.warning,
  },
  // Logout
  logoutButton: {
    marginHorizontal: toRN(tokens.spacing[4]),
    marginTop: toRN(tokens.spacing[4]),
  },
});
