import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Pressable,
  Linking,
  ActivityIndicator
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAlertModal } from "@/contexts/AlertModalContext";
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
import { Card } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import LinkText from "@/components/ui/LinkText";
import SubscriptionScreen from "@/screens/onboarding/SubscriptionScreen";
import { usePartners, usePendingPartnerRequests } from "@/hooks/api/usePartners";
import { isIOS } from "@/utils/platform";
import { useNudges } from "@/hooks/api/useNudges";
import { APP_STORE_URLS, EXTERNAL_URLS, PROFILE_AVATARS } from "@/constants/general";
import Constants from "expo-constants";
import { userService } from "@/services/api/user";
import { ApiError } from "@/services/api/base";

// Rate app image
const RateAppImage = require("@assetsimages/images/rate_app.png");

type ThemeOption = "system" | "light" | "dark";

interface MenuItem {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  value?: string; // Shows on the right before the chevron
  route?: string;
  action?: () => void;
  badge?: number;
  premium?: boolean;
}

export default function ProfileScreen() {
  const styles = useStyles(makeStyles);
  const { colors, brandColors, isSystem, preference, setPreference, setIsSystem } = useTheme();
  const { user, logout, isLoggingOut } = useAuthStore();
  const { getPlan, hasFeature } = useSubscriptionStore();
  const { t } = useTranslation();
  const router = useRouter();

  // Data for badges
  const { data: partnersData } = usePartners();
  const { data: pendingData } = usePendingPartnerRequests();
  const { data: nudgesData } = useNudges();

  const partnersCount = partnersData?.data?.length || 0;
  const pendingRequestsCount = pendingData?.data?.length || 0;
  const unreadNudgesCount = nudgesData?.data?.filter((n) => !n.is_read).length || 0;

  const plan = getPlan();
  const isOnHighestPlan = plan === "premium";
  const [showSubscription, setShowSubscription] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showRateAppModal, setShowRateAppModal] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Get current theme option
  const getCurrentTheme = useCallback((): ThemeOption => {
    if (isSystem) return "system";
    return preference;
  }, [isSystem, preference]);

  const currentTheme = getCurrentTheme();

  // Theme labels
  const getThemeLabel = useCallback(
    (theme: ThemeOption): string => {
      switch (theme) {
        case "system":
          return t("settings.theme_system") || "System";
        case "light":
          return t("settings.theme_light") || "Light";
        case "dark":
          return t("settings.theme_dark") || "Dark";
      }
    },
    [t]
  );

  // Theme icons
  const getThemeIcon = (theme: ThemeOption): keyof typeof Ionicons.glyphMap => {
    switch (theme) {
      case "system":
        return "phone-portrait-outline";
      case "light":
        return "sunny-outline";
      case "dark":
        return "moon-outline";
    }
  };

  // Handle theme selection
  const handleThemeSelect = useCallback(
    (theme: ThemeOption) => {
      if (theme === "system") {
        setIsSystem(true);
      } else {
        setIsSystem(false);
        setPreference(theme);
      }
      setShowThemeModal(false);
    },
    [setIsSystem, setPreference]
  );

  // Handle star rating selection
  const handleStarPress = useCallback((rating: number) => {
    setSelectedRating(rating);
    // Open the appropriate store URL
    const storeUrl = isIOS ? APP_STORE_URLS.IOS : APP_STORE_URLS.ANDROID;
    Linking.openURL(storeUrl);
    setShowRateAppModal(false);
  }, []);

  const { showAlert, showConfirm } = useAlertModal();

  const handleLogout = async () => {
    const success = await logout();
    if (success) {
      router.replace(MOBILE_ROUTES.AUTH.LOGIN);
    }
  };

  const handleExportDataConfirm = async () => {
    setIsExporting(true);
    try {
      await userService.requestDataExport();

      setShowExportModal(false);
      setIsExporting(false);

      showAlert({
        title: t("common.success"),
        message:
          t("profile.export_data_success") ||
          "Your data export has been initiated. You will receive an email with your data shortly.",
        variant: "success"
      });
    } catch (error) {
      setShowExportModal(false);
      setIsExporting(false);

      // Check for rate limit (429)
      if (error instanceof ApiError && error.status === 429) {
        showAlert({
          title: t("common.info") || "Info",
          message:
            t("profile.export_rate_limit") ||
            "You can only request one data export per day. Please try again tomorrow.",
          variant: "info"
        });
        return;
      }

      // Show the actual error message from the backend
      const errorMessage =
        error instanceof ApiError ? error.message : error instanceof Error ? error.message : null;

      showAlert({
        title: t("common.error"),
        message:
          errorMessage || t("errors.export_failed") || "Failed to export data. Please try again.",
        variant: "error"
      });
    }
  };

  // Menu items organized by sections
  const socialMenuItems: MenuItem[] = [
    {
      id: "partners",
      icon: "people",
      label: t("profile.my_partners") || "My Partners",
      description:
        partnersCount > 0
          ? t("profile.partners_count", { count: partnersCount }) || `${partnersCount} partners`
          : t("profile.find_accountability_partners") || "Find accountability partners",
      route: MOBILE_ROUTES.PROFILE.PARTNERS,
      badge: pendingRequestsCount
    },
    {
      id: "activity",
      icon: "notifications",
      label: t("profile.partner_activity") || "Partner Activity",
      description: t("profile.nudges_and_cheers") || "Nudges and cheers from partners",
      route: MOBILE_ROUTES.PROFILE.ACTIVITY,
      badge: unreadNudgesCount
    }
  ];

  const insightsMenuItems: MenuItem[] = [
    {
      id: "weekly_recaps",
      icon: "analytics",
      label: t("profile.weekly_recaps") || "Weekly Recaps",
      description: t("profile.weekly_recaps_description") || "AI-powered progress summaries",
      route: MOBILE_ROUTES.PROFILE.WEEKLY_RECAPS,
      premium: !hasFeature("weekly_recap")
    },
    {
      id: "achievements",
      icon: "trophy",
      label: t("profile.achievements") || "Achievements",
      description: t("profile.achievements_description") || "Your milestones and badges",
      route: MOBILE_ROUTES.PROFILE.ACHIEVEMENTS
    }
  ];

  const settingsMenuItems: MenuItem[] = [
    {
      id: "account_settings",
      icon: "person",
      label: t("profile.account_settings"),
      route: MOBILE_ROUTES.PROFILE.ACCOUNT_SETTINGS
    },
    {
      id: "personalization",
      icon: "options-outline",
      label: t("profile.personalization") || "Personalization",
      description: t("profile.personalization_desc") || "Fitness preferences & goals",
      route: MOBILE_ROUTES.PROFILE.PERSONALIZATION
    },
    {
      id: "notifications",
      icon: "notifications-outline",
      label: t("profile.notifications"),
      route: MOBILE_ROUTES.PROFILE.NOTIFICATION_SETTINGS
    },
    {
      id: "audio_settings",
      icon: "volume-high-outline",
      label: t("profile.audio_settings") || "Audio Settings",
      description: t("profile.audio_settings_desc") || "Music, voice & sound effects",
      route: MOBILE_ROUTES.PROFILE.AUDIO_SETTINGS
    },
    {
      id: "theme",
      icon: getThemeIcon(currentTheme),
      label: t("settings.theme") || "Theme",
      value: getThemeLabel(currentTheme),
      action: () => setShowThemeModal(true)
    }
  ];

  const supportMenuItems: MenuItem[] = [
    {
      id: "help",
      icon: "help-circle-outline",
      label: t("profile.help_center"),
      description: t("profile.help_center_desc") || "FAQs and guides",
      route: MOBILE_ROUTES.PROFILE.HELP_CENTER
    },
    {
      id: "contact",
      icon: "mail-outline",
      label: t("profile.contact_us"),
      description: t("profile.contact_us_desc") || "Email or live chat",
      route: MOBILE_ROUTES.PROFILE.CONTACT
    },
    {
      id: "rate_app",
      icon: "star-outline",
      label: t("profile.rate_app") || "Rate the App",
      value: `V ${Constants.expoConfig?.version || "1.0.0"}`,
      action: () => {
        setSelectedRating(0);
        setShowRateAppModal(true);
      }
    },
    {
      id: "referral",
      icon: "share-outline",
      label: t("profile.invite_friends") || "Invite Friends",
      route: MOBILE_ROUTES.PROFILE.REFERRAL
    }
  ];

  const legalMenuItems: MenuItem[] = [
    {
      id: "export_data",
      icon: "download-outline",
      label: t("profile.export_data") || "Export My Data",
      action: () => setShowExportModal(true)
    }
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
          <View style={[styles.menuIcon, { backgroundColor: `${colors.text.tertiary}10` }]}>
            <Ionicons name={item.icon} size={20} color={colors.text.tertiary} />
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
              <Text style={styles.badgeText}>{item.badge > 99 ? "99+" : item.badge}</Text>
            </View>
          )}
          {item.premium && (
            <View style={styles.premiumBadge}>
              <Ionicons name="star" size={12} color="#F59E0B" />
            </View>
          )}
          {item.value && (
            <Text style={styles.menuItemValue} numberOfLines={1}>
              {item.value}
            </Text>
          )}
          <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderSection = (title: string, items: MenuItem[], showTitle: boolean = true) => (
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

  const getPlanLabel = () => {
    switch (plan) {
      case "premium":
        return t("profile.premium_plan") || "Premium";
      default:
        return t("profile.free_plan") || "Free";
    }
  };

  // Get avatar display from profile_picture_url (which stores the avatar ID)
  const getAvatarDisplay = useCallback(() => {
    const avatarId = user?.profile_picture_url;
    const avatar = PROFILE_AVATARS.find((a) => a.id === avatarId);
    if (avatar) {
      return avatar;
    }
    // Default avatar
    return { id: "default", icon: "person-circle", color: brandColors.primary };
  }, [user?.profile_picture_url, brandColors.primary]);

  const currentAvatar = getAvatarDisplay();

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
            <View style={[styles.avatarContainer, { backgroundColor: `${currentAvatar.color}20` }]}>
              <Ionicons
                name={currentAvatar.icon as keyof typeof Ionicons.glyphMap}
                size={36}
                color={currentAvatar.color}
              />
            </View>

            {/* Info */}
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user?.name || t("common.user")}</Text>
              {user?.username && <Text style={styles.userUsername}>@{user.username}</Text>}
              <View style={styles.planBadge}>
                <Text style={styles.planText}>{getPlanLabel()}</Text>
              </View>
            </View>

            {/* Edit Button - Goes to Profile Settings */}
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => router.push(MOBILE_ROUTES.PROFILE.PROFILE_SETTINGS)}
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
              style={styles.upgradeBanner}
            >
              <View style={styles.upgradeIconContainer}>
                <Ionicons name="diamond" size={22} color={brandColors.primary} />
              </View>
              <View style={styles.upgradeTextContainer}>
                <Text style={styles.upgradeTitle}>{t("profile.upgrade_to_premium")}</Text>
                <Text style={styles.upgradeSubtitle}>{t("profile.upgrade_subtitle")}</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Social Section */}
        {renderSection(t("profile.social_section") || "Social", socialMenuItems)}

        {/* Insights Section */}
        {renderSection(t("profile.insights_section") || "Insights", insightsMenuItems)}

        {/* Settings Section */}
        {renderSection(t("profile.settings_section") || "Settings", settingsMenuItems)}

        {/* Support Section */}
        {renderSection(t("profile.support_section") || "Support", supportMenuItems)}

        {/* Legal Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("profile.legal_section") || "Legal"}</Text>
          <Card style={styles.menuCard}>
            {/* Privacy Policy */}
            <LinkText
              url={EXTERNAL_URLS.PRIVACY_POLICY}
              title={t("profile.privacy_policy") || "Privacy Policy"}
              style={styles.linkMenuItem}
              underline={false}
              asContainer
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIcon, { backgroundColor: `${colors.text.tertiary}10` }]}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={20}
                    color={colors.text.tertiary}
                  />
                </View>
                <Text style={styles.linkMenuText}>
                  {t("profile.privacy_policy") || "Privacy Policy"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
            </LinkText>
            <View style={styles.divider} />

            {/* Terms of Service */}
            <LinkText
              url={EXTERNAL_URLS.TERMS_OF_SERVICE}
              title={t("profile.terms_of_service") || "Terms of Service"}
              style={styles.linkMenuItem}
              underline={false}
              asContainer
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIcon, { backgroundColor: `${colors.text.tertiary}10` }]}>
                  <Ionicons name="document-text-outline" size={20} color={colors.text.tertiary} />
                </View>
                <Text style={styles.linkMenuText}>
                  {t("profile.terms_of_service") || "Terms of Service"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
            </LinkText>
            <View style={styles.divider} />

            {/* Remaining menu items */}
            {legalMenuItems.map((item, index) => (
              <React.Fragment key={item.id}>
                {renderMenuItem(item)}
                {index < legalMenuItems.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))}
          </Card>
        </View>

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
      <SubscriptionScreen visible={showSubscription} onClose={() => setShowSubscription(false)} />

      {/* Theme Selection Modal */}
      <Modal
        visible={showThemeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowThemeModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowThemeModal(false)}>
          <Pressable style={styles.themeModalContainer} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.themeModalTitle}>
              {t("settings.choose_theme") || "Choose Theme"}
            </Text>

            <View style={styles.themeOptionsContainer}>
              {(["system", "light", "dark"] as ThemeOption[]).map((theme) => {
                const isSelected = currentTheme === theme;
                return (
                  <TouchableOpacity
                    key={theme}
                    style={[styles.themeOption, isSelected && styles.themeOptionSelected]}
                    onPress={() => handleThemeSelect(theme)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.themeIconContainer,
                        isSelected && styles.themeIconContainerSelected
                      ]}
                    >
                      <Ionicons
                        name={getThemeIcon(theme)}
                        size={20}
                        color={isSelected ? brandColors.primary : colors.text.secondary}
                      />
                    </View>
                    <Text
                      style={[
                        styles.themeOptionLabel,
                        isSelected && styles.themeOptionLabelSelected
                      ]}
                    >
                      {getThemeLabel(theme)}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={18} color={brandColors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Button
              title={t("common.cancel")}
              variant="ghost"
              size="sm"
              onPress={() => setShowThemeModal(false)}
              fullWidth
              style={styles.themeModalCloseButton}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Rate App Modal */}
      <Modal
        visible={showRateAppModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRateAppModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowRateAppModal(false)}>
          <Pressable style={styles.rateAppModalContainer} onPress={(e) => e.stopPropagation()}>
            {/* Rate App Image */}
            <Image source={RateAppImage} style={styles.rateAppImage} resizeMode="contain" />

            {/* Title & Description */}
            <Text style={styles.rateAppTitle}>
              {t("profile.rate_app_title") || "Enjoying FitNudge?"}
            </Text>
            <Text style={styles.rateAppDescription}>
              {t("profile.rate_app_description") || "Please tap on the stars to rate"}
            </Text>

            {/* Star Rating */}
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => handleStarPress(star)}
                  activeOpacity={0.7}
                  style={styles.starButton}
                >
                  <Ionicons
                    name={selectedRating >= star ? "star" : "star-outline"}
                    size={36}
                    color={selectedRating >= star ? "#F59E0B" : colors.text.tertiary}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Not Now Button */}
            <Button
              title={t("common.not_now") || "Not now"}
              variant="ghost"
              size="sm"
              onPress={() => setShowRateAppModal(false)}
              style={styles.rateAppCloseButton}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Export Data Modal */}
      <Modal
        visible={showExportModal}
        transparent
        animationType="fade"
        onRequestClose={() => !isExporting && setShowExportModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => !isExporting && setShowExportModal(false)}
        >
          <Pressable style={styles.exportModalContainer} onPress={(e) => e.stopPropagation()}>
            {/* Icon */}
            <View style={styles.exportIconContainer}>
              <Ionicons name="download-outline" size={32} color={brandColors.primary} />
            </View>

            {/* Title */}
            <Text style={styles.exportModalTitle}>
              {t("profile.export_data") || "Export My Data"}
            </Text>

            {/* Description */}
            <Text style={styles.exportModalDescription}>
              {t("profile.export_data_confirm") ||
                "We'll send a copy of all your data to your email address. This may take a few minutes."}
            </Text>

            {/* Buttons */}
            <View style={styles.exportModalButtons}>
              <Button
                title={t("common.export") || "Export"}
                variant="primary"
                onPress={handleExportDataConfirm}
                loading={isExporting}
                disabled={isExporting}
                fullWidth
              />
              <Button
                title={t("common.cancel") || "Cancel"}
                variant="ghost"
                size="sm"
                onPress={() => setShowExportModal(false)}
                disabled={isExporting}
                fullWidth
                style={styles.exportCancelButton}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: toRN(tokens.spacing[8])
  },
  // Header
  header: {
    padding: toRN(tokens.spacing[4]),
    backgroundColor: colors.bg.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    marginBottom: toRN(tokens.spacing[4])
  },
  profileRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginRight: toRN(tokens.spacing[4])
  },
  userInfo: {
    flex: 1
  },
  userName: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: colors.text.primary
  },
  userUsername: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    marginTop: toRN(tokens.spacing[0.5])
  },
  planBadge: {
    alignSelf: "flex-start" as const,
    paddingVertical: toRN(tokens.spacing[0.5]),
    paddingHorizontal: toRN(tokens.spacing[2]),
    backgroundColor: `${brand.primary}15`,
    borderRadius: toRN(tokens.borderRadius.full),
    marginTop: toRN(tokens.spacing[1])
  },
  planText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: brand.primary
  },
  // Upgrade Section
  upgradeSection: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[4])
  },
  upgradeBanner: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: `${brand.primary}12`,
    borderWidth: 1.5,
    borderColor: `${brand.primary}30`,
    borderRadius: toRN(tokens.borderRadius.full),
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[4])
  },
  upgradeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${brand.primary}20`,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginRight: toRN(tokens.spacing[3])
  },
  upgradeTextContainer: {
    flex: 1
  },
  upgradeTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[0.5])
  },
  upgradeSubtitle: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${brand.primary}15`,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  // Sections
  section: {
    marginBottom: toRN(tokens.spacing[4]),
    paddingHorizontal: toRN(tokens.spacing[4])
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.tertiary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: toRN(tokens.spacing[2]),
    marginLeft: toRN(tokens.spacing[1])
  },
  menuCard: {
    padding: 0,
    overflow: "hidden" as const
  },
  // Menu Item
  menuItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: toRN(tokens.spacing[3])
    // paddingHorizontal: toRN(tokens.spacing[2])
  },
  menuItemLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    flex: 1
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginRight: toRN(tokens.spacing[3])
  },
  menuItemContent: {
    flex: 1
  },
  menuItemLabel: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.primary
  },
  menuItemDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[0.5])
  },
  menuItemRight: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2])
  },
  menuItemValue: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: brand.primary,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[1.5])
  },
  badgeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.bold,
    color: "#FFFFFF"
  },
  premiumBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#F59E0B20",
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginLeft: 52 + toRN(tokens.spacing[4])
  },
  // Link Menu Item (for LinkText items)
  linkMenuItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: toRN(tokens.spacing[3])
  },
  linkMenuText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.primary
  },
  // Logout
  logoutButton: {
    marginHorizontal: toRN(tokens.spacing[4]),
    marginTop: toRN(tokens.spacing[4])
  },
  // Theme Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center" as const,
    alignItems: "center" as const,
    padding: toRN(tokens.spacing[4])
  },
  themeModalContainer: {
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.xl),
    padding: toRN(tokens.spacing[4]),
    width: "100%" as const,
    maxWidth: 340,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8
  },
  themeModalTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[3])
  },
  themeOptionsContainer: {
    gap: toRN(tokens.spacing[2])
  },
  themeOption: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[2.5]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.lg),
    backgroundColor: colors.bg.canvas,
    borderWidth: 1.5,
    borderColor: "transparent"
  },
  themeOptionSelected: {
    backgroundColor: `${brand.primary}10`,
    borderColor: `${brand.primary}30`
  },
  themeIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.card,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginRight: toRN(tokens.spacing[3])
  },
  themeIconContainerSelected: {
    backgroundColor: `${brand.primary}15`
  },
  themeOptionLabel: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.primary
  },
  themeOptionLabelSelected: {
    fontFamily: fontFamily.semiBold,
    color: brand.primary
  },
  themeModalCloseButton: {
    marginTop: toRN(tokens.spacing[3])
  },
  // Rate App Modal
  rateAppModalContainer: {
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius["2xl"]),
    padding: toRN(tokens.spacing[6]),
    width: "100%" as const,
    maxWidth: 320,
    alignItems: "center" as const,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8
  },
  rateAppImage: {
    width: 120,
    height: 120,
    marginBottom: toRN(tokens.spacing[4])
  },
  rateAppTitle: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[2])
  },
  rateAppDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[4])
  },
  starsContainer: {
    flexDirection: "row" as const,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    marginBottom: toRN(tokens.spacing[4])
  },
  starButton: {
    padding: toRN(tokens.spacing[1])
  },
  rateAppCloseButton: {
    marginTop: toRN(tokens.spacing[2])
  },
  // Export Data Modal
  exportModalContainer: {
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius["2xl"]),
    padding: toRN(tokens.spacing[6]),
    width: "100%" as const,
    maxWidth: 340,
    alignItems: "center" as const,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8
  },
  exportIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${brand.primary}15`,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[4])
  },
  exportModalTitle: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[2])
  },
  exportModalDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5,
    marginBottom: toRN(tokens.spacing[5])
  },
  exportModalButtons: {
    width: "100%" as const,
    gap: toRN(tokens.spacing[2])
  },
  exportCancelButton: {
    marginTop: toRN(tokens.spacing[1])
  }
});
