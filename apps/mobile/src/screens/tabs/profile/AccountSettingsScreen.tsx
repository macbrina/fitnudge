import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  Linking
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation, setAppLanguage, SUPPORTED_LANGS, SupportedLanguage } from "@/lib/i18n";
import { useStyles, useTheme } from "@/themes";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { MOBILE_ROUTES } from "@/lib/routes";
import { Card } from "@/components/ui/Card";
import BackButton from "@/components/ui/BackButton";
import Button from "@/components/ui/Button";
import { useUpdateProfile, useDeleteAccount } from "@/hooks/api/useUser";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { ApiError } from "@/services/api/base";
import { isIOS } from "@/utils/platform";
import {
  LANGUAGES,
  COUNTRIES,
  TIMEZONES,
  getLanguageByCode,
  getCountryByCode,
  getTimezoneByCode,
  formatTimezoneDisplay
} from "@/constants/localization";

interface MenuItem {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  route?: string;
  action?: () => void;
}

export default function AccountSettingsScreen() {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { user, updateUser, logout } = useAuthStore();
  const { t } = useTranslation();
  const router = useRouter();
  const { showAlert, showConfirm } = useAlertModal();
  const updateProfileMutation = useUpdateProfile();
  const deleteAccountMutation = useDeleteAccount();
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Modal states
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [timezoneModalVisible, setTimezoneModalVisible] = useState(false);

  // Search states
  const [languageSearch, setLanguageSearch] = useState("");
  const [countrySearch, setCountrySearch] = useState("");
  const [timezoneSearch, setTimezoneSearch] = useState("");

  // Get display values
  const currentLanguage = useMemo(() => {
    const lang = getLanguageByCode(user?.language || "");
    return lang?.name || user?.language || "English";
  }, [user?.language]);

  const currentCountry = useMemo(() => {
    const country = getCountryByCode(user?.country || "");
    return country?.name || user?.country || t("common.not_specified");
  }, [user?.country, t]);

  const currentTimezone = useMemo(() => {
    const tz = getTimezoneByCode(user?.timezone || "");
    if (tz) {
      return formatTimezoneDisplay(tz);
    }
    return user?.timezone || "UTC";
  }, [user?.timezone]);

  const handleUpdateSetting = async (field: "language" | "country" | "timezone", value: string) => {
    // Store previous value for rollback
    const previousValue = user?.[field];

    // Optimistically update authStore immediately (UI updates instantly)
    updateUser({ [field]: value });

    // If changing language and it's a supported language, switch the app's locale
    if (field === "language") {
      const isSupportedLang = (SUPPORTED_LANGS as readonly string[]).includes(value);
      if (isSupportedLang) {
        setAppLanguage(value as SupportedLanguage);
      }
    }

    try {
      await updateProfileMutation.mutateAsync({ [field]: value });
    } catch (error: unknown) {
      // Rollback to previous value on error
      updateUser({ [field]: previousValue });

      // Rollback language change if it was a language update
      if (field === "language" && previousValue) {
        const wasSupportedLang = (SUPPORTED_LANGS as readonly string[]).includes(previousValue);
        if (wasSupportedLang) {
          setAppLanguage(previousValue as SupportedLanguage);
        }
      }

      const errorMessage = error instanceof ApiError ? error.message : t("errors.update_failed");
      await showAlert({
        title: t("common.error"),
        message: errorMessage,
        variant: "error"
      });
    }
  };

  const accountMenuItems: MenuItem[] = [
    {
      id: "security",
      icon: "shield-checkmark",
      label: t("account_settings.security_settings"),
      route: MOBILE_ROUTES.PROFILE.SECURITY_SETTINGS
    },
    {
      id: "profile",
      icon: "person-circle",
      label: t("account_settings.profile_settings"),
      route: MOBILE_ROUTES.PROFILE.PROFILE_SETTINGS
    },
    {
      id: "linked_accounts",
      icon: "link",
      label: t("profile.linked_accounts"),
      route: MOBILE_ROUTES.PROFILE.LINKED_ACCOUNTS
    },
    {
      id: "blocked_users",
      icon: "ban",
      label: t("partners.blocked_users") || "Blocked Users",
      route: MOBILE_ROUTES.PROFILE.BLOCKED_PARTNERS
    }
  ];

  const preferencesMenuItems: MenuItem[] = [
    {
      id: "language",
      icon: "language",
      label: t("account_settings.language"),
      value: currentLanguage,
      action: () => setLanguageModalVisible(true)
    },
    {
      id: "country",
      icon: "globe",
      label: t("account_settings.country"),
      value: currentCountry,
      action: () => setCountryModalVisible(true)
    },
    {
      id: "timezone",
      icon: "time",
      label: t("account_settings.timezone"),
      value: currentTimezone,
      action: () => setTimezoneModalVisible(true)
    }
  ];

  const handleManageSubscription = useCallback(() => {
    const url = isIOS
      ? "https://apps.apple.com/account/subscriptions"
      : "https://play.google.com/store/account/subscriptions";
    Linking.openURL(url).catch(() => {});
  }, []);

  const handleDeleteAccount = async () => {
    const isPremium = user?.plan === "premium";
    const message = isPremium
      ? t("profile.delete_account_subscription_warning") ||
        "You have an active subscription. Cancel it in your device's subscription settings first to avoid future charges. Your account will be deleted, but you may still be charged until you cancel."
      : t("profile.delete_account_warning") ||
        "This action is permanent and cannot be undone. All your data will be deleted. Are you sure?";

    const confirmed = await showConfirm({
      title: t("profile.delete_account") || "Delete Account",
      message,
      confirmLabel: t("profile.delete_confirm") || "Delete Account",
      cancelLabel: t("common.cancel"),
      variant: "error"
    });

    if (confirmed) {
      setIsDeletingAccount(true);
      try {
        await deleteAccountMutation.mutateAsync();
        await logout();
        router.replace(MOBILE_ROUTES.AUTH.LOGIN);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof ApiError
            ? error.message
            : t("errors.delete_failed") || "Failed to delete account";
        showAlert({
          title: t("common.error"),
          message: errorMessage,
          variant: "error"
        });
      } finally {
        setIsDeletingAccount(false);
      }
    }
  };

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
          <Text style={styles.menuItemLabel}>{item.label}</Text>
        </View>
        <View style={styles.menuItemRight}>
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

  const renderSection = (title: string, items: MenuItem[]) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
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

  const filterData = useCallback((data: { code: string; name: string }[], query: string) => {
    if (!query.trim()) return data;
    const lowerQuery = query.toLowerCase();
    return data.filter(
      (item) =>
        item.name.toLowerCase().includes(lowerQuery) || item.code.toLowerCase().includes(lowerQuery)
    );
  }, []);

  const filterTimezoneData = useCallback(
    (data: { code: string; offset: string; name: string }[], query: string) => {
      if (!query.trim()) return data;
      const lowerQuery = query.toLowerCase();
      return data.filter(
        (item) =>
          item.name.toLowerCase().includes(lowerQuery) ||
          item.code.toLowerCase().includes(lowerQuery) ||
          item.offset.toLowerCase().includes(lowerQuery)
      );
    },
    []
  );

  const renderSelectionModal = (
    visible: boolean,
    onClose: () => void,
    title: string,
    data: { code: string; name: string }[],
    selectedValue: string | undefined,
    onSelect: (code: string) => void,
    searchQuery: string,
    setSearchQuery: (query: string) => void
  ) => {
    const filteredData = filterData(data, searchQuery);

    const handleClose = () => {
      setSearchQuery("");
      onClose();
    };

    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleClose} style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{title}</Text>
            <View style={styles.modalCloseButton} />
          </View>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputWrapper}>
              <Ionicons name="search" size={18} color={colors.text.tertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder={t("common.search")}
                placeholderTextColor={colors.text.tertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery("")}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-circle" size={18} color={colors.text.tertiary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <FlatList
            data={filteredData}
            keyExtractor={(item) => item.code}
            contentContainerStyle={styles.modalList}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptySearch}>
                <Text style={styles.emptySearchText}>{t("common.no_results")}</Text>
              </View>
            }
            renderItem={({ item }) => {
              const isSelected = item.code === selectedValue;
              return (
                <TouchableOpacity
                  style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                  onPress={() => {
                    onSelect(item.code);
                    handleClose();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                    {item.name}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark" size={20} color={brandColors.primary} />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    );
  };

  const renderTimezoneModal = () => {
    const filteredData = filterTimezoneData(TIMEZONES, timezoneSearch);

    const handleClose = () => {
      setTimezoneSearch("");
      setTimezoneModalVisible(false);
    };

    return (
      <Modal visible={timezoneModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleClose} style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t("account_settings.select_timezone")}</Text>
            <View style={styles.modalCloseButton} />
          </View>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputWrapper}>
              <Ionicons name="search" size={18} color={colors.text.tertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder={t("common.search")}
                placeholderTextColor={colors.text.tertiary}
                value={timezoneSearch}
                onChangeText={setTimezoneSearch}
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
              {timezoneSearch.length > 0 && (
                <TouchableOpacity
                  onPress={() => setTimezoneSearch("")}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-circle" size={18} color={colors.text.tertiary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <FlatList
            data={filteredData}
            keyExtractor={(item) => item.code}
            contentContainerStyle={styles.modalList}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptySearch}>
                <Text style={styles.emptySearchText}>{t("common.no_results")}</Text>
              </View>
            }
            renderItem={({ item }) => {
              const isSelected = item.code === user?.timezone;
              return (
                <TouchableOpacity
                  style={[styles.timezoneItem, isSelected && styles.modalItemSelected]}
                  onPress={() => {
                    handleUpdateSetting("timezone", item.code);
                    handleClose();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.timezoneContent}>
                    <Text style={styles.timezoneOffset}>{item.offset}</Text>
                    <Text
                      style={[styles.timezoneName, isSelected && styles.modalItemTextSelected]}
                      numberOfLines={2}
                    >
                      {item.name}
                    </Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark" size={20} color={brandColors.primary} />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <BackButton title={t("profile.account_settings")} onPress={() => router.back()} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Section */}
        {renderSection(t("account_settings.account"), accountMenuItems)}

        {/* Preferences Section */}
        {renderSection(t("account_settings.preferences"), preferencesMenuItems)}

        {/* Danger Zone Section */}
        <View style={styles.dangerSection}>
          <Text style={styles.dangerSectionTitle}>
            {t("account_settings.danger_zone") || "Danger Zone"}
          </Text>
          <Card style={styles.dangerCard}>
            <View style={styles.dangerContent}>
              {user?.plan === "premium" && (
                <TouchableOpacity
                  style={[styles.manageSubscriptionLink, { borderColor: colors.border.default }]}
                  onPress={handleManageSubscription}
                  activeOpacity={0.7}
                >
                  <Ionicons name="card-outline" size={18} color={brandColors.primary} />
                  <Text style={[styles.manageSubscriptionText, { color: brandColors.primary }]}>
                    {t("profile.manage_subscription") || "Manage Subscription"}
                  </Text>
                  <Ionicons name="open-outline" size={16} color={brandColors.primary} />
                </TouchableOpacity>
              )}
              <View style={styles.dangerRow}>
                <View style={styles.dangerTextContainer}>
                  <Text style={styles.dangerTitle}>
                    {t("profile.delete_account") || "Delete Account"}
                  </Text>
                  <Text style={styles.dangerDescription}>
                    {t("profile.delete_account_desc") ||
                      "Permanently delete your account and all associated data"}
                  </Text>
                </View>
                <Button
                  title={t("common.delete") || "Delete"}
                  variant="danger"
                  size="sm"
                  onPress={handleDeleteAccount}
                  loading={isDeletingAccount}
                  disabled={isDeletingAccount}
                />
              </View>
            </View>
          </Card>
        </View>
      </ScrollView>

      {/* Language Selection Modal - Only show languages with translations */}
      {renderSelectionModal(
        languageModalVisible,
        () => setLanguageModalVisible(false),
        t("account_settings.select_language"),
        LANGUAGES.filter((lang) => (SUPPORTED_LANGS as readonly string[]).includes(lang.code)),
        user?.language,
        (code) => handleUpdateSetting("language", code),
        languageSearch,
        setLanguageSearch
      )}

      {/* Country Selection Modal */}
      {renderSelectionModal(
        countryModalVisible,
        () => setCountryModalVisible(false),
        t("account_settings.select_country"),
        COUNTRIES,
        user?.country,
        (code) => handleUpdateSetting("country", code),
        countrySearch,
        setCountrySearch
      )}

      {/* Timezone Selection Modal */}
      {renderTimezoneModal()}
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
  // Sections
  section: {
    marginTop: toRN(tokens.spacing[4]),
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
    paddingVertical: toRN(tokens.spacing[4])
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
  menuItemLabel: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.primary
  },
  menuItemRight: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    maxWidth: "50%" as const
  },
  menuItemValue: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginLeft: 52 + toRN(tokens.spacing[4])
  },
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  modalHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[3]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  modalTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  modalList: {
    padding: toRN(tokens.spacing[4])
  },
  modalItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.lg),
    marginBottom: toRN(tokens.spacing[2])
  },
  modalItemSelected: {
    backgroundColor: `${brand.primary}15`,
    borderWidth: 1,
    borderColor: `${brand.primary}30`
  },
  modalItemText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.primary
  },
  modalItemTextSelected: {
    fontFamily: fontFamily.semiBold,
    color: brand.primary
  },
  // Search
  searchContainer: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[3]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle
  },
  searchInputWrapper: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.lg),
    paddingHorizontal: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[2]),
    gap: toRN(tokens.spacing[2])
  },
  searchInput: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.primary,
    paddingVertical: toRN(tokens.spacing[1])
  },
  emptySearch: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: toRN(tokens.spacing[8])
  },
  emptySearchText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },
  // Timezone specific
  timezoneItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.lg),
    marginBottom: toRN(tokens.spacing[2])
  },
  timezoneContent: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    flex: 1,
    gap: toRN(tokens.spacing[3])
  },
  timezoneOffset: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
    minWidth: 90
  },
  timezoneName: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.primary,
    flex: 1
  },
  // Danger Zone
  dangerSection: {
    marginTop: toRN(tokens.spacing[6]),
    paddingHorizontal: toRN(tokens.spacing[4])
  },
  dangerSectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.feedback.error,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: toRN(tokens.spacing[2]),
    marginLeft: toRN(tokens.spacing[1])
  },
  dangerCard: {
    borderWidth: 1,
    borderColor: `${colors.feedback.error}30`,
    backgroundColor: `${colors.feedback.error}05`
  },
  dangerContent: {
    flexDirection: "column" as const,
    gap: toRN(tokens.spacing[3])
  },
  manageSubscriptionLink: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    borderRadius: 8,
    borderWidth: 1
  },
  manageSubscriptionText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    flex: 1
  },
  dangerRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    gap: toRN(tokens.spacing[3])
  },
  dangerTextContainer: {
    flex: 1
  },
  dangerTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[1])
  },
  dangerDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary
  }
});
