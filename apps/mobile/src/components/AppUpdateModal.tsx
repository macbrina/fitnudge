import React, { useEffect, useState, useCallback } from "react";
import { View, Text, Modal, Pressable, Image, Linking, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";

import Button from "@/components/ui/Button";
import { useTranslation } from "@/lib/i18n";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { APP_STORE_URLS } from "@/constants/general";
import { isIOS } from "@/utils/platform";
import { storageUtil, STORAGE_KEYS } from "@/utils/storageUtil";

// Update check image
const UpdateImage = require("@assetsimages/images/app_update.png");

interface AppUpdateModalProps {
  /**
   * The latest version available (e.g., "1.2.0")
   * If not provided, the modal won't show
   */
  latestVersion?: string;
  /**
   * Whether the update is required (force update)
   * If true, user cannot dismiss the modal
   */
  isRequired?: boolean;
  /**
   * Release notes or update description
   */
  releaseNotes?: string;
  /**
   * Callback when user chooses to update
   */
  onUpdate?: () => void;
  /**
   * Callback when user dismisses the modal
   */
  onDismiss?: () => void;
  /**
   * Whether to show the modal (controlled mode)
   * If not provided, uses internal state based on version comparison
   */
  visible?: boolean;
}

/**
 * Compares two semantic version strings
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

/**
 * AppUpdateModal - Shows when a new app version is available
 *
 * Usage:
 * ```tsx
 * // Basic usage - checks against latestVersion
 * <AppUpdateModal latestVersion="1.2.0" />
 *
 * // Controlled mode
 * <AppUpdateModal visible={showUpdate} latestVersion="1.2.0" onDismiss={() => setShowUpdate(false)} />
 *
 * // Force update (user cannot dismiss)
 * <AppUpdateModal latestVersion="2.0.0" isRequired />
 * ```
 */
export function AppUpdateModal({
  latestVersion,
  isRequired = false,
  releaseNotes,
  onUpdate,
  onDismiss,
  visible: controlledVisible
}: AppUpdateModalProps) {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();

  const [internalVisible, setInternalVisible] = useState(false);
  const currentVersion = Constants.expoConfig?.version || "1.0.0";

  // Use controlled or internal visibility
  const isVisible = controlledVisible !== undefined ? controlledVisible : internalVisible;

  // Check if update is needed
  useEffect(() => {
    const checkUpdate = async () => {
      if (!latestVersion || controlledVisible !== undefined) return;

      // Compare versions
      const needsUpdate = compareVersions(latestVersion, currentVersion) > 0;

      if (!needsUpdate) {
        setInternalVisible(false);
        return;
      }

      // Check if user has dismissed this version before (for non-required updates)
      if (!isRequired) {
        const dismissedVersion = await storageUtil.getItem<string>(
          STORAGE_KEYS.DISMISSED_UPDATE_VERSION
        );
        if (dismissedVersion === latestVersion) {
          setInternalVisible(false);
          return;
        }
      }

      setInternalVisible(true);
    };

    checkUpdate();
  }, [latestVersion, currentVersion, isRequired, controlledVisible]);

  // Handle update button press
  const handleUpdate = useCallback(() => {
    // Close modal first
    setInternalVisible(false);
    onUpdate?.();

    // Then redirect to store
    const storeUrl = isIOS ? APP_STORE_URLS.IOS : APP_STORE_URLS.ANDROID;
    Linking.openURL(storeUrl);
  }, [onUpdate]);

  // Handle dismiss button press
  const handleDismiss = useCallback(async () => {
    if (isRequired) return; // Cannot dismiss required updates

    // Remember that user dismissed this version
    if (latestVersion) {
      await storageUtil.setItem(STORAGE_KEYS.DISMISSED_UPDATE_VERSION, latestVersion);
    }

    setInternalVisible(false);
    onDismiss?.();
  }, [isRequired, latestVersion, onDismiss]);

  if (!isVisible) return null;

  return (
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={handleDismiss}>
      <Pressable
        style={styles.overlay}
        onPress={isRequired ? undefined : handleDismiss}
        disabled={isRequired}
      >
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          {/* Update Image */}
          <Image source={UpdateImage} style={styles.image} resizeMode="contain" />

          {/* Title */}
          <Text style={styles.title}>{t("update.title") || "Update Available"}</Text>

          {/* Version Info */}
          <View style={styles.versionRow}>
            <Text style={styles.versionLabel}>{t("update.current_version") || "Current"}:</Text>
            <Text style={styles.versionValue}>v{currentVersion}</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.text.tertiary} />
            <Text style={[styles.versionValue, styles.versionNew]}>v{latestVersion}</Text>
          </View>

          {/* Description */}
          <Text style={styles.description}>
            {releaseNotes ||
              t("update.description") ||
              "A new version of FitNudge is available. Update now to get the latest features and improvements."}
          </Text>

          {/* Required Update Badge */}
          {isRequired && (
            <View style={styles.requiredBadge}>
              <Ionicons name="alert-circle" size={16} color={colors.feedback.error} />
              <Text style={styles.requiredText}>
                {t("update.required") || "This update is required to continue using the app"}
              </Text>
            </View>
          )}

          {/* Buttons */}
          <View style={styles.buttonsContainer}>
            <Button
              title={t("update.update_now") || "Update Now"}
              onPress={handleUpdate}
              variant="primary"
              fullWidth
            />

            {!isRequired && (
              <Button
                title={t("update.maybe_later") || "Maybe Later"}
                onPress={handleDismiss}
                variant="ghost"
                fullWidth
                style={styles.laterButton}
              />
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center" as const,
    alignItems: "center" as const,
    padding: toRN(tokens.spacing[4])
  },
  container: {
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius["2xl"]),
    padding: toRN(tokens.spacing[6]),
    width: "100%" as const,
    maxWidth: 340,
    alignItems: "center" as const,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10
  },
  image: {
    width: 120,
    height: 120,
    marginBottom: toRN(tokens.spacing[4])
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[3])
  },
  versionRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    marginBottom: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.muted,
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.full)
  },
  versionLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },
  versionValue: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.secondary
  },
  versionNew: {
    color: brand.primary
  },
  description: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5,
    marginBottom: toRN(tokens.spacing[4])
  },
  requiredBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    backgroundColor: `${colors.feedback.error}15`,
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.lg),
    marginBottom: toRN(tokens.spacing[4])
  },
  requiredText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.feedback.error,
    flex: 1
  },
  buttonsContainer: {
    width: "100%" as const,
    gap: toRN(tokens.spacing[2])
  },
  laterButton: {
    marginTop: toRN(tokens.spacing[1])
  }
});

export default AppUpdateModal;
