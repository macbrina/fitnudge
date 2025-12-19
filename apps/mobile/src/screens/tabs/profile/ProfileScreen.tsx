import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/lib/i18n";
import { useRouter } from "expo-router";
import Button from "@/components/ui/Button";
import { MOBILE_ROUTES } from "@/lib/routes";
import { useAlertModal } from "@/contexts/AlertModalContext";

export default function ProfileScreen() {
  const { user, logout, isLoggingOut } = useAuthStore();
  const { t } = useTranslation();
  const router = useRouter();
  const { showAlert } = useAlertModal();

  const providerLabels: Record<string, string> = {
    password: t("auth.social.providers.password"),
    email: t("auth.social.providers.password"),
    google: t("auth.social.providers.google"),
    apple: t("auth.social.providers.apple"),
  };

  const linkedProviders = user?.linked_providers ?? [];
  const primaryProvider = user?.auth_provider;

  const handleLinkingPress = async () => {
    await showAlert({
      title: t("auth.social.coming_soon"),
      message: t("profile.linking_unavailable"),
      variant: "info",
      confirmLabel: t("common.ok"),
    });
  };

  const handleLogout = async () => {
    const success = await logout();
    if (success) {
      router.replace(MOBILE_ROUTES.AUTH.LOGIN);
    }
  };

  const renderLinkedAccountRow = (provider: "google" | "apple") => {
    const isPrimary = primaryProvider === provider;
    const isLinked = isPrimary || linkedProviders.includes(provider);
    const statusLabel = isLinked
      ? t("profile.linked")
      : t("profile.not_linked");

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
            {statusLabel}
          </Text>
        </View>
        <Button
          title={
            isLinked ? t("profile.unlink_account") : t("profile.link_account")
          }
          size="sm"
          variant={isLinked ? "secondary" : "primary"}
          onPress={handleLinkingPress}
          disabled={isPrimary}
        />
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.profileInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0) || "U"}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>
              {user?.name || t("common.user")}
            </Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <Text style={styles.userPlan}>
              {user?.plan === "free"
                ? t("profile.free_plan")
                : t("profile.pro_plan")}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("profile.linked_accounts")}</Text>
          <Text style={styles.primaryProviderText}>
            {t("profile.primary_provider_notice", {
              provider:
                providerLabels[
                  primaryProvider as keyof typeof providerLabels
                ] || primaryProvider,
            })}
          </Text>
          {renderLinkedAccountRow("google")}
          {renderLinkedAccountRow("apple")}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("profile.account_settings")}</Text>
          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingText}>{t("profile.edit_profile")}</Text>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingText}>{t("profile.notifications")}</Text>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingText}>{t("profile.privacy")}</Text>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("profile.subscription")}</Text>
          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingText}>
              {t("profile.manage_subscription")}
            </Text>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingText}>
              {t("profile.billing_history")}
            </Text>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("profile.support")}</Text>
          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingText}>{t("profile.help_center")}</Text>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingText}>{t("profile.contact_us")}</Text>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <Button
          title={t("common.logout")}
          variant="danger"
          onPress={handleLogout}
          loading={isLoggingOut}
          disabled={isLoggingOut}
          fullWidth
          style={styles.logoutButton}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    padding: 24,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  profileInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: "#6b7280",
    marginBottom: 4,
  },
  userPlan: {
    fontSize: 14,
    color: "#2563eb",
    fontWeight: "500",
  },
  content: {
    padding: 24,
    gap: 16,
  },
  primaryProviderText: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 12,
  },
  linkedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  linkedInfo: {
    flex: 1,
    marginRight: 16,
  },
  linkedProviderLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
  },
  linkedStatus: {
    marginTop: 4,
    fontSize: 12,
  },
  linkedStatusActive: {
    color: "#16a34a",
  },
  linkedStatusInactive: {
    color: "#f97316",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  settingText: {
    fontSize: 16,
    color: "#0f172a",
  },
  settingArrow: {
    fontSize: 20,
    color: "#9ca3af",
  },
  logoutButton: {
    marginTop: 24,
  },
});
