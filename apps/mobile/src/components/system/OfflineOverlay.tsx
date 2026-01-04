import React, { useState, useCallback } from "react";
import { View, Text, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useStyles, useTheme } from "@/themes";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import Button from "@/components/ui/Button";
import { useSystemStatusStore, useIsOffline } from "@/stores/systemStatusStore";
import { fetchBackendHealth } from "@/services/system/systemStatusService";

/**
 * Full-screen overlay that appears when the app is offline.
 * Shows when either network connectivity is lost or the backend is unreachable.
 * Provides a retry button that:
 * 1. Re-checks network status
 * 2. Re-checks backend health
 * 3. Refetches all failed React Query queries
 */
export function OfflineOverlay() {
  const isOffline = useIsOffline();
  const isNetworkConnected = useSystemStatusStore((s) => s.isNetworkConnected);
  const setNetworkConnected = useSystemStatusStore((s) => s.setNetworkConnected);
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();

  const [isRetrying, setIsRetrying] = useState(false);

  const isNetworkIssue = isNetworkConnected === false;

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);

    try {
      // 1. Re-check network connectivity
      const NetInfo = await import("@react-native-community/netinfo");
      const state = await NetInfo.default.fetch();
      setNetworkConnected(state.isConnected ?? true);

      // If network is back, check backend health
      if (state.isConnected) {
        // 2. Re-check backend health
        await fetchBackendHealth({ force: true });

        // 3. Refetch all failed queries
        await queryClient.refetchQueries({
          predicate: (query) => query.state.status === "error"
        });

        // Also invalidate queries that might be stale
        await queryClient.invalidateQueries();
      }
    } catch (error) {
      console.warn("[OfflineOverlay] Retry failed:", error);
    } finally {
      setIsRetrying(false);
    }
  }, [setNetworkConnected, queryClient]);

  // Don't show if we're online
  if (!isOffline) {
    return null;
  }

  return (
    <Modal
      visible={true}
      animationType="fade"
      statusBarTranslucent
      transparent
      // Prevent closing via Android back button - user must use Retry
      onRequestClose={() => {}}
      // Prevent gesture-based dismissal on iOS
      presentationStyle="overFullScreen"
      hardwareAccelerated
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Ionicons
              name={isNetworkIssue ? "cloud-offline-outline" : "server-outline"}
              size={80}
              color={colors.text.tertiary}
            />
          </View>

          {/* Title */}
          <Text style={styles.title}>
            {isNetworkIssue
              ? t("system_status.network.title", "No Internet Connection")
              : t("system_status.offline.title", "Service Unavailable")}
          </Text>

          {/* Description */}
          <Text style={styles.description}>
            {isNetworkIssue
              ? t(
                  "system_status.network.message",
                  "Please check your internet connection and try again."
                )
              : t(
                  "system_status.offline.message",
                  "We're having trouble reaching the server. Please try again."
                )}
          </Text>

          {/* Retry Button */}
          <Button
            title={
              isRetrying
                ? t("system_status.refreshing", "Checking…")
                : t("system_status.retry", "Retry")
            }
            onPress={handleRetry}
            disabled={isRetrying}
            loading={isRetrying}
            style={styles.retryButton}
            leftIcon={isRetrying ? undefined : "refresh-outline"}
          />
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  overlay: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    padding: toRN(tokens.spacing[6])
  },
  content: {
    alignItems: "center" as const,
    maxWidth: 320
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: `${colors.text.tertiary}10`,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[6])
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[3])
  },
  description: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    lineHeight: toRN(tokens.typography.fontSize.base) * 1.5,
    marginBottom: toRN(tokens.spacing[8])
  },
  retryButton: {
    minWidth: 160,
    paddingHorizontal: toRN(tokens.spacing[6])
  }
});
