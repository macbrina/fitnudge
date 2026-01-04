import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

import { AppUpdateModal } from "@/components/AppUpdateModal";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import { storageUtil, STORAGE_KEYS } from "@/utils/storageUtil";

interface AppUpdateContextType {
  /**
   * Whether an update is available
   */
  hasUpdate: boolean;
  /**
   * Whether the update is required (force update)
   */
  requiresUpdate: boolean;
  /**
   * The latest available version
   */
  latestVersion?: string;
  /**
   * The current app version
   */
  currentVersion?: string;
  /**
   * Release notes for the update
   */
  releaseNotes?: string;
  /**
   * Manually trigger the update modal
   */
  showUpdateModal: () => void;
  /**
   * Dismiss the update modal (for optional updates only)
   */
  hideUpdateModal: () => void;
  /**
   * Whether the update check is loading
   */
  isLoading: boolean;
  /**
   * Force refresh the update check
   */
  refetch: () => void;
}

const AppUpdateContext = createContext<AppUpdateContextType | undefined>(undefined);

interface AppUpdateProviderProps {
  children: React.ReactNode;
  /**
   * Whether to automatically show the modal when an update is available
   * Default: true
   */
  autoShow?: boolean;
  /**
   * Delay in milliseconds before showing the modal after app launch
   * Default: 2000 (2 seconds)
   */
  showDelay?: number;
  /**
   * Whether to enable update checking
   * Default: true
   */
  enabled?: boolean;
}

/**
 * AppUpdateProvider - Wraps the app and provides update checking functionality
 *
 * Usage:
 * ```tsx
 * // In your root layout or App.tsx
 * <AppUpdateProvider>
 *   <App />
 * </AppUpdateProvider>
 *
 * // To manually show update modal
 * const { showUpdateModal, hasUpdate } = useAppUpdateContext();
 * if (hasUpdate) {
 *   showUpdateModal();
 * }
 * ```
 */
export function AppUpdateProvider({
  children,
  autoShow = true,
  showDelay = 2000,
  enabled = true
}: AppUpdateProviderProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const { data: updateInfo, isLoading, refetch } = useAppUpdate(enabled);

  // Check if we should auto-show the modal
  useEffect(() => {
    const checkAndShowModal = async () => {
      if (!autoShow || !updateInfo?.hasUpdate) return;

      // For required updates, always show immediately
      if (updateInfo.requiresUpdate) {
        setModalVisible(true);
        return;
      }

      // For optional updates, check if user has dismissed this version
      const dismissedVersion = await storageUtil.getItem<string>(
        STORAGE_KEYS.DISMISSED_UPDATE_VERSION
      );
      if (dismissedVersion === updateInfo.latest_version) {
        return;
      }

      // Show after delay for better UX
      const timer = setTimeout(() => {
        setModalVisible(true);
      }, showDelay);

      return () => clearTimeout(timer);
    };

    checkAndShowModal();
  }, [autoShow, updateInfo?.hasUpdate, updateInfo?.requiresUpdate, showDelay]);

  const showUpdateModal = useCallback(() => {
    setModalVisible(true);
  }, []);

  const hideUpdateModal = useCallback(async () => {
    // Only allow hiding for optional updates
    if (updateInfo?.requiresUpdate) return;

    // Remember that user dismissed this version
    if (updateInfo?.latest_version) {
      await storageUtil.setItem(STORAGE_KEYS.DISMISSED_UPDATE_VERSION, updateInfo.latest_version);
    }

    setModalVisible(false);
  }, [updateInfo?.requiresUpdate, updateInfo?.latest_version]);

  const contextValue: AppUpdateContextType = {
    hasUpdate: updateInfo?.hasUpdate ?? false,
    requiresUpdate: updateInfo?.requiresUpdate ?? false,
    latestVersion: updateInfo?.latest_version,
    currentVersion: updateInfo?.currentVersion,
    releaseNotes: updateInfo?.release_notes,
    showUpdateModal,
    hideUpdateModal,
    isLoading,
    refetch
  };

  return (
    <AppUpdateContext.Provider value={contextValue}>
      {children}
      <AppUpdateModal
        visible={modalVisible}
        latestVersion={updateInfo?.latest_version}
        isRequired={updateInfo?.requiresUpdate}
        releaseNotes={updateInfo?.release_notes}
        onDismiss={hideUpdateModal}
        onUpdate={() => {
          // Close modal before redirect
          setModalVisible(false);
          // Track analytics here if needed
        }}
      />
    </AppUpdateContext.Provider>
  );
}

/**
 * Hook to access the app update context
 *
 * Usage:
 * ```tsx
 * const { hasUpdate, showUpdateModal } = useAppUpdateContext();
 * ```
 */
export function useAppUpdateContext(): AppUpdateContextType {
  const context = useContext(AppUpdateContext);
  if (!context) {
    throw new Error("useAppUpdateContext must be used within an AppUpdateProvider");
  }
  return context;
}

export default AppUpdateProvider;
