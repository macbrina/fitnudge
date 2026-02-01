import React, { useState, useCallback, useEffect, useRef } from "react";
import { View, Text, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import NetInfo from "@react-native-community/netinfo";
import { useStyles, useTheme } from "@/themes";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import Button from "@/components/ui/Button";
import { useSystemStatusStore, useIsOffline } from "@/stores/systemStatusStore";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { usePricingStore } from "@/stores/pricingStore";
import { fetchBackendHealth } from "@/services/system/systemStatusService";

const BACKEND_POLL_INTERVAL_MS = 10_000; // 10s when offline due to backend only

/**
 * Full-screen overlay that appears when the app is offline.
 * Shows when either network connectivity is lost or the backend is unreachable.
 *
 * Retry (manual or auto):
 * 1. Re-checks network status
 * 2. Re-checks backend health
 * 3. Refetches failed React Query queries and invalidates stale ones
 * 4. Refetches Zustand stores (subscription, pricing)
 *
 * Auto-retry:
 * - Network: Listens to NetInfo; when connectivity returns, retries automatically.
 * - Backend: Polls health every 10s when offline due to backend only; when backend
 *   is back, refetches data and overlay dismisses.
 */
export function OfflineOverlay() {
  const isOffline = useIsOffline();
  const isNetworkConnected = useSystemStatusStore((s) => s.isNetworkConnected);
  const backendStatus = useSystemStatusStore((s) => s.backendStatus);
  const setNetworkConnected = useSystemStatusStore((s) => s.setNetworkConnected);
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();

  const [isRetrying, setIsRetrying] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryingRef = useRef(false);

  const isNetworkIssue = isNetworkConnected === false;
  const isBackendIssue = isNetworkConnected !== false && backendStatus === "offline";

  const performDataRefetch = useCallback(async () => {
    await queryClient.refetchQueries({
      predicate: (query) => query.state.status === "error"
    });
    await queryClient.invalidateQueries();
    const sub = useSubscriptionStore.getState();
    const pricing = usePricingStore.getState();
    sub.clearFetchCache();
    await Promise.all([sub.refresh(), pricing.fetchPlans(true)]);
  }, [queryClient]);

  const handleRetry = useCallback(async () => {
    if (retryingRef.current) return;
    retryingRef.current = true;
    setIsRetrying(true);

    try {
      const state = await NetInfo.fetch();
      setNetworkConnected(state.isConnected ?? true);

      if (state.isConnected) {
        await fetchBackendHealth({ force: true });
        await performDataRefetch();
      }
    } catch (error) {
      console.warn("[OfflineOverlay] Retry failed:", error);
    } finally {
      retryingRef.current = false;
      setIsRetrying(false);
    }
  }, [setNetworkConnected, performDataRefetch]);

  // Auto-retry when network comes back (offline due to network)
  useEffect(() => {
    if (!isOffline || isNetworkConnected !== false) return;

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected === true) handleRetry();
    });
    return () => unsubscribe();
  }, [isOffline, isNetworkConnected, handleRetry]);

  // Auto-retry when backend comes back (offline due to backend only; poll health)
  useEffect(() => {
    if (!isOffline || !isBackendIssue) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const poll = async () => {
      await fetchBackendHealth({ force: true });
      if (useSystemStatusStore.getState().backendStatus === "online") {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        await performDataRefetch();
      }
    };

    poll();
    pollRef.current = setInterval(poll, BACKEND_POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [isOffline, isBackendIssue, performDataRefetch]);

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
              size={60}
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
    width: 120,
    height: 120,
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
